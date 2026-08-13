import { redirect } from "next/navigation";

import { authClient } from "@/lib/db/server";

import { SetPasswordForm } from "./set-password-form";

/**
 * Where an accepted invite lands (2026-08-13): /auth/confirm verified the
 * emailed token and set the session cookies, so the new person arrives
 * here SIGNED IN but with no password of their own yet. One job: set it.
 *
 * Guarded on the auth user, not on getStaff() — the invite flow creates
 * the staff row at invite time, but this page shouldn't brick if an
 * admin ever invites someone whose row write failed; setting a password
 * needs only the session. No session at all → the link wasn't followed
 * (or expired) → /login explains itself.
 */
export default async function WelcomePage() {
  const supabase = await authClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");

  return (
    <main className="mx-auto flex min-h-screen max-w-[380px] flex-col items-center justify-center gap-8 px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="font-mono text-[12px] text-violet">
          Project Violet
        </span>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">
          Welcome aboard
        </h1>
        <p className="text-[13.5px] leading-[1.6] text-muted-2">
          Your account is ready — choose a password to finish signing up.
        </p>
      </div>
      <SetPasswordForm email={data.user.email ?? ""} />
    </main>
  );
}
