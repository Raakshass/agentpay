"use client";

import { Wallet } from "lucide-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function ConnectPrompt() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24">
      <div className="w-16 h-16 rounded-2xl bg-bg-card border border-border flex items-center justify-center mb-6">
        <Wallet className="w-7 h-7 text-accent" />
      </div>
      <h2 className="text-xl font-medium text-text-primary">
        Connect your wallet
      </h2>
      <p className="mt-2 mb-6 text-sm text-text-muted max-w-sm">
        Register your API or DePIN service on-chain, set its price, and manage
        listings you own. You&apos;ll sign each change with your wallet.
      </p>
      <WalletMultiButton />
    </div>
  );
}
