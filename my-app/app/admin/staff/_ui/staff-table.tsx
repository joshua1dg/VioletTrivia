"use client";

// The one client boundary on this screen (house pattern, same split as
// app/admin/topics/_ui/topics-table.tsx). Owns create via useActionState,
// role changes via useTransition (imperative — a `<select>` isn't a form
// submit), and delete via <ConfirmDelete> (which owns its own transition).

import { useActionState, useState, useTransition } from "react";

import { ConfirmDelete, ErrorNote, SubmitButton } from "@/components/feedback";
import type { StaffRoleValue, StaffRow } from "@/lib/services/staff";

import {
  changeRole,
  createStaff,
  removeStaff,
  type ActionResult,
} from "../actions";

const initialState: ActionResult | null = null;

/** Values stay the enum (`staff_role`); display copy uses spaces. */
const ROLE_OPTIONS: { value: StaffRoleValue; label: string }[] = [
  { value: "pod_lead", label: "pod lead" },
  { value: "dol", label: "DOL" },
  { value: "admin", label: "admin" },
];

function formatJoined(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function StaffTable({
  staff,
  currentUserId,
}: {
  staff: StaffRow[];
  currentUserId: string | null;
}) {
  return (
    <div className="flex flex-col gap-4 p-6">
      <CreateStaffForm count={staff.length} />

      <div className="overflow-hidden rounded-[10px] border border-line">
        <div className="grid grid-cols-[1fr_1fr_180px_120px_auto] items-center gap-0 border-b border-line-2 bg-surface px-4 py-2.5 text-[11.5px] tracking-[0.04em] text-faint">
          <span>NAME</span>
          <span>EMAIL</span>
          <span>ROLE</span>
          <span>JOINED</span>
          <span />
        </div>

        {staff.length === 0 && (
          <p className="px-4 py-8 text-[13.5px] text-muted-3">
            No staff yet — create the first one above.
          </p>
        )}

        {staff.map((row) => (
          <StaffRowItem
            key={row.userId}
            row={row}
            isSelf={row.userId === currentUserId}
          />
        ))}
      </div>
    </div>
  );
}

function CreateStaffForm({ count }: { count: number }) {
  const [state, action] = useActionState(createStaff, initialState);

  return (
    <form
      // Keyed by count so a successful create clears the (uncontrolled)
      // inputs by remounting the form, same trick as CreateTopicForm.
      key={count}
      action={action}
      className="flex flex-wrap items-end gap-2.5 rounded-[10px] border border-line bg-white p-4"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-muted">Email</span>
        <input
          type="email"
          name="email"
          required
          placeholder="lead@violet.local"
          className="w-52 rounded-[7px] border border-line px-3 py-1.5 text-[13.5px] text-ink outline-none focus:border-violet"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-muted">
          Password
        </span>
        <input
          type="text"
          name="password"
          required
          minLength={8}
          placeholder="at least 8 characters"
          className="w-48 rounded-[7px] border border-line px-3 py-1.5 text-[13.5px] text-ink outline-none focus:border-violet"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-muted">
          Display name
        </span>
        <input
          name="displayName"
          placeholder="Jane Doe"
          className="w-40 rounded-[7px] border border-line px-3 py-1.5 text-[13.5px] text-ink outline-none focus:border-violet"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-muted">Role</span>
        <select
          name="role"
          defaultValue="pod_lead"
          className="w-36 rounded-[7px] border border-line px-3 py-1.5 text-[13.5px] text-ink outline-none focus:border-violet"
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <SubmitButton>Add staff</SubmitButton>

      <div className="basis-full">
        {state?.ok === true && (
          <p className="text-[12.5px] text-ok-ink">
            Created — they can sign in at /login with that email and
            password.
          </p>
        )}
        <ErrorNote error={state?.ok === false ? state.message : null} />
      </div>
    </form>
  );
}

function StaffRowItem({ row, isSelf }: { row: StaffRow; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onRoleChange(next: string) {
    setError(null);
    startTransition(async () => {
      const result = await changeRole(row.userId, next);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div className="grid grid-cols-[1fr_1fr_180px_120px_auto] items-center gap-2 border-b border-line-3 px-4 py-3 last:border-b-0">
      <span className="flex items-center gap-2 text-[13.5px] text-ink-3">
        {row.displayName || <span className="text-muted-3">—</span>}
        {isSelf && (
          <span className="rounded-[5px] border border-violet-line bg-violet-tint px-1.5 py-0.5 text-[11px] text-violet-ink">
            you
          </span>
        )}
      </span>
      <span className="truncate text-[12.5px] text-muted-2">
        {row.email || "—"}
      </span>
      <div className="flex flex-col gap-1">
        <select
          value={row.role}
          disabled={isSelf || pending}
          onChange={(e) => onRoleChange(e.target.value)}
          title={
            isSelf
              ? "You can't change your own role — ask another admin."
              : undefined
          }
          className="rounded-[7px] border border-line px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-violet disabled:cursor-not-allowed disabled:opacity-60"
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ErrorNote error={error} />
      </div>
      <span className="text-[12.5px] text-muted-3 tabular-nums">
        {formatJoined(row.createdAt)}
      </span>
      <div className="flex items-center justify-end">
        {isSelf ? (
          <span
            className="cursor-default text-[12px] text-muted-3"
            title="You can't remove your own account — ask another admin."
          >
            —
          </span>
        ) : (
          <ConfirmDelete
            triggerLabel="Remove"
            title={`Remove ${row.displayName || row.email || "this account"}?`}
            description={
              <>
                Removes their staff access only — the login itself
                isn&rsquo;t deleted. Batches they own keep them as owner, but
                any pod links they created are deleted, and responses that
                came through those links keep their batch while losing pod
                attribution.
              </>
            }
            confirmLabel="Remove"
            onConfirm={() => removeStaff(row.userId)}
          />
        )}
      </div>
    </div>
  );
}
