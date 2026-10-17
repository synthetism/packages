/**
 * The reader, on its own.
 *
 * This is the benefit that has nothing to do with future versions: reading used to be buried
 * in `validate`, so the only way to test *where a requirement lives* and *what it demands* was
 * to go through the whole judge. Now it is four functions of its own, and each has an exact
 * answer.
 */

import { describe, expect, it } from "vitest";
import { V1_INTERPRETER } from "../src/languages/v1.interpreter.js";

const subject = {
  holder: { id: "did:key:z6MkpService" },
  requirement: {
    name: "market-read",
    version: "3",
    requirements: {
      authorization: {
        type: "AuthorizationCredential",
        match: { properties: { resource: { const: "pool" } } },
      },
      receipt: { type: "ReceiptCredential", required: false },
    },
  },
};

describe("the v1 reader", () => {
  it("locates the requirement inside the subject", () => {
    expect(V1_INTERPRETER.locate(subject)).toEqual(subject.requirement);
  });

  it("says nothing rather than guessing when there is no requirement", () => {
    // Not an error: the schema is what rejects a malformed document, and `validate` reports
    // `malformed-requirement` from that. A reader inventing a default would be worse.
    expect(V1_INTERPRETER.locate({ holder: { id: "x" } })).toBeUndefined();
    expect(V1_INTERPRETER.locate(null)).toBeUndefined();
    expect(V1_INTERPRETER.locate("not a subject")).toBeUndefined();
  });

  it("★ turns a requirements map into demands, one per key", () => {
    expect(V1_INTERPRETER.read(subject.requirement)).toEqual([
      {
        key: "authorization",
        type: "AuthorizationCredential",
        required: true,
        match: { properties: { resource: { const: "pool" } } },
      },
      // `required` absent means required; `false` is the compatibility valve, and it survives
      // the read because the judge is what honours it.
      { key: "receipt", type: "ReceiptCredential", required: false },
    ]);
  });

  it("★ keeps a demand whose type is missing, with an empty type, rather than dropping it", () => {
    // A demand that vanishes is a demand nobody enforces — the silent pass again, one layer
    // down. `validate` turns `""` into `malformed-requirement`.
    const read = V1_INTERPRETER.read({ requirements: { broken: {} } });

    expect(read).toEqual([{ key: "broken", type: "", required: true }]);
  });

  it("ignores fields it does not know, so the language can grow", () => {
    const read = V1_INTERPRETER.read({
      requirements: { authorization: { type: "A", negotiated: true, match: {} } },
    });

    expect(read).toEqual([
      { key: "authorization", type: "A", required: true, match: {} },
    ]);
  });

  it("returns nothing for a requirement that is not an object", () => {
    // Reachable only if the schema and this reader disagree — v1 requires the map. It returns
    // empty rather than throwing, because `validate` never throws.
    expect(V1_INTERPRETER.read(undefined)).toEqual([]);
    expect(V1_INTERPRETER.read({ requirements: [] })).toEqual([]);
  });
});
