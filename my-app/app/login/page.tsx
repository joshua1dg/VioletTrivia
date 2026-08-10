import { LoginForm } from "./login-form";

/**
 * Email + password only (D2) — there is no signup route anywhere in the
 * app. Staff are provisioned with `pnpm --dir my-app bootstrap:admin`
 * (see lib/auth/index.ts for the full bootstrap flow).
 */
export default function LoginPage() {
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
          No public sign-up. Staff accounts are created with{" "}
          <code className="rounded bg-line-3 px-1 py-0.5 text-[12px]">
            pnpm bootstrap:admin
          </code>
          .
        </p>
      </div>
      <LoginForm />
    </main>
  );
}
