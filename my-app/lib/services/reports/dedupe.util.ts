import type { ReportResponseRow } from "@/lib/repos/reports";

/**
 * Pure — no client, no io (PLAN §8's rule for this folder).
 *
 * One person can legitimately answer the same question more than once: once
 * async, and once per live session run off the batch (`responses_dedupe` is
 * per-channel, not per-question-per-person). For calibration those repeats
 * must not stack — and the FIRST answer is the honest signal, since any
 * later one may come after seeing the reveal.
 *
 * Rows are expected oldest-first (the repo orders by `created_at`), but this
 * sorts defensively rather than trusting the caller.
 */
export function dedupeToFirstAnswer(rows: ReportResponseRow[]): {
  rows: ReportResponseRow[];
  duplicateCount: number;
} {
  const ordered = [...rows].sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
  );

  const seen = new Set<string>();
  const first: ReportResponseRow[] = [];
  for (const row of ordered) {
    const pair = `${row.participantId}:${row.questionId}`;
    if (seen.has(pair)) continue;
    seen.add(pair);
    first.push(row);
  }

  return { rows: first, duplicateCount: rows.length - first.length };
}
