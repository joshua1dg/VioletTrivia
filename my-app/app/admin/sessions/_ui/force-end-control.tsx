"use client";

import { useRouter } from "next/navigation";

import { ConfirmDelete } from "@/components/feedback";

import { forceEndMine } from "../actions";

/**
 * "One open session per host, not per batch. An abandoned session blocks
 * that host from starting another, so a force-end control is needed"
 * (README). Offered unconditionally next to the "you have one open" banner
 * — ending is idempotent server-side, so there is nothing to disable.
 */
export function ForceEndControl() {
  const router = useRouter();

  return (
    <ConfirmDelete
      triggerLabel="Force-end my session"
      title="End your open session?"
      description="Ends it immediately. Every phone in the room and the presenter screen will show it as ended — you can start a new one right after."
      confirmLabel="End it"
      onConfirm={async () => {
        const result = await forceEndMine();
        if (!result.ok) return { ok: false, message: result.message };
        router.refresh();
        return { ok: true };
      }}
    />
  );
}
