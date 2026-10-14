/**
 * @synthetism/signer — the default implementation of the port.
 *
 * Note what is deliberately **not** re-exported: `ISigner`. It lives in
 * `@synthetism/vc`, and this package depends on it for its *build* only. Re-exporting it
 * here would hand every consumer a reference they never asked for, and quietly turn a
 * devDependency into a real one.
 */

export { Signer, type SignerOptions } from "./signer.js";
