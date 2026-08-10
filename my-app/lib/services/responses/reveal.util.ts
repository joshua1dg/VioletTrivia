import { registry } from "@/lib/templates/registry";
import type { Answer, TemplateKey } from "@/lib/templates/types";
import type {
  AnswerKeyOf,
  AuthoredQuestion,
  HydratedContent,
} from "@/lib/services/questions";

/**
 * The reveal payload — pure, no client (PLAN §5.3).
 *
 * ONLY the async path builds one of these. It carries the answer key, which
 * a phone in a live room must never receive; `lib/services/responses/
 * live-submit.service.ts` does not import this module, and `app/live/
 * actions.ts` must never import it either (§5.5).
 */

export type Reveal = {
  [T in TemplateKey]: {
    questionId: string;
    template: T;
    prompt: string;
    content: HydratedContent<T>;
    answerKey: AnswerKeyOf<T>;
    /** What this participant actually submitted. */
    answer: Answer;
    /** Their optional "Why?" note. */
    rationale: string | null;
    /**
     * True when the answer on file was given OUTSIDE the batch being viewed
     * — the same question in a different async batch. `responses_dedupe` is
     * deliberately not scoped by batch (migration ~line 483: "a participant
     * still answers it once, so tallies stay clean"), so a shared question
     * arrives in the second batch already answered. The flow renders those
     * as "answered earlier" rather than passing them off as a fresh answer —
     * without this flag a participant who never saw the question in THIS
     * set gets an unexplained answer page (the bug of 2026-08-10).
     */
    answeredElsewhere: boolean;
    /**
     * 0, 1, or NULL where the template has no gradeable answer.
     * `write_feedback` is prose — anything that scores must skip it rather
     * than quietly count every response as wrong.
     */
    grade: 0 | 1 | null;
    answeredAt: string;
  };
}[TemplateKey];

export function buildReveal(
  question: AuthoredQuestion,
  response: {
    answer: Answer;
    rationale: string | null;
    createdAt: string;
    batchId: string | null;
  },
  /** The batch the participant is currently viewing — `answeredElsewhere`
   * is "this response belongs to some other batch than that one". */
  viewedBatchId: string,
): Reveal {
  return {
    questionId: question.id,
    template: question.template,
    prompt: question.prompt,
    content: question.content,
    answerKey: question.answerKey,
    answer: response.answer,
    rationale: response.rationale,
    answeredElsewhere: response.batchId !== viewedBatchId,
    grade: gradeFor(question.template, response.answer, question.answerKey),
    answeredAt: response.createdAt,
    // One cast, where a runtime `template` string meets the static union —
    // the same boundary lib/repos/questions.ts documents.
  } as Reveal;
}

/** Null when the registry says this template has nothing to grade. */
export function gradeFor(
  template: TemplateKey,
  answer: Answer,
  answerKey: unknown,
): 0 | 1 | null {
  const grade = registry[template].grade as
    | ((answer: Answer, answerKey: unknown) => 0 | 1)
    | null;
  return grade ? grade(answer, answerKey) : null;
}
