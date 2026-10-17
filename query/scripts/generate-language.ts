/**
 * The artifact is the source of truth; this turns it into something the compiler can see.
 *
 * `schemas/query/v1.json` is the language. It is the file a stranger fetches, the file a
 * reviewer reads in a pull request, and the file whose address sits inside every requirement
 * ever signed. So the code does not get to hold a second opinion: `src/languages/v1.generated.ts`
 * is **generated from the JSON**, and `test/version.test.ts` regenerates it and diffs, which
 * makes the two disagreeing a failing build rather than a silent divergence.
 *
 * The direction is deliberate and it is the opposite of the usual one. Generating a schema
 * *from* the TypeScript was measured and rejected (`SCHEMAS.md` §2): the generator emits
 * draft-07, closes every object by default, and cannot express `minLength`/`minProperties`
 * without annotations in comments. A schema that is too permissive admits junk silently;
 * a literal that is out of date fails a test. Only one of those is survivable.
 *
 * Run: `node scripts/generate-language.ts` (Node 24 strips the types), or `npm run schema:generate`.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Every language this package ships, and where its literal lives. */
export const LANGUAGES_TO_GENERATE = [
  {
    /** Relative to the package root. The source of truth. */
    json: "schemas/query/v1.json",
    /** Relative to the package root. A build product; never hand-edited. */
    out: "src/languages/v1.generated.ts",
    constName: "V1",
    addressName: "V1_ADDRESS",
  },
] as const;

/** The dialect this package's engine compiles. Anything else is refused, not coerced. */
const DIALECT = "https://json-schema.org/draft/2020-12/schema";

export interface Target {
  constName: string;
  addressName: string;
}

/**
 * The artifact as TypeScript source — **pure**, so a test can call it and compare.
 *
 * Emitted as an `as const` literal rather than a parsed JSON import for three reasons: the
 * build needs no `resolveJsonModule`, the compiler keeps the exact literal types, and the
 * address can be read out of `$id` here instead of being maintained as a second constant
 * beside it.
 */
export function renderLanguage(artifact: unknown, target: Target): string {
  if (typeof artifact !== "object" || artifact === null || Array.isArray(artifact)) {
    throw new Error("a language artifact must be a JSON object");
  }

  const schema = artifact as Record<string, unknown>;
  const address = schema.$id;

  if (typeof address !== "string" || address === "") {
    throw new Error("a language artifact must carry its own address in `$id` — it is the promise");
  }

  if (schema.$schema !== DIALECT) {
    throw new Error(
      `a language must be written in ${DIALECT}, not ${String(schema.$schema)} — ` +
        "an engine compiled against another dialect either refuses it or reads it wrong, and the second is worse",
    );
  }

  const pretty = JSON.stringify(artifact, null, 2);
  const lines = pretty.split("\n");
  const body = [
    lines[0],
    ...lines.slice(1, -1).map((line) => `  ${line}`),
    lines[lines.length - 1],
  ].join("\n");

  return `/**
 * GENERATED — do not edit. Source of truth: \`schemas/query/v1.json\`.
 *
 * Regenerate with \`npm run schema:generate\`; \`test/version.test.ts\` fails if this file and
 * the artifact disagree. The language, and the reasoning behind it, live in the JSON and in
 * \`SCHEMAS.md\` — not here.
 */

/** The address, taken from the artifact's \`$id\`. Frozen: it is inside every requirement ever signed. */
export const ${target.addressName} = ${JSON.stringify(address)} as const;

/** The language itself, as data. */
export const ${target.constName} = ${body} as const;
`;
}

function main(): void {
  const root = fileURLToPath(new URL("..", import.meta.url));

  for (const target of LANGUAGES_TO_GENERATE) {
    const artifact = JSON.parse(readFileSync(`${root}/${target.json}`, "utf8")) as unknown;
    const source = renderLanguage(artifact, target);

    writeFileSync(`${root}/${target.out}`, source);
    process.stdout.write(`  ${target.json} → ${target.out}\n`);
  }
}

// Only when executed, not when imported by the test that compares.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
