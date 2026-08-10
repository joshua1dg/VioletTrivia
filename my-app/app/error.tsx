"use client"; // Error boundaries must be Client Components — Next 16 file convention.

import { useEffect } from "react";

/**
 * Route-segment error boundary (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md).
 * Wraps every page/layout below the root in a React error boundary; the
 * root layout itself is covered by global-error.tsx instead.
 *
 * Next passes both `retry` and `reset`. The docs are explicit that v16.3.0
 * stabilized `retry` and recommends it over `reset` in the common case:
 * `retry()` re-fetches and re-renders the segment, where `reset()` only
 * clears the boundary's own state. This uses `retry` and falls back to
 * `reset` so it still works if only one prop is ever passed.
 */
export default function Error({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    // Server Component errors arrive here already scrubbed to a generic
    // message + digest (see the docs' `error.message` note) — logging the
    // digest is what actually lets this be matched to server-side logs.
    console.error(error);
  }, [error]);

  const recover = retry ?? reset;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <span className="text-[13px] font-medium text-muted-3">Project Violet</span>
      <h1 className="text-[17px] font-semibold text-ink">Something went wrong</h1>
      <p className="max-w-[46ch] text-[13.5px] leading-[1.6] text-muted-2">
        That didn&rsquo;t load. Nothing you did caused this — try again, and
        if it keeps happening the error has already been logged.
      </p>
      {recover && (
        <button
          type="button"
          onClick={() => recover()}
          className="cursor-pointer rounded-[7px] bg-violet px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-violet-ink"
        >
          Try again
        </button>
      )}
    </div>
  );
}
