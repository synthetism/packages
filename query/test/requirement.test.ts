/**
 * The requirement as an artifact — and the composition that makes it one.
 *
 * `createRequirement` returns a **subject**; wrapping it in a credential is this file's job,
 * exactly as it is an app's. That is the whole point of the split: the language knows what a
 * requirement says, and `@synthetism/credential` knows what a credential is.
 */

import { createPrivateKey, sign as nodeSign } from "node:crypto";
import { createUnsigned } from "@synthetism/credential";
import { didKeyFromPublicKey } from "@synthetism/did";
import { generateKeyPair, hexPrivateKeyToPem } from "@synthetism/keys";
import { type ISigner, issue, verify } from "@synthetism/vc";
import { describe, expect, it } from "vitest";
import {
  LANGUAGE_ADDRESS,
  LANGUAGE_CREDENTIAL_SCHEMA,
  createRequirement,
} from "../src/index.js";

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

/** The composition an app performs — subject from the language, envelope from the format. */
function requirementCredential(serviceDid: string) {
  return createUnsigned({
    subject: createRequirement({
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
    }),
    type: "RequirementCredential",
    issuer: { id: serviceDid },
    credentialSchema: LANGUAGE_CREDENTIAL_SCHEMA,
    validity: { from: "2026-01-01T00:00:00.000Z" },
  });
}

describe("the query language", () => {
  it("★ the subject carries the content, and nothing about the envelope", () => {
    const subject = createRequirement({
      name: "market-read",
      version: "3",
      requirements: { authorization: { type: "AuthorizationCredential" } },
      issuer: { id: "did:key:z6MkpService" },
    });

    // No `@context`, no `type`, no `credentialSchema`, no date. Those are the format's, and
    // this package no longer has an opinion about them.
    expect(Object.keys(subject).sort()).toEqual(["holder", "requirement"]);
    expect(subject.requirement.version).toBe("3");
  });

  it("★ puts the language version in the address, not the service's revision", () => {
    const service = identity();
    const unsigned = requirementCredential(service.did);

    // The service's revision is `3`. The address says `v1`, because that is the language —
    // and a service writing its own address would have written `.../v3`, claiming a language
    // version that does not exist. That was the funnel's bug, and this is the fix.
    expect(unsigned.credentialSchema).toEqual(LANGUAGE_CREDENTIAL_SCHEMA);
    expect(unsigned.credentialSubject.requirement.version).toBe("3");
    expect(JSON.stringify(unsigned.credentialSchema)).not.toContain("/v3");
  });

  it("is data, and it is signed by the service that will enforce it", async () => {
    const service = identity();

    const { credential } = await issue(requirementCredential(service.did), service.signer);

    expect(verify(credential).verified).toBe(true);
    expect(credential.issuer.id).toBe(service.did);
  });

  it("★ an address edited in flight breaks the signature, not just the lookup", async () => {
    const service = identity();
    const { credential } = await issue(requirementCredential(service.did), service.signer);

    const moved = {
      ...credential,
      credentialSchema: {
        id: "https://elsewhere.example/schema",
        type: "JsonSchemaValidator2018",
      },
    };
    expect(verify(moved).verified).toBe(false);
  });

  it("★ forgetting the address is a named failure, not a silent one", () => {
    // The trade this split makes: the address is a constant now, so it can be omitted. That
    // is survivable only because omitting it is loud — which is what `unsupported-language`
    // with "names no credentialSchema.id" is for. Asserted in @synthetism/utils.
    expect(LANGUAGE_CREDENTIAL_SCHEMA.id).toBe(LANGUAGE_ADDRESS);
    expect(LANGUAGE_CREDENTIAL_SCHEMA.id).not.toContain("v3");
  });

  it("★ refuses a requirement that demands nothing", () => {
    const service = identity();

    expect(() =>
      createRequirement({
        name: "empty",
        version: "1",
        requirements: {},
        issuer: { id: service.did },
      }),
    ).toThrow(/must demand at least one thing/);
  });
});
