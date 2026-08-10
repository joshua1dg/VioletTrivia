"use client";

import { useActionState, useState, useTransition } from "react";

import { submitAsyncAnswer, type SubmitAsyncAnswerResult } from "@/app/b/actions";
import type { ReviewerQuestion } from "@/lib/services/questions";
import type { Reveal } from "@/lib/services/responses";
import type { Answer } from "@/lib/templates/types";

/**
 * The client half of the async reviewer flow (PLAN §5.6 — a UI service is a
 * client hook that owns pending/error/success state a component shouldn't).
 *
 * One step per drawn question, in draw order. A step already carries its
 * reveal when the participant answered it on an earlier visit (from
 * `listAnsweredReveals`); otherwise it carries the keyless `ReviewerQuestion`
 * the participant hasn't seen yet.
 */
export type FlowStep =
  | { kind: "reveal"; reveal: Reveal }
  | { kind: "question"; question: ReviewerQuestion };

export type FlowScreen = "intro" | "sequence" | "complete";

export function useAsyncFlow(opts: {
  participantId: string;
  batchToken: string;
  /** false on an 'inactive' or expired batch — read-only (PLAN §7, README). */
  canSubmit: boolean;
  steps: FlowStep[];
}) {
  const { participantId, batchToken, canSubmit, steps } = opts;
  const total = steps.length;

  // Reveals gathered locally as submissions succeed, keyed by questionId, so
  // a just-answered question renders its reveal without a round trip, and a
  // question answered on an earlier visit renders one from the server read.
  const [reveals, setReveals] = useState<Record<string, Reveal>>(() => {
    const initial: Record<string, Reveal> = {};
    for (const step of steps) {
      if (step.kind === "reveal") initial[step.reveal.questionId] = step.reveal;
    }
    return initial;
  });

  const firstUnansweredIndex = steps.findIndex(
    (step) => step.kind === "question" && !reveals[step.question.id],
  );
  const hasAnsweredAny = steps.some((step) => step.kind === "reveal");
  const allAnswered = firstUnansweredIndex === -1;

  // Resume on refresh (PLAN §5.14/§9): someone who has already started lands
  // straight back in the sequence at their first unanswered question, rather
  // than re-clicking through an intro screen they've already seen.
  const [screen, setScreen] = useState<FlowScreen>(() => {
    // An empty draw (`async_sample_size` of 0, or a batch composed with no
    // questions yet) has nothing to start or resume.
    if (total === 0) return "complete";
    if (allAnswered) return hasAnsweredAny ? "complete" : "intro";
    return hasAnsweredAny ? "sequence" : "intro";
  });
  const [index, setIndex] = useState(() => Math.max(firstUnansweredIndex, 0));

  const [answer, setAnswer] = useState<Answer>({});
  const [rationale, setRationale] = useState("");

  const [state, dispatchSubmit] = useActionState<
    SubmitAsyncAnswerResult | null,
    unknown
  >(submitAsyncAnswer, null);
  const [pending, startTransition] = useTransition();

  // Fold a resolved submission into `reveals` BY THE REVEAL'S OWN questionId
  // — not by whatever step happens to be current — so a stale result from a
  // previous question can never paint over the wrong step. Done as a guarded
  // render-phase adjustment (React's documented "derive from a previous
  // render" pattern) rather than an effect, so the reveal paints in the same
  // pass instead of one cascading render later.
  if (state?.ok && !reveals[state.reveal.questionId]) {
    setReveals((prev) => ({ ...prev, [state.reveal.questionId]: state.reveal }));
  }

  const current = steps[index];
  const currentReveal =
    current?.kind === "reveal"
      ? current.reveal
      : current
        ? reveals[current.question.id]
        : undefined;

  const error = !current?.kind || currentReveal ? null : errorFor(state);

  function start() {
    setScreen("sequence");
  }

  function submit() {
    if (!current || current.kind !== "question" || currentReveal) return;
    startTransition(() => {
      dispatchSubmit({
        participantId,
        questionId: current.question.id,
        batchToken,
        answer,
        rationale: rationale.trim() ? rationale.trim() : undefined,
      });
    });
  }

  function next() {
    setAnswer({});
    setRationale("");
    const nextIndex = index + 1;
    if (nextIndex >= total) {
      setScreen("complete");
    } else {
      setIndex(nextIndex);
    }
  }

  return {
    screen,
    total,
    index,
    current,
    currentReveal,
    canSubmit,
    answer,
    setAnswer,
    rationale,
    setRationale,
    pending,
    error,
    answeredCount: Object.keys(reveals).length,
    start,
    submit,
    next,
  };
}

/** Only ever a message string — never the previous success payload. */
function errorFor(state: SubmitAsyncAnswerResult | null): string | null {
  if (state && !state.ok) return state.message;
  return null;
}
