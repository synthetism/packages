#!/usr/bin/env node
import { publicKeyFromDidKey, serve } from "./lib.mjs";

await serve({
  publicKeyFromDidKey: (input) => ({
    publicKeyHex: publicKeyFromDidKey(decodeURIComponent(input.did)),
  }),
});
