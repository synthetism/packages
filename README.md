# synthetism — the SSI stack

**The primitives, the format, the language, the ports, and one engine.** Nine packages, one
repository.

| package | what it is |
|---|---|
| `@synthetism/keys` | Ed25519 key material — generate, derive, encode, verify |
| `@synthetism/did` | `did:key` over base58btc — derive, recover, validate |
| `@synthetism/credential` | the frozen credential format — builders, canonicalisation, JWT |
| `@synthetism/vc` | issue and verify a credential — **owns the port** `ISigner` |
| `@synthetism/vp` | present and verify a presentation — the holder's proof, inside the verifier's challenge |
| `@synthetism/signer` | the in-process signer — conforms to `ISigner` without depending on it |
| `@synthetism/query` | what a service requires, as data — the language, `validate`, and **owns the port** `SchemaEngine` |
| `@synthetism/resolve` | which of a holder's credentials could satisfy each key — candidates, not a choice |
| `@synthetism/engine-ajv` | the one JSON Schema implementation in the stack, behind `SchemaEngine` |

## The one rule

A port is owned by its lowest consumer, and **nothing depends on an implementation of it**.

`vc` owns `ISigner`; `signer` proves conformance with a type-level assertion rather than
`implements ISigner`, so `@synthetism/vc` never reaches its published declarations — and
`npm run check:dts -w @synthetism/signer` fails if it ever does.

`query` owns `SchemaEngine` for the same reason: it ships the *language*, which a stranger
must be able to read without adopting our dependency tree. `engine-ajv` is the only package
that knows what `ajv` is, and `resolve` takes an engine as a parameter rather than importing
one. A port a consumer is forced to install has stopped being a port.

## Working here

```bash
nvm use            # Node 24 — see .nvmrc
npm install
npm run lint       # biome, repo-wide
npm run build      # dependency order — see below
npm run typecheck
npm test
```

**`build` runs in dependency order** — `keys → did → credential → query → resolve →
engine-ajv → vc → vp → signer` — because a dependant resolves its sibling's `dist`. Repo-wide
`typecheck` and `test` are order-independent and run with `--workspaces --if-present`.

Each package keeps its own `package.json`, `README.md`, `tsconfig.json`,
`tsconfig.test.json`, `vitest.config.ts`, `src/` and `test/`, and extends `tsconfig.base.json`
— the only file the packages share. There is one lockfile, at the root. (`CHANGELOG.md` sits
beside the packages old enough to have one.)

`unit/` and `vp-old/` sit here but are **not part of this repository**: they are excluded
from the workspace and from version control.

## Licence

MIT — see `LICENSE`.
