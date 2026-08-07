/**
 * The optional "Why?" note. Shared rather than per-template, because it maps
 * to responses.rationale, which every template offers.
 */
export function WhyNote({
  value,
  onChange,
  label = "Why?",
  max = 280,
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  max?: number;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-[9px] border border-line bg-surface px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] text-muted-2">
          {label} <span className="text-faint">optional</span>
        </span>
        {value.length > 0 && (
          <span className="text-[11px] text-faint">
            {value.length} / {max}
          </span>
        )}
      </div>
      <textarea
        value={value}
        maxLength={max}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder="What made you pick that one?"
        className="resize-none bg-transparent text-[13.5px] leading-[1.6] text-ink-4 outline-none"
      />
    </div>
  );
}
