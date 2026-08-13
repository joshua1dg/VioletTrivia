"use client";

import { useState, type ComponentType } from "react";

import { QuestionShell } from "@/components/question/shell";
import { isAnswerComplete } from "@/lib/templates/answers";
import { registry } from "@/lib/templates/registry";
import type {
  Answer,
  RankVariantsContent,
  RevealProps,
  TemplateKey,
  WhichPrincipleContent,
  WriteFeedbackContent,
} from "@/lib/templates/types";

/**
 * The participant's experience of the question, below its analytics
 * (2026-08-13) — the WHOLE loop, not a static look: answer it, hit
 * Submit, get the same Reveal a real participant gets. Nothing touches
 * the database; Submit flips local state, "Try again" resets it.
 *
 * Same Review/Reveal components and QuestionShell chrome as the phone
 * and async flows, at the page's natural width — the shell picks its
 * own layout from its container, so on a desktop screen this IS the
 * desktop view. Submit gates on the same per-template answer schemas
 * as the real submit buttons, so the preview also demonstrates what
 * "complete" means for this question.
 *
 * THE KEY CROSSES TO THE CLIENT HERE, deliberately: the reveal needs
 * it, and this is a staff-gated admin page whose surrounding report
 * already names the key code — the answer-key rule (PLAN §5.10) is
 * about participant surfaces, and this isn't one. Never lift this
 * component into anything a participant can reach.
 */

// The same widening as app/b/[token]/question-step.tsx: `entry.Reveal`
// is a union of components that each want their own template's types.
const revealComponents = {
  which_principle: registry.which_principle.Reveal,
  rank_variants: registry.rank_variants.Reveal,
  write_feedback: registry.write_feedback.Reveal,
} as Record<TemplateKey, ComponentType<RevealProps<unknown, unknown>>>;

export function QuestionPreview({
  template,
  content,
  answerKey,
  prompt,
}: {
  template: TemplateKey;
  /** HYDRATED content — the shape Review/Reveal components take. */
  content: unknown;
  answerKey: unknown;
  prompt: string;
}) {
  const [answer, setAnswer] = useState<Answer>({});
  const [revealed, setRevealed] = useState(false);

  if (revealed) {
    const RevealComponent = revealComponents[template];
    return (
      <QuestionShell
        label={registry[template].label}
        status="Answer"
        statusTone="ok"
        hint="Nothing was saved — this reveal lives in your browser only."
        action={{
          label: "Try again",
          onClick: () => {
            setRevealed(false);
            setAnswer({});
          },
        }}
      >
        <RevealComponent content={content} answerKey={answerKey} answer={answer} />
      </QuestionShell>
    );
  }

  return (
    <QuestionShell
      label={registry[template].label}
      status="Preview"
      hint="Answer and submit to see the reveal — nothing is saved."
      action={{
        label: "Submit",
        onClick: () => setRevealed(true),
        disabled: !isAnswerComplete(template, answer),
      }}
    >
      <PreviewReview
        template={template}
        content={content}
        prompt={prompt}
        answer={answer}
        onAnswer={setAnswer}
      />
    </QuestionShell>
  );
}

/** Cast-free switch at the runtime-template/static-union boundary — same
 * shape as `PresenterReview` in app/present/[id]/presenter-shell.tsx and
 * the phone's `ReviewForCurrent`. */
function PreviewReview({
  template,
  content,
  prompt,
  answer,
  onAnswer,
}: {
  template: TemplateKey;
  content: unknown;
  prompt: string;
  answer: Answer;
  onAnswer: (next: Answer) => void;
}) {
  switch (template) {
    case "which_principle":
      return (
        <registry.which_principle.Review
          content={content as WhichPrincipleContent}
          prompt={prompt}
          answer={answer}
          onAnswer={onAnswer}
        />
      );
    case "rank_variants":
      return (
        <registry.rank_variants.Review
          content={content as RankVariantsContent}
          prompt={prompt}
          answer={answer}
          onAnswer={onAnswer}
        />
      );
    case "write_feedback":
      return (
        <registry.write_feedback.Review
          content={content as WriteFeedbackContent}
          prompt={prompt}
          answer={answer}
          onAnswer={onAnswer}
        />
      );
  }
}
