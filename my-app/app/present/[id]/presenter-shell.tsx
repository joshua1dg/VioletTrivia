"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { HostControlsBar } from "@/app/admin/sessions/[id]/_ui/host-controls";
import { QuestionShell } from "@/components/question/shell";
import { formatRoomNumber } from "@/lib/realtime/room-number";
import {
  useSessionChannel,
  type SessionChannelInit,
} from "@/lib/realtime/session-channel";
import { formatSeconds, useCountdown } from "@/lib/realtime/use-countdown";
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
 *
 * With `hostControls`, the bottom of the screen also carries the host's own
 * controls (`HostControlsBar`), so running the room and showing the room are
 * one screen instead of two tabs. It renders the BAR rather than the
 * `HostControls` wrapper on purpose: the wrapper opens its own
 * `useSessionChannel`, and a second subscription in this tab would collide
 * with this one on the shared `session:{id}` channel — see the note on the
 * split in `app/admin/sessions/[id]/_ui/host-controls.tsx`. The bar runs off
 * the `live` row below, which is also what the header reads, so the two can
 * never quote different phases or counts.
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
  hostControls = false,
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
  /** Render the host's controls in a bar pinned to the bottom. Off → the
   *  screen is display-only. */
  hostControls?: boolean;
}) {
  const router = useRouter();
  const live = useSessionChannel(sessionId, initial);
  // The home page IS the join screen now, so the room gets the bare site
  // address, not a path. Protocol stripped for legibility on a projector.
  const joinHost = new URL(joinUrl).host;
  const secondsLeft = useCountdown(
    live.phase === "voting" ? live.votingEndsAt : null,
  );

  const prev = useRef({ q: initial.currentQuestionId, phase: initial.phase });
  useEffect(() => {
    const questionChanged = live.currentQuestionId !== prev.current.q;
    const enteredRevealed =
      live.phase === "revealed" && prev.current.phase !== "revealed";
    prev.current = { q: live.currentQuestionId, phase: live.phase };
    if (questionChanged || enteredRevealed) router.refresh();
  }, [live.currentQuestionId, live.phase, router]);

  return (
    // `min-h-screen` moved off `<main>` onto this column so the control bar is
    // a SIBLING of the content rather than something stacked under a
    // full-height block: `flex-1` hands `<main>` whatever height the bar
    // doesn't take, so the question still fills the viewport and the bar never
    // pushes it off the bottom.
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-8 px-10 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/15 pb-6">
          <div className="flex flex-col gap-1">
            <span className="text-[13px] text-white/50">{batchName}</span>
            <h1 className="text-[26px] font-semibold tracking-[-0.02em]">
              {formatRoomNumber(roomNumber)}
            </h1>
            <span className="text-[13px] text-white/50">
              Join at <code className="text-white/80">{joinHost}</code>
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[20px] font-semibold">
              {/* Presence can drop below the response count (answer, then
                  close the tab), so the denominator is clamped — the room
                  should never read "1 of 0 answered". */}
              {live.phase === "lobby"
                ? `${live.connected ? live.headcount : "…"} in the room`
                : `${live.responseCount} of ${live.connected ? Math.max(live.headcount, live.responseCount) : "…"} answered`}
            </span>
            <span className="text-[13px] capitalize text-white/50">
              {live.phase}
              {/* `currentPosition` is server state, not on the Realtime row —
                  `HostControls` in the bar below reads it from the SAME server
                  render (the page hands one `session.currentPosition` to both),
                  and both are re-rendered by the same `router.refresh()` when
                  the question changes. So the two readouts cannot disagree. */}
              {initial.currentPosition !== null &&
                ` · Question ${initial.currentPosition + 1} of ${totalQuestions}`}
            </span>
            {secondsLeft !== null && (
              <span
                className={
                  secondsLeft <= 10
                    ? "text-[26px] font-semibold tabular-nums text-white"
                    : "text-[26px] font-semibold tabular-nums text-white/70"
                }
              >
                {formatSeconds(secondsLeft)}
              </span>
            )}
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
                or go to <code className="text-white/85">{joinHost}</code> and enter
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
            <BigMessage>
              Answers are locked — getting ready to reveal.
            </BigMessage>
          )}

          {live.phase === "revealed" && (
            <TallyView tally={tally} question={question} />
          )}
        </div>
      </main>

      {/* The host's strip. `sticky bottom-0` costs nothing while the content
          fits (it is already the last thing in a `min-h-screen` column) and
          keeps the controls reachable once a long tally starts scrolling.
          Translucent black over the page rather than a solid slab, so it reads
          as a footer to the room and as a console to the host. */}
      {hostControls && (
        <div className="sticky bottom-0 z-10 shrink-0 border-t border-white/15 bg-black/85 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-[1100px] px-10">
            <HostControlsBar
              tone="dark"
              live={live}
              sessionId={sessionId}
              roomNumber={roomNumber}
              totalQuestions={totalQuestions}
              currentPosition={initial.currentPosition}
              question={
                question
                  ? {
                      prompt: question.prompt,
                      templateLabel: registry[question.template].label,
                    }
                  : null
              }
            />
          </div>
        </div>
      )}
    </div>
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
