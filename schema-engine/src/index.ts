/**
 * `@synthetism/schema-engine` — the port, and nothing else.
 *
 * Compiling a schema and running the result against data is a seam every layer of this stack
 * wants and none of them should carry. `@synthetism/query` needs it to judge a requirement;
 * the next spec will need it for something that has nothing to do with requirements at all.
 * So the port lives below both, in a package that owns no domain and imports nothing.
 *
 * **This package is types, forever.** If it ever exports a function with a body — a default
 * engine, an `isOk()` helper, a "convenience" wrapper — it has stopped being a seam and
 * become a hub, and a hub is what this whole library exists not to be. The rule is one line
 * long and it is the reason the split was worth making.
 *
 * It is also, deliberately, **not about JSON Schema**. `compile(schema) → predicate` is the
 * most general shape the job has. `ajv` happens to be the implementation today; the types
 * never say so.
 */

/**
 * A schema that compiled, or the reason it could not.
 *
 * Two facts, and they must not be conflated: *"this subject does not conform"* is about the
 * caller's data, while *"this schema is unusable"* is about whoever published the schema.
 * Folded into one predicate, an unusable schema reports as a data failure and blames the
 * wrong party — which is exactly what a lenient engine did to a requirement's `match`.
 *
 * `ok` is a **tag**, not a convenience. Without it a caller narrows on the presence of a
 * field (`"error" in compiled`), which silently picks the wrong branch the day a third state
 * arrives carrying neither. With it, a `switch` is exhaustive and `never` proves it.
 *
 * There is deliberately **no error code**. Codes only earn their keep if a caller must
 * *react* rather than *report*, and adding `code?: string` later is a non-breaking change,
 * so nothing is bought by guessing a taxonomy across engines now. What would be breaking
 * later is the tag, which is why the tag is here.
 */
export type Compiled =
  | {
      ok: true;
      /** `true` when the data conforms; otherwise why it did not, in human-readable strings. */
      run: (data: unknown) => true | string[];
    }
  | {
      ok: false;
      /** The compiler's objection, verbatim. An unknown keyword, a bad `$ref`, a broken regex. */
      error: string;
    };

export interface SchemaEngine {
  /**
   * Compile a schema.
   *
   * Never throws: a schema that cannot be compiled is data about the schema, and every caller
   * has somewhere to put it. Compilation is where a typo is caught, so it is also where a
   * promise nobody can keep gets caught.
   */
  compile(schema: Record<string, unknown>): Compiled;
}
