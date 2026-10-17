# @synthetism/resolve

**Which of a holder's credentials could satisfy each part of a requirement?** One function,
and it does not pick.

```ts
import { resolve } from "@synthetism/resolve";
import { ajvEngine } from "@synthetism/engine-ajv";

const { candidates, satisfied, failures } = resolve({
  document,
  credentials,
  holder,
  engine: ajvEngine(),
});

// candidates: [{ key: "authorization", type: "AuthorizationCredential", required: true, candidates: [...] }]
```

## It hands back candidates. It does not choose.

Which of three valid candidates to spend is a **policy** — latest expiry, narrowest scope, the
one you have not used — and there is no single right answer, so the library does not hold one.
You choose, then `validate` confirms:

```ts
const picked = candidates.map((c) => choose(c.candidates));
validate({ document, credentials: picked, holder, engine: ajvEngine() });
```

`resolve` is built **on `validate`**, one key at a time. There is exactly one implementation of
what "satisfies" means, so the two cannot disagree about a document.

## No third-party dependencies

The engine is a **parameter**, not an import. `@synthetism/resolve` depends on
`@synthetism/query` and nothing else, so a JSON Schema implementation is a choice the app
makes — in one line, where it is visible:

```ts
const engine = ajvEngine();   // @synthetism/engine-ajv — ajv, unknown keywords fatal
```

That is the same seam `validate` uses, and the same rule the rest of the stack follows: the
domain stays dependency-free, and every dependency lives where somebody chose it.

## `match` is a JSON Schema, not a vocabulary of ours

```jsonc
"match": {
  "type": "object",
  "properties": { "resource": { "const": "https://api.example.com/market" } },
  "required": ["resource"]
}
```

Applied to `credentialSubject`. We do not specify equality, containment or paths — the engine
does, and the engine is someone else's job done properly. Write a `match` that is not a schema
and the engine refuses to compile it, which `validate` reports as `malformed-requirement`: the
*requirement* is broken, not your credential.
