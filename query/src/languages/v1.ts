/**
 * The language, as the thing its address already names.
 *
 * This is not a description *of* the language — it **is** the language. The TypeScript
 * shapes elsewhere in this package are an authoring convenience for a service that ships
 * this package and therefore knows which version it speaks. A consumer knows nothing of
 * the sort: it has a document off the wire and an address inside it, so it asks this
 * schema whether the document is the language it claims to be, and then reads it.
 *
 * `match` is a **JSON Schema applied to `credentialSubject`**, not a vocabulary of our
 * own. That is the whole reason this file is data: v2 widens the language by publishing a
 * wider schema, and nothing we invented has to be extended, frozen or taken back.
 */

/** The address. Frozen: it is inside every requirement ever signed. */
export const V1_ADDRESS = "https://synthetism.org/schemas/query/v1";

/**
 * Describes `VPLanguageSchema` — the object a service publishes at
 * `credentialSubject.requirement`.
 *
 * Note what it does **not** describe: the credential envelope around it, and the meaning of
 * any particular `type` or `match`. It says a requirement is a named object with a version
 * and at least one thing it demands, each demanding a type and optionally a schema to hold
 * the subject to. Everything above that is the service's vocabulary.
 */
export const V1: Record<string, unknown> = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: V1_ADDRESS,
  title: "Synthetism query language v1",
  description:
    "What a service requires, as data. Describes the object at credentialSubject.requirement of a RequirementCredential.",
  type: "object",
  required: ["name", "version", "requirements"],
  properties: {
    name: { type: "string", minLength: 1 },
    version: { type: "string", minLength: 1 },
    description: { type: "string" },
    parameters: { type: "object" },
    requirements: {
      type: "object",
      minProperties: 1,
      additionalProperties: { $ref: "#/$defs/requirement" },
    },
  },
  // Open, always. A language grows by addition, and a reader written before the addition
  // must not reject the document that carries it.
  additionalProperties: true,
  $defs: {
    requirement: {
      type: "object",
      required: ["type"],
      properties: {
        type: { type: "string", minLength: 1 },
        required: { type: "boolean" },
        // A JSON Schema for credentialSubject. Empty means "any of that type".
        match: { type: "object" },
      },
      additionalProperties: true,
    },
  },
};
