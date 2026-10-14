import { describe, expect, it } from "vitest";
import { hexToPem } from "@synthetism/keys";
import { issue, resolveDidKey, verify, type Proof } from "../src/index.js";
import { identity, unsignedFor } from "./helpers.js";

/** A valid credential, signed by a real key. */
async function issued(from = "2026-01-01T00:00:00.000Z", until?: string) {
  const alice = identity();
  const { credential } = await issue(
    unsignedFor(alice.did, { from, ...(until === undefined ? {} : { until }) }),
    alice.signer,
  );
  return { alice, credential };
}

describe("verify", () => {
  it("accepts a credential it issued", async () => {
    const { credential } = await issued();

    expect(verify(credential)).toEqual({ verified: true, errors: [] });
  });

  it("rejects a document edited after signing", async () => {
    const { credential } = await issued();
    const edited = {
      ...credential,
      credentialSubject: { ...credential.credentialSubject, scope: ["read", "write"] },
    };

    const result = verify(edited);

    expect(result.verified).toBe(false);
    expect(result.errors.join(" ")).toMatch(/does not match the signed payload/);
  });

  it("rejects a single flipped byte of the signature", async () => {
    const { credential } = await issued();
    const [head, body, signature] = (credential.proof?.jwt as string).split(".");
    const flip = signature?.startsWith("A") ? "B" : "A";
    const jwt = `${head}.${body}.${flip}${signature?.slice(1)}`;

    expect(verify({ ...credential, proof: { ...(credential.proof as Proof), jwt } })).toEqual({
      verified: false,
      errors: ["signature does not verify"],
    });
  });

  it("rejects a credential signed by a key that is not the issuer's", async () => {
    const alice = identity();
    const mallory = identity();

    // The issuer is Mallory; the signature is Alice's.
    const { credential } = await issue(unsignedFor(mallory.did), alice.signer);

    expect(verify(credential)).toEqual({
      verified: false,
      errors: ["signature does not verify"],
    });
  });

  it("★ rejects alg: none without ever calling the verifier", async () => {
    const { credential } = await issued();
    const [, body] = (credential.proof?.jwt as string).split(".");
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
      "base64url",
    );
    let called = false;

    const result = verify(
      { ...credential, proof: { ...(credential.proof as Proof), jwt: `${header}.${body}.` } },
      {
        verify: () => {
          called = true;
          return true;
        },
      },
    );

    expect(result.verified).toBe(false);
    expect(result.errors.join(" ")).toMatch(/alg "none" is not accepted/);
    expect(result.errors.join(" ")).toMatch(/empty signature/);
    expect(called).toBe(false);
  });

  it("rejects an unexpected proof type", async () => {
    const { credential } = await issued();

    const result = verify({
      ...credential,
      proof: { ...credential.proof, type: "Ed25519Signature2020" },
    });

    expect(result.errors.join(" ")).toMatch(/proof.type must be JwtProof2020/);
  });

  it("reports a missing proof", async () => {
    const { credential } = await issued();
    const unsigned = { ...credential } as Record<string, unknown>;
    delete unsigned["proof"];

    expect(verify(unsigned as unknown as typeof credential)).toEqual({
      verified: false,
      errors: ["no proof"],
    });
  });

  it("rejects a JWT that is not three parts", async () => {
    const { credential } = await issued();

    const result = verify({
      ...credential,
      proof: { type: "JwtProof2020", jwt: "header.payload" },
    });

    expect(result.errors).toContain("proof.jwt is not a three-part JWT");
  });

  it("refuses to resolve a method it has no resolver for", async () => {
    const alice = identity();
    const { credential } = await issue(unsignedFor("did:web:alice.example"), alice.signer);

    const result = verify(credential);

    expect(result.verified).toBe(false);
    expect(result.errors).toContain("cannot resolve did:web:alice.example to a public key");
  });

  it("honours an injected resolver", async () => {
    const alice = identity();
    const { credential } = await issue(unsignedFor("did:web:alice.example"), alice.signer);

    const result = verify(credential, {
      resolve: (did) =>
        did === "did:web:alice.example"
          ? (hexToPem(alice.publicKeyHex, "ed25519") ?? undefined)
          : undefined,
    });

    expect(result).toEqual({ verified: true, errors: [] });
  });

  it("rejects an expired credential, and accepts it inside its window", async () => {
    const { credential } = await issued("2020-01-01T00:00:00.000Z", "2020-01-02T00:00:00.000Z");

    expect(verify(credential).errors.join(" ")).toMatch(/expired at/);
    expect(verify(credential, { now: new Date("2020-01-01T12:00:00.000Z") })).toEqual({
      verified: true,
      errors: [],
    });
  });

  it("rejects a credential that is not valid yet", async () => {
    const { credential } = await issued("2099-01-01T00:00:00.000Z");

    expect(verify(credential).errors.join(" ")).toMatch(/not valid before/);
    expect(verify(credential, { now: new Date("2099-01-02T00:00:00.000Z") }).verified).toBe(
      true,
    );
  });

  it("reports structural damage", async () => {
    const { credential } = await issued();
    const broken = { ...credential } as Record<string, unknown>;
    delete broken["@context"];

    expect(verify(broken as unknown as typeof credential).errors.join(" ")).toMatch(
      /structure: @context/,
    );
  });

  it("accepts an edited document only when told to stop comparing", async () => {
    const { credential } = await issued();
    const edited = { ...credential, credentialSubject: { tampered: true } };

    expect(verify(edited).verified).toBe(false);
    expect(verify(edited, { checkDocument: false })).toEqual({
      verified: true,
      errors: [],
    });
  });

  it("never throws, whatever it is handed", async () => {
    expect(verify({} as never).verified).toBe(false);
    expect(verify("nope" as never).verified).toBe(false);
    expect(verify(null as never).verified).toBe(false);
  });
});

describe("resolveDidKey", () => {
  it("turns a did:key into a PEM public key", () => {
    const { did } = identity();

    expect(resolveDidKey(did)).toMatch(/^-----BEGIN PUBLIC KEY-----/);
  });

  it("returns undefined for a DID it does not understand", () => {
    expect(resolveDidKey("did:web:example.com")).toBeUndefined();
    expect(resolveDidKey("nonsense")).toBeUndefined();
  });
});
