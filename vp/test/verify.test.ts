import type { Proof } from "@synthetism/credential";
import { describe, expect, it } from "vitest";
import { verifyPresentation } from "../src/index.js";
import {
  T0,
  at,
  authorizationCredential,
  challenge,
  identity,
  presentationFor,
  rewire,
} from "./helpers.js";

/** A service, an agent, one good credential, one good presentation. */
async function fixture() {
  const service = identity();
  const agent = identity();
  const vc = await authorizationCredential(service, agent);
  const { presentation } = await presentationFor(agent, [vc]);
  return { service, agent, vc, presentation };
}

describe("verifyPresentation", () => {
  it("accepts a fresh presentation for the challenge it was issued", async () => {
    const { presentation } = await fixture();

    expect(verifyPresentation(presentation, { challenge: challenge(), now: T0 })).toEqual({
      verified: true,
      errors: [],
    });
  });

  it("accepts a presentation that carries nothing — renewal is a signature, not a credential", async () => {
    const agent = identity();
    const { presentation } = await presentationFor(agent, []);

    expect(verifyPresentation(presentation, { challenge: challenge(), now: T0 })).toEqual({
      verified: true,
      errors: [],
    });
  });

  // --- the window -----------------------------------------------------------

  it("refuses a presentation addressed to another verifier", async () => {
    const { presentation } = await fixture();

    const result = verifyPresentation(presentation, {
      challenge: challenge({ aud: "did:web:other.example.com" }),
      now: T0,
    });

    expect(result.verified).toBe(false);
    expect(result.errors.join(" ")).toMatch(/payload\.aud .* is not this verifier/);
  });

  it("refuses a presentation signed against a different nonce", async () => {
    const { presentation } = await fixture();

    const result = verifyPresentation(presentation, {
      challenge: challenge({ nonce: "nonce-two" }),
      now: T0,
    });

    expect(result.errors.join(" ")).toMatch(
      /payload\.nonce is not the nonce this verifier issued/,
    );
  });

  it("refuses a presentation whose window has passed", async () => {
    const { presentation } = await fixture();

    const result = verifyPresentation(presentation, { challenge: challenge(), now: at(600) });

    expect(result.verified).toBe(false);
    expect(result.errors.join(" ")).toMatch(/expired at 2026-06-01T00:02:00\.000Z/);
  });

  it("refuses a presentation whose window has not opened", async () => {
    const { presentation } = await fixture();

    const result = verifyPresentation(presentation, { challenge: challenge(), now: at(-600) });

    expect(result.errors.join(" ")).toMatch(/not valid before/);
  });

  it("★ refuses a window the presenter widened for itself", async () => {
    const service = identity();
    const agent = identity();
    const vc = await authorizationCredential(service, agent);

    // The presenter signs against a challenge of its own invention: a decade.
    const { presentation } = await presentationFor(agent, [vc], { expiresIn: 86400 * 3650 });

    const result = verifyPresentation(presentation, { challenge: challenge(), now: T0 });

    expect(result.verified).toBe(false);
    expect(result.errors.join(" ")).toMatch(/wider than the 120s challenge/);
  });

  it("refuses a window that starts before the challenge was issued", async () => {
    const service = identity();
    const agent = identity();
    const vc = await authorizationCredential(service, agent);

    const { presentation } = await presentationFor(agent, [vc], {}, at(-600));

    const result = verifyPresentation(presentation, { challenge: challenge(), now: at(-600) });

    expect(result.errors.join(" ")).toMatch(/starts before the challenge was issued/);
  });

  it("refuses a window that starts after the challenge expired", async () => {
    const service = identity();
    const agent = identity();
    const vc = await authorizationCredential(service, agent);

    // A fresh, narrow window — signed against a nonce this verifier issued long ago.
    const { presentation } = await presentationFor(agent, [vc], {}, at(600));

    const result = verifyPresentation(presentation, { challenge: challenge(), now: at(600) });

    expect(result.errors.join(" ")).toMatch(/starts after the challenge expired/);
  });

  it("forgives a clock that is behind by less than the skew asked for", async () => {
    const { presentation } = await fixture();

    expect(
      verifyPresentation(presentation, { challenge: challenge(), now: at(-2) }).verified,
    ).toBe(false);
    expect(
      verifyPresentation(presentation, { challenge: challenge(), now: at(-2), skew: 5 }).verified,
    ).toBe(true);
  });

  // --- the binding ----------------------------------------------------------

  it("★ refuses a credential the presenter is not the subject of", async () => {
    const service = identity();
    const agent = identity();
    const mallory = identity();
    const vc = await authorizationCredential(service, agent);

    // A perfectly valid presentation, correctly signed — carrying someone else's VC.
    const { presentation } = await presentationFor(mallory, [vc]);

    const result = verifyPresentation(presentation, { challenge: challenge(), now: T0 });

    expect(result.verified).toBe(false);
    expect(result.errors.join(" ")).toMatch(
      /credential\[0\]: the presenter is not the credential's subject/,
    );
  });

  it("binding is load-bearing: switched off, a credential is a bearer coupon", async () => {
    const service = identity();
    const agent = identity();
    const mallory = identity();
    const vc = await authorizationCredential(service, agent);
    const { presentation } = await presentationFor(mallory, [vc]);

    expect(
      verifyPresentation(presentation, { challenge: challenge(), binding: false, now: T0 }),
    ).toEqual({ verified: true, errors: [] });
  });

  // --- the credentials ------------------------------------------------------

  it("★ refuses a credential edited after it was signed", async () => {
    const service = identity();
    const agent = identity();
    const vc = await authorizationCredential(service, agent);
    const holder = vc.credentialSubject.holder as Record<string, unknown>;
    const edited = {
      ...vc,
      credentialSubject: { ...vc.credentialSubject, holder: { ...holder, name: "someone else" } },
    };

    const { presentation } = await presentationFor(agent, [edited]);

    const result = verifyPresentation(presentation, { challenge: challenge(), now: T0 });

    expect(result.verified).toBe(false);
    expect(result.errors.join(" ")).toMatch(
      /credential\[0\]: the document does not match the signed payload/,
    );
  });

  it("refuses a credential whose issuer cannot be resolved", async () => {
    const service = identity();
    const agent = identity();
    const vc = await authorizationCredential(service, agent, {
      issuerId: "did:web:unknown.example.com",
    });
    const { presentation } = await presentationFor(agent, [vc]);

    const result = verifyPresentation(presentation, { challenge: challenge(), now: T0 });

    expect(result.errors.join(" ")).toMatch(
      /credential\[0\]: cannot resolve did:web:unknown\.example\.com/,
    );
  });

  it("refuses a credential signed by a key that is not the issuer's", async () => {
    const service = identity();
    const mallory = identity();
    const agent = identity();

    // The claimed issuer is the service; the signature is Mallory's.
    const vc = await authorizationCredential(mallory, agent, { issuerId: service.did });
    const { presentation } = await presentationFor(agent, [vc]);

    const result = verifyPresentation(presentation, { challenge: challenge(), now: T0 });

    expect(result.errors.join(" ")).toMatch(/credential\[0\]: signature does not verify/);
  });

  it("reports each credential's failure under its own index", async () => {
    const service = identity();
    const agent = identity();
    const good = await authorizationCredential(service, agent);
    const gone = await authorizationCredential(service, agent, {
      issuerId: "did:web:gone.example.com",
    });

    const { presentation } = await presentationFor(agent, [good, gone]);

    const result = verifyPresentation(presentation, { challenge: challenge(), now: T0 });
    const joined = result.errors.join(" ");

    expect(joined).toMatch(/credential\[1\]: cannot resolve/);
    expect(joined).not.toMatch(/credential\[0\]/);
  });

  it("can be told not to re-verify what it carries", async () => {
    const service = identity();
    const agent = identity();
    const vc = await authorizationCredential(service, agent, {
      issuerId: "did:web:gone.example.com",
    });
    const { presentation } = await presentationFor(agent, [vc]);

    expect(verifyPresentation(presentation, { challenge: challenge(), now: T0 }).verified).toBe(
      false,
    );
    expect(
      verifyPresentation(presentation, { challenge: challenge(), credentials: false, now: T0 })
        .verified,
    ).toBe(true);
  });

  // --- the holder's proof ---------------------------------------------------

  it("refuses a presentation edited after it was signed", async () => {
    const { presentation } = await fixture();
    const edited = { ...presentation, holder: { ...presentation.holder, name: "someone else" } };

    const result = verifyPresentation(edited, { challenge: challenge(), now: T0 });

    expect(result.errors.join(" ")).toMatch(/does not match the signed payload/);
  });

  it("refuses a single flipped byte of the signature", async () => {
    const { presentation } = await fixture();
    const proof = presentation.proof as Proof;
    const [head, body, signature] = (proof.jwt as string).split(".");
    const flip = signature?.startsWith("A") ? "B" : "A";

    const result = verifyPresentation(
      { ...presentation, proof: { ...proof, jwt: `${head}.${body}.${flip}${signature?.slice(1)}` } },
      { challenge: challenge(), now: T0 },
    );

    expect(result.errors).toEqual(["signature does not verify"]);
  });

  it("★ refuses alg: none without ever asking a verifier", async () => {
    // No carried credentials: the only signature in play is the holder's, so the
    // spy below can say truthfully whether policy short-circuited crypto.
    const agent = identity();
    const { presentation } = await presentationFor(agent, []);
    const proof = presentation.proof as Proof;
    const [, body] = (proof.jwt as string).split(".");
    const none = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    let called = false;

    const result = verifyPresentation(
      { ...presentation, proof: { ...proof, jwt: `${none}.${body}.` } },
      {
        challenge: challenge(),
        now: T0,
        verify: () => {
          called = true;
          return true;
        },
      },
    );

    expect(result.errors.join(" ")).toMatch(/alg "none" is not accepted/);
    expect(result.errors.join(" ")).toMatch(/empty signature/);
    expect(called).toBe(false);
  });

  it("refuses a JWT whose payload carries a credential, not a presentation", async () => {
    const { presentation } = await fixture();

    const forged = rewire(presentation, (claims) => {
      claims.vc = claims.vp;
      delete claims.vp;
    });

    const result = verifyPresentation(forged, { challenge: challenge(), now: T0 });

    expect(result.errors.join(" ")).toMatch(/carries no vp/);
  });

  it("★ refuses a jti that is not the presentation's own id", async () => {
    const { presentation } = await fixture();

    // §6.3.1 decodes `id` from `jti`. A jti that disagrees with the document hands a
    // conformant processor a presentation neither party ever signed.
    const forged = rewire(presentation, (claims) => {
      claims.jti = "urn:presentation:somewhere-else";
    });

    const result = verifyPresentation(forged, { challenge: challenge(), now: T0 });

    expect(result.verified).toBe(false);
    expect(result.errors.join(" ")).toMatch(/payload\.jti .* is not the presentation's id/);
  });

  it("refuses a typ the standard rules out", async () => {
    const { presentation } = await fixture();
    const [head, body, signature] = (presentation.proof?.jwt as string).split(".");
    const foreign = Buffer.from(
      JSON.stringify({ alg: "EdDSA", typ: "vp+jwt" }),
    ).toString("base64url");

    const result = verifyPresentation(
      {
        ...presentation,
        proof: { ...(presentation.proof as Proof), jwt: `${foreign}.${body}.${signature}` },
      },
      { challenge: challenge(), now: T0 },
    );

    expect(result.errors.join(" ")).toMatch(/typ "vp\+jwt" is not a presentation/);
  });

  it("★ refuses a window the claims state and the document does not", async () => {
    const { presentation } = await fixture();
    const edited = { ...presentation, expirationDate: "2027-01-01T00:00:00.000Z" };

    const result = verifyPresentation(edited, { challenge: challenge(), now: T0 });

    expect(result.errors.join(" ")).toMatch(
      /expirationDate does not match payload\.exp/,
    );
  });

  it("refuses to verify against nothing", async () => {
    const { presentation } = await fixture();

    expect(() => verifyPresentation(presentation, {} as never)).toThrow(
      /a challenge is required/,
    );
  });

  // --- what this deliberately does not do -----------------------------------

  it("★ verifies the same presentation twice — single use is state, and state is yours", async () => {
    const { presentation } = await fixture();
    const seen = new Set<string>();

    /** The five lines this library refuses to contain, written where they belong. */
    const admit = (): boolean => {
      const nonce = challenge().nonce;
      if (!verifyPresentation(presentation, { challenge: challenge(), now: T0 }).verified) {
        return false;
      }
      if (seen.has(nonce)) return false;
      seen.add(nonce);
      return true;
    };

    expect(admit()).toBe(true);
    expect(admit()).toBe(false);

    // And the verdict alone cannot tell you: the presentation is still valid. That is
    // the honest boundary — a pure function can check the nonce, not remember it.
    expect(verifyPresentation(presentation, { challenge: challenge(), now: T0 }).verified).toBe(
      true,
    );
  });
});
