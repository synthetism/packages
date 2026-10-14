/**
 * @synthetism/credential — the credential format.
 *
 * W3C envelopes, Synthetism subject shapes, and the **exact bytes to sign**.
 * No crypto. No signer. Nothing here knows how a signature is produced — that is
 * `@synthetism/vc`.
 */

export type {
  AgentIdentitySubject,
  AssetSubject,
  AuthorizationSubject,
  ContractSubject,
  CredentialSubject,
  DataAssetSubject,
  DeclarationSubject,
  Holder,
  IdentitySubject,
  IpAssetSubject,
  NonFungibleAssetSubject,
  PolicySubject,
  Proof,
  ReceiptSubject,
  ServiceIdentitySubject,
  UnsignedCredential,
  UnsignedPresentation,
  VerifiableCredential,
  VerifiablePresentation,
} from "./types.js";

export { DEFAULT_CONTEXT, SCHEMA_BASE, schemaUri } from "./schema.js";

export {
  createUnsigned,
  createUnsignedPresentation,
  credentialId,
  presentationId,
  type CreateUnsignedArgs,
  type CreateUnsignedPresentationArgs,
} from "./build.js";

export {
  DEFAULT_ALG,
  DEFAULT_TYP,
  PROOF_TYPE,
  attachProof,
  base64urlDecode,
  base64urlEncode,
  decodeCredential,
  header,
  payload,
  signedPortion,
  signingInput,
  type JwtHeader,
  type JwtPayload,
} from "./jwt.js";

export { canonicalize } from "./canonical.js";

export { validateStructure, type StructuralCheck } from "./validate.js";
