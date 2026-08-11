import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next 16's replacement for middleware.ts (PLAN.md §1 — read
 * node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md before
 * touching this file). Proxy "is meant to be invoked separately of your
 * render code" — it is NOT the authorization boundary. It does two things
 * only:
 *
 *   1. Refresh the Supabase session cookies (the standard @supabase/ssr
 *      token-refresh pattern), so a Server Component that can't itself
 *      set cookies (see lib/db/server.ts's authClient()) still gets a
 *      fresh session on the next request.
 *   2. A cheap, optimistic redirect to /login for a request to /admin/*
 *      or /present/* with no signed-in user.
 *
 * The real guard is server-side, in app/admin/layout.tsx (requireStaff())
 * and, per PLAN, in each staff page under /present. Do not add role
 * checks here — getUser() here only proves "someone is signed in," not
 * "this person is staff," and Proxy explicitly should not be doing
 * database reads for every request (this stays limited to Auth's own
 * lightweight JWT check).
 *
 * Matcher deliberately excludes every participant route (/, /b/*, /join,
 * /live/*) — those must run with zero auth overhead.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Missing env — let the request through. lib/db/server.ts's
    // requireEnv() will throw a clear error the moment anything server-
    // side actually needs the client; Proxy failing closed here would
    // just turn a config problem into an opaque redirect loop.
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser(), never getSession() — verifies the JWT against Auth rather
  // than trusting an unverified cookie value (PLAN.md §1).
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    // DEV ONLY: sign in as the seeded admin instead of bouncing to /login,
    // so `supabase db reset` never costs a login — the seed recreates the
    // account (supabase/seed.sql) and the next staff request lands here and
    // silently re-establishes the session. `next dev` is the only runtime
    // where NODE_ENV is "development"; a production build — even `next
    // start` on this machine — keeps the login form. The credentials are
    // the ones already public in seed.sql, so this hardcodes nothing new.
    // If the sign-in fails (no seeded account — e.g. real data), fall
    // through to /login as before.
    // NODE_ENV is set by Next itself, not by us: `next dev` → "development"
    // (always the full word), `next build`/`next start` → "production".
    // Nothing to configure in .env.local — Next ignores NODE_ENV there.
    if (process.env.NODE_ENV === "development") {
      const seeded = await supabase.auth.signInWithPassword({
        email: "admin@violet.local",
        password: "password",
      });
      if (!seeded.error) return response;
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/present/:path*"],
};
