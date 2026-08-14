"use client";

/**
 * Demo port of `Audit Tracker.dc.html` — one self-contained page, hardcoded
 * data, no backend. Three surfaces on one page: the blind audit form, the
 * pod lead queue, and the project lead view. Desktop layout only (the
 * design's mobile frames and post-submit artboards are intentionally
 * omitted); every control is clickable, nothing persists.
 */

import { useRef, useState } from "react";

const MONO = "var(--font-plex-mono), ui-monospace, monospace";

type Tone = "amber" | "green" | "rose" | "violet" | "gray";

/** [bg, border, fg, accent] */
const TONE: Record<Tone, [string, string, string, string]> = {
  amber: ["#FDF6EC", "#F2DCB8", "#9A5B0B", "#C9821A"],
  green: ["#F1FAF6", "#BFE7D8", "#047857", "#059669"],
  rose: ["#FEF5F7", "#F6CDD6", "#BE123C", "#E11D48"],
  violet: ["#F7F5FF", "#DFDAFF", "#5B37F0", "#6D4AFF"],
  gray: ["#FAFAFB", "#E3E4E9", "#5C6270", "#C6CAD3"],
};

const ASSESSMENTS = [
  { code: "SCORE_MISCALIBRATION", label: "Score miscalibration" },
  { code: "LOW_EFFORT", label: "Low-effort review" },
  { code: "EVIDENCE_MISSING", label: "Evidence missing or unanchored" },
  { code: "WRONG_CODE", label: "Wrong principle code applied" },
  { code: "FEEDBACK_QUALITY", label: "Feedback not actionable" },
];

const FACTORS = [
  { code: "GUIDELINE_DRIFT", label: "Guideline drift" },
  { code: "RUSHED", label: "Rushed pass" },
  { code: "COPIED_RATIONALE", label: "Copied rationale" },
  { code: "SCOPE", label: "Graded outside scope" },
  { code: "TONE_AS_DEFECT", label: "Tone graded as defect" },
];

type EvKey = "worked" | "concern" | "matters" | "change";

const EVIDENCE_FIELDS: { key: EvKey; label: string; labelFg: string; placeholder: string }[] = [
  { key: "worked", label: "WHAT WORKED", labelFg: "#047857", placeholder: "What did the reviewer get right?" },
  { key: "concern", label: "WHAT CAUSED CONCERN", labelFg: "#BE123C", placeholder: "What went wrong, and in which turn?" },
  { key: "matters", label: "WHY IT MATTERS", labelFg: "#9A5B0B", placeholder: "What does this cost the tasker or the data?" },
  { key: "change", label: "WHAT SHOULD CHANGE", labelFg: "#5B37F0", placeholder: "What should they have done instead?" },
];

type QueueState = "OPEN" | "ESCALATED" | "UNHANDLED" | "ACTIONED";

const QUEUE: { id: string; name: string; trigger: string; sla: string; state: QueueState; repeat: number }[] = [
  { id: "i1", name: "M. Okafor", trigger: "Pattern · 3 of last 5 below", sla: "due in 2d", state: "OPEN", repeat: 0 },
  { id: "i2", name: "J. Reyes", trigger: "Pattern · 2 of last 5 below", sla: "due in 4d", state: "OPEN", repeat: 1 },
  { id: "i3", name: "A. Lindqvist", trigger: "Bright line · LLM usage", sla: "escalated", state: "ESCALATED", repeat: 0 },
  { id: "i4", name: "T. Baptiste", trigger: "Pattern · 2 of last 5 below", sla: "SLA passed 1d ago", state: "UNHANDLED", repeat: 0 },
  { id: "i5", name: "S. Ganesh", trigger: "Pattern · 4 of last 5 below", sla: "actioned, evaluating", state: "ACTIONED", repeat: 0 },
];

type CalloutKind = "first" | "repeat" | "bright" | "late" | "waiting";

const DETAILS: Record<
  string,
  {
    meta: string;
    callout: [CalloutKind, string, string];
    timeline: [string, string, Tone, string, string][];
    audits: [string, number, string][];
    auditNote: string;
  }
> = {
  i1: {
    meta: "Pod 3 · 22 audits · opened 10 Aug by the system",
    callout: ["first", "First intervention", "No prior record. Treat this as calibration, not conduct — three low scores inside one week most often means a guideline they never had explained."],
    timeline: [["Intervention opened", "OPEN", "amber", "10 Aug", "Pattern trigger: 3 of the last 5 audits below threshold."]],
    audits: [["AUD-4402", 2, "Coded tone as a defect"], ["AUD-4418", 2, "No anchored instance"], ["AUD-4455", 1, "Approved without reading"]],
    auditNote: "3 of last 5 below threshold",
  },
  i2: {
    meta: "Pod 3 · 31 audits · opened 11 Aug by the system",
    callout: ["repeat", "Second intervention in 6 weeks", "Coached on evidence anchoring on 2 Jul, closed as improved on 21 Jul, flagged again 11 Aug. Same assessment code both times. This is the case the spreadsheet could not show you."],
    timeline: [
      ["Intervention opened", "OPEN", "amber", "11 Aug", "Pattern trigger: 2 of the last 5 below threshold. Both EVIDENCE_MISSING."],
      ["Closed — improved", "IMPROVED", "green", "21 Jul", "Next 5 audits averaged 3.4. Closed by the outcome evaluator."],
      ["Coached by you", "ACTIONED", "violet", "4 Jul", "Walked through Standard → Instance → Fix on two live examples."],
      ["Intervention opened", "OPEN", "gray", "2 Jul", "Pattern trigger: 2 of the last 5 below. Both EVIDENCE_MISSING."],
    ],
    audits: [["AUD-4471", 2, "Evidence unanchored"], ["AUD-4506", 2, "Quoted nothing"], ["AUD-4530", 4, "Clean"]],
    auditNote: "same code as the July pair",
  },
  i3: {
    meta: "Pod 3 · 8 audits · opened 12 Aug, escalated on insert",
    callout: ["bright", "Bright line — already with the project lead", "The LLM-usage flag skips your queue entirely. Nothing here needs your disposition; the record is shown so you aren't surprised by the outcome."],
    timeline: [["Escalated on insert", "ESCALATED", "rose", "12 Aug", "Bright-line trigger. Pod lead queue bypassed by design."]],
    audits: [["AUD-4588", 1, "Rationale reads generated"], ["AUD-4590", 2, "Identical phrasing, 4 tasks"], ["AUD-4593", 2, "Same opener again"]],
    auditNote: "flagged on one occurrence",
  },
  i4: {
    meta: "Pod 3 · 17 audits · opened 4 Aug by the system",
    callout: ["late", "SLA passed with no action", "Tonight's evaluator will close this as UNHANDLED and escalate it with your name on the empty action field. Acting now still counts."],
    timeline: [
      ["SLA expired", "UNHANDLED", "rose", "11 Aug", "7 days elapsed, no action recorded."],
      ["Intervention opened", "OPEN", "gray", "4 Aug", "Pattern trigger: 2 of the last 5 below threshold."],
    ],
    audits: [["AUD-4360", 2, "Wrong code applied"], ["AUD-4377", 2, "Wrong code applied"], ["AUD-4390", 3, "Borderline"]],
    auditNote: "no movement since",
  },
  i5: {
    meta: "Pod 3 · 26 audits · opened 6 Aug by the system",
    callout: ["waiting", "Actioned — waiting on evidence", "3 of the 5 audits needed to judge movement have landed. The evaluator re-runs nightly and won't close this until all 5 exist."],
    timeline: [
      ["Coached by you", "ACTIONED", "violet", "7 Aug", "Rubric walkthrough on S1 vs S2, plus two worked examples."],
      ["Intervention opened", "OPEN", "gray", "6 Aug", "Pattern trigger: 4 of the last 5 below threshold."],
    ],
    audits: [["AUD-4544", 3, "Post-coaching"], ["AUD-4561", 4, "Post-coaching"], ["AUD-4572", 3, "Post-coaching"]],
    auditNote: "3 of 5 post-action audits in",
  },
};

const CALLOUT_TONE: Record<CalloutKind, Tone> = { first: "violet", repeat: "amber", bright: "rose", late: "rose", waiting: "violet" };

const DROPPED = [
  { name: "T. Baptiste", pod: "Pod 3", lead: "D. Hollins", leadNote: "3 unhandled this quarter", leadBad: true, kind: "PATTERN", trigger: "2 of last 5 below threshold", audits: "AUD-4360 · AUD-4377 — both WRONG_CODE", opened: "4 Aug", overdue: "1d", outcome: "UNHANDLED", repeat: false },
  { name: "N. Oyelaran", pod: "Pod 2", lead: "K. Novák", leadNote: "44% reopen rate", leadBad: true, kind: "PATTERN", trigger: "3 of last 5 below threshold", audits: "AUD-4188 · AUD-4204 · AUD-4231 — LOW_EFFORT ×3", opened: "28 Jul", overdue: "8d", outcome: "UNHANDLED", repeat: true },
  { name: "V. Krastev", pod: "Pod 1", lead: "R. Adeyemi", leadNote: "1 unhandled this quarter", leadBad: false, kind: "BRIGHT_LINE", trigger: "LLM-generated review flagged", audits: "AUD-4241 — identical phrasing across 6 tasks", opened: "26 Jul", overdue: "10d", outcome: "ESCALATED", repeat: false },
  { name: "F. Sunderland", pod: "Pod 2", lead: "K. Novák", leadNote: "44% reopen rate", leadBad: true, kind: "PATTERN", trigger: "4 of last 5 below threshold", audits: "AUD-4109 → AUD-4173 — EVIDENCE_MISSING ×4", opened: "21 Jul", overdue: "15d", outcome: "UNHANDLED", repeat: true },
  { name: "G. Amankwah", pod: "Pod 4", lead: "P. Aurelio", leadNote: "on leave 2–14 Aug", leadBad: false, kind: "PATTERN", trigger: "2 of last 5 below threshold", audits: "AUD-4402 · AUD-4455 — SCORE_MISCALIBRATION", opened: "5 Aug", overdue: "0d — due today", outcome: "OPEN", repeat: false },
  { name: "I. Reinholt", pod: "Pod 1", lead: "R. Adeyemi", leadNote: "1 unhandled this quarter", leadBad: false, kind: "PATTERN", trigger: "2 of last 5 below threshold", audits: "AUD-4318 · AUD-4344 — FEEDBACK_QUALITY", opened: "1 Aug", overdue: "4d", outcome: "UNHANDLED", repeat: false },
  { name: "B. Achterberg", pod: "Pod 3", lead: "D. Hollins", leadNote: "3 unhandled this quarter", leadBad: true, kind: "BRIGHT_LINE", trigger: "LLM-generated review flagged", audits: "AUD-4297 — rationale reads generated", opened: "30 Jul", overdue: "6d", outcome: "ESCALATED", repeat: false },
];

const POD_LEADS = [
  { name: "R. Adeyemi", pod: "Pod 1", opened: 14, improvedW: "64%", escalatedW: "29%", unhandledW: "7%", mix: "9 improved · 4 escalated · 1 unhandled", median: "1.8 days", reopen: "7%", tone: "green" as Tone },
  { name: "K. Novák", pod: "Pod 2", opened: 11, improvedW: "82%", escalatedW: "18%", unhandledW: "0%", mix: "9 improved · 2 escalated", median: "0.6 days", reopen: "44%", tone: "rose" as Tone },
  { name: "D. Hollins", pod: "Pod 3", opened: 17, improvedW: "53%", escalatedW: "35%", unhandledW: "12%", mix: "9 improved · 6 escalated · 2 unhandled", median: "3.1 days", reopen: "11%", tone: "green" as Tone },
  { name: "P. Aurelio", pod: "Pod 4", opened: 6, improvedW: "50%", escalatedW: "50%", unhandledW: "0%", mix: "3 improved · 3 escalated", median: "2.4 days", reopen: "0%", tone: "gray" as Tone },
];

const CALIBRATION: { name: string; tag: string; tone: Tone; dist: number[]; note: string }[] = [
  { name: "L. Marchetti", tag: "compressed", tone: "amber", dist: [0, 2, 22, 19, 1], note: "44 audits, almost all 3s and 4s. Never uses the ends of the scale, so nothing they audit ever trips a pattern." },
  { name: "H. Bergström", tag: "healthy spread", tone: "green", dist: [3, 8, 14, 11, 5], note: "41 audits across the full range. Disagreement rate with project review sits at 6%." },
  { name: "C. Duarte", tag: "harsh · new", tone: "violet", dist: [9, 13, 6, 3, 1], note: "32 audits, 69% below threshold, ambiguity flagged on 11. Reads like guideline uncertainty, not severity." },
];

function SectionHeading({ tag, title, blurb }: { tag: string; title: string; blurb: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
      <span style={{ fontFamily: MONO, fontSize: 12, color: "#6D4AFF" }}>{tag}</span>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "-0.015em", color: "#1B1D23" }}>{title}</h2>
      <span style={{ fontSize: 13, color: "#8A8F9B" }}>{blurb}</span>
    </div>
  );
}

export default function AuditTrackerPage() {
  const [sqs, setSqs] = useState(2);
  const [assessment, setAssessment] = useState("SCORE_MISCALIBRATION");
  const [factors, setFactors] = useState<string[]>(["GUIDELINE_DRIFT"]);
  const [ambiguity, setAmbiguity] = useState(true);
  const [llm, setLlm] = useState(false);
  const [intervention, setIntervention] = useState("i2");
  const [rec, setRec] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<"agree" | "disagree" | null>(null);
  const [droppedFilter, setDroppedFilter] = useState("all");
  const [evFocus, setEvFocus] = useState<EvKey | null>("concern");
  const [ev, setEv] = useState<Record<EvKey, string>>({
    worked: "Caught the unresolved lockfile note in turn 4 and coded it correctly.",
    concern: "Turn 6 opens with a template header — enumerated under S2 — and the review doesn't mention it.",
    matters: "",
    change: "",
  });
  const [copied, setCopied] = useState(false);
  const [bundleOpen, setBundleOpen] = useState(false);
  const [bundleCopied, setBundleCopied] = useState(false);
  const copyT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bundleT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const threshold = 3;
  const below = sqs < threshold;
  const dist = Math.abs(sqs - threshold);
  const taskLink = "violet.tasks/t/VLT-2291?view=transcript";

  const copyLink = () => {
    void navigator.clipboard?.writeText(taskLink).catch(() => {});
    setCopied(true);
    clearTimeout(copyT.current);
    copyT.current = setTimeout(() => setCopied(false), 1600);
  };

  const bundleText = EVIDENCE_FIELDS.map((field) => `${field.label.charAt(0) + field.label.slice(1).toLowerCase()}\n${ev[field.key] || "—"}`).join("\n\n");
  const evFilled = EVIDENCE_FIELDS.filter((field) => ev[field.key]).length;

  const copyBundle = () => {
    if (!bundleOpen) {
      setBundleOpen(true);
      return;
    }
    void navigator.clipboard?.writeText(bundleText).catch(() => {});
    setBundleCopied(true);
    clearTimeout(bundleT.current);
    bundleT.current = setTimeout(() => setBundleCopied(false), 1600);
  };

  const sel = QUEUE.find((q) => q.id === intervention) ?? QUEUE[1];
  const detail = DETAILS[sel.id];
  const [cBg, cBorder, cFg, cDot] = TONE[CALLOUT_TONE[detail.callout[0]]];
  const slaTone = (state: QueueState): Tone =>
    state === "ESCALATED" || state === "UNHANDLED" ? "rose" : state === "ACTIONED" ? "violet" : "amber";
  const selTone = TONE[slaTone(sel.state)];

  const actionText =
    sel.id === "i2"
      ? "Second pass on evidence anchoring. Walked the July examples back through, then had them re-audit AUD-4471 live."
      : sel.id === "i5"
        ? "Rubric walkthrough on S1 vs S2, plus two worked examples."
        : "Describe what you actually did — this travels with the escalation.";
  const actionColor = sel.id === "i2" || sel.id === "i5" ? "#272A31" : "#A0A5AF";

  const recNote =
    rec === "COACH"
      ? "Stays with you. The evaluator checks the next 5 audits and closes or escalates on its own."
      : rec
        ? "Goes up tonight with your action, both audit sets, and this recommendation attached. A recommendation is evidence, not a verdict."
        : "Escalate and Remove skip the wait. Coach hands it to the outcome evaluator.";

  const dropped = DROPPED.filter(
    (d) => droppedFilter === "all" || (droppedFilter === "bright" && d.kind === "BRIGHT_LINE") || (droppedFilter === "repeat" && d.repeat),
  );

  const copyBorder = copied ? "#BFE7D8" : "#E3E4E9";
  const bundleBtn = {
    fg: bundleCopied ? "#047857" : "#5B37F0",
    border: bundleCopied ? "#BFE7D8" : "#DFDAFF",
    bg: bundleCopied ? "#F1FAF6" : "#FFFFFF",
    label: bundleCopied ? "Copied" : bundleOpen ? "Copy text" : "Build feedback",
    glyph: bundleCopied ? "✓ " : "⧉ ",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F5F5F7", color: "#1B1D23", fontSize: 13 }}>
      <div style={{ padding: "56px 56px 120px", display: "flex", flexDirection: "column", gap: 56 }}>
        {/* Page header */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 24, borderBottom: "1px solid #E6E7EC", maxWidth: 1100 }}>
          <div style={{ fontFamily: MONO, fontSize: 12, color: "#6D4AFF" }}>Project Violet</div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 600, letterSpacing: "-0.025em", color: "#15171C" }}>Reviewer audit tracker</h1>
          <p style={{ margin: 0, maxWidth: "70ch", fontSize: 14, lineHeight: 1.65, color: "#767C89", textWrap: "pretty" }}>
            Three surfaces, one rule each: the audit form is blind and can&rsquo;t be edited, the pod lead queue leads with history, and the project lead view grades the pod leads too. Everything else is a filtered table.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 8 }}>
            {[
              ["#6D4AFF", "Violet — selected / live value"],
              ["#C9821A", "Amber — open, clock running"],
              ["#E11D48", "Rose — bright line / below threshold"],
            ].map(([dot, label]) => (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 13px", border: "1px solid #E3E4E9", borderRadius: 8, background: "#FFFFFF", fontSize: 12.5, color: "#5C6270" }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: dot }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* ── A · Audit form ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SectionHeading tag="A" title="Audit form — blind queue" blurb="SQS, assessment and the bright-line control are live. Decision and borderline distance are computed, never typed." />

          <div style={{ overflowX: "auto" }}>
            <div style={{ width: 1080, borderRadius: 14, border: "1px solid #E3E4E9", background: "#FFFFFF", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 26px", borderBottom: "1px solid #EBECF0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ fontFamily: MONO, fontSize: 13, color: "#272A31" }}>VLT-2291</span>
                  <div onClick={copyLink} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 0, borderRadius: 8, border: "1px solid " + copyBorder, background: copied ? "#F1FAF6" : "#FAFAFB", overflow: "hidden", transition: "border-color 120ms ease, background 120ms ease" }}>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: "#5C6270", padding: "7px 12px", whiteSpace: "nowrap" }}>{taskLink}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", borderLeft: "1px solid " + copyBorder, background: "#FFFFFF", fontSize: 12, fontWeight: 500, color: copied ? "#047857" : "#5B37F0", whiteSpace: "nowrap" }}>
                      {copied ? "✓ Copied" : "⧉ Copy link"}
                    </span>
                  </div>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 11px", borderRadius: 7, border: "1px solid #DFDAFF", background: "#F7F5FF", fontSize: 12, color: "#5B37F0" }}>Blind · reviewer identity withheld</span>
                </div>
                <span style={{ fontSize: 12.5, color: "#8A8F9B" }}>Queue · 6 remaining today</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", minHeight: 0 }}>
                {/* Left — the form */}
                <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: 26, borderRight: "1px solid #EBECF0" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: "#3D414A" }}>Sample quality score</span>
                      <span style={{ fontSize: 12, color: "#8A8F9B" }}>threshold {threshold}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
                      {[1, 2, 3, 4, 5].map((score) => {
                        const on = sqs === score;
                        return (
                          <div
                            key={score}
                            onClick={() => setSqs(score)}
                            style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "16px 0", borderRadius: 10, border: "1px solid " + (on ? "#6D4AFF" : "#E3E4E9"), background: on ? "#F7F5FF" : "#FFFFFF", transition: "border-color 120ms ease, background 120ms ease" }}
                          >
                            <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: on ? "#5B37F0" : "#3D414A" }}>{score}</span>
                            <span style={{ fontSize: 11.5, color: on ? "#8A7DD8" : "#A0A5AF" }}>{score < threshold ? "below" : score === threshold ? "at" : "above"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: "#3D414A" }}>Primary assessment</span>
                      <span style={{ fontSize: 12, color: "#8A8F9B" }}>Failures only — a pass is no selection</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {ASSESSMENTS.map((a) => {
                        const on = assessment === a.code;
                        return (
                          <div key={a.code} onClick={() => setAssessment(a.code)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", borderRadius: 9, border: "1px solid " + (on ? "#6D4AFF" : "#E3E4E9"), background: on ? "#F7F5FF" : "#FFFFFF" }}>
                            <span style={{ width: 15, height: 15, borderRadius: 999, flex: "none", border: "1.5px solid " + (on ? "#6D4AFF" : "#C6CAD3"), background: on ? "#6D4AFF" : "transparent" }} />
                            <span style={{ flex: 1, fontSize: 13.5, color: on ? "#3F1FD6" : "#3D414A" }}>{a.label}</span>
                            <span style={{ fontFamily: MONO, fontSize: 11, color: "#A0A5AF" }}>{a.code}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: "#3D414A" }}>Contributing factors</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {FACTORS.map((factor) => {
                        const on = factors.includes(factor.code);
                        return (
                          <div
                            key={factor.code}
                            onClick={() => setFactors((cur) => (cur.includes(factor.code) ? cur.filter((c) => c !== factor.code) : [...cur, factor.code]))}
                            style={{ cursor: "pointer", padding: "7px 13px", borderRadius: 8, border: "1px solid " + (on ? "#DFDAFF" : "#E3E4E9"), background: on ? "#F1F0FF" : "#FFFFFF", fontSize: 12.5, color: on ? "#5B37F0" : "#5C6270" }}
                          >
                            {factor.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: "#3D414A" }}>Evidence</span>
                      <span style={{ fontSize: 12, color: "#8A8F9B" }}>Four beats · anchor each to a turn</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                      {EVIDENCE_FIELDS.map((field) => (
                        <div key={field.key} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "13px 15px", borderRadius: 9, border: "1px solid " + (evFocus === field.key ? "#6D4AFF" : "#E3E4E9"), background: "#FFFFFF" }}>
                          <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.04em", color: field.labelFg }}>{field.label}</span>
                          <textarea
                            rows={1}
                            value={ev[field.key]}
                            placeholder={field.placeholder}
                            onFocus={() => setEvFocus(field.key)}
                            onChange={(e) => setEv((cur) => ({ ...cur, [field.key]: e.target.value }))}
                            style={{ border: "none", outline: "none", resize: "vertical", padding: 0, background: "transparent", minHeight: 22, fontSize: 13.5, lineHeight: 1.6, color: "#272A31", fontFamily: "inherit" }}
                          />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px 16px", borderRadius: 10, border: "1px solid " + (bundleOpen ? "#DFDAFF" : "#E3E4E9"), background: bundleOpen ? "#F7F5FF" : "#FAFAFB" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 500, color: "#3D414A" }}>Copy as feedback</span>
                          <span style={{ fontSize: 12, color: "#8A8F9B" }}>
                            {evFilled === 4 ? "All four beats, headed and formatted." : evFilled + " of 4 written — empty beats copy as a dash."}
                          </span>
                        </div>
                        <div onClick={copyBundle} style={{ cursor: "pointer", flex: "none", display: "flex", alignItems: "center", gap: 7, padding: "8px 15px", borderRadius: 8, border: "1px solid " + bundleBtn.border, background: bundleBtn.bg, fontSize: 12.5, fontWeight: 500, color: bundleBtn.fg }}>
                          {bundleBtn.glyph}
                          {bundleBtn.label}
                        </div>
                      </div>
                      {bundleOpen && (
                        <div style={{ padding: "13px 15px", borderRadius: 8, border: "1px solid #E3E4E9", background: "#FFFFFF", fontFamily: MONO, fontSize: 11.5, lineHeight: 1.75, color: "#3D414A", whiteSpace: "pre-wrap" }}>{bundleText}</div>
                      )}
                    </div>
                    <span style={{ fontSize: 12, lineHeight: 1.5, color: "#8A8F9B" }}>Same four beats a reviewer owes a tasker. Written once here, pasted wherever the feedback goes.</span>
                  </div>

                  <div onClick={() => setAmbiguity((v) => !v)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", borderRadius: 9, border: "1px solid " + (ambiguity ? "#DFDAFF" : "#E3E4E9"), background: ambiguity ? "#F7F5FF" : "#FFFFFF" }}>
                    <span style={{ width: 16, height: 16, borderRadius: 4, flex: "none", border: "1.5px solid " + (ambiguity ? "#6D4AFF" : "#C6CAD3"), background: ambiguity ? "#6D4AFF" : "transparent" }} />
                    <span style={{ fontSize: 13.5, color: "#3D414A" }}>Guideline was ambiguous here</span>
                  </div>

                  <div onClick={() => setLlm((v) => !v)} style={{ cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 13, padding: "15px 16px", borderRadius: 10, border: "1.5px solid " + (llm ? "#E11D48" : "#E3E4E9"), background: llm ? "#FEF5F7" : "#FFFFFF" }}>
                    <span style={{ width: 16, height: 16, borderRadius: 4, flex: "none", marginTop: 2, border: "1.5px solid " + (llm ? "#E11D48" : "#C6CAD3"), background: llm ? "#E11D48" : "transparent" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: llm ? "#BE123C" : "#272A31" }}>Suspected LLM-generated review</span>
                        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em", color: "#BE123C", border: "1px solid #F6CDD6", borderRadius: 5, padding: "2px 7px", background: "#FFFFFF" }}>BRIGHT LINE</span>
                      </div>
                      <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "#5C6270" }}>Not an assessment tag. One occurrence escalates immediately, past the pod lead.</span>
                    </div>
                  </div>
                </div>

                {/* Right — computed panel */}
                <div style={{ display: "flex", flexDirection: "column", gap: 22, padding: 26, background: "#FAFAFB" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: "#8A8F9B" }}>Computed on submit</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: 16, borderRadius: 10, border: "1px solid " + (below ? "#F6CDD6" : "#BFE7D8"), background: below ? "#FEF5F7" : "#F1FAF6" }}>
                      <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.08em", color: "#8A8F9B" }}>DECISION</span>
                      <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", color: below ? "#BE123C" : "#047857" }}>
                        {below ? "Below threshold" : sqs === threshold ? "At threshold" : "Above threshold"}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, paddingTop: 2 }}>
                        <span style={{ fontSize: 12.5, color: "#5C6270" }}>borderline distance</span>
                        <span style={{ fontFamily: MONO, fontSize: 12.5, color: "#272A31" }}>{dist.toFixed(1)}</span>
                        <span style={{ fontSize: 12, color: dist <= 1 ? "#9A5B0B" : "#8A8F9B" }}>
                          {dist === 0 ? "sits exactly on the line" : dist === 1 ? "one step out — sampled for project review" : "clear of the line"}
                        </span>
                      </div>
                    </div>
                    <span style={{ fontSize: 12, lineHeight: 1.5, color: "#8A8F9B" }}>Neither field is enterable. They&rsquo;re read off the score and the threshold every time the row is read.</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: "#8A8F9B" }}>What this insert may open</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "15px 16px", borderRadius: 10, border: "1px solid " + (llm ? "#F6CDD6" : below ? "#F2DCB8" : "#E3E4E9"), background: llm ? "#FEF5F7" : below ? "#FDF6EC" : "#FAFAFB" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: llm ? "#E11D48" : below ? "#C9821A" : "#C6CAD3" }} />
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: llm ? "#BE123C" : below ? "#9A5B0B" : "#5C6270" }}>
                          {llm ? "Bright line — escalates immediately" : below ? "Pattern trigger fires" : "No intervention"}
                        </span>
                      </div>
                      <span style={{ fontSize: 12.5, lineHeight: 1.55, color: "#5C6270" }}>
                        {llm
                          ? "One flagged audit opens an ESCALATED intervention and skips the pod lead queue. Waiting for a second occurrence is the wrong response to this category."
                          : below
                            ? "This would be the 2nd of the reviewer's last 5 below threshold, which meets pattern_min_below. An intervention opens against their pod lead with a 7-day SLA."
                            : "The reviewer's last 5 stay at 1 below threshold — under the pattern floor. Nothing opens."}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "14px 15px", borderRadius: 10, border: "1px solid #E3E4E9", background: "#FFFFFF" }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                        <span style={{ fontSize: 12, color: "#8A8F9B" }}>Tasker SQS on this task</span>
                        <span style={{ fontFamily: MONO, fontSize: 11, color: "#A0A5AF" }}>TSK-8814</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 11 }}>
                        <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", color: "#272A31", fontVariantNumeric: "tabular-nums" }}>4</span>
                        <span style={{ fontSize: 12.5, color: "#5C6270" }}>this task</span>
                      </div>
                      <div style={{ height: 1, background: "#EBECF0" }} />
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                        <span style={{ fontSize: 12, color: "#8A8F9B" }}>Tasker SQS on the project</span>
                        <span style={{ fontSize: 11, color: "#A0A5AF" }}>142 tasks</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                        <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", color: "#272A31", fontVariantNumeric: "tabular-nums" }}>2.6</span>
                        <span style={{ fontSize: 11.5, color: "#9A5B0B", border: "1px solid #F2DCB8", background: "#FDF6EC", borderRadius: 5, padding: "3px 8px" }}>this task sits 1.4 above</span>
                      </div>
                      <span style={{ fontSize: 12, lineHeight: 1.5, color: "#8A8F9B" }}>A single task landing far off the tasker&rsquo;s own project average is usually where the review went wrong.</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: "14px 15px", borderRadius: 10, border: "1px solid #E3E4E9", background: "#FFFFFF" }}>
                      <span style={{ fontSize: 12, color: "#8A8F9B" }}>Reviewer&rsquo;s last 5 audits</span>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 52 }}>
                        {[4, 2, 3, 4, sqs].map((score, i) => {
                          const live = i === 4;
                          const low = score < threshold;
                          return (
                            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                              <div style={{ width: "100%", height: score * 9 + 8, borderRadius: 4, background: live ? (low ? "#FEF5F7" : "#F7F5FF") : low ? "#FDF6EC" : "#F1F2F5", border: "1px solid " + (live ? (low ? "#E11D48" : "#6D4AFF") : low ? "#F2DCB8" : "#E3E4E9") }} />
                              <span style={{ fontFamily: MONO, fontSize: 10.5, color: live ? (low ? "#BE123C" : "#5B37F0") : "#8A8F9B" }}>{score}</span>
                            </div>
                          );
                        })}
                      </div>
                      <span style={{ fontSize: 12, color: "#8A8F9B" }}>Last bar is this audit. Pattern is a query — it isn&rsquo;t stored on any row.</span>
                    </div>
                  </div>

                  <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "13px 14px", borderRadius: 9, border: "1px dashed #D9DBE2" }}>
                      <span style={{ fontSize: 13, color: "#A0A5AF", flex: "none" }}>⌘</span>
                      <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "#8A8F9B" }}>Once submitted this row can&rsquo;t be edited. A correction is a new row that supersedes it and asks why.</span>
                    </div>
                    <div style={{ padding: 13, borderRadius: 9, background: "#6D4AFF", color: "#FFFFFF", textAlign: "center", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Submit audit</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── B · Pod lead queue ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SectionHeading tag="B" title="Pod lead queue" blurb="Pick a row on the left — the detail pane and history spine follow. Identity is unblinded here; coaching an anonymous person is impossible." />

          <div style={{ overflowX: "auto" }}>
            <div style={{ width: 1180, height: 880, borderRadius: 14, border: "1px solid #E3E4E9", background: "#FFFFFF", display: "flex", overflow: "hidden" }}>
              {/* Queue list */}
              <div style={{ width: 396, flex: "none", borderRight: "1px solid #EBECF0", display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "20px 22px", borderBottom: "1px solid #EBECF0" }}>
                  <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.015em", color: "#15171C" }}>Pod 3 · interventions</span>
                  <span style={{ fontSize: 12.5, color: "#8A8F9B" }}>Opened by the system. You choose the disposition, not whether it exists.</span>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  {QUEUE.map((q) => {
                    const on = intervention === q.id;
                    const tone = TONE[slaTone(q.state)];
                    return (
                      <div
                        key={q.id}
                        onClick={() => {
                          setIntervention(q.id);
                          setRec(null);
                        }}
                        style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: 9, padding: "16px 22px", borderBottom: "1px solid #F1F2F5", background: on ? "#F8F7FF" : "#FFFFFF", borderLeft: "3px solid " + (on ? "#6D4AFF" : "transparent") }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 500, color: "#15171C" }}>{q.name}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: tone[2], border: "1px solid " + tone[1], background: tone[0], borderRadius: 5, padding: "3px 8px" }}>{q.state}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          <span style={{ fontSize: 12.5, color: "#5C6270" }}>{q.trigger}</span>
                          <span style={{ fontSize: 12, color: q.state === "UNHANDLED" || q.state === "ESCALATED" ? "#BE123C" : "#8A8F9B" }}>{q.sla}</span>
                        </div>
                        {q.repeat > 0 && (
                          <span style={{ alignSelf: "flex-start", fontSize: 11.5, color: "#9A5B0B", border: "1px solid #F2DCB8", background: "#FDF6EC", borderRadius: 5, padding: "3px 9px" }}>{q.repeat} prior intervention</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detail pane */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, padding: "20px 24px", borderBottom: "1px solid #EBECF0" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", color: "#15171C" }}>{sel.name}</span>
                    <span style={{ fontSize: 12.5, color: "#8A8F9B" }}>{detail.meta}</span>
                  </div>
                  <span style={{ flex: "none", fontSize: 12, color: selTone[2], border: "1px solid " + selTone[1], background: selTone[0], borderRadius: 7, padding: "6px 12px" }}>{sel.sla}</span>
                </div>

                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20, padding: "22px 24px", overflow: "auto" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "16px 18px", borderRadius: 11, border: "1px solid " + cBorder, background: cBg }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: cDot }} />
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: cFg }}>{detail.callout[1]}</span>
                    </div>
                    <span style={{ fontSize: 13, lineHeight: 1.6, color: "#5C6270" }}>{detail.callout[2]}</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: "#8A8F9B" }}>History</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      {detail.timeline.map((t, i) => {
                        const tone = TONE[t[2]];
                        return (
                          <div key={i} style={{ display: "flex", gap: 14 }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none", width: 16 }}>
                              <span style={{ width: 11, height: 11, borderRadius: 999, flex: "none", background: i === 0 ? tone[3] : "#FFFFFF", border: "2px solid " + tone[3] }} />
                              <span style={{ width: 2, flex: 1, background: i === detail.timeline.length - 1 ? "transparent" : "#E3E4E9" }} />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingBottom: 16, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 13.5, fontWeight: 500, color: "#272A31" }}>{t[0]}</span>
                                <span style={{ fontSize: 11.5, color: tone[2], border: "1px solid " + tone[1], background: tone[0], borderRadius: 5, padding: "2px 8px" }}>{t[1]}</span>
                                <span style={{ fontFamily: MONO, fontSize: 11, color: "#A0A5AF" }}>{t[3]}</span>
                              </div>
                              <span style={{ fontSize: 12.5, lineHeight: 1.55, color: "#5C6270" }}>{t[4]}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: "#8A8F9B" }}>Triggering audits</span>
                      <span style={{ fontSize: 12, color: "#8A8F9B" }}>{detail.auditNote}</span>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      {detail.audits.map((a) => {
                        const low = a[1] < threshold;
                        return (
                          <div key={a[0]} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7, padding: "13px 14px", borderRadius: 10, border: "1px solid " + (low ? "#F6CDD6" : "#E3E4E9"), background: low ? "#FEF5F7" : "#FAFAFB" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontFamily: MONO, fontSize: 11, color: "#8A8F9B" }}>{a[0]}</span>
                              <span style={{ fontSize: 13, fontWeight: 600, color: low ? "#BE123C" : "#3D414A" }}>SQS {a[1]}</span>
                            </div>
                            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "#5C6270" }}>{a[2]}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "18px 24px", borderTop: "1px solid #EBECF0", background: "#FAFAFB" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: "#3D414A" }}>What did you do?</span>
                    <div style={{ padding: "12px 14px", borderRadius: 9, border: "1px solid #E3E4E9", background: "#FFFFFF", fontSize: 13, lineHeight: 1.55, color: actionColor }}>{actionText}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ fontSize: 12.5, color: "#8A8F9B" }}>Recommendation</span>
                      <div style={{ display: "flex", gap: 7 }}>
                        {[
                          { id: "COACH", label: "Coach" },
                          { id: "ESCALATE", label: "Escalate" },
                          { id: "REMOVE", label: "Remove" },
                        ].map((r) => {
                          const on = rec === r.id;
                          return (
                            <div key={r.id} onClick={() => setRec(r.id)} style={{ cursor: "pointer", padding: "7px 14px", borderRadius: 7, border: "1px solid " + (on ? "#6D4AFF" : "#E3E4E9"), background: on ? "#F7F5FF" : "#FFFFFF", fontSize: 12.5, fontWeight: 500, color: on ? "#3F1FD6" : "#5C6270" }}>
                              {r.label}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ padding: "10px 20px", borderRadius: 8, background: rec ? "#6D4AFF" : "#EDEEF2", color: rec ? "#FFFFFF" : "#A2A7B1", fontSize: 13.5, fontWeight: 500, cursor: rec ? "pointer" : "default" }}>
                      {rec === "ESCALATE" || rec === "REMOVE" ? "Send to project lead" : "Record action"}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, lineHeight: 1.5, color: "#8A8F9B" }}>{recNote}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── C · Project lead ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SectionHeading tag="C" title="Project lead" blurb="Two slices of one dataset. The second one is the check on the first." />

          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {/* Fell through */}
            <div style={{ overflowX: "auto" }}>
              <div style={{ width: 1180, borderRadius: 14, border: "1px solid #E3E4E9", background: "#FFFFFF", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 26px", borderBottom: "1px solid #EBECF0" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.015em", color: "#15171C" }}>Fell through — no action taken</span>
                    <span style={{ fontSize: 12.5, color: "#8A8F9B" }}>Every intervention the system opened that its pod lead never dispositioned. Flat, across all pods.</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[
                      { id: "all", label: "All 7" },
                      { id: "bright", label: "Bright line" },
                      { id: "repeat", label: "Repeat reviewers" },
                    ].map((filter) => {
                      const on = droppedFilter === filter.id;
                      return (
                        <div key={filter.id} onClick={() => setDroppedFilter(filter.id)} style={{ cursor: "pointer", padding: "6px 12px", borderRadius: 7, border: "1px solid " + (on ? "#DFDAFF" : "#E3E4E9"), background: on ? "#F1F0FF" : "#FFFFFF", fontSize: 12.5, color: on ? "#5B37F0" : "#5C6270" }}>
                          {filter.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "180px 150px 1fr 130px 140px 120px", padding: "12px 26px", borderBottom: "1px solid #EBECF0", fontSize: 11.5, letterSpacing: "0.04em", color: "#A0A5AF" }}>
                  <span>REVIEWER</span><span>POD LEAD</span><span>WHY IT OPENED</span><span>OPENED</span><span>OVERDUE BY</span><span>SYSTEM DID</span>
                </div>
                {dropped.map((d) => {
                  const bright = d.kind === "BRIGHT_LINE";
                  const open = d.outcome === "OPEN";
                  return (
                    <div key={d.name} style={{ display: "grid", gridTemplateColumns: "180px 150px 1fr 130px 140px 120px", alignItems: "center", padding: "15px 26px", borderBottom: "1px solid #F1F2F5", borderLeft: "3px solid " + (bright ? "#E11D48" : open ? "#C9821A" : "#F6CDD6") }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 500, color: "#15171C" }}>{d.name}</span>
                        <span style={{ fontSize: 12, color: "#8A8F9B" }}>{d.pod}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ fontSize: 13, color: "#3D414A" }}>{d.lead}</span>
                        <span style={{ fontSize: 11.5, color: d.leadBad ? "#BE123C" : "#8A8F9B" }}>{d.leadNote}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingRight: 28 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: bright ? "#BE123C" : "#5C6270", border: "1px solid " + (bright ? "#F6CDD6" : "#E3E4E9"), background: bright ? "#FEF5F7" : "#FAFAFB", borderRadius: 5, padding: "2px 8px" }}>
                            {bright ? "BRIGHT LINE" : "PATTERN"}
                          </span>
                          <span style={{ fontSize: 13, color: "#3D414A" }}>{d.trigger}</span>
                        </div>
                        <span style={{ fontSize: 12, color: "#8A8F9B" }}>{d.audits}</span>
                      </div>
                      <span style={{ fontSize: 13, color: "#5C6270", fontVariantNumeric: "tabular-nums" }}>{d.opened}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: open ? "#9A5B0B" : "#BE123C", fontVariantNumeric: "tabular-nums" }}>{d.overdue}</span>
                      <span style={{ fontSize: 12, color: open ? "#9A5B0B" : "#BE123C", border: "1px solid " + (open ? "#F2DCB8" : "#F6CDD6"), background: open ? "#FDF6EC" : "#FEF5F7", borderRadius: 6, padding: "4px 9px", justifySelf: "start" }}>{d.outcome}</span>
                    </div>
                  );
                })}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "18px 26px", background: "#FAFAFB" }}>
                  <span style={{ flex: "none", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: "#BE123C", border: "1px solid #F6CDD6", borderRadius: 5, padding: "3px 8px", background: "#FFFFFF" }}>NO ONE DECLINED</span>
                  <span style={{ fontSize: 13, lineHeight: 1.6, color: "#5C6270", maxWidth: "82ch" }}>
                    The system opened all of these, so nothing here was suppressed — it was left. The evaluator has already escalated each one as UNHANDLED with the pod lead&rsquo;s empty action field attached, which is why this list can exist at all.
                  </span>
                </div>
              </div>
            </div>

            {/* By pod lead */}
            <div style={{ overflowX: "auto" }}>
              <div style={{ width: 1180, borderRadius: 14, border: "1px solid #E3E4E9", background: "#FFFFFF", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 26px", borderBottom: "1px solid #EBECF0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.015em", color: "#15171C" }}>By pod lead</span>
                    <span style={{ fontSize: 12.5, color: "#8A8F9B" }}>Every intervention the system opened, grouped by who handled it</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid #DFDAFF", background: "#F1F0FF", fontSize: 12.5, color: "#5B37F0" }}>Last 90 days</span>
                    <span style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid #E3E4E9", fontSize: 12.5, color: "#5C6270" }}>All pods</span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "200px 150px 1fr 150px 150px", padding: "12px 26px", borderBottom: "1px solid #EBECF0", fontSize: 11.5, letterSpacing: "0.04em", color: "#A0A5AF" }}>
                  <span>POD LEAD</span><span>OPENED</span><span>DISPOSITION MIX</span><span>MEDIAN TO ACTION</span><span>REOPEN RATE</span>
                </div>
                {POD_LEADS.map((p) => {
                  const tone = TONE[p.tone];
                  return (
                    <div key={p.name} style={{ display: "grid", gridTemplateColumns: "200px 150px 1fr 150px 150px", alignItems: "center", padding: "16px 26px", borderBottom: "1px solid #F1F2F5" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 500, color: "#15171C" }}>{p.name}</span>
                        <span style={{ fontSize: 12, color: "#8A8F9B" }}>{p.pod}</span>
                      </div>
                      <span style={{ fontSize: 13.5, color: "#3D414A", fontVariantNumeric: "tabular-nums" }}>{p.opened}</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingRight: 36 }}>
                        <div style={{ display: "flex", height: 9, borderRadius: 5, overflow: "hidden", border: "1px solid #E3E4E9" }}>
                          <div style={{ width: p.improvedW, background: "#059669" }} />
                          <div style={{ width: p.escalatedW, background: "#C9821A" }} />
                          <div style={{ width: p.unhandledW, background: "#E11D48" }} />
                        </div>
                        <span style={{ fontSize: 12, color: "#8A8F9B" }}>{p.mix}</span>
                      </div>
                      <span style={{ fontSize: 13.5, color: "#3D414A", fontVariantNumeric: "tabular-nums" }}>{p.median}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: p.tone === "rose" ? "#BE123C" : p.tone === "green" ? "#047857" : "#5C6270", fontVariantNumeric: "tabular-nums" }}>{p.reopen}</span>
                        <span style={{ fontSize: 11.5, color: p.tone === "rose" ? "#BE123C" : p.tone === "green" ? "#047857" : "#5C6270", border: "1px solid " + tone[1], background: tone[0], borderRadius: 5, padding: "3px 8px" }}>
                          {p.tone === "rose" ? "clearing, not coaching" : p.tone === "green" ? "holding" : "low volume"}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "18px 26px", background: "#FAFAFB" }}>
                  <span style={{ flex: "none", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: "#5B37F0", border: "1px solid #DFDAFF", borderRadius: 5, padding: "3px 8px", background: "#FFFFFF" }}>READ THIS ONE</span>
                  <span style={{ fontSize: 13, lineHeight: 1.6, color: "#5C6270", maxWidth: "82ch" }}>
                    Reopen rate is closed-as-improved, then flagged again inside 30 days. It&rsquo;s arithmetic, not judgement — and it&rsquo;s the difference between a pod lead clearing a queue and a pod lead coaching. A fast median with a high reopen rate is the shape to worry about.
                  </span>
                </div>
              </div>
            </div>

            {/* Calibration + sampled audit */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "flex-start" }}>
              <div style={{ width: 760, flex: "none", borderRadius: 14, border: "1px solid #E3E4E9", background: "#FFFFFF", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 26px", borderBottom: "1px solid #EBECF0" }}>
                  <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.015em", color: "#15171C" }}>Auditor calibration</span>
                  <span style={{ fontSize: 12.5, color: "#8A8F9B" }}>Blind at audit time, visible here</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "22px 26px" }}>
                  {CALIBRATION.map((c) => {
                    const tone = TONE[c.tone];
                    const max = Math.max(...c.dist);
                    return (
                      <div key={c.name} style={{ display: "flex", flexDirection: "column", gap: 10, padding: "16px 18px", borderRadius: 11, border: "1px solid " + tone[1], background: tone[0] }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 500, color: "#15171C" }}>{c.name}</span>
                          <span style={{ fontSize: 11.5, color: tone[2], border: "1px solid " + tone[1], background: "#FFFFFF", borderRadius: 5, padding: "3px 9px" }}>{c.tag}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 56 }}>
                          {c.dist.map((v, i) => (
                            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                              <div style={{ width: "100%", height: Math.max(4, Math.round((v / max) * 44)), borderRadius: 4, background: v === max ? tone[3] : "#FFFFFF", border: "1px solid " + (v === max ? tone[3] : tone[1]) }} />
                              <span style={{ fontFamily: MONO, fontSize: 10.5, color: "#A0A5AF" }}>{i + 1}</span>
                            </div>
                          ))}
                        </div>
                        <span style={{ fontSize: 12.5, lineHeight: 1.55, color: "#5C6270" }}>{c.note}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ width: 760, flex: "none", borderRadius: 14, border: "1px solid #E3E4E9", background: "#FFFFFF", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 26px", borderBottom: "1px solid #EBECF0" }}>
                  <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.015em", color: "#15171C" }}>Sampled audit · agree or disagree</span>
                  <span style={{ fontSize: 12.5, color: "#8A8F9B" }}>Ambiguity-flagged, new auditor</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: "22px 26px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "16px 18px", borderRadius: 11, border: "1px solid #E3E4E9", background: "#FAFAFB" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontFamily: MONO, fontSize: 12, color: "#272A31" }}>AUD-4610</span>
                      <div style={{ display: "flex", gap: 7 }}>
                        <span style={{ fontSize: 11.5, color: "#9A5B0B", border: "1px solid #F2DCB8", background: "#FDF6EC", borderRadius: 5, padding: "3px 8px" }}>ambiguity flagged</span>
                        <span style={{ fontSize: 11.5, color: "#5C6270", border: "1px solid #E3E4E9", background: "#FFFFFF", borderRadius: 5, padding: "3px 8px" }}>SQS 2</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 13, lineHeight: 1.6, color: "#5C6270" }}>
                      Auditor read a two-level bullet list as LOW_EFFORT. The guideline doesn&rsquo;t say where structure stops being scannable, and the auditor said so.
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div onClick={() => setVerdict("agree")} style={{ cursor: "pointer", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: 14, borderRadius: 10, border: "1px solid " + (verdict === "agree" ? "#6D4AFF" : "#E3E4E9"), background: verdict === "agree" ? "#F7F5FF" : "#FFFFFF", fontSize: 14, fontWeight: 500, color: verdict === "agree" ? "#3F1FD6" : "#3D414A" }}>
                      Agree with the audit
                    </div>
                    <div onClick={() => setVerdict("disagree")} style={{ cursor: "pointer", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: 14, borderRadius: 10, border: "1px solid " + (verdict === "disagree" ? "#6D4AFF" : "#E3E4E9"), background: verdict === "disagree" ? "#F7F5FF" : "#FFFFFF", fontSize: 14, fontWeight: 500, color: verdict === "disagree" ? "#3F1FD6" : "#3D414A" }}>
                      Disagree
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "15px 16px", borderRadius: 10, border: "1px solid #DFDAFF", background: "#F7F5FF" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#3F1FD6" }}>
                      {verdict === "disagree" ? "This writes a review row. The audit is untouched." : verdict === "agree" ? "Agreement is recorded the same way." : "Either way, the audit itself never changes."}
                    </span>
                    <span style={{ fontSize: 12.5, lineHeight: 1.6, color: "#5C6270" }}>
                      {verdict === "disagree"
                        ? "A disagreement never amends the auditor's row — overwriting it would destroy the calibration signal that made this audit worth sampling. It lands as a separate project_reviews record and shows up in the auditor's disagreement rate."
                        : "Agreements and disagreements both land as separate rows against the audit. The auditor's own record stays exactly as they wrote it."}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "#8A8F9B" }}>Ambiguity rate feeds the guideline backlog, not the auditor&rsquo;s record.</span>
                    <div style={{ padding: "10px 20px", borderRadius: 8, background: "#6D4AFF", color: "#FFFFFF", fontSize: 13.5, fontWeight: 500, cursor: "pointer" }}>Record review</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
