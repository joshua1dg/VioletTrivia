import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";

/**
 * The publishable/anon key, for the browser. Two jobs only (README §Schema
 * decisions / PLAN.md §5.1):
 *
 *   1. Staff sign-in on /login.
 *   2. The Realtime subscription to `live_sessions` — the one anon SELECT
 *      policy in the migration exists precisely for this.
 *
 * It reads no other table. Never use this for data — that is
 * `serviceClient()` in lib/db/server.ts, always server-side.
 */
export function browserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill it in from `supabase status`.",
    );
  }

  return createBrowserClient<Database>(url, anonKey);
}
