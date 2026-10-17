/**
 * @synthetism/query — what a service requires, as data.
 *
 * The other half of the exchange from `@synthetism/vp`. A presentation is a standard; a
 * requirement is ours. This package holds **the language itself as a schema**, the
 * addresses it is published at, and the predicate that answers one question: does this set
 * of credentials satisfy that requirement?
 *
 * Two versions travel with every requirement, and they are different facts:
 *
 * | | |
 * |---|---|
 * | `LANGUAGE_ADDRESS` | which **language** the document is written in — frozen per major, the same for everybody |
 * | `requirement.version` | the **service's** revision of its own requirement |
 *
 * `createRequirement` owns the first; the caller owns the second.
 *
 * **Two audiences, two doors.** A service ships this package, knows which version it
 * speaks, and writes its requirement with the authoring types. A consumer has a document
 * off the wire and asks the schema — never the types — whether it is the language it claims
 * to be. `validate` is the second door.
 */

export type { SchemaEngine } from "./engine.js";

export { LANGUAGE_ADDRESS, LANGUAGES, type LanguageSchema } from "./languages/index.js";

export type {
  RequirementSpec,
  RequirementSubject,
  VPLanguageSchema,
} from "./types.js";

export {
  LANGUAGE_SCHEMA_TYPE,
  createRequirement,
  type CreateRequirementArgs,
} from "./requirement.js";

export {
  validate,
  type Failure,
  type FailureReason,
  type ValidateInput,
  type Verdict,
} from "./validate.js";
