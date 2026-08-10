import "server-only";

import type { ZodType } from "zod";

import { serviceClient } from "@/lib/db/server";
import type { Database } from "@/lib/db/database.types";
import { registry, type Registry } from "@/lib/templates/registry";
import type { TemplateKey } from "@/lib/templates/types";

import {
  collect,
  mapPostgrestError,
  parseJsonb,
  unwrap,
  type ListResult,
} from "./_shared";

/* ------------------------------------------------------------------ *
 * Template-derived types
 *
 * Derived from the registry rather than restated, so adding a fourth
 * template needs no edit here — the registry is already the ratchet.
 *
 *   StoredContent<T>   what sits in questions.content   (parse.content)
 *   HydratedContent<T> what Review/Reveal/Author take   (PLAN §5.12)
 *   AnswerKeyOf<T>     what sits in questions.answer_key
 *
 * These live in the repo because this is where a database row becomes a
 * typed object. `lib/services/questions/index.ts` re-exports them, and
 * everything above the service layer imports them from there — nothing
 * outside lib/services may import a repo (PLAN §5).
 * ------------------------------------------------------------------ */

export type StoredContent<T extends TemplateKey> =
  Registry[T]["parse"]["content"] extends ZodType<infer C> ? C : never;

export type HydratedContent<T extends TemplateKey> = ReturnType<
  Registry[T]["empty"]
>["content"];

export type AnswerKeyOf<T extends TemplateKey> =
  Registry[T]["parse"]["answerKey"] extends ZodType<infer K> ? K : never;

export type QuestionStatus = Database["public"]["Enums"]["question_status"];

/* ------------------------------------------------------------------ *
 * Row shapes
 *
 * Both are discriminated unions over `template`, so a consumer that
 * narrows on `q.template === "which_principle"` gets the right content and
 * key types with no cast. The answer-key split of PLAN §5.10 is the whole
 * point of having two of them: `StoredQuestion` has NO answerKey property
 * at all, so a component handed one cannot render a key.
 * ------------------------------------------------------------------ */

type QuestionBase = {
  id: string;
  prompt: string;
  status: QuestionStatus;
  createdAt: string;
  updatedAt: string;
};

export type StoredQuestion = {
  [T in TemplateKey]: QuestionBase & { template: T; content: StoredContent<T> };
}[TemplateKey];

export type StoredQuestionWithKey = {
  [T in TemplateKey]: QuestionBase & {
    template: T;
    content: StoredContent<T>;
    answerKey: AnswerKeyOf<T>;
    authorId: string | null;
  };
}[TemplateKey];

/** One row of the admin library list. */
export type QuestionSummaryRow = QuestionBase & {
  template: TemplateKey;
  /** Parsed so the service can derive an excerpt from the first turn. */
  content: StoredContent<TemplateKey>;
  topicIds: string[];
  topicSlugs: string[];
  principleIds: string[];
  principleCodes: string[];
  responseCount: number;
};

/**
 * NEVER add `answer_key` to this list. It is the reviewer column list, and
 * the structural half of the answer-key rule — `content` and `answer_key`
 * are separate columns precisely so "don't send the key" is a column list
 * rather than a recursive prune (README, PLAN §5.10).
 */
const REVIEWER_COLUMNS =
  "id, template, prompt, content, status, created_at, updated_at";

/** Staff + post-submit reveal only. */
const AUTHORED_COLUMNS = `${REVIEWER_COLUMNS}, answer_key, author_id`;

const SUMMARY_COLUMNS = `${REVIEWER_COLUMNS},
  question_topics(topic_id, topics(slug)),
  question_principles(principle_id, principles(code)),
  responses(count)`;

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

/** Single-item read — throws not_found, and throws on an unparseable row. */
export async function getForReviewer(id: string): Promise<StoredQuestion> {
  const row = unwrap(
    await serviceClient()
      .from("questions")
      .select(REVIEWER_COLUMNS)
      .eq("id", id)
      .single(),
    { notFound: "That question isn't available." },
  );

  return mapStored(row);
}

/** Single-item read WITH the key. Staff, and the async post-submit reveal. */
export async function getWithKey(id: string): Promise<StoredQuestionWithKey> {
  const row = unwrap(
    await serviceClient()
      .from("questions")
      .select(AUTHORED_COLUMNS)
      .eq("id", id)
      .single(),
    { notFound: "That question isn't available." },
  );

  return mapStoredWithKey(row);
}

/** List read — soft-fails. Order follows `ids` so a draw keeps its order. */
export async function listForReviewer(
  ids: string[],
): Promise<ListResult<StoredQuestion>> {
  if (ids.length === 0) return { rows: [], skipped: [] };

  const rows = unwrap(
    await serviceClient()
      .from("questions")
      .select(REVIEWER_COLUMNS)
      .in("id", ids),
  );

  const result = collect(rows, (r) => r.id, mapStored);
  return { rows: orderBy(result.rows, ids), skipped: result.skipped };
}

/** List read WITH keys — the async resume path, which reveals answered items. */
export async function listWithKey(
  ids: string[],
): Promise<ListResult<StoredQuestionWithKey>> {
  if (ids.length === 0) return { rows: [], skipped: [] };

  const rows = unwrap(
    await serviceClient()
      .from("questions")
      .select(AUTHORED_COLUMNS)
      .in("id", ids),
  );

  const result = collect(rows, (r) => r.id, mapStoredWithKey);
  return { rows: orderBy(result.rows, ids), skipped: result.skipped };
}

/**
 * The admin library. One query: the question, both junctions with their
 * reference rows, and an embedded count of responses.
 */
export async function listSummaries(options?: {
  statuses?: QuestionStatus[];
}): Promise<ListResult<QuestionSummaryRow>> {
  let query = serviceClient()
    .from("questions")
    .select(SUMMARY_COLUMNS)
    .order("updated_at", { ascending: false });

  if (options?.statuses?.length) query = query.in("status", options.statuses);

  const rows = unwrap(await query);

  return collect(
    rows,
    (r) => r.id,
    (row): QuestionSummaryRow => {
      const topics = row.question_topics ?? [];
      const principles = row.question_principles ?? [];
      return {
        ...base(row),
        template: row.template,
        content: parseContent(row.id, row.template, row.content),
        topicIds: topics.map((t) => t.topic_id),
        topicSlugs: topics.flatMap((t) => (t.topics ? [t.topics.slug] : [])),
        principleIds: principles.map((p) => p.principle_id),
        principleCodes: principles.flatMap((p) =>
          p.principles ? [p.principles.code] : [],
        ),
        // PostgREST returns an embedded aggregate as a one-element array.
        responseCount: row.responses?.[0]?.count ?? 0,
      };
    },
  );
}

/** The editor's current topic selection. */
export async function listTopicIdsFor(questionId: string): Promise<string[]> {
  const rows = unwrap(
    await serviceClient()
      .from("question_topics")
      .select("topic_id")
      .eq("question_id", questionId),
  );
  return rows.map((r) => r.topic_id);
}

/** The rubric codes currently linked to a question. */
export async function listPrincipleCodesFor(
  questionId: string,
): Promise<string[]> {
  const rows = unwrap(
    await serviceClient()
      .from("question_principles")
      .select("principles(code)")
      .eq("question_id", questionId),
  );
  return rows.flatMap((r) => (r.principles ? [r.principles.code] : []));
}

/* ------------------------------------------------------------------ *
 * Writes
 *
 * One query each. The service sequences them — see the non-transactional
 * note in lib/services/questions/questions.service.ts (D13).
 * ------------------------------------------------------------------ */

export type QuestionInsert = {
  template: TemplateKey;
  prompt: string;
  /** Already validated by `registry[template].parse.content` in the service. */
  content: unknown;
  answerKey: unknown;
  status?: QuestionStatus;
  authorId?: string | null;
};

export async function insert(input: QuestionInsert): Promise<{ id: string }> {
  const row = unwrap(
    await serviceClient()
      .from("questions")
      .insert({
        template: input.template,
        prompt: input.prompt,
        content: input.content as Database["public"]["Tables"]["questions"]["Insert"]["content"],
        answer_key:
          input.answerKey as Database["public"]["Tables"]["questions"]["Insert"]["answer_key"],
        status: input.status ?? "draft",
        author_id: input.authorId ?? null,
      })
      .select("id")
      .single(),
    { validation: "That question isn't shaped like a question." },
  );

  return { id: row.id };
}

export type QuestionUpdate = Partial<Omit<QuestionInsert, "authorId">>;

export async function update(id: string, patch: QuestionUpdate): Promise<void> {
  const payload: Database["public"]["Tables"]["questions"]["Update"] = {};
  if (patch.template !== undefined) payload.template = patch.template;
  if (patch.prompt !== undefined) payload.prompt = patch.prompt;
  if (patch.content !== undefined)
    payload.content =
      patch.content as Database["public"]["Tables"]["questions"]["Update"]["content"];
  if (patch.answerKey !== undefined)
    payload.answer_key =
      patch.answerKey as Database["public"]["Tables"]["questions"]["Update"]["answer_key"];
  if (patch.status !== undefined) payload.status = patch.status;

  unwrap(
    await serviceClient()
      .from("questions")
      .update(payload)
      .eq("id", id)
      .select("id")
      .single(),
    { notFound: "That question no longer exists." },
  );
}

export async function setStatus(
  id: string,
  status: QuestionStatus,
): Promise<void> {
  unwrap(
    await serviceClient()
      .from("questions")
      .update({ status })
      .eq("id", id)
      .select("id")
      .single(),
    { notFound: "That question no longer exists." },
  );
}

/**
 * `responses.question_id` is ON DELETE RESTRICT, so Postgres — not this
 * code — is what refuses to delete an answered question. 23503 is that
 * refusal, and it is the message the confirm dialog promised.
 */
export async function remove(id: string): Promise<void> {
  const { error } = await serviceClient().from("questions").delete().eq("id", id);
  if (error) {
    throw mapPostgrestError(error, {
      conflict: "This question has been answered — archive it instead.",
    });
  }
}

export async function deleteTopicsFor(questionId: string): Promise<void> {
  const { error } = await serviceClient()
    .from("question_topics")
    .delete()
    .eq("question_id", questionId);
  if (error) throw mapPostgrestError(error);
}

export async function insertTopics(
  questionId: string,
  topicIds: string[],
): Promise<void> {
  if (topicIds.length === 0) return;
  const { error } = await serviceClient()
    .from("question_topics")
    .insert(topicIds.map((topic_id) => ({ question_id: questionId, topic_id })));
  if (error)
    throw mapPostgrestError(error, {
      conflict: "One of those topics is already on this question.",
    });
}

export async function deletePrinciplesFor(questionId: string): Promise<void> {
  const { error } = await serviceClient()
    .from("question_principles")
    .delete()
    .eq("question_id", questionId);
  if (error) throw mapPostgrestError(error);
}

export async function insertPrinciples(
  questionId: string,
  principleIds: string[],
): Promise<void> {
  if (principleIds.length === 0) return;
  const { error } = await serviceClient()
    .from("question_principles")
    .insert(
      principleIds.map((principle_id) => ({
        question_id: questionId,
        principle_id,
      })),
    );
  if (error)
    throw mapPostgrestError(error, {
      conflict: "One of those principles is already on this question.",
    });
}

/* ------------------------------------------------------------------ *
 * Mapping
 * ------------------------------------------------------------------ */

type RawBase = {
  id: string;
  prompt: string;
  status: QuestionStatus;
  created_at: string;
  updated_at: string;
};

function base(row: RawBase): QuestionBase {
  return {
    id: row.id,
    prompt: row.prompt,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * The one place a runtime `template` string meets the static shapes. TS
 * cannot correlate `registry[template].parse.content` with the union member
 * `template` selects, so the schema is widened to `ZodType<unknown>` and the
 * assembled object is asserted back into the union — once, here, rather than
 * at every call site.
 */
function parseContent(
  id: string,
  template: TemplateKey,
  value: unknown,
): StoredContent<TemplateKey> {
  return parseJsonb(
    registry[template].parse.content as unknown as ZodType<unknown>,
    value,
    { id, column: "content" },
  ) as StoredContent<TemplateKey>;
}

function parseAnswerKey(
  id: string,
  template: TemplateKey,
  value: unknown,
): AnswerKeyOf<TemplateKey> {
  return parseJsonb(
    registry[template].parse.answerKey as unknown as ZodType<unknown>,
    value,
    { id, column: "answer_key" },
  ) as AnswerKeyOf<TemplateKey>;
}

function mapStored(
  row: RawBase & { template: TemplateKey; content: unknown },
): StoredQuestion {
  return {
    ...base(row),
    template: row.template,
    content: parseContent(row.id, row.template, row.content),
  } as StoredQuestion;
}

function mapStoredWithKey(
  row: RawBase & {
    template: TemplateKey;
    content: unknown;
    answer_key: unknown;
    author_id: string | null;
  },
): StoredQuestionWithKey {
  return {
    ...base(row),
    template: row.template,
    content: parseContent(row.id, row.template, row.content),
    answerKey: parseAnswerKey(row.id, row.template, row.answer_key),
    authorId: row.author_id,
  } as StoredQuestionWithKey;
}

/** PostgREST's `.in()` does not preserve the argument order; the draw does. */
function orderBy<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}
