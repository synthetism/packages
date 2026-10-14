/**
 * `did:key` — self-certifying identifiers.
 *
 * The DID *is* the public key, encoded:
 *
 *   did:key:z  +  base58btc( multicodec ‖ publicKey )
 *
 * No registry, no issuer, no network. Nothing is looked up, so there is nothing
 * to trust. Ed25519 only, for now — the multicodec prefix is checked, so a
 * `did:key` for another curve is rejected rather than misread.
 */

import { base58btcDecode, base58btcEncode } from "./base58.js";

/** Multicodec for an Ed25519 public key: varint 0xed → bytes `ed 01`. */
const ED25519_PUB = Uint8Array.from([0xed, 0x01]);

const DID_KEY_PREFIX = "did:key:";
const MULTIBASE_BASE58 = "z";

/** A `did:key` string. */
export type DidKey = string;

/** Thrown when input is malformed rather than merely wrong. */
export class DidKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DidKeyError";
  }
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new DidKeyError(
      `expected an even-length hex string, got ${JSON.stringify(hex)}`,
    );
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Reduce a DID URL to its base DID: `did:key:z…#key-1` → `did:key:z…`.
 *
 * Credentials routinely reference a key as `did:key:z…` **plus a fragment**, and a
 * DID URL may also carry a path or query. None of that changes *which key* the DID
 * denotes, so we strip it before decoding.
 */
function baseDid(did: string): string {
  const suffix = did.search(/[/?#]/);
  return suffix === -1 ? did : did.slice(0, suffix);
}

/** Split `did:key:z…` into its base58 payload. */
function stripDidKey(did: string): string {
  if (typeof did !== "string" || !did.startsWith(DID_KEY_PREFIX)) {
    throw new DidKeyError(`not a did:key: ${JSON.stringify(did)}`);
  }
  const multibase = baseDid(did).slice(DID_KEY_PREFIX.length);
  if (!multibase.startsWith(MULTIBASE_BASE58)) {
    throw new DidKeyError(
      `unsupported multibase prefix in ${JSON.stringify(did)} (expected "z")`,
    );
  }
  return multibase.slice(MULTIBASE_BASE58.length);
}

/**
 * Derive a `did:key` from an Ed25519 public key.
 *
 * @param publicKeyHex 32-byte public key, hex
 * @throws {DidKeyError} if the key is not valid hex or not 32 bytes
 */
export function didKeyFromPublicKey(publicKeyHex: string): DidKey {
  const key = hexToBytes(publicKeyHex);
  if (key.length !== 32) {
    throw new DidKeyError(
      `expected a 32-byte Ed25519 public key, got ${key.length} bytes`,
    );
  }

  const multicodec = new Uint8Array(ED25519_PUB.length + key.length);
  multicodec.set(ED25519_PUB, 0);
  multicodec.set(key, ED25519_PUB.length);

  return `${DID_KEY_PREFIX}${MULTIBASE_BASE58}${base58btcEncode(multicodec)}`;
}

/**
 * Recover the Ed25519 public key from a `did:key`.
 *
 * Accepts a DID URL as well as a bare DID — `did:key:z…`#key-1` resolves to the same
 * key, since the fragment names a key rather than a different DID.
 *
 * @returns the public key in hex
 * @throws {DidKeyError} if the DID is malformed or not Ed25519
 */
export function publicKeyFromDidKey(did: string): string {
  const bytes = base58btcDecode(stripDidKey(did));

  if (bytes.length !== ED25519_PUB.length + 32) {
    throw new DidKeyError(
      `expected ${ED25519_PUB.length + 32} multicodec bytes, got ${bytes.length}`,
    );
  }
  if (bytes[0] !== ED25519_PUB[0] || bytes[1] !== ED25519_PUB[1]) {
    throw new DidKeyError(
      "not an Ed25519 did:key (unexpected multicodec prefix)",
    );
  }

  return bytesToHex(bytes.subarray(ED25519_PUB.length));
}

/** True if `value` is a well-formed Ed25519 `did:key`. Never throws. */
export function isDidKey(value: unknown): value is DidKey {
  if (typeof value !== "string") return false;
  try {
    publicKeyFromDidKey(value);
    return true;
  } catch {
    return false;
  }
}
