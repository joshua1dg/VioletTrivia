/**
 * Shapes for the three question templates.
 *
 * These mirror the CONTENT / ANSWER KEY sketches in the init migration. They
 * are plain TypeScript for now; when we wire the database these become zod
 * schemas and these types get inferred from them, so there is one definition
 * rather than two. Nothing here is validated at runtime yet.
 */

export type TemplateKey = "which_principle" | "rank_variants" | "best_feedback";

/**
 * One turn of the excerpt being judged.
 *
 * `body` is light markdown — lines starting with "- " render as bullets and
 * `backticks` render as code. T3's assistant turns need bullets, and letting
 * the author write markdown beats inventing a nested structure for it.
 */
export type Turn = {
  role: "user" | "assistant";
  body: string;
  meta?: string; // "1 sentence · turn 3"
};

/* ------------------------------------------------------------------ *
 * T1 — which_principle
 * ------------------------------------------------------------------ */

/**
 * Note `inPlay` carries name and descriptor inline. In the real app those
 * come from the principles table via a join on `code` — the author only ever
 * references codes. They are inlined here so fixtures can render standalone.
 */
export type WhichPrincipleContent = {
  turns: Turn[];
  inPlay: { code: string; name: string; descriptor: string }[];
  options: { id: string; principleCode: string; subtext: string }[];
  footerHint?: string;
};

export type WhichPrincipleKey = {
  key: string;
  /** Paragraphs per option — the winner and the "not the issue here" one. */
  perOption: Record<string, string[]>;
  distinguish?: { title: string; body: string };
  summary?: string;
};

/* ------------------------------------------------------------------ *
 * T3 — best_feedback
 * ------------------------------------------------------------------ */

/** A rubric call the fellow made, and whether it holds up. */
export type RubricCall = { code: string; verdict: "ok" | "wrong" };

export type BestFeedbackContent = {
  turns: Turn[];
  subject: { rationale: string; calls: RubricCall[] };
  options: { id: string; body: string }[];
  footerHint?: string;
};

export type BestFeedbackKey = {
  key: string;
  /** "What makes it strong" — label plus the reason. */
  bullets: { label: string; detail: string }[];
};

/* ------------------------------------------------------------------ *
 * Answers
 * ------------------------------------------------------------------ */

/** What a participant submits. `order` belongs to rank_variants, built later. */
export type Answer = { option?: string; order?: string[] };

export type TallyRow = { label: string; votes: number; tone?: "ok" | "bad" | "muted" };
export type TallyGroup = { title?: string; rows: TallyRow[] };
