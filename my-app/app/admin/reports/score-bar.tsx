import type { ReactNode } from "react";

// No "use client" — presentational, no hooks (same reasoning as
// components/admin/ui.tsx and components/feedback/empty-state.tsx). Reports
// are read-only end to end, so this is the one new primitive this screen
// needs: a plain div bar off the existing token palette (PLAN §8 — "no chart
// library, this does not need one").

/**
 * A correct-rate bar: label, fill proportional to correct/total, and the
 * "x/y" count written out rather than left to the fill alone — the plan is
 * explicit that a bare percentage for `rank_variants` reads as "everyone
 * failed," so the raw counts stay visible next to every bar, not just that
 * one template's.
 */
export function ScoreBar({
  label,
  correct,
  total,
  note,
}: {
  label: string;
  correct: number;
  total: number;
  /** e.g. "most-picked wrong: C1" — only meaningful for which_principle rows. */
  note?: ReactNode;
}) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="flex flex-wrap items-center gap-3 py-2">
      <span className="w-44 shrink-0 truncate text-[13px] text-ink-3">
        {label}
      </span>
      <div className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-line-3">
        <div
          className="h-full rounded-full bg-violet"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-14 shrink-0 text-right text-[12.5px] tabular-nums text-muted-2">
        {correct}/{total}
      </span>
      {note && (
        <span className="shrink-0 text-[12px] text-muted-3">{note}</span>
      )}
    </div>
  );
}
