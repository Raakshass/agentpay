import type { Metadata } from "next";
import { PillLabel } from "@/components/ui/pill-label";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, Code2, Terminal, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "Documentation — Conduit",
  description:
    "Learn how to integrate Conduit into your AI agents. SDK quickstart, API reference, and protocol documentation.",
};

const sections = [
  {
    icon: Terminal,
    title: "Quickstart",
    description:
      "Install the SDK, open a state channel, and make your first paid API call — all in under 10 lines of TypeScript.",
    code: `npm install conduit-pay`,
  },
  {
    icon: Code2,
    title: "SDK Reference",
    description:
      "Full API documentation for the conduit-pay package: ConduitSession, channel management, IOU signing, and settlement.",
    code: `import { ConduitSession } from "conduit-pay";

const session = new ConduitSession({
  gatewayUrl: "http://localhost:4020",
  agentKeypair,
  providerAddress,
  depositLamports: 10_000_000,   // 10 USDC
});

await session.open();
const result = await session.call({ input: "..." });
await session.close();`,
  },
  {
    icon: Zap,
    title: "Protocol Overview",
    description:
      "How state channels work under the hood: deposit → off-chain IOUs → single on-chain settlement. Crash safety, timeout claims, and the escrow contract.",
    code: null,
  },
];

const protocolSteps = [
  {
    step: "1",
    title: "Deposit",
    desc: "Agent locks USDC into an escrow PDA on Solana. One on-chain transaction creates the state channel.",
  },
  {
    step: "2",
    title: "Use & Sign IOUs",
    desc: "Each API call, the agent signs a cumulative IOU off-chain. The gateway verifies and forwards. No gas fees.",
  },
  {
    step: "3",
    title: "Settle",
    desc: "Gateway submits the final IOU. The contract verifies the signature, pays the provider, and refunds the rest.",
  },
  {
    step: "4",
    title: "Crash Safety",
    desc: "If the gateway disappears, the agent reclaims the full deposit after a timeout. Funds are never stuck.",
  },
];

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      <header className="max-w-2xl">
        <PillLabel icon="✦" label="DOCUMENTATION" />
        <h1 className="mt-6 text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1]">
          Build with <span className="heading-serif">Conduit</span>
        </h1>
        <p className="mt-5 text-text-muted text-base md:text-lg leading-relaxed">
          Everything you need to integrate permissionless micropayments into your
          AI agents. From zero to your first paid API call in minutes.
        </p>
      </header>

      {/* Quickstart + SDK */}
      <div className="mt-16 space-y-12">
        {sections.map((section) => (
          <section
            key={section.title}
            className="rounded-xl border border-border bg-bg-card p-6 sm:p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg border border-border bg-white/5 flex items-center justify-center">
                <section.icon className="w-5 h-5 text-accent" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight">
                {section.title}
              </h2>
            </div>
            <p className="text-text-muted text-sm leading-relaxed mb-4">
              {section.description}
            </p>
            {section.code && (
              <pre className="rounded-lg bg-bg border border-border p-4 overflow-x-auto">
                <code className="font-mono text-xs sm:text-sm text-text-muted whitespace-pre">
                  {section.code}
                </code>
              </pre>
            )}
          </section>
        ))}
      </div>

      {/* Protocol overview visual */}
      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight mb-8">
          How the protocol works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {protocolSteps.map((s) => (
            <div
              key={s.step}
              className="rounded-xl border border-border bg-bg-card p-5"
            >
              <span className="block font-mono text-2xl font-bold text-white/10 mb-2">
                {s.step}
              </span>
              <h3 className="text-lg font-semibold text-text-primary mb-1">
                {s.title}
              </h3>
              <p className="text-sm text-text-muted leading-relaxed">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="mt-16 text-center">
        <p className="text-text-muted text-sm mb-6">
          Ready to get started?
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button href="/catalog" size="lg">
            Browse the Catalog
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button href="/demo" variant="outline" size="lg">
            <BookOpen className="w-4 h-4" />
            Watch Live Demo
          </Button>
        </div>
      </div>
    </div>
  );
}
