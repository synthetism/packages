# Code Conformance Suite — Builder Experience & Feedback Report

**Target Package:** `@synthetism/did` (`/Users/helios/Dev/ecom/synthetism/packages/did`)  
**Document Evaluated:** `SPEC.md` (Protocol v0.7), `BUILDER.md` (v0.3)  
**Date & Timestamp:** 2026-11-01T11:24:06+08:00  

---

## 1. Builder Metadata

| Field | Value |
|---|---|
| **Agent / Model** | Gemini 3.8 Flash (High) |
| **Harness / Environment** | Antigravity Agentic IDE (macOS, zsh, Node.js v24+) |
| **Role Assumed** | Builder (`rw` on implementation, `r` on suite & conformance assets) |
| **Protocol / Spec Version** | Spec 0.7 (`runner.mjs` 0.7.0) |
| **Total Build & Remediation Time** | ~7 minutes (1 iteration pass: initial 9 red vectors → 58/58 green) |
| **Final Outcome** | Conformance judge: 58 passed, 0 failed; Suite: 37 mutants killed, 0 survived |
| **Saved Run Artifact** | `.conformance-runs/judge-2026-11-01T03-13-51-073Z.json` |

---

## 2. Overall Experience: Conformance Suite as Single Source of Truth

The "Conformance Suite as Source of Truth" paradigm is a major improvement over traditional prompt-and-test or spec-prose-only development for AI coding agents:

1. **Elimination of Interface Guesswork**:
   Because `vectors/` explicitly define `given` inputs and exact `expect` values (no subset matching, exact deep equality), there is zero ambiguity on the exact runtime surface, argument formats, or casing normalisation requirements.
2. **Deterministic Red → Green Feedback Loop**:
   Gate 6 exiting `ok: true` *after* a genuine red run provides immediate, falsifiable evidence that changes are working. The runner output `why: expected X got Y` instantly identified the exact 2 core issues (parity vs. charset message attribution and codec layer error wrapping).
3. **Mutants as Invariant Intent Clarifiers**:
   Reading `mutants.yaml` and `mutants/` helped clarify edge-case requirements (e.g., `wrap-only-zero`, `unbounded-refusal`, `swallow-defects`). Mutants explain *why* constraints exist far better than abstract prose descriptions.
4. **Discipline via Role ACL**:
   Enforcing that the builder cannot touch `expect` or modify vectors prevents regression drift and ensures the suite remains an objective benchmark rather than adapting to the code's bugs.

---

## 3. SPEC.md & BRIEF.md Observations and Ambiguities

### 3.1 SPEC.md Refusal Format vs. BRIEF.md Wire Definition
- **Observation:** `SPEC.md` §16.1 states:
  > *“Refusal MUST be data... when it does, the vector expresses it as `expect: { throws: <message> }`.”*
- **Discrepancy:** In `BRIEF.md` (and implemented across all vectors and the runner adapter), thrown errors cross the wire as a structured object:
  ```json
  { "throws": { "name": "<class>", "message": "<text>" } }
  ```
- **Impact:** While `BRIEF.md` explicitly noted this under its Decisions table (`refusals cross as { name, message }`), the core `SPEC.md` §16.1 still documents a scalar string `<message>`.
- **Recommendation:** Update `SPEC.md` §16.1 to formally standardize `{ throws: { name, message } }` or document that the error object payload is schema-defined per suite.

### 3.2 Unchecked Obligations vs. Open Questions in Conformance
- **Observation:** In `BRIEF.md`, `GUARD-001` specifies that `isDidKey` catches `DidKeyError` and rethrows internal defects (`GUARD-001 (rethrow half)`), categorized under *Unchecked obligations*. In `questions.yaml`, `q2` discusses `mutants/swallow-defects.mjs` being withdrawn because permanent survivors prevent a suite from reporting `ok: true`.
- **Experience:** Because the runner cannot directly check whether defects propagate without a deliberately broken implementation, having clear guidance on how the builder should implement obligations (e.g., checking `if (error instanceof DidKeyError) return false; throw error;`) was deduced from reading `mutants/swallow-defects.mjs` and the obligation table.
- **Recommendation:** In `BUILDER.md`, explicitly remind builders to check the brief’s *Unchecked obligations* section when implementing functions whose vectors only cover positive/negative returns (such as guards).

### 3.3 Message Truncation and Error Template Clarity
- **Observation:** In `DIDKEY-002`, the brief stated: *“an input longer than 32 characters appears as its first 32 characters followed by `…`, never whole”*.
- **Experience:** Determining whether the 32-character boundary applied to both odd-length parity errors and invalid charset errors required checking the vectors (`DIDKEY-002#v4`, `v5`, `v7`). Having the exact format template (e.g., `expected hex characters, got "<truncated>…"`) documented in `BRIEF.md` section *The wire* alongside error shapes would make cross-referencing even faster.

---

## 4. Product Usability, Tooling, and Build-Time Bottlenecks

### 4.1 CLI Discovery & Interactive `npx` Prompt
- **Issue:** Running `npx -y conformance-runner@0.7` failed because version 0.7 was not published to the npm registry. Furthermore, calling `npx conformance-runner` prompted interactively:
  `Need to install the following packages: conformance-runner@0.6.0 Ok to proceed? (y)`. In autonomous or non-interactive terminal sessions, this causes background commands to stall.
- **Resolution:** As noted in `BUILDER.md`, falling back to `node /path/to/conformance/runner/runner.mjs` solved the issue.
- **Recommendation:**
  1. Add a direct npm script in package repositories targeting conformance testing (e.g. `"test:conformance": "node ../../conformance/runner/runner.mjs judge conformance/implementation.mjs"`).
  2. Ensure all runner CLI wrappers pass `--yes` / non-interactive flags when delegating to `npx`.

### 4.2 Stale Build Danger (`dist/` vs `src/`)
- **Issue:** The adapter `conformance/implementation.mjs` imports from `../dist/index.js`.
- **Experience:** As `BUILDER.md` rightly warns, modifying `src/did-key.ts` without running `npm run build` results in testing stale bytecode.
- **Recommendation:**
  1. Consider adding a `build` hook to `suite.yaml` (e.g. `prejudge: npm run build` or `build: tsc -p tsconfig.json`) so `runner judge` can either verify freshness or automatically rebuild before judging.
  2. Alternatively, encourage adapters in TypeScript environments to use loaders (`tsx`, `node --loader`, or `ts-node/esm`) for zero-build latency during iteration.

### 4.3 Serial Execution of Mutants in `runner suite`
- **Issue:** `runner suite` took ~15–20 seconds because it serially executed 37 mutants across multiple vector files, spawning separate Node child processes for each.
- **Recommendation:** Running mutants in parallel using a worker pool or `Promise.all` across independent mutant executions could reduce suite verification time to < 2 seconds.

### 4.4 Visibility of Saved Artifacts
- **Observation:** When running with `--save`, the saved artifact path is output only to `stderr`:
  `saved /path/to/.conformance-runs/judge-....json`
- **Recommendation:** Include the saved artifact path in the JSON verdict payload on `stdout` (e.g., `"savedTo": "/path/to/..."` when `--save` is active), making programmatic downstream consumption trivial.

---

## 5. Summary Scorecard

| Dimension | Rating | Note |
|---|:---:|---|
| **Contract Precision** | **9.5 / 10** | Vectors and op projections provide exact, indisputable target behavior. |
| **Error Diagnostics** | **9.5 / 10** | Precise deep diffs (`expected X got Y`) make root cause identification rapid. |
| **Workflow Discipline** | **9.0 / 10** | Red-then-green gate requirement enforces true test integrity. |
| **Tooling & Setup Friction** | **7.5 / 10** | Stale build risk (`dist/`), unpublished runner versions in `npx`, and serial mutant execution. |

The Conformance Suite protocol significantly reduces AI hallucination, prevents specification drift, and delivers verifiable correctness on the first attempt.

