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
 * Provisioning is invite-only (2026-08-13; the earlier admin-typed
 * temp-password path was removed the same day the invite flow proved
 * itself): `inviteStaff` creates the `auth.users` row via the GoTrue
 * admin API and the matching `staff` row, and the invitee sets their own
 * password on /welcome. "Email already registered" is just a validation
 * error to show the admin, not a case to idempotently repair (the
 * bootstrap script's re-run story doesn't apply here).
 */

export type { StaffRoleValue, StaffRow };

/** Admin-only (not `requireStaff`) — this screen is system-tier, and no
 * other caller needs the full roster yet. Widen this if/when the reports
 * layer wants names for a pod-lead selector. */
export async function listStaff(): Promise<StaffRow[]> {
  await requireAdmin();
  return repo.list();
}

/**
 * The invite flow (2026-08-13), and the preferred way in: the admin types
 * an email and a role, Supabase mails an invite link, the person sets
 * their OWN password on /welcome — no temp-password ritual. The staff row
 * exists from this moment, so the role is editable before they've even
 * opened the email ("I can add their types after the fact").
 *
 * The link's shape lives in supabase/templates/invite.html (token_hash →
 * /auth/confirm → verifyOtp), so no redirectTo is passed here — the
 * template pins the destination.
 */
export async function inviteStaff(input: {
  email: string;
  role: StaffRoleValue;
}): Promise<StaffRow> {
  await requireAdmin();

  const invited = await serviceClient().auth.admin.inviteUserByEmail(
    input.email,
  );

  if (!invited.data.user) {
    const alreadyRegistered =
      invited.error?.code === "email_exists" ||
      /already.*registered/i.test(invited.error?.message ?? "");

    if (alreadyRegistered) {
      throw new AppError(
        "validation",
        "That email is already registered. Use a different email, or ask an admin to check the existing account.",
      );
    }

    throw new AppError("unavailable", GENERIC_USER_MESSAGE, {
      cause: invited.error,
      message:
        invited.error?.message ?? "auth.admin.inviteUserByEmail returned no user",
    });
  }

  return repo.upsert({
    userId: invited.data.user.id,
    role: input.role,
    email: input.email,
    displayName: null,
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
