# @synthetism/utils

**The parts that need a dependency.** The core packages in this stack are dependency-free on
purpose; this one is where the choices live.

Two things, and neither of them decides anything for you:

| | |
|---|---|
| `ajvEngine()` | a `SchemaEngine` backed by `ajv`. The one JSON Schema implementation in the stack |
| `resolve(…)` | per requirement key, the credentials you hold that satisfy it |

## `resolve` hands back candidates. It does not pick.

```ts
const { candidates, satisfied } = resolve({ document, credentials, holder, engine });
// candidates: [{ key: "authorization", type: "AuthorizationCredential", required: true, candidates: [...] }]
```

Which of three valid candidates to spend is a **policy** — latest expiry, narrowest scope,
the one you have not used — and there is no single right answer, so the library does not
hold one. You pick, then `validate` confirms the pick:

```ts
const picked = candidates.map((c) => choose(c.candidates));
validate({ document, credentials: picked, holder, engine });
```

`resolve` is built **on `validate`**, one key at a time. There is exactly one implementation
of what "satisfies" means, so the two cannot disagree about a document.

## `match` is a JSON Schema, not a vocabulary of ours

```jsonc
"match": {
  "type": "object",
  "properties": { "resource": { "const": "https://api.example.com/market" } },
  "required": ["resource"]
}
```

Applied to `credentialSubject`. We do not specify equality, containment or paths — the
engine does, and the engine is someone else's job done properly.
