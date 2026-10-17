/**
 * The authoring shapes — and only that.
 *
 * These are for one audience: a service that ships this package, and therefore knows which
 * language version it speaks, so the compiler can help it write a requirement. A
 * **consumer** never sees them. It has a document off the wire and an address inside it,
 * and it asks the schema whether the document is the language it claims to be.
 *
 * Producers are version-locked by design. Consumers must be version-agnostic. Conflating
 * those two is how a protocol ends up with a package that can only read its own output.
 */

import type { CredentialSubject } from "@synthetism/credential";

/** One thing a verifier demands: a credential of this `type`, held to this schema. */
export interface RequirementSpec {
  /** The credential `type` accepted for this purpose, e.g. `"AuthorizationCredential"`. */
  type: string;
  /**
   * `false` marks this requirement as **desirable rather than necessary** — the presenter
   * may present without satisfying it. That is the language's compatibility valve: an
   * addition a reader does not understand costs nothing if it is marked optional.
   */
  required?: boolean;
  /**
   * **A JSON Schema applied to `credentialSubject`.** Not a vocabulary of our own —
   * `{ "properties": { "resource": { "const": "…" } }, "required": ["resource"] }`, and
   * empty means "any credential of that type".
   */
  match?: Record<string, unknown>;
}

/** The language, at the version this package ships. */
export interface VPLanguageSchema {
  /** What the requirement is called, e.g. `"market-read"`. */
  name: string;
  /** **This service's** revision — not the language's. Bumped whenever the content changes. */
  version: string;
  /** For the human reading the 401. */
  description?: string;
  /** What is on sale. Informational: nothing in the library reads it. */
  parameters?: Record<string, unknown>;
  /** Keyed by purpose. */
  requirements: Record<string, RequirementSpec>;
}

/**
 * A published requirement: the language, signed by the service that will enforce it.
 *
 * `holder` is the service — the same party as `issuer`. That is not redundant: a
 * requirement is a statement a service makes about itself, and a caller verifies it exactly
 * as it verifies anything else.
 */
export interface RequirementSubject extends CredentialSubject {
  /** The requirement itself. Its shape is the language's; this says only that one is here. */
  requirement: VPLanguageSchema;
}
