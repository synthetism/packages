#!/usr/bin/env node
// The runner. An instrument, not part of the suite.
//
//   node runner.mjs suite                    judge the suite. No implementation involved.
//   node runner.mjs judge <command>          judge an implementation against the suite.
//
// It knows nothing about credentials, prices, or any other domain word. It spawns processes,
// compares JSON, and reports. Every executable it runs — an implementation, an op, a mutant — is
// the same kind of thing: one JSON object in, one JSON object out.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { parseYaml } from "./lib/yaml.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const SUITE = process.env.SUITE ? resolve(process.env.SUITE) : join(HERE, "conformance");

// --- plumbing ---------------------------------------------------------------------------

const violations = [];
const note = (code, at, detail) => violations.push(detail ? { code, at, detail } : { code, at });

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function list(dir, ext) {
  try {
    return (await readdir(dir)).filter((f) => f.endsWith(ext)).sort();
  } catch {
    return [];
  }
}

function run(command, input) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [command], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (c) => (out += c));
    child.stderr.on("data", (c) => (err += c));
    child.on("close", () => {
      try {
        done({ ok: true, value: JSON.parse(out) });
      } catch {
        done({ ok: false, error: (err.trim() || out.trim() || "no output").split("\n")[0] });
      }
    });
    child.stdin.end(JSON.stringify(input));
  });
}

// --- substitutions ----------------------------------------------------------------------

let fixtures = {};

async function resolveValue(value, given) {
  if (typeof value === "string") {
    if (value.startsWith("$fixture.")) {
      const name = value.slice("$fixture.".length);
      if (!(name in fixtures)) throw new Error(`no fixture "${name}"`);
      return fixtures[name];
    }
    if (value.startsWith("$given.")) {
      let at = given;
      for (const part of value.slice("$given.".length).split(".")) {
        at = at?.[part];
      }
      return at;
    }
    return value;
  }
  if (Array.isArray(value)) return Promise.all(value.map((v) => resolveValue(v, given)));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = await resolveValue(v, given);
    return out;
  }
  return value;
}

// --- loading ----------------------------------------------------------------------------

async function loadFixtures() {
  const dir = join(SUITE, "fixtures");
  const manifestPath = join(dir, "manifest.yaml");
  let manifest;
  try {
    manifest = parseYaml(await readFile(manifestPath, "utf8"));
  } catch {
    note("PARSE", "fixtures/manifest.yaml");
    return;
  }
  for (const entry of manifest?.fixtures ?? []) {
    const body = await readFile(join(dir, entry.file), "utf8").catch(() => null);
    if (body === null) {
      note("PARSE", `fixtures/${entry.file}`, "named in the manifest but missing");
      continue;
    }
    if (entry.sha256) {
      const digest = createHash("sha256").update(body).digest("hex");
      if (digest !== entry.sha256) note("FIXTURE-STALE", `fixtures/${entry.file}`);
    }
    fixtures[entry.file.replace(/\.json$/, "")] = JSON.parse(body);
  }
}

async function loadVectorFile(path, { requireInvariant }) {
  let doc;
  try {
    doc = parseYaml(await readFile(path, "utf8"));
  } catch (error) {
    note("PARSE", relative(SUITE, path), String(error.message).split("\n")[0]);
    return null;
  }
  const where = relative(SUITE, path);

  if (!doc || typeof doc !== "object") return note("FIELD", where, "not a mapping"), null;
  if (!doc.operation) return note("FIELD", where, 'missing "operation"'), null;
  if (requireInvariant && !doc.invariant) return note("FIELD", where, 'missing "invariant"'), null;
  if (!Array.isArray(doc.vectors) || doc.vectors.length === 0) {
    return note("FIELD", where, 'missing or empty "vectors"'), null;
  }

  const seen = new Set();
  for (const v of doc.vectors) {
    const at = `${where}#${v?.id ?? "?"}`;
    if (!v?.id || !v?.title) note("FIELD", at, "needs id and title");
    else if (seen.has(v.id)) note("DUPLICATE", at, "id used twice");
    else seen.add(v.id);
    if (!("given" in (v ?? {}))) note("FIELD", at, 'missing "given"');
    if (!("expect" in (v ?? {}))) note("FIELD", at, 'missing "expect"');
    if (v?.fn && !(await readFile(join(SUITE, v.fn)).catch(() => null))) note("UNKNOWN-OP", at, v.fn);
  }
  return doc;
}

function invariantIds(brief) {
  return [...brief.matchAll(/^###\s+([A-Z][A-Z0-9]*-\d{3})\b/gm)].map((m) => m[1]);
}

// --- judging one vector ----------------------------------------------------------------

async function judgeVector(subject, vector) {
  const given = await resolveValue(vector.given, vector.given);
  const expected = await resolveValue(vector.expect, given);

  const first = await run(subject, { operation: vector.operation, ...given });
  if (!first.ok) return { pass: false, why: `did not produce JSON: ${first.error}` };

  let value = first.value;
  if (vector.fn) {
    const projected = await run(join(SUITE, vector.fn), value);
    if (!projected.ok) return { pass: false, why: `op ${vector.fn}: ${projected.error}` };
    value = projected.value;
  }
  if (isDeepStrictEqual(value, expected)) return { pass: true };
  return { pass: false, why: `expected ${JSON.stringify(expected)} got ${JSON.stringify(value)}` };
}

// --- suite ------------------------------------------------------------------------------

async function suite() {
  await loadFixtures();

  const brief = await readFile(join(SUITE, "BRIEF.md"), "utf8").catch(() => "");
  const declared = invariantIds(brief);
  const covered = new Map();

  // Vectors of the implementation, one file per invariant.
  const vectorDir = join(SUITE, "vectors");
  const vectorDocs = new Map();
  for (const file of await list(vectorDir, ".yaml")) {
    const doc = await loadVectorFile(join(vectorDir, file), { requireInvariant: true });
    if (!doc) continue;
    if (doc.invariant !== file.replace(/\.yaml$/, "")) {
      note("FIELD", `vectors/${file}`, "invariant does not match the file name");
    }
    if (!declared.includes(doc.invariant)) note("ORPHAN-VECTOR", `vectors/${file}`, doc.invariant);
    vectorDocs.set(doc.invariant, doc);
    covered.set(doc.invariant, (covered.get(doc.invariant) ?? 0) + doc.vectors.length);
  }
  for (const id of declared) if (!covered.has(id)) note("MISSING-VECTOR", id);

  // Ops are executables too, so they are judged here — no implementation is needed for that.
  const ops = new Map();
  const opsDir = join(SUITE, "ops");
  const opFiles = new Set((await list(opsDir, ".mjs")).map((f) => f.replace(/\.mjs$/, "")));
  for (const file of await list(opsDir, ".yaml")) {
    const doc = await loadVectorFile(join(opsDir, file), { requireInvariant: false });
    if (!doc) continue;
    if (!opFiles.has(doc.operation)) {
      note("UNKNOWN-OP", `ops/${file}`, `no executable for "${doc.operation}"`);
      continue;
    }
    ops.set(doc.operation, doc);
    for (const vector of doc.vectors) {
      const result = await judgeVector(join(opsDir, `${doc.operation}.mjs`), {
        ...vector,
        operation: doc.operation,
      });
      if (!result.pass) note("OP-BLIND", `ops/${file}#${vector.id}`, result.why);
    }
  }

  // Mutants are implementations, so the kill check works before any real code exists.
  //
  // Two guards, both learned by running this:
  //  - a mutant implements *one* operation, so it is only judged against vectors of that operation.
  //    Running a `verify` mutant over `issue` vectors reports collateral that is really just "it
  //    does not implement issue".
  //  - a mutant whose target has no vectors yet cannot be judged at all. That is MISSING-VECTOR's
  //    business, not the mutant's, so it is skipped rather than reported as survived.
  let mutantManifest;
  try {
    mutantManifest = parseYaml(await readFile(join(SUITE, "mutants.yaml"), "utf8"));
  } catch {
    mutantManifest = { mutants: [] };
  }
  const aims = new Set();

  const worked = (mutantManifest?.mutants ?? []).filter((m) => {
    if (m.vector === "ALL") return vectorDocs.size > 0;
    aims.add(m.vector);
    return vectorDocs.has(m.vector);
  });

  const mutants = { total: worked.length, killed: 0, survived: 0 };
  for (const mutant of worked) {
    const targets = mutant.vector === "ALL" ? [...vectorDocs.keys()] : [mutant.vector];
    const operations = new Set(
      targets.filter((id) => vectorDocs.has(id)).map((id) => vectorDocs.get(id).operation),
    );

    const file = join(SUITE, mutant.file);
    if (!(await readFile(file).catch(() => null))) {
      note("FIELD", mutant.name, `no executable at ${mutant.file}`);
      continue;
    }

    let failedTarget = 0;
    let collided = false;
    for (const [invariant, doc] of vectorDocs) {
      if (!operations.has(doc.operation)) continue;
      const isTarget = targets.includes(invariant);
      for (const vector of doc.vectors) {
        const result = await judgeVector(file, { ...vector, operation: doc.operation });
        if (result.pass) continue;
        if (isTarget) failedTarget += 1;
        else {
          collided = true;
          note("MUTANT-COLLATERAL", mutant.name, `${invariant}#${vector.id}`);
        }
      }
    }
    if (failedTarget === 0) {
      note("MUTANT-SURVIVED", mutant.name, `nothing in ${mutant.vector} rejects it`);
      mutants.survived += 1;
    } else if (!collided) mutants.killed += 1;
  }

  // Falsifiability is about an invariant that is claimed and checked but never attacked. An
  // invariant with no vectors is a different finding, reported above.
  for (const id of declared) {
    if (vectorDocs.has(id) && !aims.has(id)) note("UNFALSIFIABLE", id);
  }

  return {
    verb: "suite",
    ok: violations.length === 0,
    violations,
    invariants: { declared: declared.length, covered: covered.size },
    mutants,
  };
}

// --- judge ------------------------------------------------------------------------------

async function judge(command) {
  await loadFixtures();
  const vectorDir = join(SUITE, "vectors");
  let total = 0;
  const failures = [];
  for (const file of await list(vectorDir, ".yaml")) {
    const doc = await loadVectorFile(join(vectorDir, file), { requireInvariant: true });
    if (!doc) continue;
    for (const vector of doc.vectors) {
      total += 1;
      const result = await judgeVector(command, { ...vector, operation: doc.operation });
      if (!result.pass) failures.push({ vector: `${doc.invariant}#${vector.id}`, why: result.why });
    }
  }
  return {
    verb: "judge",
    ok: failures.length === 0,
    vectors: { total, passed: total - failures.length },
    failures,
  };
}

// --- main -------------------------------------------------------------------------------

const [verb, ...rest] = process.argv.slice(2);
if (verb === "suite") {
  const verdict = await suite();
  process.stdout.write(`${JSON.stringify(verdict, null, 2)}\n`);
  process.exit(verdict.ok ? 0 : 1);
} else if (verb === "judge" && rest[0]) {
  const verdict = await judge(resolve(rest[0]));
  process.stdout.write(`${JSON.stringify(verdict, null, 2)}\n`);
  process.exit(verdict.ok ? 0 : 1);
} else {
  process.stderr.write("usage: runner.mjs suite | runner.mjs judge <command>\n");
  process.exit(2);
}
