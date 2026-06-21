"use client";

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction, type TransactionInstruction } from "@solana/web3.js";

export type TxState = "idle" | "pending" | "confirmed" | "error";

export interface UseSendIxResult {
  state: TxState;
  signature: string | null;
  error?: string;
  send: (ixs: TransactionInstruction[]) => Promise<string | null>;
  reset: () => void;
}

/**
 * Sign and send a set of instructions through the connected wallet adapter,
 * tracking the lifecycle (pending → confirmed → error) for the UI.
 */
export function useSendIx(): UseSendIxResult {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [state, setState] = useState<TxState>("idle");
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();

  const send = useCallback(
    async (ixs: TransactionInstruction[]) => {
      if (!publicKey) {
        setState("error");
        setError("Connect a wallet first");
        return null;
      }
      try {
        setState("pending");
        setError(undefined);
        setSignature(null);

        const tx = new Transaction().add(...ixs);
        const sig = await sendTransaction(tx, connection);
        setSignature(sig);

        const latest = await connection.getLatestBlockhash();
        await connection.confirmTransaction(
          { signature: sig, ...latest },
          "confirmed",
        );

        setState("confirmed");
        return sig;
      } catch (e) {
        setState("error");
        setError(e instanceof Error ? e.message : "Transaction failed");
        return null;
      }
    },
    [connection, publicKey, sendTransaction],
  );

  const reset = useCallback(() => {
    setState("idle");
    setSignature(null);
    setError(undefined);
  }, []);

  return { state, signature, error, send, reset };
}
