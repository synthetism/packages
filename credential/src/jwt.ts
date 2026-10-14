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
 */

import { canonicalize } from "./canonical.js";
import type { UnsignedCredential, VerifiableCredential } from "./types.js";

export const PROOF_TYPE = "JwtProof2020";
export const DEFAULT_ALG = "EdDSA";
export const DEFAULT_TYP = "JWT";

export interface JwtHeader {
  alg: string;
  typ: string;
}

export interface JwtPayload {
  vc: unknown;
  iss: string;
  jti?: string;
  nbf?: number;
  exp?: number;
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
 * The portion of an issued credential that was signed — `header.payload`.
 *
 * Taken **literally** from `proof.jwt`; never recomputed.
 */
export function signedPortion(
  credential: VerifiableCredential<unknown>,
): string | null {
  const jwt = credential.proof?.jwt;
  if (typeof jwt !== "string") return null;

  const segments = jwt.split(".");
  if (segments.length !== 3) return null;

  return `${segments[0]}.${segments[1]}`;
}

/** The decoded JWT parts of an issued credential, or `null` if malformed. */
export function decodeCredential(
  credential: VerifiableCredential<unknown>,
): { header: JwtHeader; payload: JwtPayload } | null {
  const jwt = credential.proof?.jwt;
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

function epochSeconds(timestamp: string): number | null {
  const millis = Date.parse(timestamp);
  return Number.isNaN(millis) ? null : Math.floor(millis / 1000);
}
