import type { Metadata } from "next";
import { DemoFlow } from "@/components/demo/demo-flow";
import { DemoClient } from "@/components/demo/demo-client";
import { PillLabel } from "@/components/ui/pill-label";

export const metadata: Metadata = {
  title: "Live Demo — AgentPay",
  description:
    "Watch one full state-channel payment end to end, then see it run at scale across many agents.",
};

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      <DemoFlow />

      {/* Part 2 — the same lifecycle, running across the whole network. */}
      <section
        aria-label="AgentPay at scale"
        className="mt-24 md:mt-32 border-t border-border pt-16"
      >
        <PillLabel icon="✦" label="AT SCALE" />
        <h2 className="mt-6 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.1]">
          Now multiply that by{" "}
          <span className="heading-serif">every agent</span>
        </h2>
        <p className="mt-4 max-w-2xl text-text-muted text-base md:text-lg leading-relaxed">
          The same open-use-settle lifecycle, running in parallel across the
          network — every pulse is a payment, every row a settlement.
        </p>

        <div className="mt-10">
          <DemoClient />
        </div>
      </section>
    </div>
  );
}
