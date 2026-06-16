"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletProviders } from "@/hooks/use-wallet-providers";
import { ConnectPrompt } from "./connect-prompt";
import { RegisterForm } from "./register-form";
import { MyProviders } from "./my-providers";

export function DashboardClient() {
  const { connected } = useWallet();
  const { providers, loading, error, refresh } = useWalletProviders();

  if (!connected) {
    return <ConnectPrompt />;
  }

  return (
    <div className="space-y-12">
      <RegisterForm onSuccess={refresh} />

      <section>
        <h2 className="text-lg font-semibold tracking-tight mb-5">
          Your providers
        </h2>
        <MyProviders
          providers={providers}
          loading={loading}
          error={error}
          onChanged={refresh}
        />
      </section>
    </div>
  );
}
