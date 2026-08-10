"use client";

/**
 * THE CLIENT BOUNDARY for the async reviewer flow (README trap: `"use
 * client"` at the boundary only). Everything below this — `IntroScreen`,
 * `QuestionStep`, `CompleteScreen`, the registry's own `Review`/`Reveal` —
 * is presentational and takes handlers as props; only this file and
 * `bootstrap.tsx` hold hooks.
 *
 * State machine lives in `_ui/use-async-flow.ts` (PLAN §5.6 — a UI service).
 * This component just renders whichever screen that hook says it's on.
 */

import { CompleteScreen } from "./complete-screen";
import { IntroScreen } from "./intro-screen";
import { QuestionStep } from "./question-step";
import { useAsyncFlow, type FlowStep } from "./_ui/use-async-flow";

export function Flow({
  participantId,
  batchToken,
  batchName,
  canSubmit,
  steps,
}: {
  participantId: string;
  batchToken: string;
  batchName: string;
  canSubmit: boolean;
  steps: FlowStep[];
}) {
  const flow = useAsyncFlow({ participantId, batchToken, canSubmit, steps });

  if (flow.screen === "intro") {
    return (
      <IntroScreen
        batchName={batchName}
        total={flow.total}
        canSubmit={canSubmit}
        onStart={flow.start}
      />
    );
  }

  if (flow.screen === "complete") {
    return (
      <CompleteScreen
        answeredCount={flow.answeredCount}
        total={flow.total}
        canSubmit={canSubmit}
      />
    );
  }

  // "sequence" — flow.current is guaranteed by the hook whenever there is at
  // least one step; an empty draw never reaches this screen (PLAN §5.15's
  // sampleSize <= 0 edge case resolves to `total === 0`, which the hook
  // treats as already-complete).
  if (!flow.current) return null;

  return (
    <QuestionStep
      index={flow.index}
      total={flow.total}
      batchName={batchName}
      question={
        flow.current.kind === "question" && !flow.currentReveal
          ? flow.current.question
          : undefined
      }
      reveal={flow.currentReveal}
      answer={flow.answer}
      onAnswer={flow.setAnswer}
      rationale={flow.rationale}
      onRationale={flow.setRationale}
      onSubmit={flow.submit}
      onNext={flow.next}
      pending={flow.pending}
      error={flow.error}
      canSubmit={canSubmit}
    />
  );
}
