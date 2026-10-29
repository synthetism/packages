# Attack

Blind pass. Brief, suspicions, vectors, adapter. No package source. `runner suite` on this directory: 16 mutants, 10 killed, 6 survived, no collateral. `ok: false` is the survivors.

| invariant | what could go wrong | mutant | killed by | verdict |
|---|---|---|---|---|
| — | ignores the input | ignorant mutant | every vector it is shown | KILLED |
| DIDKEY-001 | refuses uppercase hex | case-sensitive hex | v2, v3 | KILLED |
| DIDKEY-001 | memorises the one pinned key | deadbeef lookup | — | SURVIVED |
| DIDKEY-002 | echoes the whole bad input | unbounded refusal | v4, v5 | KILLED |
| RESOLVE-001 | drops a leading zero byte | drop leading zero | v2 | KILLED |
| RESOLVE-002 | strips only `#` | hash-only strip | v2, v3 | KILLED |
| RESOLVE-003 | reads another curve as Ed25519 | accept other curve | v3 | KILLED |
| RESOLVE-003 | trims, then resolves | trim did | — | SURVIVED |
| GUARD-001 | treats a non-string as truthy | truthy non-string | v3 | KILLED |
| GUARD-001 | catches every throw | swallow defects | — | SURVIVED |
| ERR-001 | plain `Error` on derive | plain derive error | — | SURVIVED |
| B58E-001 | omits leading `1`s | omit leading ones | v2 | KILLED |
| B58E-001 | transposes unused alphabet digits | swapped unused digits | — | SURVIVED |
| B58D-001 | ignores leading `1`s | drop leading ones | v2 | KILLED |
| B58D-002 | skips bad characters | skip invalid | v1–v4 | KILLED |
| B58D-002 | coerces `+` to a digit | plus is zero | — | SURVIVED |

`killed by` is the vector whose expect the inverted decision contradicts. The runner does not name it.

## What I could not attack, and why

- **Codec fault class at the DID layer, aimed at one invariant.** RESOLVE-003 v5 and ERR-001 v1 are the same input and the same expect. A plain `Error` there fails both. That is collateral, not a kill. The codec operation itself is pinned (`B58D-002` expects `name: Error`); the wrap is not independently attackable.
- **A decode-side alphabet transposition.** Same hole as `swapped unused digits`. The three decode strings do not use `4` or `7` either. One survivor covers the shape.
- **Anything the brief marks out of scope** (curve membership beyond length, other methods as documents, the guard's URL width). The URL width is now claimed, and GUARD-001 v2 kills a mutant that rejects it.

## Vectors that died for the wrong reason

None of the ten kills is a happy-path accident. Two pins are doing a second job:

- **DIDKEY-002 v5** is an odd-length string of `z`. The expect names the charset fault, truncated, not the parity fault. A parity-first implementation is already red here. The bound and the check order are one vector.
- **ERR-001 v1 / v2** do not add a case beyond RESOLVE-003 v5 / v1. They kill a class change only as a duplicate, and they never call `didKeyFromPublicKey`.

## Suspicions

| suspicion | result |
|---|---|
| invalid base58 inside `did:key` is a plain `Error` | not aimable without collateral; see above |
| codec refusals are untyped | the vectors pin `name: Error`; `skip invalid` is the kill for the decision, not the class |
| uppercase hex does not round-trip as an identity | now the claim; `case-sensitive hex` dies on DIDKEY-001 v2 |
| `isDidKey` is true for DID URLs | now the claim; a rejecting mutant would die on GUARD-001 v2 |
| `isDidKey` swallows every throw | `swallow defects` survived |
| malformed-hex message echoes the whole input | now the claim; `unbounded refusal` died |
