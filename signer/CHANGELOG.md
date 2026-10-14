# Changelog

All notable changes to this package are documented here.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0

First release.

- **`Signer.from(privateKey)`** — a hex seed or a PKCS#8 PEM; anything that is not an
  Ed25519 private key is refused
- **`sign(data)`** — base64url, so the signature drops straight into a JWT
- **`getPublicKeyHex()`** — the same encoding `keys.derivePublicKey` returns
- **Conformance, proven internally** — no `implements ISigner`, so the published `.d.ts`
  never names `@synthetism/vc`
- **`npm run check:dts`** — reads the emitted declarations and fails if the port leaked
