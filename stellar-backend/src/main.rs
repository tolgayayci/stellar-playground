use actix_cors::Cors;
use actix_web::{middleware::Logger, web, App, HttpServer};
use env_logger::Env;
use log::{info, error};
use std::path::Path;
use std::process::Command;
use std::env;

mod handlers;
mod models;
mod services;
mod utils;

use handlers::{compile_handler, deploy_handler, health_handler, invoke_handler};

async fn initialize_base_project() -> std::io::Result<()> {
    let base_project_path = Path::new("base_project");

    if !base_project_path.exists() {
        info!("Base project not found, creating it...");

        // The base_project should already exist from our setup
        // If not, we'd need to initialize a new Soroban contract
        error!("Base project directory not found! Please ensure base_project/ exists.");
        return Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "Base project not found"
        ));
    }

    // Check if stellar CLI is installed
    let stellar_check = Command::new("stellar")
        .arg("--version")
        .output();

    match stellar_check {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout);
            info!("Stellar CLI found: {}", version.trim());
        }
        _ => {
            error!("Stellar CLI not found! Please install it with: cargo install --locked stellar-cli");
            return Err(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "Stellar CLI not installed"
            ));
        }
    }

    // Ensure both wasm32 targets are installed
    // wasm32v1-none is required by Stellar CLI 23.x+
    // wasm32-unknown-unknown is kept for backward compatibility
    info!("Checking Rust wasm32 targets...");
    let _ = Command::new("rustup")
        .args(&["target", "add", "wasm32v1-none"])
        .output();
    let _ = Command::new("rustup")
        .args(&["target", "add", "wasm32-unknown-unknown"])
        .output();

    info!("Base project initialized and Stellar CLI verified");

    Ok(())
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Load environment variables from .env file
    dotenv::dotenv().ok();

    env_logger::Builder::from_env(Env::default().default_filter_or("info")).init();

    info!("Starting Stellar Playground Backend Server");

    // Initialize base project on startup
    initialize_base_project().await?;

    // Get host and port from environment variables
    let host = env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let bind_address = format!("{}:{}", host, port);

    info!("Starting Stellar Playground Backend on {}", bind_address);

    HttpServer::new(|| {
        let cors = Cors::default()
            .allowed_origin("https://stellarplay.app")
            .allowed_origin("https://www.stellarplay.app")
            .allowed_origin("http://localhost:5173")
            .allow_any_method()
            .allowed_headers(vec![
                actix_web::http::header::AUTHORIZATION,
                actix_web::http::header::CONTENT_TYPE,
                actix_web::http::header::ACCEPT,
            ])
            .expose_headers(vec![
                actix_web::http::header::CONTENT_TYPE,
            ])
            .max_age(3600)
            .supports_credentials();

        App::new()
            .wrap(cors)
            .wrap(Logger::default())
            .route("/health", web::get().to(health_handler))
            .route("/compile", web::post().to(compile_handler))
            .route("/deploy", web::post().to(deploy_handler))
            .route("/invoke", web::post().to(invoke_handler))
    })
    .bind(&bind_address)?
    .run()
    .await
}
