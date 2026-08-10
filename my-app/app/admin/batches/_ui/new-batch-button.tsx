"use client";

// Real "use client" — owns open/pending/error state via hooks, and calls the
// Server Action imperatively via useTransition (PLAN §5.6) rather than a
// <form>, since there's exactly one field and navigating away on success.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { PrimaryButton } from "@/components/admin/ui";
import { ErrorNote, SubmitButton, type ErrorLike } from "@/components/feedback";

import { createBatch } from "../actions";

/**
 * The list screen's "New batch" control. A name is the only thing a batch
 * needs to exist — audience, expiry, sample size and the queue itself are
 * all composer work — so this is a one-field inline form, not a modal, and
 * it hands off to `/admin/batches/[id]` the moment the row exists.
 */
export function NewBatchButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<ErrorLike | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!open) {
    return <PrimaryButton onClick={() => setOpen(true)}>New batch</PrimaryButton>;
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createBatch({ name });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/admin/batches/${result.batch.id}`);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Batch name"
        className="w-56 rounded-[7px] border border-line px-3 py-1.5 text-[13px] text-ink-4 outline-none"
      />
      <SubmitButton type="button" onClick={submit} pending={pending}>
        Create
      </SubmitButton>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setName("");
          setError(null);
        }}
        className="cursor-pointer rounded-[7px] border border-line px-3.5 py-2 text-[13px] text-ink-4 transition-colors hover:bg-surface"
      >
        Cancel
      </button>
      <ErrorNote error={error} />
    </div>
  );
}
