/**
 * A credential issued by the **previous** implementation, verified by this one.
 *
 * This is the only test here whose input was not produced by this codebase, so it
 * is the only one that can catch us agreeing with ourselves. The JWT is byte for
 * byte the `synet-root` identity credential.
 *
 * The DID *is* the public key, so verification needs no registry and no network.
 */

import { describe, expect, it } from "vitest";
import { verify, type VerifiableCredential } from "../src/index.js";

const ISSUER = "did:key:z6MkrL8otjELxqEcmQZHM11UE1n9czAYSWNLQKRfXQH1ypnw";

const JWT =
  "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJpZCI6InVybjpzeW5ldDpJZGVudGl0eUNyZWRlbnRpYWw6bWc3bXE0czZ1Mm5kY3dwdHZ3ZnFmNHViIiwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIklkZW50aXR5Q3JlZGVudGlhbCJdLCJpc3N1ZXIiOnsiaWQiOiJkaWQ6a2V5Ono2TWtyTDhvdGpFTHhxRWNtUVpITTExVUUxbjljekFZU1dOTFFLUmZYUUgxeXBudyJ9LCJpc3N1YW5jZURhdGUiOiIyMDI1LTA3LTI1VDA3OjE3OjIwLjAxNFoiLCJjcmVkZW50aWFsU3ViamVjdCI6eyJob2xkZXIiOnsiaWQiOiJkaWQ6a2V5Ono2TWtyTDhvdGpFTHhxRWNtUVpITTExVUUxbjljekFZU1dOTFFLUmZYUUgxeXBudyIsIm5hbWUiOiJzeW5ldC1yb290In0sImlzc3VlZEJ5Ijp7ImlkIjoiZGlkOmtleTp6Nk1rckw4b3RqRUx4cUVjbVFaSE0xMVVFMW45Y3pBWVNXTkxRS1JmWFFIMXlwbnciLCJuYW1lIjoic3luZXQtcm9vdCJ9fX0sImp0aSI6InVybjpzeW5ldDpJZGVudGl0eUNyZWRlbnRpYWw6bWc3bXE0czZ1Mm5kY3dwdHZ3ZnFmNHViIiwibmJmIjoxNzUzNDI3ODQwLCJpc3MiOiJkaWQ6a2V5Ono2TWtyTDhvdGpFTHhxRWNtUVpITTExVUUxbjljekFZU1dOTFFLUmZYUUgxeXBudyJ9.X97_ou5IaDfPW1u57w5_CSfZDPcAFvUIAo7QBpNfWdybbWFfdRMMjRVqk_cIdRg2VtxTO8rMmQPBK-G9SSfgDg";

/**
 * Rebuild the outer document from the signed payload.
 *
 * The credential is *defined* by the JWT, so the visible fields are the ones
 * inside it — not the other way round.
 */
function outerFrom(jwt: string): VerifiableCredential<Record<string, unknown>> {
  const segment = jwt.split(".")[1] as string;
  const claims = JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as {
    vc: Record<string, unknown>;
  };

  // The signed payload *is* the credential document.
  const document = claims.vc as unknown as Omit<
    VerifiableCredential<Record<string, unknown>>,
    "proof"
  >;

  return {
    ...document,
    proof: { type: "JwtProof2020", jwt, verificationMethod: ISSUER },
  };
}

describe("a credential from the previous implementation", () => {
  it("verifies", () => {
    expect(verify(outerFrom(JWT))).toEqual({ verified: true, errors: [] });
  });

  it("fails when one byte of the signature is flipped", () => {
    const [head, body, signature] = JWT.split(".");
    const flip = signature?.startsWith("A") ? "B" : "A";
    const tampered = `${head}.${body}.${flip}${signature?.slice(1)}`;

    expect(verify(outerFrom(tampered)).verified).toBe(false);
  });

  it("fails when the subject is edited", () => {
    const credential = outerFrom(JWT);
    const edited = {
      ...credential,
      credentialSubject: { ...credential.credentialSubject, tampered: true },
    };

    expect(verify(edited).errors.join(" ")).toMatch(/does not match the signed payload/);
  });

  it("fails when the issuer is swapped, even though the document then agrees with itself", () => {
    const credential = outerFrom(JWT);
    const other = "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK";

    // Both sides agree on the new issuer, so only the signature can catch this.
    const edited = { ...credential, issuer: { id: other } };

    const result = verify(edited);

    expect(result.verified).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
