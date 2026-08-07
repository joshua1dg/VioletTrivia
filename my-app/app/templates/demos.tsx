"use client";

import { useState, type ReactNode } from "react";
import { QuestionShell } from "@/components/question/shell";
import { WhyNote } from "@/components/question/why-note";
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
 * same page can be driven independently. This is roughly what the real flow
 * will do: hold the answer, submit, swap the body for the reveal.
 */

/**
 * The "Why?" note belongs to the flow, not to any template — it maps to
 * responses.rationale, which every template offers. Rendering it here keeps
 * all three Review components on an identical prop signature, and whether it
 * appears at all is authored content (`notePrompt`) rather than a hardcoded
 * per-template decision.
 */
function ReviewBody({
  notePrompt,
  note,
  onNote,
  children,
}: {
  notePrompt?: string;
  note: string;
  onNote: (next: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      {children}
      {notePrompt && (
        <WhyNote value={note} onChange={onNote} label={notePrompt} />
      )}
    </div>
  );
}

function useAnswerState() {
  const [answer, setAnswer] = useState<Answer>({});
  const [note, setNote] = useState("");
  const [revealed, setRevealed] = useState(false);
  const reset = () => {
    setRevealed(false);
    setAnswer({});
    setNote("");
  };
  return { answer, setAnswer, note, setNote, revealed, setRevealed, reset };
}

function WhichPrincipleDemo() {
  const s = useAnswerState();

  return (
    <QuestionShell
      label="Batch A · Item 2 of 3"
      progress={2 / 3}
      status={s.revealed ? "Answer" : "Anonymous · no score"}
      statusTone={s.revealed ? "ok" : "muted"}
      hint={
        s.revealed ? whichPrincipleKey.summary : whichPrincipleContent.footerHint
      }
      action={
        s.revealed
          ? { label: "Next item", onClick: s.reset }
          : {
              label: "Submit",
              disabled: !s.answer.option,
              onClick: () => s.setRevealed(true),
            }
      }
    >
      {s.revealed ? (
        <WhichPrincipleReveal
          content={whichPrincipleContent}
          answerKey={whichPrincipleKey}
          answer={s.answer}
        />
      ) : (
        <ReviewBody
          notePrompt={whichPrincipleContent.notePrompt}
          note={s.note}
          onNote={s.setNote}
        >
          <WhichPrincipleReview
            content={whichPrincipleContent}
            prompt={whichPrinciplePrompt}
            answer={s.answer}
            onAnswer={s.setAnswer}
          />
        </ReviewBody>
      )}
    </QuestionShell>
  );
}

function RankVariantsDemo() {
  const s = useAnswerState();

  return (
    <QuestionShell
      label="Batch C · Item 1 of 4"
      progress={1 / 4}
      status={s.revealed ? "Answer" : "Anonymous · no score"}
      statusTone={s.revealed ? "ok" : "muted"}
      hint={s.revealed ? undefined : rankVariantsContent.footerHint}
      action={
        s.revealed
          ? { label: "Next item", onClick: s.reset }
          : { label: "Submit ranking", onClick: () => s.setRevealed(true) }
      }
    >
      {s.revealed ? (
        <RankVariantsReveal
          content={rankVariantsContent}
          answerKey={rankVariantsKey}
          answer={s.answer}
        />
      ) : (
        <ReviewBody
          notePrompt={rankVariantsContent.notePrompt}
          note={s.note}
          onNote={s.setNote}
        >
          <RankVariantsReview
            content={rankVariantsContent}
            prompt={rankVariantsPrompt}
            answer={s.answer}
            onAnswer={s.setAnswer}
          />
        </ReviewBody>
      )}
    </QuestionShell>
  );
}

function BestFeedbackDemo() {
  const s = useAnswerState();

  return (
    <QuestionShell
      label="Reviewer training · Item 5 of 8"
      progress={5 / 8}
      status={s.revealed ? "Answer" : "Choosing"}
      statusTone={s.revealed ? "ok" : "muted"}
      hint={s.revealed ? undefined : bestFeedbackContent.footerHint}
      action={
        s.revealed
          ? { label: "Next item", onClick: s.reset }
          : {
              label: "Check",
              disabled: !s.answer.option,
              onClick: () => s.setRevealed(true),
            }
      }
    >
      {s.revealed ? (
        <BestFeedbackReveal
          content={bestFeedbackContent}
          answerKey={bestFeedbackKey}
          answer={s.answer}
        />
      ) : (
        <ReviewBody
          notePrompt={bestFeedbackContent.notePrompt}
          note={s.note}
          onNote={s.setNote}
        >
          <BestFeedbackReview
            content={bestFeedbackContent}
            prompt={bestFeedbackPrompt}
            answer={s.answer}
            onAnswer={s.setAnswer}
          />
        </ReviewBody>
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
