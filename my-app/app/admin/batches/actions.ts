"use server";

import { revalidatePath } from "next/cache";

import { asAppError } from "@/lib/errors";
import * as batches from "@/lib/services/batches";

import {
  batchInput,
  batchUpdateInput,
  setActiveAsyncInput,
  setQuestionsInput,
  setStatusInput,
} from "./schema";

/**
 * The batches action surface (PLAN §7.1). All six calls are fired
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
