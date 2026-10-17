/**
 * Build a requirement — and stop at the subject.
 *
 * The caller supplies the **content**: what it demands, and its own revision. This owns the
 * language, because a service has only one version to hand and it is the wrong one.
 *
 * It does **not** build a credential. Whether this subject is signed into one, wrapped, or
 * thrown away is the app's business, and `@synthetism/credential` is where that envelope
 * lives. So this package returns **shape, not artifact** — and composition stays in the app,
 * which is the one place it belongs.
 *
 * The consequence, stated plainly: the language address is no longer inexpressible here. It
 * is a constant the app passes (`LANGUAGE_CREDENTIAL_SCHEMA`), so it can be forgotten.
 * Forgetting it is caught — `validate` reports `unsupported-language` by name, at the first
 * moment anyone looks at the document. That is a better trade than an import from the format.
 */

import type { RequirementSpec, RequirementSubject } from "./types.js";

export interface CreateRequirementArgs {
  /** The requirement's name, e.g. `"market-read"`. */
  name: string;
  /** **This service's** revision. Bumped whenever the content below changes. */
  version: string;
  /** For the human reading the 401. */
  description?: string;
  /** What is on sale. Informational: nothing in the library reads it. */
  parameters?: Record<string, unknown>;
  /** Keyed by purpose — the content. */
  requirements: Record<string, RequirementSpec>;
  /** The service making the claim: the subject's `holder`, and the credential's `issuer`. */
  issuer: { id: string; name?: string; [x: string]: unknown };
}

/**
 * A `RequirementSubject`, ready to be wrapped:
 *
 * ```ts
 * createUnsigned({
 *   subject: createRequirement({ name, version, requirements, issuer }),
 *   type: "RequirementCredential",
 *   issuer,
 *   credentialSchema: LANGUAGE_CREDENTIAL_SCHEMA,
 * })
 * ```
 */
export function createRequirement(args: CreateRequirementArgs): RequirementSubject {
  if (args.name.trim() === "") {
    throw new Error("a requirement needs a name — it is how a refusal cites it");
  }

  if (Object.keys(args.requirements).length === 0) {
    throw new Error(
      "a requirement must demand at least one thing — one that demands nothing is not a requirement",
    );
  }

  if (args.version.trim() === "") {
    throw new Error("a requirement needs its own version — it changes on your schedule");
  }

  return {
    holder: args.issuer,
    requirement: {
      name: args.name,
      version: args.version,
      ...(args.description === undefined ? {} : { description: args.description }),
      ...(args.parameters === undefined ? {} : { parameters: args.parameters }),
      requirements: args.requirements,
    },
  };
}
