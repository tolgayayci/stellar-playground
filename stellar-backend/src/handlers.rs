use actix_web::{web, HttpResponse, Responder};
use log::{error, info};

use crate::models::{ApiResponse, CompileRequest, DeployRequest, InvokeRequest};
use crate::services::{compilation, deployment, invocation};

pub async fn health_handler() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "stellar-playground-backend",
        "version": "0.1.0"
    }))
}

pub async fn compile_handler(req: web::Json<CompileRequest>) -> impl Responder {
    info!(
        "Received compile request for project {} by user {}",
        req.project_id, req.user_id
    );

    match compilation::compile_contract(&req.code, &req.user_id, &req.project_id).await {
        Ok(result) => {
            info!(
                "Compilation completed for project {}: {}",
                req.project_id,
                if result.success { "success" } else { "failed" }
            );
            HttpResponse::Ok().json(ApiResponse::success(result))
        }
        Err(e) => {
            error!("Compilation error for project {}: {}", req.project_id, e);
            HttpResponse::InternalServerError().json(ApiResponse::<()>::error(
                "COMPILATION_ERROR",
                "Failed to compile contract",
                Some(e.to_string()),
            ))
        }
    }
}

pub async fn deploy_handler(req: web::Json<DeployRequest>) -> impl Responder {
    info!(
        "Received deploy request for project {} by user {}",
        req.project_id, req.user_id
    );

    match deployment::deploy_contract(
        &req.user_id,
        &req.project_id,
        req.account_secret.as_deref(),
    )
    .await
    {
        Ok(result) => {
            info!(
                "Deployment completed for project {}: contract_id={}",
                req.project_id, result.contract_id
            );
            HttpResponse::Ok().json(ApiResponse::success(result))
        }
        Err(e) => {
            error!("Deployment error for project {}: {}", req.project_id, e);
            HttpResponse::InternalServerError().json(ApiResponse::<()>::error(
                "DEPLOYMENT_ERROR",
                "Failed to deploy contract",
                Some(e.to_string()),
            ))
        }
    }
}

pub async fn invoke_handler(req: web::Json<InvokeRequest>) -> impl Responder {
    info!(
        "Received invoke request for contract {} method {}",
        req.contract_id, req.method_name
    );

    match invocation::invoke_contract(
        &req.contract_id,
        &req.method_name,
        &req.args,
        &req.method_type,
        req.source_account.as_deref(),
    )
    .await
    {
        Ok(result) => {
            if result.success {
                info!(
                    "Contract invocation successful: contract={}, method={}",
                    req.contract_id, req.method_name
                );
            } else {
                error!(
                    "Contract invocation failed: contract={}, method={}, error={:?}",
                    req.contract_id, req.method_name, result.error
                );
            }
            HttpResponse::Ok().json(ApiResponse::success(result))
        }
        Err(e) => {
            error!(
                "Invocation error for contract {} method {}: {}",
                req.contract_id, req.method_name, e
            );
            HttpResponse::InternalServerError().json(ApiResponse::<()>::error(
                "INVOCATION_ERROR",
                "Failed to invoke contract method",
                Some(e.to_string()),
            ))
        }
    }
}
