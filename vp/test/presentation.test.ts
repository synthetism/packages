import { decodeCredential } from "@synthetism/credential";
import { describe, expect, it } from "vitest";
import {
  createUnsignedPresentation,
  present,
  presentationSigningInput,
  type ISigner,
} from "../src/index.js";
import {
  T0,
  T0_SECONDS,
  authorizationCredential,
  challengeOnTheWire,
  identity,
  presentationFor,
} from "./helpers.js";

describe("present", () => {
  it("signs under the holder's key, inside the verifier's challenge", async () => {
    const service = identity();
    const agent = identity();
    const vc = await authorizationCredential(service, agent);

    const { presentation, signingInput } = await presentationFor(agent, [vc]);

    const decoded = decodeCredential(presentation);
    expect(decoded?.header).toEqual({ alg: "EdDSA", typ: "JWT" });
    expect(decoded?.payload).toMatchObject({
      iss: agent.did,
      aud: "did:web:api.example.com",
      jti: "urn:presentation:fixed",
      nonce: "nonce-one",
      iat: T0_SECONDS,
      nbf: T0_SECONDS,
      exp: T0_SECONDS + 120,
    });

    // The window is in the *document* too, not only in the claims. `nbf` and `exp`
    // MUST represent these two fields, so a document without them would leave those
    // claims representing nothing.
    expect(presentation.issuanceDate).toBe("2026-06-01T00:00:00.000Z");
    expect(presentation.expirationDate).toBe("2026-06-01T00:02:00.000Z");
    expect(decoded?.payload.vp).toEqual({ ...presentation, proof: undefined });

    // The proof covers the exact bytes we were handed, and names the holder.
    expect(signingInput).toBe((presentation.proof?.jwt as string).split(".").slice(0, 2).join("."));
    expect(presentation.proof?.verificationMethod).toBe(agent.did);
  });

  it("★ keeps the verifier's nonce and the presentation's own id apart", async () => {
    const agent = identity();
    const { presentation } = await presentationFor(agent, []);

    const claims = decodeCredential(presentation)?.payload;

    // The nonce gets the lookup; `jti` says which artifact this is. A decoder that
    // read the nonce as `id` would rebuild a document nobody ever signed.
    expect(claims?.nonce).toBe("nonce-one");
    expect(claims?.jti).toBe("urn:presentation:fixed");
    expect(claims?.jti).toBe(presentation.id);
    expect(claims?.jti).not.toBe(claims?.nonce);
  });

  it("★ pins the clock, so signing the same presentation twice produces the same bytes", async () => {
    const agent = identity();
    const unsigned = createUnsignedPresentation({
      holder: { id: agent.did },
      credentials: [],
    });

    const first = await present(unsigned, agent.signer, challengeOnTheWire(), { now: T0 });
    const second = await present(unsigned, agent.signer, challengeOnTheWire(), { now: T0 });

    // Without the pin, `nbf` is read twice from a moving clock and the JWT covers
    // bytes that are not the ones the signer was given.
    expect(second.signingInput).toBe(first.signingInput);
    expect(second.presentation.proof?.jwt).toBe(first.presentation.proof?.jwt);
  });

  it("signs the same bytes presentationSigningInput says it will", async () => {
    const agent = identity();
    const unsigned = createUnsignedPresentation({
      holder: { id: agent.did },
      credentials: [],
      id: "urn:presentation:fixed",
    });

    const input = presentationSigningInput(unsigned, challengeOnTheWire(), { now: T0 });
    const { presentation } = await present(unsigned, agent.signer, challengeOnTheWire(), {
      now: T0,
    });

    expect(input).toBe((presentation.proof?.jwt as string).split(".").slice(0, 2).join("."));
  });

  it("refuses a presentation with no holder", async () => {
    const agent = identity();
    const unsigned = createUnsignedPresentation({ holder: { id: "" }, credentials: [] });

    await expect(present(unsigned, agent.signer, challengeOnTheWire(), { now: T0 })).rejects.toThrow(
      /malformed presentation/,
    );
  });

  it("refuses a challenge that addresses no one", async () => {
    const agent = identity();
    const unsigned = createUnsignedPresentation({
      holder: { id: agent.did },
      credentials: [],
    });

    await expect(
      present(unsigned, agent.signer, { aud: "", nonce: "n", expiresIn: 60 }, { now: T0 }),
    ).rejects.toThrow(/must name the verifier/);
  });

  it("refuses a challenge with no window", async () => {
    const agent = identity();
    const unsigned = createUnsignedPresentation({
      holder: { id: agent.did },
      credentials: [],
    });

    await expect(
      present(unsigned, agent.signer, { aud: "did:web:a.example", nonce: "n", expiresIn: 0 }),
    ).rejects.toThrow(/positive expiresIn/);
  });

  it("refuses a signer that returns nothing", async () => {
    const agent = identity();
    const unsigned = createUnsignedPresentation({
      holder: { id: agent.did },
      credentials: [],
    });

    await expect(
      present(unsigned, { sign: async () => "" }, challengeOnTheWire(), { now: T0 }),
    ).rejects.toThrow(/no signature/);
  });

  it("refuses a signer that is not one", async () => {
    const agent = identity();
    const unsigned = createUnsignedPresentation({
      holder: { id: agent.did },
      credentials: [],
    });

    await expect(
      present(unsigned, {} as unknown as ISigner, challengeOnTheWire(), { now: T0 }),
    ).rejects.toThrow(/sign\(data\) method/);
  });
});
