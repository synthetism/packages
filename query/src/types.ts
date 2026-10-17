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
 *
 * **This file imports nothing.** The subject below is defined here rather than borrowed
 * from `@synthetism/credential`, because the language should be readable by anyone — a
 * directory of JSON and the addresses it answers at — and an import would make installing a
 * credential format a precondition for reading a requirement.
 */

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
 * The subject a requirement is published in — **the language's own shape**.
 *
 * Structurally this is what a `CredentialSubject` looks like (a `holder` with an `id`), and
 * deliberately not an import of it. The format's rule is that *some* holder owns the claims;
 * this says what that holder is holding. Two statements, two packages, no dependency.
 *
 * `holder` is the service — the same party as the credential's `issuer`. Not redundant: a
 * requirement is a statement a service makes about *itself*, which is why a caller verifies
 * it exactly as it verifies anything else.
 */
export interface RequirementSubject {
  holder: { id: string; name?: string; [x: string]: unknown };
  /** The requirement itself. Its shape is the language's; this says only that one is here. */
  requirement: VPLanguageSchema;
}
