import { createPrivateKey, sign as nodeSign } from "node:crypto";
import { didKeyFromPublicKey } from "@synthetism/did";
import { generateKeyPair, hexPrivateKeyToPem } from "@synthetism/keys";
import {
  createUnsigned,
  type ISigner,
  type UnsignedCredential,
} from "../src/index.js";

export interface TestIdentity {
  did: string;
  publicKeyHex: string;
  /** A real Ed25519 signer, built on `node:crypto` — not on `@synthetism/signer`. */
  signer: ISigner;
}

/** A fresh Ed25519 identity: a raw key pair, the `did:key` for it, and a signer. */
export function identity(): TestIdentity {
  const { privateKey, publicKey } = generateKeyPair("ed25519", { format: "hex" });

  const pem = hexPrivateKeyToPem(privateKey);
  if (pem === null) throw new Error("could not convert the test key to PEM");

  const key = createPrivateKey(pem);

  return {
    did: didKeyFromPublicKey(publicKey),
    publicKeyHex: publicKey,
    signer: {
      sign: async (data: string) =>
        nodeSign(null, Buffer.from(data), key).toString("base64url"),
    },
  };
}

/** A valid unsigned credential, issued by `did`. */
export function unsignedFor(
  did: string,
  overrides: { from?: string; until?: string } = {},
): UnsignedCredential<Record<string, unknown>> {
  return createUnsigned({
    subject: { holder: { id: did }, scope: ["read"] },
    type: "ServiceAuthorization",
    issuer: { id: did },
    id: "urn:credential:service-authorization:fixed",
    validity: {
      from: overrides.from ?? "2026-01-01T00:00:00.000Z",
      ...(overrides.until === undefined ? {} : { until: overrides.until }),
    },
  });
}
