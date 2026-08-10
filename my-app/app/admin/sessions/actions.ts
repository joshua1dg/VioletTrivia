"use server";

import { revalidatePath } from "next/cache";

import { asAppError } from "@/lib/errors";
import * as sessions from "@/lib/services/sessions";
import type { SessionPhase } from "@/lib/services/sessions";

/**
 * requireStaff (PLAN §7.1 header comment — "both roles run sessions"). The
 * guard itself lives inside every `lib/services/sessions` mutation, not
 * here: a Server Action is a public endpoint, and not rendering the form
 * protects nothing (§7.2). Authorization travels with the business logic,
 * the same shape B1's `lib/services/questions` already uses.
 *
 * Host controls call these IMPERATIVELY from `useTransition` (§7.1's note on
 * the live surface), not through `<form action>` — so every function here
 * takes plain arguments and returns `{ ok: false, message }` on failure
 * rather than throwing (§5.8): there is no `useActionState` on this screen to
 * render a thrown error, and throwing would hit `error.tsx` and lose the
 * host's place mid-session.
 */

export type ActionError = { ok: false; message: string };

export async function startSession(
  batchId: string,
): Promise<{ ok: true; sessionId: string; roomNumber: number } | ActionError> {
  try {
    const result = await sessions.startSession(batchId);
    revalidatePath("/admin/sessions");
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

export async function advance(
  sessionId: string,
): Promise<{ ok: true } | ActionError> {
  try {
    await sessions.advance(sessionId);
    revalidatePath(`/admin/sessions/${sessionId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

export async function setPhase(
  sessionId: string,
  phase: Exclude<SessionPhase, "ended">,
): Promise<{ ok: true } | ActionError> {
  try {
    await sessions.setPhase(sessionId, phase);
    revalidatePath(`/admin/sessions/${sessionId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

export async function endSession(
  sessionId: string,
): Promise<{ ok: true } | ActionError> {
  try {
    await sessions.endSession(sessionId);
    revalidatePath("/admin/sessions");
    revalidatePath(`/admin/sessions/${sessionId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

export async function forceEndMine(): Promise<{ ok: true } | ActionError> {
  try {
    await sessions.forceEndMine();
    revalidatePath("/admin/sessions");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}
