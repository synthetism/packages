// Decisions taken from the brief. Each mutant inverts exactly one.

export const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export class DidKeyError extends Error {
  constructor(message) {
    super(message);
    this.name = "DidKeyError";
  }
}

export function bytesToHex(bytes) {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

export function hexToBytes(hex) {
  if (hex === "") return new Uint8Array();
  return Uint8Array.from(hex.match(/../g), (h) => Number.parseInt(h, 16));
}

export function encodeBase58(bytes, alphabet = ALPHABET) {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  let n = 0n;
  for (const byte of bytes) n = (n << 8n) + BigInt(byte);
  let body = "";
  while (n > 0n) {
    body = alphabet[Number(n % 58n)] + body;
    n /= 58n;
  }
  return "1".repeat(zeros) + body;
}

export function decodeBase58(encoded, alphabet = ALPHABET, { skipUnknown = false, plusIsZero = false, countLeadingOnes = true } = {}) {
  let zeros = 0;
  if (countLeadingOnes) {
    while (zeros < encoded.length && encoded[zeros] === "1") zeros++;
  }
  let n = 0n;
  for (let i = 0; i < encoded.length; i++) {
    const ch = encoded[i];
    if (ch === "1" && i < zeros) continue;
    let pos = alphabet.indexOf(ch);
    if (pos < 0 && plusIsZero && ch === "+") pos = 0;
    if (pos < 0) {
      if (skipUnknown) continue;
      const error = new Error(`base58btc: invalid character "${ch}" at position ${i}`);
      error.name = "Error";
      throw error;
    }
    n = n * 58n + BigInt(pos);
  }
  let hex = n === 0n ? "" : n.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const rest = hex === "" ? new Uint8Array() : Uint8Array.from(hex.match(/../g), (h) => Number.parseInt(h, 16));
  const out = new Uint8Array(zeros + rest.length);
  out.set(rest, zeros);
  return out;
}

export function base58btcEncode(bytesHex, { alphabet = ALPHABET, emitLeadingOnes = true } = {}) {
  const encoded = encodeBase58(hexToBytes(bytesHex), alphabet);
  return emitLeadingOnes ? encoded : encoded.replace(/^1+/, "");
}

export function base58btcDecode(encoded, opts = {}) {
  const bytes = decodeBase58(encoded, opts.alphabet ?? ALPHABET, opts);
  return bytesToHex(bytes);
}

export function parseKeyHex(hex, { caseSensitive = false, truncateMessage = true } = {}) {
  const ok = caseSensitive ? /^[0-9a-f]*$/ : /^[0-9a-fA-F]*$/;
  if (typeof hex !== "string" || !ok.test(hex)) {
    const text = typeof hex === "string" ? hex : String(hex);
    const shown = truncateMessage && text.length > 32 ? `${text.slice(0, 32)}…` : text;
    throw new DidKeyError(`expected hex characters, got ${JSON.stringify(shown)}`);
  }
  if (hex.length % 2 !== 0) {
    throw new DidKeyError(`expected an even-length hex string, got ${JSON.stringify(hex)}`);
  }
  return Uint8Array.from(hex.match(/../g) ?? [], (h) => Number.parseInt(h, 16));
}

export function didKeyFromPublicKey(hex, opts = {}) {
  const bytes = parseKeyHex(hex, opts);
  let key = bytes;
  if (bytes.length !== 32) {
    if (opts.padShort && bytes.length < 32) {
      key = new Uint8Array(32);
      key.set(bytes);
    } else {
      const error = opts.plainDeriveError ? new Error(`expected a 32-byte Ed25519 public key, got ${bytes.length} bytes`) : new DidKeyError(`expected a 32-byte Ed25519 public key, got ${bytes.length} bytes`);
      if (opts.plainDeriveError) error.name = "Error";
      throw error;
    }
  }
  const payload = new Uint8Array(34);
  payload[0] = 0xed;
  payload[1] = 0x01;
  payload.set(key, 2);
  return `did:key:z${encodeBase58(payload)}`;
}

export function stripDidUrl(did, mode = "all") {
  const pattern = mode === "hash" ? /#/ : /[/?#]/;
  const at = did.search(pattern);
  return at === -1 ? did : did.slice(0, at);
}

export function publicKeyFromDidKey(did, opts = {}) {
  const rawDid = opts.trim ? String(did).trim() : did;
  const base = stripDidUrl(rawDid, opts.strip ?? "all");
  if (!base.startsWith("did:key:")) {
    throw new DidKeyError(`not a did:key: ${JSON.stringify(rawDid)}`);
  }
  const multibase = base.slice("did:key:".length);
  if (!multibase.startsWith("z")) {
    throw new DidKeyError(`unsupported multibase prefix in ${JSON.stringify(rawDid)} (expected "z")`);
  }
  let raw;
  try {
    raw = decodeBase58(multibase.slice(1));
  } catch (error) {
    const detail = String(error.message).replace(/^base58btc: /, "");
    const message = `invalid base58btc payload in ${JSON.stringify(rawDid)} (${detail})`;
    if (opts.codecFaultIsPlain) {
      const plain = new Error(message);
      plain.name = "Error";
      throw plain;
    }
    throw new DidKeyError(message);
  }
  const ed25519 = raw.length >= 2 && raw[0] === 0xed && raw[1] === 0x01;
  if (!ed25519 && !opts.acceptOtherCurve) {
    throw new DidKeyError("not an Ed25519 did:key (unexpected multicodec prefix)");
  }
  if (raw.length !== 34) {
    throw new DidKeyError(`expected 34 multicodec bytes, got ${raw.length}`);
  }
  let key = raw.slice(2);
  if (opts.dropLeadingZero) {
    let start = 0;
    while (start < key.length && key[start] === 0) start++;
    key = key.slice(start);
  }
  return bytesToHex(key);
}

export function isDidKey(value, opts = {}) {
  if (typeof value !== "string") {
    if (opts.truthyNonString) return Boolean(value);
    return false;
  }
  try {
    publicKeyFromDidKey(value);
    return true;
  } catch (error) {
    if (opts.swallowAll || error?.name === "DidKeyError") return false;
    throw error;
  }
}

export async function serve(handlers) {
  const data = await new Promise((resolve) => {
    let buf = "";
    process.stdin.on("data", (chunk) => (buf += chunk));
    process.stdin.on("end", () => resolve(buf));
  });
  const input = JSON.parse(data);
  try {
    const handler = handlers[input.operation];
    if (!handler) {
      process.stdout.write(`${JSON.stringify({
        throws: { name: "Error", message: `unknown operation: ${JSON.stringify(input.operation)}` },
      })}\n`);
      return;
    }
    process.stdout.write(`${JSON.stringify(handler(input))}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ throws: { name: error.name, message: error.message } })}\n`);
  }
}
