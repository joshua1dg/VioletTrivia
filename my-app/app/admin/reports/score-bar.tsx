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
  variant = "default",
}: {
  label: string;
  correct: number;
  total: number;
  /** e.g. "most-picked wrong: C1" — only meaningful for which_principle rows. */
  note?: ReactNode;
  /** "pod" renders as the smaller, muted second line under a `ScoreBarPair`
   *  — visually secondary, per PODS.md's "pod slice visually second is
   *  fine." */
  variant?: "default" | "pod";
}) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const pod = variant === "pod";

  return (
    <div
      className={`flex flex-wrap items-center gap-3 ${
        pod
          ? "border-l-2 border-violet-line-2 py-0.5 pl-3"
          : "py-2"
      }`}
    >
      <span
        className={`shrink-0 truncate ${pod ? "w-40 text-[12px] text-violet-ink" : "w-44 text-[13px] text-ink-3"}`}
      >
        {label}
      </span>
      <div className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-line-3">
        <div
          className={`h-full rounded-full ${pod ? "bg-violet/50" : "bg-violet"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`w-14 shrink-0 text-right tabular-nums ${pod ? "text-[12px] text-muted-3" : "text-[12.5px] text-muted-2"}`}
      >
        {correct}/{total}
      </span>
      {note && (
        <span className="shrink-0 text-[12px] text-muted-3">{note}</span>
      )}
    </div>
  );
}

/**
 * A rubric/topic row with its pod comparison folded in — the project bar
 * as always, plus a smaller pod line underneath when there's pod data for
 * THIS row. `pod` omitted (or its `total` zero) falls back to the plain
 * project-only bar — never a zero bar standing in for "no data."
 */
export function ScoreBarPair({
  label,
  project,
  pod,
  note,
}: {
  label: string;
  project: { correct: number; total: number };
  pod?: { label: string; correct: number; total: number } | null;
  note?: ReactNode;
}) {
  if (!pod || pod.total === 0) {
    return (
      <ScoreBar
        label={label}
        correct={project.correct}
        total={project.total}
        note={note}
      />
    );
  }

  return (
    <div className="flex flex-col">
      <ScoreBar
        label={label}
        correct={project.correct}
        total={project.total}
        note={note}
      />
      <ScoreBar
        label={pod.label}
        correct={pod.correct}
        total={pod.total}
        variant="pod"
      />
    </div>
  );
}
