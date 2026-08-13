"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { asAppError } from "@/lib/errors";
import type { ConfirmDeleteOutcome } from "@/components/feedback";
import * as staff from "@/lib/services/staff";
import type { StaffRoleValue } from "@/lib/services/staff";

/**
 * Staff CRUD (Wave 1). Every export here is: zod parse → one service call →
 * return. Errors are RETURN VALUES, never throws — same convention as
 * app/admin/topics/actions.ts. `requireAdmin()` lives inside
 * lib/services/staff, so these stay thin.
 *
 * The role enum is spelled out here rather than imported from
 * lib/schemas/topics.ts (which isn't ours to add to) — must match
 * `Database["public"]["Enums"]["staff_role"]` (lib/db/database.types.ts).
 */

export type ActionResult = { ok: true } | { ok: false; message: string };

const roleValues = ["pod_lead", "dol", "admin"] as const;
const roleInput: z.ZodType<StaffRoleValue> = z.enum(roleValues);

const inviteStaffInput = z.object({
  email: z.string().trim().min(1, "Email is required.").toLowerCase().email(
    "Enter a valid email address.",
  ),
  role: roleInput,
});

/** THE way in (2026-08-13; the admin-typed temp-password path is gone) —
 * no password field: Supabase mails the link, the invitee sets their own
 * on /welcome. Shaped for useActionState: (prevState, formData). */
export async function inviteStaff(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const input = inviteStaffInput.parse({
      email: formData.get("email"),
      role: formData.get("role"),
    });
    await staff.inviteStaff(input);
    revalidatePath("/admin/staff");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

/** Called imperatively from the role `<select>` via useTransition — no form,
 * same pattern as `reorderTopics`. */
export async function changeRole(
  userId: string,
  role: string,
): Promise<ActionResult> {
  try {
    const parsedUserId = z.uuid().parse(userId);
    const parsedRole = roleInput.parse(role);
    await staff.changeRole(parsedUserId, parsedRole);
    revalidatePath("/admin/staff");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

/** `<ConfirmDelete onConfirm>` calls this directly — it owns its own transition. */
export async function removeStaff(userId: string): Promise<ConfirmDeleteOutcome> {
  try {
    const parsedUserId = z.uuid().parse(userId);
    await staff.removeStaff(parsedUserId);
    revalidatePath("/admin/staff");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}
