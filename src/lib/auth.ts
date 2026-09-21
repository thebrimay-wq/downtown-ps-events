import type { NextRequest } from "next/server";

// Verifies the shared admin secret used to gate scraping + admin mutations.
// Accepts the secret via the `x-admin-secret` header or an `Authorization:
// Bearer` token (both for cron and scripts), or the session cookie that the
// admin page sets after a successful sign-in. It is never read from the query
// string: observability is on in wrangler.jsonc, so a `?secret=` would be
// written into the request logs of every cron run.

export const ADMIN_SESSION_COOKIE = "admin_session";
// Long enough for a moderation session, short enough that a stale laptop
// cookie does not stay a credential for weeks.
export const ADMIN_SESSION_MAX_AGE = 12 * 60 * 60;

export function adminSecretConfigured(): boolean {
  return Boolean(process.env.ADMIN_SECRET);
}

export async function isAuthorized(req: NextRequest): Promise<boolean> {
  const expected = process.env.ADMIN_SECRET;
  // If no secret is configured, refuse all privileged actions rather than
  // silently allowing them.
  if (!expected) return false;

  const header = req.headers.get("x-admin-secret");
  if (header && (await safeEqual(header, expected))) return true;

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    if (await safeEqual(auth.slice(7), expected)) return true;
  }

  return isValidSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
}

// True when `candidate` is the configured secret. Used by the sign-in route.
export async function isValidSecret(candidate: string): Promise<boolean> {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return false;
  return safeEqual(candidate, expected);
}

// The session cookie does not hold the secret. It holds an HMAC-SHA256 of a
// fixed label keyed by the secret, so the browser's cookie jar (and anything
// that reads it: a backup, a synced profile, a stray log line) never contains
// the value that the cron and the scripts send as a header, and a leaked
// cookie cannot be turned into one.
const SESSION_LABEL = "pleasanton-events admin session v1";

export async function sessionTokenFor(secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(SESSION_LABEL));
  return toHex(new Uint8Array(mac));
}

// True when `token` (the cookie's value) was minted from the configured
// secret. The admin page calls this with the cookie it reads server-side.
export async function isValidSessionToken(
  token: string | null | undefined,
): Promise<boolean> {
  const expected = process.env.ADMIN_SECRET;
  if (!expected || !token) return false;
  return safeEqual(token, await sessionTokenFor(expected));
}

// Length-independent comparison. Both sides are hashed first, so the loop
// always walks the same 32 bytes: neither its running time nor an early
// return says anything about how long the real secret is, which a plain
// `a.length !== b.length` check gives away one guess at a time.
// crypto.subtle is the same call on Workers and in Node.
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const ua = new Uint8Array(da);
  const ub = new Uint8Array(db);
  let result = 0;
  for (let i = 0; i < ua.length; i++) result |= ua[i] ^ ub[i];
  return result === 0;
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}
