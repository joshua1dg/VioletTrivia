"use server";

/**
 * The question library's boundary (PLAN §7.1 / §7.2).
 *
 * Every export here is: guard (inside the service — a Server Action is a
 * public endpoint, not rendering a button protects nothing) → zod parse →
 * one service call → return. Errors are RETURN VALUES, never throws.
 *
 * `createQuestion` / `updateQuestion` are shaped for React 19
 * `useActionState`: `(previousState, payload)`, payload a plain object
 * rather than `FormData` — content and answerKey are structured, not form
 * fields — mirroring `app/b/actions.ts:submitAsyncAnswer` (PLAN §6).
 * `createQuestion` used to `redirect()` on success; since 2026-08-13 the
 * editor can chain a save into `submitQuestionForReview`, which needs the
 * new id back on the client, so it now returns `{ ok: true, id }` like
 * `updateQuestion` and the client navigates itself.
 * `archiveQuestion` / `deleteQuestion` / `submitQuestionForReview` are
 * called imperatively (a click handler / `<ConfirmDelete onConfirm>`), so
 * they just take an id.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { asAppError } from "@/lib/errors";
import { questionInput } from "@/lib/schemas/questions";
import * as questions from "@/lib/services/questions";

export type ActionResult = { ok: true; id: string } | { ok: false; message: string };
export type VoidResult = { ok: true } | { ok: false; message: string };

/** Update's envelope is create's plus the id — the id travels with the
 *  payload rather than as a second `useActionState` argument, since the
 *  hook only threads one. */
const updateInput = questionInput.extend({ id: z.uuid() });

export async function createQuestion(
  _previousState: ActionResult | null,
  payload: unknown,
): Promise<ActionResult> {
  try {
    const input = questionInput.parse(payload);
    const { id } = await questions.createQuestion(input);
    revalidatePath("/admin/questions");
    return { ok: true, id };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

export async function updateQuestion(
  _previousState: ActionResult | null,
  payload: unknown,
): Promise<ActionResult> {
  try {
    const { id, ...input } = updateInput.parse(payload);
    await questions.updateQuestion(id, input);
    revalidatePath("/admin/questions");
    revalidatePath(`/admin/questions/${id}`);
    return { ok: true, id };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

/** The normal path for anything that has been seen by a reviewer. */
export async function archiveQuestion(id: string): Promise<VoidResult> {
  try {
    await questions.archiveQuestion(z.uuid().parse(id));
    revalidatePath("/admin/questions");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

/** Only succeeds unanswered — `responses.question_id` is ON DELETE RESTRICT.
 *  The service's 23503 mapping already reads "This question has been
 *  answered — archive it instead," which is what `<ConfirmDelete>` renders. */
export async function deleteQuestion(id: string): Promise<VoidResult> {
  try {
    await questions.deleteQuestion(z.uuid().parse(id));
    revalidatePath("/admin/questions");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

/** The explicit draft/denied → proposed step (2026-08-13) — the editor's
 *  "Submit"/"Resubmit for review" buttons. Revalidates the Proposals tab
 *  too: that's where the row shows up next. */
export async function submitQuestionForReview(id: string): Promise<VoidResult> {
  try {
    await questions.submitQuestionForReview(z.uuid().parse(id));
    revalidatePath("/admin/questions");
    revalidatePath(`/admin/questions/${id}`);
    revalidatePath("/admin/proposals");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}
