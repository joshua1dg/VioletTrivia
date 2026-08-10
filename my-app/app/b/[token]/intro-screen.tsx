/**
 * The first screen of the async flow: batch name, how many questions, and a
 * single start control. No `"use client"` — it takes a handler as a prop and
 * is only ever rendered from `flow.tsx`, which is the client boundary.
 */
export function IntroScreen({
  batchName,
  total,
  canSubmit,
  onStart,
}: {
  batchName: string;
  total: number;
  /** false on an inactive/expired batch — framed as reading, not answering. */
  canSubmit: boolean;
  onStart: () => void;
}) {
  return (
    <div className="@container flex h-full min-h-0 flex-col items-center justify-center gap-6 rounded-[14px] border border-line bg-white p-8 text-center @3xl:p-12">
      <span className="font-mono text-[12px] text-violet">Project Violet</span>
      <div className="flex flex-col gap-2">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink @3xl:text-[26px]">
          {batchName}
        </h1>
        <p className="text-[14px] leading-[1.6] text-muted-2">
          {total} {total === 1 ? "question" : "questions"}. Anonymous, no
          score kept.
        </p>
      </div>

      {!canSubmit && (
        <p className="max-w-[44ch] text-[13px] leading-[1.55] text-muted-3">
          This set is closed to new answers. You can still read through it
          below.
        </p>
      )}

      <button
        type="button"
        onClick={onStart}
        className="cursor-pointer rounded-[9px] bg-violet px-6 py-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-violet-ink"
      >
        {canSubmit ? "Start" : "Read through"}
      </button>
    </div>
  );
}
