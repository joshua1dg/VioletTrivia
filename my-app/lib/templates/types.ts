/**
 * Shapes for the three question templates — the barrel.
 *
 * The shapes themselves are zod schemas now, one per template in
 * `<template>/schema.ts`, with the shared pieces in `common.ts`. The types
 * below are INFERRED from those schemas, so there is one definition rather
 * than two and the runtime check and the compile-time type cannot drift.
 *
 * This file re-exports those inferred types plus the prop contracts, which
 * have no runtime representation and so stay plain TypeScript. Every exported
 * name is unchanged from before the zod move, so no other file changes its
 * imports.
 *
 * Need the SCHEMA rather than the type? Import it from
 * `@/lib/templates/<template>/schema` or `@/lib/templates/common`, or reach
 * for `registry[key].parse` when the template is only known at runtime.
 * Nothing in this folder may import `server-only` — client forms validate
 * against these same modules (PLAN §5.7).
 */

export type {
  Answer,
  CommonContent,
  TemplateKey,
  Turn,
} from "./common";

export type {
  WhichPrincipleContent,
  WhichPrincipleContentHydrated,
  WhichPrincipleContentStored,
  WhichPrincipleKey,
} from "./which-principle/schema";

export type {
  RankVariantsContent,
  RankVariantsContentHydrated,
  RankVariantsContentStored,
  RankVariantsKey,
} from "./rank-variants/schema";

export type {
  WriteFeedbackContent,
  WriteFeedbackContentHydrated,
  WriteFeedbackContentStored,
  WriteFeedbackKey,
} from "./write-feedback/schema";

import type { Answer } from "./common";

/* ------------------------------------------------------------------ *
 * Tallies
 *
 * The distribution behind a reveal or a presenter screen: how the room
 * answered, as bars. Deliberately presentational-agnostic — a row is a label,
 * a count and a tone, and the component decides what a bar looks like.
 *
 * `tone` is optional and neutral when absent. `ok` marks the key, `bad` marks
 * a genuinely wrong pick. Rank positions use neither for the non-key rows:
 * exact-match ranking is 1-in-24 by chance, and colouring three of four rows
 * red at every position would read as everyone failing (README).
 * ------------------------------------------------------------------ */

export type TallyRow = {
  label: string;
  votes: number;
  tone?: "ok" | "bad" | "muted";
};

export type TallyGroup = {
  /** Omitted when there is only one group and the screen supplies the heading. */
  title?: string;
  rows: TallyRow[];
};

/* ------------------------------------------------------------------ *
 * The component contract
 *
 * Every template's Review and Reveal take exactly these props — only the
 * content and answer-key types vary. Annotating each component with these
 * makes the uniformity a compile error to break, rather than a convention
 * someone has to remember, and it is what the registry holds.
 *
 * `C` here is always the HYDRATED content (PLAN §5.12) — components never see
 * the stored shape.
 * ------------------------------------------------------------------ */

export type ReviewProps<C> = {
  content: C;
  prompt: string;
  answer: Answer;
  onAnswer: (next: Answer) => void;
};

export type RevealProps<C, K> = {
  content: C;
  answerKey: K;
  answer: Answer;
};

/** Reference data an authoring form needs but doesn't own. */
export type PrincipleOption = {
  code: string;
  name: string;
  descriptor?: string;
};

/**
 * The admin form. Same shape for every template — it edits `content` and
 * `answerKey` and hands both back. The answer key is edited alongside the
 * question rather than in a separate step, because for these templates the
 * key IS a property of an option ("this is the right one, and here's why").
 */
export type AuthorProps<C, K> = {
  content: C;
  answerKey: K;
  onContent: (next: C) => void;
  onAnswerKey: (next: K) => void;
  principles: PrincipleOption[];
};
