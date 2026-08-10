import type { PrincipleLinkRow } from "@/lib/repos/reports";

import type { GradedResponse } from "./grade.util";

/**
 * Pure. Per rubric code, via `question_principles` — the queryable relation
 * the migration built for exactly this (PLAN §8).
 */
export type RubricRow = {
  code: string;
  name: string;
  /** x/y — correct out of gradeable, never counting a `grade === null` response. */
  correct: number;
  total: number;
  /**
   * Only meaningful for `which_principle` (PLAN §8). `null` when this code's
   * gradeable responses have no wrong `which_principle` pick to point at —
   * in practice that's every code, since `rank_variants` and
   * `write_feedback` both derive `principleCodes() => []` (README/D9) and so
   * never appear in `question_principles` at all. Kept general anyway: if a
   * code's questions were ever a mix of templates, this is computed from the
   * `which_principle` answers only, per the brief.
   */
  mostPickedWrong: { code: string; name: string; count: number } | null;
};

export function buildRubricRows(
  graded: GradedResponse[],
  links: PrincipleLinkRow[],
): RubricRow[] {
  const nameByCode = new Map<string, string>();
  const questionIdsByCode = new Map<string, Set<string>>();

  for (const link of links) {
    nameByCode.set(link.code, link.name);
    const set = questionIdsByCode.get(link.code) ?? new Set<string>();
    set.add(link.questionId);
    questionIdsByCode.set(link.code, set);
  }

  const rows: RubricRow[] = [];

  for (const [code, questionIds] of questionIdsByCode) {
    // Skip grade === null entirely — never count it as wrong (PLAN §8).
    const gradeable = graded.filter(
      (g) => questionIds.has(g.questionId) && g.grade !== null,
    );
    if (gradeable.length === 0) continue; // nothing to show for this code yet

    const correct = gradeable.filter((g) => g.grade === 1).length;

    const wrongPicks = gradeable
      .filter((g) => g.template === "which_principle" && g.grade === 0)
      .map((g) => g.pickedWrongCode)
      .filter((picked): picked is string => picked !== null);

    rows.push({
      code,
      name: nameByCode.get(code) ?? code,
      correct,
      total: gradeable.length,
      mostPickedWrong: mostCommon(wrongPicks, nameByCode),
    });
  }

  return rows.sort((a, b) => a.code.localeCompare(b.code));
}

function mostCommon(
  codes: string[],
  nameByCode: Map<string, string>,
): { code: string; name: string; count: number } | null {
  if (codes.length === 0) return null;

  const counts = new Map<string, number>();
  for (const code of codes) counts.set(code, (counts.get(code) ?? 0) + 1);

  let winner: string | null = null;
  let max = 0;
  for (const [code, count] of counts) {
    if (count > max) {
      max = count;
      winner = code;
    }
  }
  if (winner === null) return null;

  return { code: winner, name: nameByCode.get(winner) ?? winner, count: max };
}
