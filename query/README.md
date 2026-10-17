# @synthetism/query

**What a service requires, as data — and the shape that data is written in.**

The other half of the exchange from `@synthetism/vp`. A presentation is a W3C standard with
a shape that is not ours to change; a requirement is a document a service publishes about
*itself*, and it will keep changing. They were designed together and they live apart,
because a package's version is a promise about everything inside it: a change to the
language must not read as a change to the presentation protocol.

**No third-party dependencies, and one sibling.** It imports `@synthetism/schema-engine` —
a port with types and no code — and nothing else. The language is readable without our
envelope, our crypto or our signing path; the one thing it borrows is a shape it cannot own,
and that shape is a type.

## Two versions, two jobs

| export | value | what it means |
|---|---|---|
| `LANGUAGE_ADDRESS` | `https://synthetism.org/schemas/query/v1` | which **language** the document is written in. Frozen per major |
| `LANGUAGE_CREDENTIAL_SCHEMA` | `{ id: LANGUAGE_ADDRESS, type: "JsonSchemaValidator2018" }` | the same thing, whole, as `credentialSchema`. Pass this object — not two strings you could get wrong |
| `credentialSubject.requirement.version` | e.g. `"3"` | the **service's** revision of its own requirement. Changes whenever it changes its mind |

Conflating the first two with the third is the bug this package exists to prevent: a
service bumping its requirement from 2 to 3 was claiming it now conformed to a *different
schema*.

## Frozen forever

**The artifact is the language.** `schemas/query/v1.json` is the file a stranger fetches and
the source of truth this package runs against; `src/languages/v1.generated.ts` is derived
from it by `scripts/generate-language.ts`, and `test/version.test.ts` regenerates it and
diffs. Edit the JSON, not the literal — `prebuild` regenerates it anyway.

The direction is deliberate. Generating a schema *from* the TypeScript was measured and
rejected (`SCHEMAS.md` §2): the generator emits draft-07, closes every object by default,
and cannot express `minLength`/`minProperties` without annotations in comments. A schema
that is too permissive admits junk silently; a literal that is out of date fails a test.

`LANGUAGE_ADDRESS` sits inside every requirement ever signed, so it cannot be renamed. A
change a `v1` reader cannot survive becomes `/v2` — v1 keeps resolving. Additive change
lives inside v1: unknown fields are ignored, and the published schema leaves the object
open.

`LANGUAGES` is add-only, and `@synthetism/query@N` ships a validator for every language
`1..N`. Dropping one is a broken promise with a date on it.

## Authoring: a subject, not a credential

```ts
import { createRequirement, LANGUAGE_CREDENTIAL_SCHEMA } from "@synthetism/query";
import { createUnsigned } from "@synthetism/credential";

const subject = createRequirement({
  name: "market-read",
  version: "3",                        // your revision — nothing to do with the language
  requirements: {
    authorization: {
      type: "AuthorizationCredential",
      required: true,
      match: {                         // a JSON Schema, applied to credentialSubject
        type: "object",
        properties: { resource: { const: "https://api.example.com/market" } },
        required: ["resource"],
      },
    },
  },
  issuer: { id: serviceDid },          // the holder, and the credential's issuer
});

const unsigned = createUnsigned({
  subject,
  type: "RequirementCredential",
  issuer: { id: serviceDid },
  credentialSchema: LANGUAGE_CREDENTIAL_SCHEMA,
});
```

`createRequirement` returns a **`RequirementSubject`** — `{ holder, requirement }` — and
stops there. The envelope is `@synthetism/credential`'s job and composition is the app's.
The trade is honest: the address is a constant you pass, so it *can* be forgotten. It will
not pass silently — `validate` reports `unsupported-language` and names the missing
`credentialSchema.id`.

## Judging: `validate`

```ts
validate({ document, credentials, holder, engine })  →  Verdict
```

Pure: no I/O, no network, no clock. A **predicate** — it does not select, rank, spend or
verify a proof.

**Two consumers, one function.** The service calls it to check a presentation against the
requirement it published, so what it published and what it enforces cannot drift — same
code, same document. The customer calls it *before* presenting, to check a credential it
picked will be accepted.

Three checks, subject-blind: the credential is of the required `type`; its subject is the
holder presenting it; and `match` holds. `resource` is not a parameter — it is a `match`
condition that authorisation requirements happen to use. The library knows the mechanism;
the vocabulary belongs to whoever writes the requirement.

The engine is injected. `@synthetism/engine-ajv` provides one over `ajv`; `@synthetism/resolve`
composes `validate` with it.

## Two audiences, two doors

A **service** ships this package, knows which language version it speaks, and writes its
requirement with `createRequirement`. A **consumer** has a document off the wire and an
address inside it, and asks *the registry* — never the authoring types — whether it is the
language it claims to be. Producers are version-locked by design; consumers must be
version-agnostic.

## The rule the language is guarded by

If a capability cannot be expressed here, it is not a requirement — it is a custom
integration. That test is why the shape is worth guarding.
