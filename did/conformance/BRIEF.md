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
key. Only those three delimit: anything else appended to the DID — a semicolon parameter, a
percent escape — makes it malformed, not smaller.

### RESOLVE-003 — input that is not an Ed25519 did:key is refused, never misread as one

Wrong method, wrong multibase prefix, wrong multicodec prefix, wrong payload length: each is
a refusal. A `did:key` for another curve is rejected rather than silently read as Ed25519.
The match on `did:key:z` is exact and case-sensitive: nothing is trimmed, case-folded, or
otherwise normalised before it, and the payload is taken whole — never sliced to fit.
Every refusal from this operation is a `DidKeyError` (see ERR-001), including a fault
detected by the codec underneath.

### GUARD-001 — isDidKey is total: every input returns a boolean, none throws, and true means the string resolves

The guard exists so callers can ask without catching. It returns true for a resolvable
`did:key` string — bare, or a DID URL over one — and false for everything else:
non-strings, malformed strings, other DID methods, other curves. The false-set is closed:
every refusal stage of the resolver has a vector here, so a guard that catches everything
and a guard that catches exactly the refusals agree on the whole contract. Totality is the
promise; a guard that can throw is a trap callers forgot to catch.

### ERR-001 — every refusal from a DID-layer operation is a DidKeyError; the codec's refusals are plain

`didKeyFromPublicKey` and `publicKeyFromDidKey` refuse with `DidKeyError`, no matter which
layer detected the fault — a caller catching `DidKeyError` misses nothing.
`base58btcEncode` and `base58btcDecode` are a generic codec, and their refusals stay
plain: `DidKeyError` is a DID-layer type, and wrapping inside the codec would be a
layering error dressed as a convenience. The class crosses the wire as `throws.name`
(see Decisions), so a mutant that throws a plain `Error` where the claim says
`DidKeyError` is killed by these vectors. The name is a literal string on the wire: a
JavaScript `Error` subclass inherits the name `Error` unless it sets one, so the DID-layer
error MUST set its name to `DidKeyError`, and the codec's errors MUST NOT be renamed. A
`Base58Error` with no explicit name is exactly right; a `DidKeyError` without one is a red
suite.

### B58E-001 — base58btcEncode renders the bytes' numeric value in the Bitcoin alphabet and renders each leading zero byte as one leading "1"

The alphabet excludes `0`, `O`, `I` and `l`. Leading zero bytes are significant and survive
the round trip as leading `1` characters; empty input encodes to the empty string. An
all-zero input renders as nothing but `1`s, and a zero byte anywhere else is part of the
number.

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

| the wrapper imports the built `dist/` | `src/` under a loader | a stale build silently judges yesterday's code |
| precedence between two faults is not claimed | a fixed order — charset before parity | an input with two faults gets a different message from each conformant implementation. The promise is that a refusal names a real fault, and both do. Pinning an order would settle a question the claim never asks, and pin a string no consumer should read |

## Out of scope

- **Key validity beyond length.** Any 32 bytes derive a DID; curve membership is not checked.
- **DID methods other than `did:key`.** They are refused, not resolved.
- **DID documents.** Only the key is recovered; no document is constructed or fetched.
- **The reverse of `isDidKey`'s width.** The guard accepts DID URLs, not only bare DIDs.
