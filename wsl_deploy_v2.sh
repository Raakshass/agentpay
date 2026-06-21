#!/usr/bin/env bash
set -euo pipefail

echo "=== AgentPay WSL Deploy v2 ==="

# Source paths
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$HOME/.avm/bin:$PATH"
source "$HOME/.cargo/env" 2>/dev/null || true

echo "rust:    $(rustc --version)"
echo "solana:  $(solana --version)"
echo "anchor:  $(anchor --version)"

# --- Step 1: Sync program keys ---
echo ""
echo "=== step 1: sync anchor keys ==="
cd /mnt/d/blockchain_funding/agentpay/programs/agentpay-contracts

# Get the actual keypair-derived IDs
ESCROW_ID=$(solana address -k target/deploy/escrow-keypair.json 2>/dev/null || echo "MISSING")
REGISTRY_ID=$(solana address -k target/deploy/registry-keypair.json 2>/dev/null || echo "MISSING")

echo "  escrow keypair ID:   $ESCROW_ID"
echo "  registry keypair ID: $REGISTRY_ID"

# Sync source code declare_id! to match keypairs
anchor keys sync
echo "  keys synced"

# --- Step 2: Build with synced keys ---
echo ""
echo "=== step 2: anchor build ==="
anchor build
echo "  build complete"

# Re-read IDs after build (in case keys were regenerated)
ESCROW_ID=$(solana address -k target/deploy/escrow-keypair.json)
REGISTRY_ID=$(solana address -k target/deploy/registry-keypair.json)

# --- Step 3: Airdrop SOL ---
echo ""
echo "=== step 3: airdrop sol ==="
solana config set --url devnet

DEPLOYER=$(solana address)
echo "  deployer: $DEPLOYER"

BALANCE_LAM=$(solana balance --lamports 2>/dev/null | awk '{print $1}' || echo "0")
echo "  current balance: $BALANCE_LAM lamports"

if [ "$BALANCE_LAM" -lt 4000000000 ]; then
  echo "  need SOL, airdropping with delays..."
  for i in 1 2 3 4 5; do
    echo "  attempt $i..."
    solana airdrop 1 --url devnet 2>&1 || true
    sleep 15
  done
fi

echo "  final balance: $(solana balance)"

# Check if we have enough
FINAL_LAM=$(solana balance --lamports 2>/dev/null | awk '{print $1}' || echo "0")
if [ "$FINAL_LAM" -lt 2000000000 ]; then
  echo ""
  echo "!!! INSUFFICIENT SOL FOR DEPLOYMENT !!!"
  echo "  balance: $FINAL_LAM lamports (need >= 2 SOL)"
  echo "  manual fix: go to https://faucet.solana.com"
  echo "  paste address: $DEPLOYER"
  echo "  airdrop 5 SOL, then re-run this script"
  echo ""
  echo "ESCROW_PROGRAM_ID=$ESCROW_ID"
  echo "REGISTRY_PROGRAM_ID=$REGISTRY_ID"
  exit 1
fi

# --- Step 4: Deploy ---
echo ""
echo "=== step 4: deploy to devnet ==="
anchor deploy --provider.cluster devnet 2>&1

# --- Step 5: Print results ---
echo ""
echo "========================================="
echo "  DEPLOYMENT COMPLETE"
echo "========================================="
echo "  ESCROW_PROGRAM_ID=$ESCROW_ID"
echo "  REGISTRY_PROGRAM_ID=$REGISTRY_ID"
echo "  DEPLOYER=$DEPLOYER"
echo "========================================="
