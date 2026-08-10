import { Chip } from "@/components/admin/ui";
import {
  Field,
  KeySection,
  RadioDot,
  TextArea,
  TextInput,
} from "@/components/admin/form";
import type {
  AuthorProps,
  WhichPrincipleContent,
  WhichPrincipleKey,
} from "@/lib/templates/types";

/** Paragraphs are authored as prose and stored split on blank lines. */
const toParagraphs = (text: string) =>
  text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
const fromParagraphs = (paragraphs?: string[]) => (paragraphs ?? []).join("\n\n");

export const emptyWhichPrinciple = (): {
  content: WhichPrincipleContent;
  answerKey: WhichPrincipleKey;
} => ({
  content: { turns: [], inPlay: [], options: [], notePrompt: "Why?" },
  answerKey: { key: "", perOption: {} },
});

export function WhichPrincipleAuthor({
  content,
  answerKey,
  onContent,
  onAnswerKey,
  principles,
}: AuthorProps<WhichPrincipleContent, WhichPrincipleKey>) {
  const chosen = content.inPlay.map((p) => p.code);

  /** inPlay and options are two views of the same choice, so they move together. */
  const toggleCode = (code: string) => {
    const next = chosen.includes(code)
      ? chosen.filter((c) => c !== code)
      : [...chosen, code];

    const inPlay = next
      .map((c) => principles.find((p) => p.code === c))
      .filter((p): p is (typeof principles)[number] => Boolean(p))
      .map((p) => ({
        code: p.code,
        name: p.name,
        descriptor: p.descriptor ?? "",
      }));

    const options = inPlay.map((p) => ({
      id: p.code,
      principleCode: p.code,
    }));

    onContent({ ...content, inPlay, options });
    if (!next.includes(answerKey.key)) onAnswerKey({ ...answerKey, key: "" });
  };

  const setExplanation = (code: string, text: string) =>
    onAnswerKey({
      ...answerKey,
      perOption: { ...answerKey.perOption, [code]: toParagraphs(text) },
    });

  return (
    <div className="flex flex-col gap-5">
      <Field
        label="Principles in play"
        hint="At least two, more if the excerpt could plausibly be judged under several. Names and descriptors come from the Principles screen — you reference codes, you don't retype them. These also become the question's principle links; there's no second picker."
        aside={
          <span
            className={`text-[12px] ${chosen.length >= 2 ? "text-muted-3" : "text-bad-ink"}`}
          >
            {chosen.length < 2
              ? `${chosen.length} chosen — needs at least 2`
              : `${chosen.length} in play`}
          </span>
        }
      >
        <div className="flex flex-wrap gap-2">
          {principles.map((p) => (
            <Chip
              key={p.code}
              active={chosen.includes(p.code)}
              onClick={() => toggleCode(p.code)}
            >
              {p.code} — {p.name || "untitled"}
            </Chip>
          ))}
        </div>
      </Field>

      <KeySection>
        <Field label="Which code does this excerpt actually fail?">
          <div className="flex flex-wrap gap-5">
            {content.options.map((opt) => (
              <RadioDot
                key={opt.id}
                selected={answerKey.key === opt.id}
                onSelect={() =>
                  onAnswerKey({ ...answerKey, key: opt.id })
                }
                label={opt.principleCode}
              />
            ))}
            {content.options.length === 0 && (
              <span className="text-[12.5px] text-muted-3">
                Choose two principles first.
              </span>
            )}
          </div>
        </Field>

        {content.options.map((opt) => (
          <Field
            key={opt.id}
            label={
              answerKey.key === opt.id
                ? `${opt.principleCode} — why it's the better fit`
                : `${opt.principleCode} — why it isn't the issue here`
            }
            hint="Blank line starts a new paragraph."
          >
            <TextArea
              rows={3}
              value={fromParagraphs(answerKey.perOption[opt.id])}
              onChange={(v) => setExplanation(opt.id, v)}
            />
          </Field>
        ))}

        <Field label="How to tell them apart">
          <TextArea
            rows={2}
            value={answerKey.distinguish?.body ?? ""}
            onChange={(v) =>
              onAnswerKey({
                ...answerKey,
                distinguish: {
                  title: answerKey.distinguish?.title ?? "How to tell them apart",
                  body: v,
                },
              })
            }
            placeholder="Ask what the reader ends up without…"
          />
        </Field>

        <Field label="Footer line" hint="One sentence under the reveal.">
          <TextInput
            value={answerKey.summary ?? ""}
            onChange={(v) => onAnswerKey({ ...answerKey, summary: v })}
          />
        </Field>
      </KeySection>
    </div>
  );
}
