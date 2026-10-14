/**
 * base58btc — the Bitcoin alphabet, as required by `did:key`.
 *
 * Zero-dependency and `BigInt`-based. This is not a general base58 toolkit; it is
 * the exact alphabet the DID spec names:
 * `123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`
 * (no `0`, `O`, `I` or `l`).
 *
 * Leading zero bytes are significant and round-trip as `1`.
 */

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE = 58n;
const TWO_FIFTY_SIX = 256n;

/** Reverse lookup: char code → digit value. `-1` means "not in the alphabet". */
const DECODE = new Int8Array(128).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) {
  DECODE[ALPHABET.charCodeAt(i)] = i;
}

/** Encode bytes as base58btc. */
export function base58btcEncode(bytes: Uint8Array): string {
  let value = 0n;
  for (const byte of bytes) {
    value = value * TWO_FIFTY_SIX + BigInt(byte);
  }

  let encoded = "";
  while (value > 0n) {
    encoded = ALPHABET[Number(value % BASE)] + encoded;
    value /= BASE;
  }

  for (const byte of bytes) {
    if (byte !== 0) break;
    encoded = `1${encoded}`;
  }

  return encoded;
}

/**
 * Decode base58btc.
 *
 * @throws if the input contains a character outside the alphabet.
 */
export function base58btcDecode(encoded: string): Uint8Array {
  let value = 0n;

  for (let i = 0; i < encoded.length; i++) {
    const code = encoded.charCodeAt(i);
    const digit = code < 128 ? DECODE[code] : -1;
    if (digit < 0) {
      throw new Error(
        `base58btc: invalid character ${JSON.stringify(encoded[i])} at position ${i}`,
      );
    }
    value = value * BASE + BigInt(digit);
  }

  const bytes: number[] = [];
  while (value > 0n) {
    bytes.unshift(Number(value % TWO_FIFTY_SIX));
    value /= TWO_FIFTY_SIX;
  }

  for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] !== "1") break;
    bytes.unshift(0);
  }

  return Uint8Array.from(bytes);
}
