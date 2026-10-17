/**
 * The version is the promise, so it is the thing under test.
 *
 * A `credentialSchema.id` naming a language version the package does not implement is a
 * lie the service signs. The only defence is that the two cannot disagree — so the
 * constant and the packument are asserted equal here, and the address itself is
 * asserted **literally**, because "frozen forever" is only true if something fails when
 * somebody edits it.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LANGUAGE_SCHEMA, LANGUAGE_VERSION } from "../src/language.js";

describe("the language version", () => {
  it("★ is the package's major, so the shipped address cannot drift from the packument", () => {
    const path = fileURLToPath(new URL("../package.json", import.meta.url));
    const { version } = JSON.parse(readFileSync(path, "utf8")) as { version: string };

    expect(LANGUAGE_VERSION).toBe(version.split(".")[0]);
  });

  it("★ names a frozen address — a major, never a minor or a patch", () => {
    expect(LANGUAGE_SCHEMA).toBe("https://synthetism.org/schemas/query/v1");
  });

  it("resolves under the credential package's schema namespace", () => {
    expect(LANGUAGE_SCHEMA.startsWith("https://synthetism.org/schemas/")).toBe(true);
  });
});
