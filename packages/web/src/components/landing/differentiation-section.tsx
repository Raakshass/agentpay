"use client";

import { Globe, Shield, Zap } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";
import { PillLabel } from "@/components/ui/pill-label";
import { FadeInView, fadeInUp } from "@/components/ui/fade-in-view";
import { motion } from "framer-motion";

const differentiators = [
  {
    icon: Globe,
    title: "Permissionless & open",
    description:
      "Any developer can list an API. Any agent can pay for it. No gatekeepers, no approval processes, no platform lock-in.",
  },
  {
    icon: Zap,
    title: "Agent-to-agent native",
    description:
      "Built for autonomous software paying autonomous software. State channels settle in one transaction — not one per API call.",
  },
  {
    icon: Shield,
    title: "DePIN-ready",
    description:
      "Designed for decentralized physical infrastructure networks. Weather sensors, network probes, and compute nodes all have a payment rail.",
  },
];

export function DifferentiationSection() {
  return (
    <section className="py-16 sm:py-24 bg-bg-lifted" aria-label="Differentiation">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          pill={<PillLabel icon="◈" label="WHY CONDUIT" />}
          before="Built for the"
          emphasis="agentic economy"
          subtitle="An open, permissionless payment layer purpose-built for autonomous agent-to-agent and agent-to-DePIN commerce."
        />

        <FadeInView stagger className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          {differentiators.map((item) => (
            <motion.div key={item.title} variants={fadeInUp}>
              <div className="group text-center p-8">
                <div className="w-14 h-14 rounded-2xl bg-accent-glow border border-border flex items-center justify-center mx-auto mb-6 transition-all duration-300 ease-out group-hover:scale-110 group-hover:border-accent/40 group-hover:shadow-[0_0_24px_-6px_rgba(166,107,255,0.35)]">
                  <item.icon className="w-6 h-6 text-accent transition-transform duration-300 ease-out group-hover:-rotate-6" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-3">
                  {item.title}
                </h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  {item.description}
                </p>
              </div>
            </motion.div>
          ))}
        </FadeInView>
      </div>
    </section>
  );
}
