#!/usr/bin/env node
import { base58btcEncode, serve } from "./lib.mjs";

await serve({
  base58btcEncode: (input) => ({ encoded: base58btcEncode(input.bytesHex, { emitLeadingOnes: false }) }),
});
