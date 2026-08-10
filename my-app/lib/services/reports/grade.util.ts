import type { ReportResponseRow } from "@/lib/repos/reports";
import type { AuthoredQuestion } from "@/lib/services/questions";
import { registry } from "@/lib/templates/registry";
import type { Answer, TemplateKey } from "@/lib/templates/types";

/**
 * Pure — no client, no io (PLAN §8: "aggregation lives in *.util.ts as pure
 * functions over already-fetched rows").
 *
 * Grades every response against its own question's key at READ time, via
 * `registry[template].grade` — never stored (migration, PLAN §8). A
 * question with no gradeable answer (`write_feedback`, `grade === null`) or
 * one that couldn't be matched at all (deleted since, or skipped by
 * `questions.listWithKey`'s soft-fail) grades `null` here too, and callers
 * must skip `null` entirely rather than count it as wrong.
 */
export type GradedResponse = {
  responseId: string;
  questionId: string;
  participantId: string;
  template: TemplateKey;
  grade: 0 | 1 | null;
  /**
   * `which_principle` only, and only when `grade` is 0 — the principle code
   * of the option actually picked. This is the raw material for "most-picked
   * wrong"; `rubric.util.ts` decides which rows get to use it.
   */
  pickedWrongCode: string | null;
};

export function gradeResponses(
  responses: ReportResponseRow[],
  questionsById: Map<string, AuthoredQuestion>,
): GradedResponse[] {
  return responses.flatMap((response) => {
    const question = questionsById.get(response.questionId);
    // Not found: the question was removed from the batch's set, or its row
    // failed to parse and `listWithKey` already skipped it. Either way,
    // there is no key to grade against, so this response contributes to
    // nothing on either axis.
    if (!question) return [];

    const grade = gradeOne(question, response.answer);

    return [
      {
        responseId: response.id,
        questionId: response.questionId,
        participantId: response.participantId,
        template: question.template,
        grade,
        pickedWrongCode: pickedWrongCode(question, response.answer, grade),
      },
    ];
  });
}

/**
 * One cast, at the point where a runtime `template` string meets the static
 * per-template key type — the same boundary `lib/repos/questions.ts`
 * (`parseContent`/`parseAnswerKey`) and `hydrate.util.ts` document. `grade`
 * is `null` for `write_feedback`, which the optional call handles.
 */
function gradeOne(question: AuthoredQuestion, answer: Answer): 0 | 1 | null {
  const grade = registry[question.template].grade as
    | ((answer: Answer, key: unknown) => 0 | 1)
    | null;
  return grade ? grade(answer, question.answerKey) : null;
}

/**
 * Which principle code the participant actually picked, when they picked
 * wrong on a `which_principle` question. `question.content` narrows to the
 * hydrated `which_principle` shape via the `template` check — no cast
 * needed, `AuthoredQuestion` is a proper discriminated union.
 */
function pickedWrongCode(
  question: AuthoredQuestion,
  answer: Answer,
  grade: 0 | 1 | null,
): string | null {
  if (grade !== 0) return null;
  if (question.template !== "which_principle") return null;
  if (answer.option === undefined) return null;

  return (
    question.content.options.find((opt) => opt.id === answer.option)
      ?.principleCode ?? null
  );
}
