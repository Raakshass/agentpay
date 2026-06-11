# Smart Contracts — Vineet's Domain

> This directory is for the Anchor workspace. Vineet owns this.

## Setup

```bash
# Install Rust + Solana CLI + Anchor
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.0 anchor-cli

# Initialize Anchor workspace in this directory
anchor init agentpay-contracts --no-git
```

## Programs to Build

### 1. Escrow Program (`agentpay-escrow`)

**Accounts:**
```rust
#[account]
pub struct SessionAccount {
    pub agent: Pubkey,              // agent who deposited
    pub gateway: Pubkey,            // authorized gateway server
    pub deposit_amount: u64,        // total deposited (atomic USDC)
    pub status: SessionStatus,      // Active / Settled / Refunded
    pub created_at: i64,            // unix timestamp
    pub timeout_seconds: u32,       // crash safety (3600 = 1hr)
    pub bump: u8,
}
```

**Instructions:**

| Instruction | Signer | What it does |
|:---|:---|:---|
| `open_session` | Agent | Deposits USDC, creates SessionAccount PDA |
| `settle_session` | Gateway | Submits last IOU + signature, verifies via `brine-ed25519`, splits funds |
| `claim_refund` | Agent | After timeout, returns full deposit |

**Key dependency:**
```toml
[dependencies]
brine-ed25519 = { version = "0.2", features = ["fast-sha512"] }
```

**IOU format that contract must verify:**
```json
{
  "session": "Base58 PDA address",
  "cumulative_usdc": 20000,
  "request_count": 20,
  "timestamp": 1717600000
}
```

The contract receives:
- `iou_bytes: Vec<u8>` — the JSON above as UTF-8 bytes
- `agent_signature: [u8; 64]` — ed25519 signature of iou_bytes
- `agent_pubkey: [u8; 32]` — agent's ed25519 public key

Verification in settle_session:
```rust
use brine_ed25519::sig_verify;

sig_verify(&agent_pubkey, &agent_signature, &iou_bytes)?;
```

### 2. Registry Program (`agentpay-registry`)

**Accounts:**
```rust
#[account]
pub struct ServiceAccount {
    pub provider: Pubkey,
    pub display_name: String,       // max 64 chars
    pub description: String,        // max 256 chars
    pub endpoint_url: String,       // max 128 chars
    pub category: u8,               // 0=depin, 1=blockchain, 2=market
    pub price_per_request: u64,     // atomic USDC
    pub is_active: bool,
    pub bump: u8,
}
```

**Instructions:** `register_service`, `update_service`, `deactivate_service`

## After Deployment

Share with Siddhant:
1. Program IDs (for `.env`)
2. IDL JSON files (for settlement service integration)
3. A test session PDA on devnet to verify against
