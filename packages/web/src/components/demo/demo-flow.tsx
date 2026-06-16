"use client";

import { useEffect, useState } from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";
import {
  Check,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { PillLabel } from "@/components/ui/pill-label";
import { EASE_OUT } from "@/lib/motion";
import {
  ACTORS,
  TRACKS,
  TOKEN_DURATION,
  actorCenterPct,
  type ActorId,
  type FlowStep,
  type Pulse,
} from "./flow-config";

/* ------------------------------- Actor cards ------------------------------ */

function ActorCard({
  id,
  active,
  status,
}: {
  id: ActorId;
  active: boolean;
  status?: string;
}) {
  const meta = ACTORS.find((a) => a.id === id)!;
  const Icon = meta.icon;
  return (
    <motion.div
      animate={{ opacity: active ? 1 : 0.35 }}
      transition={{ duration: 0.4, ease: EASE_OUT }}
      className={[
        "rounded-xl border bg-bg-card px-3 py-4 text-center",
        active ? "border-border-hover" : "border-border",
      ].join(" ")}
      style={
        active
          ? { boxShadow: "0 0 40px -12px rgba(216,231,242,0.25)" }
          : undefined
      }
    >
      <div
        className={[
          "mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg border",
          active
            ? "border-accent/30 bg-accent-glow text-accent"
            : "border-border text-text-dim",
        ].join(" ")}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-sm font-medium text-text-primary leading-tight">
        {meta.label}
      </div>
      <div className="text-[11px] text-text-dim">{meta.sublabel}</div>

      <AnimatePresence mode="wait">
        {status && (
          <motion.div
            key={status}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="mt-2 font-mono text-[11px] leading-snug text-text-muted"
          >
            {status}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* --------------------------------- Tokens --------------------------------- */

const toneClass: Record<Pulse["tone"], string> = {
  value:
    "border-accent/40 bg-accent-glow-strong text-accent shadow-[0_0_20px_-4px_rgba(216,231,242,0.6)]",
  iou: "border-dashed border-border bg-bg-card text-text-muted",
  data: "border-border bg-white/5 text-text-dim",
};

function FlowToken({ pulse }: { pulse: Pulse }) {
  const fromX = actorCenterPct(pulse.from);
  const toX = actorCenterPct(pulse.to);
  return (
    <motion.div
      className="absolute top-1/2 z-20"
      style={{ translateX: "-50%", translateY: "-50%" }}
      initial={{ left: `${fromX}%`, opacity: 0, scale: 0.8 }}
      animate={{ left: `${toX}%`, opacity: [0, 1, 1, 0], scale: [0.8, 1, 1, 0.85] }}
      transition={{
        duration: TOKEN_DURATION,
        ease: EASE_OUT,
        delay: pulse.delay,
        times: [0, 0.18, 0.82, 1],
      }}
    >
      <span
        className={[
          "whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[11px]",
          toneClass[pulse.tone],
        ].join(" ")}
      >
        {pulse.label}
      </span>
    </motion.div>
  );
}

/* ------------------------------ Animation lane ---------------------------- */

function FlowLane({
  step,
  playKey,
}: {
  step: FlowStep;
  playKey: string;
}) {
  return (
    <div className="relative mt-4 h-28">
      {/* Connector baseline (agent center → provider center) */}
      <div
        className="absolute top-1/2"
        style={{
          left: `${actorCenterPct("agent")}%`,
          width: `${actorCenterPct("provider") - actorCenterPct("agent")}%`,
          borderTop: step.onChain
            ? "1px solid rgba(216,231,242,0.25)"
            : "1px dashed rgba(255,255,255,0.22)",
        }}
      />

      {/* On/off-chain tag */}
      <div
        className="absolute left-1/2 top-2 -translate-x-1/2"
        style={{ transform: "translateX(-50%)" }}
      >
        <span
          className={[
            "rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em]",
            step.onChain
              ? "border-accent/30 bg-accent-glow text-accent"
              : "border-border bg-bg-card text-text-dim",
          ].join(" ")}
        >
          {step.onChain
            ? "On-chain transaction"
            : "Off-chain · no gas · sub-second"}
        </span>
      </div>

      {/* Moving tokens — re-mount (via key) restarts the animation */}
      <div key={playKey} className="absolute inset-0">
        {step.pulses.map((p, i) => (
          <FlowToken key={`${playKey}-${i}`} pulse={p} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ Static fallback --------------------------- */

function StaticFlow({ steps }: { steps: FlowStep[] }) {
  return (
    <ol className="space-y-4">
      {steps.map((step) => (
        <li
          key={step.id}
          className="rounded-xl border border-border bg-bg-card p-5"
        >
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.15em] text-text-dim">
              {step.kicker}
            </span>
            <span
              className={[
                "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
                step.onChain
                  ? "border-accent/30 text-accent"
                  : "border-border text-text-dim",
              ].join(" ")}
            >
              {step.onChain ? "on-chain" : "off-chain"}
            </span>
          </div>
          <h4 className="mt-1 text-lg font-semibold tracking-tight">
            {step.title}
          </h4>
          <p className="mt-1 text-sm text-text-muted leading-relaxed">
            {step.caption}
          </p>
        </li>
      ))}
    </ol>
  );
}

/* --------------------------------- Legend --------------------------------- */

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-text-dim">
      <span className="inline-flex items-center gap-2">
        <span className="inline-block h-0 w-6 border-t border-accent/50" />
        solid = on-chain tx
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="inline-block h-0 w-6 border-t border-dashed border-text-dim" />
        dashed = off-chain message
      </span>
    </div>
  );
}

/* ------------------------------- Main flow -------------------------------- */

export function DemoFlow() {
  const prefersReducedMotion = useReducedMotion();
  const [trackId, setTrackId] = useState(TRACKS[0].id);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [nonce, setNonce] = useState(0);
  const [chip, setChip] = useState<string | null>(null);

  const track = TRACKS.find((t) => t.id === trackId)!;
  const step = track.steps[stepIndex];
  const isLast = stepIndex === track.steps.length - 1;
  const playKey = `${trackId}-${stepIndex}-${nonce}`;

  // Auto-advance (schedules a timer only; never sets state synchronously).
  useEffect(() => {
    if (prefersReducedMotion || !playing || isLast) return;
    const t = setTimeout(() => setStepIndex((i) => i + 1), step.duration);
    return () => clearTimeout(t);
  }, [prefersReducedMotion, playing, isLast, step.duration, playKey]);

  // Running chip (e.g. latest signed IOU) — all updates run in timeouts.
  useEffect(() => {
    if (prefersReducedMotion) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setChip(null), 0));
    step.chips?.forEach((mark) =>
      timers.push(setTimeout(() => setChip(mark.text), mark.at * 1000)),
    );
    return () => timers.forEach(clearTimeout);
  }, [prefersReducedMotion, step, playKey]);

  function selectTrack(id: string) {
    setTrackId(id);
    setStepIndex(0);
    setNonce((n) => n + 1);
    setPlaying(true);
  }
  const goPrev = () => {
    setStepIndex((i) => Math.max(0, i - 1));
    setPlaying(false);
    setNonce((n) => n + 1);
  };
  const goNext = () => {
    setStepIndex((i) => Math.min(track.steps.length - 1, i + 1));
    setPlaying(false);
    setNonce((n) => n + 1);
  };
  const replay = () => {
    setStepIndex(0);
    setNonce((n) => n + 1);
    setPlaying(true);
  };

  return (
    <section aria-label="Watch one payment, end to end">
      <PillLabel icon="✦" label="LIVE WALKTHROUGH" />
      <h2 className="mt-6 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.1]">
        Watch one payment, <span className="heading-serif">end to end</span>
      </h2>
      <p className="mt-4 max-w-2xl text-text-muted text-base md:text-lg leading-relaxed">
        One agent, one provider, the full state-channel lifecycle — open
        on-chain, transact off-chain, settle once.
      </p>

      {/* Track tabs */}
      <div className="mt-8 inline-flex rounded-full border border-border bg-bg-card p-1">
        {TRACKS.map((t) => (
          <button
            key={t.id}
            onClick={() => selectTrack(t.id)}
            className={[
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              t.id === trackId
                ? "bg-white/10 text-text-primary"
                : "text-text-muted hover:text-text-primary",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-bg/60 p-5 md:p-8">
        {prefersReducedMotion ? (
          <StaticFlow steps={track.steps} />
        ) : (
          <>
            {/* Actor row */}
            <div className="grid grid-cols-4 gap-3">
              {ACTORS.map((a) => (
                <ActorCard
                  key={a.id}
                  id={a.id}
                  active={step.active.includes(a.id)}
                  status={step.status?.[a.id]}
                />
              ))}
            </div>

            {/* Animation lane */}
            <FlowLane step={step} playKey={playKey} />

            <div className="mt-2">
              <Legend />
            </div>

            {/* Caption + meta */}
            <div className="mt-6 min-h-[7rem]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={playKey}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE_OUT }}
                >
                  <div className="text-[11px] uppercase tracking-[0.18em] text-text-dim">
                    {step.kicker}
                  </div>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 max-w-2xl text-sm md:text-base text-text-muted leading-relaxed">
                    {step.caption}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {chip && step.chipLabel && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-card px-3 py-1 text-xs text-text-muted">
                        {step.chipLabel}:{" "}
                        <span className="font-mono text-accent">{chip}</span>
                      </span>
                    )}
                    {step.tx && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-card px-3 py-1 text-xs">
                        <span className="font-mono text-text-muted">
                          {step.tx}
                        </span>
                        <span className="inline-flex items-center gap-1 text-success">
                          <Check className="h-3 w-3" />
                          confirmed
                        </span>
                      </span>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Progress + controls */}
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 gap-1.5">
                {track.steps.map((s, i) => (
                  <div
                    key={s.id}
                    className="h-1 flex-1 overflow-hidden rounded-full bg-white/10"
                  >
                    <motion.div
                      key={`${playKey}-${i}-${playing}`}
                      className="h-full bg-accent"
                      initial={{ width: i < stepIndex ? "100%" : "0%" }}
                      animate={{
                        width:
                          i < stepIndex
                            ? "100%"
                            : i === stepIndex
                              ? "100%"
                              : "0%",
                      }}
                      transition={
                        i === stepIndex && playing && !isLast
                          ? { duration: step.duration / 1000, ease: "linear" }
                          : { duration: 0.2 }
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={goPrev}
                  disabled={stepIndex === 0}
                  aria-label="Previous step"
                  className="rounded-lg border border-border p-2 text-text-muted transition-colors hover:text-text-primary hover:border-border-hover disabled:opacity-40"
                >
                  <SkipBack className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPlaying((p) => !p)}
                  aria-label={playing ? "Pause" : "Play"}
                  className="rounded-lg border border-border p-2 text-text-primary transition-colors hover:border-border-hover"
                >
                  {playing ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={goNext}
                  disabled={isLast}
                  aria-label="Next step"
                  className="rounded-lg border border-border p-2 text-text-muted transition-colors hover:text-text-primary hover:border-border-hover disabled:opacity-40"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
                <button
                  onClick={replay}
                  aria-label="Replay"
                  className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-muted transition-colors hover:text-text-primary hover:border-border-hover"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Replay
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
