// The projection ISSUE-001 needs.
//
// The claim is about the *bytes that were signed* versus the *credential that came back*. Neither
// side is comparable on its own: one is base64url, the other carries a signature. So this op
// decodes one, strips the other, and returns four facts a vector can assert exactly.
//
// It exists because the fixture generator's serialisation is not the implementation's, and a vector
// must compare meaning rather than bytes. Comparing raw `signingInput` strings would pass or fail
// on key ordering, which is not what ISSUE-001 says.
//
// It returns data. It does not decide, refuse, or judge — and it takes nothing but the result.

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));

const b64 = (segment) => JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));

function project(result) {
  const jwt = result?.credential?.proof?.jwt;
  const segments = typeof jwt === "string" ? jwt.split(".") : [];

  // The signed bytes are taken from `signingInput`, the value the implementation claims it signed.
  // If the implementation lies about it, `signedVc` and `returned` will disagree — which is exactly
  // what the vector is there to catch.
  const signingInput = typeof result?.signingInput === "string" ? result.signingInput : "";
  const [headerSegment, payloadSegment] = signingInput.split(".");

  const header = headerSegment ? b64(headerSegment) : undefined;
  const payload = payloadSegment ? b64(payloadSegment) : undefined;

  const { proof, ...returned } = result?.credential ?? {};

  return {
    alg: header?.alg,
    signedVc: payload?.vc,
    returned,
    hasSignature: segments.length === 3 && segments[2].length > 0,
  };
}

process.stdout.write(JSON.stringify(project(result)));
