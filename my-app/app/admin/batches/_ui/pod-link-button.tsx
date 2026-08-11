"use client";

// Real "use client" — owns fetched/not-fetched state and calls the Server
// Action imperatively via useTransition, same shape as new-batch-button.tsx.

import { useState, useTransition } from "react";

import { ErrorNote, type ErrorLike } from "@/components/feedback";

import { getMyPodLink } from "../actions";
import { CopyLinkButton } from "./copy-link-button";

/**
 * The master-batch row's second link column (PODS.md Wave 1). Nothing to
 * show until a lead asks for it — "Get pod link" calls the action once and
 * then behaves exactly like the canonical `CopyLinkButton`, because once it
 * exists it IS a link like any other. `initialToken` comes from the page's
 * own `listMyPodLinks()` read, so a lead who already has a link never sees
 * the "Get" state at all.
 */
export function PodLinkButton({
  batchId,
  initialToken,
}: {
  batchId: string;
  initialToken: string | null;
}) {
  const [token, setToken] = useState(initialToken);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorLike | null>(null);

  if (token) return <CopyLinkButton token={token} />;

  function get() {
    setError(null);
    startTransition(async () => {
      const result = await getMyPodLink(batchId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setToken(result.token);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={get}
        disabled={pending}
        className="w-fit cursor-pointer rounded-[6px] border border-line px-2 py-1 text-[11.5px] text-muted-2 transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Getting link…" : "Get pod link"}
      </button>
      <ErrorNote error={error} />
    </div>
  );
}
