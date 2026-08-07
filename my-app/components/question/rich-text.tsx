import type { ReactNode } from "react";

/**
 * The smallest markdown that turn bodies actually need: bullet lines starting
 * with "- ", and `backticks` for code. T3's assistant turns are a sentence,
 * a bulleted list, then another sentence — this covers that without asking a
 * content author to write nested JSON.
 */

function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith("`") && part.endsWith("`") && part.length > 1 ? (
      <code key={i} className="font-mono text-[0.9em] text-ink-3">
        {part.slice(1, -1)}
      </code>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function RichText({ body }: { body: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="flex flex-col gap-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="select-none">
              •
            </span>
            <span>{inline(b)}</span>
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ")) {
      bullets.push(trimmed.slice(2));
      continue;
    }
    flushBullets();
    if (trimmed) blocks.push(<p key={`p-${blocks.length}`}>{inline(trimmed)}</p>);
  }
  flushBullets();

  return <div className="flex flex-col gap-2">{blocks}</div>;
}
