# Changelog

All notable changes to this package are documented here.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0

First release.

- **Generation** — `generateKeyPair`, `derivePublicKey`, `getFingerprint`, `getShortId`
- **Format conversion** — `hexToPem`, `pemToHex`, `hexPrivateKeyToPem`, `pemPrivateKeyToHex`,
  `base64ToHex`, `hexToBase64`, `base64ToBase64Url`, `base64UrlToBase64`, `detectKeyFormat`,
  `toHex`
- **Verification** — `verifyEd25519`, `verifyRSA`, `verifySecp256k1`, `verifySignature`,
  `isValidBase64`, `isValidBase64Url`
