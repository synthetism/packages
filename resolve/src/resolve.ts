/**
 * `resolve` — which of a holder's credentials *could* satisfy each part of a requirement?
 *
 * Not a collector and not a chooser. It hands back, per requirement key, the credentials
 * that individually satisfy it, and then the client decides. Which of three valid
 * candidates to spend is a policy — latest expiry, narrowest scope, the one it has not
 * used — and there is no single right answer, so the library does not hold one.
 *
 * It is built **on `validate`**, one key at a time. That is deliberate: there is exactly one
 * implementation of what "satisfies" means, and a resolver that reimplemented it would
 * eventually disagree with the validator about a document — which is the failure mode this
 * whole design exists to avoid.
 */

import {
  type Failure,
  LANGUAGE_ADDRESS,
  type ValidateInput,
  type Verdict,
  validate,
} from "@synthetism/query";

export interface Candidate<C = unknown> {
  /** The requirement key this answers, e.g. `authorization`. */
  key: string;
  /** The credential type it asked for. */
  type: string;
  /** `false` when the requirement is desirable rather than necessary. */
  required: boolean;
  /** Everything the holder holds that satisfies it, in the order it was given. */
  candidates: C[];
}

export interface Resolution<C = unknown> {
  /** The language address the document cited, when it cited one. */
  address?: string;
  candidates: Candidate<C>[];
  /** Every required key has at least one candidate. Not a guarantee of admission. */
  satisfied: boolean;
  /** Why it is not satisfied — the same reasons `validate` gives. */
  failures: Failure[];
}

type ResolveInput<C> = Omit<ValidateInput<C>, "only">;

export function resolve<C = unknown>(input: ResolveInput<C>): Resolution<C> {
  const whole: Verdict = validate(input);
  const language = asRecord(asRecord(asRecord(input.document)?.credentialSubject)?.requirement);

  const address = asRecord(asRecord(input.document)?.credentialSchema)?.id;

  // The language is data, so `validate` reads any of them. This resolver is *code*, and it
  // walks v1's `requirements` map. A language that reorganised that map is one this
  // function cannot walk — and saying so is the only honest answer. Returning "satisfied"
  // with no candidates would be the worst outcome available.
  if (address !== LANGUAGE_ADDRESS) {
    return {
      ...(typeof address === "string" ? { address } : {}),
      candidates: [],
      satisfied: false,
      failures: [
        {
          key: "$",
          reason: "unsupported-language",
          detail: typeof address === "string" ? `this resolver speaks ${LANGUAGE_ADDRESS}` : "the document names no language",
        },
      ],
    };
  }

  if (language === undefined) {
    return {
      ...(typeof address === "string" ? { address } : {}),
      candidates: [],
      satisfied: false,
      failures: whole.failures,
    };
  }

  const specs = asRecord(language.requirements) ?? {};
  const candidates: Candidate<C>[] = [];
  const failures: Failure[] = [];

  for (const [key, raw] of Object.entries(specs)) {
    const spec = asRecord(raw) ?? {};
    const type = typeof spec.type === "string" ? spec.type : "";
    const required = spec.required !== false;

    const offered = input.credentials.filter(
      (credential) =>
        typesOf(credential).includes(type) && holderOf(credential) === input.holder,
    );

    // One credential at a time, judged by the single implementation of "satisfies".
    const satisfying = offered.filter(
      (credential) =>
        validate({
          ...input,
          credentials: [credential],
          only: [key],
        }).ok,
    );

    candidates.push({ key, type, required, candidates: satisfying });

    // Absent-and-optional is not a gap — that is what `required: false` is for. Reporting it
    // would make every requirement with an optional part permanently unsatisfiable.
    if (satisfying.length === 0 && required) {
      const reason = whole.failures.find((failure) => failure.key === key);
      failures.push(reason ?? { key, reason: "no-credential", detail: `nothing of type ${type}` });
    }
  }

  return {
    ...(typeof address === "string" ? { address } : {}),
    candidates,
    satisfied: failures.length === 0,
    failures,
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function typesOf(credential: unknown): string[] {
  const type = asRecord(credential)?.type;
  if (typeof type === "string") return [type];
  return Array.isArray(type) ? type.filter((entry): entry is string => typeof entry === "string") : [];
}

function holderOf(credential: unknown): string | undefined {
  const holder = asRecord(asRecord(asRecord(credential)?.credentialSubject)?.holder)?.id;
  return typeof holder === "string" ? holder : undefined;
}
