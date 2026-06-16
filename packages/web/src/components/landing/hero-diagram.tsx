"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { EASE_OUT } from "@/lib/motion";

/**
 * Animated hero diagram showing an Agent paying an API via USDC.
 * A pulse travels from Agent → API, the API node glows on receipt, then loops.
 */
export function HeroDiagram() {
  const prefersReducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <HeroDiagramStatic />;
  }

  return (
    <div
      className="relative w-full max-w-lg mx-auto"
      role="img"
      aria-label="Diagram showing an AI agent sending a USDC micropayment to an API through AgentPay"
    >
      <svg
        viewBox="0 0 500 200"
        className="w-full h-auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Connection line */}
        <line
          x1="120"
          y1="100"
          x2="380"
          y2="100"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* Agent node */}
        <g>
          {/* Outer glow */}
          <circle
            cx="100"
            cy="100"
            r="45"
            fill="none"
            stroke="rgba(216,231,242,0.06)"
            strokeWidth="1"
          />
          {/* Inner circle */}
          <circle
            cx="100"
            cy="100"
            r="35"
            fill="rgba(12,13,18,0.9)"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />
          {/* Icon - robot/agent */}
          <text
            x="100"
            y="96"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize="20"
          >
            🤖
          </text>
          {/* Label */}
          <text
            x="100"
            y="158"
            textAnchor="middle"
            fill="#C2C4CC"
            fontSize="12"
            fontFamily="var(--font-sans)"
            fontWeight="500"
          >
            Agent
          </text>
        </g>

        {/* API node */}
        <g>
          {/* Outer glow ring - animated */}
          <motion.circle
            cx="400"
            cy="100"
            r="45"
            fill="none"
            stroke="rgba(216,231,242,0.06)"
            strokeWidth="1"
            animate={
              prefersReducedMotion
                ? {}
                : {
                    stroke: [
                      "rgba(216,231,242,0.06)",
                      "rgba(216,231,242,0.15)",
                      "rgba(216,231,242,0.06)",
                    ],
                  }
            }
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: EASE_OUT,
              delay: 1.5,
            }}
          />
          {/* Inner circle */}
          <motion.circle
            cx="400"
            cy="100"
            r="35"
            fill="rgba(12,13,18,0.9)"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
            animate={
              prefersReducedMotion
                ? {}
                : {
                    stroke: [
                      "rgba(255,255,255,0.1)",
                      "rgba(216,231,242,0.3)",
                      "rgba(255,255,255,0.1)",
                    ],
                  }
            }
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: EASE_OUT,
              delay: 1.5,
            }}
          />
          {/* Icon - API */}
          <text
            x="400"
            y="96"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize="20"
          >
            ⚡
          </text>
          {/* Label */}
          <text
            x="400"
            y="158"
            textAnchor="middle"
            fill="#C2C4CC"
            fontSize="12"
            fontFamily="var(--font-sans)"
            fontWeight="500"
          >
            API
          </text>
        </g>

        {/* USDC label on the line */}
        <g>
          <rect
            x="220"
            y="68"
            width="60"
            height="24"
            rx="12"
            fill="rgba(12,13,18,0.9)"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
          <text
            x="250"
            y="84"
            textAnchor="middle"
            fill="#D8E7F2"
            fontSize="10"
            fontFamily="var(--font-mono)"
            fontWeight="500"
          >
            USDC
          </text>
        </g>

        {/* Animated pulse */}
        {!prefersReducedMotion && (
          <motion.circle
            cx="120"
            cy="100"
            r="4"
            fill="#D8E7F2"
            animate={{
              cx: [120, 380],
              opacity: [0, 1, 1, 0],
              scale: [0.5, 1, 1, 0.5],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: EASE_OUT,
              times: [0, 0.1, 0.85, 1],
            }}
          />
        )}

        {/* Pulse glow trail */}
        {!prefersReducedMotion && (
          <motion.circle
            cx="120"
            cy="100"
            r="8"
            fill="none"
            stroke="rgba(216,231,242,0.2)"
            strokeWidth="1"
            animate={{
              cx: [120, 380],
              opacity: [0, 0.5, 0.5, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: EASE_OUT,
              times: [0, 0.1, 0.85, 1],
            }}
          />
        )}
      </svg>
    </div>
  );
}

/** Static fallback for SSR / reduced motion */
function HeroDiagramStatic() {
  return (
    <div className="relative w-full max-w-lg mx-auto">
      <svg viewBox="0 0 500 200" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
        <line x1="120" y1="100" x2="380" y2="100" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 4" />
        <circle cx="100" cy="100" r="45" fill="none" stroke="rgba(216,231,242,0.06)" strokeWidth="1" />
        <circle cx="100" cy="100" r="35" fill="rgba(12,13,18,0.9)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <text x="100" y="96" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="20">🤖</text>
        <text x="100" y="158" textAnchor="middle" fill="#C2C4CC" fontSize="12">Agent</text>
        <circle cx="400" cy="100" r="45" fill="none" stroke="rgba(216,231,242,0.06)" strokeWidth="1" />
        <circle cx="400" cy="100" r="35" fill="rgba(12,13,18,0.9)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <text x="400" y="96" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="20">⚡</text>
        <text x="400" y="158" textAnchor="middle" fill="#C2C4CC" fontSize="12">API</text>
        <rect x="220" y="68" width="60" height="24" rx="12" fill="rgba(12,13,18,0.9)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <text x="250" y="84" textAnchor="middle" fill="#D8E7F2" fontSize="10">USDC</text>
      </svg>
    </div>
  );
}
