//! AgentPay Registry
//!
//! A permissionless on-chain catalog of API / DePIN / agent providers. Each
//! provider is stored in its own PDA derived from the owner and the provider
//! name, so anyone can register, the owner alone can mutate or remove it, and a
//! designated gateway authority can bump the usage counter.

use anchor_lang::prelude::*;

declare_id!("XGXadfKb7mru5wcr1yUZWSeBLVUY6NFDAriBUUMiLbk");

/// Maximum length (in bytes) of a provider name. Also bounds the PDA seed.
pub const MAX_NAME_LEN: usize = 50;

#[program]
pub mod registry {
    use super::*;

    /// Register a new provider. Permissionless: anyone can list a service.
    /// The signer pays rent and becomes the owner.
    pub fn register_provider(
        ctx: Context<RegisterProvider>,
        name: String,
        endpoint_hash: [u8; 32],
        price_usdc: u64,
        category: u8,
        agent_type: u8,
        provider_wallet: Pubkey,
        gateway_authority: Pubkey,
    ) -> Result<()> {
        require!(!name.is_empty(), RegistryError::NameEmpty);
        require!(name.len() <= MAX_NAME_LEN, RegistryError::NameTooLong);
        require!(price_usdc > 0, RegistryError::InvalidPrice);
        require!(
            category <= Category::MAX,
            RegistryError::InvalidCategory
        );
        require!(
            agent_type <= AgentType::MAX,
            RegistryError::InvalidAgentType
        );

        let provider = &mut ctx.accounts.provider;
        provider.owner = ctx.accounts.owner.key();
        provider.name = name;
        provider.endpoint_hash = endpoint_hash;
        provider.price_usdc = price_usdc;
        provider.category = category;
        provider.agent_type = agent_type;
        provider.provider_wallet = provider_wallet;
        provider.gateway_authority = gateway_authority;
        provider.total_calls = 0;
        provider.active = true;
        provider.bump = ctx.bumps.provider;

        Ok(())
    }

    /// Update price and/or active flag. Owner only.
    pub fn update_provider(
        ctx: Context<UpdateProvider>,
        new_price: Option<u64>,
        active: Option<bool>,
    ) -> Result<()> {
        let provider = &mut ctx.accounts.provider;

        if let Some(price) = new_price {
            require!(price > 0, RegistryError::InvalidPrice);
            provider.price_usdc = price;
        }

        if let Some(is_active) = active {
            provider.active = is_active;
        }

        Ok(())
    }

    /// Increment the lifetime call counter. Restricted to the gateway authority
    /// recorded on the provider account, so usage metering can't be forged.
    pub fn increment_call_count(ctx: Context<IncrementCallCount>) -> Result<()> {
        let provider = &mut ctx.accounts.provider;
        provider.total_calls = provider
            .total_calls
            .checked_add(1)
            .ok_or(RegistryError::MathOverflow)?;
        Ok(())
    }

    /// Remove a provider and reclaim rent. Owner only.
    pub fn deregister_provider(_ctx: Context<DeregisterProvider>) -> Result<()> {
        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct ApiProvider {
    pub owner: Pubkey,
    #[max_len(50)] // keep in sync with MAX_NAME_LEN
    pub name: String,
    pub endpoint_hash: [u8; 32],
    pub price_usdc: u64,
    pub category: u8,
    pub agent_type: u8,
    pub provider_wallet: Pubkey,
    /// Authority allowed to call `increment_call_count`.
    pub gateway_authority: Pubkey,
    pub total_calls: u64,
    pub active: bool,
    pub bump: u8,
}

/// Service category. Stored as `u8`; `MAX` guards the valid range.
#[repr(u8)]
pub enum Category {
    Weather = 0,
    Mapping = 1,
    Network = 2,
    Compute = 3,
    Agent = 4,
}

impl Category {
    pub const MAX: u8 = Category::Agent as u8;
}

/// Provider classification. Stored as `u8`; `MAX` guards the valid range.
#[repr(u8)]
pub enum AgentType {
    Api = 0,
    Agent = 1,
    Depin = 2,
}

impl AgentType {
    pub const MAX: u8 = AgentType::Depin as u8;
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct RegisterProvider<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + ApiProvider::INIT_SPACE,
        seeds = [b"provider", owner.key().as_ref(), name.as_bytes()],
        bump
    )]
    pub provider: Account<'info, ApiProvider>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateProvider<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"provider", owner.key().as_ref(), provider.name.as_bytes()],
        bump = provider.bump,
        has_one = owner @ RegistryError::Unauthorized,
    )]
    pub provider: Account<'info, ApiProvider>,
}

#[derive(Accounts)]
pub struct IncrementCallCount<'info> {
    pub gateway_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"provider", provider.owner.as_ref(), provider.name.as_bytes()],
        bump = provider.bump,
        constraint = provider.gateway_authority == gateway_authority.key() @ RegistryError::Unauthorized,
    )]
    pub provider: Account<'info, ApiProvider>,
}

#[derive(Accounts)]
pub struct DeregisterProvider<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"provider", owner.key().as_ref(), provider.name.as_bytes()],
        bump = provider.bump,
        has_one = owner @ RegistryError::Unauthorized,
        close = owner,
    )]
    pub provider: Account<'info, ApiProvider>,
}

#[error_code]
pub enum RegistryError {
    #[msg("Provider name must not be empty")]
    NameEmpty,
    #[msg("Provider name exceeds the maximum length")]
    NameTooLong,
    #[msg("Price must be greater than zero")]
    InvalidPrice,
    #[msg("Category is out of range")]
    InvalidCategory,
    #[msg("Agent type is out of range")]
    InvalidAgentType,
    #[msg("Signer is not authorized for this action")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
