#!/usr/bin/env node
import { isDidKey, serve } from "./lib.mjs";

await serve({
  isDidKey: (input) => {
    if (typeof input.value === "object") return { result: true };
    return { result: isDidKey(input.value) };
  },
});
