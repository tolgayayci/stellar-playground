use anyhow::{Context, Result};
use log::{info, error, warn};
use std::process::Command;
use std::env;
use crate::models::InvokeResponse;

pub async fn invoke_contract(
    contract_id: &str,
    method_name: &str,
    args: &serde_json::Value,
    method_type: &str,
    source_account: Option<&str>,
) -> Result<InvokeResponse> {
    info!(
        "Invoking contract {} method {} with type {}",
        contract_id, method_name, method_type
    );

    // Load Stellar RPC configuration from environment
    let rpc_url = env::var("STELLAR_RPC_URL")
        .context("STELLAR_RPC_URL not found in environment")?;
    let network_passphrase = env::var("STELLAR_NETWORK_PASSPHRASE")
        .context("STELLAR_NETWORK_PASSPHRASE not found in environment")?;

    // Get source account (use env var if not provided)
    let source_secret = source_account
        .map(|s| s.to_string())
        .or_else(|| env::var("STELLAR_SECRET_KEY").ok())
        .context("No source account provided and STELLAR_SECRET_KEY not found")?;

    // Determine send mode based on method type
    // view methods: --send=no (simulation only, no transaction)
    // call methods: --send=yes (create actual transaction)
    let is_view = method_type == "view";
    let send_mode = if is_view { "no" } else { "yes" };

    info!("Method type: {}, send mode: {}", method_type, send_mode);

    // Build the invocation command with explicit RPC URL and network passphrase
    let mut cmd = Command::new("stellar");
    cmd.arg("contract")
        .arg("invoke")
        .arg("--id")
        .arg(contract_id)
        .arg("--source")
        .arg(&source_secret)
        .arg("--rpc-url")
        .arg(&rpc_url)
        .arg("--network-passphrase")
        .arg(&network_passphrase)
        .arg("--send")
        .arg(send_mode);

    // Add --verbose for call methods to get transaction hash
    if !is_view {
        cmd.arg("--verbose");
    }

    cmd.arg("--")
        .arg(method_name);

    // Add arguments
    // Parse JSON args and convert to CLI arguments
    if let Some(args_obj) = args.as_object() {
        for (key, value) in args_obj {
            cmd.arg(format!("--{}", key));

            // Convert JSON value to string argument
            let arg_str = match value {
                serde_json::Value::String(s) => s.clone(),
                serde_json::Value::Number(n) => n.to_string(),
                serde_json::Value::Bool(b) => b.to_string(),
                serde_json::Value::Array(_) => serde_json::to_string(value)?,
                serde_json::Value::Object(_) => serde_json::to_string(value)?,
                serde_json::Value::Null => "null".to_string(),
            };

            cmd.arg(arg_str);
        }
    } else if let Some(args_array) = args.as_array() {
        // If args is an array, pass them as positional arguments
        for value in args_array {
            let arg_str = match value {
                serde_json::Value::String(s) => s.clone(),
                serde_json::Value::Number(n) => n.to_string(),
                serde_json::Value::Bool(b) => b.to_string(),
                _ => serde_json::to_string(value)?,
            };
            cmd.arg(arg_str);
        }
    }

    // Log the full command for debugging
    let cmd_str = format!("{:?}", cmd);
    info!("Executing stellar CLI command: {}", cmd_str);

    // Execute the command
    let output = cmd
        .output()
        .context("Failed to execute stellar contract invoke")?;

    // Log full output for debugging
    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let stderr_str = String::from_utf8_lossy(&output.stderr);
    info!("Invoke stdout: {}", stdout_str);
    info!("Invoke stderr: {}", stderr_str);

    // Helper function to extract transaction hash from Stellar CLI verbose output
    fn extract_transaction_hash(stderr: &str) -> Option<String> {
        // Stellar CLI outputs transaction hash in various formats:
        // - "transaction hash: <hash>"
        // - "Transaction hash is <hash>"
        // - "Signing transaction: <hash>"
        // - May include emoji characters before/after
        for line in stderr.lines() {
            let line_lower = line.to_lowercase();

            // Check for "transaction hash" pattern
            if line_lower.contains("transaction hash") {
                // Find the position after "transaction hash" phrase
                if let Some(pos) = line_lower.find("transaction hash") {
                    let after_phrase = &line[pos + 16..]; // Skip "transaction hash"
                    // Extract the hash - it's a 64-character hex string
                    for word in after_phrase.split_whitespace() {
                        let cleaned = word.trim_matches(|c: char| !c.is_ascii_hexdigit());
                        if cleaned.len() == 64 && cleaned.chars().all(|c| c.is_ascii_hexdigit()) {
                            return Some(cleaned.to_string());
                        }
                    }
                }
            }

            // Check for "signing transaction:" pattern (common in invoke output)
            if line_lower.contains("signing transaction:") {
                // Find the position after "signing transaction:" phrase
                if let Some(pos) = line_lower.find("signing transaction:") {
                    let after_phrase = &line[pos + 20..]; // Skip "signing transaction:"
                    // Extract the hash - it's a 64-character hex string
                    for word in after_phrase.split_whitespace() {
                        let cleaned = word.trim_matches(|c: char| !c.is_ascii_hexdigit());
                        if cleaned.len() == 64 && cleaned.chars().all(|c| c.is_ascii_hexdigit()) {
                            return Some(cleaned.to_string());
                        }
                    }
                }
            }
        }
        None
    }

    // Parse the result
    if output.status.success() {
        let result_str = String::from_utf8_lossy(&output.stdout);
        let result: serde_json::Value = serde_json::from_str(result_str.trim())
            .unwrap_or_else(|_| serde_json::Value::String(result_str.trim().to_string()));

        info!("Contract invocation successful");

        // Extract transaction hash for call methods (view methods don't have one)
        let transaction_hash = if !is_view {
            extract_transaction_hash(&stderr_str).or_else(|| {
                warn!("Could not extract transaction hash from call method output");
                None
            })
        } else {
            None
        };

        if let Some(ref hash) = transaction_hash {
            info!("Transaction hash: {}", hash);
        }

        Ok(InvokeResponse {
            success: true,
            result: Some(result),
            transaction_hash,
            logs: vec![],
            fee: None, // TODO: Extract real fee from output
            error: None,
            raw_output: Some(stdout_str.to_string()),
        })
    } else {
        let error_msg = String::from_utf8_lossy(&output.stderr).to_string();
        error!("Contract invocation failed: {}", error_msg);

        Ok(InvokeResponse {
            success: false,
            result: None,
            transaction_hash: None,
            logs: vec![],
            fee: None,
            error: Some(error_msg.clone()),
            raw_output: Some(error_msg),
        })
    }
}
