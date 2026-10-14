import { describe, expect, it } from "vitest";
import {
  issue,
  signedPortion,
  signingInput,
  verify,
  type ISigner,
  type UnsignedCredential,
} from "../src/index.js";
import { identity, unsignedFor } from "./helpers.js";

describe("issue", () => {
  it("★ accepts any object with a sign method — the port, proven", async () => {
    const unsigned = unsignedFor(identity().did);

    const result = await issue(unsigned, { sign: async () => "x" });

    expect(result.credential.proof?.type).toBe("JwtProof2020");
    expect(result.credential.proof?.jwt).toBe(`${result.signingInput}.x`);
    expect(result.credential.proof?.verificationMethod).toBe(unsigned.issuer.id);
  });

  it("returns the exact bytes it asked the signer to sign", async () => {
    const unsigned = unsignedFor(identity().did);
    const seen: string[] = [];

    const result = await issue(unsigned, {
      sign: async (data) => {
        seen.push(data);
        return "signature";
      },
    });

    expect(seen).toEqual([signingInput(unsigned)]);
    expect(result.signingInput).toBe(seen[0]);
    expect(signedPortion(result.credential)).toBe(result.signingInput);
  });

  it("leaves the unsigned document alone", async () => {
    const unsigned = unsignedFor(identity().did);

    await issue(unsigned, { sign: async () => "x" });

    expect("proof" in unsigned).toBe(false);
  });

  it("issues something its own verifier accepts", async () => {
    const alice = identity();

    const { credential } = await issue(unsignedFor(alice.did), alice.signer);

    expect(verify(credential)).toEqual({ verified: true, errors: [] });
  });

  it("refuses a signer that is not one", async () => {
    const unsigned = unsignedFor(identity().did);

    await expect(issue(unsigned, {} as ISigner)).rejects.toThrow(TypeError);
  });

  it("refuses a signer that returns nothing", async () => {
    const unsigned = unsignedFor(identity().did);

    await expect(issue(unsigned, { sign: async () => "" })).rejects.toThrow(
      /no signature/,
    );
  });

  it("refuses a proof format it does not implement", async () => {
    const unsigned = unsignedFor(identity().did);

    await expect(
      issue(unsigned, { sign: async () => "x" }, { format: "jsonld" as "jwt" }),
    ).rejects.toThrow(/unsupported proof format/);
  });

  it("refuses a malformed document before the signer is ever called", async () => {
    const broken = { ...unsignedFor(identity().did) } as Record<string, unknown>;
    delete broken["@context"];
    let asked = false;

    await expect(
      issue(broken as unknown as UnsignedCredential<unknown>, {
        sign: async () => {
          asked = true;
          return "x";
        },
      }),
    ).rejects.toThrow(/malformed/);
    expect(asked).toBe(false);
  });
});
