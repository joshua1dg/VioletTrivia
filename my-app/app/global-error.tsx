"use client"; // Error boundaries must be Client Components — Next 16 file convention.

import { useEffect } from "react";

/**
 * Root error boundary — only fires when the root layout itself throws,
 * which is rare; app/error.tsx catches everything below it. Per the docs
 * (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md,
 * "Global Error" section), this file *replaces* the root layout when
 * active, so it must declare its own <html>/<body> and gets none of
 * globals.css, next/font, or the app's own theme — the docs say so
 * explicitly ("does not include your global styles... apply it inside your
 * own global-error component"). Hence inline styles with hex values lifted
 * straight from the @theme tokens in globals.css, rather than Tailwind
 * classes that may not have any stylesheet to resolve against here.
 *
 * The design is light-only (globals.css's own header comment says so), so
 * there's no dark variant to reconcile.
 */
export default function GlobalError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const recover = retry ?? reset;

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          padding: "24px",
          textAlign: "center",
          fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
          background: "#f5f5f7", // --color-canvas
          color: "#15171c", // --color-ink
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 500, color: "#8a8f9b" /* --color-muted-3 */ }}>
          Project Violet
        </span>
        <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
        <p
          style={{
            maxWidth: "46ch",
            fontSize: 13.5,
            lineHeight: 1.6,
            color: "#767c89", // --color-muted-2
            margin: 0,
          }}
        >
          The app failed to load. Reloading usually fixes it; the error has
          been logged either way.
        </p>
        {recover && (
          <button
            type="button"
            onClick={() => recover()}
            style={{
              cursor: "pointer",
              borderRadius: 7,
              border: "none",
              background: "#6d4aff", // --color-violet
              color: "#fff",
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Try again
          </button>
        )}
      </body>
    </html>
  );
}
