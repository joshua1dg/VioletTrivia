import type { BestFeedbackContent, BestFeedbackKey } from "@/lib/templates/types";

/** The T3 example from the design PDF. */

export const bestFeedbackPrompt = "Which feedback helps this fellow most?";

export const bestFeedbackContent: BestFeedbackContent = {
  turns: [
    { role: "user", body: "why is the build failing on my branch?" },
    {
      role: "assistant",
      body: [
        "Here's the state I found:",
        "- You're on `feat/i18n`, 3 commits behind main",
        "- `lockfile` conflicts are unresolved",
        "- CI runs Node 20, your local is 18",
      ].join("\n"),
    },
  ],
  subject: {
    rationale:
      "…and S1 for answer bloat — the reply piles five bulleted facts on the user instead of answering in a sentence.",
    calls: [
      { code: "I3", verdict: "ok" },
      { code: "S3", verdict: "ok" },
      { code: "S1", verdict: "wrong" },
    ],
  },
  options: [
    { id: "a", body: "“The S1 is wrong. Remove it.”" },
    {
      id: "b",
      body: "“Your I3 and S3 applications are excellent, but the S1 penalty for answer bloat is misapplied here. S1 encourages scannability, and a bulleted list of five diagnostic facts is far more scannable than the same content as a paragraph. Consider removing the S1 as a misalignment.”",
    },
    {
      id: "c",
      body: "“This rationale is a bit harsh — try to be more careful with the rubric next time.”",
    },
    {
      id: "d",
      body: "“I've edited your rationale and dropped the S1 myself. Use my wording as the template going forward.”",
    },
  ],
  footerHint: "There is a stronger answer here — you'll see it next.",
};

export const bestFeedbackKey: BestFeedbackKey = {
  key: "b",
  bullets: [
    {
      label: "Opens with a strength",
      detail: "Leading with corrections puts people on the defensive.",
    },
    {
      label: "Suggests, doesn't order",
      detail: "“Consider removing” — you can still fix it yourself on the last pass.",
    },
    {
      label: "Points at the specific call",
      detail: "Names S1 and what it was applied to, not the rationale in general.",
    },
    {
      label: "Explains why before the fix",
      detail: "Without the reason, the fellow learns nothing for next time.",
    },
    {
      label: "Leaves a clear next step",
      detail: "Reason first, then the suggestion — that order matters.",
    },
  ],
};
