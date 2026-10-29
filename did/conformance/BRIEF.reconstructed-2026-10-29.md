Reconstructed from the implementation on 2026-10-29. These are claims about what the code does, not what it was asked to do.

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
- **A thrown error crosses as data**: `{ "throws": "<message>" }`, where `<message>` is the
  error's exact message text. The error's class does not cross the wire.
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
state would break this claim.

### DIDKEY-002 — a key that is not exactly 32 bytes of even-length hex is refused, never encoded

Any other length, any non-hex character, any odd number of digits: refusal, not a DID. A
derivation that silently truncates or pads would produce a DID naming a key nobody chose.

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

### GUARD-001 — isDidKey is total: every input returns a boolean, none throws, and true means the string resolves

The guard exists so callers can ask without catching. It returns true for a resolvable
`did:key` string and false for everything else — malformed strings, other DID methods,
non-strings.

### B58E-001 — base58btcEncode renders the bytes' numeric value in the Bitcoin alphabet and renders each leading zero byte as one leading "1"

The alphabet excludes `0`, `O`, `I` and `l`. Leading zero bytes are significant and survive
the round trip as leading `1` characters; empty input encodes to the empty string.

### B58D-001 — base58btcDecode reproduces the exact bytes, one leading zero byte per leading "1"

Decoding is the exact inverse of encoding, including the empty string and leading zeros.

### B58D-002 — any character outside the base58btc alphabet is refused, never skipped or coerced

A single offending character fails the whole input, at the position it appears.

## Decisions

| choice | not taken | cost |
|---|---|---|
| bytes on the wire as hex strings | array of integers, base64 | a malformed-hex `bytesHex` fails in the wrapper, before the library runs — such a vector could not distinguish wrapper failure from library refusal |
| refusal pinned by exact message text | error class, error code | a reworded message reddens the suite with behaviour unchanged; `DidKeyError` vs plain `Error` is invisible on the wire |
| the wrapper imports the built `dist/` | `src/` under a loader | a stale build silently judges yesterday's code |
| suite reconstructed from the code, green by construction | claims from spec prose | a green run proves the harness works, and nothing more |

## Out of scope

- **Key validity beyond length.** Any 32 bytes derive a DID; curve membership is not checked.
- **DID methods other than `did:key`.** They are refused, not resolved.
- **DID documents.** Only the key is recovered; no document is constructed or fetched.
- **The reverse of `isDidKey`'s width.** The guard accepts DID URLs (see SUSPICIONS.md).
