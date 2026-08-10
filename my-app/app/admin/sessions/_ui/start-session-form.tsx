"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ErrorNote, SubmitButton, type ErrorLike } from "@/components/feedback";
import type { StartableBatch } from "@/lib/services/sessions";

import { startSession } from "../actions";

/** Start form: pick a batch, get a room number back. Disabled (with an
 * inline note) for a batch with zero questions rather than letting the
 * submit round-trip fail — `startSession` still enforces this server-side. */
export function StartSessionForm({ batches }: { batches: StartableBatch[] }) {
  const router = useRouter();
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");
  const [seconds, setSeconds] = useState("");
  const [error, setError] = useState<ErrorLike | null>(null);
  const [pending, startTransition] = useTransition();

  if (batches.length === 0) {
    return (
      <p className="text-[13.5px] text-muted-3">
        No batches yet —{" "}
        <Link href="/admin/batches" className="underline">
          compose one
        </Link>{" "}
        before starting a session.
      </p>
    );
  }

  const selected = batches.find((b) => b.id === batchId);
  const empty = selected ? selected.questionCount === 0 : false;

  function onStart() {
    if (empty) return;
    setError(null);
    // Empty input = untimed session; the action zod-checks the range.
    const votingSeconds = seconds.trim() === "" ? null : Number(seconds);
    if (votingSeconds !== null && !Number.isInteger(votingSeconds)) {
      setError("Seconds per question must be a whole number.");
      return;
    }
    startTransition(async () => {
      const result = await startSession(batchId, votingSeconds);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/admin/sessions/${result.sessionId}`);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-line p-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          disabled={pending}
          className="rounded-[7px] border border-line bg-white px-3 py-2 text-[13px] text-ink"
        >
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} · {b.status} · {b.questionCount}{" "}
              {b.questionCount === 1 ? "question" : "questions"}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-[12.5px] text-muted-2">
          Timer
          <input
            type="number"
            min={5}
            max={3600}
            step={5}
            value={seconds}
            onChange={(e) => setSeconds(e.target.value)}
            disabled={pending}
            placeholder="off"
            className="w-20 rounded-[7px] border border-line bg-white px-2.5 py-2 text-[13px] text-ink"
          />
          sec / question
        </label>
        <SubmitButton
          type="button"
          onClick={onStart}
          pending={pending}
          className={empty ? "pointer-events-none opacity-60" : undefined}
        >
          Start session
        </SubmitButton>
      </div>
      {empty && (
        <p className="text-[12.5px] text-muted-3">
          This batch has no questions yet — add some before starting a
          session off it.
        </p>
      )}
      <ErrorNote error={error} />
    </div>
  );
}
