// Produces every value in this directory that a vector cannot invent.
//
//   node conformance/fixtures/make-fixtures.mjs
//
// Deterministic, on purpose. Ed25519 keys are derived from fixed seeds and ed25519 signatures are
// deterministic (RFC 8032), so this script is a pure function: run it twice, get byte-identical
// files, and the digests in manifest.yaml stay valid. That is what makes a fixture a *frozen read*
// rather than a computation — the vectors depend on values that cannot drift between runs.
//
// The keys below are test-only: derived from public seed strings, never used outside this suite,
// and worthless by construction.
//
// Note on canonicalisation: this script serialises the JWT payload with sorted keys. It does
// *not* reproduce the implementation's canonical form, and it must not — a fixture is data the
// verifier is asked to accept as given. Vectors therefore compare decoded payloads, never raw
// signing-input strings, so the two serialisations never have to agree.

import { createHash, createPrivateKey, createPublicKey, sign } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

const ISSUER_A = "did:example:issuer-a";
const ISSUER_B = "did:example:issuer-b";
const KEY_A = `${ISSUER_A}#key-1`;
const KEY_B = `${ISSUER_B}#key-1`;

// --- deterministic keys -------------------------------------------------------------------

function ed25519FromSeed(label) {
  const seed = createHash("sha256").update(`ai-conformance/${label}`).digest();
  // PKCS#8 wrapper for an Ed25519 private key: SEQUENCE, version, algorithm OID, OCTET STRING.
  const pkcs8 = Buffer.concat([
    Buffer.from([
      0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04,
      0x20,
    ]),
    seed,
  ]);
  const privateKey = createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });
  return {
    privateKey,
    privatePem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicPem: createPublicKey(privateKey).export({ type: "spki", format: "pem" }).toString(),
  };
}

// --- JWT assembly -------------------------------------------------------------------------

function canon(value) {
  if (Array.isArray(value)) return `[${value.map(canon).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canon(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const b64 = (value) => Buffer.from(canon(value)).toString("base64url");

function jwt(header, payload, privateKey) {
  const input = `${b64(header)}.${b64(payload)}`;
  if (header.alg === "none") return `${input}.`;
  return `${input}.${sign(null, Buffer.from(input), privateKey).toString("base64url")}`;
}

const SECONDS = (iso) => Math.floor(Date.parse(iso) / 1000);

function claims(unsigned) {
  return {
    vc: unsigned,
    iss: unsigned.issuer.id,
    jti: unsigned.id,
    nbf: SECONDS(unsigned.issuanceDate),
    exp: SECONDS(unsigned.expirationDate),
  };
}

const proof = (jwtString, method) => ({ type: "JwtProof2020", jwt: jwtString, verificationMethod: method });
const ED_DSA = { alg: "EdDSA", typ: "JWT" };

// --- the values ---------------------------------------------------------------------------

const a = ed25519FromSeed("issuer-a");
const b = ed25519FromSeed("issuer-b");

const unsigned = {
  "@context": ["https://www.w3.org/ns/credentials/v2"],
  id: "urn:credential:fixture:agent-authorization",
  type: ["VerifiableCredential", "AgentAuthorization"],
  issuer: { id: ISSUER_A },
  issuanceDate: "2026-01-01T00:00:00.000Z",
  expirationDate: "2026-12-31T23:59:59.000Z",
  credentialSubject: { holder: { id: "did:example:holder" }, scope: ["read", "write"] },
};

const commonClaims = claims(unsigned);
const issuedJwt = jwt(ED_DSA, commonClaims, a.privateKey);

const tampered = {
  ...unsigned,
  credentialSubject: { holder: { id: "did:example:holder" }, scope: ["read", "write", "admin"] },
  proof: proof(issuedJwt, KEY_A),
};

const fixtures = {
  // Test-only keypairs. The conformance entry point builds a signer from the private half.
  "keys.json": {
    issuerA: { did: ISSUER_A, keyId: KEY_A, privatePem: a.privatePem, publicPem: a.publicPem },
    issuerB: { did: ISSUER_B, keyId: KEY_B, privatePem: b.privatePem, publicPem: b.publicPem },
  },

  // What a resolver returns. Data, not a function — a vector may publish any document it likes.
  "resolver.json": {
    [ISSUER_A]: {
      id: ISSUER_A,
      assertionMethod: [{ id: KEY_A, publicKey: a.publicPem }],
    },
    [ISSUER_B]: {
      id: ISSUER_B,
      assertionMethod: [{ id: KEY_B, publicKey: b.publicPem }],
    },
  },

  // An unsigned credential, as the credential package would build it.
  "unsigned.json": unsigned,

  // Signed by issuer A under its own key. The accepted baseline.
  "issued.json": { ...unsigned, proof: proof(issuedJwt, KEY_A) },

  // The document was altered after signing; the JWT still covers the original claims.
  "tampered.json": tampered,

  // Claims to be issuer A, signed with issuer B's key. VERIFY-001 must refuse.
  "foreignKey.json": { ...unsigned, proof: proof(jwt(ED_DSA, commonClaims, b.privateKey), KEY_A) },

  // The signature is genuine, the method is not one issuer A publishes.
  "unlistedMethod.json": {
    ...unsigned,
    proof: proof(issuedJwt, `${ISSUER_B}#key-1`),
  },

  // No method named at all. The verifier must not fall back to the only one it can find.
  "noMethod.json": { ...unsigned, proof: { type: "JwtProof2020", jwt: issuedJwt } },

  // Header says no signature is needed, and supplies none.
  "algNone.json": { ...unsigned, proof: proof(jwt({ alg: "none", typ: "JWT" }, commonClaims, null), KEY_A) },
};

// --- write ---------------------------------------------------------------------------------

await mkdir(HERE, { recursive: true });
const entries = [];

for (const [file, value] of Object.entries(fixtures)) {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(join(HERE, file), body, "utf8");
  entries.push({ file, sha256: createHash("sha256").update(body).digest("hex") });
}

const manifest = [
  "# Generated by make-fixtures.mjs. Do not edit by hand.",
  "#",
  "# A fixture is read, never computed. Each digest below is checked by the runner; a mismatch is",
  "# a FIXTURE-STALE finding, because a fixture that changed is no longer the thing the vectors",
  "# were written against.",
  "",
  "fixtures:",
  ...entries.flatMap(({ file, sha256 }) => [
    `  - file: ${file}`,
    `    sha256: ${sha256}`,
  ]),
  "",
].join("\n");

await writeFile(join(HERE, "manifest.yaml"), manifest, "utf8");

console.log(`wrote ${entries.length} fixtures + manifest.yaml`);
for (const { file, sha256 } of entries) console.log(`  ${sha256.slice(0, 16)}  ${file}`);
