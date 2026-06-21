#!/usr/bin/env bash
set -euo pipefail

echo "=== AgentPay WSL Deploy v3 (rebuild + deploy) ==="

export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$HOME/.avm/bin:$PATH"
source "$HOME/.cargo/env" 2>/dev/null || true

cd /mnt/d/blockchain_funding/agentpay/programs/agentpay-contracts

echo "rust:    $(rustc --version)"
echo "solana:  $(solana --version)"
echo "anchor:  $(anchor --version)"

# --- Step 1: Build ---
echo ""
echo "=== step 1: anchor build ==="
anchor build 2>&1
echo "  build complete"

# --- Step 2: Airdrop ---
echo ""
echo "=== step 2: airdrop sol ==="
solana config set --url devnet
DEPLOYER=$(solana address)
echo "  deployer: $DEPLOYER"
echo "  balance: $(solana balance)"

BALANCE_LAM=$(solana balance --lamports 2>/dev/null | awk '{print $1}' || echo "0")
if [ "$BALANCE_LAM" -lt 4000000000 ]; then
  echo "  airdropping with delays..."
  for i in 1 2 3 4 5; do
    echo "  attempt $i..."
    solana airdrop 1 --url devnet 2>&1 || true
    sleep 20
  done
fi
echo "  final balance: $(solana balance)"

# --- Step 3: Deploy ---
echo ""
echo "=== step 3: deploy to devnet ==="
ESCROW_ID=$(solana address -k target/deploy/escrow-keypair.json)
REGISTRY_ID=$(solana address -k target/deploy/registry-keypair.json)

anchor deploy --provider.cluster devnet 2>&1

echo ""
echo "========================================="
echo "  DEPLOYMENT COMPLETE"
echo "========================================="
echo "  ESCROW_PROGRAM_ID=$ESCROW_ID"
echo "  REGISTRY_PROGRAM_ID=$REGISTRY_ID"
echo "  DEPLOYER=$DEPLOYER"
echo "========================================="
