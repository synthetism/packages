# @synthetism/keys

**Zero-dependency cryptographic primitives** — generate, derive, convert and verify.
Stateless functions over key material: no class, no state, no signer.

```bash
npm install @synthetism/keys
```

## Quick start

```ts
import { generateKeyPair, derivePublicKey, hexToPem } from "@synthetism/keys";

// generate
const { privateKey, publicKey } = generateKeyPair("ed25519", { format: "hex" });

// the public key is derived, never stored
derivePublicKey(privateKey) === publicKey; // true

// a PEM, when something else needs one
const publicPem = hexToPem(publicKey, "ed25519");
```

## Verify a signature

```ts
import { verifyEd25519 } from "@synthetism/keys";

verifyEd25519("hello", signature, publicPem); // true | false
```

A **verifier only needs a public key** — no private key, no signer. That is why
verification lives here, on the frozen floor, and signing does not. Signing belongs to
`@synthetism/signer`.

## API

### Generation

| export | signature |
| --- | --- |
| `generateKeyPair` | `(type: KeyType, opts?: { format?: KeyFormat }) => KeyPair` |
| `derivePublicKey` | `(privateKey: string) => string \| null` |
| `getFingerprint` | `(publicKey: string) => string` — sha256 hex |
| `getShortId` | `(publicKey: string) => string` — first 16 hex chars |

`KeyType` is `"ed25519"`, `"rsa"`, `"x25519"`, `"secp256k1"` or `"wireguard"`.
`KeyFormat` is `"pem"`, `"hex"` or `"base64"`.

### Format conversion

| export | what |
| --- | --- |
| `hexToPem(hex, type)` | hex → PEM public key |
| `pemToHex(pem)` | PEM public key → hex |
| `hexPrivateKeyToPem(hex)` | hex seed → PEM private key |
| `pemPrivateKeyToHex(pem)` | PEM private key → hex |
| `base64ToHex` / `hexToBase64` | byte-encoding conversion |
| `base64ToBase64Url` / `base64UrlToBase64` | base64 ↔ base64url |
| `detectKeyFormat(key)` | `"pem"`, `"hex"`, `"base64"` or `null` |
| `toHex(key, type?)` | any format → hex |

Conversion helpers return `null` on invalid input. None of them throw.

### Verification

| export | what |
| --- | --- |
| `verifyEd25519(data, signature, publicKeyPem)` | Ed25519 |
| `verifyRSA(data, signature, publicKeyPem)` | RSA (SHA-256) |
| `verifySecp256k1(data, signature, publicKeyPem)` | secp256k1 (SHA-256) |
| `verifySignature(data, signature, pem, keyType)` | dispatch by key type |
| `isValidBase64` / `isValidBase64Url` | format checks |

Signatures are accepted as **base64 or base64url**. Verifiers return `false` instead of
throwing.

## Design notes

- **Stateless.** Nothing to instantiate, nothing to keep in sync.
- **Derivation over duplication.** `privateKey → publicKey`; store one, derive the other.
- **Zero dependencies.** Built on `node:crypto` alone.
- **No signer, no keys held.** This package never stores anything.

## Requirements

Node.js 18+.

## License

MIT
