import type { Metadata } from "next";
import { PillLabel } from "@/components/ui/pill-label";
import { FadeInView } from "@/components/ui/fade-in-view";
import { ServicesClient } from "@/components/services/services-client";

export const metadata: Metadata = {
  title: "Catalog — Conduit",
  description:
    "Browse every live API, DePIN feed, and market-data service on the Conduit gateway. Pay per call in USDC — try each one free before you pay.",
};

export default function CatalogPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      <FadeInView as="section" className="max-w-2xl" margin="0px">
        <PillLabel icon="✦" label="CATALOG" />
        <h1 className="mt-6 text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1]">
          Live <span className="heading-serif">service catalog</span>
        </h1>
        <p className="mt-5 text-text-muted text-base md:text-lg leading-relaxed">
          Every API the gateway is proxying right now — real data, real prices.
          Pay per call in USDC, no subscriptions. Try any service free below
          before you open a session.
        </p>
      </FadeInView>

      <div className="mt-12">
        <ServicesClient />
      </div>
    </div>
  );
}
