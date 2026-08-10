/**
 * The last screen of the async flow — a friendly close, not a score (the
 * README is explicit: this tool judges communication, and `rank_variants`'
 * exact-match grading in particular would read as "everyone failed" if ever
 * shown as a percentage — so this screen counts, never scores).
 */
export function CompleteScreen({
  answeredCount,
  total,
  canSubmit,
}: {
  answeredCount: number;
  total: number;
  canSubmit: boolean;
}) {
  return (
    <div className="@container flex h-full min-h-0 flex-col items-center justify-center gap-3 rounded-[14px] border border-line bg-white p-8 text-center @3xl:p-12">
      <span
        aria-hidden
        className="flex size-11 items-center justify-center rounded-full bg-ok-tint text-ok-ink"
      >
        <svg viewBox="0 0 20 20" width="20" height="20" fill="none">
          <path
            d="M4 10.5l4 4 8-9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <h1 className="text-[19px] font-semibold tracking-[-0.015em] text-ink">
        That&rsquo;s the set
      </h1>
      <p className="max-w-[42ch] text-[13.5px] leading-[1.6] text-muted-2">
        {canSubmit
          ? `You answered ${answeredCount} of ${total}. Thanks for reviewing.`
          : `You read through ${answeredCount} of ${total}. This set is closed, so that's all there is.`}
      </p>
    </div>
  );
}
