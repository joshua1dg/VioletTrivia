"use client";

import { useActionState } from "react";

import { signIn, type SignInResult } from "./actions";

const initialState: SignInResult | null = null;

/**
 * The one client boundary on this route — it needs useActionState for
 * pending/error, so it gets "use client" (PLAN's rule: at the boundary
 * only, never on a leaf). Pending and error both come from React; nothing
 * here is hand-rolled state.
 *
 * TEMPORARY (2026-08-13): both fields are pre-filled with the shared
 * demo login (demo@violet.demo / password) so demo viewers can sign in
 * without typing. Strip the defaultValues when the demo window closes.
 */
export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initialState);

  return (
    <form
      action={action}
      className="flex w-full flex-col gap-4 rounded-[12px] border border-line-2 bg-white p-6"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-muted">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          autoFocus
          defaultValue="demo@violet.demo"
          className="rounded-[7px] border border-line px-3 py-2 text-[14px] text-ink outline-none focus:border-violet"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-muted">Password</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          defaultValue="password"
          className="rounded-[7px] border border-line px-3 py-2 text-[14px] text-ink outline-none focus:border-violet"
        />
      </label>

      {state?.ok === false && (
        <p role="alert" className="text-[13px] text-bad-ink">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="cursor-pointer rounded-[7px] bg-violet px-4 py-2.5 text-[13.5px] font-medium text-white transition-colors hover:bg-violet-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
