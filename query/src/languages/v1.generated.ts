/**
 * GENERATED — do not edit. Source of truth: `schemas/query/v1.json`.
 *
 * Regenerate with `npm run schema:generate`; `test/version.test.ts` fails if this file and
 * the artifact disagree. The language, and the reasoning behind it, live in the JSON and in
 * `SCHEMAS.md` — not here.
 */

/** The address, taken from the artifact's `$id`. Frozen: it is inside every requirement ever signed. */
export const V1_ADDRESS = "https://synthetism.org/schemas/query/v1" as const;

/** The language itself, as data. */
export const V1 = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://synthetism.org/schemas/query/v1",
    "title": "Synthetism query language v1",
    "description": "What a service requires, as data. Describes the object at credentialSubject.requirement of a RequirementCredential.",
    "type": "object",
    "required": [
      "name",
      "version",
      "requirements"
    ],
    "properties": {
      "name": {
        "type": "string",
        "minLength": 1
      },
      "version": {
        "type": "string",
        "minLength": 1
      },
      "description": {
        "type": "string"
      },
      "parameters": {
        "type": "object"
      },
      "requirements": {
        "type": "object",
        "minProperties": 1,
        "additionalProperties": {
          "$ref": "#/$defs/requirement"
        }
      }
    },
    "additionalProperties": true,
    "$defs": {
      "requirement": {
        "type": "object",
        "required": [
          "type"
        ],
        "properties": {
          "type": {
            "type": "string",
            "minLength": 1
          },
          "required": {
            "type": "boolean"
          },
          "match": {
            "type": "object"
          }
        },
        "additionalProperties": true
      }
    }
} as const;
