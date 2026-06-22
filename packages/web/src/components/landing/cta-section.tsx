"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeInView, fadeInUp } from "@/components/ui/fade-in-view";
import { useMotionAllowed } from "@/hooks/use-reduced-motion";
import { EASE_OUT } from "@/lib/motion";

export function CtaSection() {
  const motionOk = useMotionAllowed();

  return (
    <section className="py-20 sm:py-32 bg-bg relative overflow-hidden" aria-label="Call to action">
      {/* Background glow — violet + cyan blooms */}
      <div className="absolute inset-0 pointer-events-none glow-bloom" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeInView stagger className="text-center">
          <motion.p
            variants={fadeInUp}
            className="text-sm tracking-[0.15em] uppercase text-text-muted mb-6"
          >
            Ready to integrate?
          </motion.p>

          <motion.h2
            variants={fadeInUp}
            className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.1]"
          >
            Let your agents{" "}
            <motion.span
              className="heading-serif text-accent"
              animate={
                motionOk
                  ? {
                      textShadow: [
                        "0 0 20px rgba(95,224,255,0)",
                        "0 0 20px rgba(95,224,255,0.3)",
                        "0 0 20px rgba(95,224,255,0)",
                      ],
                    }
                  : {}
              }
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: EASE_OUT,
              }}
            >
              pay for themselves
            </motion.span>
          </motion.h2>

          <motion.p
            variants={fadeInUp}
            className="mt-5 text-text-muted text-lg max-w-xl mx-auto"
          >
            10 lines of code. Deposit USDC, call APIs, settle on-chain.
          </motion.p>

          <motion.div
            variants={fadeInUp}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button href="/catalog" size="lg">
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button href="/demo" variant="outline" size="lg">
              Watch Live Demo
            </Button>
          </motion.div>
        </FadeInView>
      </div>
    </section>
  );
}
