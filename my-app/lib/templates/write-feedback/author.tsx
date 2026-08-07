import {
  Field,
  KeySection,
  RadioDot,
  TextArea,
  TextInput,
} from "@/components/admin/form";
import type {
  AuthorProps,
  WriteFeedbackContent,
  WriteFeedbackKey,
} from "@/lib/templates/types";

export const emptyWriteFeedback = (): {
  content: WriteFeedbackContent;
  answerKey: WriteFeedbackKey;
} => ({
  content: { turns: [], subject: { rationale: "" } },
  answerKey: {
    verdict: "Rationale is weak",
    verdictTone: "weak",
    blocks: { working: "", correcting: "", improve: "" },
    exemplar: "",
  },
});

export function WriteFeedbackAuthor({
  content,
  answerKey,
  onContent,
  onAnswerKey,
}: AuthorProps<WriteFeedbackContent, WriteFeedbackKey>) {
  const setBlock = (key: keyof WriteFeedbackKey["blocks"], value: string) =>
    onAnswerKey({
      ...answerKey,
      blocks: { ...answerKey.blocks, [key]: value },
    });

  return (
    <div className="flex flex-col gap-5">
      <Field
        label="The fellow's rationale"
        hint="What they wrote about the completion above — this is the thing being reviewed, not the model's reply. Reviewers respond to it in prose; there's nothing to pick."
      >
        <TextArea
          rows={3}
          value={content.subject.rationale}
          onChange={(v) =>
            onContent({ ...content, subject: { rationale: v } })
          }
          placeholder='"S2 — the nested bulleted list is an AI-ism. It reads machine-generated and clutters the answer. Misaligned."'
        />
      </Field>

      <KeySection>
        <Field label="Verdict on the rationale">
          <div className="flex flex-wrap items-center gap-5">
            <RadioDot
              selected={answerKey.verdictTone === "weak"}
              onSelect={() =>
                onAnswerKey({
                  ...answerKey,
                  verdictTone: "weak",
                  verdict: answerKey.verdict || "Rationale is weak",
                })
              }
              label="Weak"
            />
            <RadioDot
              selected={answerKey.verdictTone === "strong"}
              onSelect={() =>
                onAnswerKey({
                  ...answerKey,
                  verdictTone: "strong",
                  verdict: "Rationale is strong",
                })
              }
              label="Strong"
            />
          </div>
        </Field>

        <Field label="Pill text" hint="Shown at the top of the reveal.">
          <TextInput
            value={answerKey.verdict}
            onChange={(v) => onAnswerKey({ ...answerKey, verdict: v })}
          />
        </Field>

        <Field
          label="1 — What's working"
          hint="Credit the catch before correcting it. This is what stops the feedback reading as a takedown."
        >
          <TextArea
            rows={3}
            value={answerKey.blocks.working}
            onChange={(v) => setBlock("working", v)}
          />
        </Field>

        <Field
          label="2 — What needs correcting, and why"
          hint="The why matters more than the what. Without it the fellow learns nothing for next time."
        >
          <TextArea
            rows={4}
            value={answerKey.blocks.correcting}
            onChange={(v) => setBlock("correcting", v)}
          />
        </Field>

        <Field
          label="3 — How to improve"
          hint="A concrete next step, anchored to something specific in the completion."
        >
          <TextArea
            rows={3}
            value={answerKey.blocks.improve}
            onChange={(v) => setBlock("improve", v)}
          />
        </Field>

        <Field
          label="Feedback that lands"
          hint="The whole thing written out as one message — the worked example reviewers compare their own writing against."
        >
          <TextArea
            rows={5}
            value={answerKey.exemplar}
            onChange={(v) => onAnswerKey({ ...answerKey, exemplar: v })}
          />
        </Field>

        <Field label="Tone note" hint="Optional. Why the example reads the way it does.">
          <TextArea
            rows={2}
            value={answerKey.toneNote ?? ""}
            onChange={(v) => onAnswerKey({ ...answerKey, toneNote: v })}
          />
        </Field>
      </KeySection>
    </div>
  );
}
