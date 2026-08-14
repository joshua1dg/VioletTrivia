"use client";

/**
 * Demo port of `Pod Lead Dashboard.dc.html` — one self-contained page,
 * hardcoded data, no backend. Navigation, range picker, filters and the
 * fellow drill-down all work; nothing persists.
 */

import { useState } from "react";

const MONO = "var(--font-plex-mono), ui-monospace, monospace";

type SectionId =
  | "overview"
  | "fellows"
  | "audits"
  | "escalations"
  | "flags"
  | "submissions"
  | "calibration";

type RangeId = "7d" | "30d" | "cycle" | "custom";

const SECTIONS: [SectionId, string, string][] = [
  ["overview", "Pod Overview", ""],
  ["fellows", "Fellows", "90"],
  ["audits", "Audits", "38"],
  ["escalations", "LLM Escalations", "6"],
  ["flags", "Flags & Reports", "14"],
  ["submissions", "Workflow Submissions", "9"],
  ["calibration", "Calibration", ""],
];

const TITLES: Record<SectionId, [string, string]> = {
  overview: ["Pod Overview", "Distribution and movement — averages hide both"],
  fellows: ["Fellows", "90 members · trainers and reviewers"],
  audits: ["Audits", "Audit records for Pod 3 fellows"],
  escalations: ["LLM Escalations", "Filing volume and confirmed rate, kept apart"],
  flags: ["Flags & Reports", "Disagreements and contamination reports, by direction"],
  submissions: ["Workflow Submissions", "Praise routed from Slack"],
  calibration: ["Calibration", "Scoring consistency across the pod"],
};

const RANGES: [RangeId, string][] = [
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["cycle", "This cycle"],
  ["custom", "Custom"],
];

const FACTOR: Record<RangeId, number> = { "7d": 0.26, "30d": 1, cycle: 1.7, custom: 0.72 };

/** [name, role, sqs, deltaCycle, approved, rejected, avgTime, flags, lastAudit] */
type FellowRow = [string, string, number, number, number, number, string, number, string];

const FELLOWS: FellowRow[] = [
  ["Amara Okafor", "Reviewer", 4.4, 0.3, 214, 19, "6m 20s", 0, "9 Aug"],
  ["Joaquín Reyes", "Reviewer", 2.6, -0.7, 188, 34, "3m 05s", 2, "11 Aug"],
  ["Sanne de Vries", "Trainer", 4.1, 0.1, 302, 11, "7m 42s", 0, "2 Aug"],
  ["Tobias Baptiste", "Reviewer", 2.4, -0.5, 141, 41, "2m 48s", 3, "4 Aug"],
  ["Priya Ganesh", "Trainer", 3.8, 0.6, 266, 22, "6m 55s", 1, "7 Aug"],
  ["Lukas Bergström", "Reviewer", 4.6, 0.2, 231, 14, "8m 10s", 0, "10 Aug"],
  ["Nkechi Oyelaran", "Reviewer", 2.2, -0.9, 176, 48, "2m 31s", 4, "28 Jul"],
  ["Célia Duarte", "Reviewer", 3.1, 1.1, 122, 27, "9m 04s", 0, "12 Aug"],
  ["Ravi Anand", "Trainer", 3.6, -0.2, 288, 24, "6m 12s", 1, "6 Aug"],
  ["Mira Halvorsen", "Reviewer", 4.2, 0.4, 197, 16, "7m 26s", 0, "8 Aug"],
  ["Diego Salcedo", "Trainer", 3.4, 0.0, 244, 29, "5m 48s", 1, "3 Aug"],
  ["Ilse Reinholt", "Reviewer", 2.8, -0.6, 163, 37, "3m 22s", 2, "1 Aug"],
  ["Kwame Amankwah", "Trainer", 3.9, 0.5, 271, 18, "6m 40s", 0, "5 Aug"],
  ["Bram Achterberg", "Reviewer", 2.1, -1.2, 154, 52, "2m 14s", 3, "30 Jul"],
];

function pts(vals: number[], w: number, h: number, min: number, max: number, padL = 0) {
  const n = vals.length;
  return vals
    .map((v, i) => {
      const x = padL + (n === 1 ? 0 : (i / (n - 1)) * (w - padL));
      const y = h - ((v - min) / (max - min)) * h;
      return x.toFixed(1) + "," + y.toFixed(1);
    })
    .join(" ");
}

type Tone = "green" | "rose" | "amber" | "violet" | "gray";

/** [fg, border, bg] */
const CHIP: Record<Tone, [string, string, string]> = {
  green: ["#047857", "#BFE7D8", "#F1FAF6"],
  rose: ["#BE123C", "#F6CDD6", "#FEF5F7"],
  amber: ["#9A5B0B", "#F2DCB8", "#FDF6EC"],
  violet: ["#5B37F0", "#DFDAFF", "#F4F2FF"],
  gray: ["#5C6270", "#E3E4E9", "#FAFAFB"],
};

const HIST_CUR = [4, 9, 21, 38, 18];
const HIST_PREV = [7, 13, 24, 33, 13];
const HIST_MAX = 40;

const ACTIVITY = {
  attempts: [58, 64, 61, 72, 69, 78, 74, 81, 77, 86, 83, 91],
  approvals: [44, 51, 47, 58, 56, 63, 61, 68, 63, 71, 70, 77],
  rejections: [12, 11, 13, 12, 11, 13, 11, 12, 12, 13, 11, 12],
  escalations: [1, 0, 2, 1, 0, 1, 3, 1, 0, 2, 1, 1],
};

const DETAIL_SQS = [3.6, 3.4, 3.1, 2.7, 2.6, 2.5, 2.8, 3.2, 3.4, 3.3, 2.9, 2.6];
const GUIDE_IDX = [3, 6, 10];
const GUIDE_TONE = ["#E11D48", "#C9821A", "#E11D48"];
const gx = (i: number) => (40 + (i / 11) * 1070).toFixed(1);

const MOVERS_UP: [string, string][] = [
  ["Célia Duarte", "+1.1"],
  ["Priya Ganesh", "+0.6"],
  ["Kwame Amankwah", "+0.5"],
  ["Mira Halvorsen", "+0.4"],
  ["Amara Okafor", "+0.3"],
];

const MOVERS_DOWN: [string, string][] = [
  ["Bram Achterberg", "−1.2"],
  ["Nkechi Oyelaran", "−0.9"],
  ["Joaquín Reyes", "−0.7"],
  ["Ilse Reinholt", "−0.6"],
  ["Tobias Baptiste", "−0.5"],
];

/** [date, fellow, auditor, sqs, assessment, factors] */
const AUDITS: [string, string, string, number, string, string[]][] = [
  ["12 Aug", "Célia Duarte", "L. Marchetti", 3, "Evidence missing", ["guideline drift"]],
  ["11 Aug", "Joaquín Reyes", "H. Bergström", 2, "Evidence missing", ["copied rationale", "rushed"]],
  ["11 Aug", "Amara Okafor", "R. Anand", 4, "None — pass", []],
  ["10 Aug", "Mira Halvorsen", "L. Marchetti", 4, "None — pass", []],
  ["10 Aug", "Lukas Bergström", "C. Duarte", 3, "Feedback not actionable", ["tone as defect"]],
  ["9 Aug", "Amara Okafor", "H. Bergström", 5, "None — pass", []],
  ["8 Aug", "Bram Achterberg", "R. Anand", 1, "Low-effort review", ["copied rationale"]],
  ["7 Aug", "Priya Ganesh", "L. Marchetti", 4, "None — pass", []],
  ["5 Aug", "Kwame Amankwah", "C. Duarte", 2, "Wrong principle code", ["guideline drift"]],
  ["4 Aug", "Tobias Baptiste", "H. Bergström", 2, "Wrong principle code", ["rushed", "scope"]],
];

const AUDITOR_DIST: { name: string; dist: number[]; tone: Tone; tag: string; note: string }[] = [
  { name: "L. Marchetti", dist: [0, 2, 11, 9, 1], tone: "amber", tag: "compressed", note: "Never uses the ends. Nothing they audit trips a pattern." },
  { name: "H. Bergström", dist: [2, 4, 7, 6, 3], tone: "green", tag: "healthy", note: "Full range, 6% disagreement with project review." },
  { name: "C. Duarte", dist: [5, 6, 3, 1, 0], tone: "rose", tag: "harsh · new", note: "69% below threshold. Reads like guideline uncertainty." },
  { name: "R. Anand", dist: [1, 3, 6, 7, 2], tone: "gray", tag: "steady", note: "Tracks the pod shape within a point." },
];

/** [week, generated, pasted, tooling] */
const ESC_BARS: [string, number, number, number][] = [
  ["W23", 1, 0, 1], ["W24", 2, 1, 0], ["W25", 1, 1, 1], ["W26", 3, 1, 0], ["W27", 2, 0, 1],
  ["W28", 4, 2, 1], ["W29", 3, 1, 0], ["W30", 5, 2, 1], ["W31", 4, 1, 2], ["W32", 6, 2, 1],
];

/** [date, fellow, type, detail, status, tone] */
const ESCALATIONS: [string, string, string, string, string, Tone][] = [
  ["12 Aug", "Bram Achterberg", "Generated rationale", "Identical phrasing across 6 tasks", "Confirmed", "rose"],
  ["11 Aug", "Nkechi Oyelaran", "Generated rationale", "Rationale reads machine-written", "Under review", "amber"],
  ["9 Aug", "Ilse Reinholt", "Pasted completion", "Reviewer text matches model output", "Confirmed", "rose"],
  ["8 Aug", "Tobias Baptiste", "Suspected tooling", "Timing pattern flagged by monitor", "Dismissed", "gray"],
  ["6 Aug", "Joaquín Reyes", "Generated rationale", "Filed by A. Okafor", "Dismissed", "gray"],
  ["3 Aug", "Diego Salcedo", "Pasted completion", "Partial match, single task", "Under review", "amber"],
];

const FLAG_TABLES = [
  {
    title: "Filed by",
    subtitle: "This fellow raised it",
    arrow: "↑",
    iconBg: "#6D4AFF",
    tone: "violet" as Tone,
    count: "9 in ",
    note: "Filing is vigilance. A fellow with nine filed and seven upheld is doing the job — count alone would read as trouble.",
    rows: [
      ["Amara Okafor", "Reviewer disagreement", "Upheld", "green"],
      ["Amara Okafor", "Correctness contamination", "Upheld", "green"],
      ["Mira Halvorsen", "Reviewer disagreement", "Upheld", "green"],
      ["Lukas Bergström", "Reviewer disagreement", "Overturned", "rose"],
      ["Sanne de Vries", "Correctness contamination", "Pending", "amber"],
    ] as [string, string, string, Tone][],
  },
  {
    title: "Filed on",
    subtitle: "Someone raised it about this fellow",
    arrow: "↓",
    iconBg: "#E11D48",
    tone: "rose" as Tone,
    count: "5 in ",
    note: "Overturned here means the fellow was right and the complaint wasn't. Two of these five clear them.",
    rows: [
      ["Bram Achterberg", "Reviewer disagreement", "Upheld", "rose"],
      ["Nkechi Oyelaran", "Correctness contamination", "Upheld", "rose"],
      ["Joaquín Reyes", "Reviewer disagreement", "Overturned", "green"],
      ["Tobias Baptiste", "Reviewer disagreement", "Pending", "amber"],
      ["Ilse Reinholt", "Correctness contamination", "Overturned", "green"],
    ] as [string, string, string, Tone][],
  },
];

/** [name, body, from, date] */
const SUBMISSIONS: [string, string, string, string][] = [
  ["Amara Okafor", "Stayed on a contamination thread for two hours after her shift so the batch didn't ship dirty.", "D. Hollins", "11 Aug"],
  ["Sanne de Vries", "Rewrote the S1-vs-S2 examples for the onboarding doc. Four new trainers used it this week.", "P. Ganesh", "9 Aug"],
  ["Célia Duarte", "Asked the question nobody else would ask in calibration. Guideline got fixed because of it.", "H. Bergström", "8 Aug"],
  ["Lukas Bergström", "Quietly picked up 40 tasks when Pod 2 was short. Didn't mention it.", "R. Adeyemi", "6 Aug"],
  ["Mira Halvorsen", "Feedback she writes gets quoted back to me by other reviewers as the example.", "D. Hollins", "4 Aug"],
  ["Kwame Amankwah", "Ran an impromptu session on anchoring evidence. Six people showed up on their own time.", "P. Ganesh", "1 Aug"],
];

const AGREEMENT: [string, number][] = [
  ["Amara Okafor", 0.1],
  ["Mira Halvorsen", -0.2],
  ["Lukas Bergström", 0.4],
  ["Joaquín Reyes", -0.9],
  ["Célia Duarte", 0.8],
  ["Bram Achterberg", -1.3],
];

const FELLOW_FILTERS = ["All roles", "Trainers", "Reviewers", "Below threshold", "Has open flags", "No audit in 14d"];
const FLAG_FILTERS = ["All types", "Reviewer disagreement", "Correctness contamination", "Upheld", "Overturned", "Pending"];

/** [date, sqs, assessment, factors] */
const DETAIL_AUDITS: [string, number, string, string[]][] = [
  ["11 Aug", 2, "Evidence missing", ["copied rationale", "rushed"]],
  ["28 Jul", 4, "None — pass", []],
  ["19 Jul", 3, "Feedback not actionable", ["guideline drift"]],
  ["8 Jul", 3, "None — pass", []],
  ["2 Jul", 2, "Evidence missing", ["rushed"]],
];

/** [arrow, iconBg, type, outcome, tone] */
const DETAIL_FLAGS: [string, string, string, string, Tone][] = [
  ["↓", "#E11D48", "Reviewer disagreement", "Overturned", "green"],
  ["↓", "#E11D48", "Correctness contamination", "Upheld", "rose"],
  ["↑", "#6D4AFF", "Reviewer disagreement", "Upheld", "green"],
  ["↑", "#6D4AFF", "Reviewer disagreement", "Pending", "amber"],
];

const DETAIL_PRAISE = [
  { body: "Turned around 30 re-reviews in a day when the batch slipped, without being asked.", from: "D. Hollins", date: "24 Jul" },
  { body: "Patient with a new trainer who kept missing the same code. Sat with them twice.", from: "S. de Vries", date: "12 Jul" },
];

export default function PodLeadDashboardPage() {
  const [section, setSection] = useState<SectionId>("overview");
  const [range, setRange] = useState<RangeId>("30d");
  const [fellow, setFellow] = useState<string | null>(null);
  const [fromSection, setFromSection] = useState<SectionId | null>(null);
  const [fellowFilter, setFellowFilter] = useState("All roles");
  const [flagFilter, setFlagFilter] = useState("All types");

  const f = FACTOR[range];
  const n = Math.round;
  const detailOpen = fellow !== null;
  const rangeLabel = (RANGES.find((r) => r[0] === range) ?? RANGES[1])[1];
  const title = TITLES[section];
  const frow = FELLOWS.find((r) => r[0] === fellow) ?? FELLOWS[1];

  const go = (id: SectionId) => {
    setSection(id);
    setFellow(null);
  };
  const openFellow = (name: string) => {
    setFellow(name);
    setFromSection(section);
  };

  const backLabel = TITLES[fromSection ?? "fellows"][0];

  const tiles = [
    { label: "Headcount", value: "90", delta: "62 trainers · 28 reviewers", deltaFg: "#8A8F9B" },
    { label: "Active today", value: "71", delta: "79% of pod", deltaFg: "#8A8F9B" },
    { label: "Open escalations", value: String(Math.max(1, n(6 * f))), delta: "2 past SLA", deltaFg: "#BE123C" },
    { label: "Open flags", value: String(Math.max(2, n(14 * f))), delta: "5 filed on · 9 filed by", deltaFg: "#8A8F9B" },
  ];

  const activeVals = [64, 69, 66, 74, 71, 77, 73, 79, 76, 81, 78, 71];

  const detailStats = [
    { label: "Current SQS", value: frow[2].toFixed(1), fg: frow[2] < 3 ? "#BE123C" : "#15171C" },
    { label: "Δ cycle", value: (frow[3] > 0 ? "+" : "−") + Math.abs(frow[3]).toFixed(1), fg: frow[3] > 0 ? "#047857" : "#BE123C" },
    { label: "Approved", value: String(frow[4]), fg: "#15171C" },
    { label: "Rejected", value: String(frow[5]), fg: "#15171C" },
    { label: "Avg time", value: frow[6], fg: "#15171C" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#F5F5F7", color: "#1B1D23", display: "flex", justifyContent: "center", padding: "32px 16px" }}>
      <div style={{ width: 1440, height: 980, flex: "none", display: "flex", background: "#FFFFFF", overflow: "hidden", fontSize: 13, borderRadius: 12, border: "1px solid #E3E4E9" }}>
        {/* Sidebar */}
        <div style={{ width: 208, flex: "none", borderRight: "1px solid #EBECF0", background: "#FAFAFB", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "18px 16px", borderBottom: "1px solid #EBECF0" }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: "#6D4AFF" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#15171C" }}>Project Violet</span>
              <span style={{ fontSize: 11, color: "#8A8F9B" }}>Pod 3 · D. Hollins</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, padding: "12px 10px" }}>
            {SECTIONS.map((s) => {
              const on = !detailOpen && section === s[0];
              return (
                <div
                  key={s[0]}
                  onClick={() => go(s[0])}
                  style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", borderRadius: 6, background: on ? "#F1F0FF" : "transparent" }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: on ? 600 : 400, color: on ? "#5B37F0" : "#5C6270" }}>{s[1]}</span>
                  <span style={{ fontSize: 11, color: on ? "#8B7DD8" : "#A0A5AF", fontVariantNumeric: "tabular-nums" }}>{s[2]}</span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 7, padding: "14px 16px", borderTop: "1px solid #EBECF0" }}>
            <span style={{ fontSize: 11, letterSpacing: "0.06em", color: "#A0A5AF" }}>POD HEALTH</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#EBECF0", overflow: "hidden", display: "flex" }}>
                <div style={{ width: "62%", background: "#059669" }} />
                <div style={{ width: "24%", background: "#C9821A" }} />
                <div style={{ width: "14%", background: "#E11D48" }} />
              </div>
            </div>
            <span style={{ fontSize: 11.5, lineHeight: 1.45, color: "#8A8F9B" }}>56 at or above · 21 borderline · 13 in the tail</span>
          </div>
        </div>

        {/* Main column */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, padding: "14px 24px", borderBottom: "1px solid #EBECF0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              {detailOpen && (
                <div
                  onClick={() => setFellow(null)}
                  style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 7, padding: "6px 11px", borderRadius: 7, border: "1px solid #E3E4E9", fontSize: 12.5, color: "#5C6270" }}
                >
                  ‹ {backLabel}
                </div>
              )}
              <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.015em", color: "#15171C", whiteSpace: "nowrap" }}>
                {detailOpen ? fellow : title[0]}
              </span>
              <span style={{ fontSize: 12.5, color: "#8A8F9B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {detailOpen ? "Timeline · " + frow[1] + " · Pod 3" : title[1]}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
              <span style={{ fontSize: 12, color: "#A0A5AF" }}>{rangeLabel} · re-filters this view</span>
              <div style={{ display: "flex", border: "1px solid #E3E4E9", borderRadius: 8, overflow: "hidden" }}>
                {RANGES.map((r, i) => {
                  const on = range === r[0];
                  return (
                    <div
                      key={r[0]}
                      onClick={() => setRange(r[0])}
                      style={{ cursor: "pointer", padding: "7px 13px", borderLeft: "1px solid " + (i === 0 ? "transparent" : "#E3E4E9"), background: on ? "#6D4AFF" : "#FFFFFF", fontSize: 12.5, fontWeight: 500, color: on ? "#FFFFFF" : "#5C6270" }}
                    >
                      {r[1]}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflow: "auto", background: "#FFFFFF" }}>
            {/* ── Overview ── */}
            {!detailOpen && section === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "20px 24px 28px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                  {tiles.map((t) => (
                    <div key={t.label} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "12px 14px", borderRadius: 9, border: "1px solid #EBECF0", background: "#FAFAFB" }}>
                      <span style={{ fontSize: 11.5, color: "#8A8F9B" }}>{t.label}</span>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em", color: "#15171C", fontVariantNumeric: "tabular-nums" }}>{t.value}</span>
                        <span style={{ fontSize: 11.5, color: t.deltaFg }}>{t.delta}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 16 }}>
                  {/* SQS distribution */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 18px", borderRadius: 11, border: "1px solid #EBECF0" }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: "#15171C" }}>SQS distribution</span>
                        <span style={{ fontSize: 11.5, color: "#8A8F9B" }}>{rangeLabel} · 90 fellows</span>
                      </div>
                      <div style={{ display: "flex", gap: 12 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#5C6270" }}>
                          <span style={{ width: 9, height: 9, borderRadius: 2, background: "#6D4AFF" }} />
                          this cycle
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#8A8F9B" }}>
                          <span style={{ width: 9, height: 9, borderRadius: 2, border: "1px solid #C6CAD3", background: "#F1F2F5" }} />
                          previous
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, alignItems: "end", height: 170 }}>
                      {HIST_CUR.map((c, i) => {
                        const shift = c - HIST_PREV[i];
                        const shiftFg = shift === 0 ? "#C0C4CC" : i < 2 ? (shift < 0 ? "#047857" : "#BE123C") : shift > 0 ? "#047857" : "#BE123C";
                        return (
                          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, height: "100%", justifyContent: "flex-end" }}>
                            <div style={{ position: "relative", width: "100%", height: 132, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: Math.max(3, n((HIST_PREV[i] / HIST_MAX) * 132)), borderRadius: "4px 4px 0 0", background: "#F1F2F5", border: "1px solid #E3E4E9", borderBottom: "none" }} />
                              <div style={{ position: "relative", width: "58%", height: Math.max(3, n((c / HIST_MAX) * 132)), borderRadius: "4px 4px 0 0", background: i < 2 ? "#E11D48" : i === 2 ? "#C9821A" : "#6D4AFF" }} />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#272A31", fontVariantNumeric: "tabular-nums" }}>{c}</span>
                              <span style={{ fontSize: 11.5, color: i < 2 ? "#BE123C" : "#8A8F9B" }}>SQS {i + 1}</span>
                              <span style={{ fontSize: 11, color: shiftFg }}>{shift === 0 ? "—" : (shift > 0 ? "+" : "") + shift}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <span style={{ fontSize: 11.5, lineHeight: 1.45, color: "#8A8F9B" }}>
                      The tail thinned by 7 and the 4-band grew by 5 — but 13 fellows still sit below threshold, and 4 of them are new to the band this cycle.
                    </span>
                  </div>

                  {/* Movers */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 11, padding: "16px 18px", borderRadius: 11, border: "1px solid #EBECF0" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "#15171C" }}>Movers</span>
                      <span style={{ fontSize: 11.5, color: "#8A8F9B" }}>Largest change since last cycle</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={{ fontSize: 11, letterSpacing: "0.06em", color: "#047857" }}>GAINED</span>
                        {MOVERS_UP.map((m) => (
                          <div key={m[0]} onClick={() => openFellow(m[0])} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 8px", borderRadius: 6, background: "#FAFAFB" }}>
                            <span style={{ fontSize: 12, color: "#3D414A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m[0]}</span>
                            <span style={{ flex: "none", fontSize: 12, fontWeight: 600, color: "#047857", fontVariantNumeric: "tabular-nums" }}>{m[1]}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={{ fontSize: 11, letterSpacing: "0.06em", color: "#BE123C" }}>DROPPED</span>
                        {MOVERS_DOWN.map((m) => (
                          <div key={m[0]} onClick={() => openFellow(m[0])} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 8px", borderRadius: 6, background: "#FAFAFB" }}>
                            <span style={{ fontSize: 12, color: "#3D414A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m[0]}</span>
                            <span style={{ flex: "none", fontSize: 12, fontWeight: 600, color: "#BE123C", fontVariantNumeric: "tabular-nums" }}>{m[1]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <span style={{ fontSize: 11.5, lineHeight: 1.45, color: "#8A8F9B" }}>Click a name to open their timeline.</span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 16 }}>
                  {/* Activity */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 18px", borderRadius: 11, border: "1px solid #EBECF0" }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "#15171C" }}>Activity</span>
                      <div style={{ display: "flex", gap: 12 }}>
                        {[
                          { label: "attempts", color: "#272A31" },
                          { label: "approvals", color: "#059669" },
                          { label: "rejections", color: "#E11D48" },
                          { label: "escalations", color: "#C9821A" },
                        ].map((l) => (
                          <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#5C6270" }}>
                            <span style={{ width: 9, height: 2, background: l.color }} />
                            {l.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <svg viewBox="0 0 700 190" style={{ width: "100%", height: 190, overflow: "visible" }}>
                      <line x1="0" y1="160" x2="700" y2="160" stroke="#EBECF0" strokeWidth="1" />
                      <line x1="0" y1="107" x2="700" y2="107" stroke="#F1F2F5" strokeWidth="1" />
                      <line x1="0" y1="54" x2="700" y2="54" stroke="#F1F2F5" strokeWidth="1" />
                      <polyline points={pts(ACTIVITY.attempts, 700, 160, 0, 100)} fill="none" stroke="#272A31" strokeWidth="1.75" strokeLinejoin="round" />
                      <polyline points={pts(ACTIVITY.approvals, 700, 160, 0, 100)} fill="none" stroke="#059669" strokeWidth="1.75" strokeLinejoin="round" />
                      <polyline points={pts(ACTIVITY.rejections, 700, 160, 0, 100)} fill="none" stroke="#E11D48" strokeWidth="1.75" strokeLinejoin="round" />
                      <polyline points={pts(ACTIVITY.escalations, 700, 160, 0, 100)} fill="none" stroke="#C9821A" strokeWidth="1.75" strokeLinejoin="round" />
                    </svg>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      {["14 Jul", "21 Jul", "28 Jul", "4 Aug", "11 Aug"].map((t) => (
                        <span key={t} style={{ fontSize: 11, color: "#A0A5AF" }}>{t}</span>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "14px 16px", borderRadius: 11, border: "1px solid #EBECF0" }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#15171C" }}>Active per day</span>
                        <span style={{ fontSize: 11.5, color: "#8A8F9B" }}>71 today · 79%</span>
                      </div>
                      <svg viewBox="0 0 320 84" style={{ width: "100%", height: 84 }}>
                        <polygon points={"0,84 " + pts(activeVals, 320, 74, 40, 90) + " 320,84"} fill="#F1F0FF" />
                        <polyline points={pts(activeVals, 320, 74, 40, 90)} fill="none" stroke="#6D4AFF" strokeWidth="1.75" />
                        <polyline points={pts([21, 23, 22, 25, 24, 26, 24, 27, 25, 28, 26, 24], 320, 74, 0, 40)} fill="none" stroke="#C9821A" strokeWidth="1.5" strokeDasharray="3 3" />
                      </svg>
                      <div style={{ display: "flex", gap: 14 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#5C6270" }}>
                          <span style={{ width: 9, height: 2, background: "#6D4AFF" }} />
                          members
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#5C6270" }}>
                          <span style={{ width: 9, height: 2, background: "#C9821A" }} />
                          reviewers
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "14px 16px", borderRadius: 11, border: "1px solid #EBECF0" }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#15171C" }}>Avg time on task</span>
                        <span style={{ fontSize: 11.5, color: "#047857" }}>6m 42s · up 1m 30s</span>
                      </div>
                      <svg viewBox="0 0 320 74" style={{ width: "100%", height: 74 }}>
                        <polyline points={pts([5.1, 5.3, 5.0, 5.6, 5.4, 5.9, 6.1, 6.4, 6.2, 6.6, 6.8, 6.7], 320, 66, 4, 7.5)} fill="none" stroke="#059669" strokeWidth="1.75" />
                      </svg>
                      <span style={{ fontSize: 11.5, color: "#8A8F9B" }}>Median across the pod, per day.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Fellows ── */}
            {!detailOpen && section === "fellows" && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 24px", borderBottom: "1px solid #EBECF0", flexWrap: "wrap" }}>
                  {FELLOW_FILTERS.map((l) => {
                    const on = fellowFilter === l;
                    return (
                      <div
                        key={l}
                        onClick={() => setFellowFilter(l)}
                        style={{ cursor: "pointer", padding: "6px 12px", borderRadius: 7, border: "1px solid " + (on ? "#DFDAFF" : "#E3E4E9"), background: on ? "#F1F0FF" : "#FFFFFF", fontSize: 12.5, color: on ? "#5B37F0" : "#5C6270" }}
                      >
                        {l}
                      </div>
                    );
                  })}
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "#8A8F9B" }}>Showing 14 of 90 · sorted by Δ cycle</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "190px 96px 150px 90px 78px 78px 104px 74px 104px", padding: "10px 24px", borderBottom: "1px solid #EBECF0", fontSize: 11, letterSpacing: "0.04em", color: "#A0A5AF" }}>
                  <span>FELLOW</span><span>ROLE</span><span>SQS · TREND</span><span>Δ CYCLE</span><span>APPROVED</span><span>REJECTED</span><span>AVG TIME</span><span>FLAGS</span><span>LAST AUDIT</span>
                </div>
                {FELLOWS.map((r) => {
                  const below = r[2] < 3;
                  const up = r[3] > 0;
                  const spark = [r[2] - r[3] * 1.2, r[2] - r[3] * 0.9, r[2] - r[3] * 0.4, r[2] - r[3] * 0.6, r[2] - r[3] * 0.2, r[2]];
                  return (
                    <div key={r[0]} style={{ display: "grid", gridTemplateColumns: "190px 96px 150px 90px 78px 78px 104px 74px 104px", alignItems: "center", padding: "9px 24px", borderBottom: "1px solid #F5F5F7", borderLeft: "3px solid " + (below ? "#E11D48" : "transparent") }}>
                      <span onClick={() => openFellow(r[0])} style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 500, color: "#15171C", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 12 }}>{r[0]}</span>
                      <span style={{ fontSize: 12, color: "#767C89" }}>{r[1]}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: below ? "#BE123C" : r[2] < 3.5 ? "#9A5B0B" : "#15171C", fontVariantNumeric: "tabular-nums", width: 22 }}>{r[2].toFixed(1)}</span>
                        <svg viewBox="0 0 74 22" style={{ width: 74, height: 22 }}>
                          <polyline points={pts(spark, 74, 18, 1.5, 5)} fill="none" stroke={up ? "#059669" : r[3] === 0 ? "#C6CAD3" : "#E11D48"} strokeWidth="1.5" />
                        </svg>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 500, color: r[3] === 0 ? "#A0A5AF" : up ? "#047857" : "#BE123C", fontVariantNumeric: "tabular-nums" }}>
                        {(r[3] > 0 ? "▲ +" : r[3] < 0 ? "▼ −" : "— ") + (r[3] === 0 ? "" : Math.abs(r[3]).toFixed(1))}
                      </span>
                      <span style={{ fontSize: 12, color: "#3D414A", fontVariantNumeric: "tabular-nums" }}>{r[4]}</span>
                      <span style={{ fontSize: 12, color: "#3D414A", fontVariantNumeric: "tabular-nums" }}>{r[5]}</span>
                      <span style={{ fontSize: 12, color: "#3D414A", fontVariantNumeric: "tabular-nums" }}>{r[6]}</span>
                      <span style={{ justifySelf: "start", fontSize: 11.5, color: r[7] === 0 ? "#A0A5AF" : r[7] > 2 ? "#BE123C" : "#9A5B0B", border: "1px solid " + (r[7] === 0 ? "#F1F2F5" : r[7] > 2 ? "#F6CDD6" : "#F2DCB8"), background: r[7] === 0 ? "#FFFFFF" : r[7] > 2 ? "#FEF5F7" : "#FDF6EC", borderRadius: 5, padding: "2px 8px" }}>
                        {r[7] === 0 ? "—" : String(r[7])}
                      </span>
                      <span style={{ fontSize: 12, color: r[8] === "28 Jul" || r[8] === "30 Jul" ? "#BE123C" : "#767C89" }}>{r[8]}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Audits ── */}
            {!detailOpen && section === "audits" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "20px 24px 28px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 18px", borderRadius: 11, border: "1px solid #EBECF0" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "#15171C" }}>Score distribution by auditor</span>
                      <span style={{ fontSize: 11.5, color: "#8A8F9B" }}>Same pod, same window — a shape that differs is auditor drift, not fellow performance</span>
                    </div>
                    <span style={{ fontSize: 11.5, color: "#8A8F9B" }}>{n(38 * f)} audits in {rangeLabel}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                    {AUDITOR_DIST.map((a) => {
                      const c = CHIP[a.tone];
                      const max = Math.max(...a.dist);
                      return (
                        <div key={a.name} style={{ display: "flex", flexDirection: "column", gap: 9, padding: "13px 14px", borderRadius: 10, border: "1px solid " + c[1], background: c[2] }}>
                          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                            <span style={{ fontSize: 12.5, fontWeight: 500, color: "#15171C" }}>{a.name}</span>
                            <span style={{ fontSize: 11, color: c[0] }}>{a.tag}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 52 }}>
                            {a.dist.map((v, i) => (
                              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                <div style={{ width: "100%", height: Math.max(3, n((v / max) * 44)), borderRadius: 3, background: v === max ? c[0] : c[1] }} />
                                <span style={{ fontSize: 10, color: "#A0A5AF" }}>{i + 1}</span>
                              </div>
                            ))}
                          </div>
                          <span style={{ fontSize: 11.5, lineHeight: 1.4, color: "#5C6270" }}>{a.note}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{ border: "1px solid #EBECF0", borderRadius: 11, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "92px 170px 150px 68px 190px 1fr", padding: "10px 16px", borderBottom: "1px solid #EBECF0", background: "#FAFAFB", fontSize: 11, letterSpacing: "0.04em", color: "#A0A5AF" }}>
                    <span>DATE</span><span>FELLOW</span><span>AUDITOR</span><span>SQS</span><span>PRIMARY ASSESSMENT</span><span>CONTRIBUTING FACTORS</span>
                  </div>
                  {AUDITS.map((a, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "92px 170px 150px 68px 190px 1fr", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #F5F5F7" }}>
                      <span style={{ fontFamily: MONO, fontSize: 11.5, color: "#767C89" }}>{a[0]}</span>
                      <span onClick={() => openFellow(a[1])} style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 500, color: "#15171C" }}>{a[1]}</span>
                      <span style={{ fontSize: 12, color: "#5C6270" }}>{a[2]}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: a[3] < 3 ? "#BE123C" : a[3] === 3 ? "#9A5B0B" : "#15171C", fontVariantNumeric: "tabular-nums" }}>{a[3]}</span>
                      <span style={{ fontSize: 12, color: "#3D414A" }}>{a[4]}</span>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {a[5].map((t) => (
                          <span key={t} style={{ fontSize: 11, color: "#5C6270", border: "1px solid #E3E4E9", borderRadius: 5, padding: "2px 7px" }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── LLM Escalations ── */}
            {!detailOpen && section === "escalations" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "20px 24px 28px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 18px", borderRadius: 11, border: "1px solid #EBECF0" }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "#15171C" }}>Escalation volume by type</span>
                      <div style={{ display: "flex", gap: 12 }}>
                        {[
                          { label: "generated rationale", color: "#6D4AFF" },
                          { label: "pasted completion", color: "#C9821A" },
                          { label: "suspected tooling", color: "#DFDAFF" },
                        ].map((l) => (
                          <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#5C6270" }}>
                            <span style={{ width: 9, height: 9, borderRadius: 2, background: l.color }} />
                            {l.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 8, minHeight: 150 }}>
                      {ESC_BARS.map((b) => (
                        <div key={b[0]} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                          <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                            <div style={{ width: "100%", height: b[3] * 11, background: "#DFDAFF" }} />
                            <div style={{ width: "100%", height: b[2] * 11, background: "#C9821A" }} />
                            <div style={{ width: "100%", height: b[1] * 11, background: "#6D4AFF" }} />
                          </div>
                          <span style={{ fontSize: 10.5, color: "#A0A5AF" }}>{b[0]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "15px 16px", borderRadius: 11, border: "1px solid #EBECF0" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "#15171C" }}>Filed-by volume</span>
                      <span style={{ fontSize: 11.5, lineHeight: 1.45, color: "#8A8F9B" }}>Vigilance. High is not a problem.</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 2 }}>
                        {([["Amara Okafor", 11], ["Mira Halvorsen", 8], ["Lukas Bergström", 6], ["Sanne de Vries", 3]] as [string, number][]).map((r) => (
                          <div key={r[0]} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span onClick={() => openFellow(r[0])} style={{ cursor: "pointer", width: 104, flex: "none", fontSize: 12, color: "#3D414A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r[0]}</span>
                            <div style={{ flex: 1, height: 8, borderRadius: 4, background: "#F1F2F5", overflow: "hidden" }}>
                              <div style={{ width: n((r[1] / 12) * 100) + "%", height: "100%", background: "#6D4AFF" }} />
                            </div>
                            <span style={{ flex: "none", width: 22, textAlign: "right", fontSize: 12, color: "#3D414A", fontVariantNumeric: "tabular-nums" }}>{r[1]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "15px 16px", borderRadius: 11, border: "1px solid #EBECF0" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "#15171C" }}>Confirmed rate</span>
                      <span style={{ fontSize: 11.5, lineHeight: 1.45, color: "#8A8F9B" }}>Quality of the call. Kept separate on purpose.</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 2 }}>
                        {([["Amara Okafor", 82], ["Sanne de Vries", 67], ["Mira Halvorsen", 50], ["Lukas Bergström", 17]] as [string, number][]).map((r) => (
                          <div key={r[0]} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span onClick={() => openFellow(r[0])} style={{ cursor: "pointer", width: 104, flex: "none", fontSize: 12, color: "#3D414A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r[0]}</span>
                            <div style={{ flex: 1, height: 8, borderRadius: 4, background: "#F1F2F5", overflow: "hidden" }}>
                              <div style={{ width: r[1] + "%", height: "100%", background: r[1] > 70 ? "#059669" : r[1] > 40 ? "#C9821A" : "#E11D48" }} />
                            </div>
                            <span style={{ flex: "none", width: 34, textAlign: "right", fontSize: 12, color: r[1] > 70 ? "#047857" : r[1] > 40 ? "#9A5B0B" : "#BE123C", fontVariantNumeric: "tabular-nums" }}>{r[1]}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ border: "1px solid #EBECF0", borderRadius: 11, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "92px 170px 200px 1fr 130px", padding: "10px 16px", borderBottom: "1px solid #EBECF0", background: "#FAFAFB", fontSize: 11, letterSpacing: "0.04em", color: "#A0A5AF" }}>
                    <span>DATE</span><span>FELLOW</span><span>TYPE</span><span>DETAIL</span><span>RESOLUTION</span>
                  </div>
                  {ESCALATIONS.map((e, i) => {
                    const c = CHIP[e[5]];
                    return (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "92px 170px 200px 1fr 130px", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #F5F5F7" }}>
                        <span style={{ fontFamily: MONO, fontSize: 11.5, color: "#767C89" }}>{e[0]}</span>
                        <span onClick={() => openFellow(e[1])} style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 500, color: "#15171C" }}>{e[1]}</span>
                        <span style={{ fontSize: 12, color: "#3D414A" }}>{e[2]}</span>
                        <span style={{ fontSize: 12, color: "#767C89", paddingRight: 16 }}>{e[3]}</span>
                        <span style={{ justifySelf: "start", fontSize: 11.5, color: c[0], border: "1px solid " + c[1], background: c[2], borderRadius: 5, padding: "3px 9px" }}>{e[4]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Flags & Reports ── */}
            {!detailOpen && section === "flags" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "20px 24px 28px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {FLAG_FILTERS.map((l) => {
                    const on = flagFilter === l;
                    return (
                      <div
                        key={l}
                        onClick={() => setFlagFilter(l)}
                        style={{ cursor: "pointer", padding: "6px 12px", borderRadius: 7, border: "1px solid " + (on ? "#DFDAFF" : "#E3E4E9"), background: on ? "#F1F0FF" : "#FFFFFF", fontSize: 12.5, color: on ? "#5B37F0" : "#5C6270" }}
                      >
                        {l}
                      </div>
                    );
                  })}
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "#8A8F9B" }}>Direction is a column, never a total</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {FLAG_TABLES.map((t) => {
                    const c = CHIP[t.tone];
                    return (
                      <div key={t.title} style={{ border: "1px solid " + c[1], borderRadius: 11, overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "13px 16px", borderBottom: "1px solid " + c[1], background: c[2] }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ width: 22, height: 22, borderRadius: 6, background: t.iconBg, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{t.arrow}</span>
                            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#15171C" }}>{t.title}</span>
                              <span style={{ fontSize: 11.5, color: "#5C6270" }}>{t.subtitle}</span>
                            </div>
                          </div>
                          <span style={{ fontSize: 12, color: c[0], fontVariantNumeric: "tabular-nums" }}>{t.count + rangeLabel}</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 96px", padding: "9px 16px", borderBottom: "1px solid #F1F2F5", fontSize: 11, letterSpacing: "0.04em", color: "#A0A5AF" }}>
                          <span>FELLOW</span><span>TYPE</span><span>OUTCOME</span>
                        </div>
                        {t.rows.map((r, i) => {
                          const rc = CHIP[r[3]];
                          return (
                            <div key={i} style={{ display: "grid", gridTemplateColumns: "150px 1fr 96px", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #F5F5F7" }}>
                              <span onClick={() => openFellow(r[0])} style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 500, color: "#15171C", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 10 }}>{r[0]}</span>
                              <span style={{ fontSize: 12, color: "#5C6270", paddingRight: 10 }}>{r[1]}</span>
                              <span style={{ justifySelf: "start", fontSize: 11.5, color: rc[0], border: "1px solid " + rc[1], background: rc[2], borderRadius: 5, padding: "3px 8px" }}>{r[2]}</span>
                            </div>
                          );
                        })}
                        <div style={{ padding: "12px 16px", background: "#FAFAFB", fontSize: 11.5, lineHeight: 1.5, color: "#5C6270" }}>{t.note}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Workflow Submissions ── */}
            {!detailOpen && section === "submissions" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "20px 24px 28px", background: "#FBFAF7" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "#15171C" }}>Praise &amp; recognition</span>
                    <span style={{ fontSize: 12, color: "#8A8F9B", maxWidth: "70ch" }}>
                      Routed from Slack. Deliberately off the performance axis — no scores, no throughput, no ranking. Reading these next to SQS would turn recognition into a metric.
                    </span>
                  </div>
                  <span style={{ flex: "none", fontSize: 11.5, color: "#9A5B0B", border: "1px solid #F2DCB8", background: "#FDF6EC", borderRadius: 6, padding: "5px 11px" }}>not scored</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                  {SUBMISSIONS.map((s, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: 9, padding: "15px 16px", borderRadius: 11, border: "1px solid #EFE7D6", background: "#FFFFFF" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <span onClick={() => openFellow(s[0])} style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "#15171C" }}>{s[0]}</span>
                      </div>
                      <span style={{ fontSize: 12.5, lineHeight: 1.6, color: "#3D414A" }}>{s[1]}</span>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 2 }}>
                        <span style={{ fontSize: 11.5, color: "#8A8F9B" }}>from {s[2]}</span>
                        <span style={{ fontFamily: MONO, fontSize: 11, color: "#A0A5AF" }}>{s[3]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Calibration ── */}
            {!detailOpen && section === "calibration" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "20px 24px 28px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 18px", borderRadius: 11, border: "1px solid #EBECF0" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "#15171C" }}>Reviewer agreement with audit</span>
                      <span style={{ fontSize: 11.5, color: "#8A8F9B" }}>Where the reviewer&rsquo;s score and the auditor&rsquo;s differ, and by how much</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {AGREEMENT.map((a) => {
                        const d = a[1];
                        const mag = Math.min(Math.abs(d) / 1.5, 1) * 48;
                        const color = Math.abs(d) > 0.7 ? "#E11D48" : Math.abs(d) > 0.3 ? "#C9821A" : "#059669";
                        const fg = Math.abs(d) > 0.7 ? "#BE123C" : Math.abs(d) > 0.3 ? "#9A5B0B" : "#047857";
                        return (
                          <div key={a[0]} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span onClick={() => openFellow(a[0])} style={{ cursor: "pointer", width: 130, flex: "none", fontSize: 12, color: "#3D414A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a[0]}</span>
                            <div style={{ flex: 1, position: "relative", height: 20 }}>
                              <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "#E3E4E9" }} />
                              <div style={{ position: "absolute", top: 5, height: 10, borderRadius: 3, left: d < 0 ? 50 - mag + "%" : "50%", width: mag + "%", background: color }} />
                            </div>
                            <span style={{ flex: "none", width: 46, textAlign: "right", fontSize: 12, color: fg, fontVariantNumeric: "tabular-nums" }}>
                              {(d > 0 ? "+" : "−") + Math.abs(d).toFixed(1)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <span style={{ fontSize: 11.5, lineHeight: 1.45, color: "#8A8F9B" }}>Left of the line is scoring softer than the audit, right is harsher.</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 18px", borderRadius: 11, border: "1px solid #EBECF0" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "#15171C" }}>Spread over time</span>
                      <span style={{ fontSize: 11.5, color: "#8A8F9B" }}>Pod score spread, cycle by cycle — widening means calibration is slipping</span>
                    </div>
                    <svg viewBox="0 0 340 150" style={{ width: "100%", height: 150 }}>
                      <line x1="0" y1="130" x2="340" y2="130" stroke="#EBECF0" strokeWidth="1" />
                      <polygon
                        points={
                          pts([4.4, 4.5, 4.6, 4.6, 4.7, 4.8], 340, 110, 1, 5, 10) +
                          " " +
                          pts([2.6, 2.5, 2.4, 2.2, 2.1, 1.9], 340, 110, 1, 5, 10).split(" ").reverse().join(" ")
                        }
                        fill="#F1F0FF"
                      />
                      <polyline points={pts([4.4, 4.5, 4.6, 4.6, 4.7, 4.8], 340, 110, 1, 5, 10)} fill="none" stroke="#6D4AFF" strokeWidth="1.5" />
                      <polyline points={pts([2.6, 2.5, 2.4, 2.2, 2.1, 1.9], 340, 110, 1, 5, 10)} fill="none" stroke="#6D4AFF" strokeWidth="1.5" />
                      <polyline points={pts([3.5, 3.5, 3.6, 3.5, 3.5, 3.4], 340, 110, 1, 5, 10)} fill="none" stroke="#C9821A" strokeWidth="1.75" strokeDasharray="3 3" />
                    </svg>
                    <div style={{ display: "flex", gap: 14 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#5C6270" }}>
                        <span style={{ width: 9, height: 2, background: "#6D4AFF" }} />
                        p10 / p90
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#5C6270" }}>
                        <span style={{ width: 9, height: 2, background: "#C9821A" }} />
                        median
                      </span>
                    </div>
                    <span style={{ fontSize: 11.5, lineHeight: 1.45, color: "#5C6270" }}>
                      Median flat, band widening — the pod isn&rsquo;t getting worse on average, it&rsquo;s coming apart at the ends.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Fellow detail ── */}
            {detailOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "20px 24px 28px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "15px 18px", borderRadius: 11, border: "1px solid #EBECF0", background: "#FAFAFB" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em", color: "#15171C" }}>{frow[0]}</span>
                    <span style={{ fontSize: 12, color: "#8A8F9B" }}>{frow[1]} · joined 14 Mar · 5 months</span>
                  </div>
                  <div style={{ width: 1, height: 34, background: "#E3E4E9" }} />
                  {detailStats.map((s) => (
                    <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 11, color: "#8A8F9B" }}>{s.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: s.fg, fontVariantNumeric: "tabular-nums" }}>{s.value}</span>
                    </div>
                  ))}
                  <span style={{ marginLeft: "auto", flex: "none", fontSize: 11.5, color: frow[2] < 3 ? "#BE123C" : "#047857", border: "1px solid " + (frow[2] < 3 ? "#F6CDD6" : "#BFE7D8"), background: frow[2] < 3 ? "#FEF5F7" : "#F1FAF6", borderRadius: 6, padding: "5px 11px" }}>
                    {frow[2] < 3 ? "Intervention open" : "In good standing"}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 18px", borderRadius: 11, border: "1px solid #EBECF0" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "#15171C" }}>SQS over time</span>
                      <span style={{ fontSize: 11.5, color: "#8A8F9B" }}>Audits, flags and coaching on the same axis — the only way to see whether anything changed after</span>
                    </div>
                    <div style={{ display: "flex", gap: 14 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#5C6270" }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: "#6D4AFF" }} />
                        audit
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#5C6270" }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: "#E11D48" }} />
                        flag
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#5C6270" }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: "#C9821A" }} />
                        coaching
                      </span>
                    </div>
                  </div>
                  <svg viewBox="0 0 1120 250" style={{ width: "100%", height: 250 }}>
                    <line x1="40" y1="30" x2="1110" y2="30" stroke="#F1F2F5" strokeWidth="1" />
                    <line x1="40" y1="82" x2="1110" y2="82" stroke="#F1F2F5" strokeWidth="1" />
                    <line x1="40" y1="134" x2="1110" y2="134" stroke="#F1F2F5" strokeWidth="1" />
                    <line x1="40" y1="186" x2="1110" y2="186" stroke="#EBECF0" strokeWidth="1" />
                    <text x="0" y="34" fontSize="11" fill="#A0A5AF">5</text>
                    <text x="0" y="86" fontSize="11" fill="#A0A5AF">4</text>
                    <text x="0" y="138" fontSize="11" fill="#A0A5AF">3</text>
                    <text x="0" y="190" fontSize="11" fill="#A0A5AF">2</text>
                    {GUIDE_IDX.map((gi, k) => (
                      <line key={k} x1={gx(gi)} y1="24" x2={gx(gi)} y2="196" stroke={GUIDE_TONE[k]} strokeWidth="1" strokeDasharray="3 4" />
                    ))}
                    <polyline points={pts(DETAIL_SQS, 1110, 186, 1.8, 5.2, 40)} fill="none" stroke="#272A31" strokeWidth="2" strokeLinejoin="round" />
                    {[1, 4, 7, 9, 11].map((i) => (
                      <circle
                        key={i}
                        cx={gx(i)}
                        cy={(186 - ((DETAIL_SQS[i] - 1.8) / 3.4) * 186).toFixed(1)}
                        r="4"
                        fill={DETAIL_SQS[i] < 3 ? "#E11D48" : "#6D4AFF"}
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                      />
                    ))}
                    {([[3, "#E11D48"], [6, "#C9821A"], [10, "#E11D48"]] as [number, string][]).map((e, k) => (
                      <rect key={k} x={(parseFloat(gx(e[0])) - 4.5).toFixed(1)} y="206" width="9" height="9" rx="2" fill={e[1]} />
                    ))}
                  </svg>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "0 6px 0 40px" }}>
                    {["26 May", "9 Jun", "23 Jun", "7 Jul", "21 Jul", "11 Aug"].map((t) => (
                      <span key={t} style={{ fontSize: 11, color: "#A0A5AF" }}>{t}</span>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {[
                      { label: "2 Jul — coached on evidence anchoring", fg: "#9A5B0B", border: "#F2DCB8", bg: "#FDF6EC" },
                      { label: "21 Jul — closed as improved", fg: "#047857", border: "#BFE7D8", bg: "#F1FAF6" },
                      { label: "11 Aug — flagged again, same code", fg: "#BE123C", border: "#F6CDD6", bg: "#FEF5F7" },
                    ].map((a) => (
                      <span key={a.label} style={{ fontSize: 11.5, color: a.fg, border: "1px solid " + a.border, background: a.bg, borderRadius: 6, padding: "4px 10px" }}>{a.label}</span>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "15px 18px", borderRadius: 11, border: "1px solid #EBECF0" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "#15171C" }}>Throughput</span>
                    <span style={{ fontSize: 11.5, color: "#8A8F9B" }}>same x axis as the score line — guides at the same three events</span>
                  </div>
                  <svg viewBox="0 0 1120 104" style={{ width: "100%", height: 104 }}>
                    <text x="0" y="16" fontSize="11" fill="#A0A5AF">55</text>
                    <text x="0" y="96" fontSize="11" fill="#A0A5AF">30</text>
                    {GUIDE_IDX.map((gi, k) => (
                      <line key={k} x1={gx(gi)} y1="4" x2={gx(gi)} y2="98" stroke={GUIDE_TONE[k]} strokeWidth="1" strokeDasharray="3 4" />
                    ))}
                    <polyline points={pts([44, 47, 43, 39, 41, 38, 42, 46, 45, 44, 43, 41], 1110, 92, 30, 55, 40)} fill="none" stroke="#6D4AFF" strokeWidth="1.75" />
                  </svg>
                  <span style={{ fontSize: 11.5, color: "#8A8F9B" }}>Volume held flat through all three events — this wasn&rsquo;t a throughput problem.</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "15px 18px", borderRadius: 11, border: "1px solid #EBECF0" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "#15171C" }}>Avg completion time</span>
                    <span style={{ fontSize: 11.5, color: "#9A5B0B" }}>+38% after coaching</span>
                  </div>
                  <svg viewBox="0 0 1120 104" style={{ width: "100%", height: 104 }}>
                    <text x="0" y="16" fontSize="11" fill="#A0A5AF">4m</text>
                    <text x="0" y="96" fontSize="11" fill="#A0A5AF">2m</text>
                    {GUIDE_IDX.map((gi, k) => (
                      <line key={k} x1={gx(gi)} y1="4" x2={gx(gi)} y2="98" stroke={GUIDE_TONE[k]} strokeWidth="1" strokeDasharray="3 4" />
                    ))}
                    <polyline points={pts([2.4, 2.3, 2.2, 2.1, 2.2, 2.3, 3.4, 3.8, 3.6, 3.5, 3.1, 3.0], 1110, 92, 1.8, 4.2, 40)} fill="none" stroke="#C9821A" strokeWidth="1.75" />
                  </svg>
                  <span style={{ fontSize: 11.5, color: "#8A8F9B" }}>Steps up at the coaching guide and holds — reading properly costs time. It falls back as the score falls back.</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 16 }}>
                  <div style={{ border: "1px solid #EBECF0", borderRadius: 11, overflow: "hidden" }}>
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid #EBECF0", fontSize: 12.5, fontWeight: 600, color: "#15171C" }}>Audit history</div>
                    <div style={{ display: "grid", gridTemplateColumns: "84px 56px 170px 1fr", padding: "9px 16px", borderBottom: "1px solid #F1F2F5", fontSize: 11, letterSpacing: "0.04em", color: "#A0A5AF" }}>
                      <span>DATE</span><span>SQS</span><span>ASSESSMENT</span><span>FACTORS</span>
                    </div>
                    {DETAIL_AUDITS.map((a, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "84px 56px 170px 1fr", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #F5F5F7" }}>
                        <span style={{ fontFamily: MONO, fontSize: 11.5, color: "#767C89" }}>{a[0]}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: a[1] < 3 ? "#BE123C" : a[1] === 3 ? "#9A5B0B" : "#15171C", fontVariantNumeric: "tabular-nums" }}>{a[1]}</span>
                        <span style={{ fontSize: 12, color: "#3D414A" }}>{a[2]}</span>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {a[3].map((t) => (
                            <span key={t} style={{ fontSize: 11, color: "#5C6270", border: "1px solid #E3E4E9", borderRadius: 5, padding: "2px 7px" }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ border: "1px solid #EBECF0", borderRadius: 11, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #EBECF0" }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#15171C" }}>Flags</span>
                        <span style={{ fontSize: 11.5, color: "#8A8F9B" }}>both directions</span>
                      </div>
                      {DETAIL_FLAGS.map((fl, i) => {
                        const c = CHIP[fl[4]];
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid #F5F5F7" }}>
                            <span style={{ flex: "none", width: 20, height: 20, borderRadius: 5, background: fl[1], color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{fl[0]}</span>
                            <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: "#3D414A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fl[2]}</span>
                            <span style={{ flex: "none", fontSize: 11.5, color: c[0], border: "1px solid " + c[1], background: c[2], borderRadius: 5, padding: "2px 8px" }}>{fl[3]}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "15px 16px", borderRadius: 11, border: "1px solid #EFE7D6", background: "#FBFAF7" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#15171C" }}>Recognition</span>
                        <span style={{ fontSize: 11, color: "#9A5B0B", border: "1px solid #F2DCB8", background: "#FDF6EC", borderRadius: 5, padding: "2px 8px" }}>not scored</span>
                      </div>
                      {DETAIL_PRAISE.map((p, i) => (
                        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "11px 12px", borderRadius: 9, border: "1px solid #EFE7D6", background: "#FFFFFF" }}>
                          <span style={{ fontSize: 12, lineHeight: 1.55, color: "#3D414A" }}>{p.body}</span>
                          <span style={{ fontSize: 11, color: "#8A8F9B" }}>from {p.from} · {p.date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
