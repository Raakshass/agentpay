import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/coming-soon";

// NOTE: Provider dashboard is temporarily disabled — it renders mock/placeholder
// data until on-chain registration is live. Restore the block below to re-enable.
// import { PillLabel } from "@/components/ui/pill-label";
// import { DashboardClient } from "@/components/providers/dashboard-client";

export const metadata: Metadata = {
  title: "Provider Dashboard — Conduit",
  description:
    "Register your API or DePIN service on-chain, set its price, and manage your listings.",
};

export default function ProvidersPage() {
  return (
    <ComingSoon
      pill="PROVIDERS"
      title="provider dashboard"
      description="List a service, set a per-call price in USDC, and start earning — every change a signed on-chain transaction you control. The dashboard is almost ready."
    />
  );
}

/* --- Original provider dashboard (restore when on-chain registration is live) ---
export default function ProvidersPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      <header className="max-w-2xl">
        <PillLabel icon="✦" label="PROVIDERS" />
        <h1 className="mt-6 text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1]">
          Your <span className="heading-serif">provider dashboard</span>
        </h1>
        <p className="mt-5 text-text-muted text-base md:text-lg leading-relaxed">
          List a service, set a per-call price in USDC, and start earning. Every
          change is a signed on-chain transaction you control.
        </p>
      </header>

      <div className="mt-12">
        <DashboardClient />
      </div>
    </div>
  );
}
--- */
