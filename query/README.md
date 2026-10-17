# @synthetism/query

**What a service requires, as data — and the version its address is frozen at.**

The other half of the exchange from `@synthetism/vp`. A presentation is a W3C standard
with a shape that is not ours to change; a requirement is a document a service publishes
about *itself*, and it will keep changing. They were designed together and they live
apart, because a package's version is a promise about everything inside it: a change to
the language must not read as a change to the presentation protocol.

## Two versions, two jobs

| | | |
|---|---|---|
| `LANGUAGE_SCHEMA` | `https://synthetism.org/schemas/query/v1` | which **language** the document is written in. Carried in `credentialSchema.id`, frozen per major |
| `requirement.version` | e.g. `"3"` | the **service's** revision of its own requirement. Changes whenever it changes its mind |

Conflating them is the bug this package exists to prevent: a service bumping its
requirement from 2 to 3 was claiming it now conformed to a *different schema*.

## Frozen forever

`LANGUAGE_SCHEMA` sits inside every requirement ever signed, so it cannot be renamed. A
change a `v1` reader cannot survive becomes `/v2` — v1 keeps resolving. Additive change
lives inside v1: unknown fields are ignored, and the published schema leaves the object
open.

`LANGUAGE_VERSION` is a literal, not a runtime read of `package.json` — the address has to
be a published fact a stranger can implement against. A test asserts it equals the
package's major, so a drift fails in CI rather than in a caller's refused request.

## What is here, and what is not

- **here:** the language **as a schema** (`schemas/query/v1.json`), the addresses it is
  published at, the authoring types for a service that ships this package, and `validate` —
  the predicate that answers *does this set of credentials satisfy that requirement?*
- **not here:** the resolver, the schema engine, and anything that picks. Selection is the
  client's policy and lives in `@synthetism/utils`; the engine is injected, so this package
  stays dependency-free.

## Two audiences, two doors

A **service** ships this package, knows which language version it speaks, and writes its
requirement with the authoring types. A **consumer** has a document off the wire and an
address inside it, and asks *the schema* — never the types — whether it is the language it
claims to be. Producers are version-locked by design; consumers must be version-agnostic.

## The rule the language is guarded by

If a capability cannot be expressed here, it is not a requirement — it is a custom
integration. That test is why the shape is worth guarding.
