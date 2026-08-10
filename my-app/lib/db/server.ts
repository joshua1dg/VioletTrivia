import "server-only";

import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "./database.types";

/**
 * The entire data path for the app. Service-role key, bypasses RLS — every
 * repo (lib/repos/**) goes through this and nothing else. RLS is enabled on
 * every table as a fail-closed backstop, not a security boundary; the
 * service role is what makes the backstop irrelevant to normal operation.
 *
 * Never import this (or anything importing it) into a "use client" file —
 * the `server-only` import above turns that into a build error rather than
 * a leaked key.
 */
export function serviceClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Anon key + the `next/headers` cookie adapter. Used ONLY to resolve who the
 * staff user is (lib/auth — Wave 2/B2) — never for data. Every data read or
 * write, including everything staff-facing, goes through `serviceClient()`.
 *
 * `cookies()` is async in Next 16, so this is async too. Always call
 * `getUser()` (or `getClaims()`) on the result, never `getSession()` —
 * `getSession()` does not verify the JWT (PLAN.md §1).
 */
export async function authClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, which cannot set cookies.
          // proxy.ts (B2) is responsible for refreshing the session in
          // that case — see the Next.js Supabase SSR guide.
        }
      },
    },
  });
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env.local and fill it in from \`supabase status\`.`,
    );
  }
  return value;
}
