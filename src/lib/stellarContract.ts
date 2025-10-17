import { ABIMethod } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export interface InvokeResponse {
  success: boolean;
  result?: any;
  transactionHash?: string;
  logs?: string[];
  fee?: string;
  error?: string;
  rawOutput?: string;
  gasUsed?: string;
  rawResponse?: any;
}

/**
 * Execute a Stellar/Soroban smart contract method through the backend
 */
export async function executeStellarMethod(
  contractAddress: string,
  method: ABIMethod,
  inputs: Record<string, string>
): Promise<InvokeResponse> {
  try {
    // Determine method type based on stateMutability or name patterns
    let methodType = 'view';

    if (method.stateMutability === 'nonpayable' || method.stateMutability === 'payable') {
      methodType = 'call';
    } else if (method.stateMutability === 'view') {
      methodType = 'view';
    } else {
      // Use name-based heuristics as fallback for Stellar contracts
      const methodName = (method.name || '').toLowerCase();

      // State-changing method patterns
      if (methodName.startsWith('set') ||
          methodName.startsWith('update') ||
          methodName.startsWith('increment') ||
          methodName.startsWith('decrement') ||
          methodName.startsWith('reset') ||
          methodName.startsWith('add') ||
          methodName.startsWith('remove') ||
          methodName.startsWith('delete') ||
          methodName.startsWith('transfer') ||
          methodName.startsWith('approve') ||
          methodName.startsWith('mint') ||
          methodName.startsWith('burn') ||
          methodName.startsWith('create') ||
          methodName.startsWith('init')) {
        methodType = 'call';
      }
      // View method patterns
      else if (methodName.startsWith('get') ||
               methodName.startsWith('view') ||
               methodName.startsWith('read') ||
               methodName.startsWith('is') ||
               methodName.startsWith('has') ||
               methodName.includes('balance') ||
               methodName.includes('allowance')) {
        methodType = 'view';
      }
    }

    const response = await fetch(`${API_URL}/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contract_id: contractAddress,
        method_name: method.name,
        args: inputs,
        method_type: methodType,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to execute method',
        rawResponse: data,
      };
    }

    // Backend wraps response in ApiResponse.data structure
    const invokeData = data.data || data;

    return {
      success: invokeData.success,
      result: invokeData.result,
      transactionHash: invokeData.transaction_hash,
      logs: invokeData.logs || [],
      fee: invokeData.fee,
      error: invokeData.error,
      rawOutput: invokeData.raw_output,
      gasUsed: invokeData.gas_used,
      rawResponse: data,
    };
  } catch (error) {
    console.error('Error executing Stellar method:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Get a user-friendly label for the method type
 */
export function getMethodTypeLabel(method: ABIMethod): string {
  if (method.stateMutability === 'view') {
    return 'view';
  } else if (method.stateMutability === 'nonpayable') {
    return 'call';
  } else if (method.stateMutability === 'payable') {
    return 'payable';
  }

  // Fallback to name-based detection for Stellar contracts
  const methodName = (method.name || '').toLowerCase();

  // Check for view patterns
  if (methodName.startsWith('get') ||
      methodName.startsWith('view') ||
      methodName.startsWith('read') ||
      methodName.startsWith('is') ||
      methodName.startsWith('has') ||
      methodName.includes('balance') ||
      methodName.includes('allowance')) {
    return 'view';
  }

  // Default to call for state-changing operations
  return 'call';
}

