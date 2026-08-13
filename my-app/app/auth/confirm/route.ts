import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { authClient } from "@/lib/db/server";

/**
 * The landing strip for email auth links (2026-08-13, built for staff
 * invites) — the documented @supabase/ssr shape: the email links here
 * with a token_hash, this handler verifies it server-side and the ssr
 * client writes the session cookies (a Route Handler may set cookies;
 * a Server Component may not, which is why this isn't a page).
 *
 * `next` is pinned to a path ON THIS HOST — the link arrives in an
 * email, and a crafted next=https://elsewhere must not turn this into
 * an open redirect that hands the session's origin trust to another
 * site.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/welcome";

  const redirectTo = request.nextUrl.clone();
  redirectTo.search = "";
  redirectTo.pathname = next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/welcome";

  if (tokenHash && type) {
    const supabase = await authClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
  }

  // Expired or reused link. /login can't mint their password, but it says
  // "ask an admin" better than an error boundary would.
  redirectTo.pathname = "/login";
  redirectTo.search = "?invite=expired";
  return NextResponse.redirect(redirectTo);
}
