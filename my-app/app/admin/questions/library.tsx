"use client";

import { useState } from "react";
import { Chip, StatusPill, Tag } from "@/components/admin/ui";
import { TEMPLATE_LABEL, type QuestionRow, type Topic } from "@/lib/admin/fixtures";
import type { TemplateKey } from "@/lib/templates/types";

/**
 * The filters are split into two rows rather than the design's single chip
 * strip. That strip mixed a topic filter ("All topics") with type filters
 * ("Aligned / Misaligned", "Compare two"), which only reads as one control
 * while there are two types. With three templates and a growing topic list
 * they're clearly two different questions.
 */
export function QuestionLibrary({
  questions,
  topics,
}: {
  questions: QuestionRow[];
  topics: Topic[];
}) {
  const [topic, setTopic] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateKey | null>(null);
  const [search, setSearch] = useState("");

  const visible = questions.filter((q) => {
    if (topic && !q.topics.includes(topic)) return false;
    if (template && q.template !== template) return false;
    return !(search && !q.excerpt.toLowerCase().includes(search.toLowerCase()));

  });

  const templateKeys = Object.keys(TEMPLATE_LABEL) as TemplateKey[];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3 border-b border-line-2 px-6 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-14 text-[11.5px] tracking-[0.04em] text-faint">
            TOPIC
          </span>
          <Chip active={topic === null} onClick={() => setTopic(null)}>
            All topics
          </Chip>
          {topics.map((t) => (
            <Chip
              key={t.slug}
              active={topic === t.slug}
              onClick={() => setTopic(topic === t.slug ? null : t.slug)}
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
              {TEMPLATE_LABEL[key]}
            </Chip>
          ))}
          <div className="ml-auto flex items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search excerpts"
              className="w-[200px] rounded-[7px] border border-line px-3 py-1.5 text-[13px] text-ink-4 outline-none focus:border-violet-line"
            />
            <span className="text-[12.5px] whitespace-nowrap text-muted-3">
              Sorted by updated
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_180px_140px_150px_96px_84px] gap-0 border-b border-line-2 px-6 py-2.5 text-[11.5px] tracking-[0.04em] text-faint">
        <span>EXCERPT</span>
        <span>TOPIC</span>
        <span>TYPE</span>
        <span>PRINCIPLES</span>
        <span>RESPONSES</span>
        <span>STATUS</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {visible.map((q) => (
          <div
            key={q.id}
            className="grid grid-cols-[1fr_180px_140px_150px_96px_84px] items-center gap-0 border-b border-line-3 px-6 py-3.5 transition-colors hover:bg-surface"
          >
            <span className="truncate pr-5 text-[13.5px] text-ink-3">
              {q.excerpt}
            </span>
            <span className="flex flex-wrap gap-1">
              {q.topics.map((slug) => (
                <Tag key={slug}>
                  {topics.find((t) => t.slug === slug)?.label ?? slug}
                </Tag>
              ))}
            </span>
            <span className="text-[12.5px] text-muted-2">
              {TEMPLATE_LABEL[q.template]}
            </span>
            <span className="flex flex-wrap gap-1 font-mono text-[11.5px] text-muted">
              {q.principles.map((code) => (
                <span key={code}>{code}</span>
              ))}
            </span>
            <span className="text-[12.5px] text-muted-2 tabular-nums">
              {q.responses}
            </span>
            <StatusPill status={q.status} />
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
