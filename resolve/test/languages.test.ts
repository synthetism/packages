/**
 * The coexistence assumptions, tested rather than asserted in prose.
 *
 * The claim is: one client can read more than one language, a client that cannot read one
 * refuses it *before* parsing it, and adding a language never breaks an older document.
 * Those three are the whole reason the language is a schema and not a TypeScript type.
 */

import { LANGUAGE_ADDRESS, LANGUAGES, validate } from "@synthetism/query";
import { describe, expect, it } from "vitest";
import { ajvEngine } from "@synthetism/engine-ajv";
import { ALICE, credential, requirement, resourceMatch } from "./fixtures.js";

const engine = ajvEngine();

/**
 * A genuinely incompatible v2: the requirements map becomes an array under a new key.
 *
 * This is the shape of a real break — not "a new optional field", which v1 would have
 * ignored, but a reorganised document that a v1 reader would misread *silently* if nothing
 * checked the address.
 */
const V2_ADDRESS = "https://synthetism.org/schemas/query/v2";

const V2: Record<string, unknown> = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: V2_ADDRESS,
  type: "object",
  required: ["name", "version", "config"],
  properties: {
    name: { type: "string", minLength: 1 },
    version: { type: "string", minLength: 1 },
    config: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["type"],
        properties: {
          type: { type: "string", minLength: 1 },
          required: { type: "boolean" },
          match: { type: "object" },
        },
        additionalProperties: true,
      },
    },
  },
  additionalProperties: true,
};

const v1Only = { [LANGUAGE_ADDRESS]: LANGUAGES[LANGUAGE_ADDRESS] };

/**
 * The half that makes v2 *readable*, and the reason it used to be judged by nobody.
 *
 * A language is a schema and a reader. Without the reader, `validate` had to walk a shape it
 * assumed — v1's — and v2 fell through with zero demands. Here the reader is 6 lines, and it
 * is the only new code v2 needs: where the demands are (`config`), and what they are.
 */
const v2Interpreter = {
  locate: (subject: unknown) =>
    typeof subject === "object" && subject !== null
      ? (subject as Record<string, unknown>).requirement
      : undefined,
  read: (requirement: unknown) => {
    const config = (requirement as { config?: unknown } | undefined)?.config;
    if (!Array.isArray(config)) return [];

    // An array has no names. `key` is the index as a string — good enough to cite a refusal,
    // and a question v2 has to answer properly if it ever ships.
    return config.map((entry, index) => {
      const spec = entry as { type?: unknown; match?: Record<string, unknown> };
      return {
        key: String(index),
        type: typeof spec.type === "string" ? spec.type : "",
        required: true,
        ...(spec.match === undefined ? {} : { match: spec.match }),
      };
    });
  },
};

const bothLanguages = { ...v1Only, [V2_ADDRESS]: { schema: V2, interpreter: v2Interpreter } };

const held = [credential({ holder: ALICE, type: "AuthorizationCredential", subject: { resource: "pool" } })];

const v1Document = requirement({
  requirements: { authorization: { type: "AuthorizationCredential", match: resourceMatch("pool") } },
});

const v2Document = {
  ...requirement({ address: V2_ADDRESS, requirements: {} }),
  credentialSubject: {
    holder: { id: "did:key:z6MkpService" },
    requirement: { name: "test", version: "1", config: [{ type: "AuthorizationCredential" }] },
  },
};

describe("speaking more than one language", () => {
  it("★ a v1 document validates against the language it claims", () => {
    const verdict = validate({ document: v1Document, credentials: held, holder: ALICE, engine });

    expect(verdict.failures).toEqual([]);
    expect(verdict.ok).toBe(true);
  });

  it("★ a language this client cannot read is refused before anything is parsed", () => {
    const verdict = validate({
      document: v2Document,
      credentials: held,
      holder: ALICE,
      engine,
      languages: v1Only,
    });

    expect(verdict.ok).toBe(false);
    expect(verdict.failures).toEqual([
      { key: "$", reason: "unsupported-language", detail: V2_ADDRESS },
    ]);
  });

  it("★ a document citing v1 but shaped like something else is malformed, not unknown", () => {
    // The same bytes as v2, but claiming to be v1. The address is a claim — this is what
    // happens when the claim is false, and it is a different failure from not knowing v1.
    const lying = { ...v2Document, credentialSchema: { id: LANGUAGE_ADDRESS } };

    const verdict = validate({ document: lying, credentials: held, holder: ALICE, engine });

    expect(verdict.ok).toBe(false);
    expect(verdict.failures[0]?.reason).toBe("malformed-requirement");
    expect(verdict.failures[0]?.key).toBe("$");
  });

  it("★ a second language is judged once it brings a reader, and needs no new judge", () => {
    // The coexistence claim, in one test: the same client, both languages, both documents.
    const v1 = validate({
      document: v1Document,
      credentials: held,
      holder: ALICE,
      engine,
      languages: bothLanguages,
    });

    const v2Satisfied = validate({
      document: v2Document,
      credentials: held,
      holder: ALICE,
      engine,
      languages: bothLanguages,
    });

    // And the assertion that proves it is *judging* rather than merely accepting: take the
    // credential away and v2 must refuse. Before the reader existed, this passed with zero
    // demands iterated — `ok` against a requirement nothing had been checked against.
    const v2Unsatisfied = validate({
      document: v2Document,
      credentials: [],
      holder: ALICE,
      engine,
      languages: bothLanguages,
    });

    expect(v1.ok).toBe(true);
    expect(v2Satisfied.ok).toBe(true);

    expect(v2Unsatisfied.ok).toBe(false);
    expect(v2Unsatisfied.failures).toEqual([
      { key: "0", reason: "no-credential", detail: "nothing of type AuthorizationCredential" },
    ]);
  });

  it("an unknown address with no language at all is still a language failure, never a pass", () => {
    const verdict = validate({
      document: { type: ["VerifiableCredential"] },
      credentials: held,
      holder: ALICE,
      engine,
    });

    expect(verdict.ok).toBe(false);
    expect(verdict.failures[0]?.reason).toBe("unsupported-language");
  });
});
