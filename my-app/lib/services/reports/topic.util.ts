import type { TopicLinkRow } from "@/lib/repos/reports";

import type { GradedResponse } from "./grade.util";

/**
 * Pure. Per topic, via `question_topics` (PLAN §8).
 *
 * Topics apply across every template, so a topic's gradeable set can mix
 * `which_principle` and `rank_variants` responses. That is the plan's
 * explicit design (§8: "rank_variants contributes to the topic axis only"),
 * not an oversight — `rank_variants` grading is exact-match at 1-in-24, so a
 * topic that happens to be all rank_variants questions will read low. This
 * is a topic's correct-rate, not "the rank_variants score" rendered as a
 * headline (the thing the plan forbids), so it stays in.
 */
export type TopicRow = {
  slug: string;
  label: string;
  correct: number;
  total: number;
};

export function buildTopicRows(
  graded: GradedResponse[],
  links: TopicLinkRow[],
): TopicRow[] {
  const labelBySlug = new Map<string, string>();
  const questionIdsBySlug = new Map<string, Set<string>>();

  for (const link of links) {
    labelBySlug.set(link.slug, link.label);
    const set = questionIdsBySlug.get(link.slug) ?? new Set<string>();
    set.add(link.questionId);
    questionIdsBySlug.set(link.slug, set);
  }

  const rows: TopicRow[] = [];

  for (const [slug, questionIds] of questionIdsBySlug) {
    // Skip grade === null entirely — never count it as wrong (PLAN §8).
    const gradeable = graded.filter(
      (g) => questionIds.has(g.questionId) && g.grade !== null,
    );
    if (gradeable.length === 0) continue;

    rows.push({
      slug,
      label: labelBySlug.get(slug) ?? slug,
      correct: gradeable.filter((g) => g.grade === 1).length,
      total: gradeable.length,
    });
  }

  return rows.sort((a, b) => a.label.localeCompare(b.label));
}
