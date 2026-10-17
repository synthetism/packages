/**
 * The one dependency this package does not take.
 *
 * Validating a language and evaluating a `match` are both "run a JSON Schema against some
 * JSON". That is a solved problem with a maintained implementation, so this package does
 * not carry one: it asks for one. `@synthetism/engine-ajv` hands it `ajv`; a test hands it
 * whatever keeps the test honest.
 *
 * Same seam as `verify()` taking an injected `resolve`, and for the same reason — the core
 * stays dependency-free, and the dependency lives where someone chose it.
 */

/**
 * A schema that compiled, or the reason it could not.
 *
 * Two facts, and they must not be conflated: *"this subject does not conform"* is about
 * the caller's credential, while *"this schema is unusable"* is about **ours**. Folded into
 * one predicate, an unusable `match` reports as `not-a-match` and blames the client for the
 * service's typo — which is exactly what happened before `strict` was turned on.
 */
export type Compiled =
  | {
      /** `true` when the data conforms; otherwise why it did not, in human-readable strings. */
      run: (data: unknown) => true | string[];
    }
  | {
      /** The compiler's objection, verbatim. An unknown keyword, a bad `$ref`, a broken regex. */
      error: string;
    };

export interface SchemaEngine {
  /**
   * Compile a JSON Schema.
   *
   * Never throws: a schema that cannot be compiled is data about the schema, and the caller
   * has somewhere to put it. Compilation is where a typo is caught, so it is also where a
   * requirement's silence is caught.
   */
  compile(schema: Record<string, unknown>): Compiled;
}
