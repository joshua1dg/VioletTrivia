import Link from "next/link";

import { JoinForm } from "./join/join-form";

/**
 * The home page IS the join screen (2026-08-11): a participant's only job
 * on arrival is typing the room number off the shared screen, so the input
 * is front and center with nothing to click through first. Staff take the
 * one quiet link in the corner — /login bounces a signed-in staffer
 * straight to /admin. The /templates gallery still exists as a dev
 * reference; it just isn't a front door anymore.
 *
 * `/join` stays alive as a redirect here, so presenter screens, QR
 * material, and anything bookmarked keeps working.
 */
export default function Home() {
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-[380px] flex-col items-center justify-center gap-8 px-6">
      <Link
        href="/login"
        className="absolute top-5 right-6 text-[13px] text-muted-2 transition-colors hover:text-ink-3"
      >
        Staff sign in
      </Link>

      <div className="flex flex-col items-center gap-2 text-center">
        <span className="font-mono text-[12px] text-violet">
          Project Violet
        </span>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">
          Join a room
        </h1>
        <p className="text-[13.5px] leading-[1.6] text-muted-2">
          The host will show a room number on the shared screen — something
          like{" "}
          <code className="rounded bg-line-3 px-1 py-0.5 text-[12px]">
            VLT-0042
          </code>
          .
        </p>
      </div>
      <JoinForm />
    </main>
  );
}
