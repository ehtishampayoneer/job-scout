// lib/supabase/admin.js
// Service-role client — ONLY for server-side system jobs (bypasses RLS).
// Never import this into anything user-facing / a Client Component.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
