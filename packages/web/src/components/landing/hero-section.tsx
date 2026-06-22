"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PillLabel } from "@/components/ui/pill-label";
import { PortalScene } from "./portal-scene";
import { EASE_OUT, DURATION, STAGGER } from "@/lib/motion";

const headingWords = [
  { text: "The", serif: false },
  { text: "payment", serif: false },
  { text: "layer", serif: false },
  { text: "for", serif: false },
];

const serifPhrase = "autonomous agents";

export function HeroSection() {
  const prefersReducedMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : STAGGER.normal,
        delayChildren: 0.2,
      },
    },
  };

  const wordVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: DURATION.normal, ease: EASE_OUT },
    },
  };

  const serifVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: DURATION.slow, ease: EASE_OUT },
    },
  };

  const fadeInVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: DURATION.normal, ease: EASE_OUT },
    },
  };

  return (
    <section
      className="relative min-h-[70vh] sm:min-h-[80vh] md:min-h-[90vh] flex items-center justify-center overflow-hidden"
      aria-label="Hero"
    >
      {/* Background radial glow — violet + cyan blooms */}
      <div className="absolute inset-0 pointer-events-none glow-bloom" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <motion.div
          variants={containerVariants}
          initial={prefersReducedMotion ? "visible" : "hidden"}
          animate="visible"
          className="text-center"
        >
          {/* Pill label */}
          <motion.div variants={wordVariants} className="mb-8 flex justify-center">
            <PillLabel icon="✦" label="PAYMENT PROTOCOL" />
          </motion.div>

          {/* Main heading with staggered word animation */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.08]">
            {headingWords.map((word, i) => (
              <motion.span
                key={i}
                variants={wordVariants}
                className="inline-block mr-[0.3em]"
              >
                {word.text}
              </motion.span>
            ))}
            <br className="hidden sm:block" />
            <motion.span
              variants={serifVariants}
              className="inline-block heading-serif text-gradient"
            >
              {serifPhrase}
            </motion.span>
          </h1>

          {/* Subtitle */}
          <motion.p
            variants={fadeInVariants}
            className="mt-6 text-text-muted text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
          >
            Permissionless state channel micropayments on Solana. AI agents pay for
            APIs, DePIN data, and other agents&apos; services in USDC —
            no subscriptions, no credit cards.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            variants={fadeInVariants}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button href="/catalog" size="lg">
              Browse the Catalog
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button href="/docs" variant="ghost" size="lg">
              <BookOpen className="w-4 h-4" />
              Read the Docs
            </Button>
          </motion.div>

          {/* Hero portal scene */}
          <motion.div
            variants={fadeInVariants}
            className="mt-12 flex justify-center"
          >
            <PortalScene />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
