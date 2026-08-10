"use client";

// "use client" because it takes a click handler (onToggle) as a prop — a
// presentational component that took only data could stay server-compatible,
// but this one is a controlled tick-box list, so it's a real leaf, not a
// boundary artifact. Colocated beside `composer.tsx`, which owns the state.

import type { QuestionSummary } from "@/lib/services/questions";

/**
 * The middle column: every question in the library, tick-box selection.
 * Answer keys never appear here — `QuestionSummary` (from
 * `listQuestionSummaries`) has no `answerKey` property to reach for, same
 * structural guarantee as the reviewer/author split (PLAN §5.10).
 */
export function QuestionLibraryPanel({
  library,
  selectedIds,
  onToggle,
}: {
  library: QuestionSummary[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col border-r border-line-2">
      <div className="border-b border-line-2 px-5 py-3 text-[11.5px] tracking-[0.04em] text-faint">
        QUESTION LIBRARY · {selectedIds.size} selected of {library.length}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {library.map((q) => (
          <label
            key={q.id}
            className="flex cursor-pointer items-start gap-3 border-b border-line-3 px-5 py-3 transition-colors hover:bg-surface"
          >
            <input
              type="checkbox"
              className="mt-1 cursor-pointer"
              checked={selectedIds.has(q.id)}
              onChange={() => onToggle(q.id)}
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] text-ink-3">
                {q.excerpt || q.prompt}
              </span>
              <span className="text-[12px] text-muted-3">
                {q.templateLabel} · {q.status} · {q.responseCount} response
                {q.responseCount === 1 ? "" : "s"}
              </span>
            </div>
          </label>
        ))}

        {library.length === 0 && (
          <p className="px-5 py-10 text-[13px] text-muted-3">
            No questions in the library yet.
          </p>
        )}
      </div>
    </div>
  );
}
