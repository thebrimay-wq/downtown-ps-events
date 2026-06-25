import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  hasServiceRole,
  isSupabaseConfigured,
} from "./env";

// Read-only client for server components / public reads (anon key, respects RLS).
export function getServerClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}

// Privileged client for the scraper + admin writes (service role, bypasses RLS).
// Only ever import this from server-side code (API routes, scripts).
export function getAdminClient(): SupabaseClient | null {
  if (!hasServiceRole) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}
