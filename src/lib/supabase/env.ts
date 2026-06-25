// Centralized check for whether Supabase is configured. When it is not, the
// data layer transparently falls back to bundled mock data so the app remains
// fully browsable in local development with zero setup.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const hasServiceRole = Boolean(
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY,
);
