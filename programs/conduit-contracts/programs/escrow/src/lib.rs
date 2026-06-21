//! Conduit Escrow — state-channel payments for agent API consumption.
//!
//! Lifecycle:
//!   A) DEPOSIT  (`open_channel`): the agent locks USDC into a PDA-owned vault.
//!   B) USE      (off-chain only): the agent signs cumulative IOUs; the program
//!                is NOT called. The gateway keeps the latest signed IOU.
//!   C) SETTLE   (`settle`): the gateway submits the latest IOU + the agent's
//!                signature. The program verifies the signature, pays the
//!                provider the cumulative amount, refunds the rest to the agent,
//!                and closes the channel.
//!   D) CRASH    (`claim_refund`): if the gateway never settles, the agent
//!                reclaims the full deposit once the timeout has elapsed.
//!
//! ## IOU message format (signed off-chain by the agent)
//!
//! The agent signs exactly these 40 bytes with their ed25519 keypair:
//!
//! ```text
//! message = channel_id (32 bytes) || cumulative_amount (u64, little-endian, 8 bytes)
//! ```
//!
//! `settle` reconstructs these bytes from on-chain state + the submitted amount
//! and verifies the signature against `channel.agent` using `brine-ed25519`'s
//! runtime curve25519 verification. Runtime verification (rather than the native
//! Ed25519 precompile) is required because the cumulative amount is dynamic and
//! cannot be hardcoded into the transaction ahead of time.

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{close_account, transfer, CloseAccount, Mint, Token, TokenAccount, Transfer},
};

declare_id!("8vH1iEpbwe31WGqSGd9a8qkKh7SCHW8MsaSULVsxskRw");

/// Lower bound for `timeout_seconds`. This is a minimal on-chain sanity floor
/// (rejects zero/negative). The gateway is expected to additionally refuse to
/// serve a channel whose timeout is not comfortably larger than its settlement
/// latency (see README "Security assumptions"), since a too-short timeout lets
/// an agent reclaim funds before the gateway can settle.
pub const MIN_TIMEOUT_SECONDS: i64 = 1;
/// Upper bound for `timeout_seconds` (7 days). Stops funds being locked forever.
pub const MAX_TIMEOUT_SECONDS: i64 = 7 * 24 * 60 * 60;

#[program]
pub mod escrow {
    use super::*;

    /// DEPOSIT. The agent opens a channel and locks `deposit_amount` USDC into a
    /// PDA-owned vault. Records the gateway authorized to settle and the
    /// provider that will receive settled funds.
    pub fn open_channel(
        ctx: Context<OpenChannel>,
        channel_id: [u8; 32],
        deposit_amount: u64,
        provider: Pubkey,
        gateway: Pubkey,
        timeout_seconds: i64,
    ) -> Result<()> {
        require!(deposit_amount > 0, EscrowError::ZeroDeposit);
        require!(
            (MIN_TIMEOUT_SECONDS..=MAX_TIMEOUT_SECONDS).contains(&timeout_seconds),
            EscrowError::InvalidTimeout
        );

        let channel = &mut ctx.accounts.channel;
        channel.agent = ctx.accounts.agent.key();
        channel.gateway = gateway;
        channel.provider = provider;
        channel.deposit_amount = deposit_amount;
        channel.channel_id = channel_id;
        channel.created_at = Clock::get()?.unix_timestamp;
        channel.timeout_seconds = timeout_seconds;
        channel.settled = false;
        channel.bump = ctx.bumps.channel;

        // Move the deposit from the agent into the vault.
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.agent_token_account.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.agent.to_account_info(),
                },
            ),
            deposit_amount,
        )?;

        Ok(())
    }

    /// SETTLE. The gateway submits the agent's latest cumulative IOU. The
    /// program verifies the signature, splits the funds (provider gets the
    /// cumulative amount, the agent is refunded the remainder), and closes the
    /// channel + vault, returning rent to the agent.
    pub fn settle(
        ctx: Context<Settle>,
        cumulative_amount: u64,
        signature: [u8; 64],
    ) -> Result<()> {
        let channel = &ctx.accounts.channel;

        // Single-settle guard: never release funds twice.
        require!(!channel.settled, EscrowError::AlreadySettled);
        // No overdraw: the IOU can never exceed what was deposited.
        require!(
            cumulative_amount <= channel.deposit_amount,
            EscrowError::Overdraw
        );

        // Reconstruct the exact 40 bytes the agent signed off-chain and verify
        // the signature against the channel owner's key. brine-ed25519 performs
        // the curve25519 verification at runtime, so the dynamic amount is fine.
        let mut message = [0u8; 40];
        message[..32].copy_from_slice(&channel.channel_id);
        message[32..].copy_from_slice(&cumulative_amount.to_le_bytes());
        brine_ed25519::sig_verify(&channel.agent.to_bytes(), &signature, &message)
            .map_err(|_| error!(EscrowError::InvalidSignature))?;

        let refund_amount = channel
            .deposit_amount
            .checked_sub(cumulative_amount)
            .ok_or(EscrowError::MathOverflow)?;

        // The vault authority is the channel PDA, so it signs CPI transfers.
        let agent_key = channel.agent;
        let channel_id = channel.channel_id;
        let bump = channel.bump;
        let signer_seeds: &[&[&[u8]]] =
            &[&[b"channel", agent_key.as_ref(), channel_id.as_ref(), &[bump]]];

        // Provider receives the cumulative usage amount.
        if cumulative_amount > 0 {
            transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.key(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.provider_token_account.to_account_info(),
                        authority: ctx.accounts.channel.to_account_info(),
                    },
                    signer_seeds,
                ),
                cumulative_amount,
            )?;
        }

        // Agent is refunded the unused remainder.
        if refund_amount > 0 {
            transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.key(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.agent_token_account.to_account_info(),
                        authority: ctx.accounts.channel.to_account_info(),
                    },
                    signer_seeds,
                ),
                refund_amount,
            )?;
        }

        // Empty vault — close it and return its rent to the agent.
        close_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            CloseAccount {
                account: ctx.accounts.vault.to_account_info(),
                destination: ctx.accounts.agent.to_account_info(),
                authority: ctx.accounts.channel.to_account_info(),
            },
            signer_seeds,
        ))?;

        // Mark settled before the channel account is closed (defense in depth;
        // the `close` constraint reclaims the account regardless).
        ctx.accounts.channel.settled = true;

        Ok(())
    }

    /// CRASH SAFETY. After the timeout elapses with no settlement, the agent
    /// reclaims the entire deposit and the channel + vault are closed.
    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        let channel = &ctx.accounts.channel;
        require!(!channel.settled, EscrowError::AlreadySettled);

        let now = Clock::get()?.unix_timestamp;
        let deadline = channel
            .created_at
            .checked_add(channel.timeout_seconds)
            .ok_or(EscrowError::MathOverflow)?;
        require!(now >= deadline, EscrowError::TimeoutNotReached);

        let agent_key = channel.agent;
        let channel_id = channel.channel_id;
        let bump = channel.bump;
        let signer_seeds: &[&[&[u8]]] =
            &[&[b"channel", agent_key.as_ref(), channel_id.as_ref(), &[bump]]];

        let amount = ctx.accounts.vault.amount;
        if amount > 0 {
            transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.key(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.agent_token_account.to_account_info(),
                        authority: ctx.accounts.channel.to_account_info(),
                    },
                    signer_seeds,
                ),
                amount,
            )?;
        }

        close_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            CloseAccount {
                account: ctx.accounts.vault.to_account_info(),
                destination: ctx.accounts.agent.to_account_info(),
                authority: ctx.accounts.channel.to_account_info(),
            },
            signer_seeds,
        ))?;

        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct Channel {
    /// Channel owner; the key that signs IOUs.
    pub agent: Pubkey,
    /// Authority allowed to settle.
    pub gateway: Pubkey,
    /// Recipient of settled funds.
    pub provider: Pubkey,
    /// Total USDC locked (atomic, 6 decimals).
    pub deposit_amount: u64,
    /// Unique per channel; part of the PDA seeds and the signed IOU.
    pub channel_id: [u8; 32],
    /// Unix timestamp at open, for the timeout.
    pub created_at: i64,
    /// Refund timeout in seconds.
    pub timeout_seconds: i64,
    /// Single-settle guard.
    pub settled: bool,
    pub bump: u8,
}

#[derive(Accounts)]
#[instruction(channel_id: [u8; 32])]
pub struct OpenChannel<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    #[account(
        init,
        payer = agent,
        space = 8 + Channel::INIT_SPACE,
        seeds = [b"channel", agent.key().as_ref(), channel_id.as_ref()],
        bump
    )]
    pub channel: Account<'info, Channel>,

    pub usdc_mint: Account<'info, Mint>,

    /// Agent's USDC account funding the deposit. The ATA constraints pin both
    /// the mint and the owner.
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = agent,
    )]
    pub agent_token_account: Account<'info, TokenAccount>,

    /// Vault owned by the channel PDA. Created here.
    #[account(
        init,
        payer = agent,
        associated_token::mint = usdc_mint,
        associated_token::authority = channel,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    /// Only the channel's recorded gateway may settle. Marked `mut` because it
    /// is the rent payer for the `init_if_needed` provider/agent token accounts.
    #[account(mut)]
    pub gateway: Signer<'info>,

    #[account(
        mut,
        seeds = [b"channel", channel.agent.as_ref(), channel.channel_id.as_ref()],
        bump = channel.bump,
        has_one = gateway @ EscrowError::Unauthorized,
        has_one = provider @ EscrowError::ProviderMismatch,
        close = agent,
    )]
    pub channel: Account<'info, Channel>,

    /// Channel owner. Not a signer here; receives rent + refund. Pinned to
    /// `channel.agent` via the seeds and the token-account constraint below.
    #[account(mut, address = channel.agent @ EscrowError::AgentMismatch)]
    pub agent: SystemAccount<'info>,

    /// CHECK: pinned to `channel.provider` by the `has_one = provider` constraint
    /// above; only used to scope the provider's token account.
    pub provider: UncheckedAccount<'info>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = channel,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = gateway,
        associated_token::mint = usdc_mint,
        associated_token::authority = provider,
    )]
    pub provider_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = gateway,
        associated_token::mint = usdc_mint,
        associated_token::authority = agent,
    )]
    pub agent_token_account: Account<'info, TokenAccount>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    #[account(
        mut,
        seeds = [b"channel", agent.key().as_ref(), channel.channel_id.as_ref()],
        bump = channel.bump,
        has_one = agent @ EscrowError::Unauthorized,
        close = agent,
    )]
    pub channel: Account<'info, Channel>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = channel,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = agent,
        associated_token::mint = usdc_mint,
        associated_token::authority = agent,
    )]
    pub agent_token_account: Account<'info, TokenAccount>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum EscrowError {
    #[msg("Deposit amount must be greater than zero")]
    ZeroDeposit,
    #[msg("Timeout is outside the allowed bounds")]
    InvalidTimeout,
    #[msg("Channel has already been settled")]
    AlreadySettled,
    #[msg("Cumulative amount exceeds the deposit")]
    Overdraw,
    #[msg("IOU signature verification failed")]
    InvalidSignature,
    #[msg("Signer is not the authorized party for this action")]
    Unauthorized,
    #[msg("Provider account does not match the channel")]
    ProviderMismatch,
    #[msg("Agent account does not match the channel")]
    AgentMismatch,
    #[msg("Refund timeout has not yet been reached")]
    TimeoutNotReached,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
