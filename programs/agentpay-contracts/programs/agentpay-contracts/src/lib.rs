use anchor_lang::prelude::*;

declare_id!("DxtBFwg7sLRHaWBgnxE2HLrG7A1yKPQTBZ8He13wAVdt");

#[program]
pub mod agentpay_contracts {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
