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
 * A data schema this document claims to conform to (VC Data Model §5.4).
 *
 * This is where a shape's **address** belongs — on the document, not buried in a
 * subject. `id` points at the shape; the document's own version, if it has one, is
 * in `meta`. One address, one meaning, and a reader who does not trust its cached
 * copy knows exactly where the current one lives.
 */
export interface CredentialSchema {
  /** The URI identifying the schema file. */
  id: string;
  /** The schema type, e.g. `"JsonSchemaValidator2018"`. */
  type: string;
  [x: string]: unknown;
}

/**
 * Where this credential's revocation or suspension can be discovered (VC Data Model
 * §4.9).
 *
 * Our own revocation story needs none of this — an issuer stops renewing, and every
 * holder verifies that offline. This field is for the party who *cannot* see the
 * renewal schedule and still has to know: a third-party verifier, later, holding a
 * credential that looks perfectly valid.
 */
export interface CredentialStatus {
  /** The URI where status can be discovered. */
  id: string;
  /** The status method, e.g. `"StatusList2021Entry"`. */
  type: string;
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
  /** One or more schemas this credential conforms to — see `CredentialSchema`. */
  credentialSchema?: CredentialSchema | CredentialSchema[];
  /** Where to discover this credential's status — see `CredentialStatus`. */
  credentialStatus?: CredentialStatus | CredentialStatus[];
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
  /**
   * The window, written by `present` from the verifier's challenge.
   *
   * Optional in the data model and always present in ours, because the JWT's `nbf`
   * and `exp` MUST represent these two fields (§6.3.1) — so a window that lives only
   * in the claims represents nothing, and a presentation with no dates is a
   * presentation with no expiry.
   */
  issuanceDate?: string;
  expirationDate?: string;
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
}

/** An agent's identity, with the scope it operates in. */
export interface AgentIdentitySubject extends IdentitySubject {
  scope?: string[];
}

/** A service's identity, with where to reach it. */
export interface ServiceIdentitySubject extends IdentitySubject {
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
  scope?: string[];
  resource?: string;
}

/**
 * A service's record that control was proven and a session opened.
 *
 * The counterpart of the Authorization VC, and **the half of the handshake the agent
 * has to check**. The agent verifies this before it does anything else, which is how it
 * knows it is talking to the service it bought from: `issuer` must be the issuer named in
 * its own Authorization VC, and the signature must verify. Two signatures, two
 * directions — the agent proves control of the holder key, the service proves control of
 * the issuer key. There is no third party in it and no shared secret.
 *
 * Its `id` is also the **session id**. One identifier covers the durable record and the
 * runtime reference, and it is safe to send on every call only because it proves nothing
 * on its own: what travels is a name, and what authorises is a fresh signature from the
 * key pinned in the session.
 *
 * `authorizationId` is the link, and it is required. The Authorization VC is the source
 * of truth and the session is a cache of it, so anything this credential says has to be
 * re-derivable from the authorization it names. A session that does not say what it was
 * opened under is an uncited assertion, and an uncited assertion is a credential you
 * cannot audit.
 *
 * Two things are deliberately absent:
 *
 * - **the session token.** A durable artifact records that a session opened; the lease
 *   is the runtime token and it travels *beside* this credential, never inside it.
 * - **the pinned key.** The funnel's session row pins the `kid`, and that is operational
 *   state. The key that opened the session is the `verificationMethod` of the
 *   presentation that did it, which the funnel already holds — a copy here would be a
 *   second place for one fact to be wrong.
 */
export interface AuthenticationSubject extends CredentialSubject {
  /** The Authorization VC this session was opened under. */
  authorizationId: string;
  /** The scope the service resolved from that authorization — what this session may do. */
  scope?: string[];
}

/** Anything that can own or be owned. */
export interface AssetSubject extends CredentialSubject {
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

/* export interface ContractSubject extends CredentialSubject {
  service: Holder;
  terms: Record<string, unknown>;
  scope?: string[];
  resource?: string;
} */

/**
 * A receipt — *something happened, and here is the outcome.*
 *
 * **This is a base, and a service extends it.** Three fields, because three things are true of
 * every receipt anywhere: who it was made out to, what it was about, and what the verdict was.
 * Everything else — which session, which pool, how many units — is a *service's* decision, and a
 * service extends this shape to say so:
 *
 * ```ts
 * interface MarketReceiptSubject extends ReceiptSubject {
 *   authenticationId?: string;
 *   pool: string;
 *   units?: number;
 * }
 * ```
 *
 * That line is not fussiness. A receipt is issued by a service and stored by a party, and the
 * party does not care which session produced it — while the service cannot promise the same
 * fields as its neighbour. Putting one service's vocabulary in the base would make the base a
 * lie for every other service, which is exactly the mistake the old `parentAssetId` made: it
 * claimed a receipt knows about assets, and then carried a pool id.
 *
 * And **a receipt does not imply an authentication.** A purchase has a receipt with no session;
 * a free service has one with no meter. So nothing here may be required on the strength of "we
 * always authenticate", because we do not.
 */
export interface ReceiptSubject extends CredentialSubject {
  /** A content-addressed reference to what happened. The reference, never the thing. */
  artifactHash: string;
  verdict: "honoured" | "breached";
}

export interface PolicySubject extends CredentialSubject {

}

export interface DeclarationSubject extends CredentialSubject {
}
