#!/usr/bin/env bash
set -euo pipefail

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# AgentPay â€” WSL Deployment Script
# Installs Solana + Anchor toolchain, builds, and deploys to devnet.
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

echo "â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—"
echo "â•‘   AgentPay WSL Deploy Pipeline                 â•‘"
echo "â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"

# --- Source paths ---
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$HOME/.avm/bin:$PATH"

# --- Step 1: Install Rust if missing ---
if ! command -v rustc &> /dev/null; then
  echo ""
  echo "â•â•â• step 1: installing rust â•â•â•"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
  echo "  âœ“ rust installed: $(rustc --version)"
else
  echo ""
  echo "â•â•â• step 1: rust already installed â•â•â•"
  echo "  âœ“ $(rustc --version)"
fi

# --- Step 2: Install Solana CLI if missing ---
if ! command -v solana &> /dev/null; then
  echo ""
  echo "â•â•â• step 2: installing solana cli â•â•â•"
  sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
  export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
  echo "  âœ“ solana installed: $(solana --version)"
else
  echo ""
  echo "â•â•â• step 2: solana cli already installed â•â•â•"
  echo "  âœ“ $(solana --version)"
fi

# --- Step 3: Install Anchor CLI if missing ---
if ! command -v anchor &> /dev/null; then
  echo ""
  echo "â•â•â• step 3: installing anchor cli (this may take 5-10 minutes) â•â•â•"
  cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
  avm install latest
  avm use latest
  echo "  âœ“ anchor installed: $(anchor --version)"
else
  echo ""
  echo "â•â•â• step 3: anchor cli already installed â•â•â•"
  echo "  âœ“ $(anchor --version)"
fi

# --- Step 4: Configure Solana ---
echo ""
echo "â•â•â• step 4: configure solana for devnet â•â•â•"
solana config set --url devnet

# Generate keypair if it doesn't exist
if [ ! -f "$HOME/.config/solana/id.json" ]; then
  echo "  generating new keypair..."
  solana-keygen new --no-bip39-passphrase --outfile "$HOME/.config/solana/id.json"
fi

DEPLOYER_PUBKEY=$(solana address)
echo "  deployer: $DEPLOYER_PUBKEY"

# --- Step 5: Airdrop SOL ---
echo ""
echo "â•â•â• step 5: airdrop sol for deployment â•â•â•"
BALANCE=$(solana balance --lamports | awk '{print $1}')
REQUIRED=4000000000  # 4 SOL in lamports

if [ "$BALANCE" -lt "$REQUIRED" ]; then
  echo "  balance: $(solana balance) â€” need more SOL"
  # Airdrop in chunks (devnet limits per request)
  solana airdrop 2 || true
  sleep 3
  solana airdrop 2 || true
  sleep 3
  solana airdrop 1 || true
  sleep 2
else
  echo "  balance: $(solana balance) â€” sufficient"
fi

echo "  final balance: $(solana balance)"

# --- Step 6: Build contracts ---
echo ""
echo "â•â•â• step 6: building contracts â•â•â•"
PROJECT_DIR="/mnt/d/blockchain_funding/agentpay/programs/agentpay-contracts"
cd "$PROJECT_DIR"

echo "  running anchor build..."
anchor build
echo "  âœ“ build complete"

# --- Step 7: Deploy to devnet ---
echo ""
echo "â•â•â• step 7: deploying to devnet â•â•â•"
anchor deploy --provider.cluster devnet 2>&1 | tee /tmp/agentpay_deploy.log

# --- Step 8: Extract and print Program IDs ---
echo ""
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo "   DEPLOYMENT RESULTS"
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"

# Parse program IDs from Anchor.toml (anchor deploy updates them)
# Also try to extract from deploy output
ESCROW_ID=$(grep '^escrow = ' Anchor.toml | head -1 | cut -d'"' -f2)
REGISTRY_ID=$(grep '^registry = ' Anchor.toml | head -1 | cut -d'"' -f2)

# If Anchor.toml wasn't updated, try parsing from solana program show
if [ -z "$ESCROW_ID" ] || [ "$ESCROW_ID" = "N9J67nThvRxeLHr7VTnpcvTX49qttu3QHtew86FTccS" ]; then
  # Try getting from the keypair files
  if [ -f "target/deploy/escrow-keypair.json" ]; then
    ESCROW_ID=$(solana address -k target/deploy/escrow-keypair.json)
  fi
fi

if [ -z "$REGISTRY_ID" ] || [ "$REGISTRY_ID" = "jGKPeCDKNCxe4B8B3utPjv1MjuowGUj7KvTp4GqjK6B" ]; then
  if [ -f "target/deploy/registry-keypair.json" ]; then
    REGISTRY_ID=$(solana address -k target/deploy/registry-keypair.json)
  fi
fi

echo ""
echo "  ESCROW_PROGRAM_ID=$ESCROW_ID"
echo "  REGISTRY_PROGRAM_ID=$REGISTRY_ID"
echo "  DEPLOYER=$DEPLOYER_PUBKEY"
echo ""
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo "  Copy these IDs to your .env files and config.ts"
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
