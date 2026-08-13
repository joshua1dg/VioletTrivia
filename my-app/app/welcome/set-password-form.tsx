"use client";

import { useActionState } from "react";

import { setPassword, type SetPasswordResult } from "./actions";

const initialState: SetPasswordResult | null = null;

/** Same one-client-boundary shape as login-form.tsx. */
export function SetPasswordForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(setPassword, initialState);

  return (
    <form
      action={action}
      className="flex w-full flex-col gap-4 rounded-[12px] border border-line-2 bg-white p-6"
    >
      <p className="text-[13px] text-muted-2">
        Signing up as <span className="font-medium text-ink-3">{email}</span>
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-muted">Password</span>
        <input
          type="password"
          name="password"
          required
          minLength={6}
          autoComplete="new-password"
          autoFocus
          className="rounded-[7px] border border-line px-3 py-2 text-[14px] text-ink outline-none focus:border-violet"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-muted">
          Confirm password
        </span>
        <input
          type="password"
          name="confirm"
          required
          minLength={6}
          autoComplete="new-password"
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
        {pending ? "Saving…" : "Set password & enter"}
      </button>
    </form>
  );
}
