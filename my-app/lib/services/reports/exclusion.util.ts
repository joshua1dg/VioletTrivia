import type { ReportResponseRow } from "@/lib/repos/reports";
import type { AuthoredQuestion } from "@/lib/services/questions";

/**
 * Pure. `write_feedback` has no key, so it is excluded from both aggregate
 * axes entirely (PLAN §8/D5) — this builds the "[ Read the responses → ]"
 * affordance instead: every prose answer given to an excluded question,
 * grouped by question, including questions nobody has answered yet.
 */
export type ExcludedQuestion = {
  id: string;
  prompt: string;
  responses: { participantId: string; feedback: string }[];
};

export function buildExclusions(
  questions: AuthoredQuestion[],
  responses: ReportResponseRow[],
): ExcludedQuestion[] {
  const byQuestion = new Map<string, ExcludedQuestion>();

  for (const question of questions) {
    if (question.template !== "write_feedback") continue;
    byQuestion.set(question.id, {
      id: question.id,
      prompt: question.prompt,
      responses: [],
    });
  }

  if (byQuestion.size === 0) return [];

  for (const response of responses) {
    const entry = byQuestion.get(response.questionId);
    if (!entry) continue;
    if (response.answer.feedback === undefined) continue; // shouldn't happen; be defensive rather than throw
    entry.responses.push({
      participantId: response.participantId,
      feedback: response.answer.feedback,
    });
  }

  return Array.from(byQuestion.values());
}
