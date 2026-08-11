import "server-only";

import { requireAdmin } from "@/lib/auth";
import { serviceClient } from "@/lib/db/server";
import { AppError, GENERIC_USER_MESSAGE } from "@/lib/errors";
import * as repo from "@/lib/repos/staff";
import type { StaffRoleValue, StaffRow } from "@/lib/repos/staff";

/**
 * Staff management (Wave 1, PODS.md: "admins add/deactivate leads with a
 * role picker; without it a second human cannot log in at all"). Admin-only
 * throughout, per the role matrix in PODS.md decision 4 — staff, like the
 * rubric and topics, is a system-tier concern.
 *
 * `createStaff` provisions BOTH halves of a login the way
 * `scripts/bootstrap-admin.ts` does: an `auth.users` row via the GoTrue
 * admin API, then the matching `staff` row. Simpler than the script on
 * purpose — this is an in-app action for someone who is already signed in
 * as an admin, so "email already registered" is just a validation error to
 * show them, not a case to idempotently repair (the script's re-run story
 * doesn't apply here; nobody re-submits this form expecting it to reuse an
 * existing account).
 */

export type { StaffRoleValue, StaffRow };

/** Admin-only (not `requireStaff`) — this screen is system-tier, and no
 * other caller needs the full roster yet. Widen this if/when the reports
 * layer wants names for a pod-lead selector. */
export async function listStaff(): Promise<StaffRow[]> {
  await requireAdmin();
  return repo.list();
}

export async function createStaff(input: {
  email: string;
  password: string;
  displayName?: string | null;
  role: StaffRoleValue;
}): Promise<StaffRow> {
  await requireAdmin();

  const created = await serviceClient().auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });

  if (!created.data.user) {
    // Same "already registered" shapes bootstrap-admin.ts checks for, but
    // there is no idempotency dance here — just tell the admin.
    const alreadyRegistered =
      created.error?.code === "email_exists" ||
      /already.*registered/i.test(created.error?.message ?? "");

    if (alreadyRegistered) {
      throw new AppError(
        "validation",
        "That email is already registered. Use a different email, or ask an admin to check the existing account.",
      );
    }

    throw new AppError("unavailable", GENERIC_USER_MESSAGE, {
      cause: created.error,
      message: created.error?.message ?? "auth.admin.createUser returned no user",
    });
  }

  return repo.upsert({
    userId: created.data.user.id,
    role: input.role,
    email: input.email,
    displayName: input.displayName ?? null,
  });
}

/**
 * An admin may not change their OWN role away from admin — the only guard
 * standing between one careless click and a project with no admin left to
 * fix it. Changing anyone else, or setting your own role TO admin (a no-op
 * here since you're already one), is unrestricted.
 */
export async function changeRole(
  userId: string,
  role: StaffRoleValue,
): Promise<void> {
  const staff = await requireAdmin();
  if (staff.userId === userId && role !== "admin") {
    throw new AppError(
      "validation",
      "You can't change your own role — ask another admin to do it.",
    );
  }
  await repo.updateRole(userId, role);
}

/** Same self-protection as `changeRole`: removing yourself would be able to
 * lock everyone out if you're the only admin. */
export async function removeStaff(userId: string): Promise<void> {
  const staff = await requireAdmin();
  if (staff.userId === userId) {
    throw new AppError(
      "validation",
      "You can't remove your own account — ask another admin to do it.",
    );
  }
  await repo.remove(userId);
}
