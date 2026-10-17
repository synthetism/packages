# @synthetism/engine-ajv

**The one JSON Schema implementation in the stack.**

`@synthetism/schema-engine` owns the port; everything in the core takes an engine as a
parameter. This is the engine — so the choice of `ajv` is made once, in an adapter, and no
domain package inherits it. It depends on the port and on `ajv`, and on nothing else: you can
adopt it without having heard of a requirement.

```ts
import { ajvEngine } from "@synthetism/engine-ajv";
import { validate } from "@synthetism/query";

const verdict = validate({ document, credentials, holder, engine: ajvEngine() });
```

## Two decisions live here, and nowhere else

**Unknown keywords are fatal.** A `match` is authored by a service, so a typo in it is a typo
in a contract. Under a lenient engine this one was silent:

```jsonc
"match": { "scope": ["read"], "resource": "https://api.example.com/market" }
```

`scope` is an array where a schema belongs, so it is an *unknown keyword*: it compiled, it was
ignored, and the requirement accepted `{}`, `null`, a string, anything. A requirement that
accepts everything demands nothing. `strictSchema` turns that into a compile error.

Deliberately **not** `strict`. That also switches on `strictTypes`, which rejects *valid* JSON
Schema for omitting a type annotation — `{ "properties": { "resource": { "const": "…" } } }`
with no `"type": "object"` means exactly what it says. Requiring the annotation would be us
inventing a restriction the language never stated, and reporting a correct requirement as
malformed. We reject what is *not a schema*; we do not insist on a house style.

**Compilation never throws.** *"This subject does not conform"* and *"this schema is unusable"*
are different facts, and `compile` returns the second rather than raising:

```ts
const compiled = ajvEngine().compile(match);
if (!compiled.ok) { /* the requirement is broken, not the credential */ }
```

ajv raises on a bad `$ref` or an unknown `type` even leniently, so `validate` reports
`malformed-requirement` — against the requirement — instead of `not-a-match`, which would
blame the caller for the service's mistake.

## What it deliberately does not do

Formats (`email`, `uri`, …) are assertions about the world; a requirement's `match` is about a
credential's subject. They are off, so a requirement's meaning never depends on a format
registry that was not versioned alongside it.

`@synthetism/query`'s own language schema compiles under these rules — a test asserts it — so
strictness costs nothing we authored. That test is the only reason this package has `query` as
a devDependency; it ships with two dependencies and neither is a language.
