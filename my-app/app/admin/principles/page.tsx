import { PageHeader, PrimaryButton } from "@/components/admin/ui";
import { principleUsage, principles } from "@/lib/admin/fixtures";

export default function PrinciplesPage() {
  const incomplete = principles.filter((p) => !p.name || !p.descriptor);

  return (
    <>
      <PageHeader
        title="Principles"
        meta={`${principles.length} codes · ${incomplete.length} need writing`}
        actions={<PrimaryButton>New principle</PrimaryButton>}
      />

      <div className="flex flex-col gap-4 p-6">
        {incomplete.length > 0 && (
          <p className="max-w-[70ch] rounded-[10px] border border-line bg-surface px-4 py-3 text-[13px] leading-[1.6] text-muted">
            <span className="font-medium text-ink-3">
              {incomplete.map((p) => p.code).join(", ")}
            </span>{" "}
            {incomplete.length === 1 ? "has" : "have"} no name or descriptor.
            They appear as chips on the T3 example but nothing in the design
            defines them. A <span className="font-mono text-[12px]">
              which_principle
            </span>{" "}
            question can&rsquo;t be authored against a code that has no text.
          </p>
        )}

        <div className="flex flex-col gap-2.5">
          {principles.map((p) => {
            const used = principleUsage(p.code);
            const blank = !p.name || !p.descriptor;
            return (
              <div
                key={p.code}
                className={`flex gap-4 rounded-[10px] border p-4 ${
                  blank ? "border-dashed border-line-4 bg-surface" : "border-line bg-white"
                }`}
              >
                <span className="w-8 shrink-0 pt-0.5 font-mono text-[12px] text-violet-ink">
                  {p.code}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span
                    className={`text-[14px] font-semibold tracking-[-0.01em] ${
                      p.name ? "text-ink" : "text-faint italic"
                    }`}
                  >
                    {p.name || "Untitled — needs a name"}
                  </span>
                  {p.descriptor ? (
                    <span className="text-[13px] leading-[1.55] text-muted">
                      {p.descriptor}
                    </span>
                  ) : (
                    <span className="text-[13px] text-faint italic">
                      No descriptor
                    </span>
                  )}
                  {p.description && (
                    <span className="text-[12.5px] leading-[1.6] text-muted-3">
                      {p.description}
                    </span>
                  )}
                </div>
                <span className="shrink-0 self-start text-[12.5px] whitespace-nowrap text-muted-3">
                  {used} question{used === 1 ? "" : "s"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
