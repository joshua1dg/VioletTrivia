"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { bootstrapParticipantId } from "@/lib/participant/client";

/**
 * The client half of the participant bootstrap (PLAN §5.14), for a phone
 * that lands on `/live/[room]` with no `violet_pid` cookie yet — normally
 * `/join` has already run this (via `joinRoom`), but a bookmarked or shared
 * `/live/[room]` link can arrive here directly. Mirrors what F4 writes for
 * `/b/[token]`: read localStorage (or generate a uuid), mirror it to the
 * cookie, then `router.refresh()` so the Server Component re-reads it.
 */
export function ParticipantBootstrap() {
  const router = useRouter();

  useEffect(() => {
    const { cookieWasMissing } = bootstrapParticipantId();
    if (cookieWasMissing) router.refresh();
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
      <span className="text-[15px] font-medium text-ink">Joining…</span>
    </main>
  );
}
