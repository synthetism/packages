# @synthetism/did

**`did:key`, both directions.** Self-certifying identifiers, derived from a public key.
Zero dependencies — no registry, no network, no crypto.

```bash
npm install @synthetism/did
```

## Why

A `did:key` **is** the public key, encoded:

```
did:key:z  +  base58btc( 0xed01 ‖ publicKey )
```

Nothing is looked up, so there is nothing to trust. Verify the DID and you have verified
the key.

## Quick start

```ts
import { didKeyFromPublicKey, publicKeyFromDidKey } from "@synthetism/did";

const publicKeyHex = "b078fed776413d8be5918ef229480acb51586fed28b8eeec4066077f84547784";

const did = didKeyFromPublicKey(publicKeyHex);
// "did:key:z6MkrL8otjELxqEcmQZHM11UE1n9czAYSWNLQKRfXQH1ypnw"

publicKeyFromDidKey(did) === publicKeyHex; // true
```

The public key is derived from the private key, and the DID from the public key — so one
secret produces a whole identity:

```
privateKey  →  publicKey   (@synthetism/keys)
            →  did:key     (@synthetism/did)
```

## API

| export | signature | notes |
| --- | --- | --- |
| `didKeyFromPublicKey` | `(publicKeyHex: string) => string` | 32-byte Ed25519 key |
| `publicKeyFromDidKey` | `(did: string) => string` | returns hex |
| `isDidKey` | `(value: unknown) => value is string` | never throws |
| `DidKeyError` | `Error` subclass | thrown for malformed input |
| `base58btcEncode` / `base58btcDecode` | `(bytes) / (string)` | the encoding under `z` |

## Design notes

- **Self-certifying.** The DID *is* the key — no resolution, no registry.
- **Strict.** Parsing throws `DidKeyError` on malformed input; use `isDidKey` when you
  want a boolean instead.
- **Zero dependencies.** Pure encoding. No crypto, no network.

## Supported

Ed25519 only, for now. The multicodec prefix is checked, so a `did:key` for another curve
is **rejected** rather than silently misread as an Ed25519 key.

The functions also accept a **DID URL**, not just a bare DID: `did:key:z6Mk…#key-1`
resolves to the same key as `did:key:z6Mk…`, because a fragment names a *key* rather than a
different DID.

## Requirements

Node.js 18+.

## License

MIT
