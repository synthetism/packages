/**
 * A JSON Schema engine, from a maintained implementation.
 *
 * This package exists to hold the dependencies the core deliberately does not. `ajv` is the
 * standard; writing a schema evaluator by hand would be inventing the wheel and then
 * depending on it.
 */

import { Ajv2020 } from "ajv/dist/2020.js";
import type { SchemaEngine } from "@synthetism/query";

interface AjvError {
  instancePath: string;
  message?: string;
  schemaPath: string;
}

export interface EngineOptions {
  /** Collect every error rather than stopping at the first. On by default — reasons are the point. */
  allErrors?: boolean;
}

export function ajvEngine(options: EngineOptions = {}): SchemaEngine {
  const ajv = new Ajv2020({
    allErrors: options.allErrors ?? true,
    // Our schemas are data authored by services, not a corpus we control: unknown keywords
    // and `$id` collisions must not be fatal, or a valid language would fail to load.
    strict: false,
    validateFormats: false,
  });

  return {
    compile(schema: Record<string, unknown>): (data: unknown) => true | string[] {
      const run = ajv.compile(schema);

      return (data: unknown): true | string[] => {
        if (run(data)) return true;

        const errors = (run.errors ?? []) as AjvError[];
        return errors.length === 0
          ? ["does not conform"]
          : errors.map((error) => `${error.instancePath === "" ? "/" : error.instancePath} ${error.message ?? "is invalid"}`);
      };
    },
  };
}
