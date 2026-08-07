/**
 * Shapes for the three question templates.
 *
 * These mirror the CONTENT / ANSWER KEY sketches in the init migration. They
 * are plain TypeScript for now; when we wire the database these become zod
 * schemas and these types get inferred from them, so there is one definition
 * rather than two. Nothing here is validated at runtime yet.
 */

export type TemplateKey = "which_principle" | "rank_variants" | "write_feedback";

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

/**
 * Carried by every template's content, so it lives here rather than being
 * repeated three times.
 */
export type CommonContent = {
  /** Footer line under the action button. */
  footerHint?: string;
  /**
   * Label for the optional "Why?" note. Omit and the field doesn't render.
   * It maps to responses.rationale, which every template offers, so the flow
   * renders it — not the template body.
   */
  notePrompt?: string;
};

/* ------------------------------------------------------------------ *
 * T1 — which_principle
 * ------------------------------------------------------------------ */

/**
 * Note `inPlay` carries name and descriptor inline. In the real app those
 * come from the principles table via a join on `code` — the author only ever
 * references codes. They are inlined here so fixtures can render standalone.
 */
export type WhichPrincipleContent = CommonContent & {
  turns: Turn[];
  inPlay: { code: string; name: string; descriptor: string }[];
  options: { id: string; principleCode: string; subtext: string }[];
};

export type WhichPrincipleKey = {
  key: string;
  /** Paragraphs per option — the winner and the "not the issue here" one. */
  perOption: Record<string, string[]>;
  distinguish?: { title: string; body: string };
  summary?: string;
};

/* ------------------------------------------------------------------ *
 * T2 — rank_variants
 * ------------------------------------------------------------------ */

export type RankVariantsContent = CommonContent & {
  turns: Turn[];
  subhead?: string;
  /** `note` describes what the variant does structurally, not what it says. */
  options: { id: string; body: string; note: string }[];
  /** Every reviewer sees the same variants in a different order. */
  shuffle?: boolean;
};

export type RankVariantsKey = {
  /** Best first. grade is exact-match against this. */
  keyOrder: string[];
  rationaleTitle?: string;
  rationale: string;
};

/* ------------------------------------------------------------------ *
 * T3 — write_feedback
 *
 * The reviewer reads a fellow's rationale, decides for themselves whether it
 * holds, and WRITES their own feedback. There are no options — the answer is
 * prose. The reveal is a fixed three-move breakdown plus a worked example.
 * ------------------------------------------------------------------ */

export type WriteFeedbackContent = CommonContent & {
  /** [0] is the user's request, [1] is the completion being reviewed. */
  turns: Turn[];
  subject: { rationale: string };
};

export type WriteFeedbackKey = {
  /** The pill at the top of the reveal, e.g. "Rationale is weak". */
  verdict: string;
  verdictTone: "weak" | "strong";
  /** The three moves, in order. */
  blocks: { working: string; correcting: string; improve: string };
  /** "Feedback that lands" — a worked example of the whole thing. */
  exemplar: string;
  toneNote?: string;
};

/* ------------------------------------------------------------------ *
 * Answers
 * ------------------------------------------------------------------ */

/**
 * What a participant submits.
 *   option   pick-one templates
 *   order    rank_variants
 *   feedback write_feedback — prose, so nothing to compare a key against
 */
export type Answer = { option?: string; order?: string[]; feedback?: string };

export type TallyRow = { label: string; votes: number; tone?: "ok" | "bad" | "muted" };
export type TallyGroup = { title?: string; rows: TallyRow[] };

/* ------------------------------------------------------------------ *
 * The component contract
 *
 * Every template's Review and Reveal take exactly these props — only the
 * content and answer-key types vary. Annotating each component with these
 * makes the uniformity a compile error to break, rather than a convention
 * someone has to remember, and it is what the registry will hold.
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
