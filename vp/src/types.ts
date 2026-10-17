/**
 * @synthetism/vp — the presentation, and nothing else.
 *
 * A **presentation** is a holder saying *"I control this key, and here is what I
 * hold."* It is a W3C standard with a shape that is not ours to change — which is why
 * this package holds only that. The **requirement** a verifier publishes before it will
 * look at anything is Synthetism's own invention, changes on a different schedule, and
 * lives in `@synthetism/query`.
 */

import type { VerifiableCredential, VerifiablePresentation } from "@synthetism/credential";

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

// The query language lived here until it was split out. It is Synthetism's own
// invention with its own schedule, and a standard's package must not be released on
// somebody else's churn. See `@synthetism/query`.
