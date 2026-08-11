"use client";

import { useState } from "react";
import Link from "next/link";
import { Chip, StatusPill, Tag } from "@/components/admin/ui";
import { registry, templateKeys } from "@/lib/templates/registry";
import type { TemplateKey } from "@/lib/templates/types";
import type { QuestionSummary } from "@/lib/services/questions";
import type { Topic } from "@/lib/services/topics";

/**
 * The filters are split into two rows rather than the design's single chip
 * strip. That strip mixed a topic filter ("All topics") with type filters
 * ("Aligned / Misaligned", "Compare two"), which only reads as one control
 * while there are two types. With three templates and a growing topic list
 * they're clearly two different questions.
 *
 * Client-side filtering of the already-fetched list — the existing
 * behaviour, kept as-is per the brief. Archive/delete live on the detail
 * screen (`/admin/questions/[id]`) rather than per row, so a row here is
 * just a link.
 */
export function QuestionLibrary({
  questions,
  topics,
  initialTopicId = null,
}: {
  questions: QuestionSummary[];
  topics: Topic[];
  /** Preselects the topic chip — `/admin/questions?topic=<slug>`, resolved
   * by the page. The topics screen links through per topic. */
  initialTopicId?: string | null;
}) {
  const [topicId, setTopicId] = useState<string | null>(initialTopicId);
  const [template, setTemplate] = useState<TemplateKey | null>(null);
  const [search, setSearch] = useState("");

  const visible = questions.filter((q) => {
    if (topicId && !q.topicIds.includes(topicId)) return false;
    if (template && q.template !== template) return false;
    return !(search && !q.excerpt.toLowerCase().includes(search.toLowerCase()));
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3 border-b border-line-2 px-6 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-14 text-[11.5px] tracking-[0.04em] text-faint">
            TOPIC
          </span>
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

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-14 text-[11.5px] tracking-[0.04em] text-faint">
            TYPE
          </span>
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
          <div className="ml-auto flex items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search excerpts"
              className="w-50 rounded-[7px] border border-line px-3 py-1.5 text-[13px] text-ink-4 outline-none"
            />
            <span className="text-[12.5px] whitespace-nowrap text-muted-3">
              Sorted by updated
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_180px_140px_150px_96px_84px_56px] gap-0 border-b border-line-2 px-6 py-2.5 text-[11.5px] tracking-[0.04em] text-faint">
        <span>EXCERPT</span>
        <span>TOPIC</span>
        <span>TYPE</span>
        <span>PRINCIPLES</span>
        <span>RESPONSES</span>
        <span>STATUS</span>
        <span />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {visible.map((q) => (
          // The row goes to the question's REPORT; editing is the explicit
          // button (2026-08-11: "everything goes to a report"). A stretched
          // overlay link rather than wrapping the row in <Link>, because an
          // Edit <a> nested inside a row <a> is invalid HTML — the overlay
          // covers the row and the Edit link sits above it on z-index.
          <div
            key={q.id}
            className="relative grid grid-cols-[1fr_180px_140px_150px_96px_84px_56px] items-center gap-0 border-b border-line-3 px-6 py-3.5 transition-colors hover:bg-surface"
          >
            <span className="truncate pr-5 text-[13.5px] text-ink-3">
              {q.excerpt}
            </span>
            <span className="flex flex-wrap gap-1">
              {q.topicIds.map((id) => (
                <Tag key={id}>
                  {topics.find((t) => t.id === id)?.label ?? id}
                </Tag>
              ))}
            </span>
            <span className="text-[12.5px] text-muted-2">{q.templateLabel}</span>
            <span className="flex flex-wrap gap-1 font-mono text-[11.5px] text-muted">
              {q.principleCodes.map((code) => (
                <span key={code}>{code}</span>
              ))}
            </span>
            <span className="text-[12.5px] text-muted-2 tabular-nums">
              {q.responseCount}
            </span>
            <StatusPill status={q.status} />
            <Link
              href={`/admin/questions/${q.id}/report`}
              aria-label={`Report for: ${q.excerpt}`}
              className="absolute inset-0"
            />
            <Link
              href={`/admin/questions/${q.id}`}
              className="relative z-10 justify-self-end rounded-[6px] border border-line px-2 py-1 text-[12px] text-ink-4 transition-colors hover:bg-white"
            >
              Edit
            </Link>
          </div>
        ))}

        {visible.length === 0 && (
          <p className="px-6 py-10 text-[13.5px] text-muted-3">
            Nothing matches those filters.
          </p>
        )}
      </div>
    </div>
  );
}
