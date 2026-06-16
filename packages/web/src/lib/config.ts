/**
 * AgentPay Frontend — Centralized Configuration
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
    "jGKPeCDKNCxe4B8B3utPjv1MjuowGUj7KvTp4GqjK6B",
  escrowProgramId:
    process.env.NEXT_PUBLIC_ESCROW_PROGRAM_ID ||
    "N9J67nThvRxeLHr7VTnpcvTX49qttu3QHtew86FTccS",
  usdcMint:
    process.env.NEXT_PUBLIC_USDC_MINT ||
    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  gatewayUrl:
    process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:4020",
  gatewayWsUrl: process.env.NEXT_PUBLIC_GATEWAY_WS_URL || "",
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
