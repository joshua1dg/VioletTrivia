import type { ReactNode } from "react";

export function Field({
  label,
  hint,
  aside,
  children,
}: {
  label: string;
  hint?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12.5px] font-medium text-ink-4">{label}</span>
        {aside}
      </div>
      {children}
      {hint && (
        <span className="text-[12px] leading-[1.5] text-muted-3">{hint}</span>
      )}
    </div>
  );
}

const inputBase =
  "w-full rounded-[9px] border border-line bg-white px-3.5 py-2.5 text-[13.5px] text-ink-3 outline-none transition-colors focus:border-violet-line";

export function TextInput({
  value,
  onChange,
  placeholder,
  mono,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputBase} ${mono ? "font-mono text-[12.5px]" : ""}`}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputBase} resize-y leading-[1.6]`}
    />
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="inline-flex self-start overflow-hidden rounded-[8px] border border-line">
      {options.map((opt, i) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`cursor-pointer px-4 py-2 text-[13px] font-medium transition-colors ${
            i > 0 ? "border-l border-line" : ""
          } ${
            value === opt.value
              ? "bg-violet text-white"
              : "bg-white text-muted hover:bg-surface"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** A card wrapping one editable item in a list, with a remove control. */
export function ItemCard({
  index,
  onRemove,
  children,
  selected,
}: {
  index?: string;
  onRemove?: () => void;
  children: ReactNode;
  selected?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-[9px] border p-3.5 ${
        selected ? "border-violet-line bg-violet-tint" : "border-line bg-white"
      }`}
    >
      {index && (
        <span className="w-4 shrink-0 pt-1 font-mono text-[11px] text-muted-3">
          {index}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove"
          className="shrink-0 cursor-pointer rounded px-1 text-[13px] text-faint-2 transition-colors hover:text-bad-ink"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export function AddButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer self-start text-[12.5px] font-medium text-violet-ink hover:text-violet-deep"
    >
      ＋ {children}
    </button>
  );
}

/** Pick-one control used to mark which option is the key. */
export function RadioDot({
  selected,
  onSelect,
  label,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="flex cursor-pointer items-center gap-2 text-[12.5px] font-medium"
    >
      <span
        aria-hidden
        className={`size-4 shrink-0 rounded-full border-[1.5px] ${
          selected ? "border-ok bg-ok" : "border-dot bg-white"
        }`}
      />
      <span className={selected ? "text-ok-ink" : "text-muted"}>{label}</span>
    </button>
  );
}

/** Marks the section of a form that holds the answer key. */
export function KeySection({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-[10px] border border-ok-line bg-ok-tint/40 p-4">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="size-2.5 rounded-full bg-ok" />
        <span className="text-[12.5px] font-semibold text-ok-ink">
          Answer key
        </span>
        <span className="text-[12px] text-muted-3">
          never sent to a reviewer before the reveal
        </span>
      </div>
      {children}
    </div>
  );
}
