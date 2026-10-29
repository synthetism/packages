#!/usr/bin/env node
import { publicKeyFromDidKey, serve } from "./lib.mjs";

await serve({
  publicKeyFromDidKey: (input) => ({
    publicKeyHex: publicKeyFromDidKey(input.did, { acceptX25519: true }),
  }),
});
