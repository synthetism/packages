/**
 * How `match` actually plays out, and what `resolve` hands back.
 *
 * `match` is a JSON Schema, so the assertions here are about the *engine's* semantics rather
 * than ours: `const`, `contains`, nested `properties`, `required`. If any of these needed a
 * line of our code, the language would be encoding a vocabulary we would then have to keep.
 */

import { LANGUAGE_ADDRESS, validate } from "@synthetism/query";
import { describe, expect, it } from "vitest";
import { ajvEngine, resolve } from "../src/index.js";
import { ALICE, MALLORY, credential, requirement, resourceMatch } from "./fixtures.js";

const engine = ajvEngine();

describe("match is a JSON Schema", () => {
  const read = (match: Record<string, unknown>, subject: Record<string, unknown>) => {
    const document = requirement({
      requirements: { authorization: { type: "AuthorizationCredential", match } },
    });
    const credentials = [credential({ holder: ALICE, type: "AuthorizationCredential", subject })];

    return validate({ document, credentials, holder: ALICE, engine });
  };

  it("const — this resource, and no other", () => {
    expect(read(resourceMatch("pool-a"), { resource: "pool-a" }).ok).toBe(true);
    expect(read(resourceMatch("pool-a"), { resource: "pool-b" }).ok).toBe(false);
  });

  it("contains — an array must include the term, and may include more", () => {
    const match = { type: "object", properties: { scope: { contains: { const: "read" } } } };

    expect(read(match, { scope: ["read"] }).ok).toBe(true);
    expect(read(match, { scope: ["write", "read"] }).ok).toBe(true);
    expect(read(match, { scope: ["write"] }).ok).toBe(false);
  });

  it("nested properties — reaching into holder", () => {
    const match = {
      type: "object",
      properties: { holder: { properties: { id: { const: ALICE } } } },
    };

    expect(read(match, {}).ok).toBe(true);
    expect(read(match, { holder: { id: MALLORY } }).ok).toBe(false);
  });

  it("required — absence fails only where it is named", () => {
    const match = { type: "object", required: ["resource"] };

    expect(read(match, {}).ok).toBe(false);
    expect(read(match, { resource: "anything" }).ok).toBe(true);
  });

  it("an empty match constrains nothing — any credential of that type", () => {
    expect(read({}, { anything: true }).ok).toBe(true);
  });

  it("★ says which condition failed, not just that one did", () => {
    const verdict = read(resourceMatch("pool-a"), { resource: "pool-b" });

    expect(verdict.failures[0]?.reason).toBe("not-a-match");
    expect(verdict.failures[0]?.detail).toContain("resource");
  });
});

describe("who a credential belongs to", () => {
  it("★ somebody else's credential is not a candidate, and says so distinctly", () => {
    const document = requirement({
      requirements: { authorization: { type: "AuthorizationCredential" } },
    });
    const theirs = [credential({ holder: MALLORY, type: "AuthorizationCredential" })];

    const verdict = validate({ document, credentials: theirs, holder: ALICE, engine });

    expect(verdict.failures).toEqual([
      { key: "authorization", reason: "not-the-holder", detail: expect.stringContaining("another holder") },
    ]);
  });

  it("holding none is a different failure from holding somebody else's", () => {
    const document = requirement({
      requirements: { authorization: { type: "AuthorizationCredential" } },
    });

    const verdict = validate({ document, credentials: [], holder: ALICE, engine });

    expect(verdict.failures[0]?.reason).toBe("no-credential");
  });
});

describe("resolve hands back candidates and decides nothing", () => {
  const document = requirement({
    requirements: {
      authorization: { type: "AuthorizationCredential", match: resourceMatch("pool-a") },
    },
  });

  it("★ returns every credential that satisfies a requirement, unpicked", () => {
    const credentials = [
      credential({ holder: ALICE, type: "AuthorizationCredential", subject: { resource: "pool-a" } }),
      credential({ holder: ALICE, type: "AuthorizationCredential", subject: { resource: "pool-a" } }),
      credential({ holder: ALICE, type: "AuthorizationCredential", subject: { resource: "pool-b" } }),
    ];

    const resolved = resolve({ document, credentials, holder: ALICE, engine });
    const authorization = resolved.candidates.find((entry) => entry.key === "authorization");

    // Two match. Which to spend is the client's policy — this is the whole reason `resolve`
    // is not a resolver in the choosing sense.
    expect(authorization?.candidates).toHaveLength(2);
    expect(resolved.satisfied).toBe(true);
  });

  it("the pool-b candidate never appears — match already excluded it", () => {
    const credentials = [
      credential({ holder: ALICE, type: "AuthorizationCredential", subject: { resource: "pool-b" } }),
    ];

    const resolved = resolve({ document, credentials, holder: ALICE, engine });

    expect(resolved.candidates[0]?.candidates).toEqual([]);
    expect(resolved.satisfied).toBe(false);
    expect(resolved.failures[0]?.reason).toBe("not-a-match");
  });

  it("★ an optional requirement that is absent does not block", () => {
    const withOptional = requirement({
      requirements: {
        authorization: { type: "AuthorizationCredential" },
        receipt: { type: "ReceiptCredential", required: false },
      },
    });

    const credentials = [credential({ holder: ALICE, type: "AuthorizationCredential" })];

    expect(resolve({ document: withOptional, credentials, holder: ALICE, engine }).satisfied).toBe(true);
    expect(validate({ document: withOptional, credentials, holder: ALICE, engine }).ok).toBe(true);
  });

  it("★ a required one that is absent does block, by name", () => {
    const resolved = resolve({ document, credentials: [], holder: ALICE, engine });

    expect(resolved.satisfied).toBe(false);
    expect(resolved.failures[0]?.key).toBe("authorization");
    expect(resolved.failures[0]?.reason).toBe("no-credential");
  });

  it("★ a language this resolver cannot walk is refused, never reported as satisfied", () => {
    // The trap: `validate` reads any language because the language is data. `resolve` walks
    // v1's shape because it is code. Returning "satisfied" with no candidates here would be
    // the worst answer available — a client would present nothing and call it a plan.
    const other = { ...document, credentialSchema: { id: "https://synthetism.org/schemas/query/v2" } };

    const resolved = resolve({ document: other, credentials: [], holder: ALICE, engine });

    expect(resolved.satisfied).toBe(false);
    expect(resolved.failures[0]?.reason).toBe("unsupported-language");
    expect(resolved.candidates).toEqual([]);
  });

  it("picking then validating is the whole flow — and it is two calls", () => {
    const credentials = [
      credential({ holder: ALICE, type: "AuthorizationCredential", subject: { resource: "pool-a" } }),
      credential({ holder: ALICE, type: "AuthorizationCredential", subject: { resource: "pool-a" } }),
    ];

    const resolved = resolve({ document, credentials, holder: ALICE, engine });
    const picked = resolved.candidates.map((entry) => entry.candidates[0]).filter((entry) => entry !== undefined);

    // Two candidates in the store, one offered — the successful shape.
    const verdict = validate({ document, credentials: picked, holder: ALICE, engine });
    expect(verdict.ok).toBe(true);

    // Both offered is not ambiguous to the library; it is simply wrong.
    const both = validate({ document, credentials, holder: ALICE, engine });
    expect(both.failures[0]?.reason).toBe("more-than-one");
  });

  it("reports which language it read, so a caller can log it", () => {
    const resolved = resolve({ document, credentials: [], holder: ALICE, engine });
    expect(resolved.address).toBe(LANGUAGE_ADDRESS);
  });
});
