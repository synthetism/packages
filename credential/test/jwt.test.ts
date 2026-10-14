import { describe, expect, it } from "vitest";
import {
  attachProof,
  canonicalize,
  createUnsigned,
  decodeCredential,
  signedPortion,
  signingInput,
  validateStructure,
  type IdentitySubject,
} from "../src/index.js";

const issuer = { id: "did:key:z6MkrL8otjELxqEcmQZHM11UE1n9czAYSWNLQKRfXQH1ypnw" };
const subject: IdentitySubject = {
  holder: issuer,
  issuedBy: issuer,
};

function fixed() {
  return createUnsigned({
    subject,
    type: "IdentityCredential",
    issuer,
    id: "urn:credential:identity-credential:000000000000000000000000",
    validity: { from: "2026-01-01T00:00:00.000Z" },
  });
}

describe("canonicalize", () => {
  it("sorts keys recursively", () => {
    expect(canonicalize({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it("keeps array order", () => {
    expect(canonicalize([3, 1, 2])).toBe("[3,1,2]");
  });

  it("drops undefined values", () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe('{"a":1}');
  });
});

describe("signingInput", () => {
  it("is a JWT signing input: two base64url segments", () => {
    const parts = signingInput(fixed()).split(".");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("is deterministic regardless of key order", () => {
    const a = createUnsigned({
      subject: { holder: issuer, issuedBy: issuer, scope: ["read"] },
      type: "IdentityCredential",
      issuer,
      id: "urn:fixed",
      validity: { from: "2026-01-01T00:00:00.000Z" },
    });
    const b = createUnsigned({
      subject: { scope: ["read"], issuedBy: issuer, holder: issuer },
      type: "IdentityCredential",
      issuer,
      id: "urn:fixed",
      validity: { from: "2026-01-01T00:00:00.000Z" },
    });

    expect(signingInput(a)).toBe(signingInput(b));
  });

  it("changes when the subject changes", () => {
    const a = fixed();
    const b = { ...fixed(), credentialSubject: { holder: issuer, issuedBy: issuer, extra: 1 } };
    expect(signingInput(a)).not.toBe(signingInput(b));
  });

  it("carries no proof into the signed payload", () => {
    const input = signingInput(fixed());
    const payload = JSON.parse(
      Buffer.from(input.split(".")[1] as string, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(["iss", "jti", "nbf", "vc"]);
    expect(payload.iss).toBe(issuer.id);
  });
});

describe("attachProof / signedPortion", () => {
  it("attaches a JWT proof", () => {
    const vc = attachProof(fixed(), "signature");
    expect(vc.proof?.type).toBe("JwtProof2020");
    expect(vc.proof?.jwt?.endsWith(".signature")).toBe(true);
  });

  it("signedPortion returns exactly the bytes that were signed", () => {
    const unsigned = fixed();
    const vc = attachProof(unsigned, "signature");
    expect(signedPortion(vc)).toBe(signingInput(unsigned));
  });

  it("signedPortion returns null without a JWT proof", () => {
    expect(signedPortion(fixed())).toBeNull();
  });
});

describe("decodeCredential", () => {
  it("decodes a real credential issued by the previous stack", () => {
    // The `synet-root` IdentityCredential, verbatim.
    const jwt =
      "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJpZCI6InVybjpzeW5ldDpJZGVudGl0eUNyZWRlbnRpYWw6bWc3bXE0czZ1Mm5kY3dwdHZ3ZnFmNHViIiwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIklkZW50aXR5Q3JlZGVudGlhbCJdLCJpc3N1ZXIiOnsiaWQiOiJkaWQ6a2V5Ono2TWtyTDhvdGpFTHhxRWNtUVpITTExVUUxbjljekFZU1dOTFFLUmZYUUgxeXBudyJ9LCJpc3N1YW5jZURhdGUiOiIyMDI1LTA3LTI1VDA3OjE3OjIwLjAxNFoiLCJjcmVkZW50aWFsU3ViamVjdCI6eyJob2xkZXIiOnsiaWQiOiJkaWQ6a2V5Ono2TWtyTDhvdGpFTHhxRWNtUVpITTExVUUxbjljekFZU1dOTFFLUmZYUUgxeXBudyIsIm5hbWUiOiJzeW5ldC1yb290In0sImlzc3VlZEJ5Ijp7ImlkIjoiZGlkOmtleTp6Nk1rckw4b3RqRUx4cUVjbVFaSE0xMVVFMW45Y3pBWVNXTkxRS1JmWFFIMXlwbnciLCJuYW1lIjoic3luZXQtcm9vdCJ9fX0sImp0aSI6InVybjpzeW5ldDpJZGVudGl0eUNyZWRlbnRpYWw6bWc3bXE0czZ1Mm5kY3dwdHZ3ZnFmNHViIiwibmJmIjoxNzUzNDI3ODQwLCJpc3MiOiJkaWQ6a2V5Ono2TWtyTDhvdGpFTHhxRWNtUVpITTExVUUxbjljekFZU1dOTFFLUmZYUUgxeXBudyJ9.X97_ou5IaDfPW1u57w5_CSfZDPcAFvUIAo7QBpNfWdybbWFfdRMMjRVqk_cIdRg2VtxTO8rMmQPBK-G9SSfgDg";

    const vc = { ...fixed(), proof: { type: "JwtProof2020", jwt } };
    const decoded = decodeCredential(vc);

    expect(decoded).not.toBeNull();
    expect(decoded?.header.alg).toBe("EdDSA");
    expect(decoded?.payload.iss).toBe(issuer.id);
    expect(decoded?.payload.jti).toBe(
      "urn:synet:IdentityCredential:mg7mq4s6u2ndcwptvwfqf4ub",
    );
    expect(decoded?.payload.nbf).toBe(1753427840);
    expect(signedPortion(vc)).toBe(jwt.split(".").slice(0, 2).join("."));
  });

  it("returns null for a malformed JWT", () => {
    expect(decodeCredential({ ...fixed(), proof: { type: "x", jwt: "nope" } })).toBeNull();
  });
});

describe("validateStructure", () => {
  it("accepts a well-formed credential", () => {
    expect(validateStructure(fixed())).toEqual({ valid: true, errors: [] });
  });

  it("accepts a well-formed presentation", () => {
    const vp = { ...fixed(), type: ["VerifiablePresentation"], holder: issuer, verifiableCredential: [] };
    const result = validateStructure(vp);
    expect(result.valid).toBe(true);
  });

  it("reports every problem it finds", () => {
    const result = validateStructure({ "@context": [], type: [], issuer: {} });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });

  it("rejects non-objects", () => {
    expect(validateStructure(null).valid).toBe(false);
    expect(validateStructure("nope").valid).toBe(false);
  });
});
