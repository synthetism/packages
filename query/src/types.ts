/**
 * The query language — what a service requires, as data.
 *
 * **This is Synthetism's own invention, and it is not the presentation protocol.** A
 * presentation is a W3C standard with a shape that is not ours to change; a requirement
 * is a document a service publishes about itself, and it will keep changing. Keeping
 * both in one package means a change to the language forces a release of the standard —
 * so they live apart, and this one is free to move.
 *
 * The requirement is the **only document in the exchange that serves two audiences at
 * once**: the developer reading *how to call*, and the agent reading *what to present*.
 * It is published before anything is presented, signed by the service that will enforce
 * it — which is the part that matters, because a caller is told what is needed by the
 * party that will actually check it. A lookalike cannot talk an agent into
 * over-disclosure.
 *
 * It describes the **credentials a caller must present**, never the API behind them.
 * What a service *returns* is a separate contract, published after admission, because a
 * service's endpoints move on a different schedule from its admission policy.
 */

import type { CredentialSubject } from "@synthetism/credential";

/**
 * Constraints on the fields of a presented credential.
 *
 * Open on purpose. Unknown fields must be **ignored**, not rejected — that is what lets
 * a requirement grow a condition without breaking every reader written before it.
 */
export interface MatchConditions {
  [field: string]: unknown;
}

/** One thing a verifier demands: a credential of this `type`, optionally constrained. */
export interface RequirementSpec {
  /** The credential `type` accepted for this purpose, e.g. `"AuthorizationCredential"`. */
  type: string;
  /**
   * `false` marks this requirement as **desirable rather than necessary**.
   *
   * That is also the language's compatibility valve: a presenter that does not
   * understand a requirement marked optional may present without satisfying it. It is
   * how the language gains capability without a version bump — which is the whole reason
   * it is worth having.
   */
  required?: boolean;
  /** What the credential must say once it is opened, e.g. `{ scope: ["read"] }`. */
  match?: MatchConditions;
}

/**
 * The query language itself.
 *
 * `version` is **this service's** revision, not the language's. The language's own
 * version is the package's major, and it is carried in the credential's
 * `credentialSchema.id` — so a caller that cannot read the language in front of it can
 * refuse before it tries to parse anything. Two versions, two jobs, and conflating them
 * is how a service's routine edit starts looking like a format change.
 */
export interface VPLanguageSchema {
  /** What the requirement is called, e.g. `"market-read"`. */
  name: string;
  /** This service's revision of this requirement. Bump it whenever the content changes. */
  version: string;
  /** For the human reading the 401. */
  description?: string;
  /** Values the *service* fixes, so a caller does not have to guess them. */
  parameters?: Record<string, unknown>;
  /** Keyed by purpose, e.g. `{ authorization: { type: "AuthorizationCredential" } }`. */
  requirements: Record<string, RequirementSpec>;
}

/**
 * A published requirement: the language, signed by the service that will enforce it.
 *
 * `holder` is the service — the party holding this claim — and it is the same party as
 * the `issuer`. That is not redundant: a requirement is a statement a service makes
 * about *itself*, and a caller verifies it exactly as it verifies anything else.
 *
 * Where the requirement lives is the credential's `credentialSchema.id` — the data
 * model's own slot for "the address of the shape this document conforms to" (§5.4) —
 * and that address carries the **language** version, never this instance's.
 */
export interface RequirementSubject extends CredentialSubject {
  /** The requirement itself. */
  requirement: VPLanguageSchema;
}
