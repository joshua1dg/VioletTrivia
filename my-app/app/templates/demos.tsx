"use client";

import { useState } from "react";
import { QuestionShell } from "@/components/question/shell";
import {
  WhichPrincipleReveal,
  WhichPrincipleReview,
} from "@/lib/templates/which-principle";
import {
  whichPrincipleContent,
  whichPrincipleKey,
  whichPrinciplePrompt,
} from "@/lib/templates/which-principle/fixture";
import {
  RankVariantsReveal,
  RankVariantsReview,
} from "@/lib/templates/rank-variants";
import {
  rankVariantsContent,
  rankVariantsKey,
  rankVariantsPrompt,
} from "@/lib/templates/rank-variants/fixture";
import {
  BestFeedbackReveal,
  BestFeedbackReview,
} from "@/lib/templates/best-feedback";
import {
  bestFeedbackContent,
  bestFeedbackKey,
  bestFeedbackPrompt,
} from "@/lib/templates/best-feedback/fixture";
import type { Answer } from "@/lib/templates/types";

/**
 * Each demo owns its own state, so the phone frame and the wide frame on the
 * same page can be driven independently — pick an option in one without the
 * other jumping. This is also roughly what the real flow will do: hold the
 * answer, submit, swap the body for the reveal.
 */

function WhichPrincipleDemo() {
  const [answer, setAnswer] = useState<Answer>({});
  const [note, setNote] = useState("");
  const [revealed, setRevealed] = useState(false);

  const reset = () => {
    setRevealed(false);
    setAnswer({});
    setNote("");
  };

  return (
    <QuestionShell
      label="Batch A · Item 2 of 3"
      progress={2 / 3}
      status={revealed ? "Answer" : "Anonymous · no score"}
      statusTone={revealed ? "ok" : "muted"}
      hint={
        revealed ? whichPrincipleKey.summary : whichPrincipleContent.footerHint
      }
      action={
        revealed
          ? { label: "Next item", onClick: reset }
          : {
              label: "Submit",
              disabled: !answer.option,
              onClick: () => setRevealed(true),
            }
      }
    >
      {revealed ? (
        <WhichPrincipleReveal
          content={whichPrincipleContent}
          answerKey={whichPrincipleKey}
          answer={answer}
        />
      ) : (
        <WhichPrincipleReview
          content={whichPrincipleContent}
          prompt={whichPrinciplePrompt}
          answer={answer}
          onAnswer={setAnswer}
          note={note}
          onNote={setNote}
        />
      )}
    </QuestionShell>
  );
}

function RankVariantsDemo() {
  const [answer, setAnswer] = useState<Answer>({});
  const [note, setNote] = useState("");
  const [revealed, setRevealed] = useState(false);

  return (
    <QuestionShell
      label="Batch C · Item 1 of 4"
      progress={1 / 4}
      status={revealed ? "Answer" : "Anonymous · no score"}
      statusTone={revealed ? "ok" : "muted"}
      hint={revealed ? undefined : rankVariantsContent.footerHint}
      action={
        revealed
          ? {
              label: "Next item",
              onClick: () => {
                setRevealed(false);
                setAnswer({});
                setNote("");
              },
            }
          : { label: "Submit ranking", onClick: () => setRevealed(true) }
      }
    >
      {revealed ? (
        <RankVariantsReveal
          content={rankVariantsContent}
          answerKey={rankVariantsKey}
          answer={answer}
        />
      ) : (
        <RankVariantsReview
          content={rankVariantsContent}
          prompt={rankVariantsPrompt}
          answer={answer}
          onAnswer={setAnswer}
          note={note}
          onNote={setNote}
        />
      )}
    </QuestionShell>
  );
}

function BestFeedbackDemo() {
  const [answer, setAnswer] = useState<Answer>({});
  const [revealed, setRevealed] = useState(false);

  return (
    <QuestionShell
      label="Reviewer training · Item 5 of 8"
      progress={5 / 8}
      status={revealed ? "Answer" : "Choosing"}
      statusTone={revealed ? "ok" : "muted"}
      hint={revealed ? undefined : bestFeedbackContent.footerHint}
      action={
        revealed
          ? {
              label: "Next item",
              onClick: () => {
                setRevealed(false);
                setAnswer({});
              },
            }
          : {
              label: "Check",
              disabled: !answer.option,
              onClick: () => setRevealed(true),
            }
      }
    >
      {revealed ? (
        <BestFeedbackReveal
          content={bestFeedbackContent}
          answerKey={bestFeedbackKey}
          answer={answer}
        />
      ) : (
        <BestFeedbackReview
          content={bestFeedbackContent}
          prompt={bestFeedbackPrompt}
          answer={answer}
          onAnswer={setAnswer}
        />
      )}
    </QuestionShell>
  );
}

const DEMOS = {
  which_principle: WhichPrincipleDemo,
  rank_variants: RankVariantsDemo,
  best_feedback: BestFeedbackDemo,
} as const;

/** Renders the same template twice — once wide, once at 390 × 844. */
export function TemplateDemo({ kind }: { kind: keyof typeof DEMOS }) {
  const Demo = DEMOS[kind];
  return (
    <div className="flex flex-col items-start gap-8 2xl:flex-row">
      <div className="flex w-full min-w-0 flex-col gap-2.5 2xl:flex-1">
        <span className="text-[12px] text-muted-3">Wide — 1040px column</span>
        <div className="min-h-[520px] w-full max-w-[1040px]">
          <Demo />
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-2.5">
        <span className="text-[12px] text-muted-3">Phone — 390 × 844</span>
        <div className="h-[844px] w-[390px]">
          <Demo />
        </div>
      </div>
    </div>
  );
}
