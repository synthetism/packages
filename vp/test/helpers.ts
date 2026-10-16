import { createPrivateKey, sign as nodeSign } from "node:crypto";
import {
  createUnsigned,
  type UnsignedCredential,
  type VerifiableCredential,
} from "@synthetism/credential";
import { didKeyFromPublicKey } from "@synthetism/did";
import { generateKeyPair, hexPrivateKeyToPem } from "@synthetism/keys";
import { issue, type ISigner } from "@synthetism/vc";
import {
  createUnsignedPresentation,
  present,
  type Challenge,
  type UnsignedPresentation,
  type VerifiablePresentation,
} from "../src/index.js";

export interface TestIdentity {
  did: string;
  publicKeyHex: string;
  /** A real Ed25519 signer on `node:crypto` — not on `@synthetism/signer`. */
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

/** A fixed instant. A window test with a moving clock is not a test. */
export const T0 = new Date("2026-06-01T00:00:00.000Z");

/** `T0`, in epoch seconds — what `nbf` will be. */
export const T0_SECONDS = Math.floor(T0.getTime() / 1000);

/** `T0` plus `seconds`. */
export function at(seconds: number): Date {
  return new Date(T0.getTime() + seconds * 1000);
}

/** The verifier. A service, so a `did:web` rather than a key. */
export const FUNNEL = "did:web:api.example.com";

/**
 * The challenge **as the verifier stores it** — its own clock included.
 *
 * `issuedAt` is a second before `T0`, so the presenter that signs at `T0` is signing
 * one second into a window the verifier opened first.
 */
export function challenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    aud: FUNNEL,
    nonce: "nonce-one",
    expiresIn: 120,
    issuedAt: T0_SECONDS - 1,
    ...overrides,
  };
}

/** The same challenge **as the presenter receives it** — no `issuedAt` on the wire. */
export function challengeOnTheWire(overrides: Partial<Challenge> = {}): Challenge {
  const issued = challenge(overrides);
  return { aud: issued.aud, nonce: issued.nonce, expiresIn: issued.expiresIn };
}

export interface AuthorizationOverrides {
  scope?: string[];
  until?: string;
  /** Override only the claimed issuer, so a test can name one with no key behind it. */
  issuerId?: string;
}

/** An Authorization VC: the service issues it to the agent, against payment. */
export async function authorizationCredential(
  issuer: TestIdentity,
  holder: TestIdentity,
  overrides: AuthorizationOverrides = {},
): Promise<VerifiableCredential<Record<string, unknown>>> {
  const unsigned: UnsignedCredential<Record<string, unknown>> = createUnsigned({
    subject: {
      holder: { id: holder.did, name: "the agent" },
      authorizedBy: { id: "did:web:payer.example.com" },
      scope: overrides.scope ?? ["read"],
      resource: "https://api.example.com/market",
    },
    type: "AuthorizationCredential",
    issuer: { id: overrides.issuerId ?? issuer.did },
    id: "urn:credential:authorization:fixed",
    validity: {
      from: "2026-01-01T00:00:00.000Z",
      ...(overrides.until === undefined ? {} : { until: overrides.until }),
    },
  });

  const { credential } = await issue(unsigned, issuer.signer);
  return credential;
}

/** A presentation, signed by `holder` inside `challenge()`. */
export async function presentationFor(
  holder: TestIdentity,
  credentials: VerifiableCredential<Record<string, unknown>>[],
  overrides: Partial<Challenge> = {},
  signedAt: Date = T0,
): Promise<{
  unsigned: UnsignedPresentation<VerifiableCredential<Record<string, unknown>>>;
  presentation: VerifiablePresentation<VerifiableCredential<Record<string, unknown>>>;
  signingInput: string;
}> {
  const unsigned = createUnsignedPresentation({
    holder: { id: holder.did, name: "the agent" },
    credentials,
    id: "urn:presentation:fixed",
  });

  const { presentation, signingInput } = await present(
    unsigned,
    holder.signer,
    challengeOnTheWire(overrides),
    { now: signedAt },
  );

  return { unsigned, presentation, signingInput };
}

/** Swap a JWT's payload for a doctored one, keeping the header and signature. */
export function rewire<T>(signed: T, forge: (claims: Record<string, unknown>) => void): T {
  const document = signed as { proof?: { jwt?: string } };
  const [head, body, signature] = (document.proof?.jwt as string).split(".");

  const claims = JSON.parse(Buffer.from(body as string, "base64url").toString("utf8")) as Record<
    string,
    unknown
  >;
  forge(claims);

  const forged = Buffer.from(JSON.stringify(claims)).toString("base64url");

  return {
    ...document,
    proof: { ...document.proof, jwt: `${head}.${forged}.${signature}` },
  } as T;
}
