/**
 * @synthetism/utils — the parts of the stack that need a dependency.
 *
 * The core packages are dependency-free on purpose. This one is where the choices live: a
 * JSON Schema engine, and the composition over `@synthetism/query` that finds a holder's
 * candidate credentials for a requirement.
 *
 * It is a **library of parts**, not a flow. `resolve` hands back candidates; the client
 * picks; `validate` confirms the pick. Nothing here decides anything on the client's behalf,
 * and nothing here holds a key.
 */

export { ajvEngine, type EngineOptions } from "./engine.js";

export {
  resolve,
  type Candidate,
  type Resolution,
} from "./resolve.js";
