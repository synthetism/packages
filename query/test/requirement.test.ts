/**
 * The requirement as an artifact — the properties that make it more than advice.
 *
 * Every fixture here goes through `createRequirement`, which is the point: the tests
 * exercise the path a service actually takes, and that path cannot name the language
 * address. The only `@synthetism/vc` import is `issue`/`verify`, because a credential is
 * what a service publishes a requirement inside.
 */

import { createPrivateKey, sign as nodeSign } from "node:crypto";
import { didKeyFromPublicKey } from "@synthetism/did";
import { generateKeyPair, hexPrivateKeyToPem } from "@synthetism/keys";
import { type ISigner, issue, verify } from "@synthetism/vc";
import { describe, expect, it } from "vitest";
import { LANGUAGE_SCHEMA, createRequirement } from "../src/index.js";

interface TestIdentity {
  did: string;
  /** A real Ed25519 signer on `node:crypto` — not on `@synthetism/signer`. */
  signer: ISigner;
}

/** A fresh Ed25519 identity: a raw key pair, the `did:key` for it, and a signer. */
function identity(): TestIdentity {
  const { privateKey, publicKey } = generateKeyPair("ed25519", { format: "hex" });

  const pem = hexPrivateKeyToPem(privateKey);
  if (pem === null) throw new Error("could not convert the test key to PEM");

  const key = createPrivateKey(pem);

  return {
    did: didKeyFromPublicKey(publicKey),
    signer: {
      sign: async (data: string) =>
        nodeSign(null, Buffer.from(data), key).toString("base64url"),
    },
  };
}

/**
 * A requirement, built the way a service builds one — the content is the caller's, the
 * envelope is not.
 */
function requirementFor(serviceDid: string) {
  return createRequirement({
    name: "market-read",
    version: "3",
    requirements: {
      authorization: {
        type: "AuthorizationCredential",
        required: true,
        match: { scope: ["read"] },
      },
    },
    issuer: { id: serviceDid },
    validity: { from: "2026-01-01T00:00:00.000Z" },
  });
}

describe("the query language", () => {
  it("★ puts the language version in the address, not the service's revision", () => {
    const service = identity();
    const unsigned = requirementFor(service.did);

    // The service's revision is `3`. The address says `v1`, because that is the language
    // — and a service writing its own address would have written `.../v3`, claiming a
    // language version that does not exist.
    expect(unsigned.credentialSchema).toEqual({
      id: LANGUAGE_SCHEMA,
      type: "JsonSchemaValidator2018",
    });
    expect(unsigned.credentialSubject.requirement.version).toBe("3");
    expect(JSON.stringify(unsigned.credentialSchema)).not.toContain("/v3");
  });

  it("is data, and it is signed by the service that will enforce it", async () => {
    const service = identity();

    const { credential } = await issue(requirementFor(service.did), service.signer);

    // The signature is what makes it more than advice: the caller is told what is
    // needed *by the party that will check it*, so a lookalike cannot talk an agent
    // into over-disclosure.
    expect(verify(credential).verified).toBe(true);
    expect(credential.issuer.id).toBe(service.did);
  });

  it("★ carries two versions, and they are different facts", async () => {
    const service = identity();
    const { credential } = await issue(requirementFor(service.did), service.signer);

    // The service's revision of its own requirement.
    expect(credential.credentialSubject.requirement.version).toBe("3");

    // The language it is written in — frozen per major, and the same for everybody.
    expect(credential.credentialSchema).toEqual({
      id: LANGUAGE_SCHEMA,
      type: "JsonSchemaValidator2018",
    });
  });

  it("★ an address edited in flight breaks the signature, not just the lookup", async () => {
    const service = identity();
    const { credential } = await issue(requirementFor(service.did), service.signer);

    const moved = {
      ...credential,
      credentialSchema: {
        id: "https://elsewhere.example/schema",
        type: "JsonSchemaValidator2018",
      },
    };
    expect(verify(moved).verified).toBe(false);
  });

  it("needs no code that knows a scope by name — the requirement says it", async () => {
    const service = identity();
    const { credential } = await issue(requirementFor(service.did), service.signer);

    // A funnel enforces this by reading it, not by hard-coding "read".
    const asked = credential.credentialSubject.requirement.requirements.authorization;

    expect(asked?.type).toBe("AuthorizationCredential");
    expect(asked?.required).toBe(true);
    expect(asked?.match?.scope).toEqual(["read"]);
  });

  it("is plain JSON — it survives the wire it is published on", () => {
    const service = identity();
    const subject = requirementFor(service.did).credentialSubject;

    expect(JSON.parse(JSON.stringify(subject))).toEqual(subject);
  });

  it("★ refuses a requirement that demands nothing", () => {
    const service = identity();

    expect(() =>
      createRequirement({ name: "empty", version: "1", requirements: {}, issuer: { id: service.did } }),
    ).toThrow(/must demand at least one thing/);
  });
});
