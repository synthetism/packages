# Questions

Scratch, not an artefact. Deleted at gate 4. Anything still open here blocks `runner suite`.

A question is answered by changing `BRIEF.md` — this file only holds it until then, and only
because a question found mid-run has nowhere else to be while it is still a question.

## ISSUE-002 — is an unsupported algorithm a refused request?

The brief fixes the supported algorithm set on the *verification* side (`["EdDSA"]`) and says
nothing about `issue`. A signer declaring `RSA` is plausibly "a request the library cannot honour".

- Reading A — `issue` refuses any signer whose `alg` the library does not support. Then this is an
  ISSUE-002 case, and the strongest one in the file.
- Reading B — `issue` signs with whatever the signer gives it, and the mismatch surfaces at `verify`.
  Then the vector is wrong and belongs to no invariant at all.

Cost of guessing: under B I would write a vector asserting a refusal the library should never make.

## §6 — "at least one refused per invariant" is wrong as a blanket convention

ISSUE-001 is a coverage claim. It has no refusal case by nature: it is proved by a positive case
whose projection would differ if the coverage broke. The convention as written makes it unwritable.

Suggested replacement: *at least one case that a plausible wrong implementation would fail.* That
covers both a refusal and a coverage claim without naming either.

## Resolved while writing these vectors (closed, kept for the trail)

- **ISSUE-001 said "the bytes signed".** The signed payload is claims-wrapped, so the invariant means
  the `vc` claim. Brief edited.
- **Nothing said how a vector supplies a signer.** Rule added: `given` mirrors the parameters, and a
  collaborator is supplied as a name the entry point resolves.
- **The strict YAML subset rejected `"@context":`** — the key pattern was `[A-Za-z0-9_.-]+`. The
  subset met its first JSON-shaped document and failed. The spec was already general enough; the
  prototype loader was too narrow. Widened to allow quoted keys and `@`.
