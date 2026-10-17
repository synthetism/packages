/**
 * Every language this package speaks, keyed by the address a document carries.
 *
 * A version is added; none is ever removed. Credentials outlive deployments, so a package
 * that forgot how to read last year's requirement would be refusing documents its own
 * users signed — which is the one failure nobody downstream can fix.
 *
 * The languages themselves are **artifacts**, not code. `schemas/query/v1.json` is the file
 * a stranger fetches and the address inside every requirement ever signed, so it is the
 * source of truth, and `v1.generated.ts` is derived from it by `scripts/generate-language.ts`.
 * Editing the generated file is editing a build product.
 *
 * `match` is a **JSON Schema applied to `credentialSubject`**, not a vocabulary of our own.
 * That is the whole reason the language is data: v2 widens the language by publishing a
 * wider schema, and nothing we invented has to be extended, frozen or taken back.
 */

import type { LanguageInterpreter } from "../interpreter.js";
import { V1_INTERPRETER } from "./v1.interpreter.js";
import { V1, V1_ADDRESS } from "./v1.generated.js";

/**
 * One language: the artifact that says whether a document conforms, and the reader that says
 * what it demands.
 *
 * They are one entry because they are one contract — the schema has already compiled the
 * document before `read` is called, so `read` **trusts** it and never re-validates. A schema
 * with no reader is a language nobody can judge; a reader with no schema is a guess about a
 * document that may not conform.
 */
export interface Language {
  schema: Record<string, unknown>;
  interpreter: LanguageInterpreter;
}

/** The address a new requirement is written against. The newest one this package speaks. */
export const LANGUAGE_ADDRESS = V1_ADDRESS;

/** Address → the language itself. Add to this; never take away. */
export const LANGUAGES: Readonly<Record<string, Language>> = {
  [V1_ADDRESS]: { schema: V1, interpreter: V1_INTERPRETER },
};

/**
 * The `credentialSchema` that points at this language — the value an app passes to
 * `createUnsigned`.
 *
 * Exported as an **object** rather than two strings on purpose. A caller that had to write
 * `{ id: "…", type: "…" }` would have two opportunities to get it wrong and nothing to catch
 * either; a frozen object can be passed or forgotten, and forgetting is caught — `validate`
 * reports `unsupported-language` by name.
 */
export const LANGUAGE_CREDENTIAL_SCHEMA: { id: string; type: string } = {
  id: LANGUAGE_ADDRESS,
  type: "JsonSchemaValidator2018",
};
