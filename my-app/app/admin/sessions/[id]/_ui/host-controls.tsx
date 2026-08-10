"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ConfirmDelete, ErrorNote, SubmitButton, type ErrorLike } from "@/components/feedback";
import { formatRoomNumber } from "@/lib/realtime/room-number";
import { useSessionChannel } from "@/lib/realtime/session-channel";
import type { SessionPhase } from "@/lib/services/sessions";

import { advance, endSession, setPhase, type ActionError } from "../../actions";

type CurrentState = {
  phase: SessionPhase;
  currentQuestionId: string | null;
  currentPosition: number | null;
  responseCount: number;
};

type QuestionSummary = { prompt: string; templateLabel: string };

const PHASE_LABEL: Record<SessionPhase, string> = {
  lobby: "Lobby — waiting to start",
  voting: "Voting",
  locked: "Locked",
  revealed: "Revealed",
  ended: "Ended",
};

/**
 * Host controls (PLAN §9 F5). `useSessionChannel` seeds from the server
 * props and overlays Realtime on top — the same row every phone and the
 * presenter are watching. A `current_question_id` change re-fetches the
 * (keyless) question server-side via `router.refresh()`; phase flips render
 * instantly from the pushed row itself (§7.1) via `PHASE_LABEL[live.phase]`.
 *
 * Every button fires imperatively through `useTransition` (§7.1's note on
 * the live surface — no `<form>`, no `useActionState`), with one shared
 * `pending`/`error` pair since only one host mutation is ever in flight at
 * a time from this screen.
 */
export function HostControls({
  sessionId,
  roomNumber,
  totalQuestions,
  current,
  question,
}: {
  sessionId: string;
  roomNumber: number;
  totalQuestions: number;
  current: CurrentState;
  question: QuestionSummary | null;
}) {
  const router = useRouter();
  const live = useSessionChannel(sessionId, {
    phase: current.phase,
    currentQuestionId: current.currentQuestionId,
    responseCount: current.responseCount,
  });

  const [error, setError] = useState<ErrorLike | null>(null);
  const [pending, startTransition] = useTransition();

  const lastQuestionId = useRef(current.currentQuestionId);
  useEffect(() => {
    if (live.currentQuestionId !== lastQuestionId.current) {
      lastQuestionId.current = live.currentQuestionId;
      router.refresh();
    }
  }, [live.currentQuestionId, router]);

  function run(action: () => Promise<{ ok: true } | ActionError>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.message);
    });
  }

  const position =
    current.currentPosition === null
      ? "Not started"
      : `Question ${current.currentPosition + 1} of ${totalQuestions}`;
  const hasNext =
    current.currentPosition === null
      ? totalQuestions > 0
      : current.currentPosition + 1 < totalQuestions;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-line p-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-ink">
            {formatRoomNumber(roomNumber)} · {PHASE_LABEL[live.phase]}
          </span>
          <span className="text-[12.5px] text-muted-3">
            {position}
            {question && ` — ${question.templateLabel}`}
          </span>
          {question && (
            <p className="mt-1 max-w-[60ch] text-[13px] text-muted-2">
              {question.prompt}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {live.phase === "lobby" ? (
            <span className="text-[13px] font-medium text-ink">
              {!live.connected
                ? "… in the room"
                : live.headcount === 0
                  ? "Nobody has joined yet"
                  : `${live.headcount} in the room`}
            </span>
          ) : (
            <>
              <span className="text-[13px] font-medium text-ink">
                {live.responseCount} of{" "}
                {live.connected ? live.headcount : "…"} answered
              </span>
              {/* The number the lock/reveal call actually hinges on. Presence
                  is the denominator, so someone closing their tab mid-question
                  drops out of it rather than blocking the room forever. */}
              {live.connected && live.headcount > live.responseCount && (
                <span className="text-[12.5px] text-warn-ink">
                  {live.headcount - live.responseCount} still to answer
                </span>
              )}
              {live.connected &&
                live.headcount > 0 &&
                live.headcount <= live.responseCount && (
                  <span className="text-[12.5px] text-muted-2">
                    Everyone has answered
                  </span>
                )}
            </>
          )}
          <span className="text-[11.5px] text-faint">
            {live.connected ? "Live" : "Connecting…"}
          </span>
        </div>
      </div>

      <ErrorNote error={error} />

      <div className="flex flex-wrap items-center gap-2.5">
        <SubmitButton
          type="button"
          pending={pending}
          onClick={() => run(() => advance(sessionId))}
        >
          {current.currentPosition === null ? "Start" : "Next question"}
        </SubmitButton>
        <SubmitButton
          type="button"
          variant="ghost"
          pending={pending}
          onClick={() => run(() => setPhase(sessionId, "locked"))}
        >
          Lock answers
        </SubmitButton>
        <SubmitButton
          type="button"
          variant="ghost"
          pending={pending}
          onClick={() => run(() => setPhase(sessionId, "revealed"))}
        >
          Reveal
        </SubmitButton>
        <SubmitButton
          type="button"
          variant="ghost"
          pending={pending}
          onClick={() => run(() => setPhase(sessionId, "lobby"))}
        >
          Back to lobby
        </SubmitButton>

        <div className="ml-auto">
          <ConfirmDelete
            triggerLabel="End session"
            title="End this session?"
            description="Every phone in the room and the presenter screen will show it as ended. This can't be undone."
            confirmLabel="End it"
            onConfirm={async () => {
              const result = await endSession(sessionId);
              if (!result.ok) return { ok: false, message: result.message };
              router.push("/admin/sessions");
              return { ok: true };
            }}
          />
        </div>
      </div>

      {!hasNext && current.phase !== "ended" && (
        <p className="text-[12.5px] text-muted-3">
          {current.currentPosition === null
            ? "This batch has no questions."
            : "This is the last question in the batch."}
        </p>
      )}
    </div>
  );
}
