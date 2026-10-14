# @synthetism/vc

**The operations.** An unsigned credential plus a signer goes in; a signed
credential comes out. A signed credential goes in; a verdict comes out.

`vc` owns the **port** — `ISigner`, one method — and depends on **no** signer
implementation. That is the whole architecture in one sentence: the package that
needs a signature states what it needs, and learns nothing else.

```bash
npm install @synthetism/vc
```

## Why

`@synthetism/credential` owns the *format*: unsigned documents, and the exact bytes
to sign. It never signs. `@synthetism/vc` owns the *operations*: ask a signer for a
signature and attach it; check a signature without recomputing anything.

Neither package knows what a key is. `keys` owns crypto, `did` owns `did:key`,
`credential` owns the document, and `vc` owns the seam between a document and a
signature — which is one method wide.

## The port

```ts
export interface ISigner {
  sign(data: string): Promise<string>;
}
```

A key in memory, a daemon, an HSM, a phone: anything that turns the exact bytes
into a signature conforms **structurally**. Nothing is required to import this
interface, or to implement it.

Which is easy to prove — a fake signer exercises `issue` completely:

```ts
import { createUnsigned, issue, signingInput } from "@synthetism/vc";

const did = "did:key:z6MkrL8otjELxqEcmQZHM11UE1n9czAYSWNLQKRfXQH1ypnw";

const unsigned = createUnsigned({
  subject: { holder: { id: did }, scope: ["read"] },
  type: "ServiceAuthorization",
  issuer: { id: did },
  id: "urn:credential:demo:1",
  validity: { from: "2026-01-01T00:00:00.000Z" },
});

const { credential } = await issue(unsigned, { sign: async () => "x" });

console.log(credential.proof?.jwt === `${signingInput(unsigned)}.x`); // true
```

## Issue

```ts
const { credential, signingInput } = await issue(unsigned, signer);
```

`signingInput` is returned as well as used: it is the exact input the signer was
given, so it is the provenance of the proof.

`issue` throws rather than producing something unverifiable — a malformed document,
an unsupported format, a signer with no `sign`, a signer that returns nothing. It
needs no key, no DID and no network: only the bytes, and something that signs.

## Verify

```ts
const { verified, errors } = verify(credential);
```

`verify` never throws — a bad credential is a result, not an exception — and it
reports **every** problem it finds, not just the first.

Five things must hold:

| check | why |
| --- | --- |
| the document is shaped like a credential | `validateStructure` |
| `header.alg` is accepted — default `["EdDSA"]` | checked **before** the signature, so `alg: "none"` is a policy failure rather than a lucky one |
| the document equals the signed payload | the signature covers only `header.payload`; without this, fields edited after signing would still verify |
| `iss` agrees with the issuer, and the clock is inside `nbf`/`exp` | |
| the signature verifies over the **literal** `header.payload` | never a re-serialisation, so credentials from other implementations verify unchanged |

### Resolution

`did:key` embeds the public key, so verification needs no registry and no network:

```ts
import { resolveDidKey } from "@synthetism/vc";

resolveDidKey("did:key:z6MkrL8otjELxqEcmQZHM11UE1n9czAYSWNLQKRfXQH1ypnw");
// '-----BEGIN PUBLIC KEY-----\n…'
resolveDidKey("did:web:example.com"); // undefined
```

For anything else, inject a resolver — and a verifier, if your algorithm is not
Ed25519:

```ts
verify(credential, {
  algorithms: ["EdDSA"],
  resolve: (did) => myRegistry.lookup(did),
  verify: (input, signature, publicKeyPem) => myAlgorithm(input, signature, publicKeyPem),
});
```

A resolver that returns `undefined` is a **failure**, never a skip.

## API

| export | what |
| --- | --- |
| `ISigner` | the port — `sign(data): Promise<string>` |
| `issue(unsigned, signer, opts?)` | `{ credential, signingInput }` |
| `verify(credential, opts?)` | `{ verified, errors }` |
| `resolveDidKey(did)` | `did:key` → PEM, or `undefined` |
| `DEFAULT_ALGORITHMS` | `["EdDSA"]` |
| `VerifyOptions` | `verify` · `resolve` · `algorithms` · `now` · `checkDocument` |

The format is re-exported so a caller can build and check a credential with a
single import: `createUnsigned`, `createUnsignedPresentation`, `credentialId`,
`presentationId`, `signingInput`, `payload`, `attachProof`, `signedPortion`,
`decodeCredential`, `canonicalize`, `validateStructure`, `PROOF_TYPE`,
`DEFAULT_ALG`, `DEFAULT_CONTEXT`.

Explicitly, never `export *` — silently adopting whatever `credential` grows next is
how a leaf becomes a framework.

## Not here

- **`present` / `verifyPresentation`** — a separate package, once a presenter exists.
- **JSON-LD / Data Integrity proofs** (`Ed25519Signature2020`) — they need
  canonicalisation machinery this package deliberately does not carry.
- **Keys.** Signing is `@synthetism/signer`; verification is `@synthetism/keys`.

## Requirements

Node.js 18+. Depends on `@synthetism/credential`, `@synthetism/keys` and
`@synthetism/did` — nothing else.

## License

MIT
