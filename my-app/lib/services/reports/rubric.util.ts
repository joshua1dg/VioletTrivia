import type { PrincipleLinkRow } from "@/lib/repos/reports";

import type { GradedResponse } from "./grade.util";

/**
 * Pure. Per rubric code, grouped by the KEY code — the code that was the
 * answer — not by every code that appeared as an option.
 *
 * That distinction is the whole meaning of the row. Grouping by
 * `question_principles` (every in-play code) made one wrong answer debit
 * four codes at once, three of which were only distractors — a
 * one-participant report lit up six codes red off two answers (the
 * 2026-08-11 report confusion). "3/5 on C2" now means: of the five answers
 * given to questions whose ANSWER was C2, three found it.
 */
export type RubricRow = {
  code: string;
  name: string;
  /** x/y — found the key, out of answers to questions keyed to this code. */
  correct: number;
  total: number;
  /** What was picked instead, when missed — the confusion signal. */
  mostPickedWrong: { code: string; name: string; count: number } | null;
};

export function buildRubricRows(
  graded: GradedResponse[],
  links: PrincipleLinkRow[],
): RubricRow[] {
  // The links still supply the display names (the key code is always among
  // a question's in-play links); grouping no longer uses them.
  const nameByCode = new Map<string, string>();
  for (const link of links) nameByCode.set(link.code, link.name);

  const byKeyCode = new Map<string, GradedResponse[]>();
  for (const g of graded) {
    // Only which_principle responses carry a key code; grade === null never
    // counts (PLAN §8).
    if (g.keyCode === null || g.grade === null) continue;
    const list = byKeyCode.get(g.keyCode) ?? [];
    list.push(g);
    byKeyCode.set(g.keyCode, list);
  }

  const rows: RubricRow[] = [];

  for (const [code, responses] of byKeyCode) {
    const correct = responses.filter((g) => g.grade === 1).length;

    const wrongPicks = responses
      .filter((g) => g.grade === 0)
      .map((g) => g.pickedWrongCode)
      .filter((picked): picked is string => picked !== null);

    rows.push({
      code,
      name: nameByCode.get(code) ?? code,
      correct,
      total: responses.length,
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
