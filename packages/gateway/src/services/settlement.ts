/**
 * Settlement Service
 *
 * Submits the final IOU to Vineet's escrow contract for on-chain settlement.
 * This triggers the fund split: usage amount → provider, remainder → agent.
 *
 * Currently a placeholder — will be implemented once Vineet deploys
 * the escrow program and shares the IDL + program ID.
 */

import type { ActiveSession } from "./session-manager.js";
import { logger } from "../utilities/logger.js";

export interface SettlementResult {
  isSuccess: boolean;
  transactionSignature: string | null;
  reason?: string;
}

/**
 * Settle a session on-chain by submitting the last signed IOU
 * to the escrow contract's settle_session instruction.
 *
 * The contract will:
 * 1. Verify the agent's IOU signature using brine-ed25519
 * 2. Transfer cumulative USDC amount to the provider revenue wallet
 * 3. Refund remaining USDC to the agent
 * 4. Close the session account
 */
export async function settleSessionOnChain(
  session: ActiveSession
): Promise<SettlementResult> {
  if (session.latestIou === null || session.latestIouSignature === null) {
    logger.info(`Session ${session.sessionPda}: No API calls made, skipping settlement`);
    return {
      isSuccess: true,
      transactionSignature: null,
      reason: "No usage to settle — full refund via contract timeout",
    };
  }

  // TODO: Implement on-chain settlement when Vineet's contract is ready.
  //
  // Implementation steps:
  // 1. Build the settle_session instruction using the Anchor IDL
  // 2. Include the agent's IOU bytes + signature as instruction data
  // 3. Sign with the gateway wallet
  // 4. Send and confirm the transaction
  //
  // Required from Vineet:
  // - Deployed program ID (set in ESCROW_PROGRAM_ID env var)
  // - Generated IDL JSON file
  // - Devnet test session to verify against

  logger.warn(
    `Settlement pending: session ${session.sessionPda}, ` +
    `amount ${session.latestIou.cumulativeUsdc} atomic USDC. ` +
    `Waiting for escrow contract deployment.`
  );

  return {
    isSuccess: false,
    transactionSignature: null,
    reason: "Escrow contract not yet deployed — settlement queued",
  };
}
