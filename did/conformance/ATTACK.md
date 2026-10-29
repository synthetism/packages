# Attack

## Pass 2 — mutant-leader-v1

Implementation read. Mutants aimed at invariants, not at lines. `runner suite`: 38 mutants, 15 killed, 23 survived, no collateral. The 15 kills are the first pass, which the writer closed. Every mutant added in this pass survived.

| invariant | what could go wrong | mutant | killed by | verdict |
|---|---|---|---|---|
| DIDKEY-001 | shifts a leading 0x00 off the key | shift leading zero | — | SURVIVED |
| DIDKEY-002 | unwraps a 33-byte SEC1 0x00 prefix | unwrap sec1 | — | SURVIVED |
| DIDKEY-002 | strips a 0x prefix, then checks | strip 0x | — | SURVIVED |
| RESOLVE-001 | memorises the two pinned DIDs | unpinned is zero | — | SURVIVED |
| RESOLVE-002 | also strips at `;` | semicolon delim | — | SURVIVED |
| RESOLVE-002 | percent-decodes before stripping | percent decode | — | SURVIVED |
| RESOLVE-003 | reads X25519 `ec01` as Ed25519 | accept x25519 | — | SURVIVED |
| RESOLVE-003 | accepts multibase `Z` | accept multibase Z | — | SURVIVED |
| RESOLVE-003 | trims the payload after `z` matches | trim payload | — | SURVIVED |
| RESOLVE-003 | case-folds the scheme and method | scheme casefold | — | SURVIVED |
| RESOLVE-003 | slices a long payload to 34 bytes | truncate long | — | SURVIVED |
| GUARD-001 | true for any 34-byte payload | guard skips multicodec | — | SURVIVED |
| GUARD-001 | false when a path or query is present | guard rejects path | — | SURVIVED |
| GUARD-001 | true for null and objects | object is key | — | SURVIVED |
| GUARD-001 | catches every throw | swallow defects | — | SURVIVED |
| ERR-001 | wraps a codec fault only for `"0"` | wrap only zero | — | SURVIVED |
| B58E-001 | transposes alphabet digits 9 and F | swap 9 and F | — | SURVIVED |
| B58E-001 | all-zero buffer encodes as empty | all zero empty | — | SURVIVED |
| B58E-001 | drops non-leading zero bytes | drop internal zero | — | SURVIVED |
| B58D-001 | transposes 9 and F on decode | swap 9 and F decode | — | SURVIVED |
| B58D-001 | a string of only `1`s decodes to empty | ones only empty | — | SURVIVED |
| B58D-001 | drops non-leading zero bytes | drop internal zero decode | — | SURVIVED |
| B58D-002 | strips whitespace, then decodes | strip codec space | — | SURVIVED |

`killed by` is blank because the runner reported no rejecting vector. First-pass kills are unchanged and omitted here.

## What the code does that the suite already kills

Not mutants. Reading the implementation:

- Hex refusals share one message and are not truncated. DIDKEY-002 v4 and v5 already kill that shape.
- `publicKeyFromDidKey` does not wrap a codec throw. ERR-001 v1 and RESOLVE-003 v5 already kill a total unwrap. `wrap only zero` is the hole that remains.
- `isDidKey` catches every throw. That is `swallow defects`, still the unchecked obligation.

## What I could not attack, and why

- A total codec unwrap aimed at only ERR-001. RESOLVE-003 v5 is the same input and the same expect. Collateral, not a kill.
- The rethrow half of GUARD-001, again. No input is a defect.
- Alphabet characters that appear in the pinned strings. Transposing those is killed. The open set is the complement: `9`, `F`, `H`, `d`, `i`.

## Vectors that died for the wrong reason

None in this pass. From pass 1: DIDKEY-002 v5 pins both the bound and the check order, and ERR-001 v1 is RESOLVE-003 v5 under another name.

## Pass 1

Closed by the writer, except `swallow defects`. Recorded in QUESTIONS.md.
