import "server-only";

/**
 * The public surface (PLAN §5.3).
 *
 * Wave 2/B1 shipped the reads (`getByToken` … `getAccessByToken`). Wave 3/F3
 * (this pass) adds the composer's mutations behind `requireAdmin()` in the
 * service, never in the action (§7.2): `createBatch`, `updateBatch`,
 * `setStatus`, `setActiveAsync`, `setQuestions`, `deleteBatch`, plus the
 * counted reads (`listBatches`, `getByIdWithCounts`) the list screen and the
 * delete confirm's blast radius need.
 *
 * `saveBatch` is what the composer screen actually calls — settings and
 * queue in one commit, because they are one edit to one batch. The finer
 * grained writes stay exported: they are the frozen §7.1 surface, and the
 * list screen and any future host control may still want a single-column
 * write without shipping a whole batch.
 */

export {
  getByToken,
  getById,
  getQuestionIds,
  getAccessByToken,
  listBatches,
  getByIdWithCounts,
  createBatch,
  updateBatch,
  setStatus,
  setActiveAsync,
  setQuestions,
  saveBatch,
  deleteBatch,
  type Batch,
  type BatchSaveInput,
  type BatchAccess,
  type BatchStatus,
  type BatchWithCounts,
  type BatchWriteInput,
  type BatchUpdateInput,
} from "./batches.service";

export { drawQuestions, hash32 } from "./draw.util";
