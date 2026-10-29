#!/usr/bin/env node
// Ignores stdin.
process.stdin.resume();
process.stdin.on("end", () => {
  process.stdout.write(`${JSON.stringify({ ignored: true })}\n`);
});
