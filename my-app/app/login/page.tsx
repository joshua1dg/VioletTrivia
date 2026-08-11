import { redirect } from "next/navigation";

import { getStaff } from "@/lib/auth";

import { LoginForm } from "./login-form";

/**
 * Email + password only (D2) — there is no signup route anywhere in the
 * app. The first admin comes from `pnpm --dir my-app bootstrap:admin`;
 * everyone after that is added on /admin/staff.
 *
 * Already-signed-in staff go straight to /admin: the home page's "Staff
 * sign in" corner link lands here, and showing a returning admin the
 * login form again is friction with no purpose.
 */
export default async function LoginPage() {
  const staff = await getStaff();
  if (staff) redirect("/admin");
  return (
    <main className="mx-auto flex min-h-screen max-w-[380px] flex-col items-center justify-center gap-8 px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="font-mono text-[12px] text-violet">
          Project Violet
        </span>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">
          Staff sign in
        </h1>
        <p className="text-[13.5px] leading-[1.6] text-muted-2">
          No public sign-up — staff accounts are created by an admin.
        </p>
      </div>
      <LoginForm />
    </main>
  );
}
