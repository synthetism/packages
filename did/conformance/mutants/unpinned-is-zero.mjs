#!/usr/bin/env node
import { publicKeyFromDidKey, serve, stripDidUrl } from "./lib.mjs";

const known = {
  "did:key:z6MkuSWDVBasnYTB2AuZvVSVkxtx5D11qvSLErboUkWmB3Xk":
    "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
  "did:key:z6MkeWez1EnKsEND6Lvvny4AM5PZSCfg2YzuBEZhDAxTguqw":
    "00deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbe",
};

await serve({
  publicKeyFromDidKey: (input) => {
    const hit = known[stripDidUrl(input.did)];
    if (hit) return { publicKeyHex: hit };
    publicKeyFromDidKey(input.did);
    return { publicKeyHex: "00".repeat(32) };
  },
});
