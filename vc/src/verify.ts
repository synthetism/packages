/**
 * Verify — a credential in, a verdict out.
 *
 * Five things have to hold, and each failure is reported rather than swallowed:
 *
 * 1. **Shape.** The document is structurally a credential.
 * 2. **Algorithm.** The JWT header names an algorithm we accept — checked
 *    *before* any signature work, so an `alg: "none"` credential is rejected by
 *    policy rather than by luck.
 * 3. **Document matches payload.** The signed bytes cover only `header.payload`,
 *    so a credential whose outer fields were edited after signing would otherwise
 *    verify against the untouched payload inside it. We compare the two.
 * 4. **Claims.** `iss` agrees with the issuer, and the credential is inside its
 *    validity window.
 * 5. **Signature.** Verified over the *literal* `header.payload` — never a
 *    re-serialisation, which is why credentials from other implementations verify
 *    unchanged.
 */

import {
  PROOF_TYPE,
  canonicalize,
  decodeCredential,
  signedPortion,
  validateStructure,
  type JwtPayload,
  type VerifiableCredential,
} from "@synthetism/credential";
import { isDidKey, publicKeyFromDidKey } from "@synthetism/did";
import { hexToPem, verifyEd25519 } from "@synthetism/keys";

/** Checks a signature: `(signed bytes, signature, public key as PEM) => valid`. */
export type VerifySignature = (
  input: string,
  signature: string,
  publicKeyPem: string,
) => boolean;

/**
 * Resolves a DID to a PEM public key. Returning `undefined` means "cannot
 * resolve", which is a verification failure — never a skip.
 */
export type ResolveDid = (did: string) => string | undefined;

export interface VerifyOptions {
  /**
   * Signature check. Defaults to Ed25519 via `@synthetism/keys`.
   *
   * Inject this to support another algorithm without `vc` learning about it.
   */
  verify?: VerifySignature;
  /**
   * DID → public key. Defaults to `did:key` resolution (`resolveDidKey`).
   *
   * Inject this for a method that needs a document, a cache or a network.
   */
  resolve?: ResolveDid;
  /**
   * Algorithms accepted from the JWT header. Defaults to `["EdDSA"]`.
   *
   * A credential naming anything else is rejected before the signature is
   * checked — the `alg: "none"` bypass is a *policy* failure, not a crypto one.
   */
  algorithms?: readonly string[];
  /** The clock, for `nbf` / `exp`. Defaults to now. */
  now?: Date;
  /**
   * Require the outer document to equal the signed payload. Defaults to `true`.
   *
   * Turning this off accepts a credential whose visible fields are not the ones
   * that were signed. You almost never want that.
   */
  checkDocument?: boolean;
}

export interface VerifyResult {
  verified: boolean;
  /** Empty when `verified` is true. Everything that failed, not just the first. */
  errors: string[];
}

/** The algorithms `vc` will verify. Ed25519 only, so far. */
export const DEFAULT_ALGORITHMS: readonly string[] = ["EdDSA"];

/**
 * The default resolver: `did:key` → Ed25519 public key → PEM.
 *
 * `did:key` embeds the key, so this needs no registry and no network. `keys` and
 * `did` meet here and nowhere else.
 */
export function resolveDidKey(did: string): string | undefined {
  if (!isDidKey(did)) return undefined;

  try {
    const publicKeyHex = publicKeyFromDidKey(did);
    return hexToPem(publicKeyHex, "ed25519") ?? undefined;
  } catch {
    return undefined;
  }
}

/** Check a credential. Never throws — a bad credential is a result, not an error. */
export function verify<S = unknown>(
  credential: VerifiableCredential<S>,
  opts: VerifyOptions = {},
): VerifyResult {
  const errors: string[] = [];

  const algorithms = opts.algorithms ?? DEFAULT_ALGORITHMS;
  const checkDocument = opts.checkDocument ?? true;
  const verifySignature = opts.verify ?? verifyEd25519;
  const resolve = opts.resolve ?? resolveDidKey;
  const now = (opts.now ?? new Date()).getTime() / 1000;

  if (!isObject(credential)) {
    return { verified: false, errors: ["not a credential"] };
  }

  const structure = validateStructure(credential);
  if (!structure.valid) {
    errors.push(...structure.errors.map((error) => `structure: ${error}`));
  }

  const proof = credential.proof;
  if (proof === undefined) {
    return { verified: false, errors: [...errors, "no proof"] };
  }
  if (proof.type !== PROOF_TYPE) {
    errors.push(
      `proof.type must be ${PROOF_TYPE}, got ${JSON.stringify(proof.type)}`,
    );
  }

  // The literal bytes that were signed.
  const input = signedPortion(credential);
  const segments = typeof proof.jwt === "string" ? proof.jwt.split(".") : [];
  if (input === null || segments.length !== 3) {
    return {
      verified: false,
      errors: [...errors, "proof.jwt is not a three-part JWT"],
    };
  }

  const signature = segments[2] as string;
  if (signature === "") {
    errors.push("proof.jwt carries an empty signature");
  }

  const decoded = decodeCredential(credential);
  if (decoded === null) {
    return { verified: false, errors: [...errors, "proof.jwt does not decode"] };
  }
  const { header, payload: claims } = decoded;

  // Policy first: an unaccepted algorithm is rejected before the verifier is
  // asked, so `alg: "none"` can never be waved through by a lenient verifier.
  const algorithmAccepted = algorithms.includes(header.alg);
  if (!algorithmAccepted) {
    errors.push(
      `alg ${JSON.stringify(header.alg)} is not accepted (expected ${algorithms.join(" or ")})`,
    );
  }
  if (isForeignTyp(header.typ)) {
    errors.push(`typ ${JSON.stringify(header.typ)} does not look like a JWT`);
  }

  if (typeof claims.iss === "string" && claims.iss !== credential.issuer.id) {
    errors.push(
      `payload.iss (${claims.iss}) does not match issuer.id (${credential.issuer.id})`,
    );
  }

  if (checkDocument && canonicalize(withoutProof(credential)) !== canonicalize(claims.vc)) {
    errors.push("the document does not match the signed payload (edited after signing)");
  }

  errors.push(...clockErrors(claims, now));

  const method = verificationMethod(credential, proof.verificationMethod);
  const publicKeyPem = resolve(method);

  if (publicKeyPem === undefined) {
    errors.push(`cannot resolve ${method} to a public key`);
    return { verified: false, errors };
  }

  if (algorithmAccepted && !verifySignature(input, signature, publicKeyPem)) {
    errors.push("signature does not verify");
  }

  return { verified: errors.length === 0, errors };
}

/** The document as it was signed: everything except the proof. */
function withoutProof<S>(credential: VerifiableCredential<S>): Record<string, unknown> {
  const document: Record<string, unknown> = { ...credential };
  // The proof must be absent, not present-but-undefined: this document is compared
  // field-for-field against the bytes that were signed.
  // biome-ignore lint/performance/noDelete: absence is the point.
  delete document.proof;
  return document;
}

/** Defensive: `verify` is callable from JavaScript, where the types are a rumour. */
function isObject(value: unknown): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function verificationMethod(
  credential: VerifiableCredential<unknown>,
  method: unknown,
): string {
  return typeof method === "string" && method !== "" ? method : credential.issuer.id;
}

function clockErrors(claims: JwtPayload, now: number): string[] {
  const errors: string[] = [];

  if (typeof claims.nbf === "number" && now < claims.nbf) {
    errors.push(`not valid before ${new Date(claims.nbf * 1000).toISOString()}`);
  }
  if (typeof claims.exp === "number" && now > claims.exp) {
    errors.push(`expired at ${new Date(claims.exp * 1000).toISOString()}`);
  }

  return errors;
}

/** `typ` is advisory; only reject a value that clearly is not a JWT. */
function isForeignTyp(typ: unknown): boolean {
  return typ !== undefined && typ !== "JWT" && typ !== "vc+jwt";
}
