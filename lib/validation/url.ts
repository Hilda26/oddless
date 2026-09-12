/**
 * Public evidence URL hardening (spec §7). Mirrors the checks the contract
 * itself re-applies on-chain — this client-side copy exists purely to give
 * the creator fast feedback; the contract is the actual authority and
 * re-validates independently, so a bug here can reject-early but can never
 * let anything unsafe through.
 */

export const MAX_SOURCE_URL_LENGTH = 500;
export const MIN_SOURCES = 2;
export const MAX_SOURCES = 4;

const PRIVATE_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./,
  /^\[::1\]$/,
  /^::1$/,
  /\.local$/i,
  /^0x[0-9a-f]+$/i, // hex-encoded IP obfuscation
];

export class UnsafeSourceUrlError extends Error {
  constructor(url: string, reason: string) {
    super(`Source URL rejected ("${url}"): ${reason}`);
    this.name = "UnsafeSourceUrlError";
  }
}

/** Canonical form used for de-duplication: lowercase host, no trailing slash, no fragment. */
export function canonicalizeUrl(raw: string): string {
  const url = new URL(raw);
  url.hash = "";
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.protocol}//${url.host.toLowerCase()}${path}${url.search}`;
}

/** Validate a single evidence URL. Throws `UnsafeSourceUrlError` on any violation. */
export function assertSafeSourceUrl(raw: string): void {
  if (raw.length > MAX_SOURCE_URL_LENGTH) {
    throw new UnsafeSourceUrlError(raw, `longer than ${MAX_SOURCE_URL_LENGTH} characters`);
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeSourceUrlError(raw, "not a well-formed URL");
  }

  if (url.protocol !== "https:") {
    throw new UnsafeSourceUrlError(raw, "must use HTTPS");
  }

  if (url.username || url.password) {
    throw new UnsafeSourceUrlError(raw, "must not embed credentials");
  }

  const hostname = url.hostname;
  if (PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) {
    throw new UnsafeSourceUrlError(raw, "resolves to a localhost/private/obfuscated target");
  }
}

/** Validate a full source list: count bounds, individual safety, and de-duplication. */
export function assertSafeSourceList(urls: string[]): void {
  if (urls.length < MIN_SOURCES || urls.length > MAX_SOURCES) {
    throw new UnsafeSourceUrlError(
      urls.join(", "),
      `must provide between ${MIN_SOURCES} and ${MAX_SOURCES} sources`,
    );
  }

  const seen = new Set<string>();
  for (const raw of urls) {
    assertSafeSourceUrl(raw);
    const canonical = canonicalizeUrl(raw);
    if (seen.has(canonical)) {
      throw new UnsafeSourceUrlError(raw, "duplicate of another source in the same list");
    }
    seen.add(canonical);
  }
}

export function isSafeSourceUrl(raw: string): boolean {
  try {
    assertSafeSourceUrl(raw);
    return true;
  } catch {
    return false;
  }
}
