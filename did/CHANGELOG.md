# Changelog

All notable changes to this package are documented here.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0

First release.

- `didKeyFromPublicKey(publicKeyHex)` — derive an Ed25519 `did:key`
- `publicKeyFromDidKey(did)` — recover the public key as hex
- `isDidKey(value)` — non-throwing predicate
- `DidKeyError` — thrown for malformed input
- `base58btcEncode` / `base58btcDecode`
