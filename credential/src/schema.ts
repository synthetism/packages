/**
 * The canonical schema namespace.
 *
 * One base, frozen. A schema URI is how a credential says *which* shape it claims
 * to be, independent of its `type` label.
 */

export const SCHEMA_BASE = "https://synthetism.org/schemas";

/** `schemaUri("IpAsset", "1.0.0")` → `https://synthetism.org/schemas/IpAsset/1.0.0` */
export function schemaUri(type: string, version: string): string {
  return `${SCHEMA_BASE}/${type}/${version}`;
}

/** The one context every Synthetism credential carries. */
export const DEFAULT_CONTEXT = ["https://www.w3.org/2018/credentials/v1"];
