import { createPrivateKey, sign as edSign } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  derivePublicKey,
  generateKeyPair,
  hexPrivateKeyToPem,
  hexToPem,
  verifyEd25519,
} from "../src/index.js";

/** A fresh ed25519 pair in hex. */
function pair(): { privateHex: string; publicHex: string } {
  const kp = generateKeyPair("ed25519", { format: "hex" });
  return { privateHex: kp.privateKey, publicHex: kp.publicKey };
}

/**
 * Sign with node:crypto directly. This package deliberately ships NO signer, so
 * the test proves `verify()` against an independently-produced signature.
 */
function signWith(privateHex: string, data: string): string {
  const pem = hexPrivateKeyToPem(privateHex);
  if (!pem) throw new Error("hexPrivateKeyToPem returned null");
  const key = createPrivateKey({ key: pem, format: "pem" });
  return edSign(null, Buffer.from(data), key).toString("base64url");
}

describe("generateKeyPair", () => {
  it("produces 32-byte ed25519 keys in hex", () => {
    const { privateHex, publicHex } = pair();
    expect(privateHex).toMatch(/^[0-9a-f]{64}$/);
    expect(publicHex).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces a different pair every time", () => {
    expect(pair().privateHex).not.toBe(pair().privateHex);
  });
});

describe("derivePublicKey (hex)", () => {
  it("derives the public key from the private seed — nothing stored", () => {
    const { privateHex, publicHex } = pair();
    expect(derivePublicKey(privateHex)).toBe(publicHex);
  });

  it("is deterministic", () => {
    const { privateHex } = pair();
    expect(derivePublicKey(privateHex)).toBe(derivePublicKey(privateHex));
  });

  it("rejects non-hex input instead of throwing", () => {
    expect(derivePublicKey("not-a-key")).toBeNull();
    expect(derivePublicKey("")).toBeNull();
  });
});

describe("verifyEd25519", () => {
  const data = "hello synthetism";

  it("verifies a real signature against the DERIVED public key", () => {
    const { privateHex, publicHex } = pair();
    const signature = signWith(privateHex, data);
    const publicPem = hexToPem(publicHex, "ed25519");
    expect(publicPem).not.toBeNull();
    expect(verifyEd25519(data, signature, publicPem as string)).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const { privateHex, publicHex } = pair();
    const signature = signWith(privateHex, data);
    const publicPem = hexToPem(publicHex, "ed25519") as string;
    expect(verifyEd25519("hello tampered", signature, publicPem)).toBe(false);
  });

  it("rejects a signature made by a different key", () => {
    const a = pair();
    const b = pair();
    const signature = signWith(a.privateHex, data);
    const wrongPem = hexToPem(b.publicHex, "ed25519") as string;
    expect(verifyEd25519(data, signature, wrongPem)).toBe(false);
  });

  it("rejects garbage instead of throwing", () => {
    const { publicHex } = pair();
    const pem = hexToPem(publicHex, "ed25519") as string;
    expect(verifyEd25519(data, "not-base64!!", pem)).toBe(false);
    expect(verifyEd25519("", "", "")).toBe(false);
  });
});

/**
 * The chain our identity flow depends on, end to end:
 *   privateHex → publicHex → did-key(publicHex) → verify a signature
 * This asserts the first three links agree, which is what `@synthetism/did`
 * will build on next.
 */
describe("derivation chain", () => {
  it("private → public → PEM → verify all agree", () => {
    const { privateHex, publicHex } = pair();

    const derived = derivePublicKey(privateHex);
    expect(derived).toBe(publicHex);

    const pem = hexToPem(derived as string, "ed25519");
    expect(pem).toContain("BEGIN PUBLIC KEY");

    const signature = signWith(privateHex, "chain");
    expect(verifyEd25519("chain", signature, pem as string)).toBe(true);
  });
});
