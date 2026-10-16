/**
 * The JWT proof format (`JwtProof2020`).
 *
 * The signing input is `base64url(header) + "." + base64url(payload)` — pure
 * encoding, no crypto. That is deliberate: this package produces **the exact bytes
 * to sign**, so a caller can satisfy them with a signer, an HSM, a daemon, or by
 * hand.
 *
 * Issuing canonicalises the payload (see `canonical.ts`). Verifying never
 * re-serialises — it reuses the literal JWT, so credentials from any implementation
 * verify unchanged.
 *
 * ## `JwtProof2020` is a profile, not a W3C proof format
 *
 * The VC Data Model (§6.3) defines exactly two proof formats: a **bare JWT**, where
 * the compact serialisation *is* the credential and there is no `proof` property at
 * all, and **Data Integrity**, where `proof` carries a `proofValue`. What we do is
 * neither. The document stays a document — inspectable by a JSON-only consumer that
 * never decodes anything — and the whole JWT that covers it is carried in
 * `proof.jwt`. That is the Entra/Transmute profile.
 *
 * It is a deliberate choice, and the honest place to record it is here. Everything
 * below it — the claim names, `nbf`/`exp`/`jti`, the decoding round-trip — is the
 * standard's, and a processor that knows §6.3.1 will read our JWTs correctly.
 */

import { canonicalize } from "./canonical.js";
import type { Proof, UnsignedCredential, VerifiableCredential } from "./types.js";

export const PROOF_TYPE = "JwtProof2020";
export const DEFAULT_ALG = "EdDSA";
export const DEFAULT_TYP = "JWT";

export interface JwtHeader {
  alg: string;
  typ: string;
}

/**
 * The registered claims of a JWT proof, shared by both artifacts.
 *
 * A credential's JWT carries `vc`; a presentation's carries `vp`. **Which of the two
 * is present is what identifies the document** — that is why `alg` and `typ` can stay
 * advisory while the payload does the distinguishing.
 *
 * Every claim here means what §6.3.1 says it means. That is not pedantry: these are
 * the claims a *foreign* processor will decode by, so a claim carrying something else
 * hands that processor a document nobody signed.
 */
export interface JwtPayload {
  /** The credential, on a credential's JWT. */
  vc?: unknown;
  /** The presentation, on a presentation's JWT. */
  vp?: unknown;
  /** The issuer of a credential, or **the holder** of a presentation. */
  iss: string;
  /** The document's own `id`. **Not** the anti-replay — that is `nonce`. */
  jti?: string;
  /** Issued at, epoch seconds. The spec's examples carry it beside `nbf`. */
  iat?: number;
  /** Not before, epoch seconds — represents the document's `issuanceDate`. */
  nbf?: number;
  /** Expiry, epoch seconds — represents the document's `expirationDate`. */
  exp?: number;
  /** The intended verifier. Only a presentation has one. */
  aud?: string;
  /**
   * The verifier's single-use nonce — **the anti-replay** (§6.3.1).
   *
   * Deliberately not `jti`. `jti` is the *presenter's* value and `nonce` is the
   * *verifier's*, and replay protection resting on a value the presenter chooses is
   * not replay protection at all.
   */
  nonce?: string;
  [x: string]: unknown;
}

export function base64urlEncode(input: string | Uint8Array): string {
  return Buffer.from(input as never).toString("base64url");
}

export function base64urlDecode(encoded: string): string {
  return Buffer.from(encoded, "base64url").toString("utf8");
}

export function header(alg: string = DEFAULT_ALG): JwtHeader {
  return { alg, typ: DEFAULT_TYP };
}

/** The JWT payload for a credential: `vc` plus the standard registered claims. */
export function payload<S>(unsigned: UnsignedCredential<S>): JwtPayload {
  const out: JwtPayload = {
    vc: unsigned,
    iss: unsigned.issuer.id,
    jti: unsigned.id,
  };

  const notBefore = epochSeconds(unsigned.issuanceDate);
  if (notBefore !== null) out.nbf = notBefore;

  if (unsigned.expirationDate !== undefined) {
    const expiry = epochSeconds(unsigned.expirationDate);
    if (expiry !== null) out.exp = expiry;
  }

  return out;
}

/**
 * The exact string a signer must sign.
 *
 * Deterministic: the payload is canonicalised, so two callers building the same
 * credential produce the same bytes.
 */
export function signingInput<S>(
  unsigned: UnsignedCredential<S>,
  opts?: { alg?: string },
): string {
  const head = base64urlEncode(canonicalize(header(opts?.alg)));
  const body = base64urlEncode(canonicalize(payload(unsigned)));
  return `${head}.${body}`;
}

/** Attach a signature, producing a JWT-proofed credential. */
export function attachProof<S>(
  unsigned: UnsignedCredential<S>,
  signature: string,
  opts?: { alg?: string },
): VerifiableCredential<S> {
  return {
    ...unsigned,
    proof: {
      type: PROOF_TYPE,
      jwt: `${signingInput(unsigned, opts)}.${signature}`,
      verificationMethod: unsigned.issuer.id,
    },
  };
}

/**
 * The portion of an issued document that was signed — `header.payload`.
 *
 * Takes `unknown` on purpose. *"Which artifacts can carry a proof?"* is a question
 * this function has no business answering — it looks for a proof and reports what it
 * finds. A credential, a presentation, and an **unsigned** credential (which has no
 * `proof` key at all, and so would be rejected by any narrower parameter type) are
 * all perfectly good arguments.
 *
 * Taken **literally** from `proof.jwt`; never recomputed.
 */
export function signedPortion(document: unknown): string | null {
  const jwt = proofOf(document)?.jwt;
  if (typeof jwt !== "string") return null;

  const segments = jwt.split(".");
  if (segments.length !== 3) return null;

  return `${segments[0]}.${segments[1]}`;
}

/** The decoded JWT parts of an issued document, or `null` if malformed. */
export function decodeCredential(
  document: unknown,
): { header: JwtHeader; payload: JwtPayload } | null {
  const jwt = proofOf(document)?.jwt;
  if (typeof jwt !== "string") return null;

  const segments = jwt.split(".");
  if (segments.length !== 3) return null;

  try {
    return {
      header: JSON.parse(base64urlDecode(segments[0] as string)) as JwtHeader,
      payload: JSON.parse(base64urlDecode(segments[1] as string)) as JwtPayload,
    };
  } catch {
    return null;
  }
}

/** The proof on a document, if it has one — credential, presentation, or neither. */
function proofOf(document: unknown): Proof | undefined {
  if (document === null || typeof document !== "object") return undefined;

  const proof = (document as { proof?: unknown }).proof;
  return proof !== null && typeof proof === "object" ? (proof as Proof) : undefined;
}

function epochSeconds(timestamp: string): number | null {
  const millis = Date.parse(timestamp);
  return Number.isNaN(millis) ? null : Math.floor(millis / 1000);
}
