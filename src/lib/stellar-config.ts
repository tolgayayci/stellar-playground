// API Configuration
export const API_URL = import.meta.env.VITE_API_URL;

// Stellar Network Configuration
export const STELLAR_CONFIG = {
  testnet: {
    networkPassphrase: import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015",
    rpcUrl: import.meta.env.VITE_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org",
    horizonUrl: import.meta.env.VITE_STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org",
    friendbotUrl: import.meta.env.VITE_STELLAR_FRIENDBOT_URL || "https://friendbot.stellar.org",
    explorerUrl: import.meta.env.VITE_STELLAR_EXPLORER_URL || "https://testnet.stellarchain.io",
    name: "Stellar Testnet",
  },
} as const;

// Analytics Configuration
export const GA_TRACKING_ID = import.meta.env.VITE_GA_TRACKING_ID;

// Application URLs
export const APP_URLS = {
  base: import.meta.env.VITE_APP_URL,
  docs: import.meta.env.VITE_DOCS_URL || "https://developers.stellar.org",
  telegram: import.meta.env.VITE_TELEGRAM_URL,
  discord: import.meta.env.VITE_DISCORD_URL,
} as const;

// Services
export const SERVICES = {
  avatar: import.meta.env.VITE_AVATAR_SERVICE_URL,
} as const;

// Supabase Configuration
export const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
} as const;

// Helper function to get Stellar Explorer URL for transaction
export function getExplorerTxUrl(txHash: string): string {
  return `${STELLAR_CONFIG.testnet.explorerUrl}/transactions/${txHash}`;
}

// Helper function to get Stellar Explorer URL for account
export function getExplorerAccountUrl(address: string): string {
  return `${STELLAR_CONFIG.testnet.explorerUrl}/accounts/${address}`;
}

// Helper function to get Stellar Explorer URL for contract
export function getExplorerContractUrl(contractId: string): string {
  return `${STELLAR_CONFIG.testnet.explorerUrl}/contracts/${contractId}`;
}

// Helper function to get avatar URL
export function getAvatarUrl(seed: string): string {
  return `${SERVICES.avatar}/${seed}`;
}

// Helper function to format Stellar XLM amount (stroops to XLM)
export function formatXLMAmount(stroops: string | number): string {
  const xlmAmount = Number(stroops) / 10_000_000; // 1 XLM = 10,000,000 stroops
  return xlmAmount.toFixed(7);
}

// Helper function to convert XLM to stroops
export function xlmToStroops(xlm: string | number): string {
  const stroops = Number(xlm) * 10_000_000;
  return stroops.toString();
}
