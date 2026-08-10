"use client";

// Real "use client" — this is one of the few components that genuinely uses
// a hook (useFormStatus). It is the boundary itself, per the README trap.

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

const VARIANT: Record<"primary" | "ghost", string> = {
  // Same shape as PrimaryButton in components/admin/ui.tsx — reused rather
  // than duplicated, per the brief.
  primary: "bg-violet text-white hover:bg-violet-ink",
  ghost: "border border-line text-ink-4 hover:bg-surface",
};

/**
 * Two modes, one component:
 *
 * - **Primary — inside a `<form action={...}>`.** Leave `pending` unset;
 *   `useFormStatus` reads it off the form. This is the normal case for every
 *   `useActionState`-driven screen (PLAN §5.6 — "do not hand-roll pending
 *   state React already provides").
 * - **Override — called imperatively.** The live surface fires actions from
 *   `useTransition` with no `<form>` in sight (PLAN §5.6/§7.1). Pass
 *   `pending` explicitly and it wins; also set `type="button"` and `onClick`
 *   since there's nothing to submit to.
 *
 * `useFormStatus` is safe to call unconditionally even when there's no
 * enclosing `<form>` — React just returns the default `{ pending: false }`
 * status rather than throwing, so the two modes can share one hook call.
 */
export function SubmitButton({
  children,
  pending: pendingOverride,
  onClick,
  type = "submit",
  destructive = false,
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  /** Override for useTransition-driven call sites. Unset = read from useFormStatus. */
  pending?: boolean;
  onClick?: () => void;
  type?: "submit" | "button";
  /** Destructive styling for the ConfirmDelete confirm action and similar. */
  destructive?: boolean;
  variant?: "primary" | "ghost";
  className?: string;
}) {
  const status = useFormStatus();
  const pending = pendingOverride ?? status.pending;

  const look = destructive ? "bg-bad text-white hover:bg-bad-ink" : VARIANT[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={pending}
      aria-busy={pending}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-[7px] px-4 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${look} ${className}`}
    >
      {pending && (
        <span
          aria-hidden
          className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
