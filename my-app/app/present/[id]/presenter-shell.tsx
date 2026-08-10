"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { QuestionShell } from "@/components/question/shell";
import { formatRoomNumber } from "@/lib/realtime/room-number";
import {
  useSessionChannel,
  type SessionChannelInit,
} from "@/lib/realtime/session-channel";
import type { ReviewerQuestion } from "@/lib/services/questions";
import type { PresenterTally } from "@/lib/services/sessions";
import { registry } from "@/lib/templates/registry";
import type { Answer } from "@/lib/templates/types";

const NOOP_ANSWER: Answer = {};
function noop() {}

/**
 * The presenter display (PLAN §9 F5, §7.3). Staff-gated by its OWN layout
 * (`app/present/[id]/layout.tsx`), not the admin one. Realtime drives the
 * phase/count instantly; `router.refresh()` re-fetches server-side on a
 * question change or on entering `revealed`, which is the only moment this
 * screen needs the key — loaded once, server-side, via `sessions.getTally`
 * (staff-gated), never sent to a phone.
 *
 * `write_feedback` has no distribution — `tally.groups` is `null` — so this
 * renders the no-distribution state instead of an empty chart (§5.13).
 */
export function PresenterShell({
  sessionId,
  roomNumber,
  batchName,
  totalQuestions,
  initial,
  question,
  tally,
  joinUrl,
  joinQrSvg,
}: {
  sessionId: string;
  roomNumber: number;
  batchName: string;
  totalQuestions: number;
  initial: SessionChannelInit & { currentPosition: number | null };
  question: ReviewerQuestion | null;
  tally: PresenterTally | null;
  /** Absolute deep link into the room, built server-side from the request host. */
  joinUrl: string;
  /** Pre-rendered QR SVG of `joinUrl` (server-generated, static markup). */
  joinQrSvg: string;
}) {
  const router = useRouter();
  const live = useSessionChannel(sessionId, initial);

  const prev = useRef({ q: initial.currentQuestionId, phase: initial.phase });
  useEffect(() => {
    const questionChanged = live.currentQuestionId !== prev.current.q;
    const enteredRevealed =
      live.phase === "revealed" && prev.current.phase !== "revealed";
    prev.current = { q: live.currentQuestionId, phase: live.phase };
    if (questionChanged || enteredRevealed) router.refresh();
  }, [live.currentQuestionId, live.phase, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-[1100px] flex-col gap-8 px-10 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/15 pb-6">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-white/50">{batchName}</span>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em]">
            {formatRoomNumber(roomNumber)}
          </h1>
          <span className="text-[13px] text-white/50">
            Join at <code className="text-white/80">/join</code>
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[20px] font-semibold">
            {live.responseCount} of {live.headcount || "…"} answered
          </span>
          <span className="text-[13px] capitalize text-white/50">
            {live.phase}
            {initial.currentPosition !== null &&
              ` · Question ${initial.currentPosition + 1} of ${totalQuestions}`}
          </span>
        </div>
      </header>

      <div className="flex-1">
        {live.phase === "ended" && <BigMessage>Session ended.</BigMessage>}

        {live.phase === "lobby" && (
          <div className="flex h-full flex-col items-center justify-center gap-7 text-center">
            <p className="text-[22px] leading-[1.4] text-white/85">
              Scan to join
            </p>
            <div
              className="w-[min(320px,55vw)] overflow-hidden rounded-[18px] bg-white p-4 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
              // Server-generated static markup from the `qrcode` package —
              // no user content passes through this string.
              dangerouslySetInnerHTML={{ __html: joinQrSvg }}
            />
            <p className="max-w-[52ch] text-[15px] leading-[1.6] text-white/55">
              {joinUrl}
              <br />
              or go to <code className="text-white/85">/join</code> and enter
              room{" "}
              <span className="font-medium text-white/85">
                {formatRoomNumber(roomNumber)}
              </span>
            </p>
          </div>
        )}

        {live.phase === "voting" && question && (
          <QuestionShell
            label={registry[question.template].label}
            status="Voting"
            action={{ label: "Voting in progress", disabled: true }}
          >
            <PresenterReview question={question} />
          </QuestionShell>
        )}

        {live.phase === "locked" && (
          <BigMessage>Answers are locked — getting ready to reveal.</BigMessage>
        )}

        {live.phase === "revealed" && (
          <TallyView tally={tally} question={question} />
        )}
      </div>
    </main>
  );
}

function BigMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <p className="max-w-[46ch] text-[20px] leading-[1.5] text-white/80">
        {children}
      </p>
    </div>
  );
}

/** Cast-free switch at the runtime-template/static-union boundary, same
 * shape as `app/live/[room]/phone-shell.tsx`'s `ReviewForCurrent` — the
 * presenter never submits, so `answer`/`onAnswer` are inert placeholders. */
function PresenterReview({ question }: { question: ReviewerQuestion }) {
  switch (question.template) {
    case "which_principle":
      return (
        <registry.which_principle.Review
          content={question.content}
          prompt={question.prompt}
          answer={NOOP_ANSWER}
          onAnswer={noop}
        />
      );
    case "rank_variants":
      return (
        <registry.rank_variants.Review
          content={question.content}
          prompt={question.prompt}
          answer={NOOP_ANSWER}
          onAnswer={noop}
        />
      );
    case "write_feedback":
      return (
        <registry.write_feedback.Review
          content={question.content}
          prompt={question.prompt}
          answer={NOOP_ANSWER}
          onAnswer={noop}
        />
      );
  }
}

function TallyView({
  tally,
  question,
}: {
  tally: PresenterTally | null;
  question: ReviewerQuestion | null;
}) {
  if (!question || !tally || !tally.groups) {
    return (
      <BigMessage>
        {question
          ? "No distribution to show for this one — it's a written answer, not a pick."
          : "Nothing to reveal yet."}
      </BigMessage>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {tally.groups.map((group, i) => (
        <div key={group.title ?? i} className="flex flex-col gap-3">
          {group.title && (
            <span className="text-[14px] font-medium text-white/70">
              {group.title}
            </span>
          )}
          <div className="flex flex-col gap-2.5">
            {group.rows.map((row) => {
              const pct =
                tally.answerCount > 0
                  ? Math.round((row.votes / tally.answerCount) * 100)
                  : 0;
              const barColor =
                row.tone === "ok"
                  ? "bg-ok"
                  : row.tone === "bad"
                    ? "bg-white/25"
                    : "bg-violet";
              return (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="w-[10ch] shrink-0 text-[13px] text-white/70">
                    {row.label}
                  </span>
                  <div className="h-6 flex-1 overflow-hidden rounded-[5px] bg-white/10">
                    <div
                      className={`h-full ${barColor} transition-[width] duration-300`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-[6ch] shrink-0 text-right text-[13px] text-white/70">
                    {row.votes}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
