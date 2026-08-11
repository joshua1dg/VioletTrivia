"use client";

// "use client" because it takes a click handler (onToggle) as a prop and now
// owns the view-filter state below. Colocated beside `composer.tsx`, which
// owns the SELECTION state — the split matters: filters narrow what is
// VISIBLE, never what is selected, so a tick made under one filter survives
// switching to another.

import { useState } from "react";

import { Chip } from "@/components/admin/ui";
import type { QuestionSummary } from "@/lib/services/questions";
import type { Topic } from "@/lib/services/topics";
import { registry, templateKeys } from "@/lib/templates/registry";
import type { TemplateKey } from "@/lib/templates/types";

/**
 * The middle column: every question in the library, tick-box selection,
 * filterable by topic / template / excerpt search — the same three controls
 * as `/admin/questions` (`app/admin/questions/library.tsx`), compacted for
 * a column. Answer keys never appear here — `QuestionSummary` (from
 * `listQuestionSummaries`) has no `answerKey` property to reach for, same
 * structural guarantee as the reviewer/author split (PLAN §5.10).
 */
export function QuestionLibraryPanel({
  library,
  topics,
  selectedIds,
  onToggle,
}: {
  library: QuestionSummary[];
  topics: Topic[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [topicId, setTopicId] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateKey | null>(null);
  const [search, setSearch] = useState("");

  const visible = library.filter((q) => {
    if (topicId && !q.topicIds.includes(topicId)) return false;
    if (template && q.template !== template) return false;
    return !(search && !q.excerpt.toLowerCase().includes(search.toLowerCase()));
  });

  const filtered = visible.length !== library.length;

  return (
    <div className="flex min-w-0 flex-1 flex-col border-r border-line-2">
      <div className="border-b border-line-2 px-5 py-3 text-[11.5px] tracking-[0.04em] text-faint">
        QUESTION LIBRARY · {selectedIds.size} selected of {library.length}
        {filtered && ` · showing ${visible.length}`}
      </div>

      <div className="flex flex-col gap-2 border-b border-line-2 px-5 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip active={topicId === null} onClick={() => setTopicId(null)}>
            All topics
          </Chip>
          {topics.map((t) => (
            <Chip
              key={t.id}
              active={topicId === t.id}
              onClick={() => setTopicId(topicId === t.id ? null : t.id)}
            >
              {t.label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip active={template === null} onClick={() => setTemplate(null)}>
            All types
          </Chip>
          {templateKeys.map((key) => (
            <Chip
              key={key}
              active={template === key}
              onClick={() => setTemplate(template === key ? null : key)}
            >
              {registry[key].label}
            </Chip>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search excerpts"
          className="rounded-[7px] border border-line px-3 py-1.5 text-[13px] text-ink-4 outline-none"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {visible.map((q) => (
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

        {visible.length === 0 && (
          <p className="px-5 py-10 text-[13px] text-muted-3">
            {library.length === 0
              ? "No questions in the library yet."
              : "Nothing matches those filters."}
          </p>
        )}
      </div>
    </div>
  );
}
