/**
 * `validate` — does this set of credentials satisfy that requirement?
 *
 * A **predicate**, and nothing else. It does not select, rank, spend or verify: which of
 * several valid candidates to send is a policy, and a policy with no single right answer
 * belongs to the app, not the library.
 *
 * It is subject-blind. Three checks — the type, the holder, and whatever `match` says —
 * and no opinion about what an `authorisation` or a `receipt` is. The vocabulary lives in
 * the requirement; the mechanism lives here.
 *
 * **Two consumers, one function.** A service calls it to check a presentation against the
 * requirement it published, so the published requirement and the enforced check cannot
 * drift — they are the same code reading the same document. A customer calls it before
 * presenting, to know that a credential it picked will be accepted.
 *
 * **It knows nothing about `VerifiableCredential`,** and that is deliberate. It reads JSON:
 * `type`, `credentialSubject.holder.id`, and whatever `match` says. Typing the input against
 * `@synthetism/credential` would have made this package's public signature depend on a
 * package version — so an app that upgraded `credential` would stop compiling here, for no
 * reason anyone could act on. The shape stays generic; the caller keeps its own type.
 */

// The port comes from below, not from beside: compiling a schema is not a requirement-shaped
// job, and the next spec that needs one must not inherit this language to get it.
import type { SchemaEngine } from "@synthetism/schema-engine";
import { LANGUAGES, type Language } from "./languages/index.js";

export type FailureReason =
  /**
   * The document is written in a language this reader does not implement — either the
   * address is unknown, or it is known and its requirement is not shaped in a way this
   * reader can judge. Why it is one reason and not two: every caller does the same thing
   * with it (stop, do not present, tell the user the client is behind), and `detail`
   * carries which of the two it was. A reason is for branching, not for narrating.
   */
  | "unsupported-language"
  /** The document claims a language it does not conform to. */
  | "malformed-requirement"
  /** Nothing of the required type was offered. */
  | "no-credential"
  /** Two offered where the requirement asks for one. */
  | "more-than-one"
  /** Offered, but `match` said no. */
  | "not-a-match"
  /** Offered, but it belongs to somebody else. */
  | "not-the-holder";

export interface Failure {
  /** The requirement key, or `$` for a failure about the document itself. */
  key: string;
  reason: FailureReason;
  detail?: string;
}

export interface Verdict {
  ok: boolean;
  failures: Failure[];
}

export interface ValidateInput<C = unknown> {
  /** The requirement credential as parsed JSON — the address lives inside it. */
  document: unknown;
  /**
   * What the caller has chosen to offer. One credential per requirement, ideally.
   *
   * Generic on purpose: this package never reads the type, so it should not require one.
   * A caller passes `VerifiableCredential[]` and gets its own type back; a caller with plain
   * parsed JSON passes that. Neither drags a package version into the other.
   */
  credentials: readonly C[];
  /** The DID presenting. Every credential must belong to it. */
  holder: string;
  engine: SchemaEngine;
  /** Override the shipped languages — for a v2 that has not shipped, or a test. */
  languages?: Readonly<Record<string, Language>>;
  /**
   * Judge only these requirement keys.
   *
   * Exists so that a resolver can ask "does *this one credential* satisfy *this one key*?"
   * without reimplementing the judgement. There is one implementation of what conformance
   * means, and everything else composes it.
   */
  only?: readonly string[];
}

export function validate<C = unknown>(input: ValidateInput<C>): Verdict {
  const failures: Failure[] = [];
  const fail = (key: string, reason: FailureReason, detail?: string): void => {
    failures.push(detail === undefined ? { key, reason } : { key, reason, detail });
  };

  const document = asRecord(input.document);
  const address = typeof asRecord(document?.credentialSchema)?.id === "string"
    ? (asRecord(document?.credentialSchema)?.id as string)
    : undefined;

  // The address is a claim, not a reason to trust the bytes — but it is the *only* thing
  // that says which language to check the bytes against, so no address is no language.
  if (address === undefined) {
    fail("$", "unsupported-language", "the document names no credentialSchema.id");
    return { ok: false, failures };
  }

  const languages = input.languages ?? LANGUAGES;
  const language = languages[address];

  if (language === undefined) {
    fail("$", "unsupported-language", address);
    return { ok: false, failures };
  }

  const subject = asRecord(document?.credentialSubject);
  const requirement = language.interpreter.locate(subject);
  const compiled = input.engine.compile(language.schema);

  // An unusable *language* is ours to own, not the caller's: they cited our address and we
  // shipped a schema our own compiler rejects.
  if (!compiled.ok) {
    fail("$", "malformed-requirement", compiled.error);
    return { ok: false, failures };
  }

  const conforms = compiled.run(requirement);

  if (conforms !== true) {
    fail("$", "malformed-requirement", conforms.join("; "));
    return { ok: false, failures };
  }

  // Where the requirement lives and what shape it has is the language's business — the only
  // thing a language is allowed to know. Everything below is the single implementation of
  // what "satisfies" means, and it is the same for every language.
  //
  // This replaces a hardcoded `credentialSubject.requirement.requirements` walk: a v2 whose
  // demands were an array under `config` conformed to its own schema and then iterated zero
  // keys, reporting `ok` against a requirement nothing had been checked against.
  for (const demand of language.interpreter.read(requirement)) {
    const { key, type } = demand;

    if (input.only !== undefined && !input.only.includes(key)) continue;

    if (type === "") {
      fail(key, "malformed-requirement", "the requirement names no type");
      continue;
    }

    const ofType = input.credentials.filter((credential) => typesOf(credential).includes(type));
    const mine = ofType.filter((credential) => holderOf(credential) === input.holder);

    if (mine.length === 0) {
      // Optional and absent is not a failure — that is what `required: false` is for.
      if (!demand.required) continue;

      // Distinguish "you have none" from "you offered somebody else's", because the
      // second is a bug in the caller and the first is a fact about the caller.
      if (ofType.length > 0) {
        fail(key, "not-the-holder", `offered ${type} belonging to another holder`);
      } else {
        fail(key, "no-credential", `nothing of type ${type}`);
      }
      continue;
    }

    if (mine.length > 1) {
      fail(key, "more-than-one", `${mine.length} credentials of type ${type}`);
      continue;
    }

    const match = demand.match;

    if (match !== undefined) {
      const compiledMatch = input.engine.compile(match);

      // A `match` that is not a schema is the **requirement** being broken — `scope: [...]`
      // where a schema belongs, say. Reporting `not-a-match` would tell the client its
      // credential was wrong when the service published something no one can satisfy.
      if (!compiledMatch.ok) {
        fail(key, "malformed-requirement", compiledMatch.error);
        continue;
      }

      const judged = compiledMatch.run(asRecord(mine[0])?.credentialSubject);

      if (judged !== true) {
        fail(key, "not-a-match", judged.join("; "));
      }
    }
  }

  return { ok: failures.length === 0, failures };
}

// --- reading documents that came off the wire -----------------------------------

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function typesOf(credential: unknown): string[] {
  const type = asRecord(credential)?.type;
  if (typeof type === "string") return [type];
  return Array.isArray(type) ? type.filter((entry): entry is string => typeof entry === "string") : [];
}

function holderOf(credential: unknown): string | undefined {
  const holder = asRecord(asRecord(asRecord(credential)?.credentialSubject)?.holder)?.id;
  return typeof holder === "string" ? holder : undefined;
}
