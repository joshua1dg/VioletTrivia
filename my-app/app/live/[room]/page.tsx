import type { ReactNode } from "react";

import { readParticipantId } from "@/lib/participant/server";
import { parseRoomNumber } from "@/lib/realtime/room-number";
import * as questions from "@/lib/services/questions";
import * as sessions from "@/lib/services/sessions";

import { ParticipantBootstrap } from "./participant-bootstrap";
import { PhoneShell } from "./phone-shell";

/**
 * The phone view's Server Component (PLAN §9 F5, §7.1). May call
 * `getForReviewer` and NOTHING ELSE from `lib/services/questions` — no
 * `getWithKey`, no `listWithKey` (§5.10's corollary).
 *
 * `params` is async in Next 16 (`node_modules/next/dist/docs/01-app`).
 */
export default async function LivePhonePage({
  params,
}: {
  params: Promise<{ room: string }>;
}) {
  const { room } = await params;
  const roomNumber = parseRoomNumber(room);

  if (roomNumber === null) {
    return (
      <RoomMessage title="That's not a room number">
        Check the code on the shared screen — it looks like VLT-0042.
      </RoomMessage>
    );
  }

  // Checked BEFORE the participant bootstrap, on purpose: `resolveRoom`
  // needs an identity, so leaving this until after it meant a dead room
  // number rendered the bootstrap's "Joining…" shell and stayed there.
  // A wrong number is the common case on this screen — it has to say so.
  if (!(await sessions.roomIsOpen(roomNumber))) {
    return (
      <RoomMessage title="No session is running in this room">
        Check the number on the shared screen — it looks like VLT-0042. If it
        matches, the host hasn&rsquo;t started the session yet.
      </RoomMessage>
    );
  }

  const participantId = await readParticipantId();
  if (!participantId) {
    return <ParticipantBootstrap />;
  }

  let view;
  try {
    // Still guarded: the host can end the session between the check above
    // and this call, and `resolveRoom` throws `not_found` if they do.
    view = await sessions.resolveRoom({ roomNumber, participantId });
  } catch {
    return (
      <RoomMessage title="This room isn't open">
        Double check the code, or ask the host for a new one.
      </RoomMessage>
    );
  }

  const [question, alreadyAnswered] = await Promise.all([
    view.currentQuestionId
      ? questions.getForReviewer(view.currentQuestionId)
      : Promise.resolve(null),
    view.currentQuestionId
      ? sessions.hasAnswered(view.sessionId, view.currentQuestionId, participantId)
      : Promise.resolve(false),
  ]);

  return (
    <PhoneShell
      sessionId={view.sessionId}
      participantId={participantId}
      initial={{
        phase: view.phase,
        currentQuestionId: view.currentQuestionId,
        // Not returned by `resolveRoom`, and the phone never displays it —
        // the Realtime overlay corrects this the moment anything changes.
        responseCount: 0,
      }}
      question={question}
      alreadyAnswered={alreadyAnswered}
    />
  );
}

function RoomMessage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
      <span className="text-[15px] font-medium text-ink">{title}</span>
      <p className="max-w-[42ch] text-[13.5px] leading-[1.6] text-muted-2">
        {children}
      </p>
    </main>
  );
}
