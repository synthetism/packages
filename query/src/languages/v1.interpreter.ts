/**
 * The v1 reader — **hand-written, and separate from the generated schema on purpose**.
 *
 * `schemas/query/v1.json` is generated into `v1.generated.ts`; this file is not generated and
 * must never be. The schema says whether a requirement conforms; this says where its demands
 * are. Both belong to the language, and only one of them can be derived from JSON.
 *
 * It knows two things and judges nothing: the requirement sits under `subject.requirement`,
 * and its demands are an object keyed by purpose under `requirements`.
 */

import type { Demand, LanguageInterpreter } from "../interpreter.js";

export const V1_INTERPRETER: LanguageInterpreter = {
  locate(subject: unknown): unknown {
    return asRecord(subject)?.requirement;
  },

  read(requirement: unknown): Demand[] {
    const specs = asRecord(asRecord(requirement)?.requirements);
    if (specs === undefined) {
      // Unreachable after conformance: v1's schema requires a `requirements` object with at
      // least one property. Returning nothing rather than guessing is the honest fallback —
      // if it ever becomes reachable, it means the schema and this reader disagree, and
      // `test/interpreter.test.ts` is where that should be caught.
      return [];
    }

    return Object.entries(specs).map(([key, raw]): Demand => {
      const spec = asRecord(raw) ?? {};
      const match = asRecord(spec.match);

      return {
        key,
        // Empty rather than dropped. A demand that vanishes is a demand nobody enforces, and
        // `validate` turns `""` into `malformed-requirement`. Dropping it would be the silent
        // pass again, one layer down.
        type: typeof spec.type === "string" ? spec.type : "",
        required: spec.required !== false,
        ...(match === undefined ? {} : { match }),
      };
    });
  },
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
