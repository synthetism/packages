/**
 * @synthetism/vp — the presentation.
 *
 * `@synthetism/vc` owns *issue* and *verify* for a credential. This owns the other
 * artifact: **present**. A credential is issued *to* you and kept; a presentation is
 * assembled *by* you and sent once, signed by your own key, inside a window the
 * verifier chose.
 *
 * Three operations, in the order a caller meets them:
 *
 * | | |
 * |---|---|
 * | `present` | an unsigned presentation plus a challenge in, a signed one out |
 * | `verifyPresentation` | a presentation plus the challenge you issued in, a verdict out |
 * | the VP Language | what a verifier demands, as data — `VPLanguageSchema` |
 *
 * The verifier never holds a key, and the presenter never holds a secret belonging
 * to anyone else. That is not a convenience; it is the property the design rests on.
 */

export type {
  Challenge,
  MatchConditions,
  PresentResult,
  PresentationClaims,
  RequirementSpec,
  RequirementSubject,
  VPLanguageSchema,
} from "./types.js";

export {
  attachPresentationProof,
  present,
  presentationDocument,
  presentationPayload,
  presentationSigningInput,
  type PresentationOptions,
} from "./presentation.js";

export {
  DEFAULT_SKEW,
  verifyPresentation,
  type VerifyPresentationOptions,
} from "./verify.js";

// --- the format, re-exported ------------------------------------------------
// A presenter needs two names from `@synthetism/credential` and nothing else.
// Re-exporting them is not the same as adopting the package — but it does mean the
// whole of "present" is one import, which is how it will actually be called.
export {
  createUnsignedPresentation,
  presentationId,
} from "@synthetism/credential";

export type {
  Holder,
  UnsignedPresentation,
  VerifiableCredential,
  VerifiablePresentation,
} from "@synthetism/credential";

export type { ISigner, VerifyResult } from "@synthetism/vc";
