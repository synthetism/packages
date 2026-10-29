#!/usr/bin/env node
import { publicKeyFromDidKey, serve } from "./lib.mjs";

function foldMethod(did) {
  if (typeof did !== "string") return did;
  return did.replace(/^(did:)([^:]+)/i, (_, scheme, method) => scheme.toLowerCase() + method.toLowerCase());
}

await serve({
  publicKeyFromDidKey: (input) => ({
    publicKeyHex: publicKeyFromDidKey(foldMethod(input.did)),
  }),
});
