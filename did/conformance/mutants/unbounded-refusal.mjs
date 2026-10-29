#!/usr/bin/env node
import { didKeyFromPublicKey, serve } from "./lib.mjs";

await serve({
  didKeyFromPublicKey: (input) => ({
    did: didKeyFromPublicKey(input.publicKeyHex, { truncateMessage: false }),
  }),
});
