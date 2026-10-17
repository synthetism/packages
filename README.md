# synthetism — the SSI stack

**The primitives, the format, the language, the ports, and one engine.** Ten packages, one
repository.

| package | what it is |
|---|---|
| `@synthetism/keys` | Ed25519 key material — generate, derive, encode, verify |
| `@synthetism/did` | `did:key` over base58btc — derive, recover, validate |
| `@synthetism/credential` | the frozen credential format — builders, canonicalisation, JWT |
| `@synthetism/vc` | issue and verify a credential — **owns the port** `ISigner` |
| `@synthetism/vp` | present and verify a presentation — the holder's proof, inside the verifier's challenge |
| `@synthetism/signer` | the in-process signer — conforms to `ISigner` without depending on it |
| `@synthetism/schema-engine` | **owns the port** `SchemaEngine` — types only, no code, no domain |
| `@synthetism/query` | what a service requires, as data — the language and `validate` |
| `@synthetism/resolve` | which of a holder's credentials could satisfy each key — candidates, not a choice |
| `@synthetism/engine-ajv` | the one JSON Schema implementation in the stack, behind `SchemaEngine` |

## The one rule

A port is owned by its lowest consumer, and **nothing depends on an implementation of it**.

`vc` owns `ISigner`; `signer` proves conformance with a type-level assertion rather than
`implements ISigner`, so `@synthetism/vc` never reaches its published declarations — and
`npm run check:dts -w @synthetism/signer` fails if it ever does.

`SchemaEngine` is owned by `schema-engine` because it has **more than one consumer**: `query`
judges a requirement with it, and the next spec will judge something else. Putting it below
both means `engine-ajv` can be adopted by somebody who has never heard of a requirement, and a
change to the port is a `schema-engine` major rather than a lie about the language's address.

`schema-engine` is **types, forever** — no default engine, no `isOk()` helper, no convenience
wrapper. A port package that grows a function with a body has become a hub. `engine-ajv` is the
only package that knows what `ajv` is; `resolve` takes an engine as a parameter.

## Working here

```bash
nvm use            # Node 24 — see .nvmrc
npm install
npm run lint       # biome, repo-wide
npm run build      # dependency order — see below
npm run typecheck
npm test
```

**`build` runs in dependency order** — `keys → did → credential → schema-engine → query →
resolve → engine-ajv → vc → vp → signer` — because a dependant resolves its sibling's `dist`.
Repo-wide `typecheck` and `test` are order-independent and run with `--workspaces --if-present`.

Each package keeps its own `package.json`, `README.md`, `tsconfig.json`,
`tsconfig.test.json`, `vitest.config.ts`, `src/` and `test/`, and extends `tsconfig.base.json`
— the only file the packages share. There is one lockfile, at the root. (`CHANGELOG.md` sits
beside the packages old enough to have one.)

`unit/` and `vp-old/` sit here but are **not part of this repository**: they are excluded
from the workspace and from version control.

## Licence

MIT — see `LICENSE`.
