/**
 * The port.
 *
 * `vc` owns this interface, and the rest of the world conforms to it
 * *structurally* — nothing is required to import it, or to implement it. A key in
 * memory, a daemon, an HSM, a phone: anything that turns the exact bytes into a
 * signature fits, and `vc` never learns what it was talking to.
 *
 * Note what is **not** here: no key, no algorithm, no store, no `verify`. A signer
 * signs. Deciding whether a signature is good is the verifier's job, and the
 * verifier needs only the public key.
 */
export interface ISigner {
  /**
   * Sign the exact bytes, and return the signature.
   *
   * The encoding is the signer's business — verification accepts base64 and
   * base64url alike.
   */
  sign(data: string): Promise<string>;
}
