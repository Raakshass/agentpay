/**
 * Conduit Frontend — Centralized Configuration
 *
 * All network addresses, program IDs, and environment-specific settings.
 * Switch between devnet and mainnet via NEXT_PUBLIC_SOLANA_NETWORK.
 */

export const config = {
  network: (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet") as
    | "devnet"
    | "mainnet-beta",
  rpcUrl:
    process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com",
  registryProgramId:
    process.env.NEXT_PUBLIC_REGISTRY_PROGRAM_ID ||
    "XGXadfKb7mru5wcr1yUZWSeBLVUY6NFDAriBUUMiLbk",
  escrowProgramId:
    process.env.NEXT_PUBLIC_ESCROW_PROGRAM_ID ||
    "8vH1iEpbwe31WGqSGd9a8qkKh7SCHW8MsaSULVsxskRw",
  usdcMint:
    process.env.NEXT_PUBLIC_USDC_MINT ||
    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  gatewayUrl:
    process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:4020",
  gatewayWsUrl: process.env.NEXT_PUBLIC_GATEWAY_WS_URL || "",
  /**
   * Public key of the gateway server's wallet. Providers MUST register this as
   * their gateway_authority so the gateway can call `increment_call_count` on
   * the registry. Without this, usage metering will fail with Unauthorized.
   *
   * Generate with: `solana-keygen pubkey gateway-keypair.json`
   */
  gatewayAuthority: process.env.NEXT_PUBLIC_GATEWAY_AUTHORITY || "",
} as const;

/**
 * Build a Solana Explorer URL for a given transaction signature.
 */
export function explorerTxUrl(signature: string): string {
  const cluster =
    config.network === "mainnet-beta" ? "" : `?cluster=${config.network}`;
  return `https://explorer.solana.com/tx/${signature}${cluster}`;
}

/**
 * Build a Solana Explorer URL for a given account address.
 */
export function explorerAddressUrl(address: string): string {
  const cluster =
    config.network === "mainnet-beta" ? "" : `?cluster=${config.network}`;
  return `https://explorer.solana.com/address/${address}${cluster}`;
}
