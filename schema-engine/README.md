# @synthetism/schema-engine

**The port. Types only — no code, no dependencies, no domain.**

Compiling a schema and running the result against data is a seam every layer of this stack
wants and none of them should carry. It is not about requirements, and it is not about JSON
Schema either: `compile(schema) → predicate` is the most general shape the job has.

```ts
import type { Compiled, SchemaEngine } from "@synthetism/schema-engine";
```

Two implementations exist and both are outside this package:

| | |
|---|---|
| `@synthetism/engine-ajv` | the real one, over `ajv` |
| a stub in a test | three lines, and the only way to make a test honest |

## `compile` may refuse

```ts
type Compiled =
  | { ok: true;  run: (data: unknown) => true | string[] }   // it compiled
  | { ok: false; error: string };                            // it could not
```

*"This data does not conform"* and *"this schema is unusable"* are different facts about
different parties. A compiler that throws cannot tell them apart, and a compiler that shrugs
turns the second into the first — which is how a requirement whose `match` was a typo came to
accept every credential offered.

`compile` never throws. An unusable schema is data about the schema, and every caller of this
port has somewhere to put it.

`ok` is a **tag**, not a convenience. Narrowing on the presence of a field
(`"error" in compiled`) picks the wrong branch the day a third state arrives carrying
neither. A literal tag makes a `switch` exhaustive and `never` proves it.

There is deliberately **no error code**. A code earns its keep only if a caller must *react*
rather than *report* — and `code?: string` is a non-breaking addition later, while the tag is
not. So we pay for the one that is expensive to add late, and not for the one that is free.

## The one rule

**This package is types, forever.**

If it ever exports a function with a body — a default engine, an `isOk()` helper, a
"convenience" wrapper — it has stopped being a seam and become a hub, and a hub is what this
library exists not to be. Every package above it can then depend on it without inheriting a
decision, which is the whole reason it exists.
