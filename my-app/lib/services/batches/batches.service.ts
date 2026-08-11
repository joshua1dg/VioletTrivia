import "server-only";

import { canCurateMaster, canManageBatch, requireStaff, type Staff } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import * as linksRepo from "@/lib/repos/batch-links";
import * as repo from "@/lib/repos/batches";
import * as staffRepo from "@/lib/repos/staff";

import { generateToken } from "./token.util";

/**
 * Wave 2/B1 shipped the read surface below (`getByToken` … `getAccessByToken`)
 * — enough to resolve `/b/{token}` and feed the draw. Everything from
 * "The composer" downward is Wave 3/F3: full CRUD, the `is_active_async`
 * singleton, and `batch_questions` writes (PLAN §7.1/§9 F3, D14). Wave 1
 * (PODS.md) then widened every mutation from admin-only to "owner, or
 * whoever can curate masters" — see `requireManage` below.
 *
 * Authorization lives HERE, not in `app/admin/batches/actions.ts` — same
 * reasoning as `lib/services/topics`: "who may do this" is a business rule,
 * and a Server Action is a public endpoint (§7.2). Every mutation below
 * starts with a `requireStaff()` + ownership check; the reads (including the
 * list) don't, same as topics — `/admin/*` is already staff-gated by the
 * layout, and read access is full at every tier (PODS.md decision 4).
 */

/** Loads the batch and throws AppError("forbidden") unless the caller may
 * mutate it — its owner, or a project lead/admin (`canManageBatch`,
 * PODS.md). Every write below goes through this instead of `requireAdmin()`
 * so a pod lead can edit their own batches without becoming an admin. */
async function requireManage(id: string): Promise<repo.BatchRow> {
  const staff = await requireStaff();
  const batch = await repo.getById(id);
  if (!canManageBatch(staff, batch)) {
    throw new AppError(
      "forbidden",
      "You can only edit batches you own, or master batches if you're a project lead or admin.",
    );
  }
  return batch;
}

/** PODS.md's master-batch rule applied to one owner: nobody (null), or a
 * project lead/admin. `staffRepo.list()` rather than a single-row lookup —
 * there's no `getById` on the staff repo, and the list is small (staff, not
 * participants). Shared by `listBatches`' OWNER column and `getMyPodLink`'s
 * "not on another lead's batch" guard. */
function resolveOwner(
  ownerId: string | null,
  staffById: Map<string, staffRepo.StaffRow>,
): { isMaster: boolean; label: string | null } {
  if (ownerId === null) return { isMaster: true, label: null };

  const owner = staffById.get(ownerId);
  if (owner) {
    const asStaff: Staff = { userId: owner.userId, email: owner.email ?? "", role: owner.role };
    if (canCurateMaster(asStaff)) return { isMaster: true, label: null };
  }

  return { isMaster: false, label: owner?.displayName ?? owner?.email ?? "Former staff" };
}

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
  /** Which door the participant came through: null for the batch's own
   * (canonical) token, a batch_links id for a pod link. Stamped onto every
   * response so a pod's analytics slice is a filter, not a copy (PODS.md
   * Wave 1). Same batch, same questions, same draw either way. */
  linkId: string | null;
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

/** The `/b/{token}` read: batch, ordered question ids, and what may be
 * done. Resolves EITHER kind of token — the batch's own, or a pod link's
 * (batch_links) — to the same batch; only `linkId` differs. */
export async function getAccessByToken(
  token: string,
  now: Date = new Date(),
): Promise<BatchAccess | null> {
  let batch = await repo.getByToken(token);
  let linkId: string | null = null;

  if (!batch) {
    const link = await linksRepo.getByToken(token);
    if (!link) return null;
    batch = await repo.getById(link.batchId);
    linkId = link.id;
  }

  const questionIds = await repo.listQuestionIds(batch.id);
  const expired = batch.expiresAt !== null && new Date(batch.expiresAt) <= now;

  return {
    ...batch,
    questionIds,
    expired,
    canSubmit: batch.status === "active" && !expired,
    visible: batch.status !== "draft",
    linkId,
  };
}

/* ------------------------------------------------------------------ *
 * The composer (Wave 3/F3, from here down)
 * ------------------------------------------------------------------ */

/** The list screen's row shape: counts plus who owns it, in the terms the
 * screen actually renders — `null` means "Master", never a raw staff id. */
export type BatchListItem = BatchWithCounts & { ownerLabel: string | null };

/** The list screen: every batch, plus its question/response counts and
 * owner label. Full read, no `requireStaff()` — same as before Wave 1; the
 * admin layout already gates `/admin/*`, and every tier sees the same list
 * (PODS.md decision 4). */
export async function listBatches(): Promise<BatchListItem[]> {
  const [rows, staffRows] = await Promise.all([repo.list(), staffRepo.list()]);
  const staffById = new Map(staffRows.map((s) => [s.userId, s]));

  return rows.map((batch) => ({
    ...batch,
    ownerLabel: resolveOwner(batch.ownerId, staffById).label,
  }));
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
  const staff = await requireStaff();

  // The token is generated here, never accepted from the caller — it's the
  // only thing gating `/b/{token}`, so nothing outside this function should
  // be able to choose or predict it. A 23505 on the unique column is
  // astronomically unlikely at 16 URL-safe chars; retrying once with a
  // fresh token resolves it rather than surfacing a confusing conflict.
  //
  // The creator owns what they create (PODS.md Wave 1) — a pod lead's new
  // batch is theirs from the first write, never a master by default.
  try {
    return await repo.insert({ ...input, token: generateToken(), ownerId: staff.userId });
  } catch (error) {
    if (error instanceof AppError && error.kind === "conflict") {
      return await repo.insert({ ...input, token: generateToken(), ownerId: staff.userId });
    }
    throw error;
  }
}

export type BatchUpdateInput = Partial<BatchWriteInput>;

export async function updateBatch(
  id: string,
  patch: BatchUpdateInput,
): Promise<Batch> {
  await requireManage(id);
  return repo.update(id, patch);
}

export async function setStatus(
  id: string,
  status: BatchStatus,
): Promise<Batch> {
  await requireManage(id);
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
  await requireManage(id);
  return repo.setActiveAsync(id, active);
}

/** Arrow-reorder / tick-box save: replaces the whole queue. See
 *  `repo.setQuestions` for the non-transactional mechanics and the
 *  active-async reshuffle caveat (PLAN §5.15) this write can trigger. */
export async function setQuestions(
  id: string,
  orderedIds: string[],
): Promise<void> {
  await requireManage(id);
  return repo.setQuestions(id, orderedIds);
}

export type BatchSaveInput = {
  /** Every editable column on the batch itself. Absent keys are left alone. */
  settings: BatchUpdateInput & {
    status?: BatchStatus;
    isActiveAsync?: boolean;
  };
  /** The whole queue, in order — never a diff. */
  orderedIds: string[];
};

/**
 * The composer's one save: the batch row and its question queue, together.
 *
 * It exists as a service method rather than as three calls from the action
 * because the ordering below, and the fact that a failure part-way through
 * is recoverable, are business rules — an action is "parse → one service
 * call → return" (PLAN §5.5), and `requireAdmin()` belongs in exactly one
 * place (§5.3).
 *
 * NON-TRANSACTIONAL, and it cannot be made otherwise through PostgREST —
 * `repo.setQuestions` is already a delete-then-insert pair for the same
 * reason. Three writes, deliberately in this order:
 *
 *   1. the batch row (name, audience, expiry, sample size, status);
 *   2. `is_active_async`, which is a global singleton and clears the flag on
 *      whichever batch holds it (see `repo.setActiveAsync`);
 *   3. the queue.
 *
 * The queue goes last because it is the one write with a blast radius beyond
 * this batch — it reshuffles every participant's draw when this batch is the
 * active async pool (§5.15) — and should not fire if the cheap writes ahead
 * of it were going to fail anyway. Recovery from a partial write is "click
 * save again": the input is the entire desired state, never a diff, so
 * re-sending it is idempotent and converges regardless of how far the
 * previous attempt got. This is the same property the composer relies on to
 * keep its local state authoritative after a failed save.
 */
export async function saveBatch(
  id: string,
  input: BatchSaveInput,
): Promise<Batch> {
  await requireManage(id);

  const { isActiveAsync, ...patch } = input.settings;

  // An empty PATCH body is a PostgREST error, not a no-op, so the read
  // stands in for it. In practice the composer always sends every field.
  let batch =
    Object.keys(patch).length > 0
      ? await repo.update(id, patch)
      : await repo.getById(id);

  if (isActiveAsync !== undefined) {
    batch = await repo.setActiveAsync(id, isActiveAsync);
  }

  await repo.setQuestions(id, input.orderedIds);

  return batch;
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
  await requireManage(id);

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

/* ------------------------------------------------------------------ *
 * Pod links (PODS.md Wave 1)
 * ------------------------------------------------------------------ */

export type BatchLink = linksRepo.BatchLinkRow;

/**
 * "Get my pod link" — idempotent per (batch, owner), same as the repo it
 * calls. Only makes sense on a MASTER batch: a lead's own batch already has
 * its own token as its link, and another lead's batch isn't this lead's to
 * link into (PODS.md — "a pod lead may NOT create a pod link on another
 * lead's batch"). Project leads and admins may call this too (harmless —
 * they can already reach the batch through its canonical token, but nothing
 * about this action needs restricting further for them).
 */
export async function getMyPodLink(batchId: string): Promise<BatchLink> {
  const staff = await requireStaff();
  const batch = await repo.getById(batchId);

  if (batch.ownerId === staff.userId) {
    throw new AppError(
      "validation",
      "This is your own batch — its own link already is your pod link.",
    );
  }

  const staffById = new Map((await staffRepo.list()).map((s) => [s.userId, s]));
  if (!resolveOwner(batch.ownerId, staffById).isMaster) {
    throw new AppError(
      "validation",
      "Pod links are only for master batches — this one belongs to another pod.",
    );
  }

  return linksRepo.getOrCreate({
    batchId,
    ownerId: staff.userId,
    token: generateToken(),
  });
}

/** Every pod link the caller holds — the lead-facing batch list's "already
 * have a link" lookup. */
export async function listMyPodLinks(): Promise<BatchLink[]> {
  const staff = await requireStaff();
  return linksRepo.listForOwner(staff.userId);
}
