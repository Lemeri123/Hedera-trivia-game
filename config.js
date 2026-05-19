// config.js — environment validation and config loading
export function loadConfig() {
  const required = [
    'HEDERA_ACCOUNT_ID',
    'HEDERA_PRIVATE_KEY',
    'GROQ_API_KEY',
    'PRIZE_POOL_ACCOUNT_ID',
  ];

  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing required environment variable: ${key}`);
      process.exit(1);
    }
  }

  const entryFeeHbar = Number(process.env.ENTRY_FEE_HBAR) || 1;
  const payoutMultiplier = Number(process.env.PAYOUT_MULTIPLIER) || 2;

  return {
    operatorAccountId: process.env.HEDERA_ACCOUNT_ID,
    operatorPrivateKey: process.env.HEDERA_PRIVATE_KEY,
    network: process.env.HEDERA_NETWORK || 'testnet',
    groqApiKey: process.env.GROQ_API_KEY,
    prizePoolAccountId: process.env.PRIZE_POOL_ACCOUNT_ID,
    prizePoolPrivateKey: process.env.PRIZE_POOL_PRIVATE_KEY || null,
    entryFeeHbar,
    payoutMultiplier,
    payoutHbar: entryFeeHbar * payoutMultiplier,
  };
}
