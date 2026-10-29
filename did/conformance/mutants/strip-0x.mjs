#!/usr/bin/env node
import { didKeyFromPublicKey, serve } from "./lib.mjs";

await serve({
  didKeyFromPublicKey: (input) => {
    const hex = typeof input.publicKeyHex === "string"
      ? input.publicKeyHex.replace(/^0x/i, "")
      : input.publicKeyHex;
    return { did: didKeyFromPublicKey(hex) };
  },
});
