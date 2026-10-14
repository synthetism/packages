/**
 * Builders. These produce **unsigned** documents — never a proof, never a
 * signature.
 */

import { randomBytes } from "node:crypto";
import { DEFAULT_CONTEXT } from "./schema.js";
import type {
  CredentialSubject,
  Holder,
  UnsignedCredential,
  UnsignedPresentation,
  VerifiableCredential,
} from "./types.js";

/**
 * A credential id: `urn:credential:<type>:<opaque>`.
 *
 * Pass your own `id` when you need reproducibility.
 */
export function credentialId(type: string, id?: string): string {
  return id ?? `urn:credential:${slug(type)}:${opaque(12)}`;
}

/** A presentation id: `urn:presentation:<opaque>`. */
export function presentationId(id?: string): string {
  return id ?? `urn:presentation:${opaque(12)}`;
}

export interface CreateUnsignedArgs<S> {
  /** The subject — the claims themselves. */
  subject: S;
  /** e.g. `"IdentityCredential"`. `VerifiableCredential` is added automatically. */
  type: string | string[];
  /** Who is making the claim. */
  issuer: Holder;
  id?: string;
  context?: string[];
  validity?: { from?: string; until?: string };
  meta?: Record<string, unknown>;
}

/**
 * Build an unsigned credential.
 *
 * `@context`, `type`, `issuanceDate` and `id` are filled in when absent; the result
 * never contains a `proof`.
 */
export function createUnsigned<S = CredentialSubject>(
  args: CreateUnsignedArgs<S>,
): UnsignedCredential<S> {
  const types = withBaseType(args.type);
  const primary = types[types.length - 1] ?? "Credential";

  const unsigned: UnsignedCredential<S> = {
    "@context": args.context ?? [...DEFAULT_CONTEXT],
    id: args.id ?? credentialId(primary),
    type: types,
    issuer: args.issuer,
    issuanceDate: args.validity?.from ?? new Date().toISOString(),
    credentialSubject: args.subject,
  };

  if (args.validity?.until !== undefined) {
    unsigned.expirationDate = args.validity.until;
  }
  if (args.meta !== undefined) {
    unsigned.meta = args.meta;
  }

  return unsigned;
}

export interface CreateUnsignedPresentationArgs<C> {
  holder: Holder;
  credentials: C[];
  id?: string;
  context?: string[];
}

/** Build an unsigned presentation. The result never contains a `proof`. */
export function createUnsignedPresentation<C = VerifiableCredential>(
  args: CreateUnsignedPresentationArgs<C>,
): UnsignedPresentation<C> {
  return {
    "@context": [...DEFAULT_CONTEXT],
    ...(args.context ? { "@context": args.context } : {}),
    id: args.id ?? presentationId(),
    type: ["VerifiablePresentation"],
    holder: args.holder,
    verifiableCredential: args.credentials,
  };
}

/** Ensure `VerifiableCredential` is present, without duplicating it. */
function withBaseType(type: string | string[]): string[] {
  const types = Array.isArray(type) ? [...type] : [type];
  return types[0] === "VerifiableCredential"
    ? types
    : ["VerifiableCredential", ...types];
}

function slug(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function opaque(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}
