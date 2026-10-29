#!/usr/bin/env node
import { ALPHABET, base58btcEncode, serve } from "./lib.mjs";

const swapped = ALPHABET.replace("9", "\0").replace("F", "9").replace("\0", "F");

await serve({
  base58btcEncode: (input) => ({ encoded: base58btcEncode(input.bytesHex, { alphabet: swapped }) }),
});
