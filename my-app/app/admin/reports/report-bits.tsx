import Link from "next/link";

import type { QuestionStatRow } from "@/lib/services/reports";
import { registry } from "@/lib/templates/registry";
import type { TallyGroup } from "@/lib/templates/types";

import { ScoreBar } from "./score-bar";

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

/**
 * Per-question stats, each row linking through to that question's report.
 * `podRows` adds a fifth column with that same question's pod-scoped
 * correct/total (topic and principle reports only — cheap since the pod
 * grading already happened for the overall number beside this table).
 * Omitted entirely — not a column of zeros — when there's no pod to show.
 */
export function QuestionStatTable({
  rows,
  podRows,
  podLabel,
}: {
  rows: QuestionStatRow[];
  podRows?: QuestionStatRow[];
  podLabel?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-[13px] text-muted-3">No questions here yet.</p>
    );
  }

  const podById = new Map((podRows ?? []).map((row) => [row.id, row]));
  const showPod = podRows !== undefined;
  const columns = showPod
    ? "grid-cols-[1fr_150px_100px_100px_100px]"
    : "grid-cols-[1fr_170px_110px_110px]";

  return (
    <div className="overflow-hidden rounded-[10px] border border-line">
      <div
        className={`grid ${columns} items-center gap-0 border-b border-line-2 bg-surface px-4 py-2.5 text-[11.5px] tracking-[0.04em] text-faint`}
      >
        <span>QUESTION</span>
        <span>TYPE</span>
        <span>ANSWERS</span>
        <span>CORRECT</span>
        {showPod && (
          <span className="font-medium text-violet-ink">
            {(podLabel ?? "POD").toUpperCase()}
          </span>
        )}
      </div>
      {rows.map((row) => {
        const pod = podById.get(row.id);
        return (
          <Link
            key={row.id}
            href={`/admin/questions/${row.id}/report`}
            className={`grid ${columns} items-center gap-0 border-b border-line-3 px-4 py-3 transition-colors last:border-b-0 hover:bg-surface`}
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
            {showPod && (
              <span className="text-[12.5px] text-muted-3 tabular-nums">
                {pod && pod.total > 0 ? `${pod.correct}/${pod.total}` : "—"}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * All pods over this page's answers, best rate first — the "how are the
 * pods doing against each other" view for full-scope viewers (2026-08-11).
 * The service returns null for pod leads, so this simply never renders for
 * them. Where the page supports `?pod=` (org dashboard, batch report),
 * `basePath` makes each row a door into that pod's full single-pod view.
 */
export function PodBreakdownList({
  rows,
  basePath,
}: {
  rows: {
    podId: string;
    label: string;
    responseCount: number;
    correct: number;
    total: number;
  }[];
  basePath?: string;
}) {
  return (
    <div className="flex flex-col">
      {rows.map((row) => {
        const bar = (
          <ScoreBar
            label={row.label}
            correct={row.correct}
            total={row.total}
            note={`${row.responseCount} answer${row.responseCount === 1 ? "" : "s"}`}
          />
        );
        return basePath ? (
          <Link
            key={row.podId}
            href={`${basePath}?pod=${row.podId}`}
            className="-mx-2 rounded-[8px] px-2 transition-colors hover:bg-surface"
          >
            {bar}
          </Link>
        ) : (
          <div key={row.podId}>{bar}</div>
        );
      })}
    </div>
  );
}

/**
 * The pod filter for DOLs/admins on the org dashboard and batch
 * report (PODS.md: "sliceable by pod") — server-driven via `?pod=`, same
 * pattern as `/admin/questions?topic=`. A pod lead never sees this; their
 * own scope is always what the service returns, regardless of the URL.
 */
export function PodSelector({
  options,
  activePodId,
  basePath,
}: {
  options: { userId: string; label: string }[];
  activePodId: string | null;
  basePath: string;
}) {
  if (options.length === 0) return null;

  const chip = (href: string, active: boolean, text: string) => (
    <Link
      key={href}
      href={href}
      className={`rounded-[7px] border px-2.5 py-1 text-[12.5px] transition-colors ${
        active
          ? "border-violet-line-2 bg-violet-tint-3 text-violet-ink"
          : "border-line bg-surface text-ink-4 hover:border-faint-2 hover:bg-white"
      }`}
    >
      {text}
    </Link>
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11.5px] tracking-[0.04em] text-faint">POD</span>
      {/* Explicit sentinel, not the bare path: with no ?pod= the service
          now defaults a full-scope viewer to their OWN slice (a project
          lead who runs a pod sees it like a pod lead would), so "no pod"
          has to be said out loud. */}
      {chip(`${basePath}?pod=project`, activePodId === null, "Project only")}
      {options.map((opt) =>
        chip(
          `${basePath}?pod=${opt.userId}`,
          activePodId === opt.userId,
          opt.label,
        ),
      )}
    </div>
  );
}

/**
 * A row of linked chips — the report pages' relation strips ("Appears in",
 * topics, codes). Every fact on a report is a link to that fact's own
 * report (2026-08-11); these are how the flat facts render.
 */
export function LinkChips({
  label,
  items,
}: {
  label: string;
  items: { href: string; text: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11.5px] tracking-[0.04em] text-faint">
        {label.toUpperCase()}
      </span>
      {items.map((item) => (
        <Link
          key={item.href + item.text}
          href={item.href}
          className="rounded-[7px] border border-line bg-surface px-2.5 py-1 text-[12.5px] text-ink-4 transition-colors hover:border-faint-2 hover:bg-white"
        >
          {item.text}
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
