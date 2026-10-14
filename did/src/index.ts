/**
 * @synthetism/did — `did:key`, both directions.
 *
 * Zero dependencies: no registry, no network, no crypto. Pure encoding.
 */

export { base58btcDecode, base58btcEncode } from "./base58.js";
export {
  DidKeyError,
  didKeyFromPublicKey,
  isDidKey,
  publicKeyFromDidKey,
  type DidKey,
} from "./did-key.js";
