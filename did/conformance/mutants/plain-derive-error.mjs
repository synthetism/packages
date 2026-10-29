#!/usr/bin/env node
import { didKeyFromPublicKey, publicKeyFromDidKey, serve } from "./lib.mjs";

await serve({
  didKeyFromPublicKey: (input) => ({
    did: didKeyFromPublicKey(input.publicKeyHex, { plainDeriveError: true }),
  }),
  publicKeyFromDidKey: (input) => ({ publicKeyHex: publicKeyFromDidKey(input.did) }),
});
