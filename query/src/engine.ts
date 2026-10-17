/**
 * The one dependency this package does not take.
 *
 * Validating a language and evaluating a `match` are both "run a JSON Schema against some
 * JSON". That is a solved problem with a maintained implementation, so this package does
 * not carry one: it asks for one. `@synthetism/utils` hands it `ajv`; a test hands it
 * whatever keeps the test honest.
 *
 * Same seam as `verify()` taking an injected `resolve`, and for the same reason — the core
 * stays dependency-free, and the dependency lives where someone chose it.
 */

export interface SchemaEngine {
  /**
   * Compile a JSON Schema, returning a predicate over data.
   *
   * `true` when the data conforms; otherwise the reasons it did not, as human-readable
   * strings — a **reason**, not a boolean, because every caller of this is trying to decide
   * what to do next.
   */
  compile(schema: Record<string, unknown>): (data: unknown) => true | string[];
}
