use anyhow::{Context, Result};
use log::{info, warn, error};
use std::fs;
use std::path::PathBuf;
use std::env;
use std::process::Command;
use crate::models::{DeployDetails, DeployResponse};
use chrono::Utc;

pub async fn deploy_contract(
    user_id: &str,
    project_id: &str,
    _account_secret: Option<&str>,
) -> Result<DeployResponse> {
    info!(
        "Starting Stellar deployment for project {} by user {}",
        project_id, user_id
    );

    // Load Stellar account credentials from environment
    let deployer_secret = env::var("STELLAR_SECRET_KEY")
        .context("STELLAR_SECRET_KEY not found in environment")?;
    let rpc_url = env::var("STELLAR_RPC_URL")
        .context("STELLAR_RPC_URL not found in environment")?;
    let network_passphrase = env::var("STELLAR_NETWORK_PASSPHRASE")
        .context("STELLAR_NETWORK_PASSPHRASE not found in environment")?;
    let network = env::var("STELLAR_NETWORK").unwrap_or_else(|_| "testnet".to_string());

    // Find the project directory
    let project_path = PathBuf::from("projects").join(user_id).join(project_id);
    if !project_path.exists() {
        return Err(anyhow::anyhow!("Project directory not found: {:?}", project_path));
    }

    // Find the compiled WASM file
    // Stellar CLI 23.x uses wasm32v1-none target
    let release_dir = project_path
        .join("target")
        .join("wasm32v1-none")
        .join("release");

    let wasm_files: Vec<_> = fs::read_dir(&release_dir)
        .context("Failed to read release directory")?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.extension()? == "wasm" {
                Some(path)
            } else {
                None
            }
        })
        .collect();

    if wasm_files.is_empty() {
        return Err(anyhow::anyhow!("No WASM file found. Please compile the project first."));
    }

    let wasm_path = &wasm_files[0];
    info!("Deploying WASM file: {:?}", wasm_path);

    // Deploy using stellar CLI with explicit RPC URL and network passphrase
    // Use --verbose to get transaction hash in stderr output
    let mut cmd = Command::new("stellar");
    cmd.arg("--verbose")
        .arg("contract")
        .arg("deploy")
        .arg("--wasm")
        .arg(wasm_path)
        .arg("--source")
        .arg(&deployer_secret)
        .arg("--rpc-url")
        .arg(&rpc_url)
        .arg("--network-passphrase")
        .arg(&network_passphrase);

    let deploy_output = cmd
        .output()
        .context("Failed to execute stellar contract deploy")?;

    // Log full output for debugging
    let stdout_str = String::from_utf8_lossy(&deploy_output.stdout);
    let stderr_str = String::from_utf8_lossy(&deploy_output.stderr);
    info!("Deploy stdout: {}", stdout_str);
    info!("Deploy stderr: {}", stderr_str);

    if !deploy_output.status.success() {
        error!("Deployment failed: {}", stderr_str);
        return Err(anyhow::anyhow!("Deployment failed: {}", stderr_str));
    }

    // Helper function to extract transaction hash from Stellar CLI verbose output
    fn extract_transaction_hash(stderr: &str) -> Option<String> {
        // Stellar CLI outputs transaction hash in various formats:
        // - "transaction hash: <hash>"
        // - "Transaction hash is <hash>"
        // - May include emoji characters before/after
        for line in stderr.lines() {
            let line_lower = line.to_lowercase();
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
        }
        None
    }

    // Parse the contract ID from output
    // Stellar CLI outputs the contract ID as the last line of stdout
    let contract_id = stdout_str
        .lines()
        .filter(|line| !line.trim().is_empty())
        .last()
        .context("No contract ID in deployment output")?
        .trim()
        .to_string();

    info!("Parsed contract ID: {}", contract_id);

    // Validate contract ID format (should start with 'C' and be 56 chars)
    if !contract_id.starts_with('C') || contract_id.len() != 56 {
        warn!("Contract ID format looks suspicious: {}", contract_id);
        warn!("Expected format: C followed by 55 characters (StrKey contract encoding)");
    }

    info!("Contract deployed successfully: {}", contract_id);

    // Get deployer address (public key from secret key)
    let deployer_address = get_public_key_from_secret(&deployer_secret)?;

    // Extract real transaction hash from Stellar CLI verbose output
    let transaction_hash = extract_transaction_hash(&stderr_str)
        .context("Failed to extract transaction hash from deployment output. This suggests the deployment may not have succeeded on-chain.")?;

    info!("Transaction hash: {}", transaction_hash);

    let timestamp = Utc::now();
    let explorer_url = format!(
        "https://testnet.stellarchain.io/contracts/{}",
        contract_id
    );

    // Create proof-of-deployment transaction (optional, small payment)
    let proof_tx_hash = send_proof_transfer(&deployer_secret, &network).await.ok();

    let response = DeployResponse {
        success: true,
        transaction_hash: transaction_hash.clone(),
        contract_id: contract_id.clone(),
        explorer_url,
        fee: Some("100000".to_string()), // Approximate fee in stroops
        proof_tx_hash,
        details: DeployDetails {
            network: network.clone(),
            ledger_sequence: 0, // Would need to query the network for this
            timestamp,
            deployer_address,
        },
    };

    info!(
        "Successfully deployed contract {} for project {}",
        contract_id, project_id
    );

    Ok(response)
}

fn get_public_key_from_secret(secret_key: &str) -> Result<String> {
    // Use stellar CLI to derive public key from secret
    let output = Command::new("stellar")
        .arg("keys")
        .arg("address")
        .arg(secret_key)
        .output()
        .context("Failed to get public key from secret")?;

    if !output.status.success() {
        return Err(anyhow::anyhow!("Failed to derive public key"));
    }

    let address = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(address)
}

async fn send_proof_transfer(source_secret: &str, network: &str) -> Result<String> {
    // Send a small proof-of-deployment transaction
    // This is optional and helps track deployments
    info!("Sending proof-of-deployment transaction");

    let destination = env::var("STELLAR_PROOF_DESTINATION")
        .unwrap_or_else(|_| source_secret.to_string()); // Send to self if no destination

    let output = Command::new("stellar")
        .arg("contract")
        .arg("invoke")
        .arg("--source")
        .arg(source_secret)
        .arg("--network")
        .arg(network)
        .arg("--id")
        .arg(&destination)
        .output();

    match output {
        Ok(result) if result.status.success() => {
            let tx_hash = String::from_utf8_lossy(&result.stdout).trim().to_string();
            Ok(tx_hash)
        }
        _ => {
            warn!("Proof transfer failed, but continuing...");
            Err(anyhow::anyhow!("Proof transfer failed"))
        }
    }
}
