/**
 * What a language demands — and the one thing a language is allowed to know.
 *
 * A schema can say whether a document **conforms**. It cannot say *where the demands are*.
 * That gap is why `validate` used to walk `credentialSubject.requirement.requirements` in
 * code, which is v1's shape wearing a general name — and why a v2 document passed conformance
 * and then iterated zero keys.
 *
 * So every language brings a small parser. Two questions, and no more:
 *
 * - `locate` — where in the subject does the requirement live?
 * - `read` — what does this requirement demand?
 *
 * **It does not judge.** Whether a demanded `type` is held, whether it belongs to the
 * presenter, whether `match` passes, whether two were offered where one was asked for — those
 * live in `validate`, once. If each language judged for itself, two readers could disagree
 * about whether the same credential satisfies the same demand, and there would no longer be
 * one answer to what conformance means. That is the failure this design exists to prevent,
 * and the reason `resolve` is built *on* `validate` rather than beside it.
 */

/** One thing a requirement demands, in the single vocabulary the judge understands. */
export interface Demand {
  /** The requirement key — how a refusal cites the demand it refused. */
  key: string;
  /**
   * The credential `type` this demand asks for.
   *
   * A `Demand` invariant: non-empty. A language's schema is what guarantees it, and `read` is
   * allowed to trust that because `validate` compiles the schema first. An empty string means
   * the invariant was broken, and `validate` reports `malformed-requirement` rather than
   * silently demanding a type nobody has.
   */
  type: string;
  /** `false` when the demand is desirable rather than necessary — the compatibility valve. */
  required: boolean;
  /** A JSON Schema applied to `credentialSubject`. Absent means "any of that type". */
  match?: Record<string, unknown>;
}

export interface LanguageInterpreter {
  /**
   * The requirement inside a subject, or `undefined` when it is not where this language said.
   *
   * `undefined` is not an error here — the language's schema is what rejects a malformed
   * document, and `validate` reports `malformed-requirement` from that. Returning a guess
   * would be worse than returning nothing.
   */
  locate(subject: unknown): unknown;

  /**
   * The demands, from a requirement that has **already conformed** to the language's schema.
   *
   * That precondition is the contract between the two halves of a language, and it is why
   * `read` never validates: the schema has already said yes.
   */
  read(requirement: unknown): Demand[];
}
