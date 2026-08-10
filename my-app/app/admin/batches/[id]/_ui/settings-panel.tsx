"use client";

// Real "use client" — owns the form fields and three independent pending
// states (save / status / active-pool toggle) via hooks.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  ConfirmDelete,
  ErrorNote,
  SubmitButton,
  type ConfirmDeleteOutcome,
  type ErrorLike,
} from "@/components/feedback";
import type { BatchStatus, BatchWithCounts } from "@/lib/services/batches";

import { deleteBatch, setActiveAsync, setStatus, updateBatch } from "../../actions";

const STATUSES: BatchStatus[] = ["draft", "active", "inactive"];

/** `<input type="datetime-local">` wants local time with no offset. */
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function SettingsPanel({ batch }: { batch: BatchWithCounts }) {
  const router = useRouter();

  const [name, setName] = useState(batch.name);
  const [audience, setAudience] = useState(batch.audience ?? "");
  const [expiresAt, setExpiresAt] = useState(toLocalInputValue(batch.expiresAt));
  const [sampleSize, setSampleSize] = useState(
    batch.asyncSampleSize?.toString() ?? "",
  );
  const [error, setError] = useState<ErrorLike | null>(null);

  const [savePending, startSave] = useTransition();
  const [statusPending, startStatus] = useTransition();
  const [activePending, startActive] = useTransition();

  function saveSettings() {
    setError(null);
    startSave(async () => {
      const result = await updateBatch(batch.id, {
        name,
        audience: audience.trim() === "" ? null : audience.trim(),
        expiresAt: expiresAt === "" ? null : new Date(expiresAt).toISOString(),
        asyncSampleSize: sampleSize.trim() === "" ? null : Number(sampleSize),
      });
      if (!result.ok) setError(result.message);
    });
  }

  function changeStatus(next: BatchStatus) {
    setError(null);
    startStatus(async () => {
      const result = await setStatus(batch.id, next);
      if (!result.ok) setError(result.message);
    });
  }

  function toggleActive(next: boolean) {
    setError(null);
    startActive(async () => {
      const result = await setActiveAsync(batch.id, next);
      if (!result.ok) setError(result.message);
    });
  }

  async function confirmedDelete(): Promise<ConfirmDeleteOutcome> {
    const result = await deleteBatch(batch.id);
    if (!result.ok) return { ok: false, message: result.message };
    router.push("/admin/batches");
  }

  return (
    <div className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-line-2 p-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-[11.5px] tracking-[0.04em] text-faint">NAME</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-[7px] border border-line px-3 py-1.5 text-[13px] text-ink-4 outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11.5px] tracking-[0.04em] text-faint">
          AUDIENCE
        </label>
        <input
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder="reviewers, pod leads…"
          className="rounded-[7px] border border-line px-3 py-1.5 text-[13px] text-ink-4 outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11.5px] tracking-[0.04em] text-faint">
          EXPIRES
        </label>
        <input
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="rounded-[7px] border border-line px-3 py-1.5 text-[13px] text-ink-4 outline-none"
        />
        <span className="text-[11.5px] text-muted-3">
          Blank never expires. Expiring makes the link read-only, not dead.
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11.5px] tracking-[0.04em] text-faint">
          ASYNC SAMPLE SIZE
        </label>
        <input
          inputMode="numeric"
          value={sampleSize}
          onChange={(e) => setSampleSize(e.target.value)}
          placeholder="blank = everyone answers all"
          className="rounded-[7px] border border-line px-3 py-1.5 text-[13px] text-ink-4 outline-none"
        />
      </div>

      <SubmitButton type="button" onClick={saveSettings} pending={savePending}>
        Save settings
      </SubmitButton>

      <div className="flex flex-col gap-1.5 border-t border-line-2 pt-4">
        <label className="text-[11.5px] tracking-[0.04em] text-faint">
          STATUS
        </label>
        <div className="flex gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={statusPending}
              onClick={() => changeStatus(s)}
              aria-pressed={batch.status === s}
              className={`cursor-pointer rounded-md border px-2.5 py-1 text-[12.5px] capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                batch.status === s
                  ? "border-violet-line bg-violet-tint-2 text-violet-ink"
                  : "border-line text-muted hover:bg-surface"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {batch.status === "inactive" && (
          <span className="text-[11.5px] text-muted-3">
            Read-only, not off — anyone who already answered can still see it.
          </span>
        )}
      </div>

      <label className="flex flex-wrap items-center gap-2 border-t border-line-2 pt-4 text-[13px] text-ink-4">
        <input
          type="checkbox"
          checked={batch.isActiveAsync}
          disabled={activePending}
          onChange={(e) => toggleActive(e.target.checked)}
        />
        Active async pool
        <span className="text-[11.5px] text-muted-3">
          Only one batch may hold this at a time — activating this one
          deactivates whichever batch has it now.
        </span>
      </label>

      <ErrorNote error={error} />

      <div className="mt-auto border-t border-line-2 pt-4">
        <ConfirmDelete
          title="Delete this batch?"
          description={
            <>
              Removes {batch.questionCount} question
              {batch.questionCount === 1 ? "" : "s"} from its queue.{" "}
              {batch.responseCount > 0
                ? `${batch.responseCount} recorded response${
                    batch.responseCount === 1 ? "" : "s"
                  } keep their answers but lose the batch link.`
                : "No responses have been recorded against it yet."}{" "}
              A batch with a live session still open can&rsquo;t be deleted —
              end the session first.
            </>
          }
          onConfirm={confirmedDelete}
        />
      </div>
    </div>
  );
}
