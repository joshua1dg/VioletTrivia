"use client";

import { useEffect, useState } from "react";

import { browserClient } from "@/lib/db/browser";
import type { SessionPhase } from "@/lib/services/sessions";

/**
 * The client lane (PLAN §5.16 / §7.3). NOT a repo — no request/response, no
 * service-role key, no server involvement at all. `live_sessions` is the one
 * table with an anon SELECT policy in the migration, and the only one in the
 * `supabase_realtime` publication, which is exactly why the phone and the
 * presenter subscribe to it directly rather than going through a Server
 * Action.
 *
 * Writes still go the normal way: a host control calls a Server Action, the
 * service updates the row with the service-role key, and Postgres pushes the
 * change back out here. **This module never writes to `live_sessions`.**
 *
 * Two independent things ride the same channel:
 *   1. `postgres_changes` UPDATE on `live_sessions`, filtered `id=eq.{id}` —
 *      phase, current_question_id, response_count.
 *   2. Presence on `session:{id}` — participants track themselves; the host
 *      and presenter only observe (`opts.track` stays false for them), so
 *      the headcount they read never includes their own connection.
 *
 * `init` seeds the very first render from the server-rendered props (PLAN:
 * "initial state from server-rendered props, subscription overlays") — it is
 * read once, on mount, not on every re-render, so passing a fresh object
 * from the caller on every render does not resubscribe the channel.
 */

export type SessionChannelState = {
  phase: SessionPhase;
  currentQuestionId: string | null;
  responseCount: number;
  /** Distinct presence keys currently tracked on this channel. 0 until the
   * first presence sync — never a stale count, but also never instant. */
  headcount: number;
  connected: boolean;
};

export type SessionChannelInit = {
  phase: SessionPhase;
  currentQuestionId: string | null;
  responseCount: number;
};

export type SessionChannelOptions = {
  /** Unique per connection (a participant id, or `host:<staffId>`). Required
   * to track presence; harmless to pass even when `track` is false. */
  presenceKey?: string;
  /** True for phones (they ARE the headcount). False/omitted for the host
   * and presenter, who only ever observe. */
  track?: boolean;
};

type LiveSessionsChangeRow = {
  phase: SessionPhase;
  current_question_id: string | null;
  response_count: number;
};

export function useSessionChannel(
  sessionId: string,
  init: SessionChannelInit,
  opts: SessionChannelOptions = {},
): SessionChannelState {
  const [row, setRow] = useState({
    phase: init.phase,
    currentQuestionId: init.currentQuestionId,
    responseCount: init.responseCount,
  });
  const [headcount, setHeadcount] = useState(0);
  const [connected, setConnected] = useState(false);

  const presenceKey = opts.presenceKey;
  const track = opts.track ?? false;

  useEffect(() => {
    const supabase = browserClient();
    const channel = presenceKey
      ? supabase.channel(`session:${sessionId}`, {
          config: { presence: { key: presenceKey } },
        })
      : supabase.channel(`session:${sessionId}`);

    channel
      .on<LiveSessionsChangeRow>(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          setRow({
            phase: payload.new.phase,
            currentQuestionId: payload.new.current_question_id,
            responseCount: payload.new.response_count,
          });
        },
      )
      .on("presence", { event: "sync" }, () => {
        setHeadcount(Object.keys(channel.presenceState()).length);
      })
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED" && track && presenceKey) {
          void channel.track({ joinedAt: Date.now() });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
    // Deliberately re-subscribing on `sessionId` alone. `init` is a one-time
    // seed and `presenceKey`/`track` are set once per mount by the caller —
    // including them would tear down and reopen the socket on every state
    // tick that happens to recompute a new options object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return { ...row, headcount, connected };
}
