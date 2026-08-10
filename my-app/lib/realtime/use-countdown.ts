"use client";

import { useEffect, useState } from "react";

/**
 * Seconds remaining until `endsAt`, ticking, floored at 0 — or null when
 * there is no deadline. Client lane, beside `useSessionChannel`, because
 * every live surface (host, presenter, phone) renders the same countdown
 * from the same Realtime-pushed `voting_ends_at`.
 *
 * The display runs on the viewer's clock; enforcement does not — the submit
 * guard in `app/live/actions.ts` compares against the SERVER's clock, so a
 * skewed phone only ever mis-renders the number, never buys time.
 */
export function useCountdown(endsAt: string | null): number | null {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() =>
    remaining(endsAt),
  );

  // A deadline change (new question, timer restarted, timer cleared) resets
  // the readout in the same render — the render-phase adjustment React
  // documents, not an effect, so there's no one-frame flash of the old value.
  const [prevEndsAt, setPrevEndsAt] = useState(endsAt);
  if (endsAt !== prevEndsAt) {
    setPrevEndsAt(endsAt);
    setSecondsLeft(remaining(endsAt));
  }

  useEffect(() => {
    if (!endsAt) return;

    const tick = setInterval(() => {
      const left = remaining(endsAt);
      setSecondsLeft(left);
      if (left === 0) clearInterval(tick);
    }, 250);
    return () => clearInterval(tick);
  }, [endsAt]);

  return secondsLeft;
}

function remaining(endsAt: string | null): number | null {
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000));
}

/** "1:05" / "0:42" — mm:ss for the tight corners these render in. */
export function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
