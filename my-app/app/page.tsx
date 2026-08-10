import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-[66ch] flex-col items-start gap-5 px-6 py-24">
      <span className="font-mono text-[12px] text-violet">Project Violet</span>
      <h1 className="text-[32px] font-semibold tracking-[-0.025em] text-ink">
        Alignment review
      </h1>
      <p className="text-[14px] leading-[1.65] text-muted-2">
        Reviewers arrive by link or by room number. The templates page renders
        each question shape on its own, with no session behind it.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/templates"
          className="rounded-[9px] bg-violet px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-violet-ink"
        >
          Question templates
        </Link>
        <Link
          href="/join"
          className="rounded-[9px] border border-line px-5 py-2.5 text-[14px] font-medium text-ink-4 transition-colors hover:bg-surface"
        >
          Join a room
        </Link>
        <Link
          href="/admin"
          className="rounded-[9px] border border-line px-5 py-2.5 text-[14px] font-medium text-ink-4 transition-colors hover:bg-surface"
        >
          Admin
        </Link>
      </div>
    </main>
  );
}
