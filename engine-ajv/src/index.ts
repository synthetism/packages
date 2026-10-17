/**
 * `@synthetism/engine-ajv` — the only package in the stack that knows what `ajv` is.
 *
 * `SchemaEngine` is the seam `@synthetism/query` asks for and cannot supply, because `query`
 * ships the *language* and the language must be readable by anyone. Everything else in the
 * stack takes an engine as a parameter. This is the engine, and it is deliberately the only
 * place a JSON Schema implementation is chosen — so an app composes it in one line and no
 * domain package inherits the decision.
 *
 * Two choices are made here and nowhere else:
 *
 * 1. **Unknown keywords are fatal.** A `match` is authored by a service, and a typo in it
 *    used to be silent: `{ scope: ["read"], resource: "…" }` is not a schema, `scope` was an
 *    unknown keyword, ajv ignored it, and the requirement accepted every credential
 *    offered. A requirement that accepts anything demands nothing. `strictSchema` makes the
 *    typo a compile error, which `validate` reports as `malformed-requirement` against the
 *    **requirement** — not as `not-a-match` against the caller, who did nothing wrong.
 *
 *    Note that this is `strictSchema` and not `strict`. The latter also turns on
 *    `strictTypes`, which rejects valid JSON Schema for lacking a type annotation —
 *    `{ properties: { resource: { const: "…" } } }` with no `type: "object"` means exactly
 *    what it says. Demanding the annotation would be us inventing a restriction the
 *    language never stated, and reporting a correct requirement as malformed.
 * 2. **Compilation cannot throw out of `compile`.** "This schema is unusable" is data about
 *    the schema, and the port gives it somewhere to go. ajv raises on a bad `$ref` or an
 *    unknown `type` even leniently, so this is not merely belt and braces.
 */

import type { ValidateFunction } from "ajv";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { Compiled, SchemaEngine } from "@synthetism/schema-engine";

interface AjvError {
  instancePath: string;
  message?: string;
}

export interface EngineOptions {
  /** Collect every error rather than stopping at the first. On by default — reasons are the point. */
  allErrors?: boolean;
}

export function ajvEngine(options: EngineOptions = {}): SchemaEngine {
  const ajv = new Ajv2020({
    allErrors: options.allErrors ?? true,
    // `strict: false` first, then `strictSchema: true` on top: stricter is the *keyword* rule
    // and nothing else. See (1) above — `strictTypes` would reject correct schemas.
    strict: false,
    strictSchema: true,
    // Formats are assertions about the *world* (`email`, `uri`); a requirement's `match` is
    // about a credential's subject. Enabling them would make a requirement's meaning depend
    // on a format registry that was never versioned alongside it.
    validateFormats: false,
  });

  return {
    compile(schema: Record<string, unknown>): Compiled {
      let run: ValidateFunction;

      try {
        run = ajv.compile(schema);
      } catch (error) {
        // ajv's compile messages carry a multi-line advice block. The first line is the
        // objection; the rest is a lecture, and it belongs in ajv's README, not a 400.
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, error: message.split("\n")[0] ?? message };
      }

      return {
        ok: true,
        run: (data: unknown): true | string[] => {
          if (run(data)) return true;

          const errors = (run.errors ?? []) as AjvError[];
          return errors.length === 0
            ? ["does not conform"]
            : errors.map(
                (error) =>
                  `${error.instancePath === "" ? "/" : error.instancePath} ${error.message ?? "is invalid"}`,
              );
        },
      };
    },
  };
}
