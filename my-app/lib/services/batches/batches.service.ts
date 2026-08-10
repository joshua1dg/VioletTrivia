import "server-only";

import { requireAdmin } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import * as repo from "@/lib/repos/batches";

import { generateToken } from "./token.util";

/**
 * Wave 2/B1 shipped the read surface below (`getByToken` … `getAccessByToken`)
 * — enough to resolve `/b/{token}` and feed the draw. Everything from
 * "The composer" downward is Wave 3/F3: full CRUD, the `is_active_async`
 * singleton, and `batch_questions` writes (PLAN §7.1/§9 F3, D14).
 *
 * Authorization lives HERE, not in `app/admin/batches/actions.ts` — same
 * reasoning as `lib/services/topics`: "who may do this" is a business rule,
 * and a Server Action is a public endpoint (§7.2). Every mutation below
 * starts with `requireAdmin()`; the reads (including the list) don't, same
 * as topics — `/admin/*` is already staff-gated by the layout, and admin vs.
 * host isn't a distinction reads need to make.
 */

export type Batch = repo.BatchRow;
export type BatchStatus = repo.BatchStatus;
export type BatchWithCounts = repo.BatchListRow;

/**
 * A batch plus the two derived facts every reader of `/b/{token}` needs.
 *
 * `batch_status = 'inactive'` means READ-ONLY, not off: closing a batch must
 * not strand participants who were told they could read the answers
 * afterwards (README). `expiresAt` is just an automatic way to reach the
 * same state, so it lands in the same flag rather than a separate one.
 */
export type BatchAccess = Batch & {
  questionIds: string[];
  expired: boolean;
  /** 'active' and not expired. Everything else is read-only or nothing. */
  canSubmit: boolean;
  /** 'draft' resolves to nothing at all — the link is a 404. */
  visible: boolean;
};

export async function getByToken(token: string): Promise<Batch | null> {
  return repo.getByToken(token);
}

export function getById(id: string): Promise<Batch> {
  return repo.getById(id);
}

export function getQuestionIds(batchId: string): Promise<string[]> {
  return repo.listQuestionIds(batchId);
}

/** The `/b/{token}` read: batch, ordered question ids, and what may be done. */
export async function getAccessByToken(
  token: string,
  now: Date = new Date(),
): Promise<BatchAccess | null> {
  const batch = await repo.getByToken(token);
  if (!batch) return null;

  const questionIds = await repo.listQuestionIds(batch.id);
  const expired = batch.expiresAt !== null && new Date(batch.expiresAt) <= now;

  return {
    ...batch,
    questionIds,
    expired,
    canSubmit: batch.status === "active" && !expired,
    visible: batch.status !== "draft",
  };
}

/* ------------------------------------------------------------------ *
 * The composer (Wave 3/F3, from here down)
 * ------------------------------------------------------------------ */

/** The list screen: every batch, plus its question/response counts. */
export function listBatches(): Promise<BatchWithCounts[]> {
  return repo.list();
}

/** The composer's settings panel and its delete confirm's blast radius. */
export function getByIdWithCounts(id: string): Promise<BatchWithCounts> {
  return repo.getByIdWithCounts(id);
}

export type BatchWriteInput = {
  name: string;
  audience?: string | null;
  expiresAt?: string | null;
  asyncSampleSize?: number | null;
};

export async function createBatch(input: BatchWriteInput): Promise<Batch> {
  await requireAdmin();

  // The token is generated here, never accepted from the caller — it's the
  // only thing gating `/b/{token}`, so nothing outside this function should
  // be able to choose or predict it. A 23505 on the unique column is
  // astronomically unlikely at 16 URL-safe chars; retrying once with a
  // fresh token resolves it rather than surfacing a confusing conflict.
  try {
    return await repo.insert({ ...input, token: generateToken() });
  } catch (error) {
    if (error instanceof AppError && error.kind === "conflict") {
      return await repo.insert({ ...input, token: generateToken() });
    }
    throw error;
  }
}

export type BatchUpdateInput = Partial<BatchWriteInput>;

export async function updateBatch(
  id: string,
  patch: BatchUpdateInput,
): Promise<Batch> {
  await requireAdmin();
  return repo.update(id, patch);
}

export async function setStatus(
  id: string,
  status: BatchStatus,
): Promise<Batch> {
  await requireAdmin();
  return repo.update(id, { status });
}

/**
 * `is_active_async` is a GLOBAL SINGLETON — see `repo.setActiveAsync`'s
 * comment for the two-statement, non-transactional mechanics and why they
 * run in that order. This method is just the auth guard in front of it.
 */
export async function setActiveAsync(
  id: string,
  active: boolean,
): Promise<Batch> {
  await requireAdmin();
  return repo.setActiveAsync(id, active);
}

/** Arrow-reorder / tick-box save: replaces the whole queue. See
 *  `repo.setQuestions` for the non-transactional mechanics and the
 *  active-async reshuffle caveat (PLAN §5.15) this write can trigger. */
export async function setQuestions(
  id: string,
  orderedIds: string[],
): Promise<void> {
  await requireAdmin();
  return repo.setQuestions(id, orderedIds);
}

/**
 * D14: refuse to delete a batch with a non-ended `live_sessions` row — that
 * cascade *would* destroy session history a host might still need.
 * Everything else the delete touches survives on purpose: `batch_questions`
 * cascades (nothing else references those rows), and `responses.batch_id`
 * goes to `null` (the schema's `on delete set null`) rather than the
 * response itself disappearing — an answered response is never lost by
 * deleting the batch it was answered under.
 */
export async function deleteBatch(id: string): Promise<void> {
  await requireAdmin();

  const openSessions = await repo.countOpenLiveSessions(id);
  if (openSessions > 0) {
    throw new AppError(
      "conflict",
      openSessions === 1
        ? "This batch has a live session still open. End it before deleting."
        : `This batch has ${openSessions} live sessions still open. End them before deleting.`,
    );
  }

  await repo.remove(id);
}
