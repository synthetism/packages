# @synthetism/credential

**The credential format.** W3C envelopes, Synthetism subject shapes, and the exact bytes
to sign. No crypto, no signer — zero dependencies.

```bash
npm install @synthetism/credential
```

## Why

A credential is a *document*; signing it is an *operation*. Fusing the two is how
frameworks are born — you can no longer adopt the format without adopting the signer.

So this package owns the format only. It builds unsigned credentials, and it computes the
**exact bytes a signer must sign**. How you produce that signature — a key in memory, a
daemon, an HSM — is not its business.

```ts
import { attachProof, createUnsigned, signingInput } from "@synthetism/credential";

const unsigned = createUnsigned({
  subject: { holder: { id: did }, issuedBy: { id: did } },
  type: "IdentityCredential",
  issuer: { id: did },
});

const input = signingInput(unsigned);        // the bytes to sign — pure encoding
const signature = await signer.sign(input);  // your signer, your rules
const vc = attachProof(unsigned, signature);
```

`@synthetism/vc` does exactly this, so you would normally call `vc.issue()`. This package
is here for when you would rather not.

## API

### Build (unsigned)

| export | what |
| --- | --- |
| `createUnsigned(args)` | a credential with no `proof` |
| `createUnsignedPresentation(args)` | a presentation with no `proof` |
| `credentialId(type, id?)` | `urn:credential:…` — pass an `id` for reproducibility |
| `presentationId(id?)` | `urn:presentation:…` |

### Sign input (pure)

| export | what |
| --- | --- |
| `signingInput(unsigned, opts?)` | `base64url(header) + "." + base64url(payload)` |
| `payload(unsigned)` | the JWT payload: `vc`, `iss`, `jti`, `nbf`, `exp` |
| `attachProof(unsigned, signature, opts?)` | a JWT-proofed credential |
| `signedPortion(vc)` | the literal `header.payload` that was signed |
| `decodeCredential(vc)` | the decoded header and payload |
| `canonicalize(value)` | sorted-key JSON |

### Schemas and validation

| export | what |
| --- | --- |
| `SCHEMA_BASE` | `https://synthetism.org/schemas` |
| `schemaUri(type, version)` | e.g. `…/IpAsset/1.0.0` |
| `validateStructure(doc)` | `{ valid, errors }` — shape only, never a signature |

### Subjects

`IdentitySubject` · `AgentIdentitySubject` · `ServiceIdentitySubject` ·
`AuthorizationSubject` · `AssetSubject` · `DataAssetSubject` ·
`NonFungibleAssetSubject` · `IpAssetSubject` · `ContractSubject` · `ReceiptSubject` ·
`PolicySubject` · `DeclarationSubject`

## Two design notes

**Issuing canonicalises; verifying never does.** `signingInput` sorts object keys
recursively, so the same logical credential always yields the same bytes. Verification, by
contrast, reuses the *literal* `header.payload` from `proof.jwt` — it never re-serialises.
That is why a credential issued by another implementation still verifies: we never ask it
to match our canonical form.

**Verification is not here.** `validateStructure` checks shape. Whether a signature is
*valid* is `@synthetism/vc`'s job.

## Requirements

Node.js 18+ · zero dependencies.

## License

MIT
