/**
 * Verifying a presentation — the holder's proof, then what it holds.
 *
 * `verify` in `@synthetism/vc` answers *"is this credential good?"*. This answers
 * the question a verifier actually asks, which is a different one:
 *
 * > **is this presenter the party the credential was issued to — right now, for me?**
 *
 * Three things have to hold, and they have nothing to do with each other:
 *
 * 1. **The window.** `aud` is this verifier, `nonce` is the nonce it issued, and
 *    `[nbf, exp]` fits inside the challenge. The presenter picks none of the four.
 * 2. **The binding.** The holder is the subject of every credential it carries.
 *    Without this a credential is a coupon, and coupons leak instantly.
 * 3. **The credentials.** Each one verifies on its own terms — signature, issuer,
 *    validity, and no edits after signing.
 *
 * ## What this does not do, on purpose
 *
 * **Single use.** `nonce` must equal the nonce you issued; whether you have *seen*
 * that nonce before is state, and state belongs to the verifier, not to a pure
 * function. Keep the nonce until its challenge expires and refuse a second sighting.
 * `verifyPresentation` cannot do it for you and will not pretend to — see the
 * README for the five lines that do.
 *
 * It also never throws on a bad *document*: an unverifiable presentation is a
 * result, not an exception. It throws only when the caller has not said what it is
 * verifying against, which is a bug on this side of the wire.
 */

import {
  PROOF_TYPE,
  canonicalize,
  decodeCredential,
  signedPortion,
  validateStructure,
  type JwtPayload,
  type VerifiableCredential,
  type VerifiablePresentation,
} from "@synthetism/credential";
import { verifyEd25519 } from "@synthetism/keys";
import {
  DEFAULT_ALGORITHMS,
  resolveDidKey,
  verify as verifyCredential,
  type ResolveDid,
  type VerifyResult,
  type VerifySignature,
} from "@synthetism/vc";
import { assertChallenge, epochSeconds } from "./challenge.js";
import type { Challenge } from "./types.js";

/**
 * Seconds of tolerance for two clocks that disagree.
 *
 * Zero by default, because a verifier that shrugs at a skewed clock also shrugs at
 * a widened window. Raise it only when you know your presenters' clocks, and
 * remember that `skew` widens every bound below.
 */
export const DEFAULT_SKEW = 0;

export interface VerifyPresentationOptions {
  /**
   * The challenge this verifier issued.
   *
   * Required, and required to be *yours*. Verifying a presentation against nothing
   * in particular is how `aud` became an afterthought in every implementation that
   * shipped one.
   */
  challenge: Challenge;

  /** Signature check for the holder. Defaults to Ed25519 via `@synthetism/keys`. */
  verify?: VerifySignature;
  /**
   * DID → public key, used for the holder and for each credential's issuer.
   * Defaults to `did:key` resolution.
   */
  resolve?: ResolveDid;
  /** Algorithms accepted from the JWT header. Defaults to `["EdDSA"]`. */
  algorithms?: readonly string[];
  /** The clock. Defaults to now. */
  now?: Date;
  /** Clock tolerance in seconds. Defaults to `DEFAULT_SKEW`. */
  skew?: number;
  /** Verify each carried credential. Defaults to `true`. */
  credentials?: boolean;
  /**
   * Require every carried credential to name the presenter as its subject.
   * Defaults to `true`. Turning this off makes a credential a bearer coupon.
   */
  binding?: boolean;
}

/**
 * A presentation in, a verdict out.
 *
 * @throws {TypeError} if `opts.challenge` is missing or unusable — that is a caller
 * error, and silently verifying against nothing would be worse than failing.
 */
export function verifyPresentation<C = VerifiableCredential>(
  presentation: VerifiablePresentation<C>,
  opts: VerifyPresentationOptions,
): VerifyResult {
  assertChallenge(opts?.challenge);

  const challenge = opts.challenge;
  const errors: string[] = [];

  const now = epochSeconds(opts.now ?? new Date());
  const skew = opts.skew ?? DEFAULT_SKEW;
  const algorithms = opts.algorithms ?? DEFAULT_ALGORITHMS;
  const verifySignature = opts.verify ?? verifyEd25519;
  const resolve = opts.resolve ?? resolveDidKey;
  const checkCredentials = opts.credentials ?? true;
  const checkBinding = opts.binding ?? true;

  if (!isObject(presentation)) {
    return { verified: false, errors: ["not a presentation"] };
  }

  const structure = validateStructure(presentation);
  if (!structure.valid) {
    errors.push(...structure.errors.map((error) => `structure: ${error}`));
  }

  const absent: VerifyResult = { verified: false, errors };

  const proof = presentation.proof;
  if (proof === undefined) {
    return { ...absent, errors: [...errors, "no proof"] };
  }
  if (proof.type !== PROOF_TYPE) {
    errors.push(
      `proof.type must be ${PROOF_TYPE}, got ${JSON.stringify(proof.type)}`,
    );
  }

  // The literal bytes that were signed.
  const input = signedPortion(presentation);
  const segments = typeof proof.jwt === "string" ? proof.jwt.split(".") : [];
  if (input === null || segments.length !== 3) {
    return {
      ...absent,
      errors: [...errors, "proof.jwt is not a three-part JWT"],
    };
  }

  const signature = segments[2] as string;
  if (signature === "") {
    errors.push("proof.jwt carries an empty signature");
  }

  const decoded = decodeCredential(presentation);
  if (decoded === null) {
    return { ...absent, errors: [...errors, "proof.jwt does not decode"] };
  }
  const { header, payload: claims } = decoded;

  // Policy first, exactly as `verify` does it: an `alg: "none"` presentation is
  // refused by policy before a lenient signature checker can be asked.
  const algorithmAccepted = algorithms.includes(header.alg);
  if (!algorithmAccepted) {
    errors.push(
      `alg ${JSON.stringify(header.alg)} is not accepted (expected ${algorithms.join(" or ")})`,
    );
  }
  if (isForeignTyp(header.typ)) {
    errors.push(`typ ${JSON.stringify(header.typ)} is not a presentation`);
  }

  const holderId = holderIdOf(presentation);

  // --- the challenge, echoed back under the holder's signature -----------------
  if (claims.vp === undefined) {
    errors.push(
      "the payload carries no vp — this is a credential's JWT, not a presentation's",
    );
  }
  if (holderId === undefined) {
    errors.push("the presentation names no holder");
  } else if (claims.iss !== holderId) {
    errors.push(`payload.iss (${String(claims.iss)}) is not the holder (${holderId})`);
  }
  if (claims.aud !== challenge.aud) {
    errors.push(`payload.aud (${String(claims.aud)}) is not this verifier (${challenge.aud})`);
  }

  // The anti-replay, and the two claims §6.3.1 requires to agree with the document.
  // `jti` is the presentation's *own* id — it is not the nonce, and a decoder told
  // otherwise would rebuild a presentation neither party ever signed.
  if (claims.nonce !== challenge.nonce) {
    errors.push("payload.nonce is not the nonce this verifier issued");
  }
  if (claims.jti !== presentation.id) {
    errors.push(
      `payload.jti (${String(claims.jti)}) is not the presentation's id (${presentation.id})`,
    );
  }
  errors.push(...documentClaimErrors(presentation, claims));
  errors.push(...windowErrors(claims, challenge, now, skew));

  // --- the document is the document that was signed ----------------------------
  if (canonicalize(withoutProof(presentation)) !== canonicalize(claims.vp)) {
    errors.push("the presentation does not match the signed payload (edited after signing)");
  }

  // --- the signature, over the literal bytes -----------------------------------
  const method = typeof proof.verificationMethod === "string" && proof.verificationMethod !== ""
    ? proof.verificationMethod
    : holderId ?? "";
  const publicKeyPem = resolve(method);

  if (publicKeyPem === undefined) {
    errors.push(`cannot resolve ${method} to a public key`);
  } else if (algorithmAccepted && !verifySignature(input, signature, publicKeyPem)) {
    errors.push("signature does not verify");
  }

  // --- what the presentation carries -------------------------------------------
  if (checkCredentials || checkBinding) {
    errors.push(
      ...carriedErrors(presentation, {
        holderId,
        checkCredentials,
        checkBinding,
        opts,
      }),
    );
  }

  return { verified: errors.length === 0, errors };
}

/**
 * The window has to fit the challenge the verifier actually issued.
 *
 * Without this a presenter reads the same code, signs for a decade, and replays at
 * leisure — the nonce cache would be the only thing standing, and its lifetime is
 * exactly the window the presenter just chose.
 *
 * Four bounds, and each one closes a different hole:
 *
 * - **live now** — `nbf ≤ now ≤ exp`. An old signature is not a new one.
 * - **no wider** — `exp − nbf ≤ expiresIn`. This is the one that matters: it is what
 *   makes the presenter's window *your* window.
 * - **not before the challenge** — `nbf ≥ issuedAt`. Otherwise a presenter backdates
 *   a window that happened to be valid when a different nonce was in play.
 * - **not after the challenge** — `nbf ≤ issuedAt + expiresIn`. A presenter that
 *   signs a fresh, short window against a challenge this verifier issued an hour ago
 *   is replaying a nonce it should no longer be able to use.
 *
 * Note what is *not* here: a comparison of `exp` against `issuedAt + expiresIn`. The
 * presenter stamps `nbf` from its own clock and derives `exp` from it, so the window
 * legitimately slides by the round trip. Bounding the width and the start bounds the
 * end; adding a third comparison would only punish latency.
 */
function windowErrors(
  claims: JwtPayload,
  challenge: Challenge,
  now: number,
  skew: number,
): string[] {
  if (typeof claims.nbf !== "number" || typeof claims.exp !== "number") {
    return ["the payload carries no numeric nbf/exp — a presentation without a window is not one"];
  }

  const errors: string[] = [];
  const widest = challenge.expiresIn + skew;

  if (now < claims.nbf - skew) {
    errors.push(`not valid before ${iso(claims.nbf)}`);
  }
  if (now > claims.exp + skew) {
    errors.push(`expired at ${iso(claims.exp)}`);
  }

  if (claims.exp - claims.nbf > widest) {
    errors.push(
      `the signed window is ${claims.exp - claims.nbf}s, wider than the ${challenge.expiresIn}s challenge`,
    );
  }

  if (challenge.issuedAt !== undefined) {
    if (claims.nbf < challenge.issuedAt - skew) {
      errors.push("the signed window starts before the challenge was issued");
    }
    if (claims.nbf > challenge.issuedAt + widest) {
      errors.push("the signed window starts after the challenge expired");
    }
  }

  return errors;
}

/**
 * Every credential the presentation carries, and the binding that makes carrying it
 * mean anything.
 */
function carriedErrors<C>(
  presentation: VerifiablePresentation<C>,
  context: {
    holderId: string | undefined;
    checkCredentials: boolean;
    checkBinding: boolean;
    opts: VerifyPresentationOptions;
  },
): string[] {
  const errors: string[] = [];
  const carried = Array.isArray(presentation.verifiableCredential)
    ? presentation.verifiableCredential
    : [];

  carried.forEach((carried, index) => {
    // The document is `unknown` at the type level and a rumour at runtime; `verify`
    // makes its own structural judgement and never throws.
    const credential = carried as VerifiableCredential<unknown>;

    if (context.checkCredentials) {
      const result = verifyCredential(credential, {
        verify: context.opts.verify,
        resolve: context.opts.resolve,
        algorithms: context.opts.algorithms,
        now: context.opts.now,
      });
      for (const error of result.errors) {
        errors.push(`credential[${index}]: ${error}`);
      }
    }

    if (context.checkBinding) {
      const subjectId = subjectHolderIdOf(credential);
      if (subjectId === undefined) {
        errors.push(
          `credential[${index}]: the credential names no subject holder, so it cannot be bound to this presenter`,
        );
      } else if (subjectId !== context.holderId) {
        errors.push(
          `credential[${index}]: the presenter is not the credential's subject (${subjectId}) — this credential is not theirs to present`,
        );
      }
    }
  });

  return errors;
}

/** The document as it was signed: everything except the proof. */
function withoutProof(presentation: VerifiablePresentation<unknown>): Record<string, unknown> {
  const document: Record<string, unknown> = { ...presentation };
  // The proof must be absent, not present-but-undefined: this document is compared
  // field-for-field against the bytes that were signed.
  // biome-ignore lint/performance/noDelete: absence is the point.
  delete document.proof;
  return document;
}

/** Defensive: `verifyPresentation` is callable from JavaScript, where types are a rumour. */
function isObject(value: unknown): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function holderIdOf(presentation: VerifiablePresentation<unknown>): string | undefined {
  const holder = presentation.holder as { id?: unknown } | null | undefined;
  return typeof holder?.id === "string" && holder.id !== "" ? holder.id : undefined;
}

function subjectHolderIdOf(credential: VerifiableCredential<unknown>): string | undefined {
  const subject = credential?.credentialSubject as
    | { holder?: { id?: unknown } }
    | null
    | undefined;
  const id = subject?.holder?.id;
  return typeof id === "string" && id !== "" ? id : undefined;
}

/**
 * The claims that MUST represent a field of the document (§6.3.1), checked against it.
 *
 * `jti` and `nonce` are checked by the caller; these are the dates. A presenter holds
 * both the document and the claims, so a window stated in one and not the other is a
 * window a conformant decoder would reconstruct differently — and it is precisely the
 * shape of a presentation that quietly outlives its challenge.
 */
function documentClaimErrors(
  presentation: VerifiablePresentation<unknown>,
  claims: JwtPayload,
): string[] {
  const errors: string[] = [];

  const issuance = epochOf(presentation.issuanceDate);
  if (issuance !== null && issuance !== claims.nbf) {
    errors.push("the presentation's issuanceDate does not match payload.nbf");
  }

  const expiry = epochOf(presentation.expirationDate);
  if (expiry !== null && expiry !== claims.exp) {
    errors.push("the presentation's expirationDate does not match payload.exp");
  }

  return errors;
}

/**
 * `typ` MUST be `JWT` (§6.3.1), and here we hold it to that.
 *
 * Permissive about what the data model *permits*, strict about what it *forbids* —
 * a verifier that waves through a `typ` the standard rules out is the same verifier
 * that waves through `alg: "none"`.
 */
function isForeignTyp(typ: unknown): boolean {
  return typ !== undefined && typ !== "JWT";
}

function epochOf(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const millis = Date.parse(value);
  return Number.isNaN(millis) ? null : Math.floor(millis / 1000);
}

function iso(epoch: number): string {
  return new Date(epoch * 1000).toISOString();
}
