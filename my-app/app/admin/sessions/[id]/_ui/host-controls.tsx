"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { ConfirmDelete, ErrorNote, SubmitButton, type ErrorLike } from "@/components/feedback";
import { formatRoomNumber } from "@/lib/realtime/room-number";
import {
  useSessionChannel,
  type SessionChannelState,
} from "@/lib/realtime/session-channel";
import { formatSeconds, useCountdown } from "@/lib/realtime/use-countdown";
import type { SessionPhase } from "@/lib/services/sessions";

import { advance, endSession, setPhase, type ActionError } from "../../actions";

type CurrentState = {
  phase: SessionPhase;
  currentQuestionId: string | null;
  currentPosition: number | null;
  responseCount: number;
  votingEndsAt: string | null;
};

type QuestionSummary = { prompt: string; templateLabel: string };

/**
 * Where this component is rendering.
 *
 * - `light` — standalone `/admin/sessions/[id]`, the app's only theme
 *   (`app/globals.css` is light-only by design: "the design has no dark
 *   rendition"). Unchanged from before the presenter embed existed.
 * - `dark` — embedded in the bottom bar of `/present/[id]`, which paints
 *   white-on-black in its own layout. The admin ink/line/surface tokens are
 *   all light values, so the dark rendition uses the same white-alpha scale
 *   the presenter itself uses (`text-white/50`, `border-white/15`).
 *
 * An explicit prop rather than sniffing an ancestor: the two looks differ in
 * density as well as color, and a projected screen is the wrong place to be
 * guessing.
 */
export type HostControlsTone = "light" | "dark";

const PHASE_LABEL: Record<SessionPhase, string> = {
  lobby: "Lobby — waiting to start",
  voting: "Voting",
  locked: "Locked",
  revealed: "Revealed",
  ended: "Ended",
};

const TONE: Record<
  HostControlsTone,
  {
    root: string;
    statusBox: string;
    strong: string;
    meta: string;
    prompt: string;
    timer: string;
    timerUrgent: string;
    warnText: string;
    calmText: string;
    faintText: string;
    footnote: string;
  }
> = {
  light: {
    root: "flex flex-col gap-6 p-6",
    statusBox:
      "flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-line p-4",
    strong: "text-[13px] font-medium text-ink",
    meta: "text-[12.5px] text-muted-3",
    prompt: "mt-1 max-w-[60ch] text-[13px] text-muted-2",
    timer: "ml-2 tabular-nums text-muted-2",
    timerUrgent: "ml-2 font-semibold tabular-nums text-warn-ink",
    warnText: "text-[12.5px] text-warn-ink",
    calmText: "text-[12.5px] text-muted-2",
    faintText: "text-[11.5px] text-faint",
    footnote: "text-[12.5px] text-muted-3",
  },
  dark: {
    // Compact and borderless: the bar it lives in already draws the rule
    // that separates it from the projected content above.
    root: "flex flex-col gap-2.5 py-3.5",
    statusBox: "flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1",
    strong: "text-[12.5px] font-medium text-white/80",
    meta: "text-[12px] text-white/45",
    prompt: "mt-1 max-w-[60ch] text-[12.5px] text-white/55",
    timer: "ml-2 tabular-nums text-white/60",
    timerUrgent: "ml-2 font-semibold tabular-nums text-white",
    warnText: "text-[12px] text-warn-line",
    calmText: "text-[12px] text-white/45",
    faintText: "text-[11.5px] text-white/35",
    footnote: "text-[12px] text-white/45",
  },
};

/**
 * Host controls (PLAN §9 F5), standalone on `/admin/sessions/[id]`.
 *
 * This wrapper owns the two things that only make sense when this component
 * is the ONLY thing on the page watching the session: the Realtime
 * subscription, and the `router.refresh()` that re-fetches the (keyless)
 * question server-side when `current_question_id` changes. Everything else —
 * the readout, the buttons, the auto-reveal — is `HostControlsBar`, which
 * takes the live row as a prop.
 *
 * The split is not cosmetic. `RealtimeClient.channel(topic)` RETURNS AN
 * EXISTING CHANNEL for a topic already open on the client, and
 * `@supabase/ssr`'s `createBrowserClient` is a per-tab singleton — so two
 * `useSessionChannel(sessionId)` calls in one tab do not get two channels,
 * they get one channel with two sets of `postgres_changes` bindings. The join
 * payload only ever carries the first, and realtime-js's
 * `_updatePostgresBindings` answers the mismatch by calling `unsubscribe()`
 * and erroring the channel out from under BOTH consumers. `/present/[id]`
 * already subscribes for its own header, so it renders `HostControlsBar`
 * directly off that one subscription rather than mounting this.
 */
export function HostControls({
  sessionId,
  roomNumber,
  totalQuestions,
  current,
  question,
  tone = "light",
}: {
  sessionId: string;
  roomNumber: number;
  totalQuestions: number;
  current: CurrentState;
  question: QuestionSummary | null;
  tone?: HostControlsTone;
}) {
  const router = useRouter();
  const live = useSessionChannel(sessionId, {
    phase: current.phase,
    currentQuestionId: current.currentQuestionId,
    responseCount: current.responseCount,
    votingEndsAt: current.votingEndsAt,
  });

  const lastQuestionId = useRef(current.currentQuestionId);
  useEffect(() => {
    if (live.currentQuestionId !== lastQuestionId.current) {
      lastQuestionId.current = live.currentQuestionId;
      router.refresh();
    }
  }, [live.currentQuestionId, router]);

  return (
    <HostControlsBar
      live={live}
      sessionId={sessionId}
      roomNumber={roomNumber}
      totalQuestions={totalQuestions}
      currentPosition={current.currentPosition}
      question={question}
      tone={tone}
    />
  );
}

/**
 * The controls themselves, driven by a live row someone else is subscribed
 * to. `phase` flips render instantly from the pushed row (§7.1) via
 * `PHASE_LABEL[live.phase]`; `currentPosition` is server state and arrives
 * with the next render of whatever page hosts this.
 *
 * Every button fires imperatively through `useTransition` (§7.1's note on
 * the live surface — no `<form>`, no `useActionState`), with one shared
 * `pending`/`error` pair since only one host mutation is ever in flight at
 * a time from this screen.
 *
 * Mounted TWICE in the normal case — once per open tab, `/admin/sessions/[id]`
 * and `/present/[id]` — so every button and the auto-reveal below have to
 * behave when a second copy exists in another window.
 */
export function HostControlsBar({
  live,
  sessionId,
  roomNumber,
  totalQuestions,
  currentPosition,
  question,
  tone = "light",
}: {
  live: SessionChannelState;
  sessionId: string;
  roomNumber: number;
  totalQuestions: number;
  currentPosition: number | null;
  question: QuestionSummary | null;
  tone?: HostControlsTone;
}) {
  const router = useRouter();
  const [error, setError] = useState<ErrorLike | null>(null);
  const [pending, startTransition] = useTransition();
  const t = TONE[tone];

  // Timed sessions: count down toward the Realtime-pushed deadline, and at
  // zero flip the phase to REVEALED — running out of time IS the reveal.
  //
  // Revealing closes submissions implicitly: `app/live/actions.ts` only
  // accepts a submit while `getPhase` says `voting`, and it separately
  // rejects anything past the server-stamped `voting_ends_at` (plus a second
  // of grace). So the cutoff is enforced server-side whether this fires on
  // time, late, or not at all — this only makes the room's state say out
  // loud what the server already believes. "Lock answers" stays a manual
  // button for the times a host wants to hold the room between the last
  // answer and the reveal.
  //
  // Keyed by the deadline value so it fires at most once per voting window;
  // re-opening voting stamps a fresh deadline, which arms it again.
  const secondsLeft = useCountdown(
    live.phase === "voting" ? live.votingEndsAt : null,
  );
  const autoRevealedFor = useRef<string | null>(null);

  useEffect(() => {
    if (live.phase !== "voting" || secondsLeft !== 0 || !live.votingEndsAt)
      return;
    if (autoRevealedFor.current === live.votingEndsAt) return;
    autoRevealedFor.current = live.votingEndsAt;
    // DELIBERATELY SILENT, and deliberately fire-and-forget.
    //
    // With the controls also living in the presenter view, a host running the
    // usual two tabs has this component mounted twice, and both countdowns
    // reach zero at roughly the same instant. That is fine: `setPhase` is a
    // plain idempotent UPDATE, so the loser of the race just re-asserts
    // `revealed` and pushes an identical row. What must NOT happen is the
    // duplicate surfacing an alert — one of those mounts is on a projector,
    // and the room does not need to read the host's error banners. The manual
    // "Reveal" button is the recovery path if this genuinely fails, and it
    // is one line below.
    //
    // It also cannot loop. `setPhase` to anything other than `voting` nulls
    // `voting_ends_at` server-side, so the pushed row disarms the guard above
    // on EVERY mount, not just the one that fired; and the deadline key is
    // burned before the call, so even a failure re-arms nothing.
    startTransition(async () => {
      await setPhase(sessionId, "revealed");
    });
  }, [secondsLeft, live.phase, live.votingEndsAt, sessionId, startTransition]);

  function run(action: () => Promise<{ ok: true } | ActionError>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.message);
    });
  }

  const position =
    currentPosition === null
      ? "Not started"
      : `Question ${currentPosition + 1} of ${totalQuestions}`;
  const hasNext =
    currentPosition === null
      ? totalQuestions > 0
      : currentPosition + 1 < totalQuestions;

  // Nothing left to run. The four phase controls all become wrong here rather
  // than merely useless: `advance` throws past the last question, and lock /
  // reveal / lobby would walk the room BACKWARDS out of the state it just
  // finished in. Ending is the only move, so it's the only button.
  //
  // Reached three ways: the room is already over, the batch has no questions
  // to run at all, or the last question has been revealed. Note it is the
  // REVEAL that finishes a room, not arriving at the last question — the
  // final question still needs its lock and its reveal like any other.
  const ended = live.phase === "ended";
  const finished =
    ended || totalQuestions === 0 || (!hasNext && live.phase === "revealed");

  // No footnote once the room is over: the status line above already reads
  // "Ended", and the presenter is showing the room a full-screen version of
  // the same thing.
  let footnote: string | null = null;
  if (ended) footnote = null;
  else if (totalQuestions === 0) footnote = "This batch has no questions.";
  else if (finished)
    footnote = "That was the last question — all that's left is to end the session.";
  else if (!hasNext) footnote = "This is the last question in the batch.";

  return (
    <div className={t.root}>
      <div className={t.statusBox}>
        <div className="flex flex-col gap-1">
          <span className={t.strong}>
            {formatRoomNumber(roomNumber)} · {PHASE_LABEL[live.phase]}
            {live.phase === "voting" && secondsLeft !== null && (
              <span
                className={secondsLeft <= 10 ? t.timerUrgent : t.timer}
              >
                {formatSeconds(secondsLeft)}
              </span>
            )}
          </span>
          <span className={t.meta}>
            {position}
            {question && ` — ${question.templateLabel}`}
          </span>
          {/* The prompt is the whole point of the screen the embedded bar sits
              under — repeating it there would be noise, and would push the
              question itself up. */}
          {question && tone === "light" && (
            <p className={t.prompt}>{question.prompt}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {live.phase === "lobby" ? (
            <span className={t.strong}>
              {!live.connected
                ? "… in the room"
                : live.headcount === 0
                  ? "Nobody has joined yet"
                  : `${live.headcount} in the room`}
            </span>
          ) : (
            <>
              <span className={t.strong}>
                {live.responseCount} of{" "}
                {live.connected ? live.headcount : "…"} answered
              </span>
              {/* The number the lock/reveal call actually hinges on. Presence
                  is the denominator, so someone closing their tab mid-question
                  drops out of it rather than blocking the room forever. */}
              {live.connected && live.headcount > live.responseCount && (
                <span className={t.warnText}>
                  {live.headcount - live.responseCount} still to answer
                </span>
              )}
              {live.connected &&
                live.headcount > 0 &&
                live.headcount <= live.responseCount && (
                  <span className={t.calmText}>Everyone has answered</span>
                )}
            </>
          )}
          <span className={t.faintText}>
            {live.connected ? "Live" : "Connecting…"}
          </span>
        </div>
      </div>

      <HostError tone={tone} error={error} />

      {/* An ended room has no controls at all — not even End session, which
          it has already been through. */}
      {!ended && (
        <div className="flex flex-wrap items-center gap-2.5">
          {!finished && (
            <>
              <HostButton
                tone={tone}
                pending={pending}
                onClick={() => run(() => advance(sessionId))}
              >
                {currentPosition === null ? "Start" : "Next question"}
              </HostButton>
              <HostButton
                tone={tone}
                variant="ghost"
                pending={pending}
                onClick={() => run(() => setPhase(sessionId, "locked"))}
              >
                Lock answers
              </HostButton>
              <HostButton
                tone={tone}
                variant="ghost"
                pending={pending}
                onClick={() => run(() => setPhase(sessionId, "revealed"))}
              >
                Reveal
              </HostButton>
              <HostButton
                tone={tone}
                variant="ghost"
                pending={pending}
                onClick={() => run(() => setPhase(sessionId, "lobby"))}
              >
                Back to lobby
              </HostButton>
            </>
          )}

          {/* `ml-auto` even when it stands alone, so the button doesn't jump
              across the bar the moment the last question is revealed. */}
          <div className="ml-auto">
            <EndSessionControl
              tone={tone}
              onError={setError}
              onConfirm={async () => {
                const result = await endSession(sessionId);
                if (!result.ok) return { ok: false, message: result.message };
                // The host page has nothing left to show once the room is
                // over, so it goes back to the list. The presenter does — it
                // stays put and renders its own "Session ended." to the room,
                // which is the last thing the audience should see. Sending a
                // projector to the admin sessions list would be worse than
                // doing nothing.
                if (tone === "light") router.push("/admin/sessions");
                return { ok: true };
              }}
            />
          </div>
        </div>
      )}

      {/* Driven by `live.phase`, not the server-rendered one: it is seeded
          from the same value and is strictly fresher, so this tracks the room
          the moment a phase is pushed rather than at the next render of the
          host page. */}
      {footnote && <p className={t.footnote}>{footnote}</p>}
    </div>
  );
}

/**
 * `SubmitButton`, `ConfirmDelete` and `ErrorNote` live in `components/**` —
 * shared, light-themed, and not ours to restyle. Rather than trying to beat
 * their token classes with an appended `className` (Tailwind resolves same-
 * property conflicts by stylesheet order, not by the order of the class
 * attribute, so that override is a coin flip), the `dark` tone renders its
 * own small equivalents below. `light` keeps calling the shared components,
 * unchanged — standalone `/admin/sessions/[id]` renders exactly what it did.
 */
function HostButton({
  tone,
  variant = "primary",
  pending,
  onClick,
  children,
}: {
  tone: HostControlsTone;
  variant?: "primary" | "ghost";
  pending: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  if (tone === "light") {
    return (
      <SubmitButton
        type="button"
        variant={variant}
        pending={pending}
        onClick={onClick}
      >
        {children}
      </SubmitButton>
    );
  }

  const look =
    variant === "primary"
      ? "bg-violet text-white hover:bg-violet-ink"
      : "border border-white/20 text-white/80 hover:border-white/35 hover:text-white";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-busy={pending}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${look}`}
    >
      {pending && (
        <span
          aria-hidden
          className="size-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}

/** `ErrorNote`'s tints are near-white cards — a full-width flash of one on a
 *  projected screen is worse than the error it reports. Dark gets a quiet
 *  line in the palette's lightest red instead; light gets the real thing. */
function HostError({
  tone,
  error,
}: {
  tone: HostControlsTone;
  error: ErrorLike | null;
}) {
  if (tone === "light") return <ErrorNote error={error} />;
  if (!error) return null;
  return (
    <p role="alert" className="text-[12px] text-bad-line">
      {typeof error === "string" ? error : error.userMessage}
    </p>
  );
}

/** Same two-step blast-radius confirm `ConfirmDelete` gives the admin screen,
 *  sized and colored for the presenter bar. Errors are handed up to the one
 *  shared error slot rather than opening a second one. */
function EndSessionControl({
  tone,
  onConfirm,
  onError,
}: {
  tone: HostControlsTone;
  onConfirm: () => Promise<{ ok: true } | { ok: false; message: string }>;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (tone === "light") {
    return (
      <ConfirmDelete
        triggerLabel="End session"
        title="End this session?"
        description="Every phone in the room and the presenter screen will show it as ended. This can't be undone."
        confirmLabel="End it"
        onConfirm={onConfirm}
      />
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer rounded-[7px] border border-white/15 px-3 py-1.5 text-[12.5px] text-white/50 transition-colors hover:border-white/30 hover:text-white/80"
      >
        End session
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-white/60">
        End it for every phone and this screen?
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await onConfirm();
            if (!result.ok) {
              onError(result.message);
              setOpen(false);
            }
          })
        }
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-[7px] bg-bad px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-bad-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending && (
          <span
            aria-hidden
            className="size-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        End it
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen(false)}
        className="cursor-pointer rounded-[7px] border border-white/15 px-3 py-1.5 text-[12.5px] text-white/60 transition-colors hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
}
