"use client";

// Real "use client" — owns open/pending/error state via hooks.

import { useState, useTransition, type ReactNode } from "react";
import { ErrorNote, toErrorLike, type ErrorLike } from "./error-note";
import { SubmitButton } from "./submit-button";

/** What a delete action is allowed to hand back. `undefined`/`{ ok: true }`
 *  both mean "done" and close the panel; `{ ok: false, message }` mirrors
 *  every other Server Action's error-as-return-value shape (PLAN §7.2). */
export type ConfirmDeleteOutcome = { ok: true } | { ok: false; message: string } | void;

/**
 * The blast-radius confirm every D14 delete goes through. Inline
 * button-swap rather than a layered panel or a dialog library — no new
 * dependency, and it matches the app's flat, card-based idiom elsewhere
 * (KeySection, WhyNote).
 *
 * Deliberately never uses `confirm()`/`alert()` — those block the automation
 * used to verify this app.
 *
 * Flow: trigger renders as a quiet, text-only red control. Clicking it swaps
 * the trigger for a small red-bordered panel holding the caller's title +
 * blast-radius description, a destructive confirm button (reusing
 * SubmitButton so the pending spinner isn't reimplemented), and Cancel.
 * `onConfirm` runs inside a transition; a thrown value or a `{ ok: false }`
 * return both render through ErrorNote and leave the panel open so the user
 * can read it. Success (`{ ok: true }` or nothing) collapses the panel back
 * to the trigger — the caller is responsible for the list itself no longer
 * showing the deleted row (a revalidated Server Action already handles
 * that; this component doesn't own any data).
 */
export function ConfirmDelete({
  triggerLabel = "Delete",
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
}: {
  triggerLabel?: string;
  title: string;
  /** Where the caller states the blast radius, e.g. "3 questions will lose this topic." */
  description: ReactNode;
  confirmLabel?: string;
  onConfirm: () => Promise<ConfirmDeleteOutcome>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ErrorLike | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="cursor-pointer rounded-[7px] border border-line px-3.5 py-2 text-[13px] text-bad-ink transition-colors hover:bg-bad-tint"
      >
        {triggerLabel}
      </button>
    );
  }

  function confirm() {
    startTransition(async () => {
      try {
        const result = await onConfirm();
        if (result && result.ok === false) {
          setError(result.message);
          return;
        }
        setOpen(false);
        setError(null);
      } catch (e) {
        setError(toErrorLike(e));
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-bad-line bg-bad-tint/40 p-4">
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold text-bad-ink">{title}</span>
        <div className="text-[12.5px] leading-[1.5] text-muted-2">{description}</div>
      </div>

      <ErrorNote error={error} />

      <div className="flex items-center gap-2.5">
        <SubmitButton type="button" onClick={confirm} pending={pending} destructive>
          {confirmLabel}
        </SubmitButton>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={pending}
          className="cursor-pointer rounded-[7px] border border-line px-3.5 py-2 text-[13px] text-ink-4 transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
