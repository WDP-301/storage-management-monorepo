import { createHash } from 'node:crypto';

/** Recursively serializes an object with sorted keys (Canonical JSON). */
export function canonicalStringify(val: unknown): string {
  if (val === null || typeof val !== 'object') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return `[${val.map((item) => (item === undefined ? 'null' : canonicalStringify(item))).join(',')}]`;
  }
  const obj = val as Record<string, unknown>;
  const sortedKeys = Object.keys(obj)
    .filter((key) => obj[key] !== undefined)
    .sort();
  const pairs = sortedKeys.map((key) => `${JSON.stringify(key)}:${canonicalStringify(obj[key])}`);
  return `{${pairs.join(',')}}`;
}

/** SHA-256 hex of a deterministic canonical JSON representation of the request body. */
export function hashBody(body: Record<string, unknown>): string {
  return createHash('sha256').update(canonicalStringify(body)).digest('hex');
}
