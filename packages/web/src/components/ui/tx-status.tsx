"use client";

import { Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { explorerTxUrl } from "@/lib/config";

type TxState = "idle" | "pending" | "confirmed" | "error";

interface TxStatusProps {
  state: TxState;
  signature?: string | null;
  errorMessage?: string;
  className?: string;
}

export function TxStatus({
  state,
  signature,
  errorMessage,
  className = "",
}: TxStatusProps) {
  if (state === "idle") return null;

  return (
    <div
      className={[
        "flex items-center gap-2 text-sm",
        state === "pending" ? "text-text-muted" : "",
        state === "confirmed" ? "text-success" : "",
        state === "error" ? "text-error" : "",
        className,
      ].join(" ")}
      role="status"
      aria-live="polite"
    >
      {state === "pending" && (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Confirming transaction…</span>
        </>
      )}

      {state === "confirmed" && (
        <>
          <CheckCircle2 className="w-4 h-4" />
          <span>Transaction confirmed</span>
          {signature && (
            <a
              href={explorerTxUrl(signature)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:underline"
              aria-label="View transaction on Solana Explorer"
            >
              <span className="font-mono text-xs">
                {signature.slice(0, 8)}…
              </span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </>
      )}

      {state === "error" && (
        <>
          <XCircle className="w-4 h-4" />
          <span>{errorMessage || "Transaction failed"}</span>
        </>
      )}
    </div>
  );
}
