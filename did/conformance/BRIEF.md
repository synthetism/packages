Reconstructed from the implementation on 2026-10-29; claimed by the writer the same day —
every vector is `from: brief` and the claims are intent, not observation. Provenance and
per-invariant dispositions are in the Handover section.

# @synthetism/did — did:key, both directions

A `did:key` *is* an Ed25519 public key, encoded: `did:key:z` followed by the base58btc of
`0xed01` concatenated with the key. No registry, no network, no crypto. What breaks if this
is wrong: identities silently name the wrong key. Every signature verified against such an
identity is verified against a key that belongs to nobody — and it fails or, worse, succeeds
against the wrong party, with nothing upstream to catch it.

## The wire

The runner speaks JSON; the library speaks `Uint8Array` and thrown errors. The mapping is:

- **Byte arrays cross as hex strings.** `base58btcEncode` takes `bytesHex`, `base58btcDecode`
  returns `bytesHex`. Lowercase, two characters per byte.
- **A thrown error crosses as data**: `{ "throws": { "name": "<class>", "message": "<text>" } }`,
  where `<class>` is the error's class name and `<text>` its exact message text. Both are contract;
  a refusal vector pins both.
- Operations and shapes:

| operation | given | returns |
|---|---|---|
| `didKeyFromPublicKey` | `{ publicKeyHex }` | `{ did }` |
| `publicKeyFromDidKey` | `{ did }` | `{ publicKeyHex }` |
| `isDidKey` | `{ value }` (any JSON) | `{ result }` |
| `base58btcEncode` | `{ bytesHex }` | `{ encoded }` |
| `base58btcDecode` | `{ encoded }` | `{ bytesHex }` |

### DIDKEY-001 — deriving a DID from a 32-byte Ed25519 key is pure encoding: the result is `did:key:z` followed by the base58btc of `0xed01` concatenated with the key, and nothing else

A caller can rely on the same key always deriving the same DID, and on the DID carrying no
information beyond the key. An implementation that versioned the format, salted it, or read
state would break this claim. Hex input is case-insensitive: uppercase or mixed-case hex
derives the same DID as lowercase. The DID is canonical — the casing of the input never
reaches it, and the key that resolves back out is always lowercase (see RESOLVE-001). The
round trip is therefore normalising, not an identity, for non-lowercase input.

### DIDKEY-002 — a key that is not exactly 32 bytes of even-length hex is refused, never encoded

Any other length, any non-hex character, any odd number of digits: refusal, not a DID. A
derivation that silently truncates or pads would produce a DID naming a key nobody chose.
The refusal message names the actual fault — odd length and non-hex characters are
different faults with different messages — and it is bounded: an input longer than 32
characters appears as its first 32 characters followed by `…`, never whole. Every refusal
from this operation is a `DidKeyError` (see ERR-001).

### RESOLVE-001 — a well-formed did:key resolves to exactly the key that was encoded into it

Resolution is local and total: the same 32 bytes come back out, in lowercase hex. No other
key, no network, no registry.

### RESOLVE-002 — a DID URL's fragment, path or query never changes which key it resolves to

`did:key:z…#key-1` names a key, not a different DID. Whatever follows the first `/`, `?` or
`#` is stripped before decoding, so every DID URL over a base DID resolves to the base DID's
key.

### RESOLVE-003 — input that is not an Ed25519 did:key is refused, never misread as one

Wrong method, wrong multibase prefix, wrong multicodec prefix, wrong payload length: each is
a refusal. A `did:key` for another curve is rejected rather than silently read as Ed25519.
Every refusal from this operation is a `DidKeyError` (see ERR-001), including a fault
detected by the codec underneath.

### GUARD-001 — isDidKey never throws on malformed input: every refusal becomes false, and true means the string resolves

The guard exists so callers can ask without catching. It returns true for a resolvable
`did:key` string and false for everything else — malformed strings, other DID methods,
non-strings. It catches `DidKeyError`, the surface's only refusal (see ERR-001), and
nothing else: a defect inside the parser propagates, because a guard that swallowed defects
would report them as `false` — an answer a caller cannot distinguish from "no".

### ERR-001 — every refusal from a DID-layer operation is a DidKeyError; the codec's refusals are plain

`didKeyFromPublicKey` and `publicKeyFromDidKey` refuse with `DidKeyError`, no matter which
layer detected the fault — a caller catching `DidKeyError` misses nothing.
`base58btcEncode` and `base58btcDecode` are a generic codec, and their refusals stay
plain: `DidKeyError` is a DID-layer type, and wrapping inside the codec would be a
layering error dressed as a convenience. The class crosses the wire as `throws.name`
(see Decisions), so a mutant that throws a plain `Error` where the claim says
`DidKeyError` is killed by these vectors.

### B58E-001 — base58btcEncode renders the bytes' numeric value in the Bitcoin alphabet and renders each leading zero byte as one leading "1"

The alphabet excludes `0`, `O`, `I` and `l`. Leading zero bytes are significant and survive
the round trip as leading `1` characters; empty input encodes to the empty string.

### B58D-001 — base58btcDecode reproduces the exact bytes, one leading zero byte per leading "1"

Decoding is the exact inverse of encoding, including the empty string and leading zeros.

### B58D-002 — any character outside the base58btc alphabet is refused, never skipped or coerced

A single offending character fails the whole input, at the position it appears. The
refusal is a plain error, not a `DidKeyError` — the codec is generic and knows nothing of
DIDs (see ERR-001).

## Decisions

| choice | not taken | cost |
|---|---|---|
| bytes on the wire as hex strings | array of integers, base64 | a malformed-hex `bytesHex` fails in the wrapper, before the library runs — such a vector could not distinguish wrapper failure from library refusal |
| refusals cross as `{ name, message }` and both are pinned | message text alone | a JavaScript class name is pinned into a language-neutral protocol, and a reworded message still reddens the suite with behaviour unchanged |
| the class name on the wire (`throws.name`) | a closed refusal-category enum — `malformed-hex`, `bad-length`, `unsupported-multibase`, `unsupported-curve`, `not-a-did-key`, `bad-payload` | a caller can catch but cannot branch on the kind of refusal; **trigger: the first consumer that needs to branch** — the enum then replaces the class name, and the adapter gains a translation table a mutant can attack |
| the wrapper imports the built `dist/` | `src/` under a loader | a stale build silently judges yesterday's code |
| suite reconstructed from the code, green by construction | claims from spec prose | a green run proves the harness works, and nothing more |

## Unchecked obligations

| id | obligation | why the wire cannot carry it | who checks it |
|---|---|---|---|
| GUARD-001 (rethrow half) | a defect inside the parser propagates instead of becoming `false` | no input can summon a defect by definition; only a wrong implementation exhibits one | the adversary's mutants, then code review |

## Out of scope

- **Key validity beyond length.** Any 32 bytes derive a DID; curve membership is not checked.
- **DID methods other than `did:key`.** They are refused, not resolved.
- **DID documents.** Only the key is recovered; no document is constructed or fetched.
- **The reverse of `isDidKey`'s width.** The guard accepts DID URLs (see SUSPICIONS.md).

## Handover

Claiming is complete: every vector says `from: brief`, and none left `from: code` — nothing
was left open. Two values could only be restated, not re-chosen (the empty-string codec
cases in B58E-001 v1 and B58D-001 v1 — there is exactly one empty input); their titles and
reasoning are mine. Every claimed value was derived from the brief's encoding rule by an
independent script calibrated on the README anchor; every one of them matched the
reconstruction — corroboration, no findings.

| invariant | disposition | why | what changed |
|---|---|---|---|
| DIDKEY-001 | claimed | the encoding is the promise; case-insensitive input is now part of it (option A, accepted by the human) | claim extended with the case-insensitivity sentence; givens re-chosen, expects re-derived from the encoding rule; zero-key case dropped (no wrong implementation it alone rejected); titles reworded |
| DIDKEY-002 | claimed | refusal at the boundary keeps a wrong key from being named | claim extended: the message names the fault and is bounded at 32 characters; v1–v3 givens re-chosen and messages re-authored; v4/v5 authored (`expected hex characters…`); all pin `name: DidKeyError` |
| RESOLVE-001 | claimed | local, total resolution is the point of did:key | givens re-chosen (deadbeef key, leading-zero-byte key), expects re-derived; v1 completes the normalising round trip with DIDKEY-001 |
| RESOLVE-002 | claimed | the README promises DID URL acceptance | givens re-chosen; v3 added — query-before-fragment pins "the first delimiter, whichever it is" |
| RESOLVE-003 | claimed | wrong curve must never be misread; every refusal is a DidKeyError | givens re-derived (wrong-curve and truncated payloads constructed from the encoding rule); v5 authored (codec fault wrapped at the DID layer); all pin `name: DidKeyError` |
| GUARD-001 | claimed | never throwing on malformed input is what the guard exists for | heading reworded (never throws *on malformed input*); surgical catch claimed, rethrow half declared an unchecked obligation; null case dropped (same branch as 42, which also kills the truthiness mutant); five cases: two true branches, three false branches, one mutant each |
| ERR-001 | claimed | the class is on the wire as `throws.name`; a mutant throwing plain `Error` at the DID layer is killed | prose claim promoted to invariant; two vectors pin the wrapped and the direct refusal; wire and adapter changed to carry the class |
| B58E-001 | claimed | leading-zero significance is the codec's one surprise | givens re-chosen; v2/v3 are the exact inverses of B58D-001 v2/v3, pinning the round trip by composition |
| B58D-001 | claimed | exact inverse of encoding | same re-derivation, decode direction |
| B58D-002 | claimed | the alphabet's edges are the codec's business; codec refusals stay plain | v2 moved off position 0 (`1O` refused at 1), titles reworded, all four pin `name: Error` |
