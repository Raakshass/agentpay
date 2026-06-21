"use client";

import { motion, useReducedMotion } from "framer-motion";
import { StatCounter } from "@/components/ui/stat-counter";
import { fadeInUp, staggerContainer } from "@/lib/motion";

/**
 * MOCK DATA: These values are placeholders.
 * Replace with real on-chain reads via getProviders() / getProgramAccounts()
 * once the registry program is deployed to devnet.
 *
 * Mock data locations:
 * - totalProviders: number of registered providers in the registry
 * - totalCallsSettled: sum of total_calls across all providers
 * - usdcVolume: total USDC settled (would need aggregation from escrow events)
 */
const MOCK_STATS = {
  totalProviders: 24,
  totalCallsSettled: 18_420,
  usdcVolume: 4_280,
};

export function StatsSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="py-20 bg-bg border-y border-border" aria-label="Live statistics">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={staggerContainer}
          initial={prefersReducedMotion ? "visible" : "hidden"}
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-12"
        >
          <motion.div variants={fadeInUp}>
            <StatCounter
              target={MOCK_STATS.totalProviders}
              label="Providers"
              suffix="+"
            />
          </motion.div>
          <motion.div variants={fadeInUp}>
            <StatCounter
              target={MOCK_STATS.totalCallsSettled}
              label="Calls Settled"
            />
          </motion.div>
          <motion.div variants={fadeInUp}>
            <StatCounter
              target={MOCK_STATS.usdcVolume}
              label="USDC Volume"
              prefix="$"
            />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
