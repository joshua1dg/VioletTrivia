import "server-only";

import type { ZodType } from "zod";

import { requireAdmin } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import * as repo from "@/lib/repos/questions";
import type { StoredContent } from "@/lib/repos/questions";
import type { ListResult } from "@/lib/repos/_shared";
import type { QuestionInput } from "@/lib/schemas/questions";
import * as principles from "@/lib/services/principles";
import { registry } from "@/lib/templates/registry";
import type { TemplateKey } from "@/lib/templates/types";

import { excerptFrom } from "./excerpt.util";
import {
  dehydrateContent,
  hydrateContent,
  hydrateQuestion,
  hydrateQuestionWithKey,
  principleCodesFor,
  type AuthoredQuestion,
  type ReviewerQuestion,
} from "./hydrate.util";

export type QuestionStatus = repo.QuestionStatus;

/* ------------------------------------------------------------------ *
 * Reads
 *
 * THE ANSWER-KEY RULE, made structural (PLAN §5.10):
 *
 *   getForReviewer → ReviewerQuestion   no answerKey property, at all
 *   getWithKey     → AuthoredQuestion   staff + the async post-submit reveal
 *
 * `/live/[room]` may call `getForReviewer` and nothing else, ever. The two
 * return types are not assignable in the direction that would matter, so a
 * component typed against `ReviewerQuestion` cannot render a key even if it
 * tried — there is no property to reach for.
 * ------------------------------------------------------------------ */

export async function getForReviewer(id: string): Promise<ReviewerQuestion> {
  const [row, index] = await Promise.all([
    repo.getForReviewer(id),
    principles.principlesByCode(),
  ]);
  return hydrateQuestion(row, index);
}

export async function getWithKey(id: string): Promise<AuthoredQuestion> {
  const [row, index] = await Promise.all([
    repo.getWithKey(id),
    principles.principlesByCode(),
  ]);
  return hydrateQuestionWithKey(row, index);
}

/** The drawn set, in draw order. Soft-fails: one bad row is skipped, not fatal. */
export async function listForReviewer(
  ids: string[],
): Promise<ListResult<ReviewerQuestion>> {
  const [result, index] = await Promise.all([
    repo.listForReviewer(ids),
    principles.principlesByCode(),
  ]);
  return {
    rows: result.rows.map((row) => hydrateQuestion(row, index)),
    skipped: result.skipped,
  };
}

/** Reveals for already-answered questions — the async resume path. */
export async function listWithKey(
  ids: string[],
): Promise<ListResult<AuthoredQuestion>> {
  const [result, index] = await Promise.all([
    repo.listWithKey(ids),
    principles.principlesByCode(),
  ]);
  return {
    rows: result.rows.map((row) => hydrateQuestionWithKey(row, index)),
    skipped: result.skipped,
  };
}

/** One row of the admin library. */
export type QuestionSummary = {
  id: string;
  template: TemplateKey;
  /** The registry's label — nothing else in the app branches on `template`. */
  templateLabel: string;
  prompt: string;
  excerpt: string;
  status: QuestionStatus;
  topicIds: string[];
  topicSlugs: string[];
  principleCodes: string[];
  responseCount: number;
  updatedAt: string;
};

export async function listQuestionSummaries(options?: {
  statuses?: QuestionStatus[];
}): Promise<ListResult<QuestionSummary>> {
  const result = await repo.listSummaries(options);

  return {
    rows: result.rows.map((row) => ({
      id: row.id,
      template: row.template,
      templateLabel: registry[row.template].label,
      prompt: row.prompt,
      excerpt: excerptFrom(row.content),
      status: row.status,
      topicIds: row.topicIds,
      topicSlugs: row.topicSlugs,
      principleCodes: row.principleCodes,
      responseCount: row.responseCount,
      updatedAt: row.updatedAt,
    })),
    skipped: result.skipped,
  };
}

/** Everything the editor needs to reopen a question: key, topics, codes. */
export type EditableQuestion = AuthoredQuestion & {
  topicIds: string[];
  principleCodes: string[];
};

export async function getForEditor(id: string): Promise<EditableQuestion> {
  await requireAdmin();

  const [question, topicIds, principleCodes] = await Promise.all([
    getWithKey(id),
    repo.listTopicIdsFor(id),
    repo.listPrincipleCodesFor(id),
  ]);

  return { ...question, topicIds, principleCodes };
}

/* ------------------------------------------------------------------ *
 * Writes
 *
 * Authorization lives here, not in the action: a Server Action is a public
 * endpoint, and not rendering the form protects nothing (§7.2).
 *
 * NOT TRANSACTIONAL (D13). Saving a question is three writes — the row,
 * `question_topics`, `question_principles` — and PostgREST has no
 * transaction to wrap them in. A failure part-way leaves a question with
 * stale tags; re-saving fixes it. This is the README's stated trigger for
 * adding Drizzle, and the moment to revisit is when partial writes actually
 * bite, not before.
 * ------------------------------------------------------------------ */

export async function createQuestion(
  input: QuestionInput,
): Promise<{ id: string }> {
  const staff = await requireAdmin();

  const { storedContent, answerKey, principleCodes } = await validate(input);

  const { id } = await repo.insert({
    template: input.template,
    prompt: input.prompt,
    content: storedContent,
    answerKey,
    status: input.status,
    authorId: staff.userId,
  });

  // Not transactional — see the note above. The question exists from here on
  // even if the junction writes fail.
  await writeRelations(id, input.topicIds, principleCodes);

  return { id };
}

export async function updateQuestion(
  id: string,
  input: QuestionInput,
): Promise<{ id: string }> {
  await requireAdmin();

  const { storedContent, answerKey, principleCodes } = await validate(input);

  await repo.update(id, {
    template: input.template,
    prompt: input.prompt,
    content: storedContent,
    answerKey,
    status: input.status,
  });

  // Not transactional — see the note above.
  await repo.deleteTopicsFor(id);
  await repo.deletePrinciplesFor(id);
  await writeRelations(id, input.topicIds, principleCodes);

  return { id };
}

/** The normal path for anything that has been seen by a reviewer. */
export async function archiveQuestion(id: string): Promise<void> {
  await requireAdmin();
  await repo.setStatus(id, "archived");
}

export async function setQuestionStatus(
  id: string,
  status: QuestionStatus,
): Promise<void> {
  await requireAdmin();
  await repo.setStatus(id, status);
}

/**
 * Only succeeds on an unanswered question: `responses.question_id` is
 * ON DELETE RESTRICT, so Postgres refuses the rest and the repo turns that
 * 23503 into "This question has been answered — archive it instead."
 */
export async function deleteQuestion(id: string): Promise<void> {
  await requireAdmin();
  await repo.remove(id);
}

/* ------------------------------------------------------------------ *
 * Internals
 * ------------------------------------------------------------------ */

async function validate(input: QuestionInput) {
  const template = input.template;

  // The author form edits the HYDRATED shape; what gets stored is the
  // dehydrated one, and that is what `parse.content` describes.
  const storedContent = parseWith(
    registry[template].parse.content,
    dehydrateContent(template, input.content),
    "content",
  );
  const answerKey = parseWith(
    registry[template].parse.answerKey,
    input.answerKey,
    "answer key",
  );

  // `principleCodes` reads the HYDRATED shape, so derive it from what was
  // just validated rather than from the raw input — the editor sends the
  // hydrated shape, but a re-save of a parsed row sends the stored one, and
  // this way both work. The reference data is irrelevant here (only `code`
  // is read), so the index can be empty.
  const principleCodes = principleCodesFor(
    template,
    hydrateContent(template, storedContent as StoredContent<TemplateKey>, {}),
  );

  return { storedContent, answerKey, principleCodes };
}

/**
 * `registry[template]` is a union at compile time when `template` is only
 * known at runtime, so the schema is widened once here rather than at each
 * call site. The runtime check is unaffected — it is the same zod schema.
 */
function parseWith(
  schema: unknown,
  value: unknown,
  label: string,
): unknown {
  const result = (schema as ZodType<unknown>).safeParse(value);
  if (result.success) return result.data;

  const first = result.error.issues[0];
  const path = first?.path?.join(".") ?? "";
  throw new AppError(
    "validation",
    `This ${label} isn't complete${path ? ` — check "${path}"` : ""}: ${
      first?.message ?? "invalid"
    }`,
    { cause: result.error, message: `${label} failed to parse` },
  );
}

async function writeRelations(
  questionId: string,
  topicIds: string[],
  principleCodes: string[],
): Promise<void> {
  await repo.insertTopics(questionId, topicIds);

  const idsByCode = await principles.principleIdsByCode();
  const principleIds = principleCodes.flatMap((code) => {
    const id = idsByCode[code];
    if (!id) {
      // A code with no row is a seed/vocabulary gap (§3), not a save failure.
      console.error(
        `[questions] unknown principle code ${code} on question ${questionId} — not linked`,
      );
      return [];
    }
    return [id];
  });

  await repo.insertPrinciples(questionId, principleIds);
}
