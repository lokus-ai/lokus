/**
 * Service-role Supabase client. Server-only: full RPC access (reserve/settle/
 * refund credits, balance reads). The service-role key is loaded ONLY from env
 * via config and never leaves the server. Mocked in tests.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config.ts";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  client = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "x-lokus-proxy": "1" } },
  });
  return client;
}
