# @synthetism/signer

**The default implementation of the port.** A private key in, a signature out — the
in-process signer the CLI, tests and CI use.

```bash
npm install @synthetism/signer
```

## Why

`@synthetism/vc` owns the port `ISigner`, and depends on no signer. This package is an
implementation of it: small, concrete, and deliberately **not the ruler**.

```ts
import { Signer } from "@synthetism/signer";

// RFC 8032 §7.1 TEST 1's secret key — see "Checkable" below.
const signer = Signer.from(
  "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60",
);

const signature = await signer.sign("the exact bytes");

console.log(signature);
// 'nekphaVoMmxM_Gcn7cpXI7uRefmZt78kZUp7ceKIG61SFTr2qaiQgVwVRp_bURLuUZEcX_1H3-TNL8XqfrsODA'
```

### Checkable

That key is not made up. It is **RFC 8032 §7.1 TEST 1**'s secret key, so the public key
is published by the standard:

```ts
console.log(signer.getPublicKeyHex());
// 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a'
```

Agreeing with that is worth more than agreeing with ourselves — it means we agree with
Ed25519.

It depends on `@synthetism/keys`, and on `@synthetism/vc` for its **build** only. The class
does not say `implements ISigner`: that would put `@synthetism/vc` into the published
`.d.ts` and turn the port into a *type dependency for every consumer*. Conformance is
proven internally instead — if `sign` ever drifts from the seam, **our** build breaks, not
a consumer's — and `npm run check:dts` verifies the declarations stayed clean.

## Keys

`Signer.from` takes either form:

- a **hex seed**, the 32 bytes `keys.generateKeyPair('ed25519', { format: 'hex' })` produces;
- a **PKCS#8 PEM**.

The form is detected, or stated with `{ format: "hex" | "pem" }`. Anything that is not an
Ed25519 private key is refused rather than half-accepted.

## With a credential

```ts
import { didKeyFromPublicKey } from "@synthetism/did";
import { generateKeyPair } from "@synthetism/keys";
import { createUnsigned, issue, verify } from "@synthetism/vc";
import { Signer } from "@synthetism/signer";

const privateKeyHex = generateKeyPair("ed25519", { format: "hex" }).privateKey;
const signer = Signer.from(privateKeyHex);
const did = didKeyFromPublicKey(signer.getPublicKeyHex());

const unsigned = createUnsigned({
  subject: { holder: { id: did } },
  type: "IdentityCredential",
  issuer: { id: did },
  id: "urn:credential:readme:1",
  validity: { from: "2026-01-01T00:00:00.000Z" },
});

const { credential } = await issue(unsigned, signer);

console.log(verify(credential).verified); // true
```

`getPublicKeyHex()` is deliberately the same encoding `keys.derivePublicKey` returns and
`did.didKeyFromPublicKey` accepts, so a signer goes straight to a `did:key` with nothing in
between.

## API

| export | what |
| --- | --- |
| `Signer.from(privateKey, opts?)` | a hex seed or a PKCS#8 PEM |
| `sign(data)` | the signature, base64url |
| `getPublicKeyHex()` | the public key, hex |

## Not here

- **Not a Unit**, not a wallet, not a store. It holds one key and signs with it.
- **No key management.** Loading, permissions and custody belong to the boundary and the
  vault, not to this package.
- **No verification.** Checking a signature needs only a public key — that is
  `@synthetism/keys`.

## Requirements

Node.js 18+. Depends on `@synthetism/keys` — nothing else at runtime.

## License

MIT
