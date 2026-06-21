"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  DEMO_AGENTS,
  DEMO_PROVIDERS,
  type DemoEvent,
} from "@/hooks/use-demo-events";
import { EASE_OUT } from "@/lib/motion";

const W = 600;
const H = 380;
const AGENT_X = 70;
const PROVIDER_X = 530;

function column(count: number): number[] {
  return Array.from({ length: count }, (_, i) => ((i + 1) * H) / (count + 1));
}

const AGENT_Y = column(DEMO_AGENTS.length);
const PROVIDER_Y = column(DEMO_PROVIDERS.length);

interface NetworkGraphProps {
  latest: DemoEvent | null;
}

export function NetworkGraph({ latest }: NetworkGraphProps) {
  const prefersReducedMotion = useReducedMotion();
  const [hitProvider, setHitProvider] = useState<number | null>(null);

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="Agents paying providers over the network"
      >
        <defs>
          <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Faint edges between every agent and provider */}
        {AGENT_Y.map((ay, ai) =>
          PROVIDER_Y.map((py, pi) => (
            <line
              key={`${ai}-${pi}`}
              x1={AGENT_X}
              y1={ay}
              x2={PROVIDER_X}
              y2={py}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={1}
            />
          )),
        )}

        {/* Animated payment pulse — one in flight for the latest event. Driven
            straight off the prop via AnimatePresence (keyed by event id) so no
            effect/state sync is needed. */}
        <AnimatePresence>
          {latest && !prefersReducedMotion && (
            <motion.circle
              key={latest.id}
              r={4}
              fill="#D8E7F2"
              filter="url(#node-glow)"
              initial={{
                cx: AGENT_X,
                cy: AGENT_Y[latest.agent],
                opacity: 0,
              }}
              animate={{
                cx: PROVIDER_X,
                cy: PROVIDER_Y[latest.provider],
                opacity: [0, 1, 1, 0],
              }}
              transition={{ duration: 1.4, ease: EASE_OUT }}
              onAnimationStart={() => {
                // Light up the destination shortly before arrival.
                setTimeout(() => setHitProvider(latest.provider), 1100);
              }}
              onAnimationComplete={() => {
                setHitProvider((cur) =>
                  cur === latest.provider ? null : cur,
                );
              }}
            />
          )}
        </AnimatePresence>

        {/* Agent nodes */}
        {AGENT_Y.map((ay, ai) => (
          <g key={`agent-${ai}`}>
            <circle
              cx={AGENT_X}
              cy={ay}
              r={6}
              fill="#0C0D12"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={1.5}
            />
            <text
              x={AGENT_X - 16}
              y={ay + 4}
              textAnchor="end"
              className="fill-text-muted"
              style={{ fontSize: 12 }}
            >
              {DEMO_AGENTS[ai]}
            </text>
          </g>
        ))}

        {/* Provider nodes */}
        {PROVIDER_Y.map((py, pi) => (
          <g key={`provider-${pi}`}>
            <circle
              cx={PROVIDER_X}
              cy={py}
              r={hitProvider === pi ? 9 : 6}
              fill={hitProvider === pi ? "#D8E7F2" : "#0C0D12"}
              stroke="rgba(216,231,242,0.5)"
              strokeWidth={1.5}
              filter={hitProvider === pi ? "url(#node-glow)" : undefined}
              style={{ transition: "r 0.2s ease, fill 0.2s ease" }}
            />
            <text
              x={PROVIDER_X + 16}
              y={py + 4}
              textAnchor="start"
              className="fill-text-muted"
              style={{ fontSize: 12 }}
            >
              {DEMO_PROVIDERS[pi]}
            </text>
          </g>
        ))}

        {/* Column captions */}
        <text
          x={AGENT_X}
          y={24}
          textAnchor="middle"
          className="fill-text-dim"
          style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}
        >
          AGENTS
        </text>
        <text
          x={PROVIDER_X}
          y={24}
          textAnchor="middle"
          className="fill-text-dim"
          style={{ fontSize: 10, letterSpacing: 2 }}
        >
          PROVIDERS
        </text>
      </svg>
    </div>
  );
}
