# @synthetism/vp

**Present and verify a presentation.** A credential is issued *to* you and kept; a
presentation is assembled *by* you and sent once — signed by your own key, inside a
window the verifier chose.

`@synthetism/vc` owns `issue` and `verify` for a credential. This owns the other
artifact, so the two halves never have to share a package to share a format.

## Why

A verifier does not actually want a credential. It wants an answer to one question:

> is this presenter the party the credential was issued to — **right now, for me?**

Three things have to hold, and they have nothing to do with each other:

| | |
|---|---|
| **The window** | `aud` is this verifier, `nonce` is the nonce it issued, `[nbf, exp]` fits the challenge |
| **The binding** | the holder is the subject of every credential it carries |
| **The credentials** | each verifies on its own terms — signature, issuer, validity, no edits after signing |

`verify` answers the third. It cannot answer the first two, because neither is a
property of a credential.

**The window is the verifier's, not the presenter's.** The funnel challenges first —
`{ aud, nonce, expiresIn }` — and the presentation's proof is that challenge, echoed
back under the holder's signature. `aud`, `nonce` and `exp` are not three independent
choices; they are one object, signed. A window the presenter chooses is a replay
window the presenter chooses.

## Present

```ts
import { createUnsignedPresentation, present } from "@synthetism/vp";

const unsigned = createUnsignedPresentation({
  holder: { id: agentDid },
  credentials: [authorizationVC],
});

// Straight off the 401.
const challenge = { aud: "did:web:api.example.com", nonce, expiresIn: 60 };

const { presentation, signingInput } = await present(unsigned, signer, challenge);
//                            ^ the exact bytes the signer was given

await fetch("/work", { method: "POST", body: JSON.stringify({ vp: presentation }) });
```

`signer` is the holder's own `ISigner` — one method, `sign(data)`. This package never
sees a key and cannot express "give me the key". That is the port doing its job.

The payload is a JWT, and every claim in it is the one §6.3.1 defines:

| claim | what it carries | who chooses it |
|---|---|---|
| `iss` | the **holder** — a presentation has no issuer | the holder |
| `jti` | the presentation's own `id` | the holder |
| `aud` | which verifier this is for | the challenge |
| `nonce` | the anti-replay, single use | **the challenge** |
| `iat` · `nbf` · `exp` | the window | **the challenge** |

`proof.verificationMethod` names the holder too. `nbf` and `exp` MUST represent the
document's `issuanceDate` and `expirationDate`, so `present` writes both dates into
the presentation from the challenge rather than leaving two claims with nothing
behind them. And a presentation has **no issuer** — that is the whole distinction
between the two artifacts.

> **`jti` is not the nonce.** They are two claims because they are two facts. Putting
the challenge's nonce in `jti` would make a conformant decoder read it back as the
presentation's `id` — overwriting the real one — and would put the property the
verifier depends on into a value the *presenter* controls.

## Verify

```ts
import { verifyPresentation } from "@synthetism/vp";

const verdict = verifyPresentation(vp, {
  challenge: { aud: "did:web:api.example.com", nonce, expiresIn: 60, issuedAt },
});

if (!verdict.verified) return refuse(verdict.errors); // every problem, not just the first
```

Pass the challenge as **you stored it**, `issuedAt` included — that is your clock, and
it is what stops a presenter from sliding the window forward. Omit it and the check
weakens to *"no wider than `expiresIn`"*; with it, the window is yours in both
directions.

`skew` (default `0`) forgives clock drift between two machines. It widens every bound,
so it is opt-in and it is small.

## What this deliberately does not do

**Single use.** `nonce` must equal the nonce you issued. Whether you have *seen* that
nonce before is state, and a pure function has no state. So the five lines live where
they belong — with the nonce you are already holding:

```ts
const seen = new Set<string>();

function admit(vp: VerifiablePresentation): boolean {
  const { nonce } = challenge();                                  // yours
  if (!verifyPresentation(vp, { challenge: challenge() }).verified) return false;
  if (seen.has(nonce)) return false;
  seen.add(nonce);
  return true;
}
```

The verdict alone cannot tell you: a replayed presentation is still *valid*. That is
the honest boundary, and it is why `verifyPresentation` says `nonce is not the nonce`
rather than pretending to know what you have already seen.

**A policy engine.** Requirements are data, and the shapes are here —
`VPLanguageSchema`, `RequirementSpec` — but matching a presentation against them is the
funnel's job, not the format's.

## The VP Language

What a verifier demands, published *before* anything is presented, on the 401, signed
by the service that will enforce it:

```ts
const requirement: RequirementSubject = {
  holder: { id: serviceDid },
  requirement: {
    name: "market-read",
    version: "3",
    requirements: {
      authorization: { type: "AuthorizationCredential", required: true, match: { scope: ["read"] } },
    },
  },
};
```

Where that requirement **lives** is not a field of its own. It is the credential's
`credentialSchema` — the data model's own slot for *"the address of the shape this
document conforms to"* (§5.4) — and `requirement.version` is what catches a cached
copy that has gone stale:

```ts
createUnsigned({
  subject: requirement,
  type: "RequirementCredential",
  issuer: { id: serviceDid },
  credentialSchema: {
    id: "https://synthetism.org/schemas/market-read/3",
    type: "JsonSchemaValidator2018",
  },
});
```

If a capability cannot be expressed here, it is a custom integration wearing a
requirement's clothes. That is the test this shape exists to make cheap.

## API

| | |
|---|---|
| `present(unsigned, signer, challenge, opts?)` | → `{ presentation, signingInput }` |
| `attachPresentationProof(unsigned, signature, challenge, opts?)` | the manual path |
| `presentationDocument(unsigned, challenge, opts?)` | the presentation with the challenge's window written into it — what actually gets signed |
| `presentationPayload` · `presentationSigningInput` | the exact bytes, before any crypto |
| `verifyPresentation(vp, { challenge, … })` | → `{ verified, errors }` |
| `createUnsignedPresentation` · `presentationId` | re-exported from `@synthetism/credential` |

## Requirements

Node 18+. Depends on `@synthetism/credential` (the format), `@synthetism/vc` (the
port, and `verify` for what a presentation carries) and `@synthetism/keys`
(verification, on the frozen floor).

## License

MIT
