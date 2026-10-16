/**
 * The challenge, and the one place it is validated.
 *
 * A malformed challenge is a **caller** bug, not a document problem, so it throws
 * rather than returning a verdict — the difference between "this presentation is
 * bad" and "you did not tell me what I am verifying against".
 */

import type { Challenge } from "./types.js";

/**
 * Assert that a value is a usable challenge.
 *
 * @throws if it is missing, unnamed, nonceless, or has no window.
 */
export function assertChallenge(
  challenge: Challenge | undefined,
): asserts challenge is Challenge {
  if (challenge === null || typeof challenge !== "object") {
    throw new TypeError(
      "a challenge is required — there is no such thing as a presentation that was not addressed to anyone",
    );
  }
  if (typeof challenge.aud !== "string" || challenge.aud === "") {
    throw new TypeError("the challenge must name the verifier (aud)");
  }
  if (typeof challenge.nonce !== "string" || challenge.nonce === "") {
    throw new TypeError("the challenge must carry the nonce this verifier issued");
  }
  if (
    typeof challenge.expiresIn !== "number" ||
    !Number.isFinite(challenge.expiresIn) ||
    challenge.expiresIn <= 0
  ) {
    throw new TypeError("the challenge must carry a positive expiresIn, in seconds");
  }
  if (
    challenge.issuedAt !== undefined &&
    (typeof challenge.issuedAt !== "number" || !Number.isFinite(challenge.issuedAt))
  ) {
    throw new TypeError("challenge.issuedAt must be epoch seconds when present");
  }
}

/** Epoch seconds — the unit every JWT claim is in, and `Date` is not. */
export function epochSeconds(when: Date): number {
  return Math.floor(when.getTime() / 1000);
}
