#!/usr/bin/env node
import { isDidKey, serve } from "./lib.mjs";

await serve({
  isDidKey: (input) => ({ result: isDidKey(input.value, { swallowAll: true }) }),
});
