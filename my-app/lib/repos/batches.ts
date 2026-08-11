import "server-only";

import { serviceClient } from "@/lib/db/server";
import type { Database } from "@/lib/db/database.types";

import { camelRow, mapPostgrestError, unwrap, unwrapMaybe } from "./_shared";

/**
 * Wave 2/B1 shipped a minimal read surface — exactly enough to resolve
 * `/b/{token}` and feed the async draw. Wave 3/F3 (this pass) adds the
 * composer's writes: create, update, delete, `setActiveAsync`,
 * `setQuestions`, plus the counts the list screen and the delete guard need.
 * One repo, following the pattern in `_shared.ts` — no second file.
 *
 * No jsonb on this table, so nothing to parse and nothing to soft-fail.
 */

export type BatchStatus = Database["public"]["Enums"]["batch_status"];

export type BatchRow = {
  id: string;
  name: string;
  audience: string | null;
  status: BatchStatus;
  token: string;
  expiresAt: string | null;
  asyncSampleSize: number | null;
  isActiveAsync: boolean;
  ownerId: string | null;
  scheduledFor: string | null;
  createdAt: string;
};

const COLUMNS =
  "id, name, audience, status, token, expires_at, async_sample_size, is_active_async, owner_id, scheduled_for, created_at";

/** `/b/{token}`. Null rather than throwing — an unknown token is a 404 page. */
export async function getByToken(token: string): Promise<BatchRow | null> {
  const row = unwrapMaybe(
    await serviceClient()
      .from("batches")
      .select(COLUMNS)
      .eq("token", token)
      .maybeSingle(),
  );
  return row ? camelRow(row) : null;
}

export async function getById(id: string): Promise<BatchRow> {
  const row = unwrap(
    await serviceClient().from("batches").select(COLUMNS).eq("id", id).single(),
    { notFound: "That batch no longer exists." },
  );
  return camelRow(row);
}

/** The batch's questions, in `position` order — the input to the draw. */
export async function listQuestionIds(batchId: string): Promise<string[]> {
  const rows = unwrap(
    await serviceClient()
      .from("batch_questions")
      .select("question_id, position")
      .eq("batch_id", batchId)
      .order("position", { ascending: true }),
  );
  return rows.map((r) => r.question_id);
}

/* ------------------------------------------------------------------ *
 * The composer (Wave 3/F3, from here down)
 * ------------------------------------------------------------------ */

export type BatchListRow = BatchRow & {
  questionCount: number;
  responseCount: number;
};

// PostgREST returns each embedded aggregate as a one-element array —
// `batch_questions(count)` because `batch_questions.batch_id` is the only FK
// into this table, `responses(count)` because `responses.batch_id` is the
// only FK into this table from THAT one. Both unambiguous, same shape as
// `lib/repos/topics.ts`'s `question_topics(count)`.
const LIST_COLUMNS = `${COLUMNS}, batch_questions(count), responses(count)`;

function withCounts(
  row: Record<string, unknown> & {
    batch_questions?: { count: number }[] | null;
    responses?: { count: number }[] | null;
  },
): BatchListRow {
  const { batch_questions, responses, ...rest } = row;
  return {
    ...camelRow(rest),
    questionCount: batch_questions?.[0]?.count ?? 0,
    responseCount: responses?.[0]?.count ?? 0,
  } as BatchListRow;
}

/** The list screen: every batch, newest first, plus its two cheap counts. */
export async function list(): Promise<BatchListRow[]> {
  const rows = unwrap(
    await serviceClient()
      .from("batches")
      .select(LIST_COLUMNS)
      .order("created_at", { ascending: false }),
  );
  return rows.map(withCounts);
}

/** Single-batch read with the same counts — the composer's settings panel
 *  and its delete confirm's blast radius both need them. */
export async function getByIdWithCounts(id: string): Promise<BatchListRow> {
  const row = unwrap(
    await serviceClient()
      .from("batches")
      .select(LIST_COLUMNS)
      .eq("id", id)
      .single(),
    { notFound: "That batch no longer exists." },
  );
  return withCounts(row);
}

export type BatchInsert = {
  name: string;
  token: string;
  // Wave 1 (PODS.md): attribution, not optional metadata — the creator owns
  // what they create. Callers pass the signed-in staff id, never accept it
  // from the client (lib/services/batches.createBatch sets it).
  ownerId: string;
  audience?: string | null;
  expiresAt?: string | null;
  asyncSampleSize?: number | null;
};

export async function insert(input: BatchInsert): Promise<BatchRow> {
  const row = unwrap(
    await serviceClient()
      .from("batches")
      .insert({
        name: input.name,
        token: input.token,
        owner_id: input.ownerId,
        audience: input.audience ?? null,
        expires_at: input.expiresAt ?? null,
        async_sample_size: input.asyncSampleSize ?? null,
      })
      .select(COLUMNS)
      .single(),
    { conflict: "That link token is already in use — try again." },
  );
  return camelRow(row);
}

export type BatchPatch = Partial<{
  name: string;
  audience: string | null;
  status: BatchStatus;
  expiresAt: string | null;
  asyncSampleSize: number | null;
}>;

export async function update(id: string, patch: BatchPatch): Promise<BatchRow> {
  const row = unwrap(
    await serviceClient()
      .from("batches")
      .update({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.audience !== undefined ? { audience: patch.audience } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.expiresAt !== undefined
          ? { expires_at: patch.expiresAt }
          : {}),
        ...(patch.asyncSampleSize !== undefined
          ? { async_sample_size: patch.asyncSampleSize }
          : {}),
      })
      .eq("id", id)
      .select(COLUMNS)
      .single(),
    {
      notFound: "That batch no longer exists.",
      validation: "That sample size isn't valid — it must be a positive number.",
    },
  );
  return camelRow(row);
}

export async function remove(id: string): Promise<void> {
  const { error } = await serviceClient().from("batches").delete().eq("id", id);
  if (error) {
    throw mapPostgrestError(error, {
      conflict: "Something still refers to this batch and it couldn't be removed.",
    });
  }
}

/**
 * `is_active_async` is a GLOBAL SINGLETON (migration ~line 294 — "OPEN
 * QUESTION: is_active_async is a global singleton — exactly one batch is
 * the async pool for everyone"), enforced by the partial unique index
 * `batches_one_active_async`. Activating one batch must deactivate whichever
 * batch currently holds it.
 *
 * NON-TRANSACTIONAL — two statements, deliberately in THIS order:
 *
 *   1. clear the flag on every OTHER batch that currently has it;
 *   2. set (or clear) the flag on the target batch.
 *
 * Doing it the other way — set the target first, clear the old holder
 * second — would collide with the unique index the instant a second row
 * tried to hold `true` at once, and fail outright. This order instead opens
 * a brief window with NO active async batch at all: a `/b/{token}` request
 * that lands in that window sees `canSubmit: false` for an instant.
 * Accepted — it never shows a wrong batch, never allows two at once, and
 * self-heals on the very next request once step 2 lands.
 */
export async function setActiveAsync(
  id: string,
  active: boolean,
): Promise<BatchRow> {
  if (active) {
    const { error } = await serviceClient()
      .from("batches")
      .update({ is_active_async: false })
      .eq("is_active_async", true)
      .neq("id", id);
    if (error) throw mapPostgrestError(error);
  }

  const row = unwrap(
    await serviceClient()
      .from("batches")
      .update({ is_active_async: active })
      .eq("id", id)
      .select(COLUMNS)
      .single(),
    { notFound: "That batch no longer exists." },
  );
  return camelRow(row);
}

/**
 * Replaces the batch's entire `batch_questions` set with `orderedIds`,
 * positions 0..n-1 in the order given.
 *
 * NON-TRANSACTIONAL — delete then insert, not one statement: PostgREST has
 * no multi-row "upsert with positions, pruning anything absent" in a single
 * call. A failure between the two leaves the batch with NO questions rather
 * than the old or the new set. The composer sends the whole list every
 * save (not a diff) specifically so a retry after a failure is just "click
 * save again" — the client's `queue` state doesn't need to reconcile a
 * partial write.
 *
 * This is also the write the README/migration caveat warns about (PLAN
 * §5.15): if this batch is the active async pool, changing its question
 * list here reshuffles every participant's draw, because the draw is a
 * pure function of the batch's CURRENT question list. This function
 * doesn't refuse the write — the composer UI is where that gets surfaced.
 */
export async function setQuestions(
  batchId: string,
  orderedIds: string[],
): Promise<void> {
  const { error: deleteError } = await serviceClient()
    .from("batch_questions")
    .delete()
    .eq("batch_id", batchId);
  if (deleteError) throw mapPostgrestError(deleteError);

  if (orderedIds.length === 0) return;

  const rows = orderedIds.map((questionId, index) => ({
    batch_id: batchId,
    question_id: questionId,
    position: index,
  }));

  const { error: insertError } = await serviceClient()
    .from("batch_questions")
    .insert(rows);
  if (insertError) {
    throw mapPostgrestError(insertError, {
      conflict: "One of the selected questions no longer exists.",
    });
  }
}

/**
 * D14's delete guard: "refuse to delete a batch with a non-ended
 * `live_sessions` row — that cascade *would* destroy session history."
 *
 * A narrow, contained exception to "one repo per table" — the same shape as
 * `lib/auth`'s direct `staff` read. F5 owns `lib/repos/sessions.ts` as the
 * real sessions repo; this is the one count D14's guard needs, and it
 * belongs beside the guard that calls it rather than forcing a second
 * repo file into existence a wave early for one column.
 */
export async function countOpenLiveSessions(batchId: string): Promise<number> {
  const { count, error } = await serviceClient()
    .from("live_sessions")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .neq("phase", "ended");
  if (error) throw mapPostgrestError(error);
  return count ?? 0;
}
