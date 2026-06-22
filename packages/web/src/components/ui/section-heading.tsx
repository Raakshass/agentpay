"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { useMotionAllowed } from "@/hooks/use-reduced-motion";
import { fadeInUp, staggerContainer, emphasisDelay } from "@/lib/motion";

interface SectionHeadingProps {
  /** Text before the emphasis word */
  before: string;
  /** The emphasized word/phrase (rendered in italic serif) */
  emphasis: string;
  /** Text after the emphasis word (optional) */
  after?: string;
  /** Subtitle text below the heading */
  subtitle?: string;
  /** Optional pill label above heading */
  pill?: ReactNode;
  className?: string;
  /** Heading level (default h2) */
  as?: "h1" | "h2" | "h3";
}

export function SectionHeading({
  before,
  emphasis,
  after,
  subtitle,
  pill,
  className = "",
  as: Tag = "h2",
}: SectionHeadingProps) {
  const motionOk = useMotionAllowed();

  return (
    <motion.div
      variants={staggerContainer}
      initial={motionOk ? "hidden" : "visible"}
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      className={["text-center", className].join(" ")}
    >
      {pill && (
        <motion.div variants={fadeInUp} className="mb-6 flex justify-center">
          {pill}
        </motion.div>
      )}

      <motion.div variants={fadeInUp}>
        <Tag className={[
          Tag === "h1" ? "text-4xl md:text-6xl lg:text-7xl" : "text-3xl md:text-5xl",
          "font-semibold tracking-tight leading-[1.1]",
        ].join(" ")}>
          {before}
          {before && " "}
          {/* Emphasis word arrives a beat later via emphasisDelay */}
          <motion.span
            variants={emphasisDelay}
            className="heading-serif inline-block"
          >
            {emphasis}
          </motion.span>
          {after && ` ${after}`}
        </Tag>
      </motion.div>

      {subtitle && (
        <motion.p
          variants={fadeInUp}
          className="mt-5 text-text-muted text-base md:text-lg max-w-2xl mx-auto leading-relaxed"
        >
          {subtitle}
        </motion.p>
      )}
    </motion.div>
  );
}
