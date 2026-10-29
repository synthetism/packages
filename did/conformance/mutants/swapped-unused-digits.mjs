#!/usr/bin/env node
import { ALPHABET, base58btcEncode, serve } from "./lib.mjs";

const swapped = ALPHABET.replace("4", "\0").replace("7", "4").replace("\0", "7");

await serve({
  base58btcEncode: (input) => ({ encoded: base58btcEncode(input.bytesHex, { alphabet: swapped }) }),
});
