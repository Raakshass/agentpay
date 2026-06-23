import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/coming-soon";

// NOTE: Catalog is temporarily disabled — it renders mock/placeholder data
// until the on-chain registry is populated. Restore the block below to re-enable.
// import { PillLabel } from "@/components/ui/pill-label";
// import { CatalogClient } from "@/components/catalog/catalog-client";

export const metadata: Metadata = {
  title: "Catalog — Conduit",
  description:
    "Browse every API, DePIN feed, and agent service registered on-chain. Pay per call in USDC.",
};

export default function CatalogPage() {
  return (
    <ComingSoon
      pill="CATALOG"
      title="provider catalog"
      description="Every API, DePIN feed, and agent service registered on-chain, browsable in one place. We're wiring this up to live registry data — check back soon."
    />
  );
}

/* --- Original catalog page (restore when registry has live data) ---
export default function CatalogPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      <header className="max-w-2xl">
        <PillLabel icon="✦" label="CATALOG" />
        <h1 className="mt-6 text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1]">
          Browse the <span className="heading-serif">provider catalog</span>
        </h1>
        <p className="mt-5 text-text-muted text-base md:text-lg leading-relaxed">
          Every API, DePIN feed, and agent service registered on-chain. Pay per
          call in USDC — no subscriptions, no accounts.
        </p>
      </header>

      <div className="mt-12">
        <CatalogClient />
      </div>
    </div>
  );
}
--- */
