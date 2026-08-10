import {
  AddButton,
  Field,
  ItemCard,
  KeySection,
  TextArea,
  TextInput,
} from "@/components/admin/form";
import type {
  AuthorProps,
  RankVariantsContent,
  RankVariantsKey,
} from "@/lib/templates/types";

export const emptyRankVariants = (): {
  content: RankVariantsContent;
  answerKey: RankVariantsKey;
} => ({
  content: {
    turns: [],
    options: [],
    shuffle: true,
    subhead: "",
    notePrompt: "What separates your top pick from your second?",
  },
  answerKey: { keyOrder: [], rationale: "" },
});

/** Next unused single letter, so ids stay short and stable. */
function nextId(taken: string[]) {
  const letters = "abcdefghijklmnopqrstuvwxyz".split("");
  return letters.find((l) => !taken.includes(l)) ?? `v${taken.length + 1}`;
}

export function RankVariantsAuthor({
  content,
  answerKey,
  onContent,
  onAnswerKey,
}: AuthorProps<RankVariantsContent, RankVariantsKey>) {
  const setVariant = (id: string, patch: Partial<{ body: string; note: string }>) =>
    onContent({
      ...content,
      options: content.options.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    });

  const addVariant = () => {
    const id = nextId(content.options.map((o) => o.id));
    onContent({
      ...content,
      options: [...content.options, { id, body: "", note: "" }],
    });
    onAnswerKey({ ...answerKey, keyOrder: [...answerKey.keyOrder, id] });
  };

  const removeVariant = (id: string) => {
    onContent({
      ...content,
      options: content.options.filter((o) => o.id !== id),
    });
    onAnswerKey({
      ...answerKey,
      keyOrder: answerKey.keyOrder.filter((k) => k !== id),
    });
  };

  /** Same arrow reordering the reviewer uses, so there's one interaction model. */
  const moveKey = (from: number, to: number) => {
    if (to < 0 || to >= answerKey.keyOrder.length) return;
    const next = answerKey.keyOrder.slice();
    next.splice(to, 0, next.splice(from, 1)[0]);
    onAnswerKey({ ...answerKey, keyOrder: next });
  };

  return (
    <div className="flex flex-col gap-5">
      <Field
        label="Sub-prompt"
        hint="Sits under the main prompt. What should reviewers hold constant?"
      >
        <TextInput
          value={content.subhead ?? ""}
          onChange={(v) => onContent({ ...content, subhead: v })}
          placeholder="All four promise the same change. Only the delivery differs."
        />
      </Field>

      <Field
        label="Variants"
        hint="Every reviewer sees these shuffled. The note describes what the variant does structurally — it shows on wide screens only."
        aside={
          <span className="text-[12px] text-muted-3">
            {content.options.length} variants
          </span>
        }
      >
        <div className="flex flex-col gap-2.5">
          {content.options.map((opt) => (
            <ItemCard
              key={opt.id}
              index={opt.id.toUpperCase()}
              onRemove={() => removeVariant(opt.id)}
            >
              <TextArea
                rows={2}
                value={opt.body}
                onChange={(v) => setVariant(opt.id, { body: v })}
                placeholder="The reply as the model would send it…"
              />
              <TextInput
                value={opt.note}
                onChange={(v) => setVariant(opt.id, { note: v })}
                placeholder="Acknowledgement · one sentence: an action, two locations, and what it leaves behind."
              />
            </ItemCard>
          ))}
        </div>
        <AddButton onClick={addVariant}>Add variant</AddButton>
      </Field>

      <KeySection>
        <Field
          label="Correct order, best first"
          hint="grade is an exact match against this. With four variants that's 1-in-24 by chance — expect low scores, and don't present it as one."
        >
          <div className="flex flex-col gap-2">
            {answerKey.keyOrder.map((id, index) => {
              const variant = content.options.find((o) => o.id === id);
              if (!variant) return null;
              return (
                <div
                  key={id}
                  className="flex items-start gap-3 rounded-[9px] border border-line bg-white p-3"
                >
                  <span className="flex shrink-0 flex-col gap-0.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => moveKey(index, index - 1)}
                      disabled={index === 0}
                      aria-label={
                        index === 0 ? "Already first" : `Move up to position ${index}`
                      }
                      className="cursor-pointer px-1 text-[10px] text-muted-3 disabled:cursor-not-allowed disabled:text-line-4"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moveKey(index, index + 1)}
                      disabled={index === answerKey.keyOrder.length - 1}
                      aria-label={
                        index === answerKey.keyOrder.length - 1
                          ? "Already last"
                          : `Move down to position ${index + 2}`
                      }
                      className="cursor-pointer px-1 text-[10px] text-muted-3 disabled:cursor-not-allowed disabled:text-line-4"
                    >
                      ▼
                    </button>
                  </span>
                  <span className="flex size-[22px] shrink-0 items-center justify-center rounded-md bg-line-3 text-[12px] font-semibold text-muted">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] leading-[1.55] text-ink-3">
                    {variant.body || (
                      <span className="text-faint italic">Empty variant</span>
                    )}
                  </span>
                </div>
              );
            })}
            {answerKey.keyOrder.length === 0 && (
              <span className="text-[12.5px] text-muted-3">
                Add variants first.
              </span>
            )}
          </div>
        </Field>

        <Field label="Why the top one wins">
          <TextArea
            rows={3}
            value={answerKey.rationale}
            onChange={(v) => onAnswerKey({ ...answerKey, rationale: v })}
            placeholder="It acknowledges, then commits in a single clean sentence…"
          />
        </Field>
      </KeySection>
    </div>
  );
}
