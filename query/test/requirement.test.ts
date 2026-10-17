/**
 * The requirement as an artifact — the properties that make it more than advice.
 *
 * Moved here with the types it tests. It asserts what a *requirement* is, not what a
 * presentation is, and the only reason it needs `@synthetism/vc` is that a credential is
 * what a service publishes it inside.
 */

import { createPrivateKey, sign as nodeSign } from "node:crypto";
import { createUnsigned } from "@synthetism/credential";
import { didKeyFromPublicKey } from "@synthetism/did";
import { generateKeyPair, hexPrivateKeyToPem } from "@synthetism/keys";
import { type ISigner, issue, verify } from "@synthetism/vc";
import { describe, expect, it } from "vitest";
import type { RequirementSubject } from "../src/index.js";

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

/** Where a *language* version is addressed — not where a service's revision lives. */
const LANGUAGE_URL = "https://synthetism.org/schemas/query/v1";

/**
 * A requirement, verbatim as the docs publish it — so the documentation cannot drift
 * away from something that compiles.
 */
function marketRead(serviceDid: string): RequirementSubject {
  return {
    holder: { id: serviceDid },
    requirement: {
      name: "market-read",
      version: "3",
      requirements: {
        authorization: {
          type: "AuthorizationCredential",
          required: true,
          match: { scope: ["read"] },
        },
      },
    },
  };
}

/** The credential a service publishes it in: the requirement, plus where it lives. */
function requirementCredential(serviceDid: string) {
  return {
    subject: marketRead(serviceDid),
    type: "RequirementCredential",
    issuer: { id: serviceDid },
    validity: { from: "2026-01-01T00:00:00.000Z" },
    credentialSchema: { id: LANGUAGE_URL, type: "JsonSchemaValidator2018" },
  };
}

describe("the query language", () => {
  it("is data, and it is signed by the service that will enforce it", async () => {
    const service = identity();

    const unsigned = createUnsigned(requirementCredential(service.did));

    const { credential } = await issue(unsigned, service.signer);

    // The signature is what makes it more than advice: the caller is told what is
    // needed *by the party that will check it*, so a lookalike cannot talk an agent
    // into over-disclosure.
    expect(verify(credential).verified).toBe(true);
    expect(credential.issuer.id).toBe(service.did);
  });

  it("★ carries two versions, and they are different facts", async () => {
    const service = identity();
    const { credential } = await issue(
      createUnsigned(requirementCredential(service.did)),
      service.signer,
    );

    // The service's revision of its own requirement.
    expect(credential.credentialSubject.requirement.version).toBe("3");

    // The language it is written in — frozen per major, and the same for everybody.
    expect(credential.credentialSchema).toEqual({
      id: LANGUAGE_URL,
      type: "JsonSchemaValidator2018",
    });
  });

  it("★ an address edited in flight breaks the signature, not just the lookup", async () => {
    const service = identity();
    const { credential } = await issue(
      createUnsigned(requirementCredential(service.did)),
      service.signer,
    );

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
    const { credential } = await issue(
      createUnsigned({
        subject: marketRead(service.did),
        type: "RequirementCredential",
        issuer: { id: service.did },
      }),
      service.signer,
    );

    // A funnel enforces this by reading it, not by hard-coding "read".
    const asked = credential.credentialSubject.requirement.requirements.authorization;

    expect(asked?.type).toBe("AuthorizationCredential");
    expect(asked?.required).toBe(true);
    expect(asked?.match?.scope).toEqual(["read"]);
  });

  it("is plain JSON — it survives the wire it is published on", () => {
    const service = identity();
    const subject = marketRead(service.did);

    expect(JSON.parse(JSON.stringify(subject))).toEqual(subject);
  });
});
