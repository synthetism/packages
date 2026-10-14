import { describe, expect, it } from "vitest";
import { didKeyFromPublicKey } from "@synthetism/did";
import {
  derivePublicKey,
  generateKeyPair,
  hexPrivateKeyToPem,
  hexToPem,
  verifyEd25519,
} from "@synthetism/keys";
import { createUnsigned, issue, verify, type ISigner } from "@synthetism/vc";
import { Signer } from "../src/index.js";

/** A fresh Ed25519 hex seed. */
function seed(): string {
  return generateKeyPair("ed25519", { format: "hex" }).privateKey;
}

/** That identity's public key as PEM, for `verifyEd25519`. */
function pemFor(publicKeyHex: string): string {
  const pem = hexToPem(publicKeyHex, "ed25519");
  if (pem === null) throw new Error("expected a PEM");
  return pem;
}

describe("Signer.from", () => {
  it("reads a hex seed and derives the matching public key", () => {
    const privateKeyHex = seed();

    // Two independent derivations have to agree: the signer parses the JWK export,
    // `keys` derives from the seed.
    expect(Signer.from(privateKeyHex).getPublicKeyHex()).toBe(
      derivePublicKey(privateKeyHex),
    );
  });

  it("reads a PKCS#8 PEM and agrees with the hex form of the same key", () => {
    const privateKeyHex = seed();
    const pem = hexPrivateKeyToPem(privateKeyHex);
    if (pem === null) throw new Error("expected a PEM");

    expect(Signer.from(pem).getPublicKeyHex()).toBe(
      Signer.from(privateKeyHex).getPublicKeyHex(),
    );
  });

  it("honours an explicit format", () => {
    const privateKeyHex = seed();

    expect(Signer.from(privateKeyHex, { format: "hex" }).getPublicKeyHex()).toBe(
      derivePublicKey(privateKeyHex),
    );
  });

  it("refuses an empty key", () => {
    expect(() => Signer.from("")).toThrow(TypeError);
    expect(() => Signer.from("   ")).toThrow(TypeError);
  });

  it("refuses something that is not a key", () => {
    expect(() => Signer.from("not-a-key")).toThrow(/not a hex private key/);
  });

  it("refuses a PEM that is not a private key", () => {
    const { publicKey } = generateKeyPair("ed25519");

    expect(() => Signer.from(publicKey)).toThrow(/could not read that private key/);
  });

  it("refuses a key that is not Ed25519", () => {
    const { privateKey } = generateKeyPair("x25519");

    expect(() => Signer.from(privateKey)).toThrow(/only Ed25519 keys are supported/);
  });
});

describe("Signer.sign", () => {
  it("produces a signature the floor verifies", async () => {
    const signer = Signer.from(seed());

    const signature = await signer.sign("the exact bytes");

    expect(verifyEd25519("the exact bytes", signature, pemFor(signer.getPublicKeyHex()))).toBe(
      true,
    );
  });

  it("returns base64url, so the signature survives being put in a JWT", async () => {
    const signature = await Signer.from(seed()).sign("x");

    expect(signature).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("is deterministic — Ed25519 needs no randomness", async () => {
    const signer = Signer.from(seed());

    expect(await signer.sign("same")).toBe(await signer.sign("same"));
  });

  it("signs different bytes differently", async () => {
    const signer = Signer.from(seed());

    expect(await signer.sign("a")).not.toBe(await signer.sign("b"));
  });

  it("does not verify against somebody else's key", async () => {
    const mine = Signer.from(seed());
    const theirs = Signer.from(seed());

    expect(verifyEd25519("data", await mine.sign("data"), pemFor(theirs.getPublicKeyHex()))).toBe(
      false,
    );
  });
});

describe("the seam, end to end", () => {
  it("is usable anywhere the port is expected", () => {
    const port: ISigner = Signer.from(seed());

    expect(typeof port.sign).toBe("function");
  });

  it("issues a credential that `vc.verify` accepts", async () => {
    const signer = Signer.from(seed());
    const did = didKeyFromPublicKey(signer.getPublicKeyHex());

    const unsigned = createUnsigned({
      subject: { holder: { id: did } },
      type: "IdentityCredential",
      issuer: { id: did },
      id: "urn:credential:signer-test:1",
      validity: { from: "2026-01-01T00:00:00.000Z" },
    });

    const { credential } = await issue(unsigned, signer);

    expect(verify(credential)).toEqual({ verified: true, errors: [] });
  });
});
