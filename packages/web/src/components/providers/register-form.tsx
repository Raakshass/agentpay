"use client";

import { useState, type FormEvent } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { TxStatus } from "@/components/ui/tx-status";
import { useSendIx } from "@/hooks/use-send-ix";
import { buildRegisterProviderIx } from "@/lib/registry-client";
import { AGENT_TYPES, CATEGORIES } from "@/lib/registry-enums";
import { MAX_NAME_LEN } from "@/lib/constants";

/** SHA-256 a string into the 32-byte endpoint hash the program expects. */
async function endpointHash32(endpoint: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(endpoint.trim());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(digest);
}

const inputClasses =
  "w-full rounded-lg bg-bg border border-border px-4 py-2.5 text-sm text-text-primary placeholder:text-text-dim focus:border-accent focus:outline-none transition-colors";

interface RegisterFormProps {
  onSuccess: () => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const { publicKey } = useWallet();
  const { state, signature, error, send, reset } = useSendIx();

  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState(0);
  const [agentType, setAgentType] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  const submitting = state === "pending";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setValidationError(null);
    reset();

    if (!publicKey) {
      setValidationError("Connect a wallet first.");
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > MAX_NAME_LEN) {
      setValidationError(`Name must be 1–${MAX_NAME_LEN} characters.`);
      return;
    }
    if (!endpoint.trim()) {
      setValidationError("Endpoint URL is required.");
      return;
    }
    const priceUsdc = Math.round(parseFloat(price) * 1_000_000);
    if (!Number.isFinite(priceUsdc) || priceUsdc <= 0) {
      setValidationError("Price must be greater than zero.");
      return;
    }

    const ix = buildRegisterProviderIx({
      owner: publicKey,
      name: trimmedName,
      endpointHash: await endpointHash32(endpoint),
      priceUsdc,
      category,
      agentType,
      // Default the payout + metering authority to the owner; both can be
      // changed later by re-registering with explicit keys.
      providerWallet: publicKey,
      gatewayAuthority: publicKey,
    });

    const sig = await send([ix]);
    if (sig) {
      setName("");
      setEndpoint("");
      setPrice("");
      setCategory(0);
      setAgentType(0);
      onSuccess();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-border bg-bg-card p-6 space-y-5"
    >
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          Register your API
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          List a service on-chain. You sign as the owner and can update or remove
          it anytime.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="name" className="text-sm text-text-muted">
          Name
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME_LEN}
          placeholder="OpenWeather Realtime"
          className={inputClasses}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="endpoint" className="text-sm text-text-muted">
          Endpoint URL
        </label>
        <input
          id="endpoint"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder="https://api.example.com/v1/forecast"
          className={inputClasses}
        />
        <p className="text-xs text-text-dim">
          Stored on-chain as a SHA-256 hash, not in plaintext.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="price" className="text-sm text-text-muted">
            Price (USDC)
          </label>
          <input
            id="price"
            type="number"
            step="0.000001"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.001"
            className={`${inputClasses} font-mono`}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="category" className="text-sm text-text-muted">
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(Number(e.target.value))}
            className={`${inputClasses} cursor-pointer`}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="agentType" className="text-sm text-text-muted">
            Type
          </label>
          <select
            id="agentType"
            value={agentType}
            onChange={(e) => setAgentType(Number(e.target.value))}
            className={`${inputClasses} cursor-pointer`}
          >
            {AGENT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-4 pt-1">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Registering…" : "Register provider"}
        </Button>
        <TxStatus
          state={state}
          signature={signature}
          errorMessage={error}
        />
      </div>

      {validationError && (
        <p className="text-sm text-error" role="alert">
          {validationError}
        </p>
      )}
    </form>
  );
}
