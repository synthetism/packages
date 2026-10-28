# Verifiable credentials — issue and verify

**Artefact:** conformance brief · **Protocol:** AI Conformance Protocol 0.1
**Declarative only.** This document states what must be true. It states nothing about how.

---

## Intent

We're working on a set of packages working together to create, verify and pack verifiable credentials.

So far we've created packages:

`@synthetism\keys` - creates cryptographic keypairs.
`@syntehtism\did` - creating did, with private and public key, depends on `@synthetism\keys`.

`@synthetism/credential` - source of truth for the shapes of VerifiableCredentials, can create unsigned credentials, following own types. 

I knows what a credential *is*: its context, its types, its issuer, its subject, its validity window, its subject data. It decides policy and exports methods for the new library. It does not sign, and it cannot validate. 

It makes a credential the package has already built unforgeable, and it decides whether a credential presented to it is one we should
believe.

Its value is not that it produces a signature. Signing is a library call. Its value is that the
verifier cannot be persuaded to use a key of the credential's choosing.

A credential offers three places to name a key: the issuer in its payload, the verification
method its proof points at, and a key embedded in its own header. Only the first may decide.
The other two may be checked against it. Neither may replace it, extend it, or stand in for it.

A verifier that can be pointed at the wrong key by the thing it is verifying is a formality.

---

## Operations and shape

Two operations: `issue` and `verify`.

Every result carries an `outcome`, and nothing is reported by throwing. One shape, no special
cases: a caller reads `outcome` before it reads anything else.

```
issue   accepted  →  { outcome, signingInput, credential }
issue   refused   →  { outcome, invariant }
verify  accepted  →  { outcome }
verify  refused   →  { outcome, invariant }
```

`outcome` is `"accepted"` or `"refused"`, for both operations. A refusal names the invariant it
refused under.

### The signer

This library owns the shape of key material for the whole stack. A signer names the algorithm it
speaks for, names its own key, and signs. It does not publish its key, and it does not verify.

```ts
export interface ISigner {
  readonly alg: string;      // what the proof header will carry, e.g. "EdDSA"
  readonly keyId: string;    // a DID URL under the issuer's DID, e.g. "did:example:i#key-1"
  sign(data: string): Promise<string>;   // base64url
}
```

A signer does not hold a public key, because a key the issuer can hand out is a key someone will
put inside a credential. Publishing is the issuer document's job.

### Verification

```ts
export interface VerifyOptions {
  resolve?: (did: string) => Promise<IssuerDocument | undefined>;
  algorithms?: readonly string[];   // narrows the algorithms this call accepts
}

export interface IssuerDocument {
  id: string;
  assertionMethod: readonly VerificationMethod[];
}

export interface VerificationMethod {
  id: string;         // a DID URL, e.g. "did:example:issuer#key-1"
  publicKey: string;  // PEM. Opaque here: the key type is in the PEM, not in a field.
}
```

The proof's `verificationMethod` MUST be a DID URL whose value is exactly one of that document's
`assertionMethod[].id`. A proof naming no method MUST be refused, and the verifier MUST NOT fall
back to the only method it can find.

### Where the algorithm lives

One value, four places, one job each:

| place | set by | job |
|---|---|---|
| `ISigner.alg` | the issuer | names the algorithm when signing |
| the credential's header `alg` | `issue`, from the signer | carries it, authentically, inside the signed bytes |
| `opts.algorithms` | the caller, per call | narrows what this call accepts |
| the library's supported set | the library, per release | the outer bound; nobody widens it |

The verifier reads the algorithm **from the credential** and checks it against the accepted set.
The caller supplies the allowlist, never the choice. Handing the algorithm in as an argument would
make the caller, rather than the credential, determine what was verified — and the document holds
an opaque PEM whose type the verifier learns from the PEM itself.

The library supports a closed set of algorithms — `["EdDSA"]`. `algorithms` MAY narrow that set
and MUST NOT widen it. Widening is a library release, because accepting an algorithm is a
security decision reviewed once, not chosen at a call site.

`resolve` defaults to local `did:key` resolution.

**Fixed values for the suite.** Two key pairs: `issuer-a` (`did:example:issuer-a`, key
`did:example:issuer-a#key-1`) signs; `issuer-b` (`did:example:issuer-b`, key
`did:example:issuer-b#key-1`) exists so that a wrong key can be presented as data.

**`given` mirrors the operation's parameters.** A parameter that is a collaborator is supplied as a
*name*, and the conformance entry point resolves it:

| parameter | in a vector | resolved to |
|---|---|---|
| `unsigned` | data | itself |
| `signer` | `issuer-a` or `issuer-b` | a signer built from that key pair |
| `opts` | data | itself |
| `resolve` | a DID → document map | a lookup over that map |

So a vector may sign with the wrong key, publish a document holding a different key, publish a
document with no assertion methods, or publish no document at all — and none of it is code.

---

## Invariants

### ISSUE-001 — the signature covers the credential that comes back

The credential carried in the signed payload — the `vc` claim of the JWT — MUST be exactly the
returned credential without its proof. Any change to any part of the credential MUST change the
signed bytes.

*Why:* a signature over something other than what is returned is a signature over nothing. The
holder of the credential has no way to discover the difference.

### ISSUE-002 — an unsupported request is refused, and nothing is signed

A request the library cannot honour MUST return a refusal. It MUST NOT return a partially
signed or differently formatted artefact.

*Why:* a half-issued credential is indistinguishable from a badly issued one.

### ISSUE-003 — a signer that does not belong to the issuer is refused

If `signer.keyId` does not name a key under the credential's issuer, `issue` MUST return a
refusal. It MUST NOT return a credential that verification would inevitably reject.

*Why:* this is a consequence of VERIFY-001, not an independent rule, and it is worth following the
chain that produces it. The proof's `verificationMethod` must equal one of the assertion method ids
in the document resolved for the issuer. `signer.keyId` is what `issue` writes there. So a signer
keyed to a different DID writes a proof that no conforming verifier can ever accept. A credential
born dead is worse than a refusal: it carries a signature, a holder stores it, and the failure
surfaces later at a party who did nothing wrong.

### VERIFY-001 — the issuer chooses the document, the proof may only select within it

The document MUST be the one the resolver returns for the issuer named in the **signed** payload.
The proof's `verificationMethod` MAY select one of that document's assertion methods, and nothing
else: a method that is not present in that document MUST be refused. A key embedded in the
credential's own header MUST NOT be used.

A credential whose signature does not verify under the selected assertion method MUST be refused.

*Why:* selection is legitimate — a document may publish several keys for rotation, for multiple
devices, for several purposes. Introduction is not. The moment a credential can bring its own
key, it certifies itself, and a self-certifying credential proves nothing.

### VERIFY-002 — an altered credential is refused

Any change to the signed payload, or to the signature, MUST cause refusal.

*Why:* the only thing a signature buys is that alteration is detectable. If alteration is not
detectable, the signature is decoration.

### VERIFY-003 — an unknown issuer is refused, never accepted

If the resolver has no document for the claimed issuer, the outcome MUST be refusal. It MUST
NOT be an error thrown, and it MUST NOT be acceptance.

*Why:* failing open on a lookup miss is the most common way a verifier becomes a rubber stamp.
A missing document is a decision, not an exception.

### VERIFY-004 — an algorithm that was not accepted is refused

The algorithm named in the credential's header MUST be compared against the set this call accepts
**before** any signature is attempted. A credential naming an algorithm outside that set MUST be
refused. `none`, and a missing or non-string `alg`, MUST be refused.

*Why:* the algorithm sits inside the signed bytes, which makes it **authentic** and not
**authorised**. Those are different questions. A verifier that reads the algorithm out of the
header and then verifies with it has asked the credential which lock to pick: `none` skips the
check entirely, and `HS256` turns the issuer's published public key into a shared secret. Both
are performed by an attacker holding no key at all.

---

## Decisions

Every row is a choice among defensible alternatives. The third column is what the choice costs —
without it this section is advocacy, and a reviewer needs to know what to worry about, not what
to admire.

| decision | alternative not taken | what it costs |
|---|---|---|
| The issuer's document chooses the key; the proof may only select within it | use the key the proof names | a resolver returning an incomplete document refuses credentials that would otherwise verify |
| The resolver is supplied by the caller, as data | the library resolves `did:web` and `did:key` over the network | offline only; freshness is the caller's problem, and a stale document is a stale trust decision |
| One algorithm, closed set; the caller may only narrow | a pluggable algorithm registry | a third party may sign with anything but cannot verify through this library until we ship a release |
| `publicKey` is PEM | JWK, the DID Core convention | `did:key` needs a base58/multicodec conversion, and a document reader expecting `publicKeyJwk` will not recognise ours without a mapping |
| Refusal is a returned object, `outcome` uniform across both operations | throw, or `{ verified, errors }` | callers cannot use exceptions for unexpected failure, and every call site branches on `outcome` first |
| A proof naming no verification method is refused | fall back to the only assertion method | hand-written credentials without a fragment fail even against a single-key document |
| `issue` refuses a signer keyed outside the issuer's DID | issue it, let `verify` catch it | delegation, a shared HSM, and an agent-held issuer key are unsupported until this is revisited |
| The validity window and revocation are out of scope | check the window inside `verify` | `verify` accepts an expired credential; every caller must check the window itself, and a caller that forgets gets an accepted, expired credential |
| `issue` returns both `signingInput` and `credential` | the credential alone, callers re-derive the bytes | the same fact appears twice in one result |

---

## Out of scope

- the validity window, revocation, and status lists — policy, and it lives in the package
- presentations (VP), selective disclosure, zero-knowledge proofs
- DID resolution itself: the library consumes a resolver, it does not resolve
- key generation, custody, rotation, and key discovery over a network
- proof formats other than the JWT encoding, and algorithms other than `EdDSA`
- JSON-LD canonicalisation and signature suites beyond the one used here
- credentials carrying more than one proof
- caching, concurrency, persistence, and transport

---

## What would make this brief wrong

Stated on purpose. A brief with no way to be wrong is an aspiration.

- If `verify` is meant to fetch issuer documents over a network, then "the resolver supplies
  them as data" is the wrong shape and VERIFY-003 describes the wrong failure.
- If a credential may legitimately carry more than one proof, then VERIFY-001's "the key" is
  singular and the invariant is under-specified.
- If the JWT encoding is not the only format that must work, ISSUE-002 refuses something that
  should be accepted.
- If a signer may legitimately issue under a DID it does not control — delegation, a shared HSM,
  an issuer key held by an agent — then ISSUE-003 refuses something that should be allowed.
- If expiry is the library's job after all, its absence from this brief is a hole, not a
  boundary.

