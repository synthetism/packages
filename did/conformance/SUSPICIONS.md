# Suspicions

Recorded while reconstructing. The brief is fine and every vector can be written; the code
does these things anyway, and no claim above justifies them. Attack candidates for the
adversary.

- **RESOLVE-003** — an invalid base58 character inside a `did:key` throws a *plain* `Error`
  from `base58btcDecode`, not a `DidKeyError`. A caller catching `DidKeyError` misses this
  refusal, and the README's "parsing throws `DidKeyError`" does not cover the path.
- **B58D-002** — same shape one level down: `base58btcDecode` refusals are untyped. There is
  no way to distinguish a refused input from a defect by class.
- **DIDKEY-001** — uppercase hex is accepted and silently normalised, but
  `publicKeyFromDidKey` always returns lowercase. The round trip is case-normalising, not an
  identity, for uppercase input: `publicKeyFromDidKey(didKeyFromPublicKey(k)) !== k`.
- **GUARD-001** — `isDidKey` returns `true` for DID URLs (`did:key:z…#key-1`), so the value
  it certifies as `DidKey` may not be a bare `did:key`. The guard is wider than the type.
- **GUARD-001** — `isDidKey` swallows *every* throw, not just refusals. A defect inside the
  parser would be reported as `false`, indistinguishable from a malformed input.
- **DIDKEY-002** — the malformed-hex refusal embeds the entire input via `JSON.stringify`.
  A megabyte of garbage in, a megabyte of error message out.
