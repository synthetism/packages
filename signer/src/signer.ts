/**
 * The in-process signer.
 *
 * A small class over `@synthetism/keys`: it holds a private key and signs. Not a Unit,
 * not a wallet, not a product — it is the default implementation of the port for the
 * CLI, for tests and for CI, and nothing more.
 *
 * It is **concrete, not the ruler**. The port lives in `@synthetism/vc`; this file proves
 * it fits (see the conformance proof at the bottom) without ever naming it in public.
 */

import {
  createPrivateKey,
  createPublicKey,
  sign as nodeSign,
  type KeyObject,
} from "node:crypto";
import { hexPrivateKeyToPem } from "@synthetism/keys";
// Build-time only. Erased by `verbatimModuleSyntax`, never installed by a consumer —
// see the conformance proof, and `npm run check:dts` which proves it stayed that way.
import type { ISigner } from "@synthetism/vc";

/** How to read the key, when it is not obviously one form or the other. */
export interface SignerOptions {
  /** `"hex"` for a 32-byte seed, `"pem"` for PKCS#8. Detected when omitted. */
  format?: "hex" | "pem";
}

export class Signer {
  readonly #key: KeyObject;
  readonly #publicKeyHex: string;

  private constructor(key: KeyObject, publicKeyHex: string) {
    this.#key = key;
    this.#publicKeyHex = publicKeyHex;
  }

  /**
   * Build a signer from a private key.
   *
   * Accepts the **hex seed** that `keys.generateKeyPair('ed25519', { format: 'hex' })`
   * produces, or a PKCS#8 PEM. The form is detected unless `opts.format` says otherwise.
   *
   * @throws if the key is empty, unreadable, or not Ed25519.
   */
  static from(privateKey: string, opts: SignerOptions = {}): Signer {
    if (typeof privateKey !== "string" || privateKey.trim() === "") {
      throw new TypeError("a private key is required");
    }

    const format = opts.format ?? detect(privateKey);
    const pem = format === "pem" ? privateKey : hexPrivateKeyToPem(privateKey);

    if (pem === null) {
      throw new Error("that is not a hex private key");
    }

    const key = readPrivateKey(pem);

    return new Signer(key, publicKeyHexOf(key));
  }

  /**
   * Sign the exact bytes, and return the signature.
   *
   * base64url, because that is what a JWT carries — and because `keys.verifyEd25519`
   * accepts either form, so nothing downstream has to know which one we chose.
   */
  async sign(data: string): Promise<string> {
    return nodeSign(null, Buffer.from(data), this.#key).toString("base64url");
  }

  /**
   * The public key, in hex.
   *
   * Deliberately the same encoding `keys.derivePublicKey` returns and
   * `did.didKeyFromPublicKey` accepts, so a caller can go straight from a signer to a DID.
   */
  getPublicKeyHex(): string {
    return this.#publicKeyHex;
  }
}

function detect(privateKey: string): "hex" | "pem" {
  return privateKey.includes("-----BEGIN") ? "pem" : "hex";
}

function readPrivateKey(pem: string): KeyObject {
  let key: KeyObject;

  try {
    key = createPrivateKey(pem);
  } catch (cause) {
    throw new Error(
      `could not read that private key: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error(
      `only Ed25519 keys are supported, got ${key.asymmetricKeyType ?? "an unknown type"}`,
    );
  }

  return key;
}

/**
 * The public key, by **parsing** the export rather than slicing the DER.
 *
 * `keys` still takes the last 32 bytes of an SPKI blob and calls that the key
 * (`docs/STARTUP-ISSUES.md` #2). It works, but only because Ed25519 happens to be laid
 * out that way — an assumption about an encoding we do not control. New code does not
 * copy the habit: the JWK export names the field, and `x` *is* the raw public key.
 */
function publicKeyHexOf(key: KeyObject): string {
  const jwk = createPublicKey(key).export({ format: "jwk" }) as { x?: string };

  if (typeof jwk.x !== "string") {
    throw new Error("that key has no Ed25519 public key");
  }

  return Buffer.from(jwk.x, "base64url").toString("hex");
}

// ---------------------------------------------------------------------------
// The conformance proof — internal, erased, never published.
//
// `Signer` has to satisfy the port `ISigner`. But writing `implements ISigner` on the
// class would put `@synthetism/vc` into our published `.d.ts`, making the port a *type
// dependency for every consumer* — at which point it has stopped being a port.
//
// So conformance is proven here, and the class declaration stays shape-only. If `sign`
// ever drifts from the seam, this file stops compiling: the drift breaks *our* build
// rather than a consumer's.
//
// None of this is exported, so none of it should reach `dist/` — and `npm run check:dts`
// verifies that rather than trusting it.
// ---------------------------------------------------------------------------
type _Conforms = Signer extends ISigner ? true : never;
type _AssertTrue<T extends true> = T;
type _Proof = _AssertTrue<_Conforms>;
