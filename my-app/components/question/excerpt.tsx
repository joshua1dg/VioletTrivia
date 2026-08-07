import type { Turn } from "@/lib/templates/types";
import { RichText } from "./rich-text";

const ROLE_LABEL: Record<Turn["role"], string> = {
  user: "USER",
  assistant: "ASSISTANT",
};

function Label({ role }: { role: Turn["role"] }) {
  return (
    <span
      className={`font-mono text-[10.5px] tracking-[0.08em] ${
        role === "assistant" ? "text-violet" : "text-muted-3"
      }`}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

/**
 * The conversation being judged.
 *
 * `separate` gives each turn its own card with the assistant's meta in a
 * header bar — that's T1. `grouped` puts them in one card divided by rules,
 * which is T3. Same data either way.
 */
export function Excerpt({
  turns,
  variant = "grouped",
}: {
  turns: Turn[];
  variant?: "separate" | "grouped";
}) {
  if (variant === "separate") {
    return (
      <div className="flex flex-col gap-3">
        {turns.map((turn, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-[10px] border border-line bg-surface"
          >
            <div className="flex items-center justify-between gap-3 border-b border-line-2 px-4 py-2.5">
              <Label role={turn.role} />
              {turn.meta && (
                <span className="text-[11.5px] text-muted-3">{turn.meta}</span>
              )}
            </div>
            <div className="px-4 py-3.5 text-[14px] leading-[1.6] text-ink-3 @3xl:text-[15px]">
              <RichText body={turn.body} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
      {turns.map((turn, i) => (
        <div
          key={i}
          className={`flex flex-col gap-1.5 px-4 py-3.5 ${
            i > 0 ? "border-t border-line-2" : ""
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <Label role={turn.role} />
            {turn.meta && (
              <span className="text-[11.5px] text-muted-3">{turn.meta}</span>
            )}
          </div>
          <div
            className={`text-[13.5px] leading-[1.6] @3xl:text-[14px] ${
              turn.role === "user" ? "text-muted" : "text-ink-3"
            }`}
          >
            <RichText body={turn.body} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A rubric code the fellow invoked, colored by whether the call holds up. */
export function CodeChip({
  code,
  verdict,
}: {
  code: string;
  verdict?: "ok" | "wrong";
}) {
  const tone =
    verdict === "wrong"
      ? "border-bad-line bg-bad-tint text-bad-ink"
      : verdict === "ok"
        ? "border-ok-line bg-ok-tint text-ok-ink"
        : "border-line bg-white text-muted";

  return (
    <span
      className={`rounded-[5px] border px-2 py-0.5 font-mono text-[11px] ${tone}`}
    >
      {code}
    </span>
  );
}
