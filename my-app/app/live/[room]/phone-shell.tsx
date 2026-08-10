"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { ErrorNote, type ErrorLike } from "@/components/feedback";
import { QuestionShell } from "@/components/question/shell";
import { WhyNote } from "@/components/question/why-note";
import type { ReviewerQuestion } from "@/lib/services/questions";
import { useSessionChannel, type SessionChannelInit } from "@/lib/realtime/session-channel";
import { formatSeconds, useCountdown } from "@/lib/realtime/use-countdown";
import { registry } from "@/lib/templates/registry";
import type { Answer } from "@/lib/templates/types";

import { submitLiveAnswer } from "../actions";

/**
 * The phone view (PLAN §9 F5, §7.1). Realtime drives it: a `phase` push
 * renders instantly from `useSessionChannel`; a `current_question_id`
 * change calls `router.refresh()` and the NEW server-rendered `question`
 * prop arrives keyless by type (`ReviewerQuestion` has no `answerKey`
 * property at all — §5.10). `current` below is gated on the loaded
 * question's id matching the live-pushed one, so the brief window between
 * the phase flipping and the refresh landing shows a neutral "next
 * question" state instead of the previous question's form.
 *
 * `revealed` never shows a tally or a key — "results are on the shared
 * screen" is the whole of it, per the README's live rule.
 */
export function PhoneShell({
  sessionId,
  participantId,
  initial,
  question,
  alreadyAnswered,
}: {
  sessionId: string;
  participantId: string;
  initial: SessionChannelInit;
  question: ReviewerQuestion | null;
  alreadyAnswered: boolean;
}) {
  const router = useRouter();
  const live = useSessionChannel(sessionId, initial, {
    presenceKey: participantId,
    track: true,
  });

  const lastQuestionId = useRef(initial.currentQuestionId);
  useEffect(() => {
    if (live.currentQuestionId !== lastQuestionId.current) {
      lastQuestionId.current = live.currentQuestionId;
      router.refresh();
    }
  }, [live.currentQuestionId, router]);

  const [answer, setAnswer] = useState<Answer>({});
  const [note, setNote] = useState("");
  const [answered, setAnswered] = useState(alreadyAnswered);
  const [error, setError] = useState<ErrorLike | null>(null);
  const [pending, startTransition] = useTransition();

  // Display only — the server's submit guard is what enforces the deadline
  // (`app/live/actions.ts`), so a skewed phone clock mis-renders the number
  // at worst. The host's screen locks the room when time runs out.
  const secondsLeft = useCountdown(
    live.phase === "voting" ? live.votingEndsAt : null,
  );

  // A freshly loaded question (new id) always starts from a clean slate,
  // even though this whole component stays mounted across the refresh.
  const lastLoadedId = useRef(question?.id ?? null);
  useEffect(() => {
    if ((question?.id ?? null) !== lastLoadedId.current) {
      lastLoadedId.current = question?.id ?? null;
      setAnswer({});
      setNote("");
      setAnswered(alreadyAnswered);
      setError(null);
    }
  }, [question?.id, alreadyAnswered]);

  const current =
    question && question.id === live.currentQuestionId ? question : null;

  function onSubmit() {
    if (!current) return;
    setError(null);
    startTransition(async () => {
      const result = await submitLiveAnswer(sessionId, {
        participantId,
        questionId: current.id,
        answer,
        rationale: note.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setAnswered(true);
    });
  }

  if (live.phase === "ended") {
    return (
      <PhoneMessage title="This session has ended">
        Thanks for playing.
      </PhoneMessage>
    );
  }

  if (live.phase === "locked") {
    return (
      <PhoneMessage title="Answers are locked">
        Sit tight for the reveal.
      </PhoneMessage>
    );
  }

  if (live.phase === "revealed") {
    return (
      <PhoneMessage title="Results are on the shared screen">
        Look up — the host is walking through it.
      </PhoneMessage>
    );
  }

  if (live.phase === "lobby" || !current) {
    return (
      <PhoneMessage title="Waiting for the host">
        Hang tight — the next question is on its way.
      </PhoneMessage>
    );
  }

  if (answered) {
    return (
      <PhoneMessage title="You're in">
        Your answer is recorded — waiting on the rest of the room.
      </PhoneMessage>
    );
  }

  return (
    <div className="flex min-h-screen flex-col p-4">
      <QuestionShell
        label={registry[current.template].label}
        action={{
          label: pending ? "Submitting…" : "Submit",
          disabled: pending || !canSubmit(current, answer),
          onClick: onSubmit,
        }}
      >
        {secondsLeft !== null && (
          <p
            className={
              secondsLeft <= 10
                ? "text-center text-[13px] font-semibold tabular-nums text-warn-ink"
                : "text-center text-[13px] tabular-nums text-muted-2"
            }
          >
            {formatSeconds(secondsLeft)} left
          </p>
        )}
        <ErrorNote error={error} />
        <ReviewForCurrent
          current={current}
          answer={answer}
          onAnswer={setAnswer}
          note={note}
          onNote={setNote}
        />
      </QuestionShell>
    </div>
  );
}

function PhoneMessage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
      <span className="text-[15px] font-medium text-ink">{title}</span>
      <p className="max-w-[42ch] text-[13.5px] leading-[1.6] text-muted-2">
        {children}
      </p>
    </main>
  );
}

/** One cast-free switch at the boundary where a runtime `template` string
 * meets the static registry union — the same shape `app/admin/questions/new/editor.tsx`
 * documents as "the boundary where a runtime string becomes a static type."
 * Each case narrows `current` to its own member of the `ReviewerQuestion`
 * union, so every `registry[...].Review` call below is fully typed with no
 * cast. */
function ReviewForCurrent({
  current,
  answer,
  onAnswer,
  note,
  onNote,
}: {
  current: ReviewerQuestion;
  answer: Answer;
  onAnswer: (next: Answer) => void;
  note: string;
  onNote: (next: string) => void;
}) {
  switch (current.template) {
    case "which_principle":
      return (
        <div className="flex flex-col gap-5">
          <registry.which_principle.Review
            content={current.content}
            prompt={current.prompt}
            answer={answer}
            onAnswer={onAnswer}
          />
          {current.content.notePrompt && (
            <WhyNote
              value={note}
              onChange={onNote}
              label={current.content.notePrompt}
            />
          )}
        </div>
      );
    case "rank_variants":
      return (
        <div className="flex flex-col gap-5">
          <registry.rank_variants.Review
            content={current.content}
            prompt={current.prompt}
            answer={answer}
            onAnswer={onAnswer}
          />
          {current.content.notePrompt && (
            <WhyNote
              value={note}
              onChange={onNote}
              label={current.content.notePrompt}
            />
          )}
        </div>
      );
    case "write_feedback":
      return (
        <div className="flex flex-col gap-5">
          <registry.write_feedback.Review
            content={current.content}
            prompt={current.prompt}
            answer={answer}
            onAnswer={onAnswer}
          />
          {current.content.notePrompt && (
            <WhyNote
              value={note}
              onChange={onNote}
              label={current.content.notePrompt}
            />
          )}
        </div>
      );
  }
}

function canSubmit(current: ReviewerQuestion, answer: Answer): boolean {
  switch (current.template) {
    case "which_principle":
      return !!answer.option;
    case "rank_variants":
      // A complete ranking exists from the moment the card renders — the
      // Review component commits its default order into the answer on mount
      // — so reordering is optional and submitting isn't gated on touching
      // it. Same as the /templates demo.
      return true;
    case "write_feedback":
      return !!answer.feedback?.trim();
  }
}
