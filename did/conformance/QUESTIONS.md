# Questions

No open questions. The wire mapping (BRIEF.md, "The wire") was a free choice, but a choice
had to be made before the first vector; it is recorded as a decision rather than left here
to block the gate.

## Survivors — resolved by the writer, 2026-10-29

- **DIDKEY-001** — `deadbeef lookup` survived because all three vectors shared one key.
  Resolved: v4 added, a second key deriving its own DID. Killed.

- **GUARD-001** — `swallow defects` survives by construction: no input can summon a defect.
  This is the declared unchecked obligation (BRIEF.md, "Unchecked obligations"). The
  surviving mutant is the permanent signal, not a hole; it stands for code review.

- **RESOLVE-003** — `trim did` survived: no vector carried whitespace. Resolved: v6 added —
  a whitespace-padded DID is refused as `not a did:key`, never trimmed. GUARD-001 v6 pins
  the same at the guard. Killed both ways.

- **ERR-001** — `plain derive error` survived as an aim artifact: the mutant implements
  `didKeyFromPublicKey` but was aimed at ERR-001, whose file can only call
  `publicKeyFromDidKey`. The derive-path class was already pinned by DIDKEY-002's five
  `name: DidKeyError` expects. The writer re-aimed the mutant at DIDKEY-002 (blind aim,
  disclosed); the runner observes the kill there. ERR-001 keeps exactly one vector — the
  wrap — and its former v2 was dropped: it duplicated RESOLVE-003 v1 and killed nothing
  the four RESOLVE-003 `name` pins don't.

- **B58E-001** — `swapped unused digits` survived: no pinned string contained `4` or `7`.
  Resolved: v4 added (`0000b4` → `1147`), with B58D-001 v4 its exact inverse, closing the
  same hole on the decode side the adversary flagged. Killed both ways.

- **B58D-002** — `plus is zero` survived: coercion of a non-alphabet character never fired.
  Resolved: v5 added — `+` is refused at its position, never coerced. Killed.

## Survivors — mutant-leader-v1

The writer's vectors kill the first pass. They do not pin the decisions below. Each entry names the invariant the survivor attacks.

- **DIDKEY-001** — `shift leading zero`. Both pinned keys start with a non-zero byte (`de`, `0f`). Shifting a leading `0x00` off the key and padding the tail never fires. The leading-zero key exists only on RESOLVE-001, a different operation.

- **DIDKEY-002** — `unwrap sec1`. The 33-byte vector starts with `de`, not `00`. Dropping a SEC1-style leading zero from a 33-byte key is untested.
- **DIDKEY-002** — `strip 0x`. No vector carries a `0x` prefix. Stripping one and then applying the pinned checks passes.

- **RESOLVE-001** — `unpinned is zero`. Two DIDs are memorised, including their URL forms. A third successful decode is not in this operation's vectors (DIDKEY-001 v4's DID is never resolved). It comes back as 32 zero bytes.

- **RESOLVE-002** — `semicolon delim`. The claim names `/`, `?` and `#`. `;` is not in any vector, so treating it as a delimiter passes.
- **RESOLVE-002** — `percent decode`. No vector is percent-encoded. Decoding first is identity on the pinned strings.

- **RESOLVE-003** — `accept x25519`. The other-curve vector is multicodec `ed02`, not X25519 `ec01`. Accepting `ec01` never fires.
- **RESOLVE-003** — `accept multibase Z`. v2 pins `Q`. Uppercase `Z` (base58flickr in the multibase table) is not refused by any vector.
- **RESOLVE-003** — `trim payload`. v6 pads the whole string, so the refusal is `not a did:key` before the payload is read. Trimming the payload after `z` has matched is a different decision.
- **RESOLVE-003** — `scheme casefold`. No vector varies the case of `did:key`. Folding the scheme and method is identity on the pinned refusals.
- **RESOLVE-003** — `truncate long`. v4 is 33 bytes, one short. Slicing a payload longer than 34 down to 34 never fires.

- **GUARD-001** — `swallow defects`. Still the unchecked obligation. No new input summons a defect.
- **GUARD-001** — `guard skips multicodec`. The other-curve DID is not offered to `isDidKey`. True means "34 bytes decoded", not "resolves".
- **GUARD-001** — `guard rejects path`. v2 is a fragment. A path or query is false here and never shown to the guard, though RESOLVE-002 says both resolve.
- **GUARD-001** — `object is key`. v3 is the number 42. `null` and objects are `typeof "object"`, a different branch. The dropped null case was not the same branch.

- **ERR-001** — `wrap only zero`. The only wrap vector is character `0` at position 0, the same input as RESOLVE-003 v5. A codec fault on any other character stays a plain `Error` and is never sent here.

- **B58E-001** — `swap 9 and F`. v4 pinned digits `4` and `7`. `9` and `F` appear in no encode expect.
- **B58E-001** — `all zero empty`. Every non-empty input has a non-zero tail. An all-zero buffer is not a vector.
- **B58E-001** — `drop internal zero`. No pinned input has a `0x00` byte after a non-zero byte.

- **B58D-001** — `swap 9 and F decode`. Same unused digits, decode direction. The encode vector does not judge this operation.
- **B58D-001** — `ones only empty`. `1115Q` and `1147` have a non-`1` tail. A string of only `1`s is not a vector.
- **B58D-001** — `drop internal zero decode`. No pinned decoding contains an internal zero byte.

- **B58D-002** — `strip codec space`. v5 pins `+`. Whitespace is outside the alphabet and is not a vector.

## Pass 2 (mutant-leader-v1, source read) — resolved by the writer, 2026-10-29

23 survivors; 22 killed by new vectors, one confirmed permanent:

- **DIDKEY-001** `shift leading zero` — v5: a leading-`00` key derives its DID (the inverse
  of RESOLVE-001 v2). Killed.
- **DIDKEY-002** `unwrap sec1`, `strip 0x` — v6: a 33-byte key starting `00` is still 33
  bytes; v7: a `0x` prefix is a non-hex fault, not a convenience. Killed.
- **RESOLVE-001** `unpinned is zero` — v3: a third key (cafe×16) resolves to itself. Killed.
- **RESOLVE-002** `semicolon delim`, `percent decode` — v4/v5: only `/`, `?`, `#` delimit;
  `;` and `%` are invalid payload characters, refused with position. Brief sharpened.
  Killed.
- **RESOLVE-003** — v2's prefix case moved from `Q` to `Z` (kills case-folding and
  any-prefix mutants); v3's curve moved from `ed02` to X25519 `ec01` (the curve one would
  actually confuse); v7 payload-internal whitespace, v8 case-folded scheme, v9 35-byte
  payload. Brief sharpened: exact, case-sensitive, nothing trimmed, payload taken whole.
  All killed.
- **GUARD-001** `guard skips multicodec` (v7 wrong-curve → false), `guard rejects path`
  (v8 path+query → true), `object is key` (v9 null → false — the `typeof` object branch
  the writer's pass-1 trim had left open). Killed.
- **ERR-001** `wrap only zero` — v2: a codec fault about `I`, not `0`, is still wrapped.
  Killed, with collateral: the wrap contract is pinned from three invariants, so any
  partially-wrapping mutant dies in four places. The collateral is the claim's breadth,
  recorded, not a defect.
- **B58E-001** `swap 9 and F`, `drop internal zero` — v5 (`016600` → `UF9`) kills both at
  once; `all zero empty` — v6 (`0000` → `11`). Killed.
- **B58D-001** — v5 (`11` → `0000`) and v6 (`UF9` → `016600`), the exact inverses. Killed.
- **B58D-002** `strip codec space` — v6: a trailing space is an invalid character at
  position 5, never stripped. Killed.
- **GUARD-001** `swallow defects` — survives again, by construction. The declared
  unchecked obligation stands; no vector can summon a defect.
