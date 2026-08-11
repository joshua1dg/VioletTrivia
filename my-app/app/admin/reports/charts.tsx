"use client";

// The one client boundary the report pages have: recharts renders through
// hooks, so these live behind "use client" while every page stays a Server
// Component that just hands them numbers.
//
// Colors are the app tokens by value — SVG fills can't reach Tailwind
// classes, and the design is light-only (app/globals.css), so hardcoding
// the hex here loses nothing:
//   violet #6d4aff · violet-tint-3 #ebe7ff · ok #059669 · bad #e11d48
//   line-3 #f1f2f5 · line #e3e4e9 · faint-2 #c0c4cc · muted #5c6270

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DayCount } from "@/lib/services/reports";
import type { TallyGroup } from "@/lib/templates/types";

const VIOLET = "#6d4aff";
const VIOLET_TINT = "#ebe7ff";
const NEUTRALS = ["#8a8f9b", "#a0a5af", "#c0c4cc", "#d9dbe2"];

/**
 * A correct-rate donut with the percentage in the middle. The number IS
 * the chart — the ring gives it shape at a glance; the exact x/y stays in
 * the caption underneath, same honesty rule as ScoreBar.
 */
export function RateDonut({
  correct,
  total,
  caption,
}: {
  correct: number;
  total: number;
  caption: string;
}) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const data = [
    { name: "correct", value: correct },
    { name: "missed", value: Math.max(total - correct, 0) },
  ];

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-[124px] w-[124px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={44}
              outerRadius={58}
              startAngle={90}
              endAngle={-270}
              strokeWidth={0}
              isAnimationActive={false}
            >
              <Cell fill={VIOLET} />
              <Cell fill={VIOLET_TINT} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <span className="absolute inset-0 flex items-center justify-center text-[20px] font-semibold tracking-[-0.02em] text-ink">
          {pct}%
        </span>
      </div>
      <span className="text-[12px] text-muted-3">{caption}</span>
    </div>
  );
}

/**
 * One donut, or two side by side with a label over each — the pod-vs-project
 * comparison every rate donut on these screens now needs. A single item
 * renders exactly as `RateDonut` always did (no label — there's nothing to
 * distinguish it from), so pages with no pod to show are unaffected.
 */
export function RateDonutRow({
  items,
}: {
  items: { label: string; correct: number; total: number; caption: string }[];
}) {
  if (items.length <= 1) {
    return items[0] ? <RateDonut {...items[0]} /> : null;
  }

  // Item 0 is always the project; everything after it is a pod slice.
  // The pod gets the violet card so the separation reads at a glance —
  // violet = your pod, plain = the project — the same code every report
  // surface uses (score bars mark their pod line in violet too).
  return (
    <div className="flex flex-wrap items-start gap-5">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`flex flex-col items-center gap-1.5 ${
            index > 0
              ? "rounded-[10px] border border-violet-line-2 bg-violet-tint px-4 py-2.5"
              : "px-4 py-2.5"
          }`}
        >
          <span
            className={`text-[11px] tracking-[0.04em] ${
              index > 0 ? "font-medium text-violet-ink" : "text-faint"
            }`}
          >
            {item.label.toUpperCase()}
          </span>
          <RateDonut
            correct={item.correct}
            total={item.total}
            caption={item.caption}
          />
        </div>
      ))}
    </div>
  );
}

/** Answers per day — the engagement line. */
export function ActivityChart({ points }: { points: DayCount[] }) {
  const data = points.map((p) => ({
    // "08-11" — enough on an axis this small; the tooltip has the full day.
    label: p.day.slice(5),
    day: p.day,
    answers: p.count,
  }));

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={VIOLET} stopOpacity={0.25} />
              <stop offset="100%" stopColor={VIOLET} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#f1f2f5" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#8a8f9b" }}
            tickLine={false}
            axisLine={{ stroke: "#e3e4e9" }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#8a8f9b" }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ stroke: "#c0c4cc" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e3e4e9",
              fontSize: 12.5,
            }}
            labelFormatter={(label, payload) =>
              payload?.[0]?.payload?.day ?? label
            }
          />
          <Area
            type="monotone"
            dataKey="answers"
            stroke={VIOLET}
            strokeWidth={2}
            fill="url(#activityFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Share-of-answers pie for a single tally group (which_principle's option
 * split). The key's slice is violet, wrong-by-definition slices shade red,
 * anything neutral greys out. Zero-vote slices are dropped — an empty
 * wedge label is noise.
 */
export function SharePie({ group }: { group: TallyGroup }) {
  // One color per slice, computed once so the pie and its legend can never
  // disagree. `bad` renders softened — a full-saturation red wedge shouts
  // louder than a wrong answer deserves.
  let neutralIndex = 0;
  const slices = group.rows
    .filter((row) => row.votes > 0)
    .map((row) => ({
      ...row,
      color:
        row.tone === "ok"
          ? VIOLET
          : row.tone === "bad"
            ? "rgba(225, 29, 72, 0.55)"
            : NEUTRALS[neutralIndex++ % NEUTRALS.length],
    }));

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="h-[150px] w-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices.map((s) => ({ name: s.label, value: s.votes }))}
              dataKey="value"
              outerRadius={70}
              strokeWidth={2}
              stroke="#ffffff"
              isAnimationActive={false}
            >
              {slices.map((row) => (
                <Cell key={row.label} fill={row.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #e3e4e9",
                fontSize: 12.5,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex min-w-0 flex-col gap-1">
        {slices.map((row) => (
          <li key={row.label} className="flex items-center gap-2 text-[12.5px]">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ background: row.color }}
            />
            <span className="truncate text-ink-4">{row.label}</span>
            <span className="tabular-nums text-muted-3">{row.votes}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
