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
  },
): Reveal {
  return {
    questionId: question.id,
    template: question.template,
    prompt: question.prompt,
    content: question.content,
    answerKey: question.answerKey,
    answer: response.answer,
    rationale: response.rationale,
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
