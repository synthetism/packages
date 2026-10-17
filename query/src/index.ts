/**
 * @synthetism/query — what a service requires, as data.
 *
 * The other half of the exchange from `@synthetism/vp`. A presentation is a standard;
 * a requirement is ours. This package holds the language and — as it grows — the tools
 * that work on it, so that a **client never has to hardcode what to present**: it reads
 * the requirement, takes the matching credentials out of its own store, and packs them
 * into the shape the service asked for.
 *
 * Two versions travel with every requirement, and they are different facts:
 *
 * | | |
 * |---|---|
 * | `LANGUAGE_SCHEMA` | which **language** the document is written in — frozen per major, the same for everybody |
 * | `requirement.version` | the **service's** revision of its own requirement — changes whenever it changes its mind |
 *
 * `createRequirement` owns the first; the caller owns the second.
 */

export type {
  MatchConditions,
  RequirementSpec,
  RequirementSubject,
  VPLanguageSchema,
} from "./types.js";

export { LANGUAGE_SCHEMA, LANGUAGE_VERSION } from "./language.js";

export {
  LANGUAGE_SCHEMA_TYPE,
  createRequirement,
  type CreateRequirementArgs,
} from "./requirement.js";
