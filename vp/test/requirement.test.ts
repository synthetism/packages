import { createUnsigned } from "@synthetism/credential";
import { issue, verify } from "@synthetism/vc";
import { describe, expect, it } from "vitest";
import type { RequirementSubject } from "../src/index.js";
import { identity } from "./helpers.js";

/** Where the *current* requirement is published — the shape's address. */
const REQUIREMENT_URL = "https://synthetism.org/schemas/market-read/3";

/**
 * The requirement the README publishes, verbatim — so the documentation cannot drift
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

/**
 * The credential a service publishes it in: the requirement, plus the data model's own
 * slot for **where that requirement lives**.
 */
function requirementCredential(serviceDid: string) {
  return {
    subject: marketRead(serviceDid),
    type: "RequirementCredential",
    issuer: { id: serviceDid },
    validity: { from: "2026-01-01T00:00:00.000Z" },
    credentialSchema: { id: REQUIREMENT_URL, type: "JsonSchemaValidator2018" },
  };
}

describe("the VP Language", () => {
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

  it("carries its own version, so a stale copy can fail distinctly", async () => {
    const service = identity();
    const { credential } = await issue(
      createUnsigned(requirementCredential(service.did)),
      service.signer,
    );

    expect(credential.credentialSubject.requirement.version).toBe("3");
  });

  it("★ says where the current version lives — §5.4's field, not one of our own", async () => {
    const service = identity();
    const { credential } = await issue(
      createUnsigned(requirementCredential(service.did)),
      service.signer,
    );

    expect(credential.credentialSchema).toEqual({
      id: REQUIREMENT_URL,
      type: "JsonSchemaValidator2018",
    });

    // The address is inside the signed bytes, so it cannot be rewritten in flight to
    // point somewhere else.
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

  it("is plain JSON — it survives the wire it is published on", async () => {
    const service = identity();
    const subject = marketRead(service.did);

    expect(JSON.parse(JSON.stringify(subject))).toEqual(subject);
  });
});
