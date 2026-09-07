import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { AskChat } from "@/components/ask-chat";
import { BundledDataBanner } from "@/components/bundled-data-banner";
import { chatEnabled } from "@/lib/ai/chat";
import { usingBundledData } from "@/lib/data";
import meta from "@/lib/dataset-meta.generated.json";

export const metadata: Metadata = {
  title: "Ask",
  description:
    "Ask what's going on in Pleasanton and the Tri-Valley on any day, at any venue, for any kind of event.",
};

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const aiEnabled = chatEnabled();

  return (
    <div>
      {usingBundledData() && <BundledDataBanner />}
      <div className="container-page py-10 sm:py-14">
        <div className="mx-auto max-w-3xl">
          <div className="animate-fade-up">
            <p className="eyebrow flex items-center gap-1.5 text-brand-600">
              <Sparkles aria-hidden className="h-4 w-4" strokeWidth={2.25} />
              Ask the calendar
            </p>
            <h1 className="display mt-3 text-[2.25rem] text-ink sm:text-[3rem]">
              What&apos;s going on?
            </h1>
            <p className="mt-4 max-w-xl leading-relaxed text-ink-muted">
              Ask about a day, a weekend, a venue, or a kind of event. Answers
              come from{" "}
              <span className="tabular font-semibold text-ink-soft">
                {meta.events.toLocaleString("en-US")}
              </span>{" "}
              listings gathered from {meta.sources} local sources.
            </p>
          </div>

          <div className="mt-8">
            <AskChat aiEnabled={aiEnabled} initialQuestion={q?.trim().slice(0, 500) || undefined} />
          </div>
        </div>
      </div>
    </div>
  );
}
