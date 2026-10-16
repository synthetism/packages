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
    requireOptionalDates(doc, ["issuanceDate", "expirationDate"], errors);
  } else {
    requireHolder(doc.issuer, "issuer", errors);
    if (typeof doc.issuanceDate !== "string" || Number.isNaN(Date.parse(doc.issuanceDate))) {
      errors.push("issuanceDate must be a valid ISO date string");
    }
    requireOptionalDates(doc, ["expirationDate"], errors);
    requireSubject(doc.credentialSubject, errors);
    requireReference(doc.credentialSchema, "credentialSchema", errors);
    requireReference(doc.credentialStatus, "credentialStatus", errors);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * One subject, and it names its holder.
 *
 * Two refusals here are deliberate rather than accidental, and both are the format's
 * opinion rather than the data model's.
 *
 * **An array is refused.** The data model allows a credential to carry several
 * subjects. We do not: the point of `holder` is that one credential has exactly one
 * party it was assigned to, and the binding rule is *"the presenter is that party"*.
 * Several holders in one credential would make that rule — the check a verifier
 * actually performs — undecidable, and a rule that cannot be decided is a rule that
 * gets decided differently by each implementation.
 *
 * **A missing holder is refused.** `holder` is the most consequential thing this
 * format decides. A credential names the party it belongs to, so nothing here is a
 * bearer credential, and absence means neither *"anyone may present it"* nor
 * *"it defaults to the issuer"*. It means the document does not conform — which is
 * what makes this an enforcement point and not merely a type.
 */
function requireSubject(value: unknown, errors: string[]): void {
  if (Array.isArray(value)) {
    errors.push(
      "credentialSubject must be a single subject — several would leave the binding rule undecidable",
    );
    return;
  }

  if (value === null || typeof value !== "object") {
    errors.push("credentialSubject must be an object");
    return;
  }

  requireHolder((value as { holder?: unknown }).holder, "credentialSubject.holder", errors);
}

/** Dates that the data model allows but requires to be dates when they appear. */
function requireOptionalDates(doc: Document, fields: string[], errors: string[]): void {
  for (const field of fields) {
    const value = doc[field];
    if (value === undefined) continue;
    if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
      errors.push(`${field} must be a valid ISO date string when present`);
    }
  }
}

/**
 * A `{ id, type }` reference, singular or as a set of them (§4.9, §5.4).
 *
 * "One or more" in the data model, and §6 says a property that is not `id`,
 * `issuer`, `issuanceDate` or `expirationDate` may be either — so both shapes are
 * legal and a verifier that only accepted one would be rejecting conformant input.
 */
function requireReference(value: unknown, field: string, errors: string[]): void {
  if (value === undefined) return;

  const entries = Array.isArray(value) ? value : [value];
  if (entries.length === 0) {
    errors.push(`${field} must carry at least one entry when present`);
    return;
  }

  entries.forEach((entry, index) => {
    if (entry === null || typeof entry !== "object") {
      errors.push(`${field}[${index}] must be an object`);
      return;
    }

    const { id, type } = entry as { id?: unknown; type?: unknown };
    if (typeof id !== "string" || id === "") {
      errors.push(`${field}[${index}].id must be a non-empty string`);
    }
    if (typeof type !== "string" || type === "") {
      errors.push(`${field}[${index}].type must be a non-empty string`);
    }
  });
}

function requireHolder(value: unknown, field: string, errors: string[]): void {
  if (value === undefined) {
    errors.push(`${field} is required`);
    return;
  }
  if (value === null || typeof value !== "object") {
    errors.push(`${field} must be an object`);
    return;
  }
  const id = (value as { id?: unknown }).id;
  if (typeof id !== "string" || id === "") {
    errors.push(`${field}.id must be a non-empty string`);
  }
}
