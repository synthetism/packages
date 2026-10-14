# Changelog

All notable changes to this package are documented here.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0

First release.

- **The port** — `ISigner`, one method, owned here and implemented nowhere here
- **Issue** — `issue(unsigned, signer)` → `{ credential, signingInput }`, with a
  `JwtProof2020` proof
- **Verify** — `verify(credential, opts)` → `{ verified, errors }`, reporting every
  problem it finds
- **Algorithm allow-list** — `header.alg` is checked *before* the signature, so an
  `alg: "none"` credential is rejected by policy
- **Document ↔ payload comparison** — the signed bytes cover only `header.payload`,
  so the visible fields are compared against the ones that were signed
- **Resolution** — `resolveDidKey` for `did:key`; injectable resolver and verifier
  for everything else
- **The format re-exported** — values and types, never `export *`
