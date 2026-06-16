"use client";

import { useEffect, useRef, useState } from "react";
import { config } from "@/lib/config";

/** A single payment/settlement event flowing through the network. */
export interface DemoEvent {
  id: string;
  /** Index into the agents array (payer). */
  agent: number;
  /** Index into the providers array (payee). */
  provider: number;
  /** Settled amount in atomic USDC (1e6 = 1 USDC). */
  amountUsdc: number;
  timestamp: number;
}

export type DemoMode = "simulated" | "live";

/** Agent (payer) node labels — kept in sync with the demo graph. */
export const DEMO_AGENTS = ["Atlas", "Orion", "Nova", "Echo"];
/** Provider (payee) node labels. */
export const DEMO_PROVIDERS = ["Weather", "Maps", "DePIN", "GPU", "Oracle"];

const MAX_EVENTS = 12;
const SIM_MIN_MS = 900;
const SIM_MAX_MS = 2600;
const SIM_AMOUNTS = [500, 1_000, 2_500, 3_200, 12_000, 50_000];

function randomEvent(): DemoEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    agent: Math.floor(Math.random() * DEMO_AGENTS.length),
    provider: Math.floor(Math.random() * DEMO_PROVIDERS.length),
    amountUsdc: SIM_AMOUNTS[Math.floor(Math.random() * SIM_AMOUNTS.length)],
    timestamp: Date.now(),
  };
}

export interface UseDemoEventsResult {
  events: DemoEvent[];
  /** Most recent event, for triggering edge pulse animations. */
  latest: DemoEvent | null;
  mode: DemoMode;
}

/**
 * Stream of payment events for the live demo.
 *
 * Primary path is a deterministic-feeling simulation generated at random
 * intervals, so the page is alive with zero infrastructure. If
 * NEXT_PUBLIC_GATEWAY_WS_URL is set, it connects to that WebSocket and upgrades
 * to "live" mode, falling back to simulation on any connection failure.
 */
export function useDemoEvents(): UseDemoEventsResult {
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const [latest, setLatest] = useState<DemoEvent | null>(null);
  const [mode, setMode] = useState<DemoMode>("simulated");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = (event: DemoEvent) => {
    setLatest(event);
    setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
  };

  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;

    const startSimulation = () => {
      if (cancelled) return;
      setMode("simulated");
      const tick = () => {
        if (cancelled) return;
        push(randomEvent());
        const delay =
          SIM_MIN_MS + Math.random() * (SIM_MAX_MS - SIM_MIN_MS);
        timerRef.current = setTimeout(tick, delay);
      };
      tick();
    };

    if (config.gatewayWsUrl) {
      try {
        ws = new WebSocket(config.gatewayWsUrl);
        ws.onopen = () => !cancelled && setMode("live");
        ws.onmessage = (msg) => {
          if (cancelled) return;
          try {
            const data = JSON.parse(msg.data);
            push({
              id: data.id ?? `${Date.now()}-${Math.random()}`,
              agent: Number(data.agent) || 0,
              provider: Number(data.provider) || 0,
              amountUsdc: Number(data.amountUsdc) || 0,
              timestamp: data.timestamp ?? Date.now(),
            });
          } catch {
            // Ignore malformed frames.
          }
        };
        ws.onerror = () => {
          ws?.close();
          startSimulation();
        };
        ws.onclose = () => {
          if (!cancelled && mode !== "simulated") startSimulation();
        };
      } catch {
        startSimulation();
      }
    } else {
      startSimulation();
    }

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      ws?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { events, latest, mode };
}
