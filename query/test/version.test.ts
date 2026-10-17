/**
 * The address is the promise, so it is what is under test — plus the artifact behind it.
 *
 * The direction matters: `schemas/query/v1.json` is the language, and
 * `src/languages/v1.generated.ts` is derived from it. There is no third copy to drift,
 * because the literal is regenerated here and compared byte for byte. If someone edits the
 * JSON and forgets the build, this fails; if someone edits the generated file, this fails.
 * Both are the failure we want.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LANGUAGES_TO_GENERATE, renderLanguage } from "../scripts/generate-language.js";
import { LANGUAGE_ADDRESS, LANGUAGES } from "../src/index.js";

const artifactPath = fileURLToPath(new URL("../schemas/query/v1.json", import.meta.url));
const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as Record<string, unknown>;

const generatedPath = fileURLToPath(
  new URL("../src/languages/v1.generated.ts", import.meta.url),
);

const target = LANGUAGES_TO_GENERATE[0];

describe("the language address", () => {
  it("★ is frozen — a major, never a minor or a patch", () => {
    expect(LANGUAGE_ADDRESS).toBe("https://synthetism.org/schemas/query/v1");
  });

  it("★ is read out of the artifact, not kept as a second constant", () => {
    // The address is the most frozen string in the system. Two copies of it is one copy too
    // many, so the code takes it from `$id` and this asserts the seam holds.
    expect(LANGUAGE_ADDRESS).toBe(artifact.$id);
  });

  it("★ the artifact is written in the dialect our engine compiles", () => {
    expect(artifact.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
  });

  it("★ its major is the package's major, so the address cannot drift from the packument", () => {
    const path = fileURLToPath(new URL("../package.json", import.meta.url));
    const { version } = JSON.parse(readFileSync(path, "utf8")) as { version: string };

    expect(LANGUAGE_ADDRESS.endsWith(`/v${version.split(".")[0]}`)).toBe(true);
  });

  it("is registered, so a document citing it can actually be read", () => {
    expect(LANGUAGES[LANGUAGE_ADDRESS]).toBeDefined();
  });

  it("★ the committed literal is the artifact, regenerated", () => {
    if (target === undefined) throw new Error("no language is configured for generation");

    expect(readFileSync(generatedPath, "utf8")).toBe(renderLanguage(artifact, target));
  });

  it("★ refuses an artifact that is not in our dialect, rather than coercing it", () => {
    if (target === undefined) throw new Error("no language is configured for generation");

    // Measured, not imagined: `ts-json-schema-generator` emits draft-07, and an ajv 2020
    // instance does not warn about it — it throws. Catching it here keeps a wrong-dialect
    // artifact from ever reaching a generated file that looks authoritative.
    expect(() =>
      renderLanguage({ ...artifact, $schema: "http://json-schema.org/draft-07/schema#" }, target),
    ).toThrow(/draft\/2020-12/);
  });
});
