import { registry } from "@/lib/templates/registry";
import type { TemplateKey } from "@/lib/templates/types";
import type {
  AnswerKeyOf,
  HydratedContent,
  QuestionStatus,
  ReviewStatus,
  StoredContent,
  StoredQuestion,
  StoredQuestionWithKey,
} from "@/lib/repos/questions";
import type { PrincipleIndex } from "@/lib/services/principles";

/**
 * Stored ⇄ hydrated content (PLAN §5.12). Pure — no client, no io.
 *
 * The migration is explicit: "Names and descriptors come from the principles
 * table — the author references codes rather than retyping them," because
 * "renaming S2 should not mean rewriting JSON blobs." So `which_principle`
 * STORES `inPlayCodes: ['S1','C1']` and the components RECEIVE
 * `inPlay: [{ code, name, descriptor }]`. This module is the boundary
 * between those two shapes, in both directions.
 *
 * The other two templates are passthrough: nothing in their content
 * references a reference table, so stored === hydrated.
 */

/* ------------------------------------------------------------------ *
 * The two question shapes (PLAN §5.10)
 *
 * `ReviewerQuestion` has NO answerKey property. Not an optional one, not a
 * nullable one — none. A component handed one cannot render a key because
 * there is nothing to reach for, which is the type layer mirroring the
 * schema's decision to keep `content` and `answer_key` in separate columns.
 * ------------------------------------------------------------------ */

type Base = {
  id: string;
  prompt: string;
  status: QuestionStatus;
  createdAt: string;
  updatedAt: string;
};

export type ReviewerQuestion = {
  [T in TemplateKey]: Base & { template: T; content: HydratedContent<T> };
}[TemplateKey];

export type AuthoredQuestion = {
  [T in TemplateKey]: Base & {
    template: T;
    content: HydratedContent<T>;
    answerKey: AnswerKeyOf<T>;
    authorId: string | null;
    reviewStatus: ReviewStatus;
    reviewNote: string | null;
  };
}[TemplateKey];

/* ------------------------------------------------------------------ *
 * stored → hydrated
 * ------------------------------------------------------------------ */

type StoredWhichPrinciple = {
  inPlayCodes?: unknown;
  [key: string]: unknown;
};

/**
 * A code with no row in `principles` still has to render — an author can
 * reference a code that was later deactivated, and the reviewer screen must
 * not blow up over it. It degrades to the bare code, never to an exception.
 */
function refFor(code: string, principles: PrincipleIndex) {
  return principles[code] ?? { code, name: code, descriptor: "" };
}

export function hydrateContent<T extends TemplateKey>(
  template: T,
  content: StoredContent<T>,
  principles: PrincipleIndex,
): HydratedContent<T> {
  if (template !== "which_principle") {
    // Passthrough. rank_variants and write_feedback declare stored === hydrated.
    return content as unknown as HydratedContent<T>;
  }

  const stored = content as StoredWhichPrinciple;
  const codes = Array.isArray(stored.inPlayCodes)
    ? (stored.inPlayCodes as unknown[]).filter(
        (code): code is string => typeof code === "string",
      )
    : [];

  const rest = { ...stored };
  delete rest.inPlayCodes;

  return {
    ...rest,
    inPlay: codes.map((code) => refFor(code, principles)),
  } as unknown as HydratedContent<T>;
}

/* ------------------------------------------------------------------ *
 * hydrated → stored
 *
 * The save direction. The author form edits the hydrated shape, so the
 * service has to fold the reference data back out before the content is
 * validated by `registry[template].parse.content` and written — otherwise
 * a rename of S2 would be baked into every question that mentions it.
 * ------------------------------------------------------------------ */

type HydratedWhichPrinciple = {
  inPlay?: unknown;
  [key: string]: unknown;
};

export function dehydrateContent(
  template: TemplateKey,
  content: unknown,
): unknown {
  if (template !== "which_principle") return content;
  if (typeof content !== "object" || content === null) return content;

  const hydrated = content as HydratedWhichPrinciple;
  // Already stored-shaped (a straight re-save of a parsed row) — leave it.
  if (!Array.isArray(hydrated.inPlay)) return content;

  const { inPlay, ...rest } = hydrated;
  return {
    ...rest,
    inPlayCodes: (inPlay as unknown[]).flatMap((entry) =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as { code?: unknown }).code === "string"
        ? [(entry as { code: string }).code]
        : [],
    ),
  };
}

/* ------------------------------------------------------------------ *
 * Row level
 *
 * One cast each, at the point where a runtime `template` string meets the
 * static union — the same boundary `lib/repos/questions.ts` documents.
 * ------------------------------------------------------------------ */

export function hydrateQuestion(
  row: StoredQuestion,
  principles: PrincipleIndex,
): ReviewerQuestion {
  return {
    id: row.id,
    template: row.template,
    prompt: row.prompt,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    content: hydrateContent(row.template, row.content, principles),
  } as ReviewerQuestion;
}

export function hydrateQuestionWithKey(
  row: StoredQuestionWithKey,
  principles: PrincipleIndex,
): AuthoredQuestion {
  return {
    id: row.id,
    template: row.template,
    prompt: row.prompt,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    authorId: row.authorId,
    reviewStatus: row.reviewStatus,
    reviewNote: row.reviewNote,
    answerKey: row.answerKey,
    content: hydrateContent(row.template, row.content, principles),
  } as AuthoredQuestion;
}

/**
 * `principleCodes` is DERIVED from the hydrated content, never picked
 * separately — the codes are already named inside the question, and a second
 * picker would be a second source of truth that can disagree with the first.
 * This is what writes `question_principles` on save.
 */
export function principleCodesFor(
  template: TemplateKey,
  hydratedContent: unknown,
): string[] {
  const derive = registry[template].principleCodes as (
    content: unknown,
  ) => string[];
  return derive(hydratedContent);
}
