"use client";

import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AlertTriangle, X } from "lucide-react";
import { config } from "@/lib/config";

/**
 * Known Solana genesis hashes — the only reliable way to detect which cluster
 * an RPC endpoint is *actually* serving, since the URL itself can be anything.
 */
const GENESIS_HASHES: Record<string, string> = {
  "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG": "devnet",
  "4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZAMdL1VZHw3kN": "testnet",
  "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d": "mainnet-beta",
};

/**
 * Renders a sticky warning banner at the top of the page when the wallet's
 * connected RPC cluster doesn't match the app's configured network.
 *
 * For example: wallet is set to mainnet but the app's env says devnet.
 * Transactions sent in this state will either fail or land on the wrong chain.
 */
export function NetworkGuard() {
  const { connected } = useWallet();
  const { connection } = useConnection();
  const [mismatch, setMismatch] = useState<{
    expected: string;
    actual: string;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!connected) {
      setMismatch(null);
      return;
    }

    let cancelled = false;

    async function check() {
      try {
        const genesisHash = await connection.getGenesisHash();
        const detectedCluster = GENESIS_HASHES[genesisHash] || "unknown";

        if (!cancelled && detectedCluster !== config.network) {
          setMismatch({
            expected: config.network,
            actual: detectedCluster,
          });
        } else if (!cancelled) {
          setMismatch(null);
        }
      } catch {
        // RPC unreachable — not a mismatch, just a connectivity issue
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [connected, connection]);

  if (!mismatch || dismissed) return null;

  return (
    <div className="fixed top-16 left-0 right-0 z-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-2">
        <div className="flex items-center gap-3 rounded-lg border border-error/30 bg-error/10 backdrop-blur-sm px-4 py-3 text-sm text-error">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="flex-1">
            <strong>Network mismatch:</strong> Your wallet is connected to{" "}
            <span className="font-mono font-semibold">{mismatch.actual}</span>{" "}
            but this app is configured for{" "}
            <span className="font-mono font-semibold">{mismatch.expected}</span>.
            Transactions will fail. Please switch your wallet to{" "}
            <span className="font-semibold">{mismatch.expected}</span>.
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-error/70 hover:text-error transition-colors"
            aria-label="Dismiss warning"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
