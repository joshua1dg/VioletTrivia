"use server";

import { revalidatePath } from "next/cache";

import { asAppError } from "@/lib/errors";
import {
  reorderTopicsInput,
  topicInput,
  topicUpdateInput,
} from "@/lib/schemas/topics";
import * as topics from "@/lib/services/topics";

/**
 * Topics CRUD (D14). Every export here is: zod parse → one service call →
 * return. Errors are RETURN VALUES, never throws (PLAN §7.2) — a thrown
 * error hits error.tsx and the admin loses whatever they typed.
 * `requireAdmin()` is already inside `lib/services/topics` (PLAN §5.3), so
 * these stay thin.
 */

export type ActionResult = { ok: true } | { ok: false; message: string };

/** Shaped for useActionState: (prevState, formData) — the create form. */
export async function createTopic(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const input = topicInput.parse({
      label: formData.get("label"),
    });
    await topics.createTopic(input);
    revalidatePath("/admin/topics");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

/**
 * Shaped for useActionState via `updateTopic.bind(null, id)` (Next's
 * "passing additional arguments" pattern) — the per-row rename form.
 */
export async function updateTopic(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const patch = topicUpdateInput.parse({
      label: formData.get("label"),
    });
    await topics.updateTopic(id, patch);
    revalidatePath("/admin/topics");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

/** Called imperatively from the arrow buttons via useTransition — no form. */
export async function reorderTopics(orderedIds: string[]): Promise<ActionResult> {
  try {
    const ids = reorderTopicsInput.parse(orderedIds);
    await topics.reorderTopics(ids);
    revalidatePath("/admin/topics");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

/** `<ConfirmDelete onConfirm>` calls this directly — it owns its own transition. */
export async function deleteTopic(
  id: string,
): Promise<{ ok: true; questionsAffected: number } | { ok: false; message: string }> {
  try {
    const result = await topics.deleteTopic(id);
    revalidatePath("/admin/topics");
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}
