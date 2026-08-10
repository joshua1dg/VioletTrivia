"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

import { bootstrapParticipantId } from "@/lib/participant/client";
import { registerParticipant } from "@/app/b/actions";

/**
 * The tiny client bootstrap (PLAN §5.14). Rendered ONLY when the server saw
 * no `violet_pid` cookie: it establishes an identity (localStorage, or a
 * fresh uuid), mirrors it to the cookie, then asks the server to render this
 * page again now that an identity exists.
 *
 * Spinner-less and instant by design — this runs once per browser, ever,
 * and the round trip should not look like a loading state.
 *
 * Registration is fire-and-forget: `submitAsync` calls `ensureParticipant`
 * before every insert (verified in `responses.service.ts`), so a dropped or
 * failed registration here is not fatal — the write path self-heals on the
 * first answer. This call exists so a participant who never answers
 * anything is still on record.
 */
export function Bootstrap({ batchToken }: { batchToken: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const { id, cookieWasMissing } = bootstrapParticipantId();

    if (cookieWasMissing) {
      startTransition(() => {
        registerParticipant({ participantId: id, batchToken }).catch(() => {
          // Non-fatal — see the note above. Nothing to show; submit repairs it.
        });
      });
    }

    router.refresh();
  }, [router, batchToken, startTransition]);

  return null;
}
