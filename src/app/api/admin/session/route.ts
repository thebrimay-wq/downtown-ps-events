import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  adminSecretConfigured,
  isValidSecret,
  sessionTokenFor,
} from "@/lib/auth";
import { rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Signs the admin dashboard in and out. The browser never keeps the secret:
// POST checks it once and answers with an httpOnly cookie that the admin
// page and the moderation routes accept instead (see src/lib/auth.ts).

function cookieOptions() {
  return {
    httpOnly: true,
    // `Secure` would be right everywhere, but Safari refuses Secure cookies
    // over plain http://localhost, which is where `next dev` runs.
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
  };
}

export async function POST(req: NextRequest) {
  // A sign-in form is the one place a secret can be guessed, so it gets a
  // tighter limit than the rest of the API. Per-isolate on Workers, so a WAF
  // rule is still the durable control.
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown";
  if (rateLimited(`admin-session:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Wait a few minutes and try again." },
      { status: 429 },
    );
  }

  if (!adminSecretConfigured()) {
    return NextResponse.json(
      { error: "This site has no admin secret configured, so there is nothing to sign in to." },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const secret = typeof body?.secret === "string" ? body.secret : "";
  if (!secret || !(await isValidSecret(secret))) {
    return NextResponse.json({ error: "That secret is not right." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: await sessionTokenFor(secret),
    maxAge: ADMIN_SESSION_MAX_AGE,
    ...cookieOptions(),
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: ADMIN_SESSION_COOKIE, value: "", maxAge: 0, ...cookieOptions() });
  return res;
}
