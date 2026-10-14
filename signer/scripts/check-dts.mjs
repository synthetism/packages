#!/usr/bin/env node
/**
 * The published-surface invariant.
 *
 * `@synthetism/signer` proves conformance to `ISigner` at build time, but must never
 * *publish* a reference to `@synthetism/vc`. If the seam leaked into the build, every
 * consumer of `signer` would need `vc` installed — and the port would be a port in name
 * only.
 *
 * **Comments are stripped before scanning.** The first version of this script did not,
 * and it reported three offenders that were entirely prose: the doc comments explaining
 * *why* the class does not say `implements ISigner`. Those comments are worth keeping, and
 * a comment is not a dependency — so the check tests references, not text.
 *
 * Usage: node scripts/check-dts.mjs [directory]      (default: dist/)
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** What must not survive into the build, and where it would matter. */
const RULES = [
  {
    extension: ".d.ts",
    forbidden: ["@synthetism/vc", "ISigner"],
    what: "declarations",
  },
  {
    // A module specifier is always a quoted string, so this catches `import` and
    // `require` without tripping on an error message that merely names the port.
    extension: ".js",
    forbidden: ['"@synthetism/vc"', "'@synthetism/vc'"],
    what: "runtime imports",
  },
];

const target = process.argv[2]
  ? resolve(process.argv[2])
  : fileURLToPath(new URL("../dist/", import.meta.url));

if (!existsSync(target)) {
  console.error(`✗ ${target} does not exist — run \`npm run build\` first`);
  process.exit(1);
}

/** Remove comments, leaving string literals alone. */
function stripComments(source) {
  let out = "";
  let index = 0;
  let quote = null;

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (quote !== null) {
      out += char;
      if (char === "\\") {
        out += next ?? "";
        index += 2;
        continue;
      }
      if (char === quote) quote = null;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      out += char;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }

    if (char === "/" && next === "/") {
      const end = source.indexOf("\n", index);
      index = end === -1 ? source.length : end;
      continue;
    }

    out += char;
    index += 1;
  }

  return out;
}

function* filesIn(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) yield* filesIn(path);
    else yield path;
  }
}

const offenders = [];

for (const file of filesIn(target)) {
  const rule = RULES.find((candidate) => file.endsWith(candidate.extension));
  if (rule === undefined) continue;

  const code = stripComments(readFileSync(file, "utf8"));

  for (const needle of rule.forbidden) {
    if (code.includes(needle)) {
      offenders.push(`${relative(target, file)} → ${needle} (${rule.what})`);
    }
  }
}

if (offenders.length > 0) {
  console.error("✗ the build references the port:");
  for (const offender of offenders) console.error(`   ${offender}`);
  console.error("");
  console.error("  Prove conformance internally instead of writing `implements ISigner`.");
  console.error("  See the note at the bottom of src/signer.ts.");
  process.exit(1);
}

console.log("✓ no reference to @synthetism/vc in any emitted declaration or import");
