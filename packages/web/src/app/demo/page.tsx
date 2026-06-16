import type { Metadata } from "next";
import { PillLabel } from "@/components/ui/pill-label";
import { DemoClient } from "@/components/demo/demo-client";

export const metadata: Metadata = {
  title: "Live Demo — AgentPay",
  description:
    "Watch agents pay providers per call in USDC, settling over state channels in real time.",
};

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      <header className="max-w-2xl">
        <PillLabel icon="✦" label="LIVE DEMO" />
        <h1 className="mt-6 text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1]">
          Payments <span className="heading-serif">as they happen</span>
        </h1>
        <p className="mt-5 text-text-muted text-base md:text-lg leading-relaxed">
          Agents call providers and settle in USDC over state channels. Each
          pulse is a payment; each row is a settlement.
        </p>
      </header>

      <div className="mt-12">
        <DemoClient />
      </div>
    </div>
  );
}
