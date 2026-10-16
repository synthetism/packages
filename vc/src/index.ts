/**
 * @synthetism/vc — the operations.
 *
 * `issue` turns an unsigned credential into a signed one; `verify` turns a signed
 * one into a verdict. Between them sits the port `ISigner`, which this package
 * owns and no signer implementation depends on.
 *
 * The format is re-exported so that a caller can build and check a credential
 * with a single import. Explicitly, never `export *`: adopting whatever
 * `@synthetism/credential` grows next is how a leaf becomes a framework.
 */

export type { ISigner } from "./ports.js";

export { issue, type IssueOptions, type IssueResult } from "./issue.js";

export {
  DEFAULT_ALGORITHMS,
  resolveDidKey,
  verify,
  type ResolveDid,
  type VerifyOptions,
  type VerifyResult,
  type VerifySignature,
} from "./verify.js";

// --- the format, re-exported (values) ---------------------------------------
export {
  DEFAULT_ALG,
  DEFAULT_CONTEXT,
  PROOF_TYPE,
  SCHEMA_BASE,
  attachProof,
  canonicalize,
  createUnsigned,
  createUnsignedPresentation,
  credentialId,
  decodeCredential,
  payload,
  presentationId,
  schemaUri,
  signedPortion,
  signingInput,
  validateStructure,
} from "@synthetism/credential";

// --- the format, re-exported (types) ---------------------------------------
export type {
  AgentIdentitySubject,
  AssetSubject,
  AuthenticationSubject,
  AuthorizationSubject,
  CreateUnsignedArgs,
  CreateUnsignedPresentationArgs,
  CredentialSchema,
  CredentialStatus,
  CredentialSubject,
  DataAssetSubject,
  DeclarationSubject,
  Holder,
  IdentitySubject,
  IpAssetSubject,
  JwtHeader,
  JwtPayload,
  NonFungibleAssetSubject,
  PolicySubject,
  Proof,
  ReceiptSubject,
  ServiceIdentitySubject,
  StructuralCheck,
  UnsignedCredential,
  UnsignedPresentation,
  VerifiableCredential,
  VerifiablePresentation,
} from "@synthetism/credential";
