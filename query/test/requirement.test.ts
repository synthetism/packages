/**
 * The requirement as an artifact — the properties that make it more than advice.
 *
 * Every fixture goes through `createRequirement`, which is the point: it is the path a
 * service actually takes, and that path cannot name the language address.
 */

import { createPrivateKey, sign as nodeSign } from "node:crypto";
import { didKeyFromPublicKey } from "@synthetism/did";
import { generateKeyPair, hexPrivateKeyToPem } from "@synthetism/keys";
import { type ISigner, issue, verify } from "@synthetism/vc";
import { describe, expect, it } from "vitest";
import { LANGUAGE_ADDRESS, createRequirement } from "../src/index.js";

interface TestIdentity {
  did: string;
  /** A real Ed25519 signer on `node:crypto` — not on `@synthetism/signer`. */
  signer: ISigner;
}

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

/** A requirement, built the way a service builds one — `match` is a JSON Schema now. */
function requirementFor(serviceDid: string) {
  return createRequirement({
    name: "market-read",
    version: "3",
    requirements: {
      authorization: {
        type: "AuthorizationCredential",
        required: true,
        match: {
          type: "object",
          properties: { resource: { const: "https://api.example.com/market" } },
          required: ["resource"],
        },
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

    // The service's revision is `3`. The address says `v1`, because that is the language —
    // and a service writing its own address would have written `.../v3`, claiming a language
    // version that does not exist.
    expect(unsigned.credentialSchema).toEqual({
      id: LANGUAGE_ADDRESS,
      type: "JsonSchemaValidator2018",
    });
    expect(unsigned.credentialSubject.requirement.version).toBe("3");
    expect(JSON.stringify(unsigned.credentialSchema)).not.toContain("/v3");
  });

  it("is data, and it is signed by the service that will enforce it", async () => {
    const service = identity();

    const { credential } = await issue(requirementFor(service.did), service.signer);

    expect(verify(credential).verified).toBe(true);
    expect(credential.issuer.id).toBe(service.did);
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

  it("★ refuses a requirement that demands nothing", () => {
    const service = identity();

    expect(() =>
      createRequirement({ name: "empty", version: "1", requirements: {}, issuer: { id: service.did } }),
    ).toThrow(/must demand at least one thing/);
  });
});
