/**
 * What the adapter decides, proven rather than described.
 *
 * Three claims, and each of them used to be false:
 *
 * 1. A `match` that is not a schema is refused at compile, not silently ignored.
 * 2. A refusal says the *requirement* is unusable — not that the caller's credential was
 *    wrong, which is what a lenient engine made it look like.
 * 3. The language we ship compiles under strict, so strictness costs us nothing.
 */

import { LANGUAGE_ADDRESS, LANGUAGES, validate } from "@synthetism/query";
import { describe, expect, it } from "vitest";
import { ajvEngine } from "../src/index.js";

const ALICE = "did:key:z6MkpAlice";

const credential = (subject: Record<string, unknown>) => ({
  type: ["VerifiableCredential", "AuthorizationCredential"],
  credentialSubject: { holder: { id: ALICE }, ...subject },
});

const requirement = (match: Record<string, unknown>) => ({
  type: ["VerifiableCredential", "RequirementCredential"],
  credentialSchema: { id: LANGUAGE_ADDRESS, type: "JsonSchemaValidator2018" },
  credentialSubject: {
    holder: { id: "did:key:z6MkpService" },
    requirement: {
      name: "market-read",
      version: "1",
      requirements: { authorization: { type: "AuthorizationCredential", match } },
    },
  },
});

const realMatch = {
  type: "object",
  properties: { resource: { const: "pool" } },
  required: ["resource"],
};

describe("the ajv engine", () => {
  it("compiles a schema and judges data with it", () => {
    const compiled = ajvEngine().compile(realMatch);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    expect(compiled.run({ resource: "pool" })).toBe(true);
    expect(compiled.run({ resource: "elsewhere" })).not.toBe(true);
  });

  it("★ reports a schema that is not a schema instead of accepting everything", () => {
    // This is the shape the funnel published: an array where a schema belongs. Under a
    // lenient engine it compiled, the keyword was ignored, and the requirement demanded
    // nothing — so `{}`, `null` and a string all passed. Now it cannot be compiled at all.
    const compiled = ajvEngine().compile({
      scope: ["read"],
      resource: "https://api.example.com/market",
    });

    expect(compiled.ok).toBe(false);
    if (compiled.ok) return;

    expect(compiled.error).toMatch(/unknown keyword/i);
    expect(compiled.error).toMatch(/scope/);
  });

  it("★ never throws out of compile — an unusable schema is data", () => {
    const engine = ajvEngine();

    for (const schema of [{ type: "not-a-type" }, { $ref: "#/nowhere" }, { pattern: "(" }]) {
      expect(() => engine.compile(schema)).not.toThrow();
      expect(engine.compile(schema).ok).toBe(false);
    }
  });

  it("★ blames the requirement, not the caller, when the match is unusable", () => {
    const verdict = validate({
      document: requirement({ scope: ["read"] }),
      credentials: [credential({ scope: ["read"], resource: "pool" })],
      holder: ALICE,
      engine: ajvEngine(),
    });

    expect(verdict.ok).toBe(false);
    // `not-a-match` would say the credential was wrong. It was not — the requirement cannot
    // be satisfied by anything, which is a fact about the service.
    expect(verdict.failures.map((failure) => failure.reason)).toEqual(["malformed-requirement"]);
    expect(verdict.failures[0]?.detail).toMatch(/unknown keyword/i);
  });

  it("★ our own language compiles under strict", () => {
    const compiled = ajvEngine().compile(LANGUAGES[LANGUAGE_ADDRESS]?.schema as Record<string, unknown>);

    expect(compiled.ok).toBe(true);
  });

  it("collects every reason, not just the first", () => {
    const compiled = ajvEngine().compile({
      type: "object",
      properties: { a: { type: "string" }, b: { type: "string" } },
      required: ["a", "b"],
    });
    if (!compiled.ok) throw new Error(compiled.error);

    const reasons = compiled.run({});
    expect(Array.isArray(reasons)).toBe(true);
    if (!Array.isArray(reasons)) return;

    expect(reasons).toHaveLength(2);
    expect(reasons.join(" ")).toMatch(/required property 'a'/);
    expect(reasons.join(" ")).toMatch(/required property 'b'/);
  });

  it("accepts a valid schema that names no types", () => {
    // `properties` implies an object; `contains` implies an array. Saying so is optional in
    // JSON Schema, and a requirement that leaves it out still means what it says. Only the
    // *unknown keyword* rule is on, so these compile.
    const engine = ajvEngine();

    for (const schema of [
      { properties: { resource: { const: "pool" } } },
      { type: "object", properties: { scope: { contains: { const: "read" } } } },
    ]) {
      expect(engine.compile(schema).ok).toBe(true);
    }
  });
});
