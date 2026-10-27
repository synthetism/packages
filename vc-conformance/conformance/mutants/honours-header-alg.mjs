// Mutant: honours the algorithm the credential names.
//
// Breaks VERIFY-004, and nothing else.
//
// A verifier that reads `alg` out of the header and looks it up in its own dispatch table.
// That is the shape of the bug, not a caricature of it: the header is inside the signed bytes,
// so the value is *authentic* — it really was signed by whoever signed this. But authenticity is
// not authorisation. The credential is being asked which lock to pick.
//
// The single mutation is the `none` entry. Someone added it so that "unsigned credentials" would
// work, and it means a credential can opt out of being verified by saying so. Everything else
// here — issuer resolution, method membership, signature verification — is what the brief asks
// for. The caller's `algorithms` option is never consulted; that absence is the defect.
//
// Expected: refused by a VERIFY-004 vector, untouched by every other vector.
// Dormant until those vectors exist.

import { verify } from "node:crypto";

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));

const PRIMITIVES = {
  EdDSA: (data, signature, publicKeyPem) =>
    verify(
      null,
      Buffer.from(data),
      { key: publicKeyPem, format: "pem" },
      Buffer.from(signature, "base64url"),
    ),
  // The mutation.
  none: () => true,
};

const refuse = (invariant) => ({ outcome: "refused", invariant });
const accept = () => ({ outcome: "accepted" });

function decode(jwt) {
  const segments = typeof jwt === "string" ? jwt.split(".") : [];
  if (segments.length !== 3) return null;
  try {
    const decodeSegment = (s) => JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
    return {
      header: decodeSegment(segments[0]),
      payload: decodeSegment(segments[1]),
      signingInput: `${segments[0]}.${segments[1]}`,
      signature: segments[2],
    };
  } catch {
    return null;
  }
}

function verifyCredential({ credential, resolver = {} }) {
  const proof = credential?.proof;
  const parsed = decode(proof?.jwt);
  if (!parsed) return refuse("VERIFY-002");

  // The mutation, made explicit: the algorithm comes from the credential.
  const alg = parsed.header?.alg;
  const primitive = typeof alg === "string" ? PRIMITIVES[alg] : undefined;
  if (!primitive) return refuse("VERIFY-004");

  const document = resolver[parsed.payload?.iss];
  if (!document) return refuse("VERIFY-003");

  const methods = Array.isArray(document.assertionMethod) ? document.assertionMethod : [];
  const method = methods.find((m) => m.id === proof.verificationMethod);
  if (!method) return refuse("VERIFY-001");

  // A malformed key is a refusal, not a crash. Catching it here keeps this mutant wrong in
  // exactly one way: the `none` entry above, and nothing else.
  let ok = false;
  try {
    ok = primitive(parsed.signingInput, parsed.signature, method.publicKey);
  } catch {
    ok = false;
  }
  return ok ? accept() : refuse("VERIFY-002");
}

process.stdout.write(JSON.stringify(verifyCredential(input)));
