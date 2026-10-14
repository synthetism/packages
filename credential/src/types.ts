/**
 * The Synthetism credential format.
 *
 * W3C envelopes plus our subject shapes. **Types only** — there is no crypto here
 * and no signer is ever passed in. This package defines *what* a credential is and
 * *which bytes* get signed; producing a signature is somebody else's job.
 */

/** An entity: a DID plus an optional human label. */
export interface Holder {
  id: string;
  name?: string;
  [x: string]: unknown;
}

/** A proof attached to a credential or presentation. */
export interface Proof {
  type: string;
  /** Present for the JWT proof format. */
  jwt?: string;
  created?: string;
  verificationMethod?: string;
  proofPurpose?: string;
  [x: string]: unknown;
}

/**
 * A W3C Verifiable Credential.
 *
 * `proof` is **absent** on an unsigned credential — that is the whole point of the
 * split: `credential` builds the unsigned document, `@synthetism/vc` signs it.
 */
export interface VerifiableCredential<S = CredentialSubject> {
  "@context": string[];
  id: string;
  type: string[];
  issuer: Holder;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: S;
  proof?: Proof;
  meta?: Record<string, unknown>;
}

/** A credential with no `proof` yet. */
export type UnsignedCredential<S = CredentialSubject> = Omit<
  VerifiableCredential<S>,
  "proof"
>;

/** A W3C Verifiable Presentation: a holder bundling credentials. */
export interface VerifiablePresentation<C = VerifiableCredential> {
  "@context": string[];
  id: string;
  type: ["VerifiablePresentation", ...string[]];
  holder: Holder;
  verifiableCredential: C[];
  proof?: Proof;
}

/** A presentation with no `proof` yet. */
export type UnsignedPresentation<C = VerifiableCredential> = Omit<
  VerifiablePresentation<C>,
  "proof"
>;

// ---------------------------------------------------------------------------
// Subject shapes
// ---------------------------------------------------------------------------

/** Every subject belongs to a holder. */
export interface CredentialSubject {
  holder: Holder;
  [x: string]: unknown;
}

/** "Who I am", self-attested or issued by another. */
export interface IdentitySubject extends CredentialSubject {
  issuedBy: Holder;
}

/** An agent's identity, with the scope it operates in. */
export interface AgentIdentitySubject extends IdentitySubject {
  scope?: string[];
}

/** A service's identity, with where to reach it. */
export interface ServiceIdentitySubject extends IdentitySubject {
  endpoint?: string;
  scope?: string[];
}

/**
 * What an agent may do, and where — the durable counterpart to a runtime token.
 *
 * An `AuthorizationSubject` is **attributed**: it names the agent's DID, so the
 * agent is distinguishable from the principal that granted it, and a service can
 * refuse one DID without anyone rotating a key.
 */
export interface AuthorizationSubject extends CredentialSubject {
  authorizedBy: Holder;
  scope?: string[];
  resource?: string;
}

/** Anything that can own or be owned. */
export interface AssetSubject extends CredentialSubject {
  issuedBy: Holder;
  parentAssetId?: string;
}

export interface DataAssetSubject extends AssetSubject {
  licensedBy?: Holder;
  scope?: string[];
}

export interface NonFungibleAssetSubject extends AssetSubject {
  uniqueIdentifier?: string;
}

export interface IpAssetSubject extends AssetSubject {
  network?: string;
  ip: string;
}

export interface ContractSubject extends CredentialSubject {
  service: Holder;
  terms: Record<string, unknown>;
}

export interface ReceiptSubject extends CredentialSubject {
  contractId: string;
  artifactHash: string;
  verdict: "honoured" | "breached";
}

export interface PolicySubject extends CredentialSubject {
  issuedBy: Holder;
}

export interface DeclarationSubject extends CredentialSubject {
  issuedBy: Holder;
}
