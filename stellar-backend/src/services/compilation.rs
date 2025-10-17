use anyhow::{Context, Result};
use log::{debug, info, warn};
use serde_json;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::Instant;

use crate::models::{CompileDetails, CompileResponse};
use crate::utils::copy_dir_all;

pub async fn compile_contract(
    code: &str,
    user_id: &str,
    project_id: &str,
) -> Result<CompileResponse> {
    let start_time = Instant::now();

    // Use persistent project directory structure
    let base_project_path = PathBuf::from("base_project");
    let user_projects_dir = PathBuf::from("projects").join(user_id);
    let project_path = user_projects_dir.join(project_id);

    info!(
        "Starting compilation for project {} in persistent directory: {:?}",
        project_id, project_path
    );

    // Ensure the project exists (copy from base if needed)
    setup_user_project(&base_project_path, &project_path, code)?;

    // Run stellar contract build
    let compile_result = run_stellar_build(&project_path)?;

    let compilation_time = start_time.elapsed().as_secs_f64();

    // Extract WASM file size and contract spec
    let (wasm_size, spec) = extract_compilation_artifacts(&project_path)?;

    let response = CompileResponse {
        success: compile_result.status.success(),
        exit_code: compile_result.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&compile_result.stdout).to_string(),
        stderr: String::from_utf8_lossy(&compile_result.stderr).to_string(),
        details: CompileDetails {
            status: if compile_result.status.success() {
                "success".to_string()
            } else {
                "failed".to_string()
            },
            compilation_time,
            project_path: project_path.to_string_lossy().to_string(),
            wasm_size,
            optimized: true, // stellar contract build optimizes by default
        },
        spec,
    };

    info!(
        "Compilation completed for project {} in {:.2}s",
        project_id, compilation_time
    );

    Ok(response)
}

fn setup_user_project(base_project_path: &PathBuf, project_path: &PathBuf, code: &str) -> Result<()> {
    // Check if user project already exists
    if !project_path.exists() {
        info!("Creating new project by copying base project workspace template");

        // Create parent directory
        if let Some(parent) = project_path.parent() {
            fs::create_dir_all(parent).context("Failed to create user projects directory")?;
        }

        // Copy entire base project workspace
        copy_dir_all(base_project_path, project_path)
            .context("Failed to copy base project template")?;

        debug!("Base project workspace copied to: {:?}", project_path);
    }

    // Always update lib.rs with user's code in the workspace contract
    // New Stellar CLI structure uses workspace with contracts/hello-world/src/lib.rs
    let lib_rs_path = project_path
        .join("contracts")
        .join("hello-world")
        .join("src")
        .join("lib.rs");

    fs::write(&lib_rs_path, code)
        .context("Failed to write user contract code")?;

    debug!("Updated contracts/hello-world/src/lib.rs with user code");
    Ok(())
}

fn run_stellar_build(project_path: &PathBuf) -> Result<std::process::Output> {
    debug!("Running stellar contract build in workspace directory: {:?}", project_path);

    // Ensure both wasm32 targets are installed
    // wasm32v1-none is required by Stellar CLI 23.x+
    let rustup_result = Command::new("rustup")
        .arg("target")
        .arg("add")
        .arg("wasm32v1-none")
        .output();

    if let Ok(output) = rustup_result {
        if !output.status.success() {
            warn!("Failed to add wasm32v1-none target, but continuing...");
        }
    }

    // Also add wasm32-unknown-unknown for backward compatibility
    let _ = Command::new("rustup")
        .arg("target")
        .arg("add")
        .arg("wasm32-unknown-unknown")
        .output();

    // Run stellar contract build
    let output = Command::new("stellar")
        .arg("contract")
        .arg("build")
        .current_dir(project_path)
        .output()
        .context("Failed to execute stellar contract build. Make sure 'stellar' CLI is installed.")?;

    debug!(
        "stellar contract build completed with exit code: {:?}",
        output.status.code()
    );

    Ok(output)
}

fn extract_compilation_artifacts(project_path: &PathBuf) -> Result<(Option<u64>, Option<serde_json::Value>)> {
    // Look for WASM file in target/wasm32v1-none/release directory
    // Stellar CLI 23.x uses wasm32v1-none target instead of wasm32-unknown-unknown
    let release_dir = project_path
        .join("target")
        .join("wasm32v1-none")
        .join("release");

    let wasm_size = if release_dir.exists() {
        // Find .wasm files
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

        if let Some(wasm_file) = wasm_files.first() {
            info!("Found WASM file: {:?}", wasm_file);
            fs::metadata(wasm_file)
                .map(|metadata| metadata.len())
                .ok()
        } else {
            warn!("No WASM file found in release directory");
            None
        }
    } else {
        warn!("Release directory not found");
        None
    };

    // Extract contract spec using stellar contract inspect
    let spec = if let Some(wasm_path) = find_wasm_file(&release_dir) {
        match extract_contract_spec(&wasm_path) {
            Ok(spec_json) => Some(spec_json),
            Err(e) => {
                warn!("Failed to extract contract spec: {}", e);
                None
            }
        }
    } else {
        None
    };

    Ok((wasm_size, spec))
}

fn find_wasm_file(dir: &PathBuf) -> Option<PathBuf> {
    if !dir.exists() {
        return None;
    }

    fs::read_dir(dir).ok()?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.extension()? == "wasm" {
                Some(path)
            } else {
                None
            }
        })
        .next()
}

fn extract_contract_spec(wasm_path: &PathBuf) -> Result<serde_json::Value> {
    info!("Extracting contract spec from: {:?}", wasm_path);

    // Use stellar contract inspect to get the spec
    let output = Command::new("stellar")
        .arg("contract")
        .arg("bindings")
        .arg("json")
        .arg("--wasm")
        .arg(wasm_path)
        .output()
        .context("Failed to execute stellar contract bindings")?;

    if !output.status.success() {
        return Err(anyhow::anyhow!(
            "stellar contract bindings failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let spec_str = String::from_utf8_lossy(&output.stdout);
    let spec: serde_json::Value = serde_json::from_str(&spec_str)
        .context("Failed to parse contract spec JSON")?;

    info!("Successfully extracted contract spec");
    Ok(spec)
}
