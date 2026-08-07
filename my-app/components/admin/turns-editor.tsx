import type { Turn } from "@/lib/templates/types";
import { AddButton, Field, ItemCard, TextArea, TextInput } from "./form";

/**
 * Shared because every template's content has `turns` — the conversation
 * being judged. It lives in the editor rather than in any Author form for
 * the same reason the Why note lives in the flow: it isn't template-specific.
 */
export function TurnsEditor({
  turns,
  onChange,
}: {
  turns: Turn[];
  onChange: (next: Turn[]) => void;
}) {
  const patch = (i: number, next: Partial<Turn>) =>
    onChange(turns.map((t, idx) => (idx === i ? { ...t, ...next } : t)));

  return (
    <Field
      label="Conversation excerpt"
      hint="Bodies take light markdown — lines starting with “- ” become bullets, `backticks` become code."
    >
      <div className="flex flex-col gap-2.5">
        {turns.map((turn, i) => (
          <ItemCard key={i} onRemove={() => onChange(turns.filter((_, x) => x !== i))}>
            <div className="flex items-center gap-2">
              {(["user", "assistant"] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => patch(i, { role })}
                  className={`cursor-pointer rounded border px-2 py-0.5 font-mono text-[10.5px] tracking-[0.08em] uppercase transition-colors ${
                    turn.role === role
                      ? role === "assistant"
                        ? "border-violet-line bg-violet-tint text-violet-ink"
                        : "border-line bg-surface text-muted"
                      : "border-line text-faint hover:bg-surface"
                  }`}
                >
                  {role}
                </button>
              ))}
              <span className="ml-auto w-[150px]">
                <TextInput
                  value={turn.meta ?? ""}
                  onChange={(v) => patch(i, { meta: v || undefined })}
                  placeholder="turn 12"
                  mono
                />
              </span>
            </div>
            <TextArea
              rows={2}
              value={turn.body}
              onChange={(v) => patch(i, { body: v })}
              placeholder="What was said…"
            />
          </ItemCard>
        ))}

        {turns.length === 0 && (
          <p className="rounded-[9px] border border-dashed border-line-4 px-3.5 py-4 text-[12.5px] text-muted-3">
            No turns yet. Every template shows the reviewer a conversation.
          </p>
        )}
      </div>
      <AddButton
        onClick={() => onChange([...turns, { role: "user", body: "" }])}
      >
        Add turn
      </AddButton>
    </Field>
  );
}
