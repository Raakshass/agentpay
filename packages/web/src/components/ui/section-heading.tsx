"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/lib/motion";

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
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      variants={staggerContainer}
      initial={prefersReducedMotion ? "visible" : "hidden"}
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
          <span className="heading-serif">{emphasis}</span>
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
