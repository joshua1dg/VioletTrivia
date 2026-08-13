"use server";

/**
 * The Proposals tab's action surface (Wave 2, propose-to-master). Same shape
 * as `app/admin/questions/actions.ts`: guard lives in the service (a Server
 * Action is a public endpoint; not rendering a button protects nothing),
 * this file only zod-parses, calls, and maps the result. Every call here is
 * fired imperatively (`useTransition`, no `<form action>`) from a row
 * component — `deny` needs to hold a note before it submits, and `withdraw`
 * reuses `<ConfirmDelete onConfirm>` — so every signature takes plain
 * arguments rather than `(prevState, formData)`.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { asAppError } from "@/lib/errors";
import * as questions from "@/lib/services/questions";

export type VoidResult = { ok: true } | { ok: false; message: string };

export async function approveQuestion(id: string): Promise<VoidResult> {
  try {
    await questions.approveQuestion(z.uuid().parse(id));
    revalidatePath("/admin/proposals");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

const denyInput = z.object({ id: z.uuid(), note: z.string() });

/** The service throws `AppError("validation")` on an empty note — that
 *  message is what surfaces here, unaltered, since the note is the only
 *  feedback the submitter ever gets. */
export async function denyQuestion(
  id: string,
  note: string,
): Promise<VoidResult> {
  try {
    const parsed = denyInput.parse({ id, note });
    await questions.denyQuestion(parsed.id, parsed.note);
    revalidatePath("/admin/proposals");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

/** For the viewer's own still-unapproved proposal, `deleteQuestion` IS
 *  withdrawal — the service enforces who may call this on which row. */
export async function withdrawQuestion(id: string): Promise<VoidResult> {
  try {
    await questions.deleteQuestion(z.uuid().parse(id));
    revalidatePath("/admin/proposals");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

/** The explicit draft/denied → proposed step (2026-08-13) — replaces the
 *  old implicit resubmit-on-save. Author or curator only, draft or denied
 *  only; the service turns anything else into a `conflict`. */
export async function submitQuestionForReview(id: string): Promise<VoidResult> {
  try {
    await questions.submitQuestionForReview(z.uuid().parse(id));
    revalidatePath("/admin/proposals");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}
