import { Keypair, SorobanRpc, Networks } from '@stellar/stellar-sdk';
import { STELLAR_CONFIG } from './stellar-config';

export interface WalletAccount {
  publicKey: string;
  secretKey: string;
}

export interface AccountBalance {
  balance: string;
  xlmBalance: number;
}

const WALLET_STORAGE_KEY = 'stellar_wallet_keypair';

/**
 * Generate a new Stellar keypair
 */
export function generateKeypair(): WalletAccount {
  const keypair = Keypair.random();
  return {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
  };
}

/**
 * Store wallet keypair in localStorage
 * WARNING: This is for testnet development only. Never store mainnet keys in localStorage!
 */
export function storeWallet(wallet: WalletAccount): void {
  localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(wallet));
}

/**
 * Retrieve stored wallet from localStorage
 */
export function getStoredWallet(): WalletAccount | null {
  const stored = localStorage.getItem(WALLET_STORAGE_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as WalletAccount;
  } catch (error) {
    console.error('Failed to parse stored wallet:', error);
    return null;
  }
}

/**
 * Clear stored wallet from localStorage
 */
export function clearStoredWallet(): void {
  localStorage.removeItem(WALLET_STORAGE_KEY);
}

/**
 * Check if a wallet is stored
 */
export function hasStoredWallet(): boolean {
  return localStorage.getItem(WALLET_STORAGE_KEY) !== null;
}

/**
 * Fund account using Friendbot (testnet only)
 */
export async function fundWithFriendbot(publicKey: string): Promise<boolean> {
  try {
    const friendbotUrl = `${STELLAR_CONFIG.testnet.friendbotUrl}?addr=${encodeURIComponent(publicKey)}`;
    const response = await fetch(friendbotUrl);

    if (!response.ok) {
      throw new Error(`Friendbot request failed: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Friendbot funding successful:', result);
    return true;
  } catch (error) {
    console.error('Failed to fund account with Friendbot:', error);
    return false;
  }
}

/**
 * Get account balance using Horizon API
 */
export async function getAccountBalance(publicKey: string): Promise<AccountBalance | null> {
  try {
    const horizonUrl = `${STELLAR_CONFIG.testnet.horizonUrl}/accounts/${publicKey}`;
    const response = await fetch(horizonUrl);

    if (!response.ok) {
      if (response.status === 404) {
        // Account doesn't exist yet
        return null;
      }
      throw new Error(`Horizon request failed: ${response.statusText}`);
    }

    const account = await response.json();

    // Find XLM balance (native asset)
    const xlmBalance = account.balances.find(
      (balance: any) => balance.asset_type === 'native'
    );

    const balanceAmount = xlmBalance?.balance || '0';

    return {
      balance: balanceAmount,
      xlmBalance: parseFloat(balanceAmount),
    };
  } catch (error) {
    console.error('Failed to fetch account balance:', error);
    return null;
  }
}

/**
 * Check if account exists on Stellar network
 */
export async function accountExists(publicKey: string): Promise<boolean> {
  const balance = await getAccountBalance(publicKey);
  return balance !== null;
}

/**
 * Get account using Soroban RPC
 */
export async function getSorobanAccount(publicKey: string) {
  try {
    const server = new SorobanRpc.Server(STELLAR_CONFIG.testnet.rpcUrl);
    const account = await server.getAccount(publicKey);
    return account;
  } catch (error) {
    console.error('Failed to fetch Soroban account:', error);
    return null;
  }
}

/**
 * Create a new wallet and fund it with Friendbot
 */
export async function createAndFundWallet(): Promise<WalletAccount | null> {
  try {
    // Generate new keypair
    const wallet = generateKeypair();

    // Fund with Friendbot
    const funded = await fundWithFriendbot(wallet.publicKey);

    if (!funded) {
      throw new Error('Failed to fund account with Friendbot');
    }

    // Wait a bit for the account to be created
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify account exists
    const exists = await accountExists(wallet.publicKey);

    if (!exists) {
      throw new Error('Account was not created successfully');
    }

    // Store wallet
    storeWallet(wallet);

    return wallet;
  } catch (error) {
    console.error('Failed to create and fund wallet:', error);
    return null;
  }
}

/**
 * Import wallet from secret key
 */
export function importWallet(secretKey: string): WalletAccount | null {
  try {
    const keypair = Keypair.fromSecret(secretKey);
    const wallet: WalletAccount = {
      publicKey: keypair.publicKey(),
      secretKey: keypair.secret(),
    };

    storeWallet(wallet);
    return wallet;
  } catch (error) {
    console.error('Failed to import wallet:', error);
    return null;
  }
}

/**
 * Validate Stellar secret key format
 */
export function isValidSecretKey(secretKey: string): boolean {
  try {
    Keypair.fromSecret(secretKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate Stellar public key format
 */
export function isValidPublicKey(publicKey: string): boolean {
  try {
    // Try to create a Keypair and check if the public key matches
    return publicKey.startsWith('G') && publicKey.length === 56;
  } catch {
    return false;
  }
}

/**
 * Get Keypair instance from stored wallet
 */
export function getKeypairFromWallet(wallet: WalletAccount): Keypair {
  return Keypair.fromSecret(wallet.secretKey);
}

/**
 * Format public key for display (truncated)
 */
export function formatPublicKey(publicKey: string, chars: number = 4): string {
  if (publicKey.length <= chars * 2 + 3) {
    return publicKey;
  }
  return `${publicKey.slice(0, chars)}...${publicKey.slice(-chars)}`;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Get network passphrase for testnet
 */
export function getNetworkPassphrase(): string {
  return Networks.TESTNET;
}
