import type { ComponentType } from "react";

import { ErrorNote } from "@/components/feedback";
import { QuestionShell } from "@/components/question/shell";
import { WhyNote } from "@/components/question/why-note";
import type { ReviewerQuestion } from "@/lib/services/questions";
import type { Reveal } from "@/lib/services/responses";
import { isAnswerComplete } from "@/lib/templates/answers";
import { registry } from "@/lib/templates/registry";
import type { RevealProps, ReviewProps, TemplateKey } from "@/lib/templates/types";
import type { Answer } from "@/lib/templates/types";

/**
 * One drawn question, in one of three modes. All three share `QuestionShell`
 * — the header, progress rule and footer button are chrome, identical to
 * `/templates` (README "Traps" — container queries, not viewport ones, are
 * what let this look right at 390px).
 *
 *   "reveal" — already answered (this visit or a past one): the registry's
 *              `Reveal` component plus a "Next" control. Never an error
 *              state — a duplicate submit resolves here too (§5.8, §6).
 *   "review" — not yet answered, batch is open: the registry's `Review`
 *              component plus a submit button wired to the Server Action.
 *   "closed" — not yet answered, batch is read-only: a note instead of a
 *              form. The README is emphatic that a closed batch must not
 *              strand a participant, so this still advances the sequence.
 *
 * A step is either a `Reveal` or a `ReviewerQuestion` (never both, never
 * neither — `flow.tsx` derives one or the other), so `question` and `reveal`
 * are each optional here and the branch below picks the one that's present.
 */

/**
 * `registry[template]` widens to a union of all three `QuestionTemplate`
 * shapes when `template` is only known at runtime, so `entry.Review` /
 * `entry.Reveal` come back typed as a union of components that each want a
 * DIFFERENT content type. One cast here, at the same boundary
 * `lib/repos/questions.ts` and `lib/services/responses/reveal.util.ts`
 * already cross for the identical reason — a runtime `template` string
 * meeting the static per-template union.
 */
const reviewComponents = {
  which_principle: registry.which_principle.Review,
  rank_variants: registry.rank_variants.Review,
  write_feedback: registry.write_feedback.Review,
} as Record<TemplateKey, ComponentType<ReviewProps<unknown>>>;

const revealComponents = {
  which_principle: registry.which_principle.Reveal,
  rank_variants: registry.rank_variants.Reveal,
  write_feedback: registry.write_feedback.Reveal,
} as Record<TemplateKey, ComponentType<RevealProps<unknown, unknown>>>;

/**
 * Whether the current draft is complete enough to submit — the per-template
 * answer schemas in `lib/templates/answers.ts`, the same ones the submit
 * services enforce, so this gate and the server can't disagree. (Rankings
 * pass from the moment the card renders: the Review component commits its
 * default order into the answer on mount.)
 */
function isAnswered(template: TemplateKey, answer: Answer): boolean {
  return isAnswerComplete(template, answer);
}

export function QuestionStep({
  index,
  total,
  batchName,
  question,
  reveal,
  answer,
  onAnswer,
  rationale,
  onRationale,
  onSubmit,
  onNext,
  pending,
  error,
  canSubmit,
}: {
  index: number;
  total: number;
  batchName: string;
  /** Present when this question hasn't been answered yet. */
  question?: ReviewerQuestion;
  /** Present once answered — this visit or a previous one. */
  reveal?: Reveal;
  answer: Answer;
  onAnswer: (next: Answer) => void;
  rationale: string;
  onRationale: (next: string) => void;
  onSubmit: () => void;
  onNext: () => void;
  pending: boolean;
  error: string | null;
  /** false on an inactive/expired batch — the "closed" mode. */
  canSubmit: boolean;
}) {
  const label = `${batchName} · Item ${index + 1} of ${total}`;
  const progress = (index + 1) / total;
  const isLast = index === total - 1;
  const nextAction = { label: isLast ? "Finish" : "Next item", onClick: onNext };

  if (reveal) {
    const RevealComponent = revealComponents[reveal.template];
    return (
      <QuestionShell
        label={label}
        progress={progress}
        status="Answer"
        statusTone="ok"
        action={nextAction}
      >
        <div className="flex flex-col gap-5">
          <RevealComponent
            content={reveal.content}
            answerKey={reveal.answerKey}
            answer={reveal.answer}
          />
          {reveal.rationale && (
            <div className="flex flex-col gap-1.5 rounded-[9px] border border-line bg-surface px-4 py-3">
              <span className="text-[12.5px] text-muted-2">Your note</span>
              <p className="text-[13.5px] leading-[1.6] text-ink-4">
                {reveal.rationale}
              </p>
            </div>
          )}
        </div>
      </QuestionShell>
    );
  }

  // Neither reveal nor question — should not happen (flow.tsx always hands
  // one of the two), but this keeps the component total rather than
  // throwing on a bad prop combination.
  if (!question) return null;

  if (!canSubmit) {
    return (
      <QuestionShell
        label={label}
        progress={progress}
        status="Set closed"
        action={nextAction}
      >
        <div className="flex flex-col gap-2 rounded-[10px] border border-dashed border-line-4 bg-white/60 px-4 py-6">
          <span className="text-[14px] font-medium text-muted">
            This set is closed
          </span>
          <p className="text-[13.5px] leading-[1.6] text-muted-3">
            New answers aren&rsquo;t being collected anymore. You can still
            move through the rest of the set.
          </p>
        </div>
      </QuestionShell>
    );
  }

  const ReviewComponent = reviewComponents[question.template];
  const submittable = !pending && isAnswered(question.template, answer);

  return (
    <QuestionShell
      label={label}
      progress={progress}
      status="Anonymous · no score"
      action={{
        label: pending ? "Submitting…" : "Submit",
        onClick: onSubmit,
        disabled: !submittable,
      }}
    >
      <div className="flex flex-col gap-5">
        <ReviewComponent
          content={question.content}
          prompt={question.prompt}
          answer={answer}
          onAnswer={onAnswer}
        />
        {question.content.notePrompt && (
          <WhyNote
            value={rationale}
            onChange={onRationale}
            label={question.content.notePrompt}
          />
        )}
        <ErrorNote error={error} />
      </div>
    </QuestionShell>
  );
}
