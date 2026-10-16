# Changelog

All notable changes to this package are documented here.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0

First release.

- **Present** — `present(unsigned, signer, challenge)` → `{ presentation, signingInput }`,
  with a `JwtProof2020` proof whose `verificationMethod` is the **holder**
- **The challenge** — `aud`, `nonce` and `[nbf, exp]` come from the verifier, never from
  the presenter; `expiresIn` bounds the window and `issuedAt` pins it
- **The window is written into the document** — `nbf`/`exp` MUST represent
  `issuanceDate`/`expirationDate` (§6.3.1), so `present` stamps both dates onto the
  presentation from the challenge and the claims represent something real
- **`jti` is the presentation's `id`, `nonce` is the anti-replay** — two claims because
  they are two facts, and the one the verifier depends on is the one the verifier chose
- **`typ: "JWT"`** — what §6.3.1 requires, and nothing is lost: `alg`/`typ` were always
  advisory, and the `vp` claim is what identifies the document
- **The clock is pinned inside `present`** — `nbf` is read from the clock, so signing and
  attaching at two different instants would produce a JWT covering bytes nobody signed
- **Verify** — `verifyPresentation(vp, { challenge })` → `{ verified, errors }`: the
  holder's proof, the window, the binding, then every carried credential, reported
  together and labelled by index
- **The binding** — the holder must be the subject of each credential it carries;
  switchable off, at which point a credential is a bearer coupon
- **Window bounds** — live now, no wider than the challenge, not before it was issued,
  and not after it expired. The end is bounded by the start and the width, so a
  presenter is never punished for the round trip
- **Algorithm allow-list** — `header.alg` is checked *before* the signature, so an
  `alg: "none"` presentation is rejected by policy
- **The VP Language** — `VPLanguageSchema`, `RequirementSpec`, `MatchConditions` and
  `RequirementSubject`: what a verifier demands, as data, signed by the service
- **Single use is not here** — `nonce` is checked against the nonce; remembering it is
  the verifier's state, and the README shows the five lines
