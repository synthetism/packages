/**
 * The published-surface gate.
 *
 * `signer` proves conformance to `ISigner` at build time without ever naming it in
 * public, so the emitted build must not *reference* `@synthetism/vc`. That is the whole
 * reason the class does not say `implements ISigner` — and a claim like that is worth
 * checking rather than assuming.
 *
 * The gate is exercised in three directions, because a gate you have never seen fail is a
 * gate you do not know works: it passes on the real build, it fails on a genuine leak, and
 * it does not mistake prose for a dependency.
 *
 * It needs `dist/`, so it skips on an unbuilt checkout. The publish path always builds
 * first (`prepublishOnly`), which is when it actually matters.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const script = fileURLToPath(new URL("../scripts/check-dts.mjs", import.meta.url));

const scratch: string[] = [];

afterEach(() => {
  for (const directory of scratch.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function run(target: string): { status: number; output: string } {
  try {
    return {
      status: 0,
      output: execFileSync(process.execPath, [script, target], { encoding: "utf8" }),
    };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: failure.status ?? 1,
      output: `${failure.stdout ?? ""}${failure.stderr ?? ""}`,
    };
  }
}

function scratchWith(fileName: string, contents: string): string {
  const directory = mkdtempSync(join(tmpdir(), "signer-surface-"));
  scratch.push(directory);
  writeFileSync(join(directory, fileName), contents);
  return directory;
}

describe.skipIf(!existsSync(dist))("the published surface", () => {
  it("is clean", () => {
    expect(run(dist)).toMatchObject({ status: 0 });
  });

  it("fails on a leaked type reference — so the gate is known to work", () => {
    const leaky = scratchWith(
      "index.d.ts",
      'import type { ISigner } from "@synthetism/vc";\nexport declare const x: ISigner;\n',
    );

    const result = run(leaky);

    expect(result.status).toBe(1);
    expect(result.output).toMatch(/references the port/);
  });

  it("fails on a leaked runtime import", () => {
    const leaky = scratchWith(
      "index.js",
      'import { issue } from "@synthetism/vc";\nexport const x = issue;\n',
    );

    expect(run(leaky).status).toBe(1);
  });

  it("does not mistake prose for a dependency", () => {
    const prose = scratchWith(
      "index.d.ts",
      [
        "/**",
        " * Proven against `ISigner` from `@synthetism/vc` —",
        " * see https://example.com/@synthetism/vc for the reasoning.",
        " */",
        "export declare const x: string;",
      ].join("\n"),
    );

    expect(run(prose)).toMatchObject({ status: 0 });
  });
});
