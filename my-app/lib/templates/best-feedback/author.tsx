import {
  AddButton,
  Field,
  ItemCard,
  KeySection,
  RadioDot,
  TextArea,
  TextInput,
} from "@/components/admin/form";
import { Chip } from "@/components/admin/ui";
import type {
  AuthorProps,
  BestFeedbackContent,
  BestFeedbackKey,
} from "@/lib/templates/types";

export const emptyBestFeedback = (): {
  content: BestFeedbackContent;
  answerKey: BestFeedbackKey;
} => ({
  content: {
    turns: [],
    subject: { rationale: "", calls: [] },
    options: [],
  },
  answerKey: { key: "", bullets: [] },
});

function nextId(taken: string[]) {
  const letters = "abcdefghijklmnopqrstuvwxyz".split("");
  return letters.find((l) => !taken.includes(l)) ?? `o${taken.length + 1}`;
}

export function BestFeedbackAuthor({
  content,
  answerKey,
  onContent,
  onAnswerKey,
  principles,
}: AuthorProps<BestFeedbackContent, BestFeedbackKey>) {
  const calls = content.subject.calls;

  const toggleCall = (code: string) => {
    const existing = calls.find((c) => c.code === code);
    const next = existing
      ? calls.filter((c) => c.code !== code)
      : [...calls, { code, verdict: "ok" as const }];
    onContent({ ...content, subject: { ...content.subject, calls: next } });
  };

  const setVerdict = (code: string, verdict: "ok" | "wrong") =>
    onContent({
      ...content,
      subject: {
        ...content.subject,
        calls: calls.map((c) => (c.code === code ? { ...c, verdict } : c)),
      },
    });

  const addOption = () =>
    onContent({
      ...content,
      options: [
        ...content.options,
        { id: nextId(content.options.map((o) => o.id)), body: "" },
      ],
    });

  const setBullet = (i: number, patch: Partial<{ label: string; detail: string }>) =>
    onAnswerKey({
      ...answerKey,
      bullets: answerKey.bullets.map((b, idx) =>
        idx === i ? { ...b, ...patch } : b,
      ),
    });

  return (
    <div className="flex flex-col gap-5">
      <Field
        label="The fellow's rationale"
        hint="What they wrote about the completion above. This is the thing being judged, not the model's reply."
      >
        <TextArea
          rows={3}
          value={content.subject.rationale}
          onChange={(v) =>
            onContent({
              ...content,
              subject: { ...content.subject, rationale: v },
            })
          }
          placeholder="…and S1 for answer bloat — the reply piles five bulleted facts on the user."
        />
      </Field>

      <Field
        label="Rubric calls they made"
        hint="Mark each call right or wrong. These render as coloured chips beside the rationale, and they're what the feedback has to address."
      >
        <div className="flex flex-wrap gap-2">
          {principles.map((p) => (
            <Chip
              key={p.code}
              active={calls.some((c) => c.code === p.code)}
              onClick={() => toggleCall(p.code)}
            >
              {p.code}
            </Chip>
          ))}
        </div>
        {calls.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-4">
            {calls.map((c) => (
              <div key={c.code} className="flex items-center gap-2">
                <span className="font-mono text-[12px] text-muted">{c.code}</span>
                <button
                  type="button"
                  onClick={() => setVerdict(c.code, "ok")}
                  className={`cursor-pointer rounded border px-2 py-0.5 text-[11.5px] ${
                    c.verdict === "ok"
                      ? "border-ok-line bg-ok-tint text-ok-ink"
                      : "border-line text-muted-3"
                  }`}
                >
                  holds up
                </button>
                <button
                  type="button"
                  onClick={() => setVerdict(c.code, "wrong")}
                  className={`cursor-pointer rounded border px-2 py-0.5 text-[11.5px] ${
                    c.verdict === "wrong"
                      ? "border-bad-line bg-bad-tint text-bad-ink"
                      : "border-line text-muted-3"
                  }`}
                >
                  wrong
                </button>
              </div>
            ))}
          </div>
        )}
      </Field>

      <Field
        label="Candidate responses"
        hint="Four is what the design shows. One should be genuinely good; the rest should fail in different ways — too blunt, too vague, or doing the work for them."
        aside={
          <span className="text-[12px] text-muted-3">
            {content.options.length} options
          </span>
        }
      >
        <div className="flex flex-col gap-2.5">
          {content.options.map((opt) => (
            <ItemCard
              key={opt.id}
              index={opt.id.toUpperCase()}
              selected={answerKey.key === opt.id}
              onRemove={() =>
                onContent({
                  ...content,
                  options: content.options.filter((o) => o.id !== opt.id),
                })
              }
            >
              <TextArea
                rows={2}
                value={opt.body}
                onChange={(v) =>
                  onContent({
                    ...content,
                    options: content.options.map((o) =>
                      o.id === opt.id ? { ...o, body: v } : o,
                    ),
                  })
                }
                placeholder="“Your I3 and S3 applications are excellent, but…”"
              />
            </ItemCard>
          ))}
        </div>
        <AddButton onClick={addOption}>Add response</AddButton>
      </Field>

      <KeySection>
        <Field label="Which response helps most?">
          <div className="flex flex-wrap gap-5">
            {content.options.map((opt) => (
              <RadioDot
                key={opt.id}
                selected={answerKey.key === opt.id}
                onSelect={() => onAnswerKey({ ...answerKey, key: opt.id })}
                label={opt.id.toUpperCase()}
              />
            ))}
            {content.options.length === 0 && (
              <span className="text-[12.5px] text-muted-3">
                Add responses first.
              </span>
            )}
          </div>
        </Field>

        <Field
          label="What makes it strong"
          hint="A label and the reason behind it. These render as the bullet list on the reveal."
        >
          <div className="flex flex-col gap-2.5">
            {answerKey.bullets.map((b, i) => (
              <ItemCard
                key={i}
                onRemove={() =>
                  onAnswerKey({
                    ...answerKey,
                    bullets: answerKey.bullets.filter((_, idx) => idx !== i),
                  })
                }
              >
                <TextInput
                  value={b.label}
                  onChange={(v) => setBullet(i, { label: v })}
                  placeholder="Opens with a strength"
                />
                <TextInput
                  value={b.detail}
                  onChange={(v) => setBullet(i, { detail: v })}
                  placeholder="Leading with corrections puts people on the defensive."
                />
              </ItemCard>
            ))}
          </div>
          <AddButton
            onClick={() =>
              onAnswerKey({
                ...answerKey,
                bullets: [...answerKey.bullets, { label: "", detail: "" }],
              })
            }
          >
            Add point
          </AddButton>
        </Field>
      </KeySection>
    </div>
  );
}
