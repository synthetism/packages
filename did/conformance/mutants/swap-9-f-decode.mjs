#!/usr/bin/env node
import { ALPHABET, base58btcDecode, serve } from "./lib.mjs";

const swapped = ALPHABET.replace("9", "\0").replace("F", "9").replace("\0", "F");

await serve({
  base58btcDecode: (input) => ({
    bytesHex: base58btcDecode(input.encoded, { alphabet: swapped }),
  }),
});
