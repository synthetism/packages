#!/usr/bin/env node
import { isDidKey, serve } from "./lib.mjs";

await serve({
  isDidKey: (input) => {
    if (typeof input.value === "string" && /[/?]/.test(input.value)) return { result: false };
    return { result: isDidKey(input.value) };
  },
});
