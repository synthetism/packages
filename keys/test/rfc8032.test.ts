/**
 * RFC 8032 §7.1, TEST 1 — the only key material in this package that we did not
 * produce.
 *
 * Everything else here is a round-trip, which proves internal consistency and
 * nothing more. This vector is the RFC's, so agreeing with it means agreeing with
 * Ed25519 rather than with ourselves.
 *
 * It is also the regression test for `derivePublicKey`: that function used to
 * return `null` for a hex seed, and a round-trip would have "passed" while it did.
 */

import { describe, expect, it } from "vitest";
import { derivePublicKey, hexToPem, verifyEd25519 } from "../src/index.js";

/** The RFC's secret key (a 32-byte seed, in its own notation). */
const SEED = "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60";

/** The public key the RFC publishes for that seed. */
const PUBLIC_KEY = "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a";

/** The RFC's signature over the **empty** message. */
const SIGNATURE =
  "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b";

describe("RFC 8032 §7.1 test vector", () => {
  it("derives the published public key from the published seed", () => {
    expect(derivePublicKey(SEED)).toBe(PUBLIC_KEY);
  });

  it("derives the same key again — the derivation is deterministic", () => {
    expect(derivePublicKey(SEED)).toBe(derivePublicKey(SEED));
  });

  it("turns that public key into a usable PEM", () => {
    expect(hexToPem(PUBLIC_KEY, "ed25519")).toMatch(/^-----BEGIN PUBLIC KEY-----/);
  });

  it("rejects the RFC's signature when the message is not the one that was signed", () => {
    const pem = hexToPem(PUBLIC_KEY, "ed25519");
    if (pem === null) throw new Error("expected a PEM for the RFC public key");

    expect(verifyEd25519("not the message", SIGNATURE, pem)).toBe(false);
  });

  /**
   * ⚠️ **A known defect, asserted on purpose.**
   *
   * RFC 8032 TEST 1 signs the empty message. `verifyEd25519` starts with
   * `if (!data || ...) return false`, so an empty message is rejected before the
   * signature is ever examined — the floor cannot verify the RFC's own vector.
   *
   * It fails **closed** (`false`), so this is an interop defect rather than a
   * bypass, and it cannot affect a credential: `signingInput` is always
   * `header.payload`, never empty. Recorded as issue #13 in `docs/STARTUP-ISSUES.md`
   * rather than fixed mid-cycle — this test is what will fail when it is fixed.
   */
  it("cannot verify the RFC's empty-message signature (issue #13)", () => {
    const pem = hexToPem(PUBLIC_KEY, "ed25519");
    if (pem === null) throw new Error("expected a PEM for the RFC public key");

    expect(verifyEd25519("", SIGNATURE, pem)).toBe(false);
  });
});
