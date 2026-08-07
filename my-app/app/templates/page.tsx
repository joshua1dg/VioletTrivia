import { TemplateDemo } from "./demos";

function Section({
  tag,
  title,
  blurb,
  children,
}: {
  tag: string;
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline gap-3.5">
        <span className="font-mono text-[12px] text-violet">{tag}</span>
        <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-ink-2">
          {title}
        </h2>
        <span className="text-[13px] text-muted-3">{blurb}</span>
      </div>
      {children}
    </section>
  );
}

export default function TemplatesPage() {
  return (
    <main className="mx-auto flex max-w-[1600px] flex-col gap-14 px-6 py-12 lg:px-14">
      <header className="flex flex-col gap-2 border-b border-line pb-6">
        <span className="font-mono text-[12px] text-violet">Project Violet</span>
        <h1 className="text-[32px] font-semibold tracking-[-0.025em] text-ink">
          Question templates
        </h1>
        <p className="max-w-[66ch] text-[14px] leading-[1.65] text-muted-2">
          Both frames are live and independent — pick an option and submit to
          see the answer state. Layout switches on the <em>card&rsquo;s</em>{" "}
          width rather than the window&rsquo;s, so the phone frame renders its
          real mobile layout while sitting on a desktop screen.
        </p>
      </header>

      <Section
        tag="T1"
        title="Principles, side by side"
        blurb="Two codes in play, one excerpt — which one does it actually fail?"
      >
        <TemplateDemo kind="which_principle" />
      </Section>

      <Section
        tag="T3"
        title="Practice writing feedback"
        blurb="A fellow's rationale and its rubric calls — pick the response that helps most."
      >
        <TemplateDemo kind="best_feedback" />
      </Section>

      <section className="flex flex-col gap-2 rounded-[12px] border border-dashed border-line-4 bg-white/60 p-6">
        <div className="flex flex-wrap items-baseline gap-3.5">
          <span className="font-mono text-[12px] text-faint">T2</span>
          <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-muted">
            Language breakdown — rank the completions
          </h2>
        </div>
        <p className="max-w-[66ch] text-[13.5px] leading-[1.6] text-muted-3">
          Not built yet. Ranking needs pointer-based drag so one code path
          covers mouse, touch and keyboard — HTML5 drag events don&rsquo;t fire
          on touch at all. That means adding dnd-kit before this one.
        </p>
      </section>
    </main>
  );
}
