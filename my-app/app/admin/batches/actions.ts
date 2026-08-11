"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { asAppError } from "@/lib/errors";
import * as batches from "@/lib/services/batches";

import {
  batchInput,
  batchStatus,
  batchUpdateInput,
  setActiveAsyncInput,
  setQuestionsInput,
  setStatusInput,
} from "./schema";

/**
 * The batches action surface (PLAN §7.1), plus `saveBatch` — the composer's
 * single commit, added because settings and queue are one edit to one batch
 * and were never two operations to the person doing them. Every call is fired
 * imperatively from `useTransition` in `_ui/` — there's no
 * `<form action={...}>` here, same as the live surface (§5.6) — so every
 * signature below takes plain arguments, not `(prevState, formData)`.
 *
 * Each one is: zod parse → one service call → `revalidatePath` → return.
 * Errors are RETURN VALUES, never throws (§7.2): a thrown error here hits
 * `error.tsx` and the composer loses whatever the user was mid-edit on.
 * Authorization is NOT re-checked here — `requireAdmin()` lives inside each
 * service method (§5.3/§7.2), because "who may do this" is a business rule.
 */

export type ActionError = { ok: false; message: string };

export type CreateBatchResult = { ok: true; batch: batches.Batch } | ActionError;

export async function createBatch(input: unknown): Promise<CreateBatchResult> {
  try {
    const parsed = batchInput.parse(input);
    const batch = await batches.createBatch(parsed);
    revalidatePath("/admin/batches");
    return { ok: true, batch };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

export type UpdateBatchResult = { ok: true; batch: batches.Batch } | ActionError;

export async function updateBatch(
  id: string,
  input: unknown,
): Promise<UpdateBatchResult> {
  try {
    const parsed = batchUpdateInput.parse(input);
    const batch = await batches.updateBatch(id, parsed);
    revalidatePath(`/admin/batches/${id}`);
    revalidatePath("/admin/batches");
    return { ok: true, batch };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

export type DeleteBatchResult = { ok: true } | ActionError;

export async function deleteBatch(id: string): Promise<DeleteBatchResult> {
  try {
    await batches.deleteBatch(id);
    revalidatePath("/admin/batches");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

export type SetStatusResult = { ok: true; batch: batches.Batch } | ActionError;

export async function setStatus(
  id: string,
  status: unknown,
): Promise<SetStatusResult> {
  try {
    const parsed = setStatusInput.parse({ id, status });
    const batch = await batches.setStatus(parsed.id, parsed.status);
    revalidatePath(`/admin/batches/${id}`);
    revalidatePath("/admin/batches");
    return { ok: true, batch };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

export type SetActiveAsyncResult =
  | { ok: true; batch: batches.Batch }
  | ActionError;

export async function setActiveAsync(
  id: string,
  active: boolean,
): Promise<SetActiveAsyncResult> {
  try {
    const parsed = setActiveAsyncInput.parse({ id, active });
    const batch = await batches.setActiveAsync(parsed.id, parsed.active);
    revalidatePath(`/admin/batches/${id}`);
    revalidatePath("/admin/batches");
    return { ok: true, batch };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

/**
 * Composed from the two envelopes already in `./schema.ts` rather than
 * written fresh, so there is still one definition of what a batch's fields
 * are. It lives here, unexported, because a `"use server"` module may only
 * export async functions — no client imports it today, and if one ever needs
 * the same shape for immediate feedback (§5.7) it should move to `schema.ts`
 * wholesale rather than be duplicated.
 */
const saveBatchInput = z.object({
  settings: batchUpdateInput.extend({
    status: batchStatus.optional(),
    isActiveAsync: z.boolean().optional(),
  }),
  orderedIds: setQuestionsInput.shape.orderedIds,
});

export type SaveBatchResult = { ok: true; batch: batches.Batch } | ActionError;

/**
 * The batch row and its whole question queue, in one commit. The client
 * sends complete state, never a diff, so re-clicking Save after a failure
 * converges — see `batches.saveBatch` for the ordering and why the three
 * writes underneath can't be one transaction.
 */
export async function saveBatch(
  id: string,
  input: unknown,
): Promise<SaveBatchResult> {
  try {
    const parsed = saveBatchInput.parse(input);
    const batch = await batches.saveBatch(id, parsed);
    revalidatePath(`/admin/batches/${id}`);
    revalidatePath("/admin/batches");
    return { ok: true, batch };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

const getMyPodLinkInput = z.object({ batchId: z.uuid() });

export type GetMyPodLinkResult = { ok: true; token: string } | ActionError;

/**
 * "Get my pod link" (PODS.md Wave 1) — creates (or reveals) the caller's
 * link to a master batch, idempotently. `batches.getMyPodLink` is the one
 * that refuses this on the caller's own batch or on another lead's, so the
 * only thing returned to the client is the token the copy button needs.
 */
export async function getMyPodLink(
  batchId: unknown,
): Promise<GetMyPodLinkResult> {
  try {
    const parsed = getMyPodLinkInput.parse({ batchId });
    const link = await batches.getMyPodLink(parsed.batchId);
    revalidatePath("/admin/batches");
    return { ok: true, token: link.token };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

export type SetQuestionsResult = { ok: true } | ActionError;

export async function setQuestions(
  id: string,
  orderedIds: string[],
): Promise<SetQuestionsResult> {
  try {
    const parsed = setQuestionsInput.parse({ id, orderedIds });
    await batches.setQuestions(parsed.id, parsed.orderedIds);
    revalidatePath(`/admin/batches/${id}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}
