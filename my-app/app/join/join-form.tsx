"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { ErrorNote, SubmitButton, type ErrorLike } from "@/components/feedback";
import { bootstrapParticipantId } from "@/lib/participant/client";
import { parseRoomNumber } from "@/lib/realtime/room-number";

import { joinRoom } from "../live/actions";

/**
 * Room-number entry + optional display name → `joinRoom` → `/live/[room]`.
 * Participant identity is the same localStorage-first bootstrap the async
 * flow uses (PLAN §5.14) — `bootstrapParticipantId()` both ensures the id
 * exists and mirrors it to the cookie `/live/[room]`'s Server Component
 * reads on the next navigation.
 */
export function JoinForm() {
  const router = useRouter();
  const [roomNumber, setRoomNumber] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<ErrorLike | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsedRoom = parseRoomNumber(roomNumber);
    if (parsedRoom === null) {
      setError(
        "That doesn't look like a room number — try VLT-0042 or just 42.",
      );
      return;
    }

    const { id } = bootstrapParticipantId();

    startTransition(async () => {
      const result = await joinRoom(
        roomNumber,
        id,
        displayName.trim() || undefined,
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/live/${parsedRoom}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] text-muted-2">Room number</span>
        <input
          value={roomNumber}
          onChange={(e) => setRoomNumber(e.target.value)}
          placeholder="VLT-0042"
          autoFocus
          disabled={pending}
          className="rounded-[9px] border border-line bg-white px-3.5 py-3 text-[15px] text-ink outline-none focus:border-violet"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] text-muted-2">
          Name <span className="text-faint">optional</span>
        </span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How the host sees you"
          maxLength={80}
          disabled={pending}
          className="rounded-[9px] border border-line bg-white px-3.5 py-3 text-[15px] text-ink outline-none focus:border-violet"
        />
      </label>

      <ErrorNote error={error} />

      <SubmitButton pending={pending} className="w-full justify-center py-3">
        Join room
      </SubmitButton>
    </form>
  );
}
