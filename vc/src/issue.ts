/**
 * Issue — an unsigned credential plus a signer in, a proofed credential out.
 *
 * The whole operation is: compute the bytes, ask the signer, attach the signature.
 * That is why a fake signer is enough to exercise it, and why `vc` needs no key of
 * its own.
 */

import {
  attachProof,
  signingInput,
  validateStructure,
  type UnsignedCredential,
  type VerifiableCredential,
} from "@synthetism/credential";
import type { ISigner } from "./ports.js";

export interface IssueOptions {
  /**
   * The proof format. Only `"jwt"` is implemented — JSON-LD / Data Integrity
   * proofs need canonicalisation machinery this package deliberately does not
   * carry.
   */
  format?: "jwt";
}

export interface IssueResult<S = unknown> {
  /** The signed credential, with a `JwtProof2020` proof attached. */
  credential: VerifiableCredential<S>;
  /**
   * The bytes that were signed — the provenance of the proof.
   *
   * Returned rather than recomputed: it is the exact input the signer was given,
   * and it is what any third party must reproduce to check the signature.
   */
  signingInput: string;
}

/**
 * Sign an unsigned credential.
 *
 * @throws if the document is malformed, the format is unsupported, the signer has
 * no `sign`, or the signer returns no signature. Issuing something unverifiable is
 * worse than failing.
 */
export async function issue<S>(
  unsigned: UnsignedCredential<S>,
  signer: ISigner,
  opts: IssueOptions = {},
): Promise<IssueResult<S>> {
  const format = opts.format ?? "jwt";
  if (format !== "jwt") {
    throw new Error(
      `unsupported proof format ${JSON.stringify(format)} — only "jwt" is implemented`,
    );
  }

  if (signer === null || typeof signer !== "object" || typeof signer.sign !== "function") {
    throw new TypeError("signer must be an object with a sign(data) method");
  }

  const structure = validateStructure(unsigned);
  if (!structure.valid) {
    throw new Error(
      `cannot issue a malformed credential: ${structure.errors.join("; ")}`,
    );
  }

  const input = signingInput(unsigned);
  const signature = await signer.sign(input);

  if (typeof signature !== "string" || signature === "") {
    throw new Error("signer returned no signature");
  }

  return { credential: attachProof(unsigned, signature), signingInput: input };
}
