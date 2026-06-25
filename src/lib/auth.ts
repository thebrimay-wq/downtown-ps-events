import type { NextRequest } from "next/server";

// Verifies the shared admin secret used to gate scraping + admin mutations.
// Accepts the secret via the `x-admin-secret` header, an `Authorization:
// Bearer` token, or a `?secret=` query param (handy for cron GET requests).
export function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_SECRET;
  // If no secret is configured, refuse all privileged actions rather than
  // silently allowing them.
  if (!expected) return false;

  const header = req.headers.get("x-admin-secret");
  if (header && safeEqual(header, expected)) return true;

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    if (safeEqual(auth.slice(7), expected)) return true;
  }

  const qp = req.nextUrl.searchParams.get("secret");
  if (qp && safeEqual(qp, expected)) return true;

  return false;
}

// Constant-time-ish comparison to avoid trivial timing leaks.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
