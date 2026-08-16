"use client";

import { useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { config } from "@/lib/config";
import { Button } from "@/components/ui/button";
import type { CatalogService } from "@/hooks/use-catalog";

interface TryItPanelProps {
  service: CatalogService;
}

type Result =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; status: number; body: string }
  | { kind: "err"; message: string };

/**
 * Live playground for a single service. Calls the gateway's free, unauthenticated
 * `/preview` endpoint with the user's input and renders the real JSON response —
 * the same data a paid `/api` call returns, no wallet or session required.
 */
export function TryItPanel({ service }: TryItPanelProps) {
  const [input, setInput] = useState(service.preview.example);
  const [result, setResult] = useState<Result>({ kind: "idle" });

  const trimmed = input.trim();
  const requestUrl = `${config.gatewayUrl}${service.preview.endpoint}/${
    trimmed ? encodeURIComponent(trimmed) : ""
  }`;

  const run = async () => {
    if (!trimmed) return;
    setResult({ kind: "loading" });
    try {
      const response = await fetch(requestUrl, {
        headers: { accept: "application/json" },
      });
      const text = await response.text();
      let body = text;
      try {
        body = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // Non-JSON response — show as-is.
      }
      setResult({ kind: "ok", status: response.status, body });
    } catch (e: unknown) {
      setResult({
        kind: "err",
        message:
          e instanceof Error ? e.message : "Request failed — is the gateway up?",
      });
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium uppercase tracking-wide text-text-dim">
        {service.preview.inputLabel}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void run();
          }}
          placeholder={service.preview.example}
          spellCheck={false}
          className="min-w-0 flex-1 rounded-lg bg-bg border border-border px-3 py-2 text-sm font-mono text-text-primary placeholder:text-text-dim focus:border-accent focus:outline-none transition-colors duration-200"
        />
        <Button
          size="sm"
          onClick={() => void run()}
          disabled={!trimmed || result.kind === "loading"}
        >
          {result.kind === "loading" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Run
        </Button>
      </div>

      <p className="font-mono text-[11px] text-text-dim break-all">
        GET {service.preview.endpoint}/{trimmed || "…"}
        <span className="ml-2 text-accent">free preview</span>
      </p>

      {result.kind === "err" && (
        <p className="text-sm text-red-400">{result.message}</p>
      )}

      {result.kind === "ok" && (
        <div className="space-y-1">
          <span
            className={[
              "inline-block text-xs font-mono",
              result.status < 300 ? "text-emerald-400" : "text-amber-400",
            ].join(" ")}
          >
            {result.status} {result.status < 300 ? "OK" : "response"}
          </span>
          <pre className="max-h-72 overflow-auto rounded-lg bg-bg border border-border p-3 text-xs font-mono text-text-muted leading-relaxed">
            {result.body}
          </pre>
        </div>
      )}
    </div>
  );
}
