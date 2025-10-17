import axios from 'axios';
import { CompilationResult, DeploymentResult, MethodCallResult } from './types';
import { API_URL } from './stellar-config';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${import.meta.env.VITE_API_KEY}`
  },
});

interface CompileRequest {
  user_id: string;
  project_id: string;
  code: string;
}

interface DeployRequest {
  user_id: string;
  project_id: string;
  account_secret?: string;
}

interface MethodCallRequest {
  contract_id: string; // Match backend InvokeRequest model
  method_name: string;
  args: any;
  method_type: 'view' | 'call';
  source_account?: string;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  error: {
    code: string;
    message: string;
    details: string | null;
  } | null;
}

interface CompileResponse {
  success: boolean;
  exit_code: number;
  stdout: string;
  stderr: string;
  details: {
    status: string;
    compilation_time: number;
    project_path: string;
  };
  spec: any | null; // Backend sends 'spec', we map it to 'abi' in CompilationResult
}

/**
 * Compile a Stellar/Soroban smart contract
 */
export async function compileContract(
  code: string,
  userId: string,
  projectId: string
): Promise<CompilationResult> {
  try {
    const payload: CompileRequest = {
      user_id: userId,
      project_id: projectId,
      code,
    };

    const { data: response } = await api.post<ApiResponse<CompileResponse>>('/compile', payload);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Compilation failed');
    }

    return {
      success: response.data.success,
      exit_code: response.data.exit_code,
      stdout: response.data.stdout,
      stderr: response.data.stderr,
      details: {
        status: response.data.details.status,
        compilation_time: response.data.details.compilation_time,
        project_path: response.data.details.project_path,
        wasm_size: response.data.details.wasm_size,
        optimized: response.data.details.optimized,
      },
      abi: response.data.spec || [], // Stellar uses 'spec' instead of 'abi'
      code_snapshot: code,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const apiError = error.response.data as ApiResponse<any>;
      throw new Error(apiError.error?.message || 'Failed to compile contract');
    }
    throw error instanceof Error
      ? error
      : new Error('Failed to compile contract');
  }
}

/**
 * Deploy a compiled contract to Stellar Testnet
 */
export async function deployContract(
  userId: string,
  projectId: string,
  accountSecret?: string
): Promise<DeploymentResult> {
  try {
    const payload: DeployRequest = {
      user_id: userId,
      project_id: projectId,
      account_secret: accountSecret,
    };

    const { data: response } = await api.post<ApiResponse<DeploymentResult>>('/deploy', payload);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Deployment failed');
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const apiError = error.response.data as ApiResponse<any>;
      throw new Error(apiError.error?.message || 'Failed to deploy contract');
    }
    throw error instanceof Error
      ? error
      : new Error('Failed to deploy contract');
  }
}

/**
 * Invoke a method on a deployed Stellar contract
 */
export async function invokeContractMethod(
  contractId: string,
  methodName: string,
  args: any,
  methodType: 'view' | 'call',
  sourceAccount?: string
): Promise<MethodCallResult> {
  try {
    const payload: MethodCallRequest = {
      contract_id: contractId, // Match backend InvokeRequest field name
      method_name: methodName,
      args,
      method_type: methodType,
      source_account: sourceAccount,
    };

    const { data: response } = await api.post<ApiResponse<MethodCallResult>>('/invoke', payload);

    // Always return the data, even if backend marks it as "failed"
    // Let the frontend handle error detection from the actual result
    if (response.data) {
      return response.data;
    }

    // If no data but we have an error response, create a MethodCallResult with the error
    return {
      success: false,
      error: response.error?.message || 'Method invocation failed',
      logs: [],
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const apiError = error.response.data as ApiResponse<any>;

      // If we have data in the error response, return it
      if (apiError.data) {
        return apiError.data;
      }

      // Otherwise create an error result
      return {
        success: false,
        error: apiError.error?.message || 'Failed to invoke contract method',
        logs: [],
      };
    }

    // Network or other errors
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to invoke contract method',
      logs: [],
    };
  }
}

// Backwards compatibility alias
export const callContractMethod = invokeContractMethod;