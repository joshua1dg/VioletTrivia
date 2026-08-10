import { headers } from "next/headers";
import QRCode from "qrcode";

import { formatRoomNumber } from "@/lib/realtime/room-number";
import * as batches from "@/lib/services/batches";
import * as questions from "@/lib/services/questions";
import * as sessions from "@/lib/services/sessions";

import { PresenterShell } from "./presenter-shell";

/**
 * Server Component: current question (keyless, `getForReviewer`) plus, only
 * on `revealed`, the tally (`sessions.getTally` — staff-gated, loads the key
 * once, server-side). `params` is async in Next 16.
 */
export default async function PresentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await sessions.getById(id);
  const [batch, questionIds] = await Promise.all([
    batches.getById(session.batchId),
    batches.getQuestionIds(session.batchId),
  ]);

  const question = session.currentQuestionId
    ? await questions.getForReviewer(session.currentQuestionId)
    : null;

  const tally =
    session.phase === "revealed" && session.currentQuestionId
      ? await sessions.getTally(session.id, session.currentQuestionId)
      : null;

  // The QR encodes a deep link into the room, built from the REQUEST's own
  // host — so a presenter opened on a LAN IP (dev) or the deployed domain
  // hands phones a URL they can actually reach. `/live/[room]` registers and
  // logs the participant itself (`resolveRoom`), so scanning is equivalent
  // to typing the room number at /join, minus the optional display name.
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const joinUrl = `${proto}://${host}/live/${formatRoomNumber(session.roomNumber)}`;
  const joinQrSvg = await QRCode.toString(joinUrl, { type: "svg", margin: 1 });

  return (
    <PresenterShell
      sessionId={session.id}
      roomNumber={session.roomNumber}
      batchName={batch.name}
      totalQuestions={questionIds.length}
      initial={{
        phase: session.phase,
        currentQuestionId: session.currentQuestionId,
        currentPosition: session.currentPosition,
        responseCount: session.responseCount,
        votingEndsAt: session.votingEndsAt,
      }}
      question={question}
      tally={tally}
      joinUrl={joinUrl}
      joinQrSvg={joinQrSvg}
    />
  );
}
