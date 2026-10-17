/**
 * Plain JSON, deliberately.
 *
 * `validate` reads documents, it does not verify signatures — that is `@synthetism/vc`'s job
 * and it needs keys and a clock. So the fixtures here are the shapes a document has after it
 * comes off the wire, which is precisely what the validator is for.
 */

import type { VerifiableCredential } from "@synthetism/credential";
import { LANGUAGE_ADDRESS } from "@synthetism/query";

export const SERVICE = "did:key:z6MkpService";
export const ALICE = "did:key:z6MkpAlice";
export const MALLORY = "did:key:z6MkpMallory";

let counter = 0;

export interface CredentialInput {
  holder: string;
  type: string;
  subject?: Record<string, unknown>;
  issuer?: string;
}

export function credential({
  holder,
  type,
  subject = {},
  issuer = SERVICE,
}: CredentialInput): VerifiableCredential {
  counter += 1;

  return {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    id: `urn:credential:${type.toLowerCase()}:${counter}`,
    type: ["VerifiableCredential", type],
    issuer: { id: issuer },
    issuanceDate: "2026-01-01T00:00:00.000Z",
    credentialSubject: { holder: { id: holder }, ...subject },
  } as VerifiableCredential;
}

export interface RequirementInput {
  requirements: Record<string, unknown>;
  address?: string;
  version?: string;
  name?: string;
}

/** A requirement credential as it arrives from `/schema` — no proof, because nothing here verifies. */
export function requirement({
  requirements,
  address = LANGUAGE_ADDRESS,
  version = "1",
  name = "test",
}: RequirementInput): Record<string, unknown> {
  counter += 1;

  return {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    id: `urn:credential:requirement-credential:${counter}`,
    type: ["VerifiableCredential", "RequirementCredential"],
    issuer: { id: SERVICE },
    issuanceDate: "2026-01-01T00:00:00.000Z",
    credentialSchema: { id: address, type: "JsonSchemaValidator2018" },
    credentialSubject: {
      holder: { id: SERVICE },
      requirement: { name, version, requirements },
    },
  };
}

/** The `match` a v1 authorisation requirement uses: this resource, on this subject. */
export function resourceMatch(resource: string): Record<string, unknown> {
  return {
    type: "object",
    properties: { resource: { const: resource } },
    required: ["resource"],
  };
}
