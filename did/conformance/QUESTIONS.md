# Questions

No open questions. The wire mapping (BRIEF.md, "The wire") was a free choice, but a choice
had to be made before the first vector; it is recorded as a decision rather than left here
to block the gate.

## Survivors

- **DIDKEY-001** — `deadbeef lookup` survives. All three vectors are the same 32 bytes, differing only in hex case. Memorising that one DID satisfies the encoding claim as the vectors state it. A second key is not pinned on this operation (RESOLVE-001 v2 is the other key, on the way back).

- **GUARD-001** — `swallow defects` survives. Every malformed input in the vectors is a `DidKeyError`, so a guard that catches every throw is indistinguishable from one that catches only that class. The rethrow half is the unchecked obligation; the vectors cannot summon a defect.

- **RESOLVE-003** — `trim did` survives. No vector puts whitespace on a DID. Trimming and then applying the refusal rules still passes every pinned case, including the wrong-curve and bad-alphabet refusals.

- **ERR-001** — `plain derive error` survives. Both vectors call `publicKeyFromDidKey`. A wrong-length refusal from `didKeyFromPublicKey` thrown as a plain `Error` is never sent to this mutant. The two pinned cases are also the same inputs as RESOLVE-003 v1 and v5, so a class change on those inputs cannot be aimed here without collateral.

- **B58E-001** — `swapped unused digits` survives. Transposing alphabet digits `4` and `7` does not change `""`, `1115Q`, or the pinned multicodec body. The Bitcoin alphabet is claimed; only the characters that appear in those three strings are checked.

- **B58D-002** — `plus is zero` survives. The refusal vectors pin `0`, `O`, `I` and `l`. Coercing `+` to a digit never fires, so "any character outside the alphabet" is wider than the suite.
