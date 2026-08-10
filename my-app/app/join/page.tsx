import { JoinForm } from "./join-form";

/** Room-number entry (README's `/join` route). Anonymous, no chrome — same
 * plain centered-card shape as `/login`, this app's other "arrive here with
 * nothing" screen. */
export default function JoinPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[380px] flex-col items-center justify-center gap-8 px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="font-mono text-[12px] text-violet">
          Project Violet
        </span>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">
          Join a room
        </h1>
        <p className="text-[13.5px] leading-[1.6] text-muted-2">
          The host will show a room number on the shared screen — something
          like <code className="rounded bg-line-3 px-1 py-0.5 text-[12px]">VLT-0042</code>.
        </p>
      </div>
      <JoinForm />
    </main>
  );
}
