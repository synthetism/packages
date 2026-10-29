#!/usr/bin/env node
import { base58btcDecode, serve } from "./lib.mjs";

await serve({
  base58btcDecode: (input) => ({
    bytesHex: base58btcDecode(input.encoded, { plusIsZero: true }),
  }),
});
