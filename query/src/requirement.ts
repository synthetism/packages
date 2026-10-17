/**
 * Build a requirement the way `createUnsigned` builds a credential.
 *
 * The caller supplies the **content** — what it demands and its own revision — and this
 * owns the **envelope**: the credential type, the issuer, and above all the
 * `credentialSchema.id`.
 *
 * That last part is why this function exists. A service writing its own
 * `credentialSchema` has to put *a* version in the address, and the only version it has
 * to hand is its own — so it writes `.../v3` and claims a language version that does not
 * exist. The service cannot know the language version, exactly as it cannot know
 * `@context`, so it should not be able to name either. Here it names neither.
 */

import {
  type Holder,
  type UnsignedCredential,
  createUnsigned,
} from "@synthetism/credential";
import { LANGUAGE_ADDRESS } from "./languages/index.js";
import type { RequirementSpec, RequirementSubject } from "./types.js";

/**
 * The schema type the address points at.
 *
 * A constant rather than an argument, for the same reason as the address: it is part of
 * the envelope, and the envelope is not the caller's to choose.
 */
export const LANGUAGE_SCHEMA_TYPE = "JsonSchemaValidator2018";

export interface CreateRequirementArgs {
  /** The requirement's name, e.g. `"market-read"`. */
  name: string;
  /** **This service's** revision. Bumped whenever the content below changes. */
  version: string;
  /** For the human reading the 401. */
  description?: string;
  /** Values the *service* fixes, so a caller does not have to guess them. */
  parameters?: Record<string, unknown>;
  /** Keyed by purpose — the content. */
  requirements: Record<string, RequirementSpec>;
  /** The service making the claim: `holder` and `issuer` are the same party. */
  issuer: Holder;
  id?: string;
  context?: string[];
  validity?: { from?: string; until?: string };
}

/**
 * An unsigned `RequirementCredential`, ready for `issue`.
 *
 * Unsigned on purpose, exactly like `createUnsigned`: this package has no crypto and no
 * signer, and the service's own key signs its own requirement.
 *
 * There is **no** `credentialSchema` argument. The address is the language's, it is the
 * same for every service, and a caller that could pass one could pass a wrong one.
 */
export function createRequirement(
  args: CreateRequirementArgs,
): UnsignedCredential<RequirementSubject> {
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

  return createUnsigned<RequirementSubject>({
    subject: {
      holder: args.issuer,
      requirement: {
        name: args.name,
        version: args.version,
        ...(args.description === undefined ? {} : { description: args.description }),
        ...(args.parameters === undefined ? {} : { parameters: args.parameters }),
        requirements: args.requirements,
      },
    },
    type: "RequirementCredential",
    issuer: args.issuer,
    // The language's address, never the service's revision.
    credentialSchema: { id: LANGUAGE_ADDRESS, type: LANGUAGE_SCHEMA_TYPE },
    ...(args.id === undefined ? {} : { id: args.id }),
    ...(args.context === undefined ? {} : { context: args.context }),
    ...(args.validity === undefined ? {} : { validity: args.validity }),
  });
}
