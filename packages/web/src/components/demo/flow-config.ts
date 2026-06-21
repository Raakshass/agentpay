/**
 * Declarative configuration for the single-payment walkthrough (DemoFlow).
 *
 * Each track is an ordered list of steps; each step says which actors are
 * involved, what value/messages move between them, the explanatory caption, and
 * whether the step is on-chain (solid connector) or off-chain (dashed). The
 * component is a pure renderer of this data, so steps are easy to edit here.
 *
 * All amounts shown are illustrative.
 */

import { Bot, Cloud, Lock, Network, type LucideIcon } from "lucide-react";

export type ActorId = "agent" | "gateway" | "contract" | "provider";

/** Left-to-right actor order; also drives horizontal positioning. */
export const ACTOR_ORDER: ActorId[] = [
  "agent",
  "gateway",
  "contract",
  "provider",
];

/** Horizontal center of an actor column, as a percentage of the lane width. */
export function actorCenterPct(id: ActorId): number {
  const i = ACTOR_ORDER.indexOf(id);
  return (i + 0.5) * (100 / ACTOR_ORDER.length);
}

export interface ActorMeta {
  id: ActorId;
  label: string;
  sublabel: string;
  icon: LucideIcon;
}

export const ACTORS: ActorMeta[] = [
  { id: "agent", label: "AI Agent", sublabel: "Consumer", icon: Bot },
  {
    id: "gateway",
    label: "Conduit Gateway",
    sublabel: "Off-chain relay",
    icon: Network,
  },
  { id: "contract", label: "Smart Contract", sublabel: "Solana", icon: Lock },
  { id: "provider", label: "API Provider", sublabel: "Service", icon: Cloud },
];

/** Visual tone of a moving token. */
export type PulseTone = "value" | "iou" | "data";

export interface Pulse {
  from: ActorId;
  to: ActorId;
  /** Monospace label rendered on the token. */
  label: string;
  /** Start delay within the step, in seconds. */
  delay: number;
  tone: PulseTone;
}

/** A timed value for the running chip (e.g. the latest signed IOU). */
export interface ChipMark {
  /** When to show it, in seconds from step start. */
  at: number;
  text: string;
}

export interface FlowStep {
  id: string;
  kicker: string;
  title: string;
  caption: string;
  /** Solid connector + glowing tokens when true; dashed + dim when false. */
  onChain: boolean;
  /** Step length in ms (auto-advance interval). */
  duration: number;
  /** Actors that are brightened; everything else dims. */
  active: ActorId[];
  /** Per-actor status line shown under the actor label this step. */
  status?: Partial<Record<ActorId, string>>;
  pulses: Pulse[];
  /** Illustrative transaction signature (shown with a confirmed pill). */
  tx?: string;
  /** Label for the running chip (paired with `chips`). */
  chipLabel?: string;
  /** Timeline of chip values during the step. */
  chips?: ChipMark[];
}

export interface FlowTrack {
  id: string;
  label: string;
  steps: FlowStep[];
}

const TOKEN = 1.1; // default token travel duration (s)

const OPEN_STEP: FlowStep = {
  id: "open",
  kicker: "Step 1 · On-chain",
  title: "Open channel",
  caption:
    "The agent opens a state channel, locking USDC on-chain. One transaction.",
  onChain: true,
  duration: 3600,
  active: ["agent", "contract"],
  status: { contract: "🔒 10 USDC locked in escrow PDA" },
  tx: "5KJpq5y8nT5oQ…b3Wm9xQ2",
  pulses: [
    { from: "agent", to: "contract", label: "10 USDC", delay: 0.2, tone: "value" },
  ],
};

const USE_STEP: FlowStep = {
  id: "use",
  kicker: "Step 2 · Off-chain",
  title: "Use & sign IOUs",
  caption:
    "Each call, the agent signs a cumulative IOU off-chain. No transaction, no fees, instant. The gateway holds the latest IOU.",
  onChain: false,
  duration: 6800,
  active: ["agent", "gateway", "provider"],
  status: { gateway: "Holds latest IOU" },
  chipLabel: "Latest signed IOU",
  chips: [
    { at: 1.1, text: "$0.002" },
    { at: 3.0, text: "$0.005" },
    { at: 4.9, text: "$0.008" },
  ],
  pulses: [
    // cycle 1
    { from: "agent", to: "provider", label: "req + IOU $0.002", delay: 0.1, tone: "iou" },
    { from: "provider", to: "agent", label: "data", delay: 1.0, tone: "data" },
    // cycle 2
    { from: "agent", to: "provider", label: "req + IOU $0.005", delay: 2.0, tone: "iou" },
    { from: "provider", to: "agent", label: "data", delay: 2.9, tone: "data" },
    // cycle 3
    { from: "agent", to: "provider", label: "req + IOU $0.008", delay: 3.9, tone: "iou" },
    { from: "provider", to: "agent", label: "data", delay: 4.8, tone: "data" },
  ],
};

const SETTLE_STEP: FlowStep = {
  id: "settle",
  kicker: "Step 3 · On-chain",
  title: "Settle",
  caption:
    "The gateway submits only the final IOU. The contract verifies the agent's signature, pays the provider, and refunds the rest. One settlement for many calls.",
  onChain: true,
  duration: 4800,
  active: ["gateway", "contract", "provider", "agent"],
  status: { contract: "✓ Ed25519 signature valid — splitting funds" },
  tx: "2QnX7Lf3aV9p…cR1k8mD4",
  pulses: [
    { from: "gateway", to: "contract", label: "final IOU $0.008 + sig", delay: 0.2, tone: "iou" },
    { from: "contract", to: "provider", label: "$0.008", delay: 1.8, tone: "value" },
    { from: "contract", to: "agent", label: "refund $9.992", delay: 2.2, tone: "value" },
  ],
};

const CLAIM_STEP: FlowStep = {
  id: "claim",
  kicker: "Crash safety · On-chain",
  title: "Claim refund",
  caption:
    "If the gateway disappears, the agent reclaims the full deposit after a timeout. Funds are never stuck.",
  onChain: true,
  duration: 4400,
  active: ["agent", "contract"],
  status: { contract: "⏱ Timeout elapsed — full refund", gateway: "✕ never settled" },
  tx: "8Hw2Rt6yU0n…fE5q3bL7",
  pulses: [
    { from: "agent", to: "contract", label: "claim_refund()", delay: 0.2, tone: "iou" },
    { from: "contract", to: "agent", label: "10 USDC", delay: 1.6, tone: "value" },
  ],
};

export const TRACKS: FlowTrack[] = [
  { id: "happy", label: "Happy path", steps: [OPEN_STEP, USE_STEP, SETTLE_STEP] },
  { id: "crash", label: "Crash safety", steps: [OPEN_STEP, CLAIM_STEP] },
];

/** Default per-token travel duration (s), exported for the renderer. */
export const TOKEN_DURATION = TOKEN;
