import { describe, expect, it } from "vitest";
import {
  createUnsigned,
  createUnsignedPresentation,
  credentialId,
  presentationId,
  schemaUri,
  type IdentitySubject,
} from "../src/index.js";

const issuer = { id: "did:key:z6MkrL8otjELxqEcmQZHM11UE1n9czAYSWNLQKRfXQH1ypnw", name: "bob" };

const subject: IdentitySubject = {
  holder: { id: issuer.id, name: "bob" },
  issuedBy: { id: issuer.id, name: "bob" },
};

describe("schemaUri", () => {
  it("builds a canonical schema URI", () => {
    expect(schemaUri("IpAsset", "1.0.0")).toBe(
      "https://synthetism.org/schemas/IpAsset/1.0.0",
    );
  });
});

describe("ids", () => {
  it("builds a urn:credential id", () => {
    expect(credentialId("IdentityCredential")).toMatch(
      /^urn:credential:identity-credential:[0-9a-f]{24}$/,
    );
  });

  it("honours an explicit id (for reproducibility)", () => {
    expect(credentialId("IdentityCredential", "urn:fixed")).toBe("urn:fixed");
  });

  it("builds a urn:presentation id", () => {
    expect(presentationId()).toMatch(/^urn:presentation:[0-9a-f]{24}$/);
  });
});

describe("createUnsigned", () => {
  it("produces a W3C-shaped credential", () => {
    const vc = createUnsigned({ subject, type: "IdentityCredential", issuer });

    expect(vc["@context"]).toEqual(["https://www.w3.org/2018/credentials/v1"]);
    expect(vc.type).toEqual(["VerifiableCredential", "IdentityCredential"]);
    expect(vc.issuer).toEqual(issuer);
    expect(vc.credentialSubject).toEqual(subject);
  });

  it("never contains a proof", () => {
    const vc = createUnsigned({ subject, type: "IdentityCredential", issuer });
    expect("proof" in vc).toBe(false);
  });

  it("adds VerifiableCredential without duplicating it", () => {
    const vc = createUnsigned({
      subject,
      type: ["VerifiableCredential", "IdentityCredential"],
      issuer,
    });
    expect(vc.type).toEqual(["VerifiableCredential", "IdentityCredential"]);
  });

  it("fills issuanceDate and id", () => {
    const vc = createUnsigned({ subject, type: "IdentityCredential", issuer });
    expect(Number.isNaN(Date.parse(vc.issuanceDate))).toBe(false);
    expect(vc.id.startsWith("urn:credential:")).toBe(true);
  });

  it("accepts explicit validity", () => {
    const vc = createUnsigned({
      subject,
      type: "IdentityCredential",
      issuer,
      id: "urn:fixed",
      validity: { from: "2026-01-01T00:00:00.000Z", until: "2027-01-01T00:00:00.000Z" },
    });
    expect(vc.id).toBe("urn:fixed");
    expect(vc.issuanceDate).toBe("2026-01-01T00:00:00.000Z");
    expect(vc.expirationDate).toBe("2027-01-01T00:00:00.000Z");
  });

  it("omits expirationDate when there is no until", () => {
    const vc = createUnsigned({ subject, type: "IdentityCredential", issuer });
    expect("expirationDate" in vc).toBe(false);
  });
});

describe("createUnsignedPresentation", () => {
  it("bundles credentials without a proof", () => {
    const vp = createUnsignedPresentation({ holder: issuer, credentials: [] });
    expect(vp.type).toEqual(["VerifiablePresentation"]);
    expect(vp.verifiableCredential).toEqual([]);
    expect("proof" in vp).toBe(false);
  });
});
