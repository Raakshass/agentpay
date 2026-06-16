import type { Metadata } from "next";
import { DemoFlow } from "@/components/demo/demo-flow";
import { DemoClient } from "@/components/demo/demo-client";

export const metadata: Metadata = {
  title: "Live Demo — AgentPay",
  description:
    "Watch one full state-channel payment end to end, then see it run at scale across many agents.",
};

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      <DemoFlow />

      {/* Part 2 (swarm "at scale") — to be reframed next. */}
      <div className="mt-24 md:mt-32 border-t border-border pt-16">
        <DemoClient />
      </div>
    </div>
  );
}
