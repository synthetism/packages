/**
 * @synthetism/vp — the shapes of the two halves of one act.
 *
 * A **presentation** is a holder saying *"I control this key, and here is what I
 * hold."* A **requirement** is a verifier saying *"here is what I will accept."*
 * They are the two sides of the same exchange and both are data — neither is a
 * credential, and neither belongs in `vc`.
 */

import type {
  CredentialSubject,
  VerifiableCredential,
  VerifiablePresentation,
} from "@synthetism/credential";

// ---------------------------------------------------------------------------
// The challenge — the verifier's window
// ---------------------------------------------------------------------------

/**
 * A presentation is never signed at a time of the presenter's choosing.
 *
 * The verifier opens a window and hands it over; the presenter echoes it back
 * under its own signature. So `aud`, `jti` and `exp` are not three independent
 * choices — they are *this object, signed*.
 *
 * A presenter receives `{ aud, nonce, expiresIn }` and nothing else. The
 * **verifier** knows one thing more, `issuedAt`, because it issued the nonce and
 * its own clock is the only one that decides. When you are the verifier, keep
 * `issuedAt` on the challenge row you already write — it is what stops a presenter
 * from sliding the window forward and replaying at leisure.
 */
export interface Challenge {
  /** The verifier's id. A presentation signed for one verifier is worthless at another. */
  aud: string;
  /** Single use, issued by the verifier. This is the anti-replay: it is why a VP is one-shot. */
  nonce: string;
  /** The window, in **seconds**, measured from the moment the verifier issued the challenge. */
  expiresIn: number;
  /**
   * When the verifier issued this challenge, in epoch seconds — its own clock, and
   * never sent to the presenter.
   *
   * Optional, because a presenter builds the same shape from what it receives. On
   * the verifier's side, omitting it weakens the window check from *"exactly the
   * window I issued"* to *"no wider than `expiresIn`"*.
   */
  issuedAt?: number;
}

/**
 * The registered claims of a presentation's JWT.
 *
 * `nonce` and `jti` are two fields because they are two facts. `nonce` is the
 * verifier's — single use, and the anti-replay. `jti` is the presenter's own `id`.
 * Collapsing them would put the property the verifier depends on into a value the
 * presenter chooses, and would hand any conformant decoder a presentation whose `id`
 * is somebody else's nonce.
 */
export interface PresentationClaims {
  /** The presenter. A presentation is signed by its holder — never by an issuer. */
  iss: string;
  /** The verifier this was signed for. */
  aud: string;
  /** The verifier's nonce. **The anti-replay**, and the one that gets the lookup. */
  nonce: string;
  /** The presentation's own `id`. */
  jti: string;
  /** Start of the window, epoch seconds — represents the document's `issuanceDate`. */
  nbf: number;
  /** Issued at, epoch seconds. */
  iat: number;
  /** End of the window, epoch seconds — represents the document's `expirationDate`. */
  exp: number;
}

/** What `present` produces. */
export interface PresentResult<C = VerifiableCredential> {
  /** The signed presentation — proof attached, challenge contained. */
  presentation: VerifiablePresentation<C>;
  /**
   * The bytes that were signed — the provenance of the proof.
   *
   * Returned rather than recomputed: it is the exact input the signer was given.
   */
  signingInput: string;
}

// ---------------------------------------------------------------------------
// The VP Language — what a verifier demands, as data
// ---------------------------------------------------------------------------

/** Constraints on the fields of a presented credential. */
export interface MatchConditions {
  [field: string]: unknown;
}

/** One thing a verifier demands: a credential of this `type`, optionally constrained. */
export interface RequirementSpec {
  /** The credential `type` accepted for this purpose, e.g. `"AuthorizationCredential"`. */
  type: string;
  /** `false` marks a requirement as desirable rather than necessary. */
  required?: boolean;
  /** What the credential must say once it is opened, e.g. `{ scope: ["read"] }`. */
  match?: MatchConditions;
}

/**
 * The VP Language — what a service requires, expressed as **data**.
 *
 * This is the only document in the exchange that serves two audiences at once: the
 * developer reading *how to call*, and the agent reading *what to present*. It is
 * published before anything is presented, on the 401, **signed by the service that
 * will enforce it** — which is the part that matters, because it means a caller is
 * told what is needed by the party that will actually check it. A lookalike cannot
 * talk an agent into over-disclosure.
 *
 * `version` is not decoration. The requirement changes on the service's schedule
 * while the credentials it accepts stay valid for months, so a copy cached by an
 * agent goes stale on its own. Every request names the version it was built
 * against, and a mismatch is its own refusal — never a mysterious failure.
 *
 * If a capability cannot be expressed here, it is not a requirement; it is a custom
 * integration. That test is the whole reason this shape is worth guarding.
 */
export interface VPLanguageSchema {
  /** What the requirement is called, e.g. `"market-read"`. */
  name: string;
  /** The requirement's own version, bumped whenever the shape below changes. */
  version: string;
  /** For the human reading the 401. */
  description?: string;
  /** Values the *service* fixes, so a caller does not have to guess them. */
  parameters?: Record<string, unknown>;
  /** Keyed by purpose, e.g. `{ authorization: { type: "AuthorizationCredential" } }`. */
  requirements: Record<string, RequirementSpec>;
}

/**
 * A published requirement: the VP Language, signed by the service that will enforce
 * it.
 *
 * `holder` is the service — it is the one holding this claim, and the `issuer` is
 * the same service, which is exactly why the signature is worth checking and the
 * field is not redundant: the requirement is a statement the service makes about
 * itself, and the caller verifies it the same way it verifies anything else.
 *
 * Where the requirement *lives* is not a field here. It is the credential's
 * `credentialSchema.id` — the data model's own slot for "the address of the shape
 * this document conforms to" (§5.4) — and `requirement.version` is what catches a
 * cached copy that has gone stale.
 */
export interface RequirementSubject extends CredentialSubject {
  /** The requirement itself. */
  requirement: VPLanguageSchema;
}
