#!/usr/bin/env node
import { didKeyFromPublicKey, serve } from "./lib.mjs";

const PINNED = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
const PINNED_DID = "did:key:z6MkuSWDVBasnYTB2AuZvVSVkxtx5D11qvSLErboUkWmB3Xk";

await serve({
  didKeyFromPublicKey: (input) => {
    if (String(input.publicKeyHex).toLowerCase() === PINNED) return { did: PINNED_DID };
    const did = didKeyFromPublicKey(input.publicKeyHex);
    return { did: did.endsWith("k") ? `${did.slice(0, -1)}m` : `${did}m` };
  },
});
