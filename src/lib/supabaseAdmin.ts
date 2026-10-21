import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client with Service Role privileges.
 * WARNING: This client bypasses RLS policies and must ONLY be used on the server
 * (e.g., inside NextAuth authorize or server actions / route handlers).
 * Never expose this client or SUPABASE_SERVICE_ROLE_KEY to the browser or prefix with NEXT_PUBLIC_.
 */
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing Supabase URL environment variable.");
  }

  if (!serviceRoleKey) {
    console.warn("⚠️ [supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is missing in .env.local or environment.");
  }

  return createClient(supabaseUrl, serviceRoleKey || "", {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
