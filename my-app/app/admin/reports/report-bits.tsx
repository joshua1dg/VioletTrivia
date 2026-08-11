import Link from "next/link";

import type { QuestionStatRow } from "@/lib/services/reports";
import { registry } from "@/lib/templates/registry";
import type { TallyGroup } from "@/lib/templates/types";

// No "use client" — presentational, no hooks, same reasoning as
// `score-bar.tsx` beside it. Shared bits for the entity report pages
// (question / topic / principle), which all live in other route folders
// but render the same two shapes: an answer distribution, and a table of
// per-question stats that links through to each question's own report.

/**
 * An answer distribution, from `registry[t].tally` — the same data the
 * presenter projects, restyled for the light admin theme. Bars are share
 * of the group's answers; the key's row fills violet, wrong-by-definition
 * rows (which_principle's `bad`) fill in the red tone, neutral rows stay
 * grey.
 */
export function TallyBars({ groups }: { groups: TallyGroup[] }) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group, index) => {
        const total = group.rows.reduce((sum, row) => sum + row.votes, 0);
        return (
          <div key={index} className="flex flex-col gap-1">
            {group.title && (
              <span className="text-[11.5px] tracking-[0.04em] text-faint">
                {group.title.toUpperCase()}
              </span>
            )}
            {group.rows.map((row) => {
              const pct = total > 0 ? Math.round((row.votes / total) * 100) : 0;
              const fill =
                row.tone === "ok"
                  ? "bg-violet"
                  : row.tone === "bad"
                    ? "bg-bad/60"
                    : "bg-faint-2";
              return (
                <div key={row.label} className="flex items-center gap-3 py-0.5">
                  <span className="w-56 shrink-0 truncate text-[12.5px] text-ink-4">
                    {row.label}
                  </span>
                  <div className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-line-3">
                    <div
                      className={`h-full rounded-full ${fill}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-[12.5px] tabular-nums text-muted-2">
                    {row.votes}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/** Per-question stats, each row linking through to that question's report. */
export function QuestionStatTable({ rows }: { rows: QuestionStatRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-[13px] text-muted-3">No questions here yet.</p>
    );
  }

  return (
    <div className="overflow-hidden rounded-[10px] border border-line">
      <div className="grid grid-cols-[1fr_170px_110px_110px] items-center gap-0 border-b border-line-2 bg-surface px-4 py-2.5 text-[11.5px] tracking-[0.04em] text-faint">
        <span>QUESTION</span>
        <span>TYPE</span>
        <span>ANSWERS</span>
        <span>CORRECT</span>
      </div>
      {rows.map((row) => (
        <Link
          key={row.id}
          href={`/admin/questions/${row.id}/report`}
          className="grid grid-cols-[1fr_170px_110px_110px] items-center gap-0 border-b border-line-3 px-4 py-3 transition-colors last:border-b-0 hover:bg-surface"
        >
          <span className="truncate pr-4 text-[13px] text-ink-3">
            {row.prompt}
          </span>
          <span className="text-[12.5px] text-muted-2">
            {registry[row.template].label}
          </span>
          <span className="text-[12.5px] text-muted-2 tabular-nums">
            {row.responseCount}
          </span>
          <span className="text-[12.5px] text-muted-2 tabular-nums">
            {row.total > 0 ? `${row.correct}/${row.total}` : "—"}
          </span>
        </Link>
      ))}
    </div>
  );
}

/** The one bordered action link every report header uses. */
export function HeaderLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-[8px] border border-line px-3.5 py-2 text-[13px] text-ink-4 transition-colors hover:bg-surface"
    >
      {children}
    </Link>
  );
}
