/**
 * `@synthetism/resolve` — which of a holder's credentials *could* satisfy each part of a
 * requirement?
 *
 * One function, and it does not pick. It is the composition layer over `@synthetism/query`:
 * the language says what conformance means, `validate` judges it, and this works out which
 * of the credentials you hold answer which requirement key. Which of three valid candidates
 * to spend is a **policy** — latest expiry, narrowest scope, the one you have not used — and
 * there is no single right answer, so the library does not hold one.
 *
 * It has **no third-party dependencies**: the JSON Schema engine is a parameter, not an
 * import. Compose one where you need it — `engine: ajvEngine()` from
 * `@synthetism/engine-ajv` — or hand it a stub.
 */

export type { Compiled, SchemaEngine } from "@synthetism/query";

export { resolve, type Candidate, type Resolution } from "./resolve.js";
