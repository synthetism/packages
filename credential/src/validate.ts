/**
 * Structural checks — no crypto, no signature verification.
 *
 * `validateStructure` answers "is this shaped like a credential?"; whether the
 * proof is *valid* is `@synthetism/vc`'s job.
 */

export interface StructuralCheck {
  valid: boolean;
  errors: string[];
}

type Document = Record<string, unknown>;

export function validateStructure(document: unknown): StructuralCheck {
  const errors: string[] = [];

  if (document === null || typeof document !== "object") {
    return { valid: false, errors: ["not an object"] };
  }

  const doc = document as Document;

  const context = doc["@context"];
  if (!Array.isArray(context) || context.length === 0) {
    errors.push("@context must be a non-empty array");
  }

  if (typeof doc.id !== "string" || doc.id === "") {
    errors.push("id must be a non-empty string");
  }

  if (!Array.isArray(doc.type) || doc.type.length === 0) {
    errors.push("type must be a non-empty array");
  }

  const isPresentation =
    Array.isArray(doc.type) &&
    doc.type.includes("VerifiablePresentation");

  if (isPresentation) {
    requireHolder(doc.holder, "holder", errors);
    if (!Array.isArray(doc.verifiableCredential)) {
      errors.push("verifiableCredential must be an array");
    }
  } else {
    requireHolder(doc.issuer, "issuer", errors);
    if (typeof doc.issuanceDate !== "string" || Number.isNaN(Date.parse(doc.issuanceDate))) {
      errors.push("issuanceDate must be a valid ISO date string");
    }
    if (doc.expirationDate !== undefined) {
      if (
        typeof doc.expirationDate !== "string" ||
        Number.isNaN(Date.parse(doc.expirationDate))
      ) {
        errors.push("expirationDate must be a valid ISO date string when present");
      }
    }
    if (doc.credentialSubject === null || typeof doc.credentialSubject !== "object") {
      errors.push("credentialSubject must be an object");
    }
  }

  return { valid: errors.length === 0, errors };
}

function requireHolder(value: unknown, field: string, errors: string[]): void {
  if (value === null || typeof value !== "object") {
    errors.push(`${field} must be an object`);
    return;
  }
  const id = (value as { id?: unknown }).id;
  if (typeof id !== "string" || id === "") {
    errors.push(`${field}.id must be a non-empty string`);
  }
}
