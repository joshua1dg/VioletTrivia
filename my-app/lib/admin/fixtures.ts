import type { TemplateKey } from "@/lib/templates/types";

/**
 * Stand-in data for the admin screens, same role the template fixtures play:
 * throwaway values, load-bearing shapes. These become database reads.
 */

export const TEMPLATE_LABEL: Record<TemplateKey, string> = {
  which_principle: "Principles",
  rank_variants: "Rank replies",
  best_feedback: "Best feedback",
};

export type QuestionStatus = "draft" | "live" | "archived";

export type QuestionRow = {
  id: string;
  /** Derived from content in the real thing — first turn, truncated. */
  excerpt: string;
  template: TemplateKey;
  topics: string[]; // slugs
  principles: string[]; // codes
  responses: number;
  status: QuestionStatus;
  updatedAt: string;
};

/**
 * PLACEHOLDER. The design's topic list (overclaiming, sycophancy, hedging…)
 * was really a list of failure modes, which is the principles axis. Topics
 * are the shape of the situation — why the question is worth asking — so
 * these follow that framing until you supply the real vocabulary.
 */
export type Topic = { slug: string; label: string; sortOrder: number };

export const topics: Topic[] = [
  { slug: "common-confusion", label: "Common confusion", sortOrder: 10 },
  { slug: "edge-case", label: "Edge case", sortOrder: 20 },
  { slug: "clear-cut", label: "Clear-cut", sortOrder: 30 },
  { slug: "contested", label: "Contested", sortOrder: 40 },
];

/**
 * The rubric. Only S1, S2, C1 and I1 have real text — those are the ones the
 * design docs actually define. I3 and S3 appear as chips on the T3 example
 * with no description anywhere, so they're here incomplete on purpose: the
 * Principles screen should show you what still needs writing.
 */
export type Principle = {
  code: string;
  name: string;
  descriptor?: string;
  description?: string;
  sortOrder: number;
  active: boolean;
};

export const principles: Principle[] = [
  {
    code: "S1",
    name: "Simple and scannable",
    descriptor:
      "One signal per sentence, so the reader can take it in at a glance.",
    description:
      "Every signal is present but the shape costs the reader. Failure looks like one sentence carrying an action, two destinations, a rationale, and a leftover responsibility.",
    sortOrder: 10,
    active: true,
  },
  {
    code: "S2",
    name: "No named tics",
    descriptor: "Sycophantic openers, template headers, emoji.",
    description:
      "Covers the specific named mannerisms. Structural clutter such as nested bullets is NOT S2 — scan cost is S1.",
    sortOrder: 20,
    active: true,
  },
  { code: "S3", name: "", sortOrder: 30, active: true },
  {
    code: "C1",
    name: "Effective communication",
    descriptor:
      "Acknowledge, state the change, say what it leaves behind — in that order.",
    description:
      "Fails when the message does not land at all: the reader cannot tell what was agreed, what changed, or what happens next. If they can tell but it costs a re-read, that is S1.",
    sortOrder: 40,
    active: true,
  },
  {
    code: "I1",
    name: "Adapts to the task at hand",
    descriptor: "Understand what the user needs and communicate exactly that.",
    sortOrder: 50,
    active: true,
  },
  { code: "I3", name: "", sortOrder: 60, active: true },
];

export const questions: QuestionRow[] = [
  {
    id: "q1",
    excerpt: "the translation strings shouldn't be sitting in App.vue",
    template: "which_principle",
    topics: ["common-confusion"],
    principles: ["S1", "C1"],
    responses: 17,
    status: "live",
    updatedAt: "2026-08-04",
  },
  {
    id: "q2",
    excerpt: "why is the build failing on my branch?",
    template: "best_feedback",
    topics: ["edge-case"],
    principles: ["I3", "S3", "S1"],
    responses: 17,
    status: "live",
    updatedAt: "2026-08-04",
  },
  {
    id: "q3",
    excerpt: "the translation strings shouldn't be sitting in App.vue",
    template: "rank_variants",
    topics: ["contested"],
    principles: ["S1", "C1"],
    responses: 17,
    status: "live",
    updatedAt: "2026-08-03",
  },
  {
    id: "q4",
    excerpt: "can you get the CI failure sorted before standup?",
    template: "which_principle",
    topics: ["common-confusion", "contested"],
    principles: ["C1"],
    responses: 0,
    status: "draft",
    updatedAt: "2026-08-02",
  },
  {
    id: "q5",
    excerpt: "the changelog badges look cramped, can you fix the spacing",
    template: "best_feedback",
    topics: ["edge-case"],
    principles: ["S1", "S2"],
    responses: 0,
    status: "draft",
    updatedAt: "2026-08-01",
  },
  {
    id: "q6",
    excerpt: "I've deleted the migration and rewritten it — should I have asked?",
    template: "rank_variants",
    topics: ["clear-cut"],
    principles: ["I1"],
    responses: 24,
    status: "archived",
    updatedAt: "2026-07-28",
  },
];

/** Counts shown beside each topic in the sidebar. */
export function topicCounts() {
  return topics.map((t) => ({
    ...t,
    count: questions.filter((q) => q.topics.includes(t.slug)).length,
  }));
}

export function principleUsage(code: string) {
  return questions.filter((q) => q.principles.includes(code)).length;
}
