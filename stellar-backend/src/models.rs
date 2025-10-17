use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

// Request Models
#[derive(Debug, Deserialize)]
pub struct CompileRequest {
    pub user_id: String,
    pub project_id: String,
    pub code: String,
}

#[derive(Debug, Deserialize)]
pub struct DeployRequest {
    pub user_id: String,
    pub project_id: String,
    pub account_secret: Option<String>, // Optional - we can use default account
}

#[derive(Debug, Deserialize)]
pub struct InvokeRequest {
    pub contract_id: String,
    pub method_name: String,
    pub args: serde_json::Value, // JSON args
    pub method_type: String, // "view" or "call"
    pub source_account: Option<String>, // Optional - for signing transactions
}

// Response Models
#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub message: String,
    pub data: Option<T>,
    pub error: Option<ApiError>,
}

#[derive(Debug, Serialize)]
pub struct ApiError {
    pub code: String,
    pub message: String,
    pub details: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CompileResponse {
    pub success: bool,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub details: CompileDetails,
    pub spec: Option<serde_json::Value>, // Contract spec (like ABI)
}

#[derive(Debug, Serialize)]
pub struct CompileDetails {
    pub status: String,
    pub compilation_time: f64,
    pub project_path: String,
    pub wasm_size: Option<u64>,
    pub optimized: bool,
}

#[derive(Debug, Serialize)]
pub struct DeployResponse {
    pub success: bool,
    pub transaction_hash: String,
    pub contract_id: String,
    pub explorer_url: String,
    pub fee: Option<String>,
    pub proof_tx_hash: Option<String>,
    pub details: DeployDetails,
}

#[derive(Debug, Serialize)]
pub struct DeployDetails {
    pub network: String,
    pub ledger_sequence: u32,
    pub timestamp: DateTime<Utc>,
    pub deployer_address: String,
}

#[derive(Debug, Serialize)]
pub struct InvokeResponse {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub transaction_hash: Option<String>,
    pub logs: Vec<String>,
    pub fee: Option<String>,
    pub error: Option<String>,
    pub raw_output: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            message: "Success".to_string(),
            data: Some(data),
            error: None,
        }
    }

    pub fn error(code: &str, message: &str, details: Option<String>) -> ApiResponse<()> {
        ApiResponse {
            success: false,
            message: message.to_string(),
            data: None,
            error: Some(ApiError {
                code: code.to_string(),
                message: message.to_string(),
                details,
            }),
        }
    }
}
