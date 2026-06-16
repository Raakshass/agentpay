"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { SectionHeading } from "@/components/ui/section-heading";
import { PillLabel } from "@/components/ui/pill-label";
import { EASE_OUT, DURATION } from "@/lib/motion";

const steps = [
  {
    number: "01",
    label: "STEP 1",
    title: "Deposit",
    description:
      "The agent locks USDC into a PDA-owned vault on Solana. This creates a state channel with the gateway — funds are secured on-chain but usage tracking happens off-chain for speed.",
  },
  {
    number: "02",
    label: "STEP 2",
    title: "Use & Sign IOUs",
    description:
      "For each API call, the agent signs a cumulative IOU off-chain. The gateway verifies the signature and forwards the request to the upstream API. No on-chain transactions per call — just cryptographic proofs.",
  },
  {
    number: "03",
    label: "STEP 3",
    title: "Settle",
    description:
      "When the session ends, the gateway submits the final IOU to the escrow contract. The contract verifies the agent's signature, pays the provider, and refunds unused deposit — all in one atomic transaction.",
  },
  {
    number: "04",
    label: "STEP 4",
    title: "Refund",
    description:
      "If the gateway goes offline or never settles, the agent can reclaim the full deposit after the timeout. Funds are never stuck — crash safety is built into the protocol.",
  },
];

export function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  // Auto-advance every 4 seconds
  const advanceStep = useCallback(() => {
    setActiveStep((prev) => (prev + 1) % steps.length);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const interval = setInterval(advanceStep, 4000);
    return () => clearInterval(interval);
  }, [advanceStep, prefersReducedMotion]);

  const currentStep = steps[activeStep];
  if (!currentStep) return null;

  return (
    <section className="py-24 bg-bg" aria-label="How it works">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          pill={<PillLabel icon="▣" label="HOW IT WORKS" />}
          before="Settle micropayments"
          emphasis="in milliseconds"
          subtitle="A four-step state channel flow that keeps funds secure on-chain while achieving sub-second API calls off-chain."
        />

        <div className="mt-16 max-w-3xl mx-auto">
          {/* Step tabs */}
          <div className="flex rounded-xl bg-bg-card border border-border overflow-hidden">
            {steps.map((step, i) => (
              <button
                key={i}
                onClick={() => setActiveStep(i)}
                className={[
                  "flex-1 py-3 px-4 text-xs font-medium tracking-wider uppercase text-center transition-all duration-300",
                  i === activeStep
                    ? "bg-white/5 text-text-primary border-b-2 border-accent"
                    : "text-text-dim hover:text-text-muted",
                ].join(" ")}
                aria-label={`Step ${i + 1}: ${step.title}`}
                aria-selected={i === activeStep}
                role="tab"
              >
                {step.label}
              </button>
            ))}
          </div>

          {/* Progress bar */}
          <div className="h-px bg-border relative mt-0">
            <motion.div
              className="absolute top-0 left-0 h-full bg-accent/30"
              animate={{
                width: `${((activeStep + 1) / steps.length) * 100}%`,
              }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
            />
          </div>

          {/* Step content */}
          <div className="mt-10 min-h-[160px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={
                  prefersReducedMotion
                    ? { opacity: 1 }
                    : { opacity: 0, x: 10 }
                }
                animate={{ opacity: 1, x: 0 }}
                exit={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: -10 }
                }
                transition={{ duration: 0.3, ease: EASE_OUT }}
              >
                <span className="block text-5xl font-bold text-white/10 font-mono mb-4">
                  {currentStep.number}
                </span>
                <h3 className="text-2xl font-semibold text-text-primary mb-3">
                  {currentStep.title}
                </h3>
                <p className="text-text-muted leading-relaxed max-w-xl">
                  {currentStep.description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
