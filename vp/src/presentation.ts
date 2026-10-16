/**
 * Building and signing a presentation.
 *
 * The signing input has exactly the shape a credential's does — `header.payload`,
 * both canonicalised, no crypto — but the payload is a different claim set, and every
 * claim in it does the job §6.3.1 gives it:
 *
 * | claim | what it carries | who chooses it |
 * |---|---|---|
 * | `vp` | the presentation itself | the holder |
 * | `iss` | **the holder** — a presentation has no issuer | the holder |
 * | `aud` | which verifier this is for | the challenge |
 * | `nonce` | the anti-replay, single use | **the challenge** |
 * | `jti` | the presentation's own `id` | the holder |
 * | `iat` · `nbf` · `exp` | the window | **the challenge** |
 *
 * ## The window is written into the document
 *
 * `nbf` MUST represent `issuanceDate` and `exp` MUST represent `expirationDate`, so
 * those two claims may only ever carry a window the document itself states. `present`
 * therefore stamps both dates onto the presentation from the challenge, before
 * signing: the window ends up in the signed document *and* in the claims that must
 * represent it, and any processor that decodes our JWT back to plain JSON recovers
 * the document we signed rather than a different one.
 *
 * It also keeps the artifact honest. A presentation with no dates is a presentation
 * with no expiry, and the window belongs to the verifier — so it is the verifier's
 * clock, arriving in the challenge, that writes it.
 *
 * ## Why `jti` is not the nonce
 *
 * Assigning the challenge's nonce to `jti` looks like it saves a claim. It breaks two
 * things. `jti` MUST represent `id`, so a conformant decoder would overwrite the
 * presentation's own `id` with the nonce — handing it a document neither party ever
 * signed. And the one property the verifier depends on would live in a value the
 * *presenter* controls. `nonce` is the data model's own claim for this; it is the one
 * that gets the lookup.
 */

import {
  DEFAULT_ALG,
  DEFAULT_TYP,
  PROOF_TYPE,
  base64urlEncode,
  canonicalize,
  validateStructure,
  type JwtHeader,
  type JwtPayload,
  type UnsignedPresentation,
  type VerifiablePresentation,
} from "@synthetism/credential";
import type { ISigner } from "@synthetism/vc";
import { assertChallenge, epochSeconds } from "./challenge.js";
import type { Challenge, PresentResult } from "./types.js";

/** The challenge's window, in epoch seconds. */
interface Window {
  issuedAt: number;
  expiresAt: number;
}

/** The presentation as it will be signed — the challenge's window stamped into it. */
export function presentationDocument<C>(
  unsigned: UnsignedPresentation<C>,
  challenge: Challenge,
  opts: PresentationOptions = {},
): UnsignedPresentation<C> {
  assertChallenge(challenge);
  return stampWindow(unsigned, windowOf(challenge, opts));
}

export interface PresentationOptions {
  /** The JWT algorithm. Defaults to `EdDSA` — the only one this stack verifies. */
  alg?: string;
  /**
   * The clock, for the window's start.
   *
   * Pin it when you need the same presentation to produce the same bytes twice.
   * `present` pins it for you, because the window is derived from the clock and
   * signing at one instant while attaching at another would produce a JWT covering
   * bytes nobody signed.
   */
  now?: Date;
}

/**
 * The JWT payload of a presentation: the document, plus the challenge echoed back
 * under the holder's name.
 */
export function presentationPayload<C>(
  unsigned: UnsignedPresentation<C>,
  challenge: Challenge,
  opts: PresentationOptions = {},
): JwtPayload {
  assertChallenge(challenge);

  const window = windowOf(challenge, opts);
  return payloadOf(stampWindow(unsigned, window), challenge, window);
}

/**
 * The exact string a signer must sign.
 *
 * Deterministic for a given `now` — the payload is canonicalised, so two callers
 * building the same presentation inside the same challenge produce the same bytes.
 */
export function presentationSigningInput<C>(
  unsigned: UnsignedPresentation<C>,
  challenge: Challenge,
  opts: PresentationOptions = {},
): string {
  assertChallenge(challenge);

  const window = windowOf(challenge, opts);
  return signingInputOf(stampWindow(unsigned, window), challenge, window, opts);
}

/**
 * Attach a signature, producing a JWT-proofed presentation.
 *
 * `verificationMethod` is the **holder**: whoever signs a presentation is the party
 * whose control is being proven. It is never an issuer, because there isn't one.
 */
export function attachPresentationProof<C>(
  unsigned: UnsignedPresentation<C>,
  signature: string,
  challenge: Challenge,
  opts: PresentationOptions = {},
): VerifiablePresentation<C> {
  assertChallenge(challenge);

  const window = windowOf(challenge, opts);
  const document = stampWindow(unsigned, window);

  return {
    ...document,
    proof: {
      type: PROOF_TYPE,
      jwt: `${signingInputOf(document, challenge, window, opts)}.${signature}`,
      verificationMethod: document.holder.id,
    },
  };
}

/**
 * Present: an unsigned presentation, a signer and a challenge in; a signed
 * presentation out.
 *
 * The counterpart of `issue`. The signer is the holder's own `ISigner` — this
 * package never sees a key, and the port has one method because one is enough.
 *
 * @throws if the document is malformed, there is no usable challenge, the signer
 * has no `sign`, or the signer returns nothing. Sending something unverifiable is
 * worse than failing.
 */
export async function present<C>(
  unsigned: UnsignedPresentation<C>,
  signer: ISigner,
  challenge: Challenge,
  opts: PresentationOptions = {},
): Promise<PresentResult<C>> {
  assertChallenge(challenge);

  if (
    signer === null ||
    typeof signer !== "object" ||
    typeof signer.sign !== "function"
  ) {
    throw new TypeError("signer must be an object with a sign(data) method");
  }

  const structure = validateStructure(unsigned);
  if (!structure.valid) {
    throw new Error(
      `cannot present a malformed presentation: ${structure.errors.join("; ")}`,
    );
  }

  // Pin the clock once, and carry it through both halves. The window is derived from
  // it, so computing the payload again at attach time a millisecond later could cross
  // a second boundary and produce a JWT whose signed bytes are not the ones we signed.
  const at: PresentationOptions = { ...opts, now: opts.now ?? new Date() };

  const input = presentationSigningInput(unsigned, challenge, at);
  const signature = await signer.sign(input);

  if (typeof signature !== "string" || signature === "") {
    throw new Error("signer returned no signature");
  }

  return {
    presentation: attachPresentationProof(unsigned, signature, challenge, at),
    signingInput: input,
  };
}

function windowOf(challenge: Challenge, opts: PresentationOptions): Window {
  const issuedAt = epochSeconds(opts.now ?? new Date());
  return { issuedAt, expiresAt: issuedAt + challenge.expiresIn };
}

/** The dates that make `nbf` and `exp` mean what §6.3.1 says they mean. */
function stampWindow<C>(
  unsigned: UnsignedPresentation<C>,
  window: Window,
): UnsignedPresentation<C> {
  return {
    ...unsigned,
    issuanceDate: iso(window.issuedAt),
    expirationDate: iso(window.expiresAt),
  };
}

function payloadOf<C>(
  document: UnsignedPresentation<C>,
  challenge: Challenge,
  window: Window,
): JwtPayload {
  return {
    vp: document,
    iss: document.holder.id,
    aud: challenge.aud,
    nonce: challenge.nonce,
    jti: document.id,
    iat: window.issuedAt,
    nbf: window.issuedAt,
    exp: window.expiresAt,
  };
}

function signingInputOf<C>(
  document: UnsignedPresentation<C>,
  challenge: Challenge,
  window: Window,
  opts: PresentationOptions,
): string {
  // `typ` is `JWT` because §6.3.1 says it MUST be, and nothing is lost: `alg` and
  // `typ` were always advisory, and the `vp` claim is what identifies the document.
  const header: JwtHeader = { alg: opts.alg ?? DEFAULT_ALG, typ: DEFAULT_TYP };

  const head = base64urlEncode(canonicalize(header));
  const body = base64urlEncode(canonicalize(payloadOf(document, challenge, window)));

  return `${head}.${body}`;
}

function iso(epoch: number): string {
  return new Date(epoch * 1000).toISOString();
}
