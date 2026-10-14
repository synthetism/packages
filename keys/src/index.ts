/**
 * @synthetism/keys — cryptographic primitives.
 *
 * Stateless. Pure functions over key material. No signer, no Unit, no framework.
 * This is the frozen floor (`docs/PRINCIPLES.md` §6): everything points down to it.
 */

// generation + derivation
export {
  generateKeyPair,
  derivePublicKey,
  getShortId,
  getFingerprint,
} from "./keys.js";
export type { KeyPair, KeyType, KeyFormat } from "./keys.js";

// format conversion (hex ↔ pem ↔ base64)
export {
  pemToHex,
  pemPrivateKeyToHex,
  hexToPem,
  hexPrivateKeyToPem,
  base64ToHex,
  hexToBase64,
  detectKeyFormat,
  toHex,
} from "./keys.js";

// base64url — the JWT encoding
export { base64ToBase64Url, base64UrlToBase64 } from "./utils.js";

// verification
export {
  isValidBase64,
  isValidBase64Url,
  verifyEd25519,
  verifyRSA,
  verifySecp256k1,
  verifySignature,
} from "./verify.js";
