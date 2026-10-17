/**
 * The language's own version, and the one address it ships.
 *
 * The version is a **literal here**, not read from `package.json` at runtime: the
 * address has to be a published fact a stranger can implement against, not a
 * computation that depends on how the package was bundled. `test/version.test.ts`
 * asserts this matches the package's major, so the two cannot drift — and a drift fails
 * in CI rather than in a caller's refused request.
 *
 * **The address is frozen.** It sits inside every requirement ever signed, so it cannot
 * be renamed, and a change a v1 reader cannot survive becomes `/v2` while v1 keeps
 * resolving. Additive change lives inside v1, which is safe by construction: unknown
 * fields are ignored, and the published schema leaves the object open.
 */

import { SCHEMA_BASE } from "@synthetism/credential";

/** The language's major. Bump **only** for a break a `v1` reader cannot survive. */
export const LANGUAGE_VERSION = "1";

/** The address of this language. Frozen — the shape of this string is the commitment. */
export const LANGUAGE_SCHEMA = `${SCHEMA_BASE}/query/v${LANGUAGE_VERSION}`;
