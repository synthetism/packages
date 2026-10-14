/**
 * Deterministic JSON.
 *
 * A credential's *logical* content should always produce the same bytes, no matter
 * the order the caller happened to build the object in. So when we serialise a
 * payload for signing, we sort keys recursively.
 *
 * Note this applies to **issuing** only. Verification never re-serialises: it takes
 * the JWT exactly as received and checks the signature against those literal bytes.
 * (That is why credentials issued by other implementations still verify — we never
 * ask them to match our canonical form.)
 */

/** JSON with object keys sorted recursively. Arrays keep their order. */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sort(value));
}

function sort(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sort);
  }
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      const entry = source[key];
      if (entry !== undefined) {
        out[key] = sort(entry);
      }
    }
    return out;
  }
  return value;
}
