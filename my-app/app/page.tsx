import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-[66ch] flex-col items-start gap-5 px-6 py-24">
      <span className="font-mono text-[12px] text-violet">Project Violet</span>
      <h1 className="text-[32px] font-semibold tracking-[-0.025em] text-ink">
        Alignment review
      </h1>
      <p className="text-[14px] leading-[1.65] text-muted-2">
        Nothing wired to the database yet. The question templates are built and
        interactive.
      </p>
      <Link
        href="/templates"
        className="rounded-[9px] bg-violet px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-violet-ink"
      >
        Question templates
      </Link>
    </main>
  );
}
