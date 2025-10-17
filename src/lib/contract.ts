// Utility functions for Stellar/Soroban contract interaction
// These functions complement the main execution in stellarContract.ts

export interface StellarContractConfig {
  contractId: string;
  methods?: string[];
}

export interface StellarExecuteOptions {
  methodName: string;
  args: Record<string, any>;
  sourceAccount?: string;
}

/**
 * Helper function to get Stellar network configuration
 */
export function getStellarNetworkConfig() {
  return {
    network: import.meta.env.VITE_STELLAR_NETWORK || 'testnet',
    rpcUrl: import.meta.env.VITE_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
    horizonUrl: import.meta.env.VITE_STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
  };
}

/**
 * Helper function to validate a Stellar contract ID
 */
export function isValidContractId(contractId: string): boolean {
  // Stellar contract IDs are 56-character base32 strings
  const contractIdPattern = /^[A-Z2-7]{56}$/;
  return contractIdPattern.test(contractId);
}

/**
 * Helper function to validate a Stellar account ID
 */
export function isValidAccountId(accountId: string): boolean {
  // Stellar account IDs start with G and are 56 characters
  const accountIdPattern = /^G[A-Z2-7]{55}$/;
  return accountIdPattern.test(accountId);
}

export function formatValue(value: any, type: string): any {
  if (value === null || value === undefined) return value;

  try {
    // Handle basic types for Stellar/Soroban
    if (type === 'string' || type === 'String') {
      return value.toString();
    }

    if (type === 'number' || type === 'u32' || type === 'u64' || type === 'u128' || type === 'i32' || type === 'i64' || type === 'i128') {
      return value.toString();
    }

    if (type === 'bool' || type === 'boolean') {
      return value;
    }

    if (type === 'Address' || type === 'AccountId') {
      return value;
    }

    if (type === 'Bytes' || type === 'BytesN') {
      return value;
    }

    return value;
  } catch (error) {
    console.error('Error formatting Stellar value:', error);
    return value;
  }
}

export function parseValue(value: string, type: string): any {
  if (!value) {
    return null;
  }

  try {
    // Handle numeric types
    if (type === 'number' || type === 'u32' || type === 'u64' || type === 'u128' ||
        type === 'i32' || type === 'i64' || type === 'i128') {
      return parseInt(value);
    }

    // Handle boolean
    if (type === 'bool' || type === 'boolean') {
      const lowered = value.toLowerCase();
      if (lowered !== 'true' && lowered !== 'false') {
        throw new Error(`Invalid boolean value: ${value}`);
      }
      return lowered === 'true';
    }

    // Handle Stellar Address (Contract or Account)
    if (type === 'Address' || type === 'AccountId') {
      // Stellar addresses are 56 characters starting with G (accounts) or C (contracts)
      if (!value.match(/^[GC][A-Z2-7]{55}$/)) {
        throw new Error(`Invalid Stellar address format: ${value}`);
      }
      return value;
    }

    // Handle String types
    if (type === 'string' || type === 'String') {
      return value;
    }

    // Handle Bytes types
    if (type === 'Bytes' || type === 'BytesN') {
      // For now, pass through - could add hex validation
      return value;
    }

    return value;
  } catch (error) {
    throw new Error(`Error parsing ${type} value: ${error.message}`);
  }
}