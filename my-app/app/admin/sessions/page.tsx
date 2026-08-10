import Link from "next/link";

import { PageHeader } from "@/components/admin/ui";
import { EmptyState } from "@/components/feedback";
import * as batches from "@/lib/services/batches";
import * as sessions from "@/lib/services/sessions";
import { formatRoomNumber } from "@/lib/services/sessions";

import { ForceEndControl } from "./_ui/force-end-control";
import { StartSessionForm } from "./_ui/start-session-form";

/** Every open session's host controls are one row away; ended ones aren't
 * listed here at all — this screen is "what's live right now," not a log. */
export default async function SessionsPage() {
  const [openSessions, myOpen, startable] = await Promise.all([
    sessions.listOpenSessions(),
    sessions.getMyOpenSession(),
    sessions.listStartableBatches(),
  ]);

  const batchNames = new Map<string, string>();
  await Promise.all(
    [...new Set(openSessions.map((s) => s.batchId))].map(async (id) => {
      try {
        const batch = await batches.getById(id);
        batchNames.set(id, batch.name);
      } catch {
        // The batch was deleted out from under a still-open session — the
        // row falls back to "Unknown batch" below rather than failing the
        // whole list.
      }
    }),
  );

  return (
    <>
      <PageHeader title="Live sessions" meta={`${openSessions.length} open`} />

      <div className="flex flex-col gap-6 p-6">
        {myOpen ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-violet-line bg-violet-tint-2 px-4 py-3">
            <p className="text-[13.5px] text-violet-ink">
              You have an open session — room{" "}
              {formatRoomNumber(myOpen.roomNumber)}.{" "}
              <Link
                href={`/admin/sessions/${myOpen.id}`}
                className="underline"
              >
                Go to host controls
              </Link>
            </p>
            <ForceEndControl />
          </div>
        ) : (
          <StartSessionForm batches={startable} />
        )}

        {openSessions.length === 0 ? (
          <EmptyState title="No open sessions">
            Start one off a batch above — a room number is assigned
            automatically, and phones join it at <code>/join</code>.
          </EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-line-2 rounded-[10px] border border-line">
            {openSessions.map((session) => (
              <li
                key={session.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13.5px] font-medium text-ink">
                    {formatRoomNumber(session.roomNumber)} ·{" "}
                    {batchNames.get(session.batchId) ?? "Unknown batch"}
                  </span>
                  <span className="text-[12px] capitalize text-muted-3">
                    {session.phase}
                  </span>
                </div>
                <Link
                  href={`/admin/sessions/${session.id}`}
                  className="cursor-pointer rounded-[7px] border border-line px-3.5 py-2 text-[13px] text-ink-4 transition-colors hover:bg-surface"
                >
                  Host controls
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
