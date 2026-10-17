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

- **here:** the language — `VPLanguageSchema`, `RequirementSpec`, `MatchConditions`,
  `RequirementSubject` — and its version.
- **not here yet:** the resolver. Reading a requirement, taking the matching credentials
  out of a store, and packing a presentation is the *point* of the language, but it needs
  a defined cardinality, a defined choice rule and a holder postcondition first. Those are
  design decisions, not omissions.

## The rule the language is guarded by

If a capability cannot be expressed here, it is not a requirement — it is a custom
integration. That test is why the shape is worth guarding.
