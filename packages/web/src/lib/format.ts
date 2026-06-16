/**
 * Formatting utilities for USDC amounts, addresses, and numbers.
 */

/**
 * Format atomic USDC (1e6 = 1 USDC) to human-readable string.
 * Examples:
 *   1000    -> "0.001"
 *   1000000 -> "1.00"
 *   50000   -> "0.05"
 */
export function formatUsdc(atomicAmount: number): string {
  const usdc = atomicAmount / 1_000_000;
  if (usdc >= 1) {
    return usdc.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  // For sub-dollar amounts, show enough decimals
  return usdc.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 6,
  });
}

/**
 * Format atomic USDC with a $ prefix for display.
 */
export function formatUsdcWithSymbol(atomicAmount: number): string {
  return `$${formatUsdc(atomicAmount)}`;
}

/**
 * Truncate a Solana public key for display.
 * "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" -> "7xKX…AsU"
 */
export function truncateAddress(
  address: string,
  startChars = 4,
  endChars = 4,
): string {
  if (address.length <= startChars + endChars + 1) return address;
  return `${address.slice(0, startChars)}…${address.slice(-endChars)}`;
}

/**
 * Format a large number with commas.
 * 1234567 -> "1,234,567"
 */
export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Category ID to human-readable label.
 */
const CATEGORY_LABELS: Record<number, string> = {
  0: "Weather",
  1: "Mapping",
  2: "Network",
  3: "Compute",
  4: "Agent",
};

export function categoryLabel(id: number): string {
  return CATEGORY_LABELS[id] ?? "Unknown";
}

/**
 * Agent type ID to human-readable label.
 */
const AGENT_TYPE_LABELS: Record<number, string> = {
  0: "API",
  1: "Agent",
  2: "DePIN",
};

export function agentTypeLabel(id: number): string {
  return AGENT_TYPE_LABELS[id] ?? "Unknown";
}
