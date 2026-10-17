/**
 * Every language this package speaks, keyed by the address a document carries.
 *
 * A version is added; none is ever removed. Credentials outlive deployments, so a package
 * that forgot how to read last year's requirement would be refusing documents its own
 * users signed — which is the one failure nobody downstream can fix.
 */

import { V1, V1_ADDRESS } from "./v1.js";

export type LanguageSchema = Record<string, unknown>;

/** The address a new requirement is written against. The newest one this package speaks. */
export const LANGUAGE_ADDRESS = V1_ADDRESS;

/** Address → the language itself. Add to this; never take away. */
export const LANGUAGES: Readonly<Record<string, LanguageSchema>> = {
  [V1_ADDRESS]: V1,
};
