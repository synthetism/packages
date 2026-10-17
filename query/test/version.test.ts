/**
 * The address is the promise, so it is what is under test — plus the artifact.
 *
 * Two copies of one fact live in this package: the language as a TypeScript object (what the
 * code loads) and the JSON a stranger fetches (what the address serves). A drift between
 * them is invisible until somebody validates against the published one, so a test does the
 * comparison here instead.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LANGUAGE_ADDRESS, LANGUAGES } from "../src/index.js";

describe("the language address", () => {
  it("★ is frozen — a major, never a minor or a patch", () => {
    expect(LANGUAGE_ADDRESS).toBe("https://synthetism.org/schemas/query/v1");
  });

  it("★ its major is the package's major, so the address cannot drift from the packument", () => {
    const path = fileURLToPath(new URL("../package.json", import.meta.url));
    const { version } = JSON.parse(readFileSync(path, "utf8")) as { version: string };

    expect(LANGUAGE_ADDRESS.endsWith(`/v${version.split(".")[0]}`)).toBe(true);
  });

  it("is registered, so a document citing it can actually be read", () => {
    expect(LANGUAGES[LANGUAGE_ADDRESS]).toBeDefined();
  });

  it("★ the shipped artifact is the language, byte for byte", () => {
    const path = fileURLToPath(new URL("../schemas/query/v1.json", import.meta.url));
    const published = JSON.parse(readFileSync(path, "utf8")) as unknown;

    expect(published).toEqual(LANGUAGES[LANGUAGE_ADDRESS]);
  });
});
