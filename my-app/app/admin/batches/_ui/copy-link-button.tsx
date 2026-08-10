"use client";

// Real "use client" — owns copied/not-copied state via a hook.

import { useState } from "react";

/**
 * The participant-facing link, assembled at display time (never persisted —
 * "Only the TOKEN is stored", migration comment on `batches.token`). Renders
 * the path either way; clicking it copies the full origin-qualified URL and
 * flips the label for a beat so the click has visible feedback.
 */
export function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/b/${token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission denied, or no secure context — the path is
      // still visible as the button's own label, so nothing is lost.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={path}
      className="w-fit cursor-pointer rounded-[6px] border border-line px-2 py-1 font-mono text-[11.5px] text-muted-2 transition-colors hover:bg-surface"
    >
      {copied ? "Copied" : path}
    </button>
  );
}
