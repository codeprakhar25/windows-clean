#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::VecDeque;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const DEFAULT_OPENAI_MODEL: &str = "gpt-5.2";
const DEFAULT_OPENAI_ENDPOINT: &str = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_REASONING_EFFORT: &str = "low";

#[cfg(target_os = "windows")]
use std::ffi::OsStr;
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScanRequest {
    protected_paths: Vec<String>,
    include_project_artifacts: bool,
    max_depth: Option<usize>,
    max_entries_per_root: Option<usize>,
    target_drive: Option<String>,
    custom_roots: Vec<String>,
}

impl Default for ScanRequest {
    fn default() -> Self {
        Self {
            protected_paths: Vec::new(),
            include_project_artifacts: true,
            max_depth: Some(8),
            max_entries_per_root: Some(25_000),
            target_drive: Some("C:".to_string()),
            custom_roots: Vec::new(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanResponse {
    available: bool,
    mode: &'static str,
    platform: String,
    windows: bool,
    target_drive: String,
    generated_at: String,
    volume: Option<VolumeInfo>,
    total_bytes: u64,
    findings: Vec<ScanFinding>,
    drive_inventory: Vec<DriveInventoryEntry>,
    warnings: Vec<String>,
    write_capability: bool,
    destructive_commands: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct VolumeInfo {
    drive: String,
    total_bytes: u64,
    used_bytes: u64,
    free_bytes: u64,
    source: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanFinding {
    recipe_id: String,
    title: String,
    path: String,
    bytes: u64,
    status: String,
    files: u64,
    dirs: u64,
    errors: u64,
    note: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    metadata_sources: Option<ScanFindingMetadataSources>,
    #[serde(skip_serializing_if = "Option::is_none")]
    evidence_summary: Option<ScanFindingEvidenceSummary>,
    items: Vec<ScanItem>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanFindingMetadataSources {
    uninstall_registry: String,
    user_assist: String,
    uninstall_registry_rows: u64,
    user_assist_rows: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanFindingEvidenceSummary {
    candidate_count: u64,
    registry_matched: u64,
    user_assist_matched: u64,
    usage_proof_missing: u64,
    manual_only: bool,
    can_create_executor: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanItem {
    id: String,
    name: String,
    path: String,
    bytes: u64,
    age_days: u64,
    kind: String,
    recommendation: String,
    reason: String,
    signals: Vec<ScanSignal>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanSignal {
    label: String,
    value: String,
    tone: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DriveInventoryEntry {
    id: String,
    name: String,
    path: String,
    bytes: u64,
    status: String,
    files: u64,
    dirs: u64,
    errors: u64,
    kind: String,
    classification: String,
    can_create_executor: bool,
    note: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WriteExecutionRequest {
    schema_version: Option<String>,
    request_mode: Option<String>,
    plan_id: String,
    route: String,
    scan_fingerprint: Option<String>,
    consent_plan_id: Option<String>,
    expected_bytes: Option<u64>,
    dry_run_only: Option<bool>,
    mutation_attempted: Option<bool>,
    permanent_removal_confirmed: Option<bool>,
    archive_destination: Option<String>,
    actions: Vec<WriteExecutionAction>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WriteExecutionAction {
    id: String,
    title: String,
    bytes: u64,
    route: String,
    target_path: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProofArtifactWriteRequest {
    file_name: String,
    content: String,
    route: Option<String>,
    proof_kind: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProofArtifactWriteResponse {
    schema_version: &'static str,
    available: bool,
    written: bool,
    file_name: String,
    path: String,
    bytes: u64,
    reason: String,
    warnings: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WriteExecutionResponse {
    mode: &'static str,
    real_run_enabled: bool,
    destructive_commands: bool,
    accepted: bool,
    reason: String,
    contract_echo: WriteContractEcho,
    executor_scaffold: Option<WriteExecutorScaffold>,
    entries: Vec<WriteExecutionEntry>,
    volume_proof: WriteVolumeProof,
    warnings: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WriteVolumeProof {
    status: String,
    drive: String,
    before: Option<VolumeInfo>,
    after: Option<VolumeInfo>,
    free_bytes_delta: i64,
    source: String,
    note: String,
}

struct WriteVolumeProbe {
    attempted: bool,
    drive: String,
    before: Option<VolumeInfo>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WriteExecutorScaffold {
    route: String,
    title: String,
    feature_flag: String,
    status: String,
    validation_status: String,
    mutation_enabled: bool,
    reason: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WriteContractEcho {
    schema_version: String,
    request_mode: String,
    plan_id: String,
    route: String,
    scan_fingerprint: String,
    consent_plan_id: String,
    expected_bytes: u64,
    dry_run_only: bool,
    mutation_attempted: bool,
    action_count: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WriteExecutionEntry {
    id: String,
    title: String,
    route: String,
    result: String,
    reject_code: String,
    bytes: u64,
    preflight_status: String,
    preflight_checks: Vec<WritePreflightCheck>,
    note: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WritePreflightCheck {
    id: String,
    label: String,
    status: String,
    detail: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeCapabilities {
    mode: &'static str,
    platform: String,
    windows: bool,
    elevated: bool,
    elevation_source: &'static str,
    real_run_enabled: bool,
    destructive_commands: bool,
    scan_known_roots: bool,
    execute_cleanup_plan: bool,
    openai_agent_advice: bool,
    openai_advisor_configured: bool,
    openai_key_source: String,
    safe_executors_enabled: bool,
    enabled_scoped_executor_flags: Vec<&'static str>,
    enabled_scoped_executor_flag_count: usize,
    executor_scope_status: &'static str,
    executor_flags: ExecutorFeatureFlags,
    reason: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExecutorFeatureFlags {
    temp_cleanup_executor: bool,
    project_dependency_executor: bool,
    downloads_cleanup_executor: bool,
    large_file_archive_executor: bool,
    gradle_cache_executor: bool,
    user_cache_executor: bool,
    android_cache_executor: bool,
    shader_cache_executor: bool,
    pip_cache_executor: bool,
    npm_cache_executor: bool,
    pnpm_store_executor: bool,
    recycle_bin_executor: bool,
    browser_cache_executor: bool,
    tool_native_prune_executors: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OpenAIAgentAdviceRequest {
    user_prompt: Option<String>,
    context: Value,
    model: Option<String>,
    reasoning_effort: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenAIAgentAdviceResponse {
    schema_version: &'static str,
    provider: &'static str,
    model: String,
    request_id: String,
    created_at: String,
    raw_text: String,
    advice: Value,
    response_id: String,
    key_source: String,
    transport: &'static str,
    warnings: Vec<String>,
}

#[derive(Clone, Copy)]
enum MeasureKind {
    FullTree,
    DownloadInstallers,
    LargeUserFiles,
    InstalledAppFootprints,
}

struct ExactSpec {
    recipe_id: &'static str,
    title: &'static str,
    path: PathBuf,
    kind: MeasureKind,
}

#[derive(Default)]
struct SizeStats {
    bytes: u64,
    files: u64,
    dirs: u64,
    errors: u64,
    limited: bool,
}

#[derive(Clone, Debug, Default)]
struct InstalledAppMetadata {
    display_name: String,
    publisher: String,
    display_version: String,
    install_location: String,
    install_date: String,
    estimated_bytes: u64,
    uninstall_available: bool,
}

#[derive(Clone, Debug, Default)]
struct InstalledAppUsageEvidence {
    source: &'static str,
    match_label: String,
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            scan_known_roots,
            execute_cleanup_plan,
            write_proof_artifact,
            openai_agent_advice,
            runtime_capabilities
        ])
        .run(tauri::generate_context!())
        .expect("failed to run SpaceGuard");
}

#[tauri::command]
fn scan_known_roots(request: Option<ScanRequest>) -> ScanResponse {
    let request = request.unwrap_or_default();
    let mut warnings = Vec::new();
    let target_drive = resolve_target_drive(&request, &mut warnings);

    if !cfg!(target_os = "windows") {
        warnings.push(
            "This scanner is intended for Windows. Non-Windows runs are for development only."
                .to_string(),
        );
    }

    let mut findings = Vec::new();

    for spec in exact_specs(&target_drive) {
        findings.push(measure_path(
            spec.recipe_id,
            spec.title,
            &spec.path,
            spec.kind,
            &request,
        ));
    }

    findings.extend(measure_android_studio_roots(&request));
    findings.extend(measure_shader_cache_roots(&request));
    findings.extend(measure_pip_cache_roots(&request));
    findings.extend(measure_browser_cache_roots(&request));
    findings.extend(measure_wsl_vhdx_roots(&request));
    findings.push(measure_installed_app_footprints(
        &target_drive,
        &request,
        &mut warnings,
    ));

    if request.include_project_artifacts {
        findings.extend(measure_node_modules_roots(&request, &mut warnings));
    }

    findings.extend(measure_custom_roots(&request, &mut warnings));

    findings.push(measure_docker_build_cache());
    findings.push(unsupported_finding(
        "docker-volumes",
        "Docker anonymous volumes",
        "Docker Desktop volumes",
        "Policy-blocked because volumes can contain databases and application state.",
    ));
    findings.push(unsupported_finding(
        "browser-identity",
        "Browser cookies, sessions, saved logins",
        "Browser profile identity stores",
        "Policy-blocked. Identity stores are not scanned.",
    ));
    findings.push(unsupported_finding(
        "partitioning",
        "Partition resize or move strategy",
        "Disk Management",
        "Advisory only. Partition operations are not automated.",
    ));

    let drive_inventory = measure_drive_inventory(&target_drive, &request, &mut warnings);
    let total_bytes = findings
        .iter()
        .filter(|finding| finding.status == "measured" || finding.status == "limited")
        .map(|finding| finding.bytes)
        .sum();

    ScanResponse {
        available: true,
        mode: "native-readonly",
        platform: env::consts::OS.to_string(),
        windows: cfg!(target_os = "windows"),
        target_drive: target_drive.clone(),
        generated_at: generated_at(),
        volume: primary_volume_info(&target_drive),
        total_bytes,
        findings,
        drive_inventory,
        warnings,
        write_capability: false,
        destructive_commands: false,
    }
}

#[tauri::command]
async fn openai_agent_advice(
    request: Option<OpenAIAgentAdviceRequest>,
) -> Result<OpenAIAgentAdviceResponse, String> {
    let request = request.ok_or_else(|| "OpenAI advisor request is missing.".to_string())?;
    let context_schema = request
        .context
        .get("schemaVersion")
        .and_then(Value::as_str)
        .unwrap_or("");
    if context_schema != "spaceguard-openai-agent-context/v1" {
        return Err("OpenAI advisor requires a SpaceGuard context packet.".to_string());
    }

    let (api_key, key_source) = openai_env_value(&["OPENAI_API_KEY", "VITE_OPENAI_API_KEY"])
        .ok_or_else(|| {
            "Set OPENAI_API_KEY in .env or the Tauri process environment.".to_string()
        })?;
    let model = openai_env_value(&["OPENAI_MODEL", "VITE_OPENAI_MODEL"])
        .map(|(value, _)| value)
        .or_else(|| request.model.filter(|value| !value.trim().is_empty()))
        .unwrap_or_else(|| DEFAULT_OPENAI_MODEL.to_string());
    let endpoint = openai_env_value(&["OPENAI_BASE_URL", "VITE_OPENAI_BASE_URL"])
        .map(|(value, _)| value)
        .unwrap_or_else(|| DEFAULT_OPENAI_ENDPOINT.to_string());
    let reasoning_input =
        openai_env_value(&["OPENAI_REASONING_EFFORT", "VITE_OPENAI_REASONING_EFFORT"])
            .map(|(value, _)| value)
            .or_else(|| {
                request
                    .reasoning_effort
                    .filter(|value| !value.trim().is_empty())
            })
            .unwrap_or_else(|| DEFAULT_OPENAI_REASONING_EFFORT.to_string());
    let reasoning_effort = normalize_openai_reasoning_effort(&reasoning_input);

    let input_text = serde_json::to_string_pretty(&json!({
        "userPrompt": request.user_prompt.unwrap_or_else(|| "Find the fastest safe path to recover space from this scan.".to_string()),
        "context": request.context
    }))
    .map_err(|error| format!("OpenAI context serialization failed: {error}"))?;

    let mut body = json!({
        "model": model,
        "store": false,
        "text": {
            "format": openai_response_format()
        },
        "instructions": [
            "You are the SpaceGuard local Windows cleanup advisor.",
            "You never claim you scanned the computer yourself; you only interpret the provided app context.",
            "You cannot approve gates, modify files, run shell commands, or delete data.",
            "Manual review targets such as installed app footprints, custom roots, and broad drive inventory rows are advisory only; never recommend direct folder deletion or automated uninstall.",
            "Use context.agentTaskQueue.rows as the primary task list. When recommending one of those tasks, copy its actionType, targetId, and route exactly.",
            "When context.liveRouteValidation is present, treat it as the selected live route contract and do not recommend a different executor route until its proof is complete.",
            "When a scoped executor is visible, recommend the exact UI button only after the context says current consent and route-specific targets exist.",
            "If execution.proofAllowsNextExecutor is false, recommend post-run rescan or proof review instead of another executor.",
            "Use execution.consentMatchesPlan, execution.scanFingerprintPresent, and execution.proofStatus when explaining blockers.",
            "Use actionType values from the schema. Keep targetId empty unless you are referring to a provided target id.",
            "Prioritize concrete next steps that move toward real safe cleanup.",
            "Return structured JSON that matches the provided response schema."
        ].join(" "),
        "input": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": input_text
                    }
                ]
            }
        ],
        "max_output_tokens": 1200
    });
    if reasoning_effort != "default" {
        if let Some(body_object) = body.as_object_mut() {
            body_object.insert(
                "reasoning".to_string(),
                json!({ "effort": reasoning_effort }),
            );
        }
    }

    let response = reqwest::Client::new()
        .post(&endpoint)
        .bearer_auth(api_key)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|error| format!("OpenAI request failed: {error}"))?;
    let status = response.status();
    let request_id = response
        .headers()
        .get("x-request-id")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();
    let payload = response
        .json::<Value>()
        .await
        .map_err(|error| format!("OpenAI response parse failed: {error}"))?;
    if !status.is_success() {
        let message = payload
            .get("error")
            .and_then(|error| error.get("message"))
            .and_then(Value::as_str)
            .or_else(|| payload.get("message").and_then(Value::as_str))
            .unwrap_or("OpenAI request failed.");
        return Err(if request_id.is_empty() {
            format!("{message} HTTP {status}.")
        } else {
            format!("{message} HTTP {status}. Request id: {request_id}")
        });
    }

    let raw_text = extract_openai_response_text(&payload);
    let advice = parse_openai_advice(&raw_text);
    let model = payload
        .get("model")
        .and_then(Value::as_str)
        .unwrap_or(DEFAULT_OPENAI_MODEL)
        .to_string();
    let response_id = payload
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();

    Ok(OpenAIAgentAdviceResponse {
        schema_version: "spaceguard-openai-agent-advice/v1",
        provider: "openai",
        model,
        request_id,
        created_at: generated_at(),
        raw_text,
        advice,
        response_id,
        key_source,
        transport: "native-tauri",
        warnings: vec!["OpenAI advice is advisory only; native executors still require explicit user action, consent, feature flags, and target validation.".to_string()],
    })
}

#[tauri::command]
fn execute_cleanup_plan(request: Option<WriteExecutionRequest>) -> WriteExecutionResponse {
    let request = request.unwrap_or(WriteExecutionRequest {
        schema_version: None,
        request_mode: None,
        plan_id: String::new(),
        route: String::new(),
        scan_fingerprint: None,
        consent_plan_id: None,
        expected_bytes: None,
        dry_run_only: Some(true),
        mutation_attempted: Some(false),
        permanent_removal_confirmed: Some(false),
        archive_destination: None,
        actions: Vec::new(),
    });
    if real_write_request_attempted(&request) {
        let enabled_flags = enabled_scoped_executor_flags_on_windows();
        if enabled_flags.len() > 1 {
            return reject_multiple_scoped_executor_flags(&request, &enabled_flags);
        }
    }
    let volume_probe = start_write_volume_probe(&request);
    if request.request_mode.as_deref() == Some("execute-first-safe") {
        return finalize_write_volume_proof(execute_first_safe_temp_cleanup(request), volume_probe);
    }
    if request.request_mode.as_deref() == Some("execute-project-deps") {
        return finalize_write_volume_proof(
            execute_project_dependency_cleanup(request),
            volume_probe,
        );
    }
    if request.request_mode.as_deref() == Some("execute-downloads-recycle-bin") {
        return finalize_write_volume_proof(
            execute_downloads_review_cleanup(request),
            volume_probe,
        );
    }
    if request.request_mode.as_deref() == Some("execute-large-file-archive") {
        return finalize_write_volume_proof(
            execute_large_file_archive_cleanup(request),
            volume_probe,
        );
    }
    if request.request_mode.as_deref() == Some("execute-browser-cache") {
        return finalize_write_volume_proof(execute_browser_cache_cleanup(request), volume_probe);
    }
    if request.request_mode.as_deref() == Some("execute-gradle-cache") {
        return finalize_write_volume_proof(execute_gradle_cache_cleanup(request), volume_probe);
    }
    if request.request_mode.as_deref() == Some("execute-user-cache") {
        return finalize_write_volume_proof(execute_user_cache_cleanup(request), volume_probe);
    }
    if request.request_mode.as_deref() == Some("execute-android-cache") {
        return finalize_write_volume_proof(execute_android_cache_cleanup(request), volume_probe);
    }
    if request.request_mode.as_deref() == Some("execute-shader-cache") {
        return finalize_write_volume_proof(execute_shader_cache_cleanup(request), volume_probe);
    }
    if request.request_mode.as_deref() == Some("execute-pip-cache") {
        return finalize_write_volume_proof(execute_pip_cache_cleanup(request), volume_probe);
    }
    if request.request_mode.as_deref() == Some("execute-docker-build-cache") {
        return finalize_write_volume_proof(
            execute_docker_build_cache_cleanup(request),
            volume_probe,
        );
    }
    if request.request_mode.as_deref() == Some("execute-npm-cache") {
        return finalize_write_volume_proof(execute_npm_cache_cleanup(request), volume_probe);
    }
    if request.request_mode.as_deref() == Some("execute-pnpm-store") {
        return finalize_write_volume_proof(execute_pnpm_store_cleanup(request), volume_probe);
    }
    if request.request_mode.as_deref() == Some("execute-recycle-bin") {
        return finalize_write_volume_proof(execute_recycle_bin_cleanup(request), volume_probe);
    }
    let route = request.route.clone();
    let plan_id = request.plan_id.clone();
    let expected_bytes = request
        .expected_bytes
        .unwrap_or_else(|| request.actions.iter().map(|action| action.bytes).sum());
    let boundary_rejections = write_boundary_rejections(&request);
    let executor_scaffold = write_executor_scaffold(&route);
    let contract_echo = WriteContractEcho {
        schema_version: request
            .schema_version
            .unwrap_or_else(|| "spaceguard-write-boundary-request/v1".to_string()),
        request_mode: request
            .request_mode
            .unwrap_or_else(|| "capsule-probe".to_string()),
        plan_id: plan_id.clone(),
        route: route.clone(),
        scan_fingerprint: request.scan_fingerprint.unwrap_or_default(),
        consent_plan_id: request.consent_plan_id.unwrap_or_default(),
        expected_bytes,
        dry_run_only: request.dry_run_only.unwrap_or(true),
        mutation_attempted: request.mutation_attempted.unwrap_or(false),
        action_count: request.actions.len(),
    };
    let entries = request
        .actions
        .into_iter()
        .map(|action| {
            let requested_bytes = action.bytes;
            let reject_code =
                write_action_reject_code(&action, &route, &boundary_rejections).to_string();
            let preflight = write_action_preflight(&action, &route, &boundary_rejections, &reject_code);
            WriteExecutionEntry {
                id: action.id,
                title: action.title,
                route: action.route,
                result: "rejected".to_string(),
                reject_code: reject_code.clone(),
                bytes: 0,
                preflight_status: preflight.0,
                preflight_checks: preflight.1,
                note: format!(
                    "Rejected by native write boundary with code {reject_code}. Route {route}, plan {plan_id}, requested {requested_bytes} byte(s); write execution is disabled."
                ),
            }
        })
        .collect::<Vec<_>>();
    let mut warnings =
        vec!["No filesystem mutation was attempted by execute_cleanup_plan.".to_string()];
    warnings.extend(
        boundary_rejections
            .iter()
            .map(|code| write_boundary_warning(code).to_string()),
    );
    if let Some(scaffold) = &executor_scaffold {
        warnings.push(format!(
            "{} scaffold is present but disabled behind {} until Windows validation evidence and release gates pass.",
            scaffold.title, scaffold.feature_flag
        ));
    }

    let response = WriteExecutionResponse {
        mode: "native-write-rejected",
        real_run_enabled: false,
        destructive_commands: false,
        accepted: false,
        reason: if boundary_rejections.is_empty() {
            "Native write boundary validated the request shape and rejected it because real cleanup is disabled.".to_string()
        } else {
            "Native write boundary rejected the request shape before any executor could run."
                .to_string()
        },
        contract_echo,
        executor_scaffold,
        entries,
        volume_proof: write_volume_proof_not_collected(
            "not-collected",
            "",
            "Volume proof is collected only around scoped real executor dispatch.",
        ),
        warnings,
    };
    finalize_write_volume_proof(response, volume_probe)
}

fn real_write_request_attempted(request: &WriteExecutionRequest) -> bool {
    request.dry_run_only == Some(false) || request.mutation_attempted == Some(true)
}

#[tauri::command]
fn write_proof_artifact(request: Option<ProofArtifactWriteRequest>) -> ProofArtifactWriteResponse {
    let request = request.unwrap_or(ProofArtifactWriteRequest {
        file_name: String::new(),
        content: String::new(),
        route: None,
        proof_kind: None,
    });
    let file_name = request.file_name.trim().to_string();
    if !allowed_proof_artifact_file_name(&file_name) {
        return ProofArtifactWriteResponse {
            schema_version: "spaceguard-proof-artifact-write/v1",
            available: true,
            written: false,
            file_name,
            path: String::new(),
            bytes: 0,
            reason: "proof-artifact-file-not-allowed".to_string(),
            warnings: vec![
                "Proof artifact writes are restricted to SpaceGuard runner proof file names."
                    .to_string(),
            ],
        };
    }

    let working_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let artifact_path = working_dir.join(&file_name);
    match fs::write(&artifact_path, request.content.as_bytes()) {
        Ok(()) => ProofArtifactWriteResponse {
            schema_version: "spaceguard-proof-artifact-write/v1",
            available: true,
            written: true,
            file_name,
            path: path_to_string(&artifact_path),
            bytes: request.content.as_bytes().len() as u64,
            reason: "proof-artifact-written".to_string(),
            warnings: proof_artifact_write_warnings(&request),
        },
        Err(error) => ProofArtifactWriteResponse {
            schema_version: "spaceguard-proof-artifact-write/v1",
            available: true,
            written: false,
            file_name,
            path: path_to_string(&artifact_path),
            bytes: 0,
            reason: format!("proof-artifact-write-failed: {error}"),
            warnings: proof_artifact_write_warnings(&request),
        },
    }
}

fn allowed_proof_artifact_file_name(file_name: &str) -> bool {
    matches!(
        file_name,
        "spaceguard-selected-route-proof-packet.md"
            | "spaceguard-real-workflow-proof.md"
            | "spaceguard-workflow-proof-check.json"
            | "spaceguard-support-bundle.md"
    )
}

fn proof_artifact_write_warnings(request: &ProofArtifactWriteRequest) -> Vec<String> {
    let mut warnings = vec![
        "Native proof artifact writes are restricted to the proof runner working directory."
            .to_string(),
    ];
    if let Some(route) = request
        .route
        .as_ref()
        .filter(|value| !value.trim().is_empty())
    {
        warnings.push(format!("Route binding: {route}."));
    }
    if let Some(proof_kind) = request
        .proof_kind
        .as_ref()
        .filter(|value| !value.trim().is_empty())
    {
        warnings.push(format!("Proof kind: {proof_kind}."));
    }
    warnings
}

fn start_write_volume_probe(request: &WriteExecutionRequest) -> WriteVolumeProbe {
    let attempted = real_write_request_attempted(request);
    let drive = write_request_volume_drive(request);
    let before = if attempted {
        primary_volume_info(&drive)
    } else {
        None
    };
    WriteVolumeProbe {
        attempted,
        drive,
        before,
    }
}

fn finalize_write_volume_proof(
    mut response: WriteExecutionResponse,
    probe: WriteVolumeProbe,
) -> WriteExecutionResponse {
    response.volume_proof = if !probe.attempted {
        write_volume_proof_not_collected(
            "not-collected-dry-run",
            &probe.drive,
            "Volume proof is collected only for mutating native executor requests.",
        )
    } else if !response.accepted {
        write_volume_proof_not_collected(
            "not-collected-rejected",
            &probe.drive,
            "The native executor rejected the request before accepted mutation, so no before/after free-space proof was claimed.",
        )
    } else if let Some(before) = probe.before {
        let drive = before.drive.clone();
        if let Some(after) = primary_volume_info(&drive) {
            let delta = write_volume_free_bytes_delta(before.free_bytes, after.free_bytes);
            WriteVolumeProof {
                status: "measured".to_string(),
                drive,
                before: Some(before),
                after: Some(after),
                free_bytes_delta: delta,
                source: "GetDiskFreeSpaceExW".to_string(),
                note: "Drive free bytes were measured before and after the accepted scoped executor run. A post-run native rescan is still required for route-level proof.".to_string(),
            }
        } else {
            write_volume_proof_not_collected(
                "after-unavailable",
                &drive,
                "The scoped executor accepted, but the post-run drive free-space probe was unavailable.",
            )
        }
    } else {
        write_volume_proof_not_collected(
            "before-unavailable",
            &probe.drive,
            "The scoped executor accepted, but the pre-run drive free-space probe was unavailable.",
        )
    };
    response
}

fn write_volume_proof_not_collected(status: &str, drive: &str, note: &str) -> WriteVolumeProof {
    WriteVolumeProof {
        status: status.to_string(),
        drive: drive.to_string(),
        before: None,
        after: None,
        free_bytes_delta: 0,
        source: "not-collected".to_string(),
        note: note.to_string(),
    }
}

fn write_volume_free_bytes_delta(before_free: u64, after_free: u64) -> i64 {
    let delta = after_free as i128 - before_free as i128;
    if delta > i64::MAX as i128 {
        i64::MAX
    } else if delta < i64::MIN as i128 {
        i64::MIN
    } else {
        delta as i64
    }
}

fn write_request_volume_drive(request: &WriteExecutionRequest) -> String {
    request
        .actions
        .iter()
        .filter_map(|action| action.target_path.as_deref())
        .find_map(drive_from_path_string)
        .or_else(|| {
            request
                .archive_destination
                .as_deref()
                .and_then(drive_from_path_string)
        })
        .unwrap_or_else(system_drive_fallback)
}

fn drive_from_path_string(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.len() < 2 {
        return None;
    }
    let prefix = trimmed.get(0..2)?;
    normalize_drive_value(prefix)
}

fn enabled_scoped_executor_flags_on_windows() -> Vec<&'static str> {
    let flags = [
        ("SPACEGUARD_ENABLE_TEMP_EXECUTOR", temp_executor_enabled()),
        (
            "SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR",
            project_dependency_executor_enabled(),
        ),
        (
            "SPACEGUARD_ENABLE_DOWNLOADS_EXECUTOR",
            downloads_cleanup_executor_enabled(),
        ),
        (
            "SPACEGUARD_ENABLE_LARGE_FILE_ARCHIVE_EXECUTOR",
            large_file_archive_executor_enabled(),
        ),
        (
            "SPACEGUARD_ENABLE_BROWSER_CACHE_EXECUTOR",
            browser_cache_executor_enabled(),
        ),
        (
            "SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR",
            gradle_cache_executor_enabled(),
        ),
        (
            "SPACEGUARD_ENABLE_USER_CACHE_EXECUTOR",
            user_cache_executor_enabled(),
        ),
        (
            "SPACEGUARD_ENABLE_ANDROID_CACHE_EXECUTOR",
            android_cache_executor_enabled(),
        ),
        (
            "SPACEGUARD_ENABLE_SHADER_CACHE_EXECUTOR",
            shader_cache_executor_enabled(),
        ),
        (
            "SPACEGUARD_ENABLE_PIP_CACHE_EXECUTOR",
            pip_cache_executor_enabled(),
        ),
        (
            "SPACEGUARD_ENABLE_TOOL_NATIVE_PRUNE_EXECUTORS",
            tool_native_prune_executors_enabled(),
        ),
        (
            "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR",
            npm_cache_executor_enabled(),
        ),
        (
            "SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR",
            pnpm_store_executor_enabled(),
        ),
        (
            "SPACEGUARD_ENABLE_RECYCLE_BIN_EXECUTOR",
            recycle_bin_executor_enabled(),
        ),
    ];

    flags
        .iter()
        .filter_map(|(name, enabled)| {
            if scoped_executor_enabled_on_windows(*enabled) {
                Some(*name)
            } else {
                None
            }
        })
        .collect()
}

fn reject_multiple_scoped_executor_flags(
    request: &WriteExecutionRequest,
    enabled_flags: &[&'static str],
) -> WriteExecutionResponse {
    let route = request.route.clone();
    let plan_id = request.plan_id.clone();
    let expected_bytes = request
        .expected_bytes
        .unwrap_or_else(|| request.actions.iter().map(|action| action.bytes).sum());
    let enabled_flags_label = enabled_flags.join(", ");
    let contract_echo = WriteContractEcho {
        schema_version: request
            .schema_version
            .clone()
            .unwrap_or_else(|| "spaceguard-write-boundary-request/v1".to_string()),
        request_mode: request
            .request_mode
            .clone()
            .unwrap_or_else(|| "execute-cleanup".to_string()),
        plan_id: plan_id.clone(),
        route: route.clone(),
        scan_fingerprint: request.scan_fingerprint.clone().unwrap_or_default(),
        consent_plan_id: request.consent_plan_id.clone().unwrap_or_default(),
        expected_bytes,
        dry_run_only: request.dry_run_only.unwrap_or(true),
        mutation_attempted: request.mutation_attempted.unwrap_or(false),
        action_count: request.actions.len(),
    };
    let entries = request
        .actions
        .iter()
        .map(|action| WriteExecutionEntry {
            id: action.id.clone(),
            title: action.title.clone(),
            route: action.route.clone(),
            result: "rejected".to_string(),
            reject_code: "multiple-scoped-executor-flags".to_string(),
            bytes: 0,
            preflight_status: "executor-scope-blocked".to_string(),
            preflight_checks: vec![
                write_preflight_check(
                    "single-scoped-executor-flag",
                    "Single scoped executor flag",
                    "blocked",
                    "Only one scoped executor feature flag may be enabled for a mutating native request.",
                ),
                write_preflight_check(
                    "mutation-dispatch",
                    "Mutation dispatch",
                    "blocked",
                    "Native executor dispatch was stopped before route selection.",
                ),
                write_preflight_check(
                    "mutation-lock",
                    "Mutation lock",
                    "passed",
                    "No filesystem mutation was attempted and all requested bytes remain untouched.",
                ),
            ],
            note: format!(
                "Real cleanup rejected before dispatch with code multiple-scoped-executor-flags. Enabled scoped executor flags: {enabled_flags_label}. Plan {plan_id}; no bytes were removed or moved for this action."
            ),
        })
        .collect::<Vec<_>>();

    WriteExecutionResponse {
        mode: "native-executor-scope-rejected",
        real_run_enabled: false,
        destructive_commands: false,
        accepted: false,
        reason: "Native executor dispatch rejected the request because multiple scoped executor flags are enabled.".to_string(),
        contract_echo,
        executor_scaffold: write_executor_scaffold(&route),
        entries,
        volume_proof: write_volume_proof_not_collected(
            "not-collected-rejected",
            "",
            "Volume proof was not collected because native executor dispatch was blocked before route selection.",
        ),
        warnings: vec![
            format!(
                "Only one scoped executor flag may be enabled for a real run. Turn off all but one before launching Tauri: {enabled_flags_label}."
            ),
            "No filesystem mutation was attempted because native executor dispatch was blocked before route selection.".to_string(),
        ],
    }
}

fn execute_first_safe_temp_cleanup(request: WriteExecutionRequest) -> WriteExecutionResponse {
    let route = request.route.clone();
    let plan_id = request.plan_id.clone();
    let expected_bytes = request
        .expected_bytes
        .unwrap_or_else(|| request.actions.iter().map(|action| action.bytes).sum());
    let flag_enabled = scoped_executor_enabled_on_windows(temp_executor_enabled());
    let rejections = temp_execution_rejections(&request, flag_enabled);
    let contract_echo = WriteContractEcho {
        schema_version: request
            .schema_version
            .clone()
            .unwrap_or_else(|| "spaceguard-write-boundary-request/v1".to_string()),
        request_mode: request
            .request_mode
            .clone()
            .unwrap_or_else(|| "execute-first-safe".to_string()),
        plan_id: plan_id.clone(),
        route: route.clone(),
        scan_fingerprint: request.scan_fingerprint.clone().unwrap_or_default(),
        consent_plan_id: request.consent_plan_id.clone().unwrap_or_default(),
        expected_bytes,
        dry_run_only: request.dry_run_only.unwrap_or(true),
        mutation_attempted: request.mutation_attempted.unwrap_or(false),
        action_count: request.actions.len(),
    };

    let entries = request
        .actions
        .into_iter()
        .map(|action| {
            let target_reject = write_action_target_reject_code(&route, &action.target_path);
            let route_match = action.route == route && route == "known-temp-delete";
            let can_execute = rejections.is_empty() && route_match && target_reject.is_none();

            if can_execute {
                let deleted = delete_temp_action_targets(action.target_path.as_deref().unwrap_or(""));
                return WriteExecutionEntry {
                    id: action.id,
                    title: action.title,
                    route: action.route,
                    result: if deleted.deleted_files > 0 {
                        "executed".to_string()
                    } else {
                        "no-op".to_string()
                    },
                    reject_code: String::new(),
                    bytes: deleted.deleted_bytes,
                    preflight_status: "executed".to_string(),
                    preflight_checks: vec![
                        write_preflight_check(
                            "route-first-safe",
                            "First-safe route",
                            "passed",
                            "Action route is known-temp-delete.",
                        ),
                        write_preflight_check(
                            "target-allowlist",
                            "Target allowlist",
                            "passed",
                            "Target path is limited to temp cleanup roots.",
                        ),
                        write_preflight_check(
                            "feature-flag",
                            "Executor feature flag",
                            "passed",
                            "SPACEGUARD_ENABLE_TEMP_EXECUTOR enabled the temp executor.",
                        ),
                    ],
                    note: format!(
                        "Temp executor deleted {} file(s), reclaimed {} byte(s), skipped {} item(s), and never removed directories.",
                        deleted.deleted_files, deleted.deleted_bytes, deleted.skipped_count
                    ),
                };
            }

            let reject_code = if !route_match {
                "route-not-first-safe"
            } else {
                target_reject
                    .or_else(|| rejections.first().copied())
                    .unwrap_or("real-executor-disabled")
            };

            WriteExecutionEntry {
                id: action.id,
                title: action.title,
                route: action.route,
                result: "rejected".to_string(),
                reject_code: reject_code.to_string(),
                bytes: 0,
                preflight_status: "target-blocked".to_string(),
                preflight_checks: vec![
                    write_preflight_check(
                        "route-first-safe",
                        "First-safe route",
                        if route_match { "passed" } else { "blocked" },
                        if route_match {
                            "Action route is known-temp-delete."
                        } else {
                            "Only known-temp-delete can execute through the temp cleanup executor."
                        },
                    ),
                    write_preflight_check(
                        "target-allowlist",
                        "Target allowlist",
                        if target_reject.is_none() { "passed" } else { "blocked" },
                        if target_reject.is_none() {
                            "Target path is allowlisted."
                        } else {
                            "Target path is missing, forbidden, or outside the temp allowlist."
                        },
                    ),
                    write_preflight_check(
                        "feature-flag",
                        "Executor feature flag",
                        if flag_enabled { "passed" } else { "blocked" },
                        if flag_enabled {
                            "Temp executor feature flag is enabled."
                        } else {
                            "SPACEGUARD_ENABLE_TEMP_EXECUTOR is not enabled."
                        },
                    ),
                ],
                note: format!(
                    "Real temp cleanup rejected with code {reject_code}. Plan {plan_id}; no bytes were removed for this action."
                ),
            }
        })
        .collect::<Vec<_>>();

    let accepted = rejections.is_empty()
        && entries
            .iter()
            .all(|entry| entry.result == "executed" || entry.result == "no-op");
    let reclaimed = entries.iter().map(|entry| entry.bytes).sum::<u64>();
    let mut warnings = temp_execution_warnings(&rejections);
    if accepted {
        warnings.push(format!(
            "Real temp cleanup completed for plan {plan_id}; reclaimed {reclaimed} byte(s). Run a fresh native scan to verify free space."
        ));
    }

    WriteExecutionResponse {
        mode: if accepted {
            "native-temp-executor"
        } else {
            "native-temp-executor-rejected"
        },
        real_run_enabled: flag_enabled,
        destructive_commands: flag_enabled,
        accepted,
        reason: if accepted {
            format!("Temp cleanup executor accepted the first-safe plan and reclaimed {reclaimed} byte(s).")
        } else {
            "Temp cleanup executor rejected the request before mutation.".to_string()
        },
        contract_echo,
        executor_scaffold: write_executor_scaffold(&route),
        entries,
        volume_proof: write_volume_proof_not_collected(
            "not-collected",
            "",
            "Volume proof has not been finalized for this response.",
        ),
        warnings,
    }
}

fn execute_project_dependency_cleanup(request: WriteExecutionRequest) -> WriteExecutionResponse {
    let route = request.route.clone();
    let plan_id = request.plan_id.clone();
    let expected_bytes = request
        .expected_bytes
        .unwrap_or_else(|| request.actions.iter().map(|action| action.bytes).sum());
    let flag_enabled = scoped_executor_enabled_on_windows(project_dependency_executor_enabled());
    let rejections = project_dependency_execution_rejections(&request, flag_enabled);
    let contract_echo = WriteContractEcho {
        schema_version: request
            .schema_version
            .clone()
            .unwrap_or_else(|| "spaceguard-project-deps-request/v1".to_string()),
        request_mode: request
            .request_mode
            .clone()
            .unwrap_or_else(|| "execute-project-deps".to_string()),
        plan_id: plan_id.clone(),
        route: route.clone(),
        scan_fingerprint: request.scan_fingerprint.clone().unwrap_or_default(),
        consent_plan_id: request.consent_plan_id.clone().unwrap_or_default(),
        expected_bytes,
        dry_run_only: request.dry_run_only.unwrap_or(true),
        mutation_attempted: request.mutation_attempted.unwrap_or(false),
        action_count: request.actions.len(),
    };

    let entries = request
        .actions
        .into_iter()
        .map(|action| {
            let target_path = action.target_path.clone().unwrap_or_default();
            let target_reject = project_dependency_target_reject_code(&target_path);
            let route_match = action.route == route && route == "item-review-project-cache";
            let can_execute = rejections.is_empty() && route_match && target_reject.is_none();

            if can_execute {
                let deleted = delete_project_dependency_target(&resolve_dry_run_target(&target_path));
                return WriteExecutionEntry {
                    id: action.id,
                    title: action.title,
                    route: action.route,
                    result: if deleted.deleted_files > 0 || deleted.deleted_dirs > 0 {
                        "executed".to_string()
                    } else {
                        "no-op".to_string()
                    },
                    reject_code: String::new(),
                    bytes: deleted.deleted_bytes,
                    preflight_status: "executed".to_string(),
                    preflight_checks: vec![
                        write_preflight_check(
                            "route-project-cache",
                            "Project cache route",
                            "passed",
                            "Action route is item-review-project-cache.",
                        ),
                        write_preflight_check(
                            "target-node-modules",
                            "Reviewed node_modules target",
                            "passed",
                            "Target is a node_modules directory with a parent package.json.",
                        ),
                        write_preflight_check(
                            "feature-flag",
                            "Executor feature flag",
                            "passed",
                            "SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR enabled project dependency cleanup.",
                        ),
                    ],
                    note: format!(
                        "Project dependency executor removed {} file(s), {} empty dir(s), reclaimed {} byte(s), and skipped {} item(s).",
                        deleted.deleted_files, deleted.deleted_dirs, deleted.deleted_bytes, deleted.skipped_count
                    ),
                };
            }

            let reject_code = if !route_match {
                "route-not-project-cache"
            } else {
                target_reject
                    .or_else(|| rejections.first().copied())
                    .unwrap_or("project-deps-executor-disabled")
            };

            WriteExecutionEntry {
                id: action.id,
                title: action.title,
                route: action.route,
                result: "rejected".to_string(),
                reject_code: reject_code.to_string(),
                bytes: 0,
                preflight_status: "target-blocked".to_string(),
                preflight_checks: vec![
                    write_preflight_check(
                        "route-project-cache",
                        "Project cache route",
                        if route_match { "passed" } else { "blocked" },
                        if route_match {
                            "Action route is item-review-project-cache."
                        } else {
                            "Only reviewed project dependency cleanup can use this executor."
                        },
                    ),
                    write_preflight_check(
                        "target-node-modules",
                        "Reviewed node_modules target",
                        if target_reject.is_none() { "passed" } else { "blocked" },
                        if target_reject.is_none() {
                            "Target is a reviewed node_modules directory."
                        } else {
                            "Target is missing, not node_modules, lacks parent package.json, or is link-like."
                        },
                    ),
                    write_preflight_check(
                        "feature-flag",
                        "Executor feature flag",
                        if flag_enabled { "passed" } else { "blocked" },
                        if flag_enabled {
                            "Project dependency executor feature flag is enabled."
                        } else {
                            "SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR is not enabled."
                        },
                    ),
                ],
                note: format!(
                    "Project dependency cleanup rejected with code {reject_code}. Plan {plan_id}; no bytes were removed for this action."
                ),
            }
        })
        .collect::<Vec<_>>();

    let accepted = rejections.is_empty()
        && entries
            .iter()
            .all(|entry| entry.result == "executed" || entry.result == "no-op");
    let reclaimed = entries.iter().map(|entry| entry.bytes).sum::<u64>();
    let mut warnings = project_dependency_execution_warnings(&rejections);
    if accepted {
        warnings.push(format!(
            "Project dependency cleanup completed for plan {plan_id}; reclaimed {reclaimed} byte(s). Run npm install in affected projects before using them."
        ));
    }

    WriteExecutionResponse {
        mode: if accepted {
            "native-project-deps-executor"
        } else {
            "native-project-deps-executor-rejected"
        },
        real_run_enabled: flag_enabled,
        destructive_commands: flag_enabled,
        accepted,
        reason: if accepted {
            format!("Project dependency executor accepted reviewed targets and reclaimed {reclaimed} byte(s).")
        } else {
            "Project dependency executor rejected the request before mutation.".to_string()
        },
        contract_echo,
        executor_scaffold: write_executor_scaffold(&route),
        entries,
        volume_proof: write_volume_proof_not_collected(
            "not-collected",
            "",
            "Volume proof has not been finalized for this response.",
        ),
        warnings,
    }
}

fn execute_downloads_review_cleanup(request: WriteExecutionRequest) -> WriteExecutionResponse {
    let route = request.route.clone();
    let plan_id = request.plan_id.clone();
    let expected_bytes = request
        .expected_bytes
        .unwrap_or_else(|| request.actions.iter().map(|action| action.bytes).sum());
    let flag_enabled = scoped_executor_enabled_on_windows(downloads_cleanup_executor_enabled());
    let rejections = downloads_cleanup_execution_rejections(&request, flag_enabled);
    let contract_echo = WriteContractEcho {
        schema_version: request
            .schema_version
            .clone()
            .unwrap_or_else(|| "spaceguard-downloads-recycle-bin-request/v1".to_string()),
        request_mode: request
            .request_mode
            .clone()
            .unwrap_or_else(|| "execute-downloads-recycle-bin".to_string()),
        plan_id: plan_id.clone(),
        route: route.clone(),
        scan_fingerprint: request.scan_fingerprint.clone().unwrap_or_default(),
        consent_plan_id: request.consent_plan_id.clone().unwrap_or_default(),
        expected_bytes,
        dry_run_only: request.dry_run_only.unwrap_or(true),
        mutation_attempted: request.mutation_attempted.unwrap_or(false),
        action_count: request.actions.len(),
    };

    let entries = request
        .actions
        .into_iter()
        .map(|action| {
            let target_path = action.target_path.clone().unwrap_or_default();
            let target_reject = downloads_cleanup_target_reject_code(&target_path);
            let route_match = action.route == route && route == "item-review-recycle-bin";
            let can_execute = rejections.is_empty() && route_match && target_reject.is_none();

            if can_execute {
                let target = resolve_dry_run_target(&target_path);
                let moved = move_download_file_to_recycle_bin(&target);
                return WriteExecutionEntry {
                    id: action.id,
                    title: action.title,
                    route: action.route,
                    result: if moved.succeeded && moved.bytes > 0 {
                        "executed".to_string()
                    } else if moved.succeeded {
                        "no-op".to_string()
                    } else {
                        "rejected".to_string()
                    },
                    reject_code: if moved.succeeded {
                        String::new()
                    } else {
                        "downloads-recycle-bin-shell-api-failed".to_string()
                    },
                    bytes: if moved.succeeded { moved.bytes } else { 0 },
                    preflight_status: if moved.succeeded {
                        "executed".to_string()
                    } else {
                        "target-blocked".to_string()
                    },
                    preflight_checks: vec![
                        write_preflight_check(
                            "route-downloads-review",
                            "Reviewed Downloads route",
                            "passed",
                            "Action route is item-review-recycle-bin.",
                        ),
                        write_preflight_check(
                            "target-download-file",
                            "Reviewed Downloads file",
                            "passed",
                            "Target is a single old installer or archive file under the user's Downloads folder.",
                        ),
                        write_preflight_check(
                            "feature-flag",
                            "Executor feature flag",
                            "passed",
                            "SPACEGUARD_ENABLE_DOWNLOADS_EXECUTOR enabled reviewed Downloads cleanup.",
                        ),
                        write_preflight_check(
                            "shell-api",
                            "Windows Shell recycle operation",
                            if moved.succeeded { "passed" } else { "blocked" },
                            if moved.succeeded {
                                "SHFileOperationW moved the reviewed file through Recycle Bin semantics."
                            } else {
                                "SHFileOperationW rejected the reviewed file move; no bytes are claimed."
                            },
                        ),
                    ],
                    note: if moved.succeeded {
                        format!(
                            "Reviewed Downloads executor moved one file to Recycle Bin semantics and reclaimed {} byte(s).",
                            moved.bytes
                        )
                    } else {
                        format!(
                            "Reviewed Downloads cleanup failed at the Windows Shell API boundary with code {}. No bytes were claimed.",
                            moved.error_code
                        )
                    },
                };
            }

            let reject_code = if !route_match {
                "route-not-downloads-review"
            } else {
                target_reject
                    .or_else(|| rejections.first().copied())
                    .unwrap_or("downloads-executor-disabled")
            };

            WriteExecutionEntry {
                id: action.id,
                title: action.title,
                route: action.route,
                result: "rejected".to_string(),
                reject_code: reject_code.to_string(),
                bytes: 0,
                preflight_status: "target-blocked".to_string(),
                preflight_checks: vec![
                    write_preflight_check(
                        "route-downloads-review",
                        "Reviewed Downloads route",
                        if route_match { "passed" } else { "blocked" },
                        if route_match {
                            "Action route is item-review-recycle-bin."
                        } else {
                            "Only reviewed Downloads item cleanup can use this executor."
                        },
                    ),
                    write_preflight_check(
                        "target-download-file",
                        "Reviewed Downloads file",
                        if target_reject.is_none() {
                            "passed"
                        } else {
                            "blocked"
                        },
                        if target_reject.is_none() {
                            "Target is a reviewed Downloads installer/archive file."
                        } else {
                            "Target is missing, too recent, outside Downloads, not a file, link-like, or not an allowed installer/archive type."
                        },
                    ),
                    write_preflight_check(
                        "feature-flag",
                        "Executor feature flag",
                        if flag_enabled { "passed" } else { "blocked" },
                        if flag_enabled {
                            "Downloads executor feature flag is enabled."
                        } else {
                            "SPACEGUARD_ENABLE_DOWNLOADS_EXECUTOR is not enabled."
                        },
                    ),
                ],
                note: format!(
                    "Reviewed Downloads cleanup rejected with code {reject_code}. Plan {plan_id}; no bytes were removed for this action."
                ),
            }
        })
        .collect::<Vec<_>>();

    let accepted = rejections.is_empty()
        && entries
            .iter()
            .all(|entry| entry.result == "executed" || entry.result == "no-op");
    let reclaimed = entries.iter().map(|entry| entry.bytes).sum::<u64>();
    let mut warnings = downloads_cleanup_execution_warnings(&rejections);
    if accepted {
        warnings.push(format!(
            "Reviewed Downloads cleanup completed for plan {plan_id}; moved {reclaimed} byte(s) through Recycle Bin semantics. Run a fresh native scan to verify free space."
        ));
    }

    WriteExecutionResponse {
        mode: if accepted {
            "native-downloads-recycle-bin-executor"
        } else {
            "native-downloads-recycle-bin-executor-rejected"
        },
        real_run_enabled: flag_enabled,
        destructive_commands: flag_enabled,
        accepted,
        reason: if accepted {
            format!("Reviewed Downloads executor accepted selected files and reclaimed {reclaimed} byte(s).")
        } else {
            "Reviewed Downloads executor rejected the request before mutation.".to_string()
        },
        contract_echo,
        executor_scaffold: write_executor_scaffold(&route),
        entries,
        volume_proof: write_volume_proof_not_collected(
            "not-collected",
            "",
            "Volume proof has not been finalized for this response.",
        ),
        warnings,
    }
}

fn execute_large_file_archive_cleanup(request: WriteExecutionRequest) -> WriteExecutionResponse {
    let route = request.route.clone();
    let plan_id = request.plan_id.clone();
    let archive_destination = request.archive_destination.clone().unwrap_or_default();
    let expected_bytes = request
        .expected_bytes
        .unwrap_or_else(|| request.actions.iter().map(|action| action.bytes).sum());
    let flag_enabled = scoped_executor_enabled_on_windows(large_file_archive_executor_enabled());
    let rejections = large_file_archive_execution_rejections(&request, flag_enabled);
    let contract_echo = WriteContractEcho {
        schema_version: request
            .schema_version
            .clone()
            .unwrap_or_else(|| "spaceguard-large-file-archive-request/v1".to_string()),
        request_mode: request
            .request_mode
            .clone()
            .unwrap_or_else(|| "execute-large-file-archive".to_string()),
        plan_id: plan_id.clone(),
        route: route.clone(),
        scan_fingerprint: request.scan_fingerprint.clone().unwrap_or_default(),
        consent_plan_id: request.consent_plan_id.clone().unwrap_or_default(),
        expected_bytes,
        dry_run_only: request.dry_run_only.unwrap_or(true),
        mutation_attempted: request.mutation_attempted.unwrap_or(false),
        action_count: request.actions.len(),
    };

    let entries = request
        .actions
        .into_iter()
        .map(|action| {
            let target_path = action.target_path.clone().unwrap_or_default();
            let target_reject =
                large_file_archive_target_reject_code(&target_path, &archive_destination);
            let route_match = action.route == route && route == "item-review-large-files";
            let can_execute = rejections.is_empty() && route_match && target_reject.is_none();

            if can_execute {
                let target = resolve_dry_run_target(&target_path);
                let destination = resolve_dry_run_target(&archive_destination);
                let moved = archive_large_file_to_destination(&target, &destination, &plan_id);
                return WriteExecutionEntry {
                    id: action.id,
                    title: action.title,
                    route: action.route,
                    result: if moved.succeeded && moved.bytes > 0 {
                        "executed".to_string()
                    } else if moved.succeeded {
                        "no-op".to_string()
                    } else {
                        "rejected".to_string()
                    },
                    reject_code: if moved.succeeded {
                        String::new()
                    } else {
                        "large-file-archive-move-failed".to_string()
                    },
                    bytes: if moved.succeeded { moved.bytes } else { 0 },
                    preflight_status: if moved.succeeded {
                        "executed".to_string()
                    } else {
                        "target-blocked".to_string()
                    },
                    preflight_checks: vec![
                        write_preflight_check(
                            "route-large-file-review",
                            "Reviewed large-file route",
                            "passed",
                            "Action route is item-review-large-files.",
                        ),
                        write_preflight_check(
                            "target-large-file",
                            "Reviewed large file",
                            "passed",
                            "Target is a single old large file under an allowed current-user folder.",
                        ),
                        write_preflight_check(
                            "archive-destination",
                            "Archive destination",
                            "passed",
                            "Destination is an existing non-system folder on a different drive.",
                        ),
                        write_preflight_check(
                            "feature-flag",
                            "Executor feature flag",
                            "passed",
                            "SPACEGUARD_ENABLE_LARGE_FILE_ARCHIVE_EXECUTOR enabled reviewed large-file archive.",
                        ),
                        write_preflight_check(
                            "archive-move",
                            "Archive copy and source removal",
                            if moved.succeeded { "passed" } else { "blocked" },
                            if moved.succeeded {
                                "The file was copied to the archive destination and removed from the source path."
                            } else {
                                "The archive move did not complete; no reclaimed bytes are claimed."
                            },
                        ),
                    ],
                    note: if moved.succeeded {
                        format!(
                            "Reviewed large-file archive moved one file to {} and reclaimed {} byte(s).",
                            moved.archive_path, moved.bytes
                        )
                    } else {
                        format!(
                            "Reviewed large-file archive failed with code {}. No bytes were claimed.",
                            moved.error_code
                        )
                    },
                };
            }

            let reject_code = if !route_match {
                "route-not-large-file-review"
            } else {
                target_reject
                    .or_else(|| rejections.first().copied())
                    .unwrap_or("large-file-archive-executor-disabled")
            };

            WriteExecutionEntry {
                id: action.id,
                title: action.title,
                route: action.route,
                result: "rejected".to_string(),
                reject_code: reject_code.to_string(),
                bytes: 0,
                preflight_status: "target-blocked".to_string(),
                preflight_checks: vec![
                    write_preflight_check(
                        "route-large-file-review",
                        "Reviewed large-file route",
                        if route_match { "passed" } else { "blocked" },
                        if route_match {
                            "Action route is item-review-large-files."
                        } else {
                            "Only reviewed large-file archive can use this executor."
                        },
                    ),
                    write_preflight_check(
                        "target-large-file",
                        "Reviewed large file",
                        if target_reject.is_none() {
                            "passed"
                        } else {
                            "blocked"
                        },
                        if target_reject.is_none() {
                            "Target is a reviewed old large user file."
                        } else {
                            "Target is missing, too recent, too small, outside allowed user folders, link-like, or not a file."
                        },
                    ),
                    write_preflight_check(
                        "archive-destination",
                        "Archive destination",
                        if archive_destination_reject_code(&archive_destination).is_none() {
                            "passed"
                        } else {
                            "blocked"
                        },
                        "Archive destination must be an existing non-system folder on a different drive from the source.",
                    ),
                    write_preflight_check(
                        "feature-flag",
                        "Executor feature flag",
                        if flag_enabled { "passed" } else { "blocked" },
                        if flag_enabled {
                            "Large-file archive executor feature flag is enabled."
                        } else {
                            "SPACEGUARD_ENABLE_LARGE_FILE_ARCHIVE_EXECUTOR is not enabled."
                        },
                    ),
                ],
                note: format!(
                    "Reviewed large-file archive rejected with code {reject_code}. Plan {plan_id}; no bytes were moved for this action."
                ),
            }
        })
        .collect::<Vec<_>>();

    let accepted = rejections.is_empty()
        && entries
            .iter()
            .all(|entry| entry.result == "executed" || entry.result == "no-op");
    let reclaimed = entries.iter().map(|entry| entry.bytes).sum::<u64>();
    let mut warnings = large_file_archive_execution_warnings(&rejections);
    if accepted {
        warnings.push(format!(
            "Reviewed large-file archive completed for plan {plan_id}; moved {reclaimed} byte(s) to the archive destination. Run a fresh native scan to verify free space."
        ));
    }

    WriteExecutionResponse {
        mode: if accepted {
            "native-large-file-archive-executor"
        } else {
            "native-large-file-archive-executor-rejected"
        },
        real_run_enabled: flag_enabled,
        destructive_commands: flag_enabled,
        accepted,
        reason: if accepted {
            format!("Reviewed large-file archive accepted selected files and reclaimed {reclaimed} byte(s).")
        } else {
            "Reviewed large-file archive rejected the request before moving files.".to_string()
        },
        contract_echo,
        executor_scaffold: write_executor_scaffold(&route),
        entries,
        volume_proof: write_volume_proof_not_collected(
            "not-collected",
            "",
            "Volume proof has not been finalized for this response.",
        ),
        warnings,
    }
}

fn execute_browser_cache_cleanup(request: WriteExecutionRequest) -> WriteExecutionResponse {
    let route = request.route.clone();
    let plan_id = request.plan_id.clone();
    let expected_bytes = request
        .expected_bytes
        .unwrap_or_else(|| request.actions.iter().map(|action| action.bytes).sum());
    let flag_enabled = scoped_executor_enabled_on_windows(browser_cache_executor_enabled());
    let rejections = browser_cache_execution_rejections(&request, flag_enabled);
    let contract_echo = WriteContractEcho {
        schema_version: request
            .schema_version
            .clone()
            .unwrap_or_else(|| "spaceguard-browser-cache-request/v1".to_string()),
        request_mode: request
            .request_mode
            .clone()
            .unwrap_or_else(|| "execute-browser-cache".to_string()),
        plan_id: plan_id.clone(),
        route: route.clone(),
        scan_fingerprint: request.scan_fingerprint.clone().unwrap_or_default(),
        consent_plan_id: request.consent_plan_id.clone().unwrap_or_default(),
        expected_bytes,
        dry_run_only: request.dry_run_only.unwrap_or(true),
        mutation_attempted: request.mutation_attempted.unwrap_or(false),
        action_count: request.actions.len(),
    };

    let entries = request
        .actions
        .into_iter()
        .map(|action| {
            let target_path = action.target_path.clone().unwrap_or_default();
            let target_reject = browser_cache_targets_reject_code(&target_path);
            let route_match = action.route == route && route == "browser-cache-only";
            let can_execute = rejections.is_empty() && route_match && target_reject.is_none();

            if can_execute {
                let deleted = delete_browser_cache_action_targets(&target_path);
                return WriteExecutionEntry {
                    id: action.id,
                    title: action.title,
                    route: action.route,
                    result: if deleted.deleted_files > 0 || deleted.deleted_dirs > 0 {
                        "executed".to_string()
                    } else {
                        "no-op".to_string()
                    },
                    reject_code: String::new(),
                    bytes: deleted.deleted_bytes,
                    preflight_status: "executed".to_string(),
                    preflight_checks: vec![
                        write_preflight_check(
                            "route-browser-cache",
                            "Browser cache route",
                            "passed",
                            "Action route is browser-cache-only.",
                        ),
                        write_preflight_check(
                            "target-cache-root",
                            "Cache-only target",
                            "passed",
                            "Target is a browser cache directory; cookies, sessions, logins, extensions, and profile stores are rejected.",
                        ),
                        write_preflight_check(
                            "feature-flag",
                            "Executor feature flag",
                            "passed",
                            "SPACEGUARD_ENABLE_BROWSER_CACHE_EXECUTOR enabled browser cache cleanup.",
                        ),
                    ],
                    note: format!(
                        "Browser cache executor deleted {} file(s), {} empty cache dir(s), reclaimed {} byte(s), and skipped {} item(s).",
                        deleted.deleted_files, deleted.deleted_dirs, deleted.deleted_bytes, deleted.skipped_count
                    ),
                };
            }

            let reject_code = if !route_match {
                "route-not-browser-cache"
            } else {
                target_reject
                    .or_else(|| rejections.first().copied())
                    .unwrap_or("browser-cache-executor-disabled")
            };

            WriteExecutionEntry {
                id: action.id,
                title: action.title,
                route: action.route,
                result: "rejected".to_string(),
                reject_code: reject_code.to_string(),
                bytes: 0,
                preflight_status: "target-blocked".to_string(),
                preflight_checks: vec![
                    write_preflight_check(
                        "route-browser-cache",
                        "Browser cache route",
                        if route_match { "passed" } else { "blocked" },
                        if route_match {
                            "Action route is browser-cache-only."
                        } else {
                            "Only browser-cache-only can use this executor."
                        },
                    ),
                    write_preflight_check(
                        "target-cache-root",
                        "Cache-only target",
                        if target_reject.is_none() { "passed" } else { "blocked" },
                        if target_reject.is_none() {
                            "Target is a browser cache directory."
                        } else {
                            "Target is missing, forbidden, not a browser cache directory, or link-like."
                        },
                    ),
                    write_preflight_check(
                        "feature-flag",
                        "Executor feature flag",
                        if flag_enabled { "passed" } else { "blocked" },
                        if flag_enabled {
                            "Browser cache executor feature flag is enabled."
                        } else {
                            "SPACEGUARD_ENABLE_BROWSER_CACHE_EXECUTOR is not enabled."
                        },
                    ),
                ],
                note: format!(
                    "Browser cache cleanup rejected with code {reject_code}. Plan {plan_id}; no bytes were removed for this action."
                ),
            }
        })
        .collect::<Vec<_>>();

    let accepted = rejections.is_empty()
        && entries
            .iter()
            .all(|entry| entry.result == "executed" || entry.result == "no-op");
    let reclaimed = entries.iter().map(|entry| entry.bytes).sum::<u64>();
    let mut warnings = browser_cache_execution_warnings(&rejections);
    if accepted {
        warnings.push(format!(
            "Browser cache cleanup completed for plan {plan_id}; reclaimed {reclaimed} byte(s). Run a fresh native scan to verify free space."
        ));
    }

    WriteExecutionResponse {
        mode: if accepted {
            "native-browser-cache-executor"
        } else {
            "native-browser-cache-executor-rejected"
        },
        real_run_enabled: flag_enabled,
        destructive_commands: flag_enabled,
        accepted,
        reason: if accepted {
            format!("Browser cache executor accepted cache-only targets and reclaimed {reclaimed} byte(s).")
        } else {
            "Browser cache executor rejected the request before mutation.".to_string()
        },
        contract_echo,
        executor_scaffold: write_executor_scaffold(&route),
        entries,
        volume_proof: write_volume_proof_not_collected(
            "not-collected",
            "",
            "Volume proof has not been finalized for this response.",
        ),
        warnings,
    }
}

fn execute_gradle_cache_cleanup(request: WriteExecutionRequest) -> WriteExecutionResponse {
    let route = request.route.clone();
    let plan_id = request.plan_id.clone();
    let expected_bytes = request
        .expected_bytes
        .unwrap_or_else(|| request.actions.iter().map(|action| action.bytes).sum());
    let flag_enabled = scoped_executor_enabled_on_windows(gradle_cache_executor_enabled());
    let rejections = gradle_cache_execution_rejections(&request, flag_enabled);
    let contract_echo = WriteContractEcho {
        schema_version: request
            .schema_version
            .clone()
            .unwrap_or_else(|| "spaceguard-gradle-cache-request/v1".to_string()),
        request_mode: request
            .request_mode
            .clone()
            .unwrap_or_else(|| "execute-gradle-cache".to_string()),
        plan_id: plan_id.clone(),
        route: route.clone(),
        scan_fingerprint: request.scan_fingerprint.clone().unwrap_or_default(),
        consent_plan_id: request.consent_plan_id.clone().unwrap_or_default(),
        expected_bytes,
        dry_run_only: request.dry_run_only.unwrap_or(true),
        mutation_attempted: request.mutation_attempted.unwrap_or(false),
        action_count: request.actions.len(),
    };

    let entries = request
        .actions
        .into_iter()
        .map(|action| {
            let target_path = action.target_path.clone().unwrap_or_default();
            let target_reject = gradle_cache_target_reject_code(&target_path);
            let route_match = action.route == route && route == "bounded-cache-delete";
            let can_execute = rejections.is_empty() && route_match && target_reject.is_none();

            if can_execute {
                let deleted = delete_gradle_cache_target(&resolve_dry_run_target(&target_path));
                return WriteExecutionEntry {
                    id: action.id,
                    title: action.title,
                    route: action.route,
                    result: if deleted.deleted_files > 0 || deleted.deleted_dirs > 0 {
                        "executed".to_string()
                    } else {
                        "no-op".to_string()
                    },
                    reject_code: String::new(),
                    bytes: deleted.deleted_bytes,
                    preflight_status: "executed".to_string(),
                    preflight_checks: vec![
                        write_preflight_check(
                            "route-bounded-cache",
                            "Bounded cache route",
                            "passed",
                            "Action route is bounded-cache-delete.",
                        ),
                        write_preflight_check(
                            "target-gradle-cache",
                            "Gradle cache target",
                            "passed",
                            "Target is the current user's .gradle\\caches directory.",
                        ),
                        write_preflight_check(
                            "feature-flag",
                            "Executor feature flag",
                            "passed",
                            "SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR enabled Gradle cache cleanup.",
                        ),
                    ],
                    note: format!(
                        "Gradle cache executor deleted {} old file(s), {} empty cache dir(s), reclaimed {} byte(s), and skipped {} item(s).",
                        deleted.deleted_files,
                        deleted.deleted_dirs,
                        deleted.deleted_bytes,
                        deleted.skipped_count
                    ),
                };
            }

            let reject_code = if !route_match {
                "route-not-bounded-cache"
            } else {
                target_reject
                    .or_else(|| rejections.first().copied())
                    .unwrap_or("gradle-cache-executor-disabled")
            };

            WriteExecutionEntry {
                id: action.id,
                title: action.title,
                route: action.route,
                result: "rejected".to_string(),
                reject_code: reject_code.to_string(),
                bytes: 0,
                preflight_status: "target-blocked".to_string(),
                preflight_checks: vec![
                    write_preflight_check(
                        "route-bounded-cache",
                        "Bounded cache route",
                        if route_match { "passed" } else { "blocked" },
                        if route_match {
                            "Action route is bounded-cache-delete."
                        } else {
                            "Only bounded-cache-delete can use this executor."
                        },
                    ),
                    write_preflight_check(
                        "target-gradle-cache",
                        "Gradle cache target",
                        if target_reject.is_none() { "passed" } else { "blocked" },
                        if target_reject.is_none() {
                            "Target is the current user's Gradle cache."
                        } else {
                            "Target is missing, forbidden, not the current user's .gradle\\caches directory, or link-like."
                        },
                    ),
                    write_preflight_check(
                        "feature-flag",
                        "Executor feature flag",
                        if flag_enabled { "passed" } else { "blocked" },
                        if flag_enabled {
                            "Gradle cache executor feature flag is enabled."
                        } else {
                            "SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR is not enabled."
                        },
                    ),
                ],
                note: format!(
                    "Gradle cache cleanup rejected with code {reject_code}. Plan {plan_id}; no bytes were removed for this action."
                ),
            }
        })
        .collect::<Vec<_>>();

    let accepted = rejections.is_empty()
        && entries
            .iter()
            .all(|entry| entry.result == "executed" || entry.result == "no-op");
    let reclaimed = entries.iter().map(|entry| entry.bytes).sum::<u64>();
    let mut warnings = gradle_cache_execution_warnings(&rejections);
    if accepted {
        warnings.push(format!(
            "Gradle cache cleanup completed for plan {plan_id}; reclaimed {reclaimed} byte(s). Run a fresh native scan and a Gradle build if you need cache rehydration proof."
        ));
    }

    WriteExecutionResponse {
        mode: if accepted {
            "native-gradle-cache-executor"
        } else {
            "native-gradle-cache-executor-rejected"
        },
        real_run_enabled: flag_enabled,
        destructive_commands: flag_enabled,
        accepted,
        reason: if accepted {
            format!("Gradle cache executor accepted the bounded cache target and reclaimed {reclaimed} byte(s).")
        } else {
            "Gradle cache executor rejected the request before mutation.".to_string()
        },
        contract_echo,
        executor_scaffold: write_executor_scaffold(&route),
        entries,
        volume_proof: write_volume_proof_not_collected(
            "not-collected",
            "",
            "Volume proof has not been finalized for this response.",
        ),
        warnings,
    }
}

fn execute_npm_cache_cleanup(request: WriteExecutionRequest) -> WriteExecutionResponse {
    let route = request.route.clone();
    let plan_id = request.plan_id.clone();
    let expected_bytes = request
        .expected_bytes
        .unwrap_or_else(|| request.actions.iter().map(|action| action.bytes).sum());
    let flag_enabled = scoped_executor_enabled_on_windows(npm_cache_executor_enabled());
    let rejections = npm_cache_execution_rejections(&request, flag_enabled);
    let contract_echo = WriteContractEcho {
        schema_version: request
            .schema_version
            .clone()
            .unwrap_or_else(|| "spaceguard-npm-cache-request/v1".to_string()),
        request_mode: request
            .request_mode
            .clone()
            .unwrap_or_else(|| "execute-npm-cache".to_string()),
        plan_id: plan_id.clone(),
        route: route.clone(),
        scan_fingerprint: request.scan_fingerprint.clone().unwrap_or_default(),
        consent_plan_id: request.consent_plan_id.clone().unwrap_or_default(),
        expected_bytes,
        dry_run_only: request.dry_run_only.unwrap_or(true),
        mutation_attempted: request.mutation_attempted.unwrap_or(false),
        action_count: request.actions.len(),
    };

    let entries = request
        .actions
        .into_iter()
        .map(|action| {
            let target_path = action.target_path.clone().unwrap_or_default();
            let target_reject = npm_cache_target_reject_code(&target_path);
            let route_match = action.route == route && route == "bounded-npm-cache-delete";
            let can_execute = rejections.is_empty() && route_match && target_reject.is_none();

            if can_execute {
                let deleted = delete_npm_cache_target(&resolve_dry_run_target(&target_path));
                return WriteExecutionEntry {
                    id: action.id,
                    title: action.title,
                    route: action.route,
                    result: if deleted.deleted_files > 0 || deleted.deleted_dirs > 0 {
                        "executed".to_string()
                    } else {
                        "no-op".to_string()
                    },
                    reject_code: String::new(),
                    bytes: deleted.deleted_bytes,
                    preflight_status: "executed".to_string(),
                    preflight_checks: vec![
                        write_preflight_check(
                            "route-bounded-npm-cache",
                            "Bounded npm cache route",
                            "passed",
                            "Action route is bounded-npm-cache-delete.",
                        ),
                        write_preflight_check(
                            "target-npm-cache",
                            "npm _cacache target",
                            "passed",
                            "Target is the current user's npm-cache\\_cacache directory.",
                        ),
                        write_preflight_check(
                            "feature-flag",
                            "Executor feature flag",
                            "passed",
                            "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR enabled npm cache cleanup.",
                        ),
                    ],
                    note: format!(
                        "npm cache executor deleted {} old file(s), {} empty cache dir(s), reclaimed {} byte(s), and skipped {} item(s).",
                        deleted.deleted_files,
                        deleted.deleted_dirs,
                        deleted.deleted_bytes,
                        deleted.skipped_count
                    ),
                };
            }

            let reject_code = if !route_match {
                "route-not-bounded-npm-cache"
            } else {
                target_reject
                    .or_else(|| rejections.first().copied())
                    .unwrap_or("npm-cache-executor-disabled")
            };

            WriteExecutionEntry {
                id: action.id,
                title: action.title,
                route: action.route,
                result: "rejected".to_string(),
                reject_code: reject_code.to_string(),
                bytes: 0,
                preflight_status: "target-blocked".to_string(),
                preflight_checks: vec![
                    write_preflight_check(
                        "route-bounded-npm-cache",
                        "Bounded npm cache route",
                        if route_match { "passed" } else { "blocked" },
                        if route_match {
                            "Action route is bounded-npm-cache-delete."
                        } else {
                            "Only bounded-npm-cache-delete can use this executor."
                        },
                    ),
                    write_preflight_check(
                        "target-npm-cache",
                        "npm _cacache target",
                        if target_reject.is_none() { "passed" } else { "blocked" },
                        if target_reject.is_none() {
                            "Target is the current user's npm _cacache."
                        } else {
                            "Target is missing, forbidden, not the current user's npm-cache\\_cacache directory, or link-like."
                        },
                    ),
                    write_preflight_check(
                        "feature-flag",
                        "Executor feature flag",
                        if flag_enabled { "passed" } else { "blocked" },
                        if flag_enabled {
                            "npm cache executor feature flag is enabled."
                        } else {
                            "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR is not enabled."
                        },
                    ),
                ],
                note: format!(
                    "npm cache cleanup rejected with code {reject_code}. Plan {plan_id}; no bytes were removed for this action."
                ),
            }
        })
        .collect::<Vec<_>>();

    let accepted = rejections.is_empty()
        && entries
            .iter()
            .all(|entry| entry.result == "executed" || entry.result == "no-op");
    let reclaimed = entries.iter().map(|entry| entry.bytes).sum::<u64>();
    let mut warnings = npm_cache_execution_warnings(&rejections);
    if accepted {
        warnings.push(format!(
            "npm cache cleanup completed for plan {plan_id}; reclaimed {reclaimed} byte(s). Run a fresh native scan and npm install if you need cache rehydration proof."
        ));
    }

    WriteExecutionResponse {
        mode: if accepted {
            "native-npm-cache-executor"
        } else {
            "native-npm-cache-executor-rejected"
        },
        real_run_enabled: flag_enabled,
        destructive_commands: flag_enabled,
        accepted,
        reason: if accepted {
            format!("npm cache executor accepted the bounded _cacache target and reclaimed {reclaimed} byte(s).")
        } else {
            "npm cache executor rejected the request before mutation.".to_string()
        },
        contract_echo,
        executor_scaffold: write_executor_scaffold(&route),
        entries,
        volume_proof: write_volume_proof_not_collected(
            "not-collected",
            "",
            "Volume proof has not been finalized for this response.",
        ),
        warnings,
    }
}

fn execute_user_cache_cleanup(request: WriteExecutionRequest) -> WriteExecutionResponse {
    let route = request.route.clone();
    let plan_id = request.plan_id.clone();
    let expected_bytes = request
        .expected_bytes
        .unwrap_or_else(|| request.actions.iter().map(|action| action.bytes).sum());
    let flag_enabled = scoped_executor_enabled_on_windows(user_cache_executor_enabled());
    let rejections = user_cache_execution_rejections(&request, flag_enabled);
    let contract_echo = WriteContractEcho {
        schema_version: request
            .schema_version
            .clone()
            .unwrap_or_else(|| "spaceguard-user-cache-request/v1".to_string()),
        request_mode: request
            .request_mode
            .clone()
            .unwrap_or_else(|| "execute-user-cache".to_string()),
        plan_id: plan_id.clone(),
        route: route.clone(),
        scan_fingerprint: request.scan_fingerprint.clone().unwrap_or_default(),
        consent_plan_id: request.consent_plan_id.clone().unwrap_or_default(),
        expected_bytes,
        dry_run_only: request.dry_run_only.unwrap_or(true),
        mutation_attempted: request.mutation_attempted.unwrap_or(false),
        action_count: request.actions.len(),
    };

    let entries = request
        .actions
        .into_iter()
        .map(|action| {
            let target_path = action.target_path.clone().unwrap_or_default();
            let target_reject = user_cache_target_reject_code(&target_path);
            let route_match = action.route == route && route == "bounded-user-cache-delete";
            let can_execute = rejections.is_empty() && route_match && target_reject.is_none();

            if can_execute {
                let deleted = delete_user_cache_target(&resolve_dry_run_target(&target_path));
                return WriteExecutionEntry {
                    id: action.id,
                    title: action.title,
                    route: action.route,
                    result: if deleted.deleted_files > 0 || deleted.deleted_dirs > 0 {
                        "executed".to_string()
                    } else {
                        "no-op".to_string()
                    },
                    reject_code: String::new(),
                    bytes: deleted.deleted_bytes,
                    preflight_status: "executed".to_string(),
                    preflight_checks: vec![
                        write_preflight_check(
                            "route-bounded-user-cache",
                            "Bounded user cache route",
                            "passed",
                            "Action route is bounded-user-cache-delete.",
                        ),
                        write_preflight_check(
                            "target-user-cache",
                            "User .cache target",
                            "passed",
                            "Target is the current user's .cache directory.",
                        ),
                        write_preflight_check(
                            "feature-flag",
                            "Executor feature flag",
                            "passed",
                            "SPACEGUARD_ENABLE_USER_CACHE_EXECUTOR enabled user .cache cleanup.",
                        ),
                    ],
                    note: format!(
                        "User .cache executor deleted {} old cache file(s), {} empty cache dir(s), reclaimed {} byte(s), and skipped {} item(s).",
                        deleted.deleted_files,
                        deleted.deleted_dirs,
                        deleted.deleted_bytes,
                        deleted.skipped_count
                    ),
                };
            }

            let reject_code = if !route_match {
                "route-not-bounded-user-cache"
            } else {
                target_reject
                    .or_else(|| rejections.first().copied())
                    .unwrap_or("user-cache-executor-disabled")
            };

            WriteExecutionEntry {
                id: action.id,
                title: action.title,
                route: action.route,
                result: "rejected".to_string(),
                reject_code: reject_code.to_string(),
                bytes: 0,
                preflight_status: "target-blocked".to_string(),
                preflight_checks: vec![
                    write_preflight_check(
                        "route-bounded-user-cache",
                        "Bounded user cache route",
                        if route_match { "passed" } else { "blocked" },
                        if route_match {
                            "Action route is bounded-user-cache-delete."
                        } else {
                            "Only bounded-user-cache-delete can use this executor."
                        },
                    ),
                    write_preflight_check(
                        "target-user-cache",
                        "User .cache target",
                        if target_reject.is_none() { "passed" } else { "blocked" },
                        if target_reject.is_none() {
                            "Target is the current user's .cache directory."
                        } else {
                            "Target is missing, forbidden, not the current user's .cache directory, or link-like."
                        },
                    ),
                    write_preflight_check(
                        "feature-flag",
                        "Executor feature flag",
                        if flag_enabled { "passed" } else { "blocked" },
                        if flag_enabled {
                            "User .cache executor feature flag is enabled."
                        } else {
                            "SPACEGUARD_ENABLE_USER_CACHE_EXECUTOR is not enabled."
                        },
                    ),
                ],
                note: format!(
                    "User .cache cleanup rejected with code {reject_code}. Plan {plan_id}; no bytes were removed for this action."
                ),
            }
        })
        .collect::<Vec<_>>();

    let accepted = rejections.is_empty()
        && entries
            .iter()
            .all(|entry| entry.result == "executed" || entry.result == "no-op");
    let reclaimed = entries.iter().map(|entry| entry.bytes).sum::<u64>();
    let mut warnings = user_cache_execution_warnings(&rejections);
    if accepted {
        warnings.push(format!(
            "User .cache cleanup completed for plan {plan_id}; reclaimed {reclaimed} byte(s). Run a fresh native scan and reopen affected dev tools if you need cache rebuild proof."
        ));
    }

    WriteExecutionResponse {
        mode: if accepted {
            "native-user-cache-executor"
        } else {
            "native-user-cache-executor-rejected"
        },
        real_run_enabled: flag_enabled,
        destructive_commands: flag_enabled,
        accepted,
        reason: if accepted {
            format!("User .cache executor accepted the bounded cache target and reclaimed {reclaimed} byte(s).")
        } else {
            "User .cache executor rejected the request before mutation.".to_string()
        },
        contract_echo,
        executor_scaffold: write_executor_scaffold(&route),
        entries,
        volume_proof: write_volume_proof_not_collected(
            "not-collected",
            "",
            "Volume proof has not been finalized for this response.",
        ),
        warnings,
    }
}

fn execute_android_cache_cleanup(request: WriteExecutionRequest) -> WriteExecutionResponse {
    let route = request.route.clone();
    let plan_id = request.plan_id.clone();
    let expected_bytes = request
        .expected_bytes
        .unwrap_or_else(|| request.actions.iter().map(|action| action.bytes).sum());
    let flag_enabled = scoped_executor_enabled_on_windows(android_cache_executor_enabled());
    let rejections = android_cache_execution_rejections(&request, flag_enabled);
    let contract_echo = WriteContractEcho {
        schema_version: request
            .schema_version
            .clone()
            .unwrap_or_else(|| "spaceguard-android-cache-request/v1".to_string()),
        request_mode: request
            .request_mode
            .clone()
            .unwrap_or_else(|| "execute-android-cache".to_string()),
        plan_id: plan_id.clone(),
        route: route.clone(),
        scan_fingerprint: request.scan_fingerprint.clone().unwrap_or_default(),
        consent_plan_id: request.consent_plan_id.clone().unwrap_or_default(),
        expected_bytes,
        dry_run_only: request.dry_run_only.unwrap_or(true),
        mutation_attempted: request.mutation_attempted.unwrap_or(false),
        action_count: request.actions.len(),
    };

    let entries = request
        .actions
        .into_iter()
        .map(|action| {
            let target_path = action.target_path.clone().unwrap_or_default();
            let target_reject = android_cache_target_reject_code(&target_path);
            let route_match = action.route == route && route == "bounded-android-cache-delete";
            let can_execute = rejections.is_empty() && route_match && target_reject.is_none();

            if can_execute {
                let deleted = delete_android_cache_target(&resolve_dry_run_target(&target_path));
                return WriteExecutionEntry {
                    id: action.id,
                    title: action.title,
                    route: action.route,
                    result: if deleted.deleted_files > 0 || deleted.deleted_dirs > 0 {
                        "executed".to_string()
                    } else {
                        "no-op".to_string()
                    },
                    reject_code: String::new(),
                    bytes: deleted.deleted_bytes,
                    preflight_status: "executed".to_string(),
                    preflight_checks: vec![
                        write_preflight_check(
                            "route-bounded-android-cache",
                            "Bounded Android cache route",
                            "passed",
                            "Action route is bounded-android-cache-delete.",
                        ),
                        write_preflight_check(
                            "target-android-cache",
                            "Android cache target",
                            "passed",
                            "Target is a scanned Android Studio cache or .android build-cache directory.",
                        ),
                        write_preflight_check(
                            "feature-flag",
                            "Executor feature flag",
                            "passed",
                            "SPACEGUARD_ENABLE_ANDROID_CACHE_EXECUTOR enabled Android cache cleanup.",
                        ),
                    ],
                    note: format!(
                        "Android cache executor deleted {} old cache file(s), {} empty cache dir(s), reclaimed {} byte(s), and skipped {} item(s).",
                        deleted.deleted_files,
                        deleted.deleted_dirs,
                        deleted.deleted_bytes,
                        deleted.skipped_count
                    ),
                };
            }

            let reject_code = if !route_match {
                "route-not-bounded-android-cache"
            } else {
                target_reject
                    .or_else(|| rejections.first().copied())
                    .unwrap_or("android-cache-executor-disabled")
            };

            WriteExecutionEntry {
                id: action.id,
                title: action.title,
                route: action.route,
                result: "rejected".to_string(),
                reject_code: reject_code.to_string(),
                bytes: 0,
                preflight_status: "target-blocked".to_string(),
                preflight_checks: vec![
                    write_preflight_check(
                        "route-bounded-android-cache",
                        "Bounded Android cache route",
                        if route_match { "passed" } else { "blocked" },
                        if route_match {
                            "Action route is bounded-android-cache-delete."
                        } else {
                            "Only bounded-android-cache-delete can use this executor."
                        },
                    ),
                    write_preflight_check(
                        "target-android-cache",
                        "Android cache target",
                        if target_reject.is_none() { "passed" } else { "blocked" },
                        if target_reject.is_none() {
                            "Target is a scanned Android cache directory."
                        } else {
                            "Target is missing, forbidden, not a scanned Android cache directory, or link-like."
                        },
                    ),
                    write_preflight_check(
                        "feature-flag",
                        "Executor feature flag",
                        if flag_enabled { "passed" } else { "blocked" },
                        if flag_enabled {
                            "Android cache executor feature flag is enabled."
                        } else {
                            "SPACEGUARD_ENABLE_ANDROID_CACHE_EXECUTOR is not enabled."
                        },
                    ),
                ],
                note: format!(
                    "Android cache cleanup rejected with code {reject_code}. Plan {plan_id}; no bytes were removed for this action."
                ),
            }
        })
        .collect::<Vec<_>>();

    let accepted = rejections.is_empty()
        && entries
            .iter()
            .all(|entry| entry.result == "executed" || entry.result == "no-op");
    let reclaimed = entries.iter().map(|entry| entry.bytes).sum::<u64>();
    let mut warnings = android_cache_execution_warnings(&rejections);
    if accepted {
        warnings.push(format!(
            "Android cache cleanup completed for plan {plan_id}; reclaimed {reclaimed} byte(s). Run a fresh native scan and reopen Android Studio if you need cache rebuild proof."
        ));
    }

    WriteExecutionResponse {
        mode: if accepted {
            "native-android-cache-executor"
        } else {
            "native-android-cache-executor-rejected"
        },
        real_run_enabled: flag_enabled,
        destructive_commands: flag_enabled,
        accepted,
        reason: if accepted {
            format!("Android cache executor accepted bounded cache target(s) and reclaimed {reclaimed} byte(s).")
        } else {
            "Android cache executor rejected the request before mutation.".to_string()
        },
        contract_echo,
        executor_scaffold: write_executor_scaffold(&route),
        entries,
        volume_proof: write_volume_proof_not_collected(
            "not-collected",
            "",
            "Volume proof has not been finalized for this response.",
        ),
        warnings,
    }
}

fn execute_shader_cache_cleanup(request: WriteExecutionRequest) -> WriteExecutionResponse {
    let route = request.route.clone();
    let plan_id = request.plan_id.clone();
    let expected_bytes = request
        .expected_bytes
        .unwrap_or_else(|| request.actions.iter().map(|action| action.bytes).sum());
    let flag_enabled = scoped_executor_enabled_on_windows(shader_cache_executor_enabled());
    let rejections = shader_cache_execution_rejections(&request, flag_enabled);
    let contract_echo = WriteContractEcho {
        schema_version: request
            .schema_version
            .clone()
            .unwrap_or_else(|| "spaceguard-shader-cache-request/v1".to_string()),
        request_mode: request
            .request_mode
            .clone()
            .unwrap_or_else(|| "execute-shader-cache".to_string()),
        plan_id: plan_id.clone(),
        route: route.clone(),
        scan_fingerprint: request.scan_fingerprint.clone().unwrap_or_default(),
        consent_plan_id: request.consent_plan_id.clone().unwrap_or_default(),
        expected_bytes,
        dry_run_only: request.dry_run_only.unwrap_or(true),
        mutation_attempted: request.mutation_attempted.unwrap_or(false),
        action_count: request.actions.len(),
    };

    let entries = request
        .actions
        .into_iter()
        .map(|action| {
            let target_path = action.target_path.clone().unwrap_or_default();
            let target_reject = shader_cache_target_reject_code(&target_path);
            let route_match = action.route == route && route == "launcher-cache-cleanup";
            let can_execute = rejections.is_empty() && route_match && target_reject.is_none();

            if can_execute {
                let deleted = delete_shader_cache_target(&resolve_dry_run_target(&target_path));
                return WriteExecutionEntry {
                    id: action.id,
                    title: action.title,
                    route: action.route,
                    result: if deleted.deleted_files > 0 || deleted.deleted_dirs > 0 {
                        "executed".to_string()
                    } else {
                        "no-op".to_string()
                    },
                    reject_code: String::new(),
                    bytes: deleted.deleted_bytes,
                    preflight_status: "executed".to_string(),
                    preflight_checks: vec![
                        write_preflight_check(
                            "route-launcher-cache-cleanup",
                            "Shader cache route",
                            "passed",
                            "Action route is launcher-cache-cleanup.",
                        ),
                        write_preflight_check(
                            "target-shader-cache",
                            "Shader cache target",
                            "passed",
                            "Target is a scanned D3D, NVIDIA, AMD, or Intel shader cache directory.",
                        ),
                        write_preflight_check(
                            "feature-flag",
                            "Executor feature flag",
                            "passed",
                            "SPACEGUARD_ENABLE_SHADER_CACHE_EXECUTOR enabled shader cache cleanup.",
                        ),
                    ],
                    note: format!(
                        "Shader cache executor deleted {} old cache file(s), {} empty cache dir(s), reclaimed {} byte(s), and skipped {} item(s).",
                        deleted.deleted_files,
                        deleted.deleted_dirs,
                        deleted.deleted_bytes,
                        deleted.skipped_count
                    ),
                };
            }

            let reject_code = if !route_match {
                "route-not-launcher-cache-cleanup"
            } else {
                target_reject
                    .or_else(|| rejections.first().copied())
                    .unwrap_or("shader-cache-executor-disabled")
            };

            WriteExecutionEntry {
                id: action.id,
                title: action.title,
                route: action.route,
                result: "rejected".to_string(),
                reject_code: reject_code.to_string(),
                bytes: 0,
                preflight_status: "target-blocked".to_string(),
                preflight_checks: vec![
                    write_preflight_check(
                        "route-launcher-cache-cleanup",
                        "Shader cache route",
                        if route_match { "passed" } else { "blocked" },
                        if route_match {
                            "Action route is launcher-cache-cleanup."
                        } else {
                            "Only launcher-cache-cleanup can use this executor."
                        },
                    ),
                    write_preflight_check(
                        "target-shader-cache",
                        "Shader cache target",
                        if target_reject.is_none() { "passed" } else { "blocked" },
                        if target_reject.is_none() {
                            "Target is a scanned shader cache directory."
                        } else {
                            "Target is missing, forbidden, not a supported shader cache directory, or link-like."
                        },
                    ),
                    write_preflight_check(
                        "feature-flag",
                        "Executor feature flag",
                        if flag_enabled { "passed" } else { "blocked" },
                        if flag_enabled {
                            "Shader cache executor feature flag is enabled."
                        } else {
                            "SPACEGUARD_ENABLE_SHADER_CACHE_EXECUTOR is not enabled."
                        },
                    ),
                ],
                note: format!(
                    "Shader cache cleanup rejected with code {reject_code}. Plan {plan_id}; no bytes were removed for this action."
                ),
            }
        })
        .collect::<Vec<_>>();

    let accepted = rejections.is_empty()
        && entries
            .iter()
            .all(|entry| entry.result == "executed" || entry.result == "no-op");
    let reclaimed = entries.iter().map(|entry| entry.bytes).sum::<u64>();
    let mut warnings = shader_cache_execution_warnings(&rejections);
    if accepted {
        warnings.push(format!(
            "Shader cache cleanup completed for plan {plan_id}; reclaimed {reclaimed} byte(s). Run a fresh native scan and launch an affected game or graphics workload if you need rebuild proof."
        ));
    }

    WriteExecutionResponse {
        mode: if accepted {
            "native-shader-cache-executor"
        } else {
            "native-shader-cache-executor-rejected"
        },
        real_run_enabled: flag_enabled,
        destructive_commands: flag_enabled,
        accepted,
        reason: if accepted {
            format!("Shader cache executor accepted bounded cache target(s) and reclaimed {reclaimed} byte(s).")
        } else {
            "Shader cache executor rejected the request before mutation.".to_string()
        },
        contract_echo,
        executor_scaffold: write_executor_scaffold(&route),
        entries,
        volume_proof: write_volume_proof_not_collected(
            "not-collected",
            "",
            "Volume proof has not been finalized for this response.",
        ),
        warnings,
    }
}

fn execute_pip_cache_cleanup(request: WriteExecutionRequest) -> WriteExecutionResponse {
    let route = request.route.clone();
    let plan_id = request.plan_id.clone();
    let expected_bytes = request
        .expected_bytes
        .unwrap_or_else(|| request.actions.iter().map(|action| action.bytes).sum());
    let flag_enabled = scoped_executor_enabled_on_windows(pip_cache_executor_enabled());
    let rejections = pip_cache_execution_rejections(&request, flag_enabled);
    let contract_echo = WriteContractEcho {
        schema_version: request
            .schema_version
            .clone()
            .unwrap_or_else(|| "spaceguard-pip-cache-request/v1".to_string()),
        request_mode: request
            .request_mode
            .clone()
            .unwrap_or_else(|| "execute-pip-cache".to_string()),
        plan_id: plan_id.clone(),
        route: route.clone(),
        scan_fingerprint: request.scan_fingerprint.clone().unwrap_or_default(),
        consent_plan_id: request.consent_plan_id.clone().unwrap_or_default(),
        expected_bytes,
        dry_run_only: request.dry_run_only.unwrap_or(true),
        mutation_attempted: request.mutation_attempted.unwrap_or(false),
        action_count: request.actions.len(),
    };

    let entries = request
        .actions
        .into_iter()
        .map(|action| {
            let target_path = action.target_path.clone().unwrap_or_default();
            let target_reject = pip_cache_target_reject_code(&target_path);
            let route_match = action.route == route && route == "bounded-pip-cache-delete";
            let can_execute = rejections.is_empty() && route_match && target_reject.is_none();

            if can_execute {
                let deleted = delete_pip_cache_target(&resolve_dry_run_target(&target_path));
                return WriteExecutionEntry {
                    id: action.id,
                    title: action.title,
                    route: action.route,
                    result: if deleted.deleted_files > 0 || deleted.deleted_dirs > 0 {
                        "executed".to_string()
                    } else {
                        "no-op".to_string()
                    },
                    reject_code: String::new(),
                    bytes: deleted.deleted_bytes,
                    preflight_status: "executed".to_string(),
                    preflight_checks: vec![
                        write_preflight_check(
                            "route-bounded-pip-cache",
                            "Bounded pip cache route",
                            "passed",
                            "Action route is bounded-pip-cache-delete.",
                        ),
                        write_preflight_check(
                            "target-pip-cache",
                            "pip cache target",
                            "passed",
                            "Target is the current user's LocalAppData\\pip\\Cache directory.",
                        ),
                        write_preflight_check(
                            "feature-flag",
                            "Executor feature flag",
                            "passed",
                            "SPACEGUARD_ENABLE_PIP_CACHE_EXECUTOR enabled pip cache cleanup.",
                        ),
                    ],
                    note: format!(
                        "pip cache executor deleted {} old cache file(s), {} empty cache dir(s), reclaimed {} byte(s), and skipped {} item(s).",
                        deleted.deleted_files,
                        deleted.deleted_dirs,
                        deleted.deleted_bytes,
                        deleted.skipped_count
                    ),
                };
            }

            let reject_code = if !route_match {
                "route-not-bounded-pip-cache"
            } else {
                target_reject
                    .or_else(|| rejections.first().copied())
                    .unwrap_or("pip-cache-executor-disabled")
            };

            WriteExecutionEntry {
                id: action.id,
                title: action.title,
                route: action.route,
                result: "rejected".to_string(),
                reject_code: reject_code.to_string(),
                bytes: 0,
                preflight_status: "target-blocked".to_string(),
                preflight_checks: vec![
                    write_preflight_check(
                        "route-bounded-pip-cache",
                        "Bounded pip cache route",
                        if route_match { "passed" } else { "blocked" },
                        if route_match {
                            "Action route is bounded-pip-cache-delete."
                        } else {
                            "Only bounded-pip-cache-delete can use this executor."
                        },
                    ),
                    write_preflight_check(
                        "target-pip-cache",
                        "pip cache target",
                        if target_reject.is_none() { "passed" } else { "blocked" },
                        if target_reject.is_none() {
                            "Target is the current user's pip cache."
                        } else {
                            "Target is missing, forbidden, not the current user's LocalAppData\\pip\\Cache directory, or link-like."
                        },
                    ),
                    write_preflight_check(
                        "feature-flag",
                        "Executor feature flag",
                        if flag_enabled { "passed" } else { "blocked" },
                        if flag_enabled {
                            "pip cache executor feature flag is enabled."
                        } else {
                            "SPACEGUARD_ENABLE_PIP_CACHE_EXECUTOR is not enabled."
                        },
                    ),
                ],
                note: format!(
                    "pip cache cleanup rejected with code {reject_code}. Plan {plan_id}; no bytes were removed for this action."
                ),
            }
        })
        .collect::<Vec<_>>();

    let accepted = rejections.is_empty()
        && entries
            .iter()
            .all(|entry| entry.result == "executed" || entry.result == "no-op");
    let reclaimed = entries.iter().map(|entry| entry.bytes).sum::<u64>();
    let mut warnings = pip_cache_execution_warnings(&rejections);
    if accepted {
        warnings.push(format!(
            "pip cache cleanup completed for plan {plan_id}; reclaimed {reclaimed} byte(s). Run a fresh native scan and pip install if you need cache rehydration proof."
        ));
    }

    WriteExecutionResponse {
        mode: if accepted {
            "native-pip-cache-executor"
        } else {
            "native-pip-cache-executor-rejected"
        },
        real_run_enabled: flag_enabled,
        destructive_commands: flag_enabled,
        accepted,
        reason: if accepted {
            format!("pip cache executor accepted the bounded cache target and reclaimed {reclaimed} byte(s).")
        } else {
            "pip cache executor rejected the request before mutation.".to_string()
        },
        contract_echo,
        executor_scaffold: write_executor_scaffold(&route),
        entries,
        volume_proof: write_volume_proof_not_collected(
            "not-collected",
            "",
            "Volume proof has not been finalized for this response.",
        ),
        warnings,
    }
}

fn execute_docker_build_cache_cleanup(request: WriteExecutionRequest) -> WriteExecutionResponse {
    let route = request.route.clone();
    let plan_id = request.plan_id.clone();
    let expected_bytes = request
        .expected_bytes
        .unwrap_or_else(|| request.actions.iter().map(|action| action.bytes).sum());
    let flag_enabled = scoped_executor_enabled_on_windows(tool_native_prune_executors_enabled());
    let rejections = docker_build_cache_execution_rejections(&request, flag_enabled);
    let contract_echo = WriteContractEcho {
        schema_version: request
            .schema_version
            .clone()
            .unwrap_or_else(|| "spaceguard-docker-build-cache-request/v1".to_string()),
        request_mode: request
            .request_mode
            .clone()
            .unwrap_or_else(|| "execute-docker-build-cache".to_string()),
        plan_id: plan_id.clone(),
        route: route.clone(),
        scan_fingerprint: request.scan_fingerprint.clone().unwrap_or_default(),
        consent_plan_id: request.consent_plan_id.clone().unwrap_or_default(),
        expected_bytes,
        dry_run_only: request.dry_run_only.unwrap_or(true),
        mutation_attempted: request.mutation_attempted.unwrap_or(false),
        action_count: request.actions.len(),
    };

    let mut command_result: Option<DockerCommandResult> = None;
    let entries = request
        .actions
        .into_iter()
        .map(|action| {
            let target_path = action.target_path.clone().unwrap_or_default();
            let target_reject = docker_build_cache_target_reject_code(&target_path);
            let route_match =
                action.route == route && route == "tool-native-docker-build-cache-prune";
            let can_execute = rejections.is_empty() && route_match && target_reject.is_none();

            if can_execute {
                let result =
                    run_docker_command(&["builder", "prune", "--force"], 90);
                let reclaimed = docker_build_cache_prune_result(&result.stdout)
                    .or_else(|| docker_build_cache_prune_result(&result.stderr))
                    .unwrap_or(0);
                let ok = result.ok && !result.timed_out;
                let note = if ok {
                    format!(
                        "Docker build-cache executor ran `docker builder prune --force`, reclaimed {} byte(s), and never requested volumes, running containers, or broad system prune.",
                        reclaimed
                    )
                } else {
                    format!(
                        "Docker build-cache prune did not complete successfully: {}",
                        result.summary()
                    )
                };
                command_result = Some(result);
                return WriteExecutionEntry {
                    id: action.id,
                    title: action.title,
                    route: action.route,
                    result: if ok {
                        "executed".to_string()
                    } else {
                        "command-failed".to_string()
                    },
                    reject_code: if ok {
                        String::new()
                    } else {
                        "docker-command-failed".to_string()
                    },
                    bytes: reclaimed,
                    preflight_status: if ok {
                        "executed".to_string()
                    } else {
                        "command-failed".to_string()
                    },
                    preflight_checks: vec![
                        write_preflight_check(
                            "route-docker-build-cache",
                            "Docker build-cache route",
                            "passed",
                            "Action route is tool-native-docker-build-cache-prune.",
                        ),
                        write_preflight_check(
                            "target-docker-build-cache",
                            "Docker build-cache target",
                            "passed",
                            "Target is the scanned Docker Desktop build-cache inventory row.",
                        ),
                        write_preflight_check(
                            "command-allowlist",
                            "Docker command allowlist",
                            "passed",
                            "Only docker builder prune --force is allowed; volumes and system prune are not requested.",
                        ),
                        write_preflight_check(
                            "feature-flag",
                            "Executor feature flag",
                            "passed",
                            "SPACEGUARD_ENABLE_TOOL_NATIVE_PRUNE_EXECUTORS enabled tool-native Docker cleanup.",
                        ),
                    ],
                    note,
                };
            }

            let reject_code = if !route_match {
                "route-not-docker-build-cache-prune"
            } else {
                target_reject
                    .or_else(|| rejections.first().copied())
                    .unwrap_or("tool-native-prune-executors-disabled")
            };

            WriteExecutionEntry {
                id: action.id,
                title: action.title,
                route: action.route,
                result: "rejected".to_string(),
                reject_code: reject_code.to_string(),
                bytes: 0,
                preflight_status: "target-blocked".to_string(),
                preflight_checks: vec![
                    write_preflight_check(
                        "route-docker-build-cache",
                        "Docker build-cache route",
                        if route_match { "passed" } else { "blocked" },
                        if route_match {
                            "Action route is tool-native-docker-build-cache-prune."
                        } else {
                            "Only tool-native-docker-build-cache-prune can use this executor."
                        },
                    ),
                    write_preflight_check(
                        "target-docker-build-cache",
                        "Docker build-cache target",
                        if target_reject.is_none() {
                            "passed"
                        } else {
                            "blocked"
                        },
                        if target_reject.is_none() {
                            "Target is the Docker build-cache inventory row."
                        } else {
                            "Target is missing or is not the Docker build-cache inventory row."
                        },
                    ),
                    write_preflight_check(
                        "command-allowlist",
                        "Docker command allowlist",
                        "blocked",
                        "No Docker command runs unless every plan, consent, route, target, and feature flag check passes.",
                    ),
                    write_preflight_check(
                        "feature-flag",
                        "Executor feature flag",
                        if flag_enabled { "passed" } else { "blocked" },
                        if flag_enabled {
                            "tool-native prune executor feature flag is enabled."
                        } else {
                            "SPACEGUARD_ENABLE_TOOL_NATIVE_PRUNE_EXECUTORS is not enabled."
                        },
                    ),
                ],
                note: format!(
                    "Docker build-cache cleanup rejected with code {reject_code}. Plan {plan_id}; no Docker command was started."
                ),
            }
        })
        .collect::<Vec<_>>();

    let accepted = rejections.is_empty()
        && entries
            .iter()
            .all(|entry| entry.result == "executed" || entry.result == "no-op");
    let reclaimed = entries.iter().map(|entry| entry.bytes).sum::<u64>();
    let mut warnings = docker_build_cache_execution_warnings(&rejections);
    if let Some(result) = &command_result {
        if !result.ok || result.timed_out {
            warnings.push(result.summary());
        }
    }
    if accepted {
        warnings.push(format!(
            "Docker build-cache prune completed for plan {plan_id}; reclaimed {reclaimed} byte(s). Run a fresh native scan and Docker build if you need rebuild proof."
        ));
    }

    WriteExecutionResponse {
        mode: if accepted {
            "native-docker-build-cache-executor"
        } else {
            "native-docker-build-cache-executor-rejected"
        },
        real_run_enabled: flag_enabled,
        destructive_commands: flag_enabled,
        accepted,
        reason: if accepted {
            format!("Docker build-cache executor accepted the tool-native route and reclaimed {reclaimed} byte(s).")
        } else {
            "Docker build-cache executor rejected the request before a Docker command could run."
                .to_string()
        },
        contract_echo,
        executor_scaffold: write_executor_scaffold(&route),
        entries,
        volume_proof: write_volume_proof_not_collected(
            "not-collected",
            "",
            "Volume proof has not been finalized for this response.",
        ),
        warnings,
    }
}

fn execute_pnpm_store_cleanup(request: WriteExecutionRequest) -> WriteExecutionResponse {
    let route = request.route.clone();
    let plan_id = request.plan_id.clone();
    let expected_bytes = request
        .expected_bytes
        .unwrap_or_else(|| request.actions.iter().map(|action| action.bytes).sum());
    let flag_enabled = scoped_executor_enabled_on_windows(pnpm_store_executor_enabled());
    let rejections = pnpm_store_execution_rejections(&request, flag_enabled);
    let contract_echo = WriteContractEcho {
        schema_version: request
            .schema_version
            .clone()
            .unwrap_or_else(|| "spaceguard-pnpm-store-request/v1".to_string()),
        request_mode: request
            .request_mode
            .clone()
            .unwrap_or_else(|| "execute-pnpm-store".to_string()),
        plan_id: plan_id.clone(),
        route: route.clone(),
        scan_fingerprint: request.scan_fingerprint.clone().unwrap_or_default(),
        consent_plan_id: request.consent_plan_id.clone().unwrap_or_default(),
        expected_bytes,
        dry_run_only: request.dry_run_only.unwrap_or(true),
        mutation_attempted: request.mutation_attempted.unwrap_or(false),
        action_count: request.actions.len(),
    };

    let entries = request
        .actions
        .into_iter()
        .map(|action| {
            let target_path = action.target_path.clone().unwrap_or_default();
            let target_reject = pnpm_store_target_reject_code(&target_path);
            let route_match = action.route == route && route == "bounded-pnpm-store-delete";
            let can_execute = rejections.is_empty() && route_match && target_reject.is_none();

            if can_execute {
                let deleted = delete_pnpm_store_target(&resolve_dry_run_target(&target_path));
                return WriteExecutionEntry {
                    id: action.id,
                    title: action.title,
                    route: action.route,
                    result: if deleted.deleted_files > 0 || deleted.deleted_dirs > 0 {
                        "executed".to_string()
                    } else {
                        "no-op".to_string()
                    },
                    reject_code: String::new(),
                    bytes: deleted.deleted_bytes,
                    preflight_status: "executed".to_string(),
                    preflight_checks: vec![
                        write_preflight_check(
                            "route-bounded-pnpm-store",
                            "Bounded pnpm store route",
                            "passed",
                            "Action route is bounded-pnpm-store-delete.",
                        ),
                        write_preflight_check(
                            "target-pnpm-store",
                            "pnpm store target",
                            "passed",
                            "Target is the current user's LocalAppData\\pnpm\\store directory.",
                        ),
                        write_preflight_check(
                            "feature-flag",
                            "Executor feature flag",
                            "passed",
                            "SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR enabled pnpm store cleanup.",
                        ),
                    ],
                    note: format!(
                        "pnpm store executor deleted {} old content/temp file(s), {} empty store dir(s), reclaimed {} byte(s), and skipped {} item(s).",
                        deleted.deleted_files,
                        deleted.deleted_dirs,
                        deleted.deleted_bytes,
                        deleted.skipped_count
                    ),
                };
            }

            let reject_code = if !route_match {
                "route-not-bounded-pnpm-store"
            } else {
                target_reject
                    .or_else(|| rejections.first().copied())
                    .unwrap_or("pnpm-store-executor-disabled")
            };

            WriteExecutionEntry {
                id: action.id,
                title: action.title,
                route: action.route,
                result: "rejected".to_string(),
                reject_code: reject_code.to_string(),
                bytes: 0,
                preflight_status: "target-blocked".to_string(),
                preflight_checks: vec![
                    write_preflight_check(
                        "route-bounded-pnpm-store",
                        "Bounded pnpm store route",
                        if route_match { "passed" } else { "blocked" },
                        if route_match {
                            "Action route is bounded-pnpm-store-delete."
                        } else {
                            "Only bounded-pnpm-store-delete can use this executor."
                        },
                    ),
                    write_preflight_check(
                        "target-pnpm-store",
                        "pnpm store target",
                        if target_reject.is_none() { "passed" } else { "blocked" },
                        if target_reject.is_none() {
                            "Target is the current user's pnpm store."
                        } else {
                            "Target is missing, forbidden, not the current user's LocalAppData\\pnpm\\store directory, or link-like."
                        },
                    ),
                    write_preflight_check(
                        "feature-flag",
                        "Executor feature flag",
                        if flag_enabled { "passed" } else { "blocked" },
                        if flag_enabled {
                            "pnpm store executor feature flag is enabled."
                        } else {
                            "SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR is not enabled."
                        },
                    ),
                ],
                note: format!(
                    "pnpm store cleanup rejected with code {reject_code}. Plan {plan_id}; no bytes were removed for this action."
                ),
            }
        })
        .collect::<Vec<_>>();

    let accepted = rejections.is_empty()
        && entries
            .iter()
            .all(|entry| entry.result == "executed" || entry.result == "no-op");
    let reclaimed = entries.iter().map(|entry| entry.bytes).sum::<u64>();
    let mut warnings = pnpm_store_execution_warnings(&rejections);
    if accepted {
        warnings.push(format!(
            "pnpm store cleanup completed for plan {plan_id}; reclaimed {reclaimed} byte(s). Run a fresh native scan and pnpm install if you need store rehydration proof."
        ));
    }

    WriteExecutionResponse {
        mode: if accepted {
            "native-pnpm-store-executor"
        } else {
            "native-pnpm-store-executor-rejected"
        },
        real_run_enabled: flag_enabled,
        destructive_commands: flag_enabled,
        accepted,
        reason: if accepted {
            format!("pnpm store executor accepted the bounded store target and reclaimed {reclaimed} byte(s).")
        } else {
            "pnpm store executor rejected the request before mutation.".to_string()
        },
        contract_echo,
        executor_scaffold: write_executor_scaffold(&route),
        entries,
        volume_proof: write_volume_proof_not_collected(
            "not-collected",
            "",
            "Volume proof has not been finalized for this response.",
        ),
        warnings,
    }
}

fn execute_recycle_bin_cleanup(request: WriteExecutionRequest) -> WriteExecutionResponse {
    let route = request.route.clone();
    let plan_id = request.plan_id.clone();
    let expected_bytes = request
        .expected_bytes
        .unwrap_or_else(|| request.actions.iter().map(|action| action.bytes).sum());
    let flag_enabled = scoped_executor_enabled_on_windows(recycle_bin_executor_enabled());
    let rejections = recycle_bin_execution_rejections(&request, flag_enabled);
    let contract_echo = WriteContractEcho {
        schema_version: request
            .schema_version
            .clone()
            .unwrap_or_else(|| "spaceguard-recycle-bin-request/v1".to_string()),
        request_mode: request
            .request_mode
            .clone()
            .unwrap_or_else(|| "execute-recycle-bin".to_string()),
        plan_id: plan_id.clone(),
        route: route.clone(),
        scan_fingerprint: request.scan_fingerprint.clone().unwrap_or_default(),
        consent_plan_id: request.consent_plan_id.clone().unwrap_or_default(),
        expected_bytes,
        dry_run_only: request.dry_run_only.unwrap_or(true),
        mutation_attempted: request.mutation_attempted.unwrap_or(false),
        action_count: request.actions.len(),
    };

    let entries = request
        .actions
        .into_iter()
        .map(|action| {
            let target_path = action.target_path.clone().unwrap_or_default();
            let target_reject = recycle_bin_target_reject_code(&target_path);
            let route_match = action.route == route && route == "shell-recycle-bin";
            let can_execute = rejections.is_empty() && route_match && target_reject.is_none();

            if can_execute {
                let emptied = empty_recycle_bin_target(&target_path);
                let reclaimed = emptied.before_bytes.saturating_sub(emptied.after_bytes);
                return WriteExecutionEntry {
                    id: action.id,
                    title: action.title,
                    route: action.route,
                    result: if emptied.succeeded && reclaimed > 0 {
                        "executed".to_string()
                    } else if emptied.succeeded {
                        "no-op".to_string()
                    } else {
                        "rejected".to_string()
                    },
                    reject_code: if emptied.succeeded {
                        String::new()
                    } else {
                        "recycle-bin-shell-api-failed".to_string()
                    },
                    bytes: if emptied.succeeded { reclaimed } else { 0 },
                    preflight_status: if emptied.succeeded {
                        "executed".to_string()
                    } else {
                        "target-blocked".to_string()
                    },
                    preflight_checks: vec![
                        write_preflight_check(
                            "route-recycle-bin",
                            "Recycle Bin route",
                            "passed",
                            "Action route is shell-recycle-bin.",
                        ),
                        write_preflight_check(
                            "target-recycle-bin",
                            "Recycle Bin target",
                            "passed",
                            "Target is a scanned Recycle Bin boundary for one drive.",
                        ),
                        write_preflight_check(
                            "feature-flag",
                            "Executor feature flag",
                            "passed",
                            "SPACEGUARD_ENABLE_RECYCLE_BIN_EXECUTOR enabled Recycle Bin cleanup.",
                        ),
                        write_preflight_check(
                            "shell-api",
                            "Windows Shell API",
                            if emptied.succeeded { "passed" } else { "blocked" },
                            if emptied.succeeded {
                                "SHEmptyRecycleBinW returned success for the derived drive root."
                            } else {
                                "SHEmptyRecycleBinW rejected the request; no bytes are claimed."
                            },
                        ),
                    ],
                    note: if emptied.succeeded {
                        format!(
                            "Recycle Bin executor permanently removed {} item(s), reclaimed {} byte(s), and left {} byte(s) after the shell operation.",
                            emptied.before_items.saturating_sub(emptied.after_items),
                            reclaimed,
                            emptied.after_bytes
                        )
                    } else {
                        format!(
                            "Recycle Bin cleanup failed at the Windows Shell API boundary with HRESULT {}. No bytes were claimed.",
                            emptied.hresult
                        )
                    },
                };
            }

            let reject_code = if !route_match {
                "route-not-recycle-bin"
            } else {
                target_reject
                    .or_else(|| rejections.first().copied())
                    .unwrap_or("recycle-bin-executor-disabled")
            };

            WriteExecutionEntry {
                id: action.id,
                title: action.title,
                route: action.route,
                result: "rejected".to_string(),
                reject_code: reject_code.to_string(),
                bytes: 0,
                preflight_status: "target-blocked".to_string(),
                preflight_checks: vec![
                    write_preflight_check(
                        "route-recycle-bin",
                        "Recycle Bin route",
                        if route_match { "passed" } else { "blocked" },
                        if route_match {
                            "Action route is shell-recycle-bin."
                        } else {
                            "Only shell-recycle-bin can use this executor."
                        },
                    ),
                    write_preflight_check(
                        "target-recycle-bin",
                        "Recycle Bin target",
                        if target_reject.is_none() { "passed" } else { "blocked" },
                        if target_reject.is_none() {
                            "Target is a scanned Recycle Bin boundary."
                        } else {
                            "Target is missing, forbidden, not a Recycle Bin boundary, or not tied to one drive root."
                        },
                    ),
                    write_preflight_check(
                        "feature-flag",
                        "Executor feature flag",
                        if flag_enabled { "passed" } else { "blocked" },
                        if flag_enabled {
                            "Recycle Bin executor feature flag is enabled."
                        } else {
                            "SPACEGUARD_ENABLE_RECYCLE_BIN_EXECUTOR is not enabled."
                        },
                    ),
                ],
                note: format!(
                    "Recycle Bin cleanup rejected with code {reject_code}. Plan {plan_id}; no bytes were removed for this action."
                ),
            }
        })
        .collect::<Vec<_>>();

    let accepted = rejections.is_empty()
        && entries
            .iter()
            .all(|entry| entry.result == "executed" || entry.result == "no-op");
    let reclaimed = entries.iter().map(|entry| entry.bytes).sum::<u64>();
    let mut warnings = recycle_bin_execution_warnings(&rejections);
    if accepted {
        warnings.push(format!(
            "Recycle Bin cleanup completed for plan {plan_id}; permanently removed {reclaimed} byte(s). Run a fresh native scan to verify free space."
        ));
    }

    WriteExecutionResponse {
        mode: if accepted {
            "native-recycle-bin-executor"
        } else {
            "native-recycle-bin-executor-rejected"
        },
        real_run_enabled: flag_enabled,
        destructive_commands: flag_enabled,
        accepted,
        reason: if accepted {
            format!("Recycle Bin executor accepted the shell boundary and permanently removed {reclaimed} byte(s).")
        } else {
            "Recycle Bin executor rejected the request before claiming any removed bytes."
                .to_string()
        },
        contract_echo,
        executor_scaffold: write_executor_scaffold(&route),
        entries,
        volume_proof: write_volume_proof_not_collected(
            "not-collected",
            "",
            "Volume proof has not been finalized for this response.",
        ),
        warnings,
    }
}

fn write_boundary_rejections(request: &WriteExecutionRequest) -> Vec<&'static str> {
    let mut codes = Vec::new();
    let mode = request.request_mode.as_deref().unwrap_or("capsule-probe");

    if request.plan_id.trim().is_empty() {
        codes.push("missing-plan-id");
    }
    if request
        .scan_fingerprint
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-scan-fingerprint");
    }
    if request
        .consent_plan_id
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-consent-plan-id");
    }
    if request.dry_run_only != Some(true) {
        codes.push("dry-run-only-required");
    }
    if request.mutation_attempted.unwrap_or(false) {
        codes.push("mutation-attempt-flag");
    }
    if !matches!(mode, "reject-only-preview" | "capsule-probe") {
        codes.push("request-mode-invalid");
    }
    if !is_first_safe_write_route(&request.route) {
        codes.push("route-not-first-safe");
    }
    if request.actions.is_empty() {
        codes.push("no-actions");
    }

    codes
}

fn write_action_reject_code(
    action: &WriteExecutionAction,
    route: &str,
    boundary_rejections: &[&'static str],
) -> &'static str {
    if route.trim().is_empty() {
        return "route-missing";
    }
    if action.route != route {
        return "route-mismatch";
    }
    if !is_first_safe_write_route(route) {
        return "route-not-first-safe";
    }
    if let Some(target_code) = write_action_target_reject_code(route, &action.target_path) {
        return target_code;
    }
    boundary_rejections
        .first()
        .copied()
        .unwrap_or_else(|| write_executor_scaffold_reject_code(route))
}

fn write_action_preflight(
    action: &WriteExecutionAction,
    route: &str,
    boundary_rejections: &[&'static str],
    reject_code: &str,
) -> (String, Vec<WritePreflightCheck>) {
    let route_match = action.route == route && is_first_safe_write_route(route);
    let target_reject = write_action_target_reject_code(route, &action.target_path);
    let request_shape_passed = boundary_rejections.is_empty();
    let target_passed = target_reject.is_none();
    let scaffold = write_executor_scaffold(route);
    let scaffold_present = scaffold.is_some();
    let preflight_status = if !route_match {
        "route-blocked"
    } else if target_reject.is_some() {
        "target-blocked"
    } else if !request_shape_passed {
        "request-shape-blocked"
    } else if scaffold_present && reject_code == "temp-executor-feature-flag-disabled" {
        "executor-disabled-after-preflight"
    } else {
        "executor-disabled"
    };

    let checks = vec![
        write_preflight_check(
            "route-first-safe",
            "First-safe route",
            if route_match { "passed" } else { "blocked" },
            if route_match {
                "Selected action route matches the first-safe native boundary."
            } else {
                "Selected action route does not match an enabled first-safe boundary."
            },
        ),
        write_preflight_check(
            "request-shape",
            "Request shape",
            if request_shape_passed { "passed" } else { "blocked" },
            if request_shape_passed {
                "Plan, scan fingerprint, consent, dry-run-only, mutation flag, mode, and action list passed shape checks."
            } else {
                "Plan, scan fingerprint, consent, dry-run-only, mutation flag, mode, or action list failed shape checks."
            },
        ),
        write_preflight_check(
            "target-allowlist",
            "Target allowlist",
            if target_passed { "passed" } else { "blocked" },
            if target_passed {
                "Target path matches the route allowlist and does not hit forbidden rules."
            } else {
                "Target path is missing, forbidden, or outside the route allowlist."
            },
        ),
        write_preflight_check(
            "mutation-lock",
            "Mutation lock",
            "passed",
            "Native write boundary keeps accepted=false, realRunEnabled=false, destructiveCommands=false, and bytes=0.",
        ),
        write_preflight_check(
            "feature-flag",
            "Executor feature flag",
            if scaffold_present { "blocked" } else { "waiting" },
            if scaffold_present {
                "Route scaffold exists, but its executor feature flag is disabled."
            } else {
                "No route-specific executor scaffold is available for this route yet."
            },
        ),
        write_preflight_check(
            "validation-evidence",
            "Validation evidence",
            "waiting",
            "Windows route validation, rollback/rescan proof, and release review must pass before mutation can be considered.",
        ),
    ];

    (preflight_status.to_string(), checks)
}

fn write_preflight_check(id: &str, label: &str, status: &str, detail: &str) -> WritePreflightCheck {
    WritePreflightCheck {
        id: id.to_string(),
        label: label.to_string(),
        status: status.to_string(),
        detail: detail.to_string(),
    }
}

fn is_first_safe_write_route(route: &str) -> bool {
    matches!(
        route,
        "known-temp-delete"
            | "shell-recycle-bin"
            | "item-review-recycle-bin"
            | "item-review-large-files"
            | "browser-cache-only"
            | "item-review-project-cache"
            | "bounded-cache-delete"
            | "bounded-user-cache-delete"
            | "bounded-android-cache-delete"
            | "launcher-cache-cleanup"
            | "bounded-pip-cache-delete"
            | "tool-native-docker-build-cache-prune"
            | "bounded-npm-cache-delete"
            | "bounded-pnpm-store-delete"
    )
}

fn write_executor_scaffold(route: &str) -> Option<WriteExecutorScaffold> {
    match route {
        "known-temp-delete" => {
            let enabled = cfg!(target_os = "windows") && temp_executor_enabled();
            Some(WriteExecutorScaffold {
                route: "known-temp-delete".to_string(),
                title: "Known temp roots".to_string(),
                feature_flag: "tempCleanupExecutor".to_string(),
                status: if enabled {
                    "feature-flag-enabled".to_string()
                } else {
                    "feature-flag-disabled".to_string()
                },
                validation_status: if enabled {
                    "first-safe-temp-only".to_string()
                } else {
                    "validation-required".to_string()
                },
                mutation_enabled: enabled,
                reason: if enabled {
                    "Temp cleanup executor can delete old files under allowlisted temp roots only."
                        .to_string()
                } else {
                    "Temp cleanup executor scaffold is present, but mutation remains disabled until SPACEGUARD_ENABLE_TEMP_EXECUTOR is enabled on Windows.".to_string()
                },
            })
        }
        "shell-recycle-bin" => {
            let enabled = cfg!(target_os = "windows") && recycle_bin_executor_enabled();
            Some(WriteExecutorScaffold {
                route: "shell-recycle-bin".to_string(),
                title: "Recycle Bin boundary".to_string(),
                feature_flag: "recycleBinExecutor".to_string(),
                status: if enabled {
                    "feature-flag-enabled".to_string()
                } else {
                    "feature-flag-disabled".to_string()
                },
                validation_status: if enabled {
                    "shell-recycle-bin-only".to_string()
                } else {
                    "validation-required".to_string()
                },
                mutation_enabled: enabled,
                reason: if enabled {
                    "Recycle Bin executor can empty the selected drive's Shell Recycle Bin boundary only.".to_string()
                } else {
                    "Recycle Bin executor scaffold is present, but mutation remains disabled until SPACEGUARD_ENABLE_RECYCLE_BIN_EXECUTOR is enabled on Windows.".to_string()
                },
            })
        }
        "item-review-recycle-bin" => {
            let enabled = cfg!(target_os = "windows") && downloads_cleanup_executor_enabled();
            Some(WriteExecutorScaffold {
                route: "item-review-recycle-bin".to_string(),
                title: "Reviewed Downloads items".to_string(),
                feature_flag: "downloadsCleanupExecutor".to_string(),
                status: if enabled {
                    "feature-flag-enabled".to_string()
                } else {
                    "feature-flag-disabled".to_string()
                },
                validation_status: if enabled {
                    "reviewed-download-files-only".to_string()
                } else {
                    "validation-required".to_string()
                },
                mutation_enabled: enabled,
                reason: if enabled {
                    "Downloads executor can move reviewed old installer/archive files through Recycle Bin semantics only.".to_string()
                } else {
                    "Downloads executor scaffold is present, but mutation remains disabled until SPACEGUARD_ENABLE_DOWNLOADS_EXECUTOR is enabled on Windows.".to_string()
                },
            })
        }
        "item-review-large-files" => {
            let enabled = cfg!(target_os = "windows") && large_file_archive_executor_enabled();
            Some(WriteExecutorScaffold {
                route: "item-review-large-files".to_string(),
                title: "Reviewed large-file archive".to_string(),
                feature_flag: "largeFileArchiveExecutor".to_string(),
                status: if enabled {
                    "feature-flag-enabled".to_string()
                } else {
                    "feature-flag-disabled".to_string()
                },
                validation_status: if enabled {
                    "reviewed-large-files-archive-only".to_string()
                } else {
                    "validation-required".to_string()
                },
                mutation_enabled: enabled,
                reason: if enabled {
                    "Large-file archive executor can move reviewed old large files to an explicit archive destination on another drive only.".to_string()
                } else {
                    "Large-file archive scaffold is present, but mutation remains disabled until SPACEGUARD_ENABLE_LARGE_FILE_ARCHIVE_EXECUTOR is enabled on Windows.".to_string()
                },
            })
        }
        "item-review-project-cache" => {
            let enabled = cfg!(target_os = "windows") && project_dependency_executor_enabled();
            Some(WriteExecutorScaffold {
                route: "item-review-project-cache".to_string(),
                title: "Reviewed project dependencies".to_string(),
                feature_flag: "projectDependencyExecutor".to_string(),
                status: if enabled {
                    "feature-flag-enabled".to_string()
                } else {
                    "feature-flag-disabled".to_string()
                },
                validation_status: if enabled {
                    "reviewed-node-modules-only".to_string()
                } else {
                    "validation-required".to_string()
                },
                mutation_enabled: enabled,
                reason: if enabled {
                    "Project dependency executor can remove reviewed node_modules folders with parent package.json evidence.".to_string()
                } else {
                    "Project dependency executor scaffold is present, but mutation remains disabled until SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR is enabled on Windows.".to_string()
                },
            })
        }
        "browser-cache-only" => {
            let enabled = cfg!(target_os = "windows") && browser_cache_executor_enabled();
            Some(WriteExecutorScaffold {
                route: "browser-cache-only".to_string(),
                title: "Browser cache only".to_string(),
                feature_flag: "browserCacheExecutor".to_string(),
                status: if enabled {
                    "feature-flag-enabled".to_string()
                } else {
                    "feature-flag-disabled".to_string()
                },
                validation_status: if enabled {
                    "cache-roots-only".to_string()
                } else {
                    "validation-required".to_string()
                },
                mutation_enabled: enabled,
                reason: if enabled {
                    "Browser cache executor can remove files and empty dirs under scanned cache roots only.".to_string()
                } else {
                    "Browser cache executor scaffold is present, but mutation remains disabled until SPACEGUARD_ENABLE_BROWSER_CACHE_EXECUTOR is enabled on Windows.".to_string()
                },
            })
        }
        "bounded-cache-delete" => {
            let enabled = cfg!(target_os = "windows") && gradle_cache_executor_enabled();
            Some(WriteExecutorScaffold {
                route: "bounded-cache-delete".to_string(),
                title: "Bounded Gradle cache".to_string(),
                feature_flag: "gradleCacheExecutor".to_string(),
                status: if enabled {
                    "feature-flag-enabled".to_string()
                } else {
                    "feature-flag-disabled".to_string()
                },
                validation_status: if enabled {
                    "gradle-cache-only".to_string()
                } else {
                    "validation-required".to_string()
                },
                mutation_enabled: enabled,
                reason: if enabled {
                    "Gradle cache executor can remove old files and empty dirs under the current user's .gradle\\caches root only.".to_string()
                } else {
                    "Gradle cache executor scaffold is present, but mutation remains disabled until SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR is enabled on Windows.".to_string()
                },
            })
        }
        "bounded-user-cache-delete" => {
            let enabled = cfg!(target_os = "windows") && user_cache_executor_enabled();
            Some(WriteExecutorScaffold {
                route: "bounded-user-cache-delete".to_string(),
                title: "Bounded user .cache".to_string(),
                feature_flag: "userCacheExecutor".to_string(),
                status: if enabled {
                    "feature-flag-enabled".to_string()
                } else {
                    "feature-flag-disabled".to_string()
                },
                validation_status: if enabled {
                    "user-cache-only".to_string()
                } else {
                    "validation-required".to_string()
                },
                mutation_enabled: enabled,
                reason: if enabled {
                    "User .cache executor can remove old cache files and empty dirs under the current user's .cache root only.".to_string()
                } else {
                    "User .cache executor scaffold is present, but mutation remains disabled until SPACEGUARD_ENABLE_USER_CACHE_EXECUTOR is enabled on Windows.".to_string()
                },
            })
        }
        "bounded-android-cache-delete" => {
            let enabled = cfg!(target_os = "windows") && android_cache_executor_enabled();
            Some(WriteExecutorScaffold {
                route: "bounded-android-cache-delete".to_string(),
                title: "Bounded Android Studio cache".to_string(),
                feature_flag: "androidCacheExecutor".to_string(),
                status: if enabled {
                    "feature-flag-enabled".to_string()
                } else {
                    "feature-flag-disabled".to_string()
                },
                validation_status: if enabled {
                    "android-cache-only".to_string()
                } else {
                    "validation-required".to_string()
                },
                mutation_enabled: enabled,
                reason: if enabled {
                    "Android cache executor can remove old files and empty dirs under scanned Android Studio cache roots only.".to_string()
                } else {
                    "Android cache executor scaffold is present, but mutation remains disabled until SPACEGUARD_ENABLE_ANDROID_CACHE_EXECUTOR is enabled on Windows.".to_string()
                },
            })
        }
        "launcher-cache-cleanup" => {
            let enabled = cfg!(target_os = "windows") && shader_cache_executor_enabled();
            Some(WriteExecutorScaffold {
                route: "launcher-cache-cleanup".to_string(),
                title: "Bounded shader cache".to_string(),
                feature_flag: "shaderCacheExecutor".to_string(),
                status: if enabled {
                    "feature-flag-enabled".to_string()
                } else {
                    "feature-flag-disabled".to_string()
                },
                validation_status: if enabled {
                    "shader-cache-only".to_string()
                } else {
                    "validation-required".to_string()
                },
                mutation_enabled: enabled,
                reason: if enabled {
                    "Shader cache executor can remove old files and empty dirs under scanned LocalAppData shader cache roots only.".to_string()
                } else {
                    "Shader cache executor scaffold is present, but mutation remains disabled until SPACEGUARD_ENABLE_SHADER_CACHE_EXECUTOR is enabled on Windows.".to_string()
                },
            })
        }
        "bounded-pip-cache-delete" => {
            let enabled = cfg!(target_os = "windows") && pip_cache_executor_enabled();
            Some(WriteExecutorScaffold {
                route: "bounded-pip-cache-delete".to_string(),
                title: "Bounded pip cache".to_string(),
                feature_flag: "pipCacheExecutor".to_string(),
                status: if enabled {
                    "feature-flag-enabled".to_string()
                } else {
                    "feature-flag-disabled".to_string()
                },
                validation_status: if enabled {
                    "pip-cache-only".to_string()
                } else {
                    "validation-required".to_string()
                },
                mutation_enabled: enabled,
                reason: if enabled {
                    "pip cache executor can remove old files and empty dirs under the current user's LocalAppData\\pip\\Cache root only.".to_string()
                } else {
                    "pip cache executor scaffold is present, but mutation remains disabled until SPACEGUARD_ENABLE_PIP_CACHE_EXECUTOR is enabled on Windows.".to_string()
                },
            })
        }
        "tool-native-docker-build-cache-prune" => {
            let enabled = cfg!(target_os = "windows") && tool_native_prune_executors_enabled();
            Some(WriteExecutorScaffold {
                route: "tool-native-docker-build-cache-prune".to_string(),
                title: "Docker build-cache prune".to_string(),
                feature_flag: "toolNativePruneExecutors".to_string(),
                status: if enabled {
                    "feature-flag-enabled".to_string()
                } else {
                    "feature-flag-disabled".to_string()
                },
                validation_status: if enabled {
                    "docker-build-cache-only".to_string()
                } else {
                    "validation-required".to_string()
                },
                mutation_enabled: enabled,
                reason: if enabled {
                    "Docker build-cache executor can run only docker builder prune --force; volumes, running containers, images, and broad system prune stay outside the route.".to_string()
                } else {
                    "Docker build-cache executor scaffold is present, but mutation remains disabled until SPACEGUARD_ENABLE_TOOL_NATIVE_PRUNE_EXECUTORS is enabled on Windows.".to_string()
                },
            })
        }
        "bounded-npm-cache-delete" => {
            let enabled = cfg!(target_os = "windows") && npm_cache_executor_enabled();
            Some(WriteExecutorScaffold {
                route: "bounded-npm-cache-delete".to_string(),
                title: "Bounded npm cache".to_string(),
                feature_flag: "npmCacheExecutor".to_string(),
                status: if enabled {
                    "feature-flag-enabled".to_string()
                } else {
                    "feature-flag-disabled".to_string()
                },
                validation_status: if enabled {
                    "npm-cacache-only".to_string()
                } else {
                    "validation-required".to_string()
                },
                mutation_enabled: enabled,
                reason: if enabled {
                    "npm cache executor can remove old files and empty dirs under the current user's npm-cache\\_cacache root only.".to_string()
                } else {
                    "npm cache executor scaffold is present, but mutation remains disabled until SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR is enabled on Windows.".to_string()
                },
            })
        }
        "bounded-pnpm-store-delete" => {
            let enabled = cfg!(target_os = "windows") && pnpm_store_executor_enabled();
            Some(WriteExecutorScaffold {
                route: "bounded-pnpm-store-delete".to_string(),
                title: "Bounded pnpm store".to_string(),
                feature_flag: "pnpmStoreExecutor".to_string(),
                status: if enabled {
                    "feature-flag-enabled".to_string()
                } else {
                    "feature-flag-disabled".to_string()
                },
                validation_status: if enabled {
                    "pnpm-store-only".to_string()
                } else {
                    "validation-required".to_string()
                },
                mutation_enabled: enabled,
                reason: if enabled {
                    "pnpm store executor can remove old content/temp files and empty dirs under the current user's LocalAppData\\pnpm\\store root only.".to_string()
                } else {
                    "pnpm store executor scaffold is present, but mutation remains disabled until SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR is enabled on Windows.".to_string()
                },
            })
        }
        _ => None,
    }
}

fn write_executor_scaffold_reject_code(route: &str) -> &'static str {
    match route {
        "known-temp-delete" => "temp-executor-feature-flag-disabled",
        "shell-recycle-bin" => "recycle-bin-executor-disabled",
        "item-review-recycle-bin" => "downloads-executor-disabled",
        "item-review-large-files" => "large-file-archive-executor-disabled",
        "item-review-project-cache" => "project-deps-executor-disabled",
        "browser-cache-only" => "browser-cache-executor-disabled",
        "bounded-cache-delete" => "gradle-cache-executor-disabled",
        "bounded-user-cache-delete" => "user-cache-executor-disabled",
        "bounded-android-cache-delete" => "android-cache-executor-disabled",
        "launcher-cache-cleanup" => "shader-cache-executor-disabled",
        "bounded-pip-cache-delete" => "pip-cache-executor-disabled",
        "tool-native-docker-build-cache-prune" => "tool-native-prune-executors-disabled",
        "bounded-npm-cache-delete" => "npm-cache-executor-disabled",
        "bounded-pnpm-store-delete" => "pnpm-store-executor-disabled",
        _ => "real-executor-disabled",
    }
}

fn write_action_target_reject_code(
    route: &str,
    target_path: &Option<String>,
) -> Option<&'static str> {
    let target = normalize_write_target(target_path.as_deref().unwrap_or(""));
    if target.is_empty() {
        return Some("target-missing");
    }
    if route == "bounded-cache-delete" {
        return gradle_cache_target_reject_code(target_path.as_deref().unwrap_or(""));
    }
    if route == "bounded-user-cache-delete" {
        return user_cache_target_reject_code(target_path.as_deref().unwrap_or(""));
    }
    if route == "bounded-android-cache-delete" {
        return android_cache_target_reject_code(target_path.as_deref().unwrap_or(""));
    }
    if route == "launcher-cache-cleanup" {
        return shader_cache_target_reject_code(target_path.as_deref().unwrap_or(""));
    }
    if route == "bounded-pip-cache-delete" {
        return pip_cache_target_reject_code(target_path.as_deref().unwrap_or(""));
    }
    if route == "tool-native-docker-build-cache-prune" {
        return docker_build_cache_target_reject_code(target_path.as_deref().unwrap_or(""));
    }
    if route == "bounded-npm-cache-delete" {
        return npm_cache_target_reject_code(target_path.as_deref().unwrap_or(""));
    }
    if route == "bounded-pnpm-store-delete" {
        return pnpm_store_target_reject_code(target_path.as_deref().unwrap_or(""));
    }
    if route == "shell-recycle-bin" {
        return recycle_bin_target_reject_code(target_path.as_deref().unwrap_or(""));
    }
    if route == "item-review-recycle-bin" {
        return downloads_cleanup_target_reject_code(target_path.as_deref().unwrap_or(""));
    }
    if route == "item-review-large-files" {
        return large_file_archive_target_reject_code(target_path.as_deref().unwrap_or(""), "");
    }
    if route == "known-temp-delete" {
        return temp_cleanup_target_reject_code(target_path.as_deref().unwrap_or(""));
    }
    if write_target_forbidden(route, &target) {
        return Some("target-forbidden");
    }
    if !write_target_allowed(route, &target) {
        return Some("target-not-allowlisted");
    }
    None
}

fn normalize_write_target(value: &str) -> String {
    value
        .to_ascii_lowercase()
        .replace('/', "\\")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim_end_matches('\\')
        .to_string()
}

fn write_target_forbidden(route: &str, target: &str) -> bool {
    match route {
        "known-temp-delete" => {
            target.contains("downloads")
                || target.contains("documents")
                || target.contains("desktop")
                || target.contains("node_modules")
                || target.contains("reparse")
        }
        "shell-recycle-bin" => target.contains("downloads") || target.contains("documents"),
        "item-review-recycle-bin" => {
            target.contains("\\windows\\")
                || target.contains("\\program files")
                || target.contains("\\programdata\\")
                || target.contains("\\appdata\\roaming\\microsoft")
                || target.contains("\\desktop\\")
                || target.contains("\\documents\\")
                || target.contains("\\pictures\\")
                || target.contains("\\videos\\")
                || target.contains("\\music\\")
                || target.ends_with("\\downloads")
        }
        "item-review-large-files" => {
            target.contains("\\windows\\")
                || target.contains("\\program files")
                || target.contains("\\programdata\\")
                || target.contains("\\appdata\\")
                || target.contains("\\node_modules\\")
                || target.ends_with("\\downloads")
                || target.ends_with("\\desktop")
                || target.ends_with("\\documents")
                || target.ends_with("\\videos")
                || target.ends_with("\\pictures")
                || target.ends_with("\\music")
        }
        "browser-cache-only" => {
            target.contains("cookie")
                || target.contains("session")
                || target.contains("login")
                || target.contains("password")
                || target.contains("extension")
                || target.contains("identity")
                || target.contains("profile database")
                || target.contains("history")
                || target.contains("web data")
                || target.contains("bookmark")
                || target.contains("preference")
                || target.contains("favicon")
        }
        "bounded-cache-delete" => {
            target.contains("downloads")
                || target.contains("documents")
                || target.contains("desktop")
                || target.contains("node_modules")
                || target.contains("\\.gradle\\init.d")
                || target.contains("\\.gradle\\gradle.properties")
                || target.contains("\\.gradle\\daemon")
                || target.contains("\\.gradle\\wrapper")
                || target.contains("\\windows\\")
                || target.contains("\\program files")
        }
        "bounded-user-cache-delete" => {
            target.contains("downloads")
                || target.contains("documents")
                || target.contains("desktop")
                || target.contains("pictures")
                || target.contains("videos")
                || target.contains("music")
                || target.contains("node_modules")
                || target.contains("\\.git")
                || target.contains("\\windows\\")
                || target.contains("\\program files")
                || target.contains("\\programdata\\")
                || target.contains("\\appdata\\roaming\\microsoft")
                || target.contains("cookie")
                || target.contains("\\sessions")
                || target.contains("\\saved")
                || target.contains("\\identity")
                || target.contains("\\history")
        }
        "bounded-android-cache-delete" => {
            target.contains("downloads")
                || target.contains("documents")
                || target.contains("desktop")
                || target.contains("pictures")
                || target.contains("videos")
                || target.contains("music")
                || target.contains("node_modules")
                || target.contains("\\.git")
                || target.contains("\\windows\\")
                || target.contains("\\program files")
                || target.contains("\\programdata\\")
                || target.contains("\\appdata\\roaming")
                || target.contains("\\.android\\avd")
                || target.ends_with("\\.android")
                || target.contains("\\android\\sdk")
                || target.contains("\\android-sdk")
                || target.contains("\\sdk\\")
                || target.contains("\\emulator")
                || target.contains("\\system-images")
                || target.contains("\\platforms")
                || target.contains("\\build-tools")
                || target.contains("\\cmdline-tools")
                || target.contains("\\platform-tools")
                || target.contains("\\sources")
                || target.contains("\\gradle")
                || target.contains("\\projects")
        }
        "launcher-cache-cleanup" => {
            target.contains("downloads")
                || target.contains("documents")
                || target.contains("desktop")
                || target.contains("pictures")
                || target.contains("videos")
                || target.contains("music")
                || target.contains("node_modules")
                || target.contains("\\.git")
                || target.contains("\\windows\\")
                || target.contains("\\program files")
                || target.contains("\\programdata\\")
                || target.contains("\\appdata\\roaming")
                || target.contains("\\steam\\steamapps")
                || target.contains("\\epic games")
                || target.contains("\\gog galaxy\\games")
                || target.contains("\\xboxgames")
                || target.contains("\\saved games")
                || target.contains("\\saves")
                || target.contains("\\savegames")
                || target.contains("\\profiles")
                || target.contains("\\screenshots")
                || target.contains("\\config")
                || target.contains("\\settings")
                || target.contains("\\user data")
                || target.contains("\\packages")
        }
        "bounded-pip-cache-delete" => {
            target.contains("downloads")
                || target.contains("documents")
                || target.contains("desktop")
                || target.contains("node_modules")
                || target.contains("\\.git")
                || target.contains("\\windows\\")
                || target.contains("\\program files")
                || target.contains("\\programdata\\")
                || target.contains("\\appdata\\roaming")
                || target.contains("\\python")
                || target.contains("\\site-packages")
                || target.contains("\\scripts")
                || target.contains("\\venv")
                || target.contains("\\virtualenv")
                || target.contains("\\projects")
                || target.ends_with("\\pip")
                || target.contains("\\pip\\pip.ini")
                || target.contains("\\pip\\pip.conf")
                || target.contains("\\selfcheck")
        }
        "tool-native-docker-build-cache-prune" => {
            target.contains("\\")
                || target.contains("/")
                || target.contains("volume")
                || target.contains("container")
                || target.contains("image")
                || target.contains("system prune")
                || target.contains("--volumes")
                || target.contains("data-root")
        }
        "bounded-npm-cache-delete" => {
            target.contains("downloads")
                || target.contains("documents")
                || target.contains("desktop")
                || target.contains("node_modules")
                || target.contains("\\windows\\")
                || target.contains("\\program files")
                || target.contains("\\programdata\\")
                || target.contains("\\appdata\\roaming\\npm")
                || target.contains("\\npm\\node_modules")
        }
        "bounded-pnpm-store-delete" => {
            target.contains("downloads")
                || target.contains("documents")
                || target.contains("desktop")
                || target.contains("node_modules")
                || target.contains("\\windows\\")
                || target.contains("\\program files")
                || target.contains("\\programdata\\")
                || target.contains("\\appdata\\roaming\\pnpm")
                || target.contains("\\pnpm\\global")
        }
        "item-review-project-cache" => {
            !target.ends_with("\\node_modules")
                || target.contains("\\windows\\")
                || target.contains("\\program files")
                || target.contains("\\appdata\\roaming\\microsoft")
        }
        _ => true,
    }
}

fn write_target_allowed(route: &str, target: &str) -> bool {
    match route {
        "known-temp-delete" => {
            target.contains("windows\\temp")
                || target.contains("appdata\\local\\temp")
                || target.contains("%temp%")
                || target.contains("%tmp%")
        }
        "shell-recycle-bin" => target.contains("$recycle.bin") || target.contains("recycle bin"),
        "item-review-recycle-bin" => target.contains("\\downloads\\"),
        "item-review-large-files" => {
            target.contains("\\downloads\\")
                || target.contains("\\desktop\\")
                || target.contains("\\documents\\")
                || target.contains("\\videos\\")
                || target.contains("\\pictures\\")
                || target.contains("\\music\\")
        }
        "browser-cache-only" => {
            target.contains("\\cache")
                || target.contains("cache2")
                || target.contains("cache_data")
                || target.contains("code cache")
        }
        "bounded-cache-delete" => {
            target.ends_with("\\.gradle\\caches") || target.contains("\\.gradle\\caches\\")
        }
        "bounded-user-cache-delete" => {
            target.ends_with("\\.cache") || target.contains("\\.cache\\")
        }
        "bounded-android-cache-delete" => {
            target.ends_with("\\.android\\build-cache")
                || target.contains("\\.android\\build-cache\\")
                || (target.contains("\\appdata\\local\\google\\androidstudio")
                    && (target.ends_with("\\caches") || target.contains("\\caches\\")))
        }
        "launcher-cache-cleanup" => {
            target.ends_with("\\appdata\\local\\d3dscache")
                || target.contains("\\appdata\\local\\d3dscache\\")
                || target.ends_with("\\appdata\\local\\nvidia\\dxcache")
                || target.contains("\\appdata\\local\\nvidia\\dxcache\\")
                || target.ends_with("\\appdata\\local\\nvidia\\glcache")
                || target.contains("\\appdata\\local\\nvidia\\glcache\\")
                || target.ends_with("\\appdata\\local\\nvidia corporation\\nv_cache")
                || target.contains("\\appdata\\local\\nvidia corporation\\nv_cache\\")
                || target.ends_with("\\appdata\\local\\amd\\dxcache")
                || target.contains("\\appdata\\local\\amd\\dxcache\\")
                || target.ends_with("\\appdata\\local\\amd\\glcache")
                || target.contains("\\appdata\\local\\amd\\glcache\\")
                || target.ends_with("\\appdata\\local\\amd\\vkcache")
                || target.contains("\\appdata\\local\\amd\\vkcache\\")
                || target.ends_with("\\appdata\\local\\intel\\shadercache")
                || target.contains("\\appdata\\local\\intel\\shadercache\\")
        }
        "bounded-pip-cache-delete" => {
            target.ends_with("\\appdata\\local\\pip\\cache")
                || target.contains("\\appdata\\local\\pip\\cache\\")
        }
        "tool-native-docker-build-cache-prune" => target == "docker desktop build cache",
        "bounded-npm-cache-delete" => {
            target.ends_with("\\npm-cache\\_cacache") || target.contains("\\npm-cache\\_cacache\\")
        }
        "bounded-pnpm-store-delete" => {
            target.ends_with("\\pnpm\\store") || target.contains("\\pnpm\\store\\")
        }
        "item-review-project-cache" => {
            target.ends_with("\\node_modules") || target.contains("\\node_modules\\")
        }
        _ => false,
    }
}

fn write_boundary_warning(code: &str) -> &'static str {
    match code {
        "missing-plan-id" => "Write request rejected: missing current plan id.",
        "missing-scan-fingerprint" => {
            "Write request rejected: missing current scan-session fingerprint."
        }
        "missing-consent-plan-id" => "Write request rejected: missing current consent plan id.",
        "dry-run-only-required" => "Write request rejected: dryRunOnly must remain true.",
        "mutation-attempt-flag" => {
            "Write request rejected: mutationAttempted must remain false in this build."
        }
        "permanent-confirmation-required" => {
            "Write request rejected: permanent removal must be explicitly confirmed for Recycle Bin cleanup."
        }
        "request-mode-invalid" => "Write request rejected: request mode is not a disabled preview.",
        "route-not-first-safe" => {
            "Write request rejected: route is not a first-safe executor lane."
        }
        "target-missing" => "Write request rejected: selected action target path is missing.",
        "target-forbidden" => "Write request rejected: target path hits a forbidden target rule.",
        "target-not-allowlisted" => {
            "Write request rejected: target path does not match the route allowlist."
        }
        "temp-executor-feature-flag-disabled" => {
            "Write request rejected: tempCleanupExecutor scaffold is feature-flag disabled and still requires validation evidence."
        }
        "project-deps-executor-disabled" => {
            "Write request rejected: projectDependencyExecutor scaffold is feature-flag disabled."
        }
        "browser-cache-executor-disabled" => {
            "Write request rejected: browserCacheExecutor scaffold is feature-flag disabled."
        }
        "recycle-bin-executor-disabled" => {
            "Write request rejected: recycleBinExecutor scaffold is feature-flag disabled."
        }
        "downloads-executor-disabled" => {
            "Write request rejected: downloadsCleanupExecutor scaffold is feature-flag disabled."
        }
        "large-file-archive-executor-disabled" => {
            "Write request rejected: largeFileArchiveExecutor scaffold is feature-flag disabled."
        }
        "gradle-cache-executor-disabled" => {
            "Write request rejected: gradleCacheExecutor scaffold is feature-flag disabled."
        }
        "user-cache-executor-disabled" => {
            "Write request rejected: userCacheExecutor scaffold is feature-flag disabled."
        }
        "android-cache-executor-disabled" => {
            "Write request rejected: androidCacheExecutor scaffold is feature-flag disabled."
        }
        "shader-cache-executor-disabled" => {
            "Write request rejected: shaderCacheExecutor scaffold is feature-flag disabled."
        }
        "pip-cache-executor-disabled" => {
            "Write request rejected: pipCacheExecutor scaffold is feature-flag disabled."
        }
        "tool-native-prune-executors-disabled" => {
            "Write request rejected: toolNativePruneExecutors scaffold is feature-flag disabled."
        }
        "npm-cache-executor-disabled" => {
            "Write request rejected: npmCacheExecutor scaffold is feature-flag disabled."
        }
        "pnpm-store-executor-disabled" => {
            "Write request rejected: pnpmStoreExecutor scaffold is feature-flag disabled."
        }
        "target-not-node-modules" => "Write request rejected: project dependency target is not node_modules.",
        "target-not-browser-cache" => "Write request rejected: browser cache target is not a cache directory.",
        "route-not-browser-cache" => "Write request rejected: browser cache cleanup requires route browser-cache-only.",
        "target-not-recycle-bin" => {
            "Write request rejected: Recycle Bin target is not a scanned Shell Recycle Bin boundary."
        }
        "route-not-recycle-bin" => {
            "Write request rejected: Recycle Bin cleanup requires route shell-recycle-bin."
        }
        "recycle-bin-shell-api-failed" => {
            "Write request rejected: Windows Shell Recycle Bin API failed."
        }
        "target-not-downloads-file" => {
            "Write request rejected: reviewed Downloads target is not an allowed installer/archive file."
        }
        "target-not-downloads-folder" => {
            "Write request rejected: reviewed target is not inside the current user's Downloads folder."
        }
        "target-too-recent" => {
            "Write request rejected: reviewed Downloads file is too recent for native cleanup."
        }
        "target-link-or-not-file" => {
            "Write request rejected: reviewed target is link-like or not a regular file."
        }
        "route-not-downloads-review" => {
            "Write request rejected: reviewed Downloads cleanup requires route item-review-recycle-bin."
        }
        "downloads-recycle-bin-shell-api-failed" => {
            "Write request rejected: Windows Shell file recycle operation failed."
        }
        "target-not-large-user-file" => {
            "Write request rejected: reviewed target is not an allowed old large user file."
        }
        "target-not-user-review-folder" => {
            "Write request rejected: reviewed large-file target is not under an allowed current-user review folder."
        }
        "target-too-small" => {
            "Write request rejected: reviewed large-file target is below the native archive size threshold."
        }
        "archive-destination-missing" => {
            "Write request rejected: archive destination is missing."
        }
        "archive-destination-not-directory" => {
            "Write request rejected: archive destination is not an existing directory."
        }
        "archive-destination-forbidden" => {
            "Write request rejected: archive destination is a system, app, or protected folder."
        }
        "archive-destination-same-drive" => {
            "Write request rejected: archive destination must be on a different drive from the source file."
        }
        "route-not-large-file-review" => {
            "Write request rejected: large-file archive requires route item-review-large-files."
        }
        "large-file-archive-move-failed" => {
            "Write request rejected: archive copy or source removal failed."
        }
        "target-not-gradle-cache" => {
            "Write request rejected: Gradle cache target is not the current user's .gradle\\caches directory."
        }
        "route-not-bounded-cache" => {
            "Write request rejected: Gradle cache cleanup requires route bounded-cache-delete."
        }
        "target-not-user-cache" => {
            "Write request rejected: user .cache target is not the current user's .cache directory."
        }
        "route-not-bounded-user-cache" => {
            "Write request rejected: user .cache cleanup requires route bounded-user-cache-delete."
        }
        "target-not-android-cache" => {
            "Write request rejected: Android cache target is not a scanned Android Studio cache or .android build-cache directory."
        }
        "route-not-bounded-android-cache" => {
            "Write request rejected: Android cache cleanup requires route bounded-android-cache-delete."
        }
        "target-not-shader-cache" => {
            "Write request rejected: shader cache target is not a scanned current-user shader cache directory."
        }
        "route-not-launcher-cache-cleanup" => {
            "Write request rejected: shader cache cleanup requires route launcher-cache-cleanup."
        }
        "target-not-pip-cache" => {
            "Write request rejected: pip cache target is not the current user's LocalAppData\\pip\\Cache directory."
        }
        "route-not-bounded-pip-cache" => {
            "Write request rejected: pip cache cleanup requires route bounded-pip-cache-delete."
        }
        "target-not-docker-build-cache" => {
            "Write request rejected: Docker cleanup target is not the Docker build-cache inventory row."
        }
        "route-not-docker-build-cache-prune" => {
            "Write request rejected: Docker build-cache cleanup requires route tool-native-docker-build-cache-prune."
        }
        "docker-command-failed" => {
            "Write request failed while running the allowlisted Docker build-cache command."
        }
        "target-not-npm-cache" => {
            "Write request rejected: npm cache target is not the current user's npm-cache\\_cacache directory."
        }
        "route-not-bounded-npm-cache" => {
            "Write request rejected: npm cache cleanup requires route bounded-npm-cache-delete."
        }
        "target-not-pnpm-store" => {
            "Write request rejected: pnpm store target is not the current user's LocalAppData\\pnpm\\store directory."
        }
        "route-not-bounded-pnpm-store" => {
            "Write request rejected: pnpm store cleanup requires route bounded-pnpm-store-delete."
        }
        "target-link-or-not-directory" => {
            "Write request rejected: target is link-like or not a directory."
        }
        "target-missing-package-json" => "Write request rejected: parent project package.json is missing.",
        "no-actions" => "Write request rejected: no selected actions were supplied.",
        _ => "Write request rejected by native boundary validation.",
    }
}

fn temp_executor_enabled() -> bool {
    runtime_feature_flag_enabled("SPACEGUARD_ENABLE_TEMP_EXECUTOR")
}

fn project_dependency_executor_enabled() -> bool {
    runtime_feature_flag_enabled("SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR")
}

fn downloads_cleanup_executor_enabled() -> bool {
    runtime_feature_flag_enabled("SPACEGUARD_ENABLE_DOWNLOADS_EXECUTOR")
}

fn large_file_archive_executor_enabled() -> bool {
    runtime_feature_flag_enabled("SPACEGUARD_ENABLE_LARGE_FILE_ARCHIVE_EXECUTOR")
}

fn browser_cache_executor_enabled() -> bool {
    runtime_feature_flag_enabled("SPACEGUARD_ENABLE_BROWSER_CACHE_EXECUTOR")
}

fn gradle_cache_executor_enabled() -> bool {
    runtime_feature_flag_enabled("SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR")
}

fn user_cache_executor_enabled() -> bool {
    runtime_feature_flag_enabled("SPACEGUARD_ENABLE_USER_CACHE_EXECUTOR")
}

fn android_cache_executor_enabled() -> bool {
    runtime_feature_flag_enabled("SPACEGUARD_ENABLE_ANDROID_CACHE_EXECUTOR")
}

fn shader_cache_executor_enabled() -> bool {
    runtime_feature_flag_enabled("SPACEGUARD_ENABLE_SHADER_CACHE_EXECUTOR")
}

fn pip_cache_executor_enabled() -> bool {
    runtime_feature_flag_enabled("SPACEGUARD_ENABLE_PIP_CACHE_EXECUTOR")
}

fn tool_native_prune_executors_enabled() -> bool {
    runtime_feature_flag_enabled("SPACEGUARD_ENABLE_TOOL_NATIVE_PRUNE_EXECUTORS")
}

fn npm_cache_executor_enabled() -> bool {
    runtime_feature_flag_enabled("SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR")
}

fn pnpm_store_executor_enabled() -> bool {
    runtime_feature_flag_enabled("SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR")
}

fn recycle_bin_executor_enabled() -> bool {
    runtime_feature_flag_enabled("SPACEGUARD_ENABLE_RECYCLE_BIN_EXECUTOR")
}

fn runtime_feature_flag_enabled(name: &str) -> bool {
    runtime_env_value(&[name])
        .map(|(value, _)| is_truthy_runtime_flag(&value))
        .unwrap_or(false)
}

fn scoped_executor_enabled_on_windows(flag_enabled: bool) -> bool {
    cfg!(target_os = "windows") && flag_enabled
}

fn is_truthy_runtime_flag(value: &str) -> bool {
    matches!(
        value.trim().to_ascii_lowercase().as_str(),
        "1" | "true" | "yes" | "on"
    )
}

fn temp_execution_rejections(
    request: &WriteExecutionRequest,
    flag_enabled: bool,
) -> Vec<&'static str> {
    let mut codes = Vec::new();
    if !cfg!(target_os = "windows") {
        codes.push("windows-required");
    }
    if !flag_enabled {
        codes.push("temp-executor-feature-flag-disabled");
    }
    if request.plan_id.trim().is_empty() {
        codes.push("missing-plan-id");
    }
    if request
        .scan_fingerprint
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-scan-fingerprint");
    }
    if request
        .consent_plan_id
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-consent-plan-id");
    }
    if request.request_mode.as_deref() != Some("execute-first-safe") {
        codes.push("request-mode-invalid");
    }
    if request.route != "known-temp-delete" {
        codes.push("route-not-first-safe");
    }
    if request.dry_run_only != Some(false) {
        codes.push("dry-run-disabled-required");
    }
    if request.mutation_attempted != Some(true) {
        codes.push("mutation-confirmation-required");
    }
    if request.actions.is_empty() {
        codes.push("no-actions");
    }
    if request.actions.len() > 1 {
        codes.push("docker-action-count-invalid");
    }
    codes
}

fn temp_execution_warnings(codes: &[&'static str]) -> Vec<String> {
    if codes.is_empty() {
        return vec![
            "Temp cleanup executor deletes files only, skips symlinks and recent files, and never removes directories.".to_string(),
        ];
    }
    codes
        .iter()
        .map(|code| match *code {
            "windows-required" => "Real temp cleanup is Windows-only.",
            "dry-run-disabled-required" => {
                "Real temp cleanup requires dryRunOnly=false on the execute-first-safe request."
            }
            "mutation-confirmation-required" => {
                "Real temp cleanup requires mutationAttempted=true on the execute-first-safe request."
            }
            "temp-executor-feature-flag-disabled" => {
                "Set SPACEGUARD_ENABLE_TEMP_EXECUTOR=1 before launching the Tauri app to enable this executor."
            }
            "request-mode-invalid" => "Real temp cleanup requires requestMode=execute-first-safe.",
            _ => write_boundary_warning(code),
        })
        .map(String::from)
        .collect()
}

fn project_dependency_execution_rejections(
    request: &WriteExecutionRequest,
    flag_enabled: bool,
) -> Vec<&'static str> {
    let mut codes = Vec::new();
    if !cfg!(target_os = "windows") {
        codes.push("windows-required");
    }
    if !flag_enabled {
        codes.push("project-deps-executor-disabled");
    }
    if request.plan_id.trim().is_empty() {
        codes.push("missing-plan-id");
    }
    if request
        .scan_fingerprint
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-scan-fingerprint");
    }
    if request
        .consent_plan_id
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-consent-plan-id");
    }
    if request.request_mode.as_deref() != Some("execute-project-deps") {
        codes.push("request-mode-invalid");
    }
    if request.route != "item-review-project-cache" {
        codes.push("route-not-project-cache");
    }
    if request.dry_run_only != Some(false) {
        codes.push("dry-run-disabled-required");
    }
    if request.mutation_attempted != Some(true) {
        codes.push("mutation-confirmation-required");
    }
    if request.actions.is_empty() {
        codes.push("no-actions");
    }
    codes
}

fn project_dependency_execution_warnings(codes: &[&'static str]) -> Vec<String> {
    if codes.is_empty() {
        return vec![
            "Project dependency executor removes reviewed node_modules targets only and requires parent package.json evidence.".to_string(),
        ];
    }
    codes
        .iter()
        .map(|code| match *code {
            "windows-required" => "Project dependency cleanup is Windows-only in this build.",
            "project-deps-executor-disabled" => {
                "Set SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR=1 before launching the Tauri app to enable reviewed node_modules cleanup."
            }
            "dry-run-disabled-required" => {
                "Project dependency cleanup requires dryRunOnly=false on the execute-project-deps request."
            }
            "mutation-confirmation-required" => {
                "Project dependency cleanup requires mutationAttempted=true on the execute-project-deps request."
            }
            "request-mode-invalid" => "Project dependency cleanup requires requestMode=execute-project-deps.",
            "route-not-project-cache" => "Project dependency cleanup requires route item-review-project-cache.",
            _ => write_boundary_warning(code),
        })
        .map(String::from)
        .collect()
}

fn downloads_cleanup_execution_rejections(
    request: &WriteExecutionRequest,
    flag_enabled: bool,
) -> Vec<&'static str> {
    let mut codes = Vec::new();
    if !cfg!(target_os = "windows") {
        codes.push("windows-required");
    }
    if !flag_enabled {
        codes.push("downloads-executor-disabled");
    }
    if request.plan_id.trim().is_empty() {
        codes.push("missing-plan-id");
    }
    if request
        .scan_fingerprint
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-scan-fingerprint");
    }
    if request
        .consent_plan_id
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-consent-plan-id");
    }
    if request.request_mode.as_deref() != Some("execute-downloads-recycle-bin") {
        codes.push("request-mode-invalid");
    }
    if request.route != "item-review-recycle-bin" {
        codes.push("route-not-downloads-review");
    }
    if request.dry_run_only != Some(false) {
        codes.push("dry-run-disabled-required");
    }
    if request.mutation_attempted != Some(true) {
        codes.push("mutation-confirmation-required");
    }
    if request.actions.is_empty() {
        codes.push("no-actions");
    }
    codes
}

fn downloads_cleanup_execution_warnings(codes: &[&'static str]) -> Vec<String> {
    if codes.is_empty() {
        return vec![
            "Reviewed Downloads executor moves selected old installer/archive files through Recycle Bin semantics only.".to_string(),
        ];
    }
    codes
        .iter()
        .map(|code| match *code {
            "windows-required" => "Reviewed Downloads cleanup is Windows-only in this build.",
            "downloads-executor-disabled" => {
                "Set SPACEGUARD_ENABLE_DOWNLOADS_EXECUTOR=1 before launching the Tauri app to enable reviewed Downloads cleanup."
            }
            "dry-run-disabled-required" => {
                "Reviewed Downloads cleanup requires dryRunOnly=false on the execute-downloads-recycle-bin request."
            }
            "mutation-confirmation-required" => {
                "Reviewed Downloads cleanup requires mutationAttempted=true on the execute-downloads-recycle-bin request."
            }
            "request-mode-invalid" => {
                "Reviewed Downloads cleanup requires requestMode=execute-downloads-recycle-bin."
            }
            "route-not-downloads-review" => {
                "Reviewed Downloads cleanup requires route item-review-recycle-bin."
            }
            _ => write_boundary_warning(code),
        })
        .map(String::from)
        .collect()
}

fn large_file_archive_execution_rejections(
    request: &WriteExecutionRequest,
    flag_enabled: bool,
) -> Vec<&'static str> {
    let mut codes = Vec::new();
    if !cfg!(target_os = "windows") {
        codes.push("windows-required");
    }
    if !flag_enabled {
        codes.push("large-file-archive-executor-disabled");
    }
    if request.plan_id.trim().is_empty() {
        codes.push("missing-plan-id");
    }
    if request
        .scan_fingerprint
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-scan-fingerprint");
    }
    if request
        .consent_plan_id
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-consent-plan-id");
    }
    if request.request_mode.as_deref() != Some("execute-large-file-archive") {
        codes.push("request-mode-invalid");
    }
    if request.route != "item-review-large-files" {
        codes.push("route-not-large-file-review");
    }
    if request.dry_run_only != Some(false) {
        codes.push("dry-run-disabled-required");
    }
    if request.mutation_attempted != Some(true) {
        codes.push("mutation-confirmation-required");
    }
    if request.actions.is_empty() {
        codes.push("no-actions");
    }
    if let Some(code) =
        archive_destination_reject_code(request.archive_destination.as_deref().unwrap_or_default())
    {
        codes.push(code);
    }
    codes
}

fn large_file_archive_execution_warnings(codes: &[&'static str]) -> Vec<String> {
    if codes.is_empty() {
        return vec![
            "Reviewed large-file archive moves selected old large files to the explicit archive destination only.".to_string(),
        ];
    }
    codes
        .iter()
        .map(|code| match *code {
            "windows-required" => "Reviewed large-file archive is Windows-only in this build.",
            "large-file-archive-executor-disabled" => {
                "Set SPACEGUARD_ENABLE_LARGE_FILE_ARCHIVE_EXECUTOR=1 before launching the Tauri app to enable reviewed large-file archive."
            }
            "dry-run-disabled-required" => {
                "Reviewed large-file archive requires dryRunOnly=false on the execute-large-file-archive request."
            }
            "mutation-confirmation-required" => {
                "Reviewed large-file archive requires mutationAttempted=true on the execute-large-file-archive request."
            }
            "request-mode-invalid" => {
                "Reviewed large-file archive requires requestMode=execute-large-file-archive."
            }
            "route-not-large-file-review" => {
                "Reviewed large-file archive requires route item-review-large-files."
            }
            _ => write_boundary_warning(code),
        })
        .map(String::from)
        .collect()
}

fn browser_cache_execution_rejections(
    request: &WriteExecutionRequest,
    flag_enabled: bool,
) -> Vec<&'static str> {
    let mut codes = Vec::new();
    if !cfg!(target_os = "windows") {
        codes.push("windows-required");
    }
    if !flag_enabled {
        codes.push("browser-cache-executor-disabled");
    }
    if request.plan_id.trim().is_empty() {
        codes.push("missing-plan-id");
    }
    if request
        .scan_fingerprint
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-scan-fingerprint");
    }
    if request
        .consent_plan_id
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-consent-plan-id");
    }
    if request.request_mode.as_deref() != Some("execute-browser-cache") {
        codes.push("request-mode-invalid");
    }
    if request.route != "browser-cache-only" {
        codes.push("route-not-browser-cache");
    }
    if request.dry_run_only != Some(false) {
        codes.push("dry-run-disabled-required");
    }
    if request.mutation_attempted != Some(true) {
        codes.push("mutation-confirmation-required");
    }
    if request.actions.is_empty() {
        codes.push("no-actions");
    }
    codes
}

fn browser_cache_execution_warnings(codes: &[&'static str]) -> Vec<String> {
    if codes.is_empty() {
        return vec![
            "Browser cache executor removes cache files and empty cache subdirectories only; identity stores remain forbidden.".to_string(),
        ];
    }
    codes
        .iter()
        .map(|code| match *code {
            "windows-required" => "Browser cache cleanup is Windows-only in this build.",
            "browser-cache-executor-disabled" => {
                "Set SPACEGUARD_ENABLE_BROWSER_CACHE_EXECUTOR=1 before launching the Tauri app to enable browser cache cleanup."
            }
            "dry-run-disabled-required" => {
                "Browser cache cleanup requires dryRunOnly=false on the execute-browser-cache request."
            }
            "mutation-confirmation-required" => {
                "Browser cache cleanup requires mutationAttempted=true on the execute-browser-cache request."
            }
            "request-mode-invalid" => "Browser cache cleanup requires requestMode=execute-browser-cache.",
            "route-not-browser-cache" => "Browser cache cleanup requires route browser-cache-only.",
            _ => write_boundary_warning(code),
        })
        .map(String::from)
        .collect()
}

fn gradle_cache_execution_rejections(
    request: &WriteExecutionRequest,
    flag_enabled: bool,
) -> Vec<&'static str> {
    let mut codes = Vec::new();
    if !cfg!(target_os = "windows") {
        codes.push("windows-required");
    }
    if !flag_enabled {
        codes.push("gradle-cache-executor-disabled");
    }
    if request.plan_id.trim().is_empty() {
        codes.push("missing-plan-id");
    }
    if request
        .scan_fingerprint
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-scan-fingerprint");
    }
    if request
        .consent_plan_id
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-consent-plan-id");
    }
    if request.request_mode.as_deref() != Some("execute-gradle-cache") {
        codes.push("request-mode-invalid");
    }
    if request.route != "bounded-cache-delete" {
        codes.push("route-not-bounded-cache");
    }
    if request.dry_run_only != Some(false) {
        codes.push("dry-run-disabled-required");
    }
    if request.mutation_attempted != Some(true) {
        codes.push("mutation-confirmation-required");
    }
    if request.actions.is_empty() {
        codes.push("no-actions");
    }
    codes
}

fn gradle_cache_execution_warnings(codes: &[&'static str]) -> Vec<String> {
    if codes.is_empty() {
        return vec![
            "Gradle cache executor removes old cache files and empty cache subdirectories only; daemon, wrapper, init scripts, project sources, and package folders remain forbidden.".to_string(),
        ];
    }
    codes
        .iter()
        .map(|code| match *code {
            "windows-required" => "Gradle cache cleanup is Windows-only in this build.",
            "gradle-cache-executor-disabled" => {
                "Set SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR=1 before launching the Tauri app to enable Gradle cache cleanup."
            }
            "dry-run-disabled-required" => {
                "Gradle cache cleanup requires dryRunOnly=false on the execute-gradle-cache request."
            }
            "mutation-confirmation-required" => {
                "Gradle cache cleanup requires mutationAttempted=true on the execute-gradle-cache request."
            }
            "request-mode-invalid" => "Gradle cache cleanup requires requestMode=execute-gradle-cache.",
            "route-not-bounded-cache" => "Gradle cache cleanup requires route bounded-cache-delete.",
            _ => write_boundary_warning(code),
        })
        .map(String::from)
        .collect()
}

fn npm_cache_execution_rejections(
    request: &WriteExecutionRequest,
    flag_enabled: bool,
) -> Vec<&'static str> {
    let mut codes = Vec::new();
    if !cfg!(target_os = "windows") {
        codes.push("windows-required");
    }
    if !flag_enabled {
        codes.push("npm-cache-executor-disabled");
    }
    if request.plan_id.trim().is_empty() {
        codes.push("missing-plan-id");
    }
    if request
        .scan_fingerprint
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-scan-fingerprint");
    }
    if request
        .consent_plan_id
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-consent-plan-id");
    }
    if request.request_mode.as_deref() != Some("execute-npm-cache") {
        codes.push("request-mode-invalid");
    }
    if request.route != "bounded-npm-cache-delete" {
        codes.push("route-not-bounded-npm-cache");
    }
    if request.dry_run_only != Some(false) {
        codes.push("dry-run-disabled-required");
    }
    if request.mutation_attempted != Some(true) {
        codes.push("mutation-confirmation-required");
    }
    if request.actions.is_empty() {
        codes.push("no-actions");
    }
    codes
}

fn user_cache_execution_rejections(
    request: &WriteExecutionRequest,
    flag_enabled: bool,
) -> Vec<&'static str> {
    let mut codes = Vec::new();
    if !cfg!(target_os = "windows") {
        codes.push("windows-required");
    }
    if !flag_enabled {
        codes.push("user-cache-executor-disabled");
    }
    if request.plan_id.trim().is_empty() {
        codes.push("missing-plan-id");
    }
    if request
        .scan_fingerprint
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-scan-fingerprint");
    }
    if request
        .consent_plan_id
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-consent-plan-id");
    }
    if request.request_mode.as_deref() != Some("execute-user-cache") {
        codes.push("request-mode-invalid");
    }
    if request.route != "bounded-user-cache-delete" {
        codes.push("route-not-bounded-user-cache");
    }
    if request.dry_run_only != Some(false) {
        codes.push("dry-run-disabled-required");
    }
    if request.mutation_attempted != Some(true) {
        codes.push("mutation-confirmation-required");
    }
    if request.actions.is_empty() {
        codes.push("no-actions");
    }
    codes
}

fn user_cache_execution_warnings(codes: &[&'static str]) -> Vec<String> {
    if codes.is_empty() {
        return vec![
            "User .cache executor removes old cache files and empty cache subdirectories under the current user's .cache root only; config, database, lock, log, project, and identity-like files remain forbidden.".to_string(),
        ];
    }
    codes
        .iter()
        .map(|code| match *code {
            "windows-required" => "User .cache cleanup is Windows-only in this build.",
            "user-cache-executor-disabled" => {
                "Set SPACEGUARD_ENABLE_USER_CACHE_EXECUTOR=1 before launching the Tauri app to enable user .cache cleanup."
            }
            "dry-run-disabled-required" => {
                "User .cache cleanup requires dryRunOnly=false on the execute-user-cache request."
            }
            "mutation-confirmation-required" => {
                "User .cache cleanup requires mutationAttempted=true on the execute-user-cache request."
            }
            "request-mode-invalid" => "User .cache cleanup requires requestMode=execute-user-cache.",
            "route-not-bounded-user-cache" => {
                "User .cache cleanup requires route bounded-user-cache-delete."
            }
            _ => write_boundary_warning(code),
        })
        .map(String::from)
        .collect()
}

fn android_cache_execution_rejections(
    request: &WriteExecutionRequest,
    flag_enabled: bool,
) -> Vec<&'static str> {
    let mut codes = Vec::new();
    if !cfg!(target_os = "windows") {
        codes.push("windows-required");
    }
    if !flag_enabled {
        codes.push("android-cache-executor-disabled");
    }
    if request.plan_id.trim().is_empty() {
        codes.push("missing-plan-id");
    }
    if request
        .scan_fingerprint
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-scan-fingerprint");
    }
    if request
        .consent_plan_id
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-consent-plan-id");
    }
    if request.request_mode.as_deref() != Some("execute-android-cache") {
        codes.push("request-mode-invalid");
    }
    if request.route != "bounded-android-cache-delete" {
        codes.push("route-not-bounded-android-cache");
    }
    if request.dry_run_only != Some(false) {
        codes.push("dry-run-disabled-required");
    }
    if request.mutation_attempted != Some(true) {
        codes.push("mutation-confirmation-required");
    }
    if request.actions.is_empty() {
        codes.push("no-actions");
    }
    codes
}

fn android_cache_execution_warnings(codes: &[&'static str]) -> Vec<String> {
    if codes.is_empty() {
        return vec![
            "Android cache executor removes old files and empty cache subdirectories under scanned Android Studio cache roots only; AVDs, SDKs, project files, Gradle data, and identity/config files remain forbidden.".to_string(),
        ];
    }
    codes
        .iter()
        .map(|code| match *code {
            "windows-required" => "Android cache cleanup is Windows-only in this build.",
            "android-cache-executor-disabled" => {
                "Set SPACEGUARD_ENABLE_ANDROID_CACHE_EXECUTOR=1 before launching the Tauri app to enable Android cache cleanup."
            }
            "dry-run-disabled-required" => {
                "Android cache cleanup requires dryRunOnly=false on the execute-android-cache request."
            }
            "mutation-confirmation-required" => {
                "Android cache cleanup requires mutationAttempted=true on the execute-android-cache request."
            }
            "request-mode-invalid" => "Android cache cleanup requires requestMode=execute-android-cache.",
            "route-not-bounded-android-cache" => {
                "Android cache cleanup requires route bounded-android-cache-delete."
            }
            _ => write_boundary_warning(code),
        })
        .map(String::from)
        .collect()
}

fn shader_cache_execution_rejections(
    request: &WriteExecutionRequest,
    flag_enabled: bool,
) -> Vec<&'static str> {
    let mut codes = Vec::new();
    if !cfg!(target_os = "windows") {
        codes.push("windows-required");
    }
    if !flag_enabled {
        codes.push("shader-cache-executor-disabled");
    }
    if request.plan_id.trim().is_empty() {
        codes.push("missing-plan-id");
    }
    if request
        .scan_fingerprint
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-scan-fingerprint");
    }
    if request
        .consent_plan_id
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-consent-plan-id");
    }
    if request.request_mode.as_deref() != Some("execute-shader-cache") {
        codes.push("request-mode-invalid");
    }
    if request.route != "launcher-cache-cleanup" {
        codes.push("route-not-launcher-cache-cleanup");
    }
    if request.dry_run_only != Some(false) {
        codes.push("dry-run-disabled-required");
    }
    if request.mutation_attempted != Some(true) {
        codes.push("mutation-confirmation-required");
    }
    if request.actions.is_empty() {
        codes.push("no-actions");
    }
    codes
}

fn shader_cache_execution_warnings(codes: &[&'static str]) -> Vec<String> {
    if codes.is_empty() {
        return vec![
            "Shader cache executor removes old files and empty cache subdirectories under scanned LocalAppData shader cache roots only; game installs, saves, profiles, configs, launchers, and system paths remain forbidden.".to_string(),
        ];
    }
    codes
        .iter()
        .map(|code| match *code {
            "windows-required" => "Shader cache cleanup is Windows-only in this build.",
            "shader-cache-executor-disabled" => {
                "Set SPACEGUARD_ENABLE_SHADER_CACHE_EXECUTOR=1 before launching the Tauri app to enable shader cache cleanup."
            }
            "dry-run-disabled-required" => {
                "Shader cache cleanup requires dryRunOnly=false on the execute-shader-cache request."
            }
            "mutation-confirmation-required" => {
                "Shader cache cleanup requires mutationAttempted=true on the execute-shader-cache request."
            }
            "request-mode-invalid" => "Shader cache cleanup requires requestMode=execute-shader-cache.",
            "route-not-launcher-cache-cleanup" => {
                "Shader cache cleanup requires route launcher-cache-cleanup."
            }
            _ => write_boundary_warning(code),
        })
        .map(String::from)
        .collect()
}

fn pip_cache_execution_rejections(
    request: &WriteExecutionRequest,
    flag_enabled: bool,
) -> Vec<&'static str> {
    let mut codes = Vec::new();
    if !cfg!(target_os = "windows") {
        codes.push("windows-required");
    }
    if !flag_enabled {
        codes.push("pip-cache-executor-disabled");
    }
    if request.plan_id.trim().is_empty() {
        codes.push("missing-plan-id");
    }
    if request
        .scan_fingerprint
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-scan-fingerprint");
    }
    if request
        .consent_plan_id
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-consent-plan-id");
    }
    if request.request_mode.as_deref() != Some("execute-pip-cache") {
        codes.push("request-mode-invalid");
    }
    if request.route != "bounded-pip-cache-delete" {
        codes.push("route-not-bounded-pip-cache");
    }
    if request.dry_run_only != Some(false) {
        codes.push("dry-run-disabled-required");
    }
    if request.mutation_attempted != Some(true) {
        codes.push("mutation-confirmation-required");
    }
    if request.actions.is_empty() {
        codes.push("no-actions");
    }
    codes
}

fn pip_cache_execution_warnings(codes: &[&'static str]) -> Vec<String> {
    if codes.is_empty() {
        return vec![
            "pip cache executor removes old files and empty cache subdirectories under LocalAppData\\pip\\Cache only; Python installs, virtualenvs, site-packages, pip config, and package-manager commands remain forbidden.".to_string(),
        ];
    }
    codes
        .iter()
        .map(|code| match *code {
            "windows-required" => "pip cache cleanup is Windows-only in this build.",
            "pip-cache-executor-disabled" => {
                "Set SPACEGUARD_ENABLE_PIP_CACHE_EXECUTOR=1 before launching the Tauri app to enable pip cache cleanup."
            }
            "dry-run-disabled-required" => {
                "pip cache cleanup requires dryRunOnly=false on the execute-pip-cache request."
            }
            "mutation-confirmation-required" => {
                "pip cache cleanup requires mutationAttempted=true on the execute-pip-cache request."
            }
            "request-mode-invalid" => "pip cache cleanup requires requestMode=execute-pip-cache.",
            "route-not-bounded-pip-cache" => {
                "pip cache cleanup requires route bounded-pip-cache-delete."
            }
            _ => write_boundary_warning(code),
        })
        .map(String::from)
        .collect()
}

fn docker_build_cache_execution_rejections(
    request: &WriteExecutionRequest,
    flag_enabled: bool,
) -> Vec<&'static str> {
    let mut codes = Vec::new();
    if !cfg!(target_os = "windows") {
        codes.push("windows-required");
    }
    if !flag_enabled {
        codes.push("tool-native-prune-executors-disabled");
    }
    if request.plan_id.trim().is_empty() {
        codes.push("missing-plan-id");
    }
    if request
        .scan_fingerprint
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-scan-fingerprint");
    }
    if request
        .consent_plan_id
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-consent-plan-id");
    }
    if request.request_mode.as_deref() != Some("execute-docker-build-cache") {
        codes.push("request-mode-invalid");
    }
    if request.route != "tool-native-docker-build-cache-prune" {
        codes.push("route-not-docker-build-cache-prune");
    }
    if request.dry_run_only != Some(false) {
        codes.push("dry-run-disabled-required");
    }
    if request.mutation_attempted != Some(true) {
        codes.push("mutation-confirmation-required");
    }
    if request.actions.is_empty() {
        codes.push("no-actions");
    }
    codes
}

fn docker_build_cache_execution_warnings(codes: &[&'static str]) -> Vec<String> {
    if codes.is_empty() {
        return vec![
            "Docker build-cache executor runs only docker builder prune --force through Command::new(\"docker\"); Docker volumes, running containers, images, data-root folders, PowerShell, and broad system prune stay forbidden.".to_string(),
        ];
    }
    codes
        .iter()
        .map(|code| match *code {
            "windows-required" => "Docker build-cache cleanup is Windows-only in this build.",
            "tool-native-prune-executors-disabled" => {
                "Set SPACEGUARD_ENABLE_TOOL_NATIVE_PRUNE_EXECUTORS=1 before launching the Tauri app to enable Docker build-cache cleanup."
            }
            "dry-run-disabled-required" => {
                "Docker build-cache cleanup requires dryRunOnly=false on the execute-docker-build-cache request."
            }
            "mutation-confirmation-required" => {
                "Docker build-cache cleanup requires mutationAttempted=true on the execute-docker-build-cache request."
            }
            "request-mode-invalid" => {
                "Docker build-cache cleanup requires requestMode=execute-docker-build-cache."
            }
            "docker-action-count-invalid" => {
                "Docker build-cache cleanup accepts exactly one inventory action."
            }
            "route-not-docker-build-cache-prune" => {
                "Docker build-cache cleanup requires route tool-native-docker-build-cache-prune."
            }
            _ => write_boundary_warning(code),
        })
        .map(String::from)
        .collect()
}

fn npm_cache_execution_warnings(codes: &[&'static str]) -> Vec<String> {
    if codes.is_empty() {
        return vec![
            "npm cache executor removes old files and empty cache subdirectories under npm-cache\\_cacache only; global packages, project node_modules, and package-manager commands remain forbidden.".to_string(),
        ];
    }
    codes
        .iter()
        .map(|code| match *code {
            "windows-required" => "npm cache cleanup is Windows-only in this build.",
            "npm-cache-executor-disabled" => {
                "Set SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR=1 before launching the Tauri app to enable npm cache cleanup."
            }
            "dry-run-disabled-required" => {
                "npm cache cleanup requires dryRunOnly=false on the execute-npm-cache request."
            }
            "mutation-confirmation-required" => {
                "npm cache cleanup requires mutationAttempted=true on the execute-npm-cache request."
            }
            "request-mode-invalid" => "npm cache cleanup requires requestMode=execute-npm-cache.",
            "route-not-bounded-npm-cache" => {
                "npm cache cleanup requires route bounded-npm-cache-delete."
            }
            _ => write_boundary_warning(code),
        })
        .map(String::from)
        .collect()
}

fn pnpm_store_execution_rejections(
    request: &WriteExecutionRequest,
    flag_enabled: bool,
) -> Vec<&'static str> {
    let mut codes = Vec::new();
    if !cfg!(target_os = "windows") {
        codes.push("windows-required");
    }
    if !flag_enabled {
        codes.push("pnpm-store-executor-disabled");
    }
    if request.plan_id.trim().is_empty() {
        codes.push("missing-plan-id");
    }
    if request
        .scan_fingerprint
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-scan-fingerprint");
    }
    if request
        .consent_plan_id
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-consent-plan-id");
    }
    if request.request_mode.as_deref() != Some("execute-pnpm-store") {
        codes.push("request-mode-invalid");
    }
    if request.route != "bounded-pnpm-store-delete" {
        codes.push("route-not-bounded-pnpm-store");
    }
    if request.dry_run_only != Some(false) {
        codes.push("dry-run-disabled-required");
    }
    if request.mutation_attempted != Some(true) {
        codes.push("mutation-confirmation-required");
    }
    if request.actions.is_empty() {
        codes.push("no-actions");
    }
    codes
}

fn pnpm_store_execution_warnings(codes: &[&'static str]) -> Vec<String> {
    if codes.is_empty() {
        return vec![
            "pnpm store executor removes old content/temp files and empty cache subdirectories under LocalAppData\\pnpm\\store only; project node_modules, global bins, metadata, and package-manager commands remain forbidden.".to_string(),
        ];
    }
    codes
        .iter()
        .map(|code| match *code {
            "windows-required" => "pnpm store cleanup is Windows-only in this build.",
            "pnpm-store-executor-disabled" => {
                "Set SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR=1 before launching the Tauri app to enable pnpm store cleanup."
            }
            "dry-run-disabled-required" => {
                "pnpm store cleanup requires dryRunOnly=false on the execute-pnpm-store request."
            }
            "mutation-confirmation-required" => {
                "pnpm store cleanup requires mutationAttempted=true on the execute-pnpm-store request."
            }
            "request-mode-invalid" => "pnpm store cleanup requires requestMode=execute-pnpm-store.",
            "route-not-bounded-pnpm-store" => {
                "pnpm store cleanup requires route bounded-pnpm-store-delete."
            }
            _ => write_boundary_warning(code),
        })
        .map(String::from)
        .collect()
}

fn recycle_bin_execution_rejections(
    request: &WriteExecutionRequest,
    flag_enabled: bool,
) -> Vec<&'static str> {
    let mut codes = Vec::new();
    if !cfg!(target_os = "windows") {
        codes.push("windows-required");
    }
    if !flag_enabled {
        codes.push("recycle-bin-executor-disabled");
    }
    if request.plan_id.trim().is_empty() {
        codes.push("missing-plan-id");
    }
    if request
        .scan_fingerprint
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-scan-fingerprint");
    }
    if request
        .consent_plan_id
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        codes.push("missing-consent-plan-id");
    }
    if request.request_mode.as_deref() != Some("execute-recycle-bin") {
        codes.push("request-mode-invalid");
    }
    if request.route != "shell-recycle-bin" {
        codes.push("route-not-recycle-bin");
    }
    if request.dry_run_only != Some(false) {
        codes.push("dry-run-disabled-required");
    }
    if request.mutation_attempted != Some(true) {
        codes.push("mutation-confirmation-required");
    }
    if request.permanent_removal_confirmed != Some(true) {
        codes.push("permanent-confirmation-required");
    }
    if request.actions.is_empty() {
        codes.push("no-actions");
    }
    codes
}

fn recycle_bin_execution_warnings(codes: &[&'static str]) -> Vec<String> {
    if codes.is_empty() {
        return vec![
            "Recycle Bin executor permanently removes files already in the selected drive's Shell Recycle Bin; no automated restore path exists after execution.".to_string(),
        ];
    }
    codes
        .iter()
        .map(|code| match *code {
            "windows-required" => "Recycle Bin cleanup is Windows-only in this build.",
            "recycle-bin-executor-disabled" => {
                "Set SPACEGUARD_ENABLE_RECYCLE_BIN_EXECUTOR=1 before launching the Tauri app to enable Recycle Bin cleanup."
            }
            "dry-run-disabled-required" => {
                "Recycle Bin cleanup requires dryRunOnly=false on the execute-recycle-bin request."
            }
            "mutation-confirmation-required" => {
                "Recycle Bin cleanup requires mutationAttempted=true on the execute-recycle-bin request."
            }
            "permanent-confirmation-required" => {
                "Recycle Bin cleanup requires permanentRemovalConfirmed=true on the execute-recycle-bin request."
            }
            "request-mode-invalid" => {
                "Recycle Bin cleanup requires requestMode=execute-recycle-bin."
            }
            "route-not-recycle-bin" => "Recycle Bin cleanup requires route shell-recycle-bin.",
            _ => write_boundary_warning(code),
        })
        .map(String::from)
        .collect()
}

fn project_dependency_target_reject_code(value: &str) -> Option<&'static str> {
    let path = resolve_dry_run_target(value);
    if path.as_os_str().is_empty() {
        return Some("target-missing");
    }
    if path
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| !name.eq_ignore_ascii_case("node_modules"))
        .unwrap_or(true)
    {
        return Some("target-not-node-modules");
    }
    let original = normalize_write_target(value);
    let resolved = normalize_write_target(&path_to_string(&path));
    if !write_target_allowed("item-review-project-cache", &original)
        && !write_target_allowed("item-review-project-cache", &resolved)
    {
        return Some("target-not-node-modules");
    }
    if write_target_forbidden("item-review-project-cache", &original)
        || write_target_forbidden("item-review-project-cache", &resolved)
    {
        return Some("target-forbidden");
    }
    let Ok(metadata) = fs::symlink_metadata(&path) else {
        return Some("target-missing");
    };
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Some("target-link-or-not-directory");
    }
    let Some(project_root) = path.parent() else {
        return Some("target-missing-project-root");
    };
    if !project_root.join("package.json").exists() {
        return Some("target-missing-package-json");
    }
    None
}

fn temp_cleanup_target_reject_code(value: &str) -> Option<&'static str> {
    let targets = split_dry_run_targets(value);
    if targets.is_empty() {
        return Some("target-missing");
    }

    for target in targets {
        if let Some(code) = single_temp_cleanup_target_reject_code(&target) {
            return Some(code);
        }
    }
    None
}

fn single_temp_cleanup_target_reject_code(value: &str) -> Option<&'static str> {
    let path = resolve_dry_run_target(value);
    if path.as_os_str().is_empty() {
        return Some("target-missing");
    }

    let original = normalize_write_target(value);
    let resolved = normalize_write_target(&path_to_string(&path));
    if path_has_parent_component(&original) || path_has_parent_component(&resolved) {
        return Some("target-forbidden");
    }
    if write_target_forbidden("known-temp-delete", &original)
        || write_target_forbidden("known-temp-delete", &resolved)
    {
        return Some("target-forbidden");
    }
    if !temp_cleanup_target_allowed(&path, &original, &resolved) {
        return Some("target-not-allowlisted");
    }

    let Ok(metadata) = fs::symlink_metadata(&path) else {
        return Some("target-missing");
    };
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Some("target-link-or-not-directory");
    }
    None
}

fn temp_cleanup_target_allowed(path: &Path, original: &str, resolved: &str) -> bool {
    temp_env_target_allowed(path)
        || normalized_windows_temp_root(original)
        || normalized_windows_temp_root(resolved)
}

fn temp_env_target_allowed(path: &Path) -> bool {
    [env_path("TEMP"), env_path("TMP")]
        .into_iter()
        .flatten()
        .any(|root| path == root || path.starts_with(root))
}

fn normalized_windows_temp_root(value: &str) -> bool {
    let clean = value.trim_end_matches('\\');
    if clean.len() < 15 {
        return false;
    }
    let bytes = clean.as_bytes();
    bytes.get(1) == Some(&b':')
        && clean
            .get(2..)
            .map(|suffix| suffix == "\\windows\\temp" || suffix.starts_with("\\windows\\temp\\"))
            .unwrap_or(false)
}

fn path_has_parent_component(value: &str) -> bool {
    value == ".."
        || value.starts_with("..\\")
        || value.ends_with("\\..")
        || value.contains("\\..\\")
}

fn browser_cache_targets_reject_code(value: &str) -> Option<&'static str> {
    let targets = split_dry_run_targets(value);
    if targets.is_empty() {
        return Some("target-missing");
    }
    for target in targets {
        if let Some(code) = browser_cache_target_reject_code(&target) {
            return Some(code);
        }
    }
    None
}

fn browser_cache_target_reject_code(value: &str) -> Option<&'static str> {
    let path = resolve_dry_run_target(value);
    if path.as_os_str().is_empty() {
        return Some("target-missing");
    }

    let original = normalize_write_target(value);
    let resolved = normalize_write_target(&path_to_string(&path));
    if write_target_forbidden("browser-cache-only", &original)
        || write_target_forbidden("browser-cache-only", &resolved)
    {
        return Some("target-forbidden");
    }
    if !write_target_allowed("browser-cache-only", &original)
        && !write_target_allowed("browser-cache-only", &resolved)
    {
        return Some("target-not-browser-cache");
    }

    let Ok(metadata) = fs::symlink_metadata(&path) else {
        return Some("target-missing");
    };
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Some("target-link-or-not-directory");
    }
    None
}

fn gradle_cache_target_reject_code(value: &str) -> Option<&'static str> {
    let path = resolve_dry_run_target(value);
    if path.as_os_str().is_empty() {
        return Some("target-missing");
    }

    let original = normalize_write_target(value);
    let resolved = normalize_write_target(&path_to_string(&path));
    if write_target_forbidden("bounded-cache-delete", &original)
        || write_target_forbidden("bounded-cache-delete", &resolved)
    {
        return Some("target-forbidden");
    }
    if !write_target_allowed("bounded-cache-delete", &original)
        && !write_target_allowed("bounded-cache-delete", &resolved)
    {
        return Some("target-not-gradle-cache");
    }

    let Some(profile) = env_path("USERPROFILE").or_else(|| env_path("HOME")) else {
        return Some("target-not-gradle-cache");
    };
    let expected = profile.join(".gradle").join("caches");
    if !same_normalized_path(&path, &expected) {
        return Some("target-not-gradle-cache");
    }

    let Ok(metadata) = fs::symlink_metadata(&path) else {
        return Some("target-missing");
    };
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Some("target-link-or-not-directory");
    }
    None
}

fn npm_cache_target_reject_code(value: &str) -> Option<&'static str> {
    let path = resolve_dry_run_target(value);
    if path.as_os_str().is_empty() {
        return Some("target-missing");
    }

    let original = normalize_write_target(value);
    let resolved = normalize_write_target(&path_to_string(&path));
    if write_target_forbidden("bounded-npm-cache-delete", &original)
        || write_target_forbidden("bounded-npm-cache-delete", &resolved)
    {
        return Some("target-forbidden");
    }
    if !write_target_allowed("bounded-npm-cache-delete", &original)
        && !write_target_allowed("bounded-npm-cache-delete", &resolved)
    {
        return Some("target-not-npm-cache");
    }

    let Some(local_app_data) = env_path("LOCALAPPDATA").or_else(|| {
        env_path("USERPROFILE")
            .or_else(|| env_path("HOME"))
            .map(|profile| profile.join("AppData").join("Local"))
    }) else {
        return Some("target-not-npm-cache");
    };
    let expected = local_app_data.join("npm-cache").join("_cacache");
    if !same_normalized_path(&path, &expected) {
        return Some("target-not-npm-cache");
    }

    let Ok(metadata) = fs::symlink_metadata(&path) else {
        return Some("target-missing");
    };
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Some("target-link-or-not-directory");
    }
    None
}

fn user_cache_target_reject_code(value: &str) -> Option<&'static str> {
    let path = resolve_dry_run_target(value);
    if path.as_os_str().is_empty() {
        return Some("target-missing");
    }

    let original = normalize_write_target(value);
    let resolved = normalize_write_target(&path_to_string(&path));
    if write_target_forbidden("bounded-user-cache-delete", &original)
        || write_target_forbidden("bounded-user-cache-delete", &resolved)
    {
        return Some("target-forbidden");
    }
    if !write_target_allowed("bounded-user-cache-delete", &original)
        && !write_target_allowed("bounded-user-cache-delete", &resolved)
    {
        return Some("target-not-user-cache");
    }

    let Some(profile) = env_path("USERPROFILE").or_else(|| env_path("HOME")) else {
        return Some("target-not-user-cache");
    };
    let expected = profile.join(".cache");
    if !same_normalized_path(&path, &expected) {
        return Some("target-not-user-cache");
    }

    let Ok(metadata) = fs::symlink_metadata(&path) else {
        return Some("target-missing");
    };
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Some("target-link-or-not-directory");
    }
    None
}

fn android_cache_target_reject_code(value: &str) -> Option<&'static str> {
    let path = resolve_dry_run_target(value);
    if path.as_os_str().is_empty() {
        return Some("target-missing");
    }

    let original = normalize_write_target(value);
    let resolved = normalize_write_target(&path_to_string(&path));
    if write_target_forbidden("bounded-android-cache-delete", &original)
        || write_target_forbidden("bounded-android-cache-delete", &resolved)
    {
        return Some("target-forbidden");
    }
    if !write_target_allowed("bounded-android-cache-delete", &original)
        && !write_target_allowed("bounded-android-cache-delete", &resolved)
    {
        return Some("target-not-android-cache");
    }

    if !android_cache_path_matches_current_user_roots(&path) {
        return Some("target-not-android-cache");
    }

    let Ok(metadata) = fs::symlink_metadata(&path) else {
        return Some("target-missing");
    };
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Some("target-link-or-not-directory");
    }
    None
}

fn android_cache_path_matches_current_user_roots(path: &Path) -> bool {
    if let Some(profile) = env_path("USERPROFILE").or_else(|| env_path("HOME")) {
        if same_normalized_path(path, &profile.join(".android").join("build-cache")) {
            return true;
        }
    }

    let Some(local_app_data) = env_path("LOCALAPPDATA").or_else(|| {
        env_path("USERPROFILE")
            .or_else(|| env_path("HOME"))
            .map(|profile| profile.join("AppData").join("Local"))
    }) else {
        return false;
    };

    android_studio_cache_path_matches(path, &local_app_data.join("Google"))
}

fn android_studio_cache_path_matches(path: &Path, google_dir: &Path) -> bool {
    let clean = normalize_path(&path_to_string(path));
    let google = normalize_path(&path_to_string(google_dir));
    let Some(rest) = clean
        .strip_prefix(google.trim_end_matches('\\'))
        .and_then(|value| value.strip_prefix('\\'))
    else {
        return false;
    };
    let parts = rest
        .split('\\')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();
    if parts.len() == 2 {
        return parts[0].starts_with("androidstudio") && parts[1] == "caches";
    }
    if parts.len() == 3 {
        return parts[0].starts_with("androidstudio")
            && parts[1] == "system"
            && parts[2] == "caches";
    }
    false
}

fn shader_cache_target_reject_code(value: &str) -> Option<&'static str> {
    let path = resolve_dry_run_target(value);
    if path.as_os_str().is_empty() {
        return Some("target-missing");
    }

    let original = normalize_write_target(value);
    let resolved = normalize_write_target(&path_to_string(&path));
    if write_target_forbidden("launcher-cache-cleanup", &original)
        || write_target_forbidden("launcher-cache-cleanup", &resolved)
    {
        return Some("target-forbidden");
    }
    if !write_target_allowed("launcher-cache-cleanup", &original)
        && !write_target_allowed("launcher-cache-cleanup", &resolved)
    {
        return Some("target-not-shader-cache");
    }

    if !shader_cache_path_matches_current_user_roots(&path) {
        return Some("target-not-shader-cache");
    }

    let Ok(metadata) = fs::symlink_metadata(&path) else {
        return Some("target-missing");
    };
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Some("target-link-or-not-directory");
    }
    None
}

fn shader_cache_path_matches_current_user_roots(path: &Path) -> bool {
    let Some(local_app_data) = env_path("LOCALAPPDATA").or_else(|| {
        env_path("USERPROFILE")
            .or_else(|| env_path("HOME"))
            .map(|profile| profile.join("AppData").join("Local"))
    }) else {
        return false;
    };

    known_shader_cache_roots(&local_app_data)
        .iter()
        .any(|(_, cache_path)| same_normalized_path(path, cache_path))
}

fn pip_cache_target_reject_code(value: &str) -> Option<&'static str> {
    let path = resolve_dry_run_target(value);
    if path.as_os_str().is_empty() {
        return Some("target-missing");
    }

    let original = normalize_write_target(value);
    let resolved = normalize_write_target(&path_to_string(&path));
    if write_target_forbidden("bounded-pip-cache-delete", &original)
        || write_target_forbidden("bounded-pip-cache-delete", &resolved)
    {
        return Some("target-forbidden");
    }
    if !write_target_allowed("bounded-pip-cache-delete", &original)
        && !write_target_allowed("bounded-pip-cache-delete", &resolved)
    {
        return Some("target-not-pip-cache");
    }

    let Some(local_app_data) = env_path("LOCALAPPDATA").or_else(|| {
        env_path("USERPROFILE")
            .or_else(|| env_path("HOME"))
            .map(|profile| profile.join("AppData").join("Local"))
    }) else {
        return Some("target-not-pip-cache");
    };
    let expected = local_app_data.join("pip").join("Cache");
    if !same_normalized_path(&path, &expected) {
        return Some("target-not-pip-cache");
    }

    let Ok(metadata) = fs::symlink_metadata(&path) else {
        return Some("target-missing");
    };
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Some("target-link-or-not-directory");
    }
    None
}

fn docker_build_cache_target_reject_code(value: &str) -> Option<&'static str> {
    let clean = normalize_write_target(value);
    if clean.trim().is_empty() {
        return Some("target-missing");
    }
    if write_target_forbidden("tool-native-docker-build-cache-prune", &clean) {
        return Some("target-forbidden");
    }
    if !write_target_allowed("tool-native-docker-build-cache-prune", &clean) {
        return Some("target-not-docker-build-cache");
    }
    None
}

fn known_shader_cache_roots(local_app_data: &Path) -> Vec<(&'static str, PathBuf)> {
    vec![
        ("Direct3D shader cache", local_app_data.join("D3DSCache")),
        (
            "NVIDIA DirectX shader cache",
            local_app_data.join("NVIDIA").join("DXCache"),
        ),
        (
            "NVIDIA OpenGL shader cache",
            local_app_data.join("NVIDIA").join("GLCache"),
        ),
        (
            "NVIDIA legacy shader cache",
            local_app_data.join("NVIDIA Corporation").join("NV_Cache"),
        ),
        (
            "AMD DirectX shader cache",
            local_app_data.join("AMD").join("DxCache"),
        ),
        (
            "AMD OpenGL shader cache",
            local_app_data.join("AMD").join("GLCache"),
        ),
        (
            "AMD Vulkan shader cache",
            local_app_data.join("AMD").join("VkCache"),
        ),
        (
            "Intel shader cache",
            local_app_data.join("Intel").join("ShaderCache"),
        ),
    ]
}

fn pnpm_store_target_reject_code(value: &str) -> Option<&'static str> {
    let path = resolve_dry_run_target(value);
    if path.as_os_str().is_empty() {
        return Some("target-missing");
    }

    let original = normalize_write_target(value);
    let resolved = normalize_write_target(&path_to_string(&path));
    if write_target_forbidden("bounded-pnpm-store-delete", &original)
        || write_target_forbidden("bounded-pnpm-store-delete", &resolved)
    {
        return Some("target-forbidden");
    }
    if !write_target_allowed("bounded-pnpm-store-delete", &original)
        && !write_target_allowed("bounded-pnpm-store-delete", &resolved)
    {
        return Some("target-not-pnpm-store");
    }

    let Some(local_app_data) = env_path("LOCALAPPDATA").or_else(|| {
        env_path("USERPROFILE")
            .or_else(|| env_path("HOME"))
            .map(|profile| profile.join("AppData").join("Local"))
    }) else {
        return Some("target-not-pnpm-store");
    };
    let expected = local_app_data.join("pnpm").join("store");
    if !same_normalized_path(&path, &expected) {
        return Some("target-not-pnpm-store");
    }

    let Ok(metadata) = fs::symlink_metadata(&path) else {
        return Some("target-missing");
    };
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Some("target-link-or-not-directory");
    }
    None
}

fn recycle_bin_target_reject_code(value: &str) -> Option<&'static str> {
    let path = resolve_dry_run_target(value);
    if path.as_os_str().is_empty() {
        return Some("target-missing");
    }

    let original = normalize_write_target(value);
    let resolved = normalize_write_target(&path_to_string(&path));
    if write_target_forbidden("shell-recycle-bin", &original)
        || write_target_forbidden("shell-recycle-bin", &resolved)
    {
        return Some("target-forbidden");
    }
    if !write_target_allowed("shell-recycle-bin", &original)
        && !write_target_allowed("shell-recycle-bin", &resolved)
    {
        return Some("target-not-recycle-bin");
    }
    let Some(root) = recycle_bin_drive_root(value) else {
        return Some("target-not-recycle-bin");
    };
    let expected = normalize_write_target(&format!("{root}$Recycle.Bin"));
    if original != expected && resolved != expected {
        return Some("target-not-recycle-bin");
    }
    None
}

fn downloads_cleanup_target_reject_code(value: &str) -> Option<&'static str> {
    downloads_cleanup_target_reject_code_at(value, SystemTime::now())
}

fn downloads_cleanup_target_reject_code_at(value: &str, now: SystemTime) -> Option<&'static str> {
    let path = resolve_dry_run_target(value);
    if path.as_os_str().is_empty() {
        return Some("target-missing");
    }

    let original = normalize_write_target(value);
    let resolved = normalize_write_target(&path_to_string(&path));
    if write_target_forbidden("item-review-recycle-bin", &original)
        || write_target_forbidden("item-review-recycle-bin", &resolved)
    {
        return Some("target-forbidden");
    }
    if !write_target_allowed("item-review-recycle-bin", &original)
        && !write_target_allowed("item-review-recycle-bin", &resolved)
    {
        return Some("target-not-downloads-folder");
    }

    let Some(downloads) = user_downloads_dir() else {
        return Some("target-not-downloads-folder");
    };
    if !path_is_under(&path, &downloads) {
        return Some("target-not-downloads-folder");
    }

    let Ok(metadata) = fs::symlink_metadata(&path) else {
        return Some("target-missing");
    };
    if !metadata.is_file() || metadata.file_type().is_symlink() {
        return Some("target-link-or-not-file");
    }
    if !should_count_file(MeasureKind::DownloadInstallers, &path) {
        return Some("target-not-downloads-file");
    }
    if path_age_days_at(&path, now).unwrap_or(0) < 30 {
        return Some("target-too-recent");
    }
    None
}

fn large_file_archive_target_reject_code(
    value: &str,
    archive_destination: &str,
) -> Option<&'static str> {
    large_file_archive_target_reject_code_at(value, archive_destination, SystemTime::now())
}

fn large_file_archive_target_reject_code_at(
    value: &str,
    archive_destination: &str,
    now: SystemTime,
) -> Option<&'static str> {
    let path = resolve_dry_run_target(value);
    if path.as_os_str().is_empty() {
        return Some("target-missing");
    }

    let original = normalize_write_target(value);
    let resolved = normalize_write_target(&path_to_string(&path));
    if write_target_forbidden("item-review-large-files", &original)
        || write_target_forbidden("item-review-large-files", &resolved)
    {
        return Some("target-forbidden");
    }
    if !write_target_allowed("item-review-large-files", &original)
        && !write_target_allowed("item-review-large-files", &resolved)
    {
        return Some("target-not-user-review-folder");
    }

    if !user_large_file_review_roots()
        .iter()
        .any(|root| path_is_under(&path, root))
    {
        return Some("target-not-user-review-folder");
    }

    let Ok(metadata) = fs::symlink_metadata(&path) else {
        return Some("target-missing");
    };
    if !metadata.is_file() || metadata.file_type().is_symlink() {
        return Some("target-link-or-not-file");
    }
    if metadata.len() < 1024 * 1024 * 1024 {
        return Some("target-too-small");
    }
    if !should_count_file(MeasureKind::LargeUserFiles, &path) {
        return Some("target-not-large-user-file");
    }
    if path_age_days_at(&path, now).unwrap_or(0) < 90 {
        return Some("target-too-recent");
    }
    if let Some(code) = archive_destination_reject_code(archive_destination) {
        return Some(code);
    }
    if same_windows_drive(&path_to_string(&path), archive_destination) {
        return Some("archive-destination-same-drive");
    }
    None
}

fn archive_destination_reject_code(value: &str) -> Option<&'static str> {
    let destination = resolve_dry_run_target(value);
    if destination.as_os_str().is_empty() || value.trim().is_empty() {
        return Some("archive-destination-missing");
    }
    let normalized = normalize_write_target(&path_to_string(&destination));
    if normalized.ends_with(':')
        || normalized.ends_with(":\\")
        || normalized.contains("\\windows\\")
        || normalized.contains("\\program files")
        || normalized.contains("\\programdata\\")
        || normalized.contains("\\appdata\\")
    {
        return Some("archive-destination-forbidden");
    }
    let Ok(metadata) = fs::symlink_metadata(&destination) else {
        return Some("archive-destination-not-directory");
    };
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Some("archive-destination-not-directory");
    }
    None
}

fn user_downloads_dir() -> Option<PathBuf> {
    env_path("USERPROFILE")
        .or_else(|| env_path("HOME"))
        .map(|profile| profile.join("Downloads"))
}

fn user_large_file_review_roots() -> Vec<PathBuf> {
    let Some(profile) = env_path("USERPROFILE").or_else(|| env_path("HOME")) else {
        return Vec::new();
    };
    [
        "Downloads",
        "Desktop",
        "Documents",
        "Videos",
        "Pictures",
        "Music",
    ]
    .iter()
    .map(|name| profile.join(name))
    .collect()
}

fn path_is_under(path: &Path, root: &Path) -> bool {
    let path = normalize_path(&path_to_string(path));
    let root = normalize_path(&path_to_string(root));
    path == root || path.starts_with(&format!("{root}\\"))
}

fn same_windows_drive(left: &str, right: &str) -> bool {
    let left = windows_drive_prefix(left);
    let right = windows_drive_prefix(right);
    left.is_some() && left == right
}

fn windows_drive_prefix(value: &str) -> Option<String> {
    let clean = value.trim().replace('/', "\\");
    let bytes = clean.as_bytes();
    if bytes.len() >= 2 && bytes[1] == b':' && bytes[0].is_ascii_alphabetic() {
        return Some((bytes[0] as char).to_ascii_lowercase().to_string());
    }
    None
}

#[derive(Default)]
struct TempDeleteResult {
    deleted_bytes: u64,
    deleted_files: u64,
    skipped_count: u64,
}

#[derive(Default)]
struct ProjectDependencyDeleteResult {
    deleted_bytes: u64,
    deleted_files: u64,
    deleted_dirs: u64,
    skipped_count: u64,
}

#[derive(Default)]
struct BrowserCacheDeleteResult {
    deleted_bytes: u64,
    deleted_files: u64,
    deleted_dirs: u64,
    skipped_count: u64,
}

#[derive(Default)]
struct GradleCacheDeleteResult {
    deleted_bytes: u64,
    deleted_files: u64,
    deleted_dirs: u64,
    skipped_count: u64,
}

#[derive(Default)]
struct UserCacheDeleteResult {
    deleted_bytes: u64,
    deleted_files: u64,
    deleted_dirs: u64,
    skipped_count: u64,
}

#[derive(Default)]
struct AndroidCacheDeleteResult {
    deleted_bytes: u64,
    deleted_files: u64,
    deleted_dirs: u64,
    skipped_count: u64,
}

#[derive(Default)]
struct ShaderCacheDeleteResult {
    deleted_bytes: u64,
    deleted_files: u64,
    deleted_dirs: u64,
    skipped_count: u64,
}

#[derive(Default)]
struct PipCacheDeleteResult {
    deleted_bytes: u64,
    deleted_files: u64,
    deleted_dirs: u64,
    skipped_count: u64,
}

#[derive(Default)]
struct DockerCommandResult {
    ok: bool,
    timed_out: bool,
    exit_code: Option<i32>,
    stdout: String,
    stderr: String,
    error: String,
}

impl DockerCommandResult {
    fn summary(&self) -> String {
        if self.timed_out {
            return "Docker command timed out before completion.".to_string();
        }
        if !self.error.is_empty() {
            return format!("Docker command could not start: {}", self.error);
        }
        let detail = first_non_empty_line(&self.stderr)
            .or_else(|| first_non_empty_line(&self.stdout))
            .unwrap_or_else(|| "no output".to_string());
        format!(
            "Docker command exit={}; {}",
            self.exit_code
                .map(|code| code.to_string())
                .unwrap_or_else(|| "unknown".to_string()),
            detail
        )
    }
}

#[derive(Default)]
struct NpmCacheDeleteResult {
    deleted_bytes: u64,
    deleted_files: u64,
    deleted_dirs: u64,
    skipped_count: u64,
}

#[derive(Default)]
struct PnpmStoreDeleteResult {
    deleted_bytes: u64,
    deleted_files: u64,
    deleted_dirs: u64,
    skipped_count: u64,
}

struct RecycleBinEmptyResult {
    succeeded: bool,
    before_bytes: u64,
    after_bytes: u64,
    before_items: u64,
    after_items: u64,
    hresult: i32,
}

#[derive(Default)]
struct DownloadsRecycleMoveResult {
    succeeded: bool,
    bytes: u64,
    error_code: i32,
}

#[derive(Default)]
struct LargeFileArchiveMoveResult {
    succeeded: bool,
    bytes: u64,
    error_code: i32,
    archive_path: String,
}

fn delete_browser_cache_action_targets(value: &str) -> BrowserCacheDeleteResult {
    let mut result = BrowserCacheDeleteResult::default();
    for target in split_dry_run_targets(value) {
        let path = resolve_dry_run_target(&target);
        let deleted = delete_browser_cache_target(&path);
        result.deleted_bytes = result.deleted_bytes.saturating_add(deleted.deleted_bytes);
        result.deleted_files = result.deleted_files.saturating_add(deleted.deleted_files);
        result.deleted_dirs = result.deleted_dirs.saturating_add(deleted.deleted_dirs);
        result.skipped_count = result.skipped_count.saturating_add(deleted.skipped_count);
    }
    result
}

fn delete_browser_cache_target(root: &Path) -> BrowserCacheDeleteResult {
    delete_browser_cache_target_at(root, SystemTime::now())
}

fn delete_browser_cache_target_at(root: &Path, now: SystemTime) -> BrowserCacheDeleteResult {
    let mut result = BrowserCacheDeleteResult::default();
    if browser_cache_target_reject_code(&path_to_string(root)).is_some() {
        result.skipped_count += 1;
        return result;
    }

    let mut queue = VecDeque::from([root.to_path_buf()]);
    let mut dirs = Vec::new();
    let mut visited = 0usize;
    while let Some(path) = queue.pop_front() {
        if visited >= 120_000 || result.deleted_files >= 80_000 {
            result.skipped_count += 1;
            break;
        }
        visited += 1;

        let Ok(metadata) = fs::symlink_metadata(&path) else {
            result.skipped_count += 1;
            continue;
        };
        if metadata.file_type().is_symlink() {
            result.skipped_count += 1;
            continue;
        }
        if metadata.is_file() {
            delete_single_browser_cache_file_at(&path, &metadata, now, &mut result);
            continue;
        }
        if metadata.is_dir() {
            dirs.push(path.clone());
            match fs::read_dir(&path) {
                Ok(entries) => {
                    for entry in entries.flatten() {
                        queue.push_back(entry.path());
                    }
                }
                Err(_) => result.skipped_count += 1,
            }
        }
    }

    dirs.sort_by(|left, right| right.components().count().cmp(&left.components().count()));
    for dir in dirs {
        if dir == root {
            continue;
        }
        match fs::remove_dir(&dir) {
            Ok(_) => result.deleted_dirs = result.deleted_dirs.saturating_add(1),
            Err(_) => result.skipped_count += 1,
        }
    }

    result
}

fn delete_single_browser_cache_file(
    path: &Path,
    metadata: &fs::Metadata,
    result: &mut BrowserCacheDeleteResult,
) {
    delete_single_browser_cache_file_at(path, metadata, SystemTime::now(), result);
}

fn delete_single_browser_cache_file_at(
    path: &Path,
    metadata: &fs::Metadata,
    now: SystemTime,
    result: &mut BrowserCacheDeleteResult,
) {
    if !file_old_enough_for_browser_cache_delete_at(metadata, now) {
        result.skipped_count += 1;
        return;
    }
    let bytes = metadata.len();
    match fs::remove_file(path) {
        Ok(_) => {
            result.deleted_bytes = result.deleted_bytes.saturating_add(bytes);
            result.deleted_files = result.deleted_files.saturating_add(1);
        }
        Err(_) => result.skipped_count += 1,
    }
}

fn file_old_enough_for_browser_cache_delete(metadata: &fs::Metadata) -> bool {
    file_old_enough_for_browser_cache_delete_at(metadata, SystemTime::now())
}

fn file_old_enough_for_browser_cache_delete_at(metadata: &fs::Metadata, now: SystemTime) -> bool {
    let Ok(modified) = metadata.modified() else {
        return false;
    };
    let Ok(age) = now.duration_since(modified) else {
        return false;
    };
    age.as_secs() >= 10 * 60
}

fn delete_gradle_cache_target(root: &Path) -> GradleCacheDeleteResult {
    delete_gradle_cache_target_at(root, SystemTime::now())
}

fn delete_gradle_cache_target_at(root: &Path, now: SystemTime) -> GradleCacheDeleteResult {
    let mut result = GradleCacheDeleteResult::default();
    if gradle_cache_target_reject_code(&path_to_string(root)).is_some() {
        result.skipped_count += 1;
        return result;
    }

    let mut queue = VecDeque::from([root.to_path_buf()]);
    let mut dirs = Vec::new();
    let mut visited = 0usize;
    while let Some(path) = queue.pop_front() {
        if visited >= 250_000 || result.deleted_files >= 120_000 {
            result.skipped_count += 1;
            break;
        }
        visited += 1;

        let Ok(metadata) = fs::symlink_metadata(&path) else {
            result.skipped_count += 1;
            continue;
        };
        if metadata.file_type().is_symlink() {
            result.skipped_count += 1;
            continue;
        }
        if metadata.is_file() {
            delete_single_gradle_cache_file_at(&path, &metadata, now, &mut result);
            continue;
        }
        if metadata.is_dir() {
            dirs.push(path.clone());
            match fs::read_dir(&path) {
                Ok(entries) => {
                    for entry in entries.flatten() {
                        queue.push_back(entry.path());
                    }
                }
                Err(_) => result.skipped_count += 1,
            }
        }
    }

    dirs.sort_by(|left, right| right.components().count().cmp(&left.components().count()));
    for dir in dirs {
        if dir == root {
            continue;
        }
        match fs::remove_dir(&dir) {
            Ok(_) => result.deleted_dirs = result.deleted_dirs.saturating_add(1),
            Err(_) => result.skipped_count += 1,
        }
    }

    result
}

fn delete_single_gradle_cache_file(
    path: &Path,
    metadata: &fs::Metadata,
    result: &mut GradleCacheDeleteResult,
) {
    delete_single_gradle_cache_file_at(path, metadata, SystemTime::now(), result);
}

fn delete_single_gradle_cache_file_at(
    path: &Path,
    metadata: &fs::Metadata,
    now: SystemTime,
    result: &mut GradleCacheDeleteResult,
) {
    if !file_old_enough_for_gradle_cache_delete_at(metadata, now)
        || gradle_cache_file_forbidden(path)
    {
        result.skipped_count += 1;
        return;
    }
    let bytes = metadata.len();
    match fs::remove_file(path) {
        Ok(_) => {
            result.deleted_bytes = result.deleted_bytes.saturating_add(bytes);
            result.deleted_files = result.deleted_files.saturating_add(1);
        }
        Err(_) => result.skipped_count += 1,
    }
}

fn file_old_enough_for_gradle_cache_delete(metadata: &fs::Metadata) -> bool {
    file_old_enough_for_gradle_cache_delete_at(metadata, SystemTime::now())
}

fn file_old_enough_for_gradle_cache_delete_at(metadata: &fs::Metadata, now: SystemTime) -> bool {
    let Ok(modified) = metadata.modified() else {
        return false;
    };
    let Ok(age) = now.duration_since(modified) else {
        return false;
    };
    age.as_secs() >= 30 * 24 * 60 * 60
}

fn gradle_cache_file_forbidden(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| {
            let clean = name.to_ascii_lowercase();
            clean.ends_with(".lock") || clean == "gc.properties"
        })
        .unwrap_or(true)
}

fn delete_user_cache_target(root: &Path) -> UserCacheDeleteResult {
    delete_user_cache_target_at(root, SystemTime::now())
}

fn delete_user_cache_target_at(root: &Path, now: SystemTime) -> UserCacheDeleteResult {
    let mut result = UserCacheDeleteResult::default();
    if user_cache_target_reject_code(&path_to_string(root)).is_some() {
        result.skipped_count += 1;
        return result;
    }

    let mut queue = VecDeque::from([root.to_path_buf()]);
    let mut dirs = Vec::new();
    let mut visited = 0usize;
    while let Some(path) = queue.pop_front() {
        if visited >= 250_000 || result.deleted_files >= 120_000 {
            result.skipped_count += 1;
            break;
        }
        visited += 1;

        let Ok(metadata) = fs::symlink_metadata(&path) else {
            result.skipped_count += 1;
            continue;
        };
        if metadata.file_type().is_symlink() {
            result.skipped_count += 1;
            continue;
        }
        if metadata.is_file() {
            delete_single_user_cache_file_at(&path, &metadata, now, &mut result);
            continue;
        }
        if metadata.is_dir() {
            if user_cache_dir_forbidden(&path, root) {
                result.skipped_count += 1;
                continue;
            }
            dirs.push(path.clone());
            match fs::read_dir(&path) {
                Ok(entries) => {
                    for entry in entries.flatten() {
                        queue.push_back(entry.path());
                    }
                }
                Err(_) => result.skipped_count += 1,
            }
        }
    }

    dirs.sort_by(|left, right| right.components().count().cmp(&left.components().count()));
    for dir in dirs {
        if dir == root || user_cache_dir_forbidden(&dir, root) {
            continue;
        }
        match fs::remove_dir(&dir) {
            Ok(_) => result.deleted_dirs = result.deleted_dirs.saturating_add(1),
            Err(_) => result.skipped_count += 1,
        }
    }

    result
}

fn delete_single_user_cache_file(
    path: &Path,
    metadata: &fs::Metadata,
    result: &mut UserCacheDeleteResult,
) {
    delete_single_user_cache_file_at(path, metadata, SystemTime::now(), result);
}

fn delete_single_user_cache_file_at(
    path: &Path,
    metadata: &fs::Metadata,
    now: SystemTime,
    result: &mut UserCacheDeleteResult,
) {
    if !file_old_enough_for_user_cache_delete_at(metadata, now) || user_cache_file_forbidden(path) {
        result.skipped_count += 1;
        return;
    }
    let bytes = metadata.len();
    match fs::remove_file(path) {
        Ok(_) => {
            result.deleted_bytes = result.deleted_bytes.saturating_add(bytes);
            result.deleted_files = result.deleted_files.saturating_add(1);
        }
        Err(_) => result.skipped_count += 1,
    }
}

fn file_old_enough_for_user_cache_delete(metadata: &fs::Metadata) -> bool {
    file_old_enough_for_user_cache_delete_at(metadata, SystemTime::now())
}

fn file_old_enough_for_user_cache_delete_at(metadata: &fs::Metadata, now: SystemTime) -> bool {
    let Ok(modified) = metadata.modified() else {
        return false;
    };
    let Ok(age) = now.duration_since(modified) else {
        return false;
    };
    age.as_secs() >= 30 * 24 * 60 * 60
}

fn user_cache_dir_forbidden(path: &Path, root: &Path) -> bool {
    if path == root {
        return false;
    }
    let clean = normalize_path(&path_to_string(path));
    clean.contains("\\node_modules")
        || clean.contains("\\.git")
        || clean.ends_with("\\config")
        || clean.ends_with("\\settings")
        || clean.ends_with("\\profiles")
        || clean.ends_with("\\sessions")
        || clean.ends_with("\\identity")
}

fn user_cache_file_forbidden(path: &Path) -> bool {
    let clean_path = normalize_path(&path_to_string(path));
    if !clean_path.contains("\\.cache\\") {
        return true;
    }
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.to_ascii_lowercase())
        .unwrap_or_default();
    file_name.is_empty()
        || file_name.ends_with(".lock")
        || file_name.ends_with(".db")
        || file_name.ends_with(".sqlite")
        || file_name.ends_with(".sqlite3")
        || file_name.ends_with(".json")
        || file_name.ends_with(".yaml")
        || file_name.ends_with(".yml")
        || file_name.ends_with(".toml")
        || file_name.ends_with(".ini")
        || file_name.ends_with(".conf")
        || file_name.ends_with(".config")
        || file_name.ends_with(".log")
        || file_name.contains("cookie")
        || file_name.contains("session")
        || file_name.contains("token")
        || file_name.contains("credential")
        || file_name.contains("password")
        || file_name.contains("history")
}

fn delete_android_cache_target(root: &Path) -> AndroidCacheDeleteResult {
    delete_android_cache_target_at(root, SystemTime::now())
}

fn delete_android_cache_target_at(root: &Path, now: SystemTime) -> AndroidCacheDeleteResult {
    let mut result = AndroidCacheDeleteResult::default();
    if android_cache_target_reject_code(&path_to_string(root)).is_some() {
        result.skipped_count += 1;
        return result;
    }

    let mut queue = VecDeque::from([root.to_path_buf()]);
    let mut dirs = Vec::new();
    let mut visited = 0usize;
    while let Some(path) = queue.pop_front() {
        if visited >= 250_000 || result.deleted_files >= 120_000 {
            result.skipped_count += 1;
            break;
        }
        visited += 1;

        let Ok(metadata) = fs::symlink_metadata(&path) else {
            result.skipped_count += 1;
            continue;
        };
        if metadata.file_type().is_symlink() {
            result.skipped_count += 1;
            continue;
        }
        if metadata.is_file() {
            delete_single_android_cache_file_at(&path, &metadata, now, &mut result);
            continue;
        }
        if metadata.is_dir() {
            if android_cache_dir_forbidden(&path, root) {
                result.skipped_count += 1;
                continue;
            }
            dirs.push(path.clone());
            match fs::read_dir(&path) {
                Ok(entries) => {
                    for entry in entries.flatten() {
                        queue.push_back(entry.path());
                    }
                }
                Err(_) => result.skipped_count += 1,
            }
        }
    }

    dirs.sort_by(|left, right| right.components().count().cmp(&left.components().count()));
    for dir in dirs {
        if dir == root || android_cache_dir_forbidden(&dir, root) {
            continue;
        }
        match fs::remove_dir(&dir) {
            Ok(_) => result.deleted_dirs = result.deleted_dirs.saturating_add(1),
            Err(_) => result.skipped_count += 1,
        }
    }

    result
}

fn delete_single_android_cache_file(
    path: &Path,
    metadata: &fs::Metadata,
    result: &mut AndroidCacheDeleteResult,
) {
    delete_single_android_cache_file_at(path, metadata, SystemTime::now(), result);
}

fn delete_single_android_cache_file_at(
    path: &Path,
    metadata: &fs::Metadata,
    now: SystemTime,
    result: &mut AndroidCacheDeleteResult,
) {
    if !file_old_enough_for_android_cache_delete_at(metadata, now)
        || android_cache_file_forbidden(path)
    {
        result.skipped_count += 1;
        return;
    }
    let bytes = metadata.len();
    match fs::remove_file(path) {
        Ok(_) => {
            result.deleted_bytes = result.deleted_bytes.saturating_add(bytes);
            result.deleted_files = result.deleted_files.saturating_add(1);
        }
        Err(_) => result.skipped_count += 1,
    }
}

fn file_old_enough_for_android_cache_delete(metadata: &fs::Metadata) -> bool {
    file_old_enough_for_android_cache_delete_at(metadata, SystemTime::now())
}

fn file_old_enough_for_android_cache_delete_at(metadata: &fs::Metadata, now: SystemTime) -> bool {
    let Ok(modified) = metadata.modified() else {
        return false;
    };
    let Ok(age) = now.duration_since(modified) else {
        return false;
    };
    age.as_secs() >= 30 * 24 * 60 * 60
}

fn android_cache_dir_forbidden(path: &Path, root: &Path) -> bool {
    if path == root {
        return false;
    }
    let clean = normalize_path(&path_to_string(path));
    clean.contains("\\node_modules")
        || clean.contains("\\.git")
        || clean.contains("\\.android\\avd")
        || clean.contains("\\android\\sdk")
        || clean.contains("\\android-sdk")
        || clean.contains("\\emulator")
        || clean.contains("\\system-images")
        || clean.contains("\\platforms")
        || clean.contains("\\build-tools")
        || clean.contains("\\cmdline-tools")
        || clean.contains("\\platform-tools")
        || clean.contains("\\gradle")
        || clean.ends_with("\\config")
        || clean.ends_with("\\options")
        || clean.ends_with("\\projects")
}

fn android_cache_file_forbidden(path: &Path) -> bool {
    let clean_path = normalize_path(&path_to_string(path));
    if !clean_path.contains("\\.android\\build-cache\\")
        && !(clean_path.contains("\\androidstudio") && clean_path.contains("\\caches\\"))
    {
        return true;
    }
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.to_ascii_lowercase())
        .unwrap_or_default();
    file_name.is_empty()
        || file_name.ends_with(".lock")
        || file_name.ends_with(".db")
        || file_name.ends_with(".sqlite")
        || file_name.ends_with(".sqlite3")
        || file_name.ends_with(".json")
        || file_name.ends_with(".xml")
        || file_name.ends_with(".properties")
        || file_name.ends_with(".ini")
        || file_name.ends_with(".conf")
        || file_name.ends_with(".key")
        || file_name.ends_with(".keystore")
        || file_name.ends_with(".jks")
        || file_name.contains("credential")
        || file_name.contains("password")
        || file_name.contains("token")
        || file_name.contains("session")
        || file_name.contains("history")
}

fn delete_shader_cache_target(root: &Path) -> ShaderCacheDeleteResult {
    delete_shader_cache_target_at(root, SystemTime::now())
}

fn delete_shader_cache_target_at(root: &Path, now: SystemTime) -> ShaderCacheDeleteResult {
    let mut result = ShaderCacheDeleteResult::default();
    if shader_cache_target_reject_code(&path_to_string(root)).is_some() {
        result.skipped_count += 1;
        return result;
    }

    let mut queue = VecDeque::from([root.to_path_buf()]);
    let mut dirs = Vec::new();
    let mut visited = 0usize;
    while let Some(path) = queue.pop_front() {
        if visited >= 250_000 || result.deleted_files >= 120_000 {
            result.skipped_count += 1;
            break;
        }
        visited += 1;

        let Ok(metadata) = fs::symlink_metadata(&path) else {
            result.skipped_count += 1;
            continue;
        };
        if metadata.file_type().is_symlink() {
            result.skipped_count += 1;
            continue;
        }
        if metadata.is_file() {
            delete_single_shader_cache_file_at(&path, &metadata, now, &mut result);
            continue;
        }
        if metadata.is_dir() {
            if shader_cache_dir_forbidden(&path, root) {
                result.skipped_count += 1;
                continue;
            }
            dirs.push(path.clone());
            match fs::read_dir(&path) {
                Ok(entries) => {
                    for entry in entries.flatten() {
                        queue.push_back(entry.path());
                    }
                }
                Err(_) => result.skipped_count += 1,
            }
        }
    }

    dirs.sort_by(|left, right| right.components().count().cmp(&left.components().count()));
    for dir in dirs {
        if dir == root || shader_cache_dir_forbidden(&dir, root) {
            continue;
        }
        match fs::remove_dir(&dir) {
            Ok(_) => result.deleted_dirs = result.deleted_dirs.saturating_add(1),
            Err(_) => result.skipped_count += 1,
        }
    }

    result
}

fn delete_single_shader_cache_file(
    path: &Path,
    metadata: &fs::Metadata,
    result: &mut ShaderCacheDeleteResult,
) {
    delete_single_shader_cache_file_at(path, metadata, SystemTime::now(), result);
}

fn delete_single_shader_cache_file_at(
    path: &Path,
    metadata: &fs::Metadata,
    now: SystemTime,
    result: &mut ShaderCacheDeleteResult,
) {
    if !file_old_enough_for_shader_cache_delete_at(metadata, now)
        || shader_cache_file_forbidden(path)
    {
        result.skipped_count += 1;
        return;
    }
    let bytes = metadata.len();
    match fs::remove_file(path) {
        Ok(_) => {
            result.deleted_bytes = result.deleted_bytes.saturating_add(bytes);
            result.deleted_files = result.deleted_files.saturating_add(1);
        }
        Err(_) => result.skipped_count += 1,
    }
}

fn file_old_enough_for_shader_cache_delete(metadata: &fs::Metadata) -> bool {
    file_old_enough_for_shader_cache_delete_at(metadata, SystemTime::now())
}

fn file_old_enough_for_shader_cache_delete_at(metadata: &fs::Metadata, now: SystemTime) -> bool {
    let Ok(modified) = metadata.modified() else {
        return false;
    };
    let Ok(age) = now.duration_since(modified) else {
        return false;
    };
    age.as_secs() >= 14 * 24 * 60 * 60
}

fn shader_cache_dir_forbidden(path: &Path, root: &Path) -> bool {
    if path == root {
        return false;
    }
    let clean = normalize_path(&path_to_string(path));
    clean.contains("\\steamapps")
        || clean.contains("\\epic games")
        || clean.contains("\\xboxgames")
        || clean.contains("\\saved games")
        || clean.contains("\\saves")
        || clean.contains("\\savegames")
        || clean.contains("\\profiles")
        || clean.contains("\\screenshots")
        || clean.contains("\\user data")
        || clean.contains("\\packages")
        || clean.ends_with("\\config")
        || clean.ends_with("\\settings")
        || clean.ends_with("\\sessions")
}

fn shader_cache_file_forbidden(path: &Path) -> bool {
    if !shader_cache_path_is_under_current_user_root(path) {
        return true;
    }
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.to_ascii_lowercase())
        .unwrap_or_default();
    file_name.is_empty()
        || file_name.ends_with(".lock")
        || file_name.ends_with(".db")
        || file_name.ends_with(".sqlite")
        || file_name.ends_with(".sqlite3")
        || file_name.ends_with(".json")
        || file_name.ends_with(".xml")
        || file_name.ends_with(".ini")
        || file_name.ends_with(".conf")
        || file_name.ends_with(".config")
        || file_name.ends_with(".cfg")
        || file_name.ends_with(".log")
        || file_name.contains("cookie")
        || file_name.contains("session")
        || file_name.contains("token")
        || file_name.contains("credential")
        || file_name.contains("password")
        || file_name.contains("history")
        || file_name.contains("profile")
        || file_name.contains("save")
}

fn shader_cache_path_is_under_current_user_root(path: &Path) -> bool {
    let Some(local_app_data) = env_path("LOCALAPPDATA").or_else(|| {
        env_path("USERPROFILE")
            .or_else(|| env_path("HOME"))
            .map(|profile| profile.join("AppData").join("Local"))
    }) else {
        return false;
    };

    known_shader_cache_roots(&local_app_data)
        .iter()
        .any(|(_, root)| path_is_under(path, root))
}

fn delete_pip_cache_target(root: &Path) -> PipCacheDeleteResult {
    delete_pip_cache_target_at(root, SystemTime::now())
}

fn delete_pip_cache_target_at(root: &Path, now: SystemTime) -> PipCacheDeleteResult {
    let mut result = PipCacheDeleteResult::default();
    if pip_cache_target_reject_code(&path_to_string(root)).is_some() {
        result.skipped_count += 1;
        return result;
    }

    let mut queue = VecDeque::from([root.to_path_buf()]);
    let mut dirs = Vec::new();
    let mut visited = 0usize;
    while let Some(path) = queue.pop_front() {
        if visited >= 250_000 || result.deleted_files >= 120_000 {
            result.skipped_count += 1;
            break;
        }
        visited += 1;

        let Ok(metadata) = fs::symlink_metadata(&path) else {
            result.skipped_count += 1;
            continue;
        };
        if metadata.file_type().is_symlink() {
            result.skipped_count += 1;
            continue;
        }
        if metadata.is_file() {
            delete_single_pip_cache_file_at(&path, &metadata, now, &mut result);
            continue;
        }
        if metadata.is_dir() {
            if pip_cache_dir_forbidden(&path, root) {
                result.skipped_count += 1;
                continue;
            }
            dirs.push(path.clone());
            match fs::read_dir(&path) {
                Ok(entries) => {
                    for entry in entries.flatten() {
                        queue.push_back(entry.path());
                    }
                }
                Err(_) => result.skipped_count += 1,
            }
        }
    }

    dirs.sort_by(|left, right| right.components().count().cmp(&left.components().count()));
    for dir in dirs {
        if dir == root || pip_cache_dir_forbidden(&dir, root) {
            continue;
        }
        match fs::remove_dir(&dir) {
            Ok(_) => result.deleted_dirs = result.deleted_dirs.saturating_add(1),
            Err(_) => result.skipped_count += 1,
        }
    }

    result
}

fn delete_single_pip_cache_file(
    path: &Path,
    metadata: &fs::Metadata,
    result: &mut PipCacheDeleteResult,
) {
    delete_single_pip_cache_file_at(path, metadata, SystemTime::now(), result);
}

fn delete_single_pip_cache_file_at(
    path: &Path,
    metadata: &fs::Metadata,
    now: SystemTime,
    result: &mut PipCacheDeleteResult,
) {
    if !file_old_enough_for_pip_cache_delete_at(metadata, now) || pip_cache_file_forbidden(path) {
        result.skipped_count += 1;
        return;
    }
    let bytes = metadata.len();
    match fs::remove_file(path) {
        Ok(_) => {
            result.deleted_bytes = result.deleted_bytes.saturating_add(bytes);
            result.deleted_files = result.deleted_files.saturating_add(1);
        }
        Err(_) => result.skipped_count += 1,
    }
}

fn file_old_enough_for_pip_cache_delete(metadata: &fs::Metadata) -> bool {
    file_old_enough_for_pip_cache_delete_at(metadata, SystemTime::now())
}

fn file_old_enough_for_pip_cache_delete_at(metadata: &fs::Metadata, now: SystemTime) -> bool {
    let Ok(modified) = metadata.modified() else {
        return false;
    };
    let Ok(age) = now.duration_since(modified) else {
        return false;
    };
    age.as_secs() >= 14 * 24 * 60 * 60
}

fn pip_cache_dir_forbidden(path: &Path, root: &Path) -> bool {
    if path == root {
        return false;
    }
    let clean = normalize_path(&path_to_string(path));
    clean.contains("\\selfcheck")
        || clean.contains("\\site-packages")
        || clean.contains("\\venv")
        || clean.contains("\\virtualenv")
        || clean.contains("\\scripts")
        || clean.contains("\\projects")
}

fn pip_cache_file_forbidden(path: &Path) -> bool {
    if !pip_cache_path_is_under_current_user_root(path) {
        return true;
    }
    let clean_path = normalize_path(&path_to_string(path));
    if clean_path.contains("\\selfcheck\\") {
        return true;
    }
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.to_ascii_lowercase())
        .unwrap_or_default();
    file_name.is_empty()
        || file_name.ends_with(".lock")
        || file_name.ends_with(".db")
        || file_name.ends_with(".sqlite")
        || file_name.ends_with(".sqlite3")
        || file_name.ends_with(".ini")
        || file_name.ends_with(".conf")
        || file_name.ends_with(".config")
        || file_name.ends_with(".cfg")
        || file_name.ends_with(".log")
        || file_name.contains("credential")
        || file_name.contains("password")
        || file_name.contains("token")
        || file_name.contains("session")
        || file_name.contains("history")
}

fn pip_cache_path_is_under_current_user_root(path: &Path) -> bool {
    let Some(local_app_data) = env_path("LOCALAPPDATA").or_else(|| {
        env_path("USERPROFILE")
            .or_else(|| env_path("HOME"))
            .map(|profile| profile.join("AppData").join("Local"))
    }) else {
        return false;
    };

    path_is_under(path, &local_app_data.join("pip").join("Cache"))
}

fn run_docker_command(args: &[&str], timeout_secs: u64) -> DockerCommandResult {
    let mut child = match Command::new("docker")
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            return DockerCommandResult {
                error: error.to_string(),
                ..DockerCommandResult::default()
            }
        }
    };

    let started = Instant::now();
    let timeout = Duration::from_secs(timeout_secs);
    loop {
        match child.try_wait() {
            Ok(Some(_)) => match child.wait_with_output() {
                Ok(output) => {
                    return DockerCommandResult {
                        ok: output.status.success(),
                        timed_out: false,
                        exit_code: output.status.code(),
                        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
                        error: String::new(),
                    }
                }
                Err(error) => {
                    return DockerCommandResult {
                        error: error.to_string(),
                        ..DockerCommandResult::default()
                    }
                }
            },
            Ok(None) => {
                if started.elapsed() >= timeout {
                    let _ = child.kill();
                    let output = child.wait_with_output().ok();
                    return DockerCommandResult {
                        ok: false,
                        timed_out: true,
                        exit_code: output.as_ref().and_then(|out| out.status.code()),
                        stdout: output
                            .as_ref()
                            .map(|out| String::from_utf8_lossy(&out.stdout).to_string())
                            .unwrap_or_default(),
                        stderr: output
                            .as_ref()
                            .map(|out| String::from_utf8_lossy(&out.stderr).to_string())
                            .unwrap_or_default(),
                        error: String::new(),
                    };
                }
                thread::sleep(Duration::from_millis(100));
            }
            Err(error) => {
                return DockerCommandResult {
                    error: error.to_string(),
                    ..DockerCommandResult::default()
                }
            }
        }
    }
}

fn docker_build_cache_prune_result(output: &str) -> Option<u64> {
    output.lines().find_map(|line| {
        let clean = line.trim();
        let lower = clean.to_ascii_lowercase();
        if !lower.contains("total reclaimed space") {
            return None;
        }
        clean
            .split(':')
            .last()
            .and_then(|value| parse_docker_size_to_bytes(value.trim()))
    })
}

fn docker_build_cache_inventory_bytes(output: &str) -> Option<u64> {
    output.lines().find_map(|line| {
        let clean = line.trim();
        let lower = clean.to_ascii_lowercase();
        if !lower.starts_with("build cache") {
            return None;
        }
        let parts = clean.split_whitespace().collect::<Vec<_>>();
        let size_token = parts.iter().rev().find(|part| {
            part.chars().any(|ch| ch.is_ascii_digit())
                && part.chars().any(|ch| ch.is_ascii_alphabetic())
        })?;
        parse_docker_size_to_bytes(size_token)
    })
}

fn parse_docker_size_to_bytes(value: &str) -> Option<u64> {
    let clean = value.trim().trim_end_matches(',');
    if clean.is_empty() {
        return None;
    }
    let mut number = String::new();
    let mut unit = String::new();
    for ch in clean.chars() {
        if ch.is_ascii_digit() || ch == '.' {
            number.push(ch);
        } else if !ch.is_whitespace() {
            unit.push(ch.to_ascii_lowercase());
        }
    }
    if number.is_empty() {
        return None;
    }
    let parsed = number.parse::<f64>().ok()?;
    let multiplier = match unit.as_str() {
        "" | "b" | "bytes" => 1_f64,
        "kb" | "kib" | "k" => 1024_f64,
        "mb" | "mib" | "m" => 1024_f64.powi(2),
        "gb" | "gib" | "g" => 1024_f64.powi(3),
        "tb" | "tib" | "t" => 1024_f64.powi(4),
        _ => return None,
    };
    Some((parsed * multiplier).max(0.0) as u64)
}

fn first_non_empty_line(value: &str) -> Option<String> {
    value
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(|line| line.chars().take(180).collect())
}

fn delete_npm_cache_target(root: &Path) -> NpmCacheDeleteResult {
    delete_npm_cache_target_at(root, SystemTime::now())
}

fn delete_npm_cache_target_at(root: &Path, now: SystemTime) -> NpmCacheDeleteResult {
    let mut result = NpmCacheDeleteResult::default();
    if npm_cache_target_reject_code(&path_to_string(root)).is_some() {
        result.skipped_count += 1;
        return result;
    }

    let mut queue = VecDeque::from([root.to_path_buf()]);
    let mut dirs = Vec::new();
    let mut visited = 0usize;
    while let Some(path) = queue.pop_front() {
        if visited >= 250_000 || result.deleted_files >= 120_000 {
            result.skipped_count += 1;
            break;
        }
        visited += 1;

        let Ok(metadata) = fs::symlink_metadata(&path) else {
            result.skipped_count += 1;
            continue;
        };
        if metadata.file_type().is_symlink() {
            result.skipped_count += 1;
            continue;
        }
        if metadata.is_file() {
            delete_single_npm_cache_file_at(&path, &metadata, now, &mut result);
            continue;
        }
        if metadata.is_dir() {
            dirs.push(path.clone());
            match fs::read_dir(&path) {
                Ok(entries) => {
                    for entry in entries.flatten() {
                        queue.push_back(entry.path());
                    }
                }
                Err(_) => result.skipped_count += 1,
            }
        }
    }

    dirs.sort_by(|left, right| right.components().count().cmp(&left.components().count()));
    for dir in dirs {
        if dir == root {
            continue;
        }
        match fs::remove_dir(&dir) {
            Ok(_) => result.deleted_dirs = result.deleted_dirs.saturating_add(1),
            Err(_) => result.skipped_count += 1,
        }
    }

    result
}

fn delete_single_npm_cache_file(
    path: &Path,
    metadata: &fs::Metadata,
    result: &mut NpmCacheDeleteResult,
) {
    delete_single_npm_cache_file_at(path, metadata, SystemTime::now(), result);
}

fn delete_single_npm_cache_file_at(
    path: &Path,
    metadata: &fs::Metadata,
    now: SystemTime,
    result: &mut NpmCacheDeleteResult,
) {
    if !file_old_enough_for_npm_cache_delete_at(metadata, now) || npm_cache_file_forbidden(path) {
        result.skipped_count += 1;
        return;
    }
    let bytes = metadata.len();
    match fs::remove_file(path) {
        Ok(_) => {
            result.deleted_bytes = result.deleted_bytes.saturating_add(bytes);
            result.deleted_files = result.deleted_files.saturating_add(1);
        }
        Err(_) => result.skipped_count += 1,
    }
}

fn file_old_enough_for_npm_cache_delete(metadata: &fs::Metadata) -> bool {
    file_old_enough_for_npm_cache_delete_at(metadata, SystemTime::now())
}

fn file_old_enough_for_npm_cache_delete_at(metadata: &fs::Metadata, now: SystemTime) -> bool {
    let Ok(modified) = metadata.modified() else {
        return false;
    };
    let Ok(age) = now.duration_since(modified) else {
        return false;
    };
    age.as_secs() >= 14 * 24 * 60 * 60
}

fn npm_cache_file_forbidden(path: &Path) -> bool {
    let clean_path = normalize_path(&path_to_string(path));
    if !clean_path.contains("\\_cacache\\content-v2\\") && !clean_path.contains("\\_cacache\\tmp\\")
    {
        return true;
    }
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.to_ascii_lowercase().ends_with(".lock"))
        .unwrap_or(true)
}

fn delete_pnpm_store_target(root: &Path) -> PnpmStoreDeleteResult {
    delete_pnpm_store_target_at(root, SystemTime::now())
}

fn delete_pnpm_store_target_at(root: &Path, now: SystemTime) -> PnpmStoreDeleteResult {
    let mut result = PnpmStoreDeleteResult::default();
    if pnpm_store_target_reject_code(&path_to_string(root)).is_some() {
        result.skipped_count += 1;
        return result;
    }

    let mut queue = VecDeque::from([root.to_path_buf()]);
    let mut dirs = Vec::new();
    let mut visited = 0usize;
    while let Some(path) = queue.pop_front() {
        if visited >= 250_000 || result.deleted_files >= 120_000 {
            result.skipped_count += 1;
            break;
        }
        visited += 1;

        let Ok(metadata) = fs::symlink_metadata(&path) else {
            result.skipped_count += 1;
            continue;
        };
        if metadata.file_type().is_symlink() {
            result.skipped_count += 1;
            continue;
        }
        if metadata.is_file() {
            delete_single_pnpm_store_file_at(&path, &metadata, now, &mut result);
            continue;
        }
        if metadata.is_dir() {
            dirs.push(path.clone());
            match fs::read_dir(&path) {
                Ok(entries) => {
                    for entry in entries.flatten() {
                        queue.push_back(entry.path());
                    }
                }
                Err(_) => result.skipped_count += 1,
            }
        }
    }

    dirs.sort_by(|left, right| right.components().count().cmp(&left.components().count()));
    for dir in dirs {
        if dir == root {
            continue;
        }
        match fs::remove_dir(&dir) {
            Ok(_) => result.deleted_dirs = result.deleted_dirs.saturating_add(1),
            Err(_) => result.skipped_count += 1,
        }
    }

    result
}

fn delete_single_pnpm_store_file(
    path: &Path,
    metadata: &fs::Metadata,
    result: &mut PnpmStoreDeleteResult,
) {
    delete_single_pnpm_store_file_at(path, metadata, SystemTime::now(), result);
}

fn delete_single_pnpm_store_file_at(
    path: &Path,
    metadata: &fs::Metadata,
    now: SystemTime,
    result: &mut PnpmStoreDeleteResult,
) {
    if !file_old_enough_for_pnpm_store_delete_at(metadata, now) || pnpm_store_file_forbidden(path) {
        result.skipped_count += 1;
        return;
    }
    let bytes = metadata.len();
    match fs::remove_file(path) {
        Ok(_) => {
            result.deleted_bytes = result.deleted_bytes.saturating_add(bytes);
            result.deleted_files = result.deleted_files.saturating_add(1);
        }
        Err(_) => result.skipped_count += 1,
    }
}

fn file_old_enough_for_pnpm_store_delete(metadata: &fs::Metadata) -> bool {
    file_old_enough_for_pnpm_store_delete_at(metadata, SystemTime::now())
}

fn file_old_enough_for_pnpm_store_delete_at(metadata: &fs::Metadata, now: SystemTime) -> bool {
    let Ok(modified) = metadata.modified() else {
        return false;
    };
    let Ok(age) = now.duration_since(modified) else {
        return false;
    };
    age.as_secs() >= 30 * 24 * 60 * 60
}

fn pnpm_store_file_forbidden(path: &Path) -> bool {
    let clean_path = normalize_path(&path_to_string(path));
    let versioned_content =
        clean_path.contains("\\pnpm\\store\\v") && clean_path.contains("\\files\\");
    let allowed_content = versioned_content
        || clean_path.contains("\\pnpm\\store\\files\\")
        || clean_path.contains("\\pnpm\\store\\tmp\\")
        || clean_path.contains("\\pnpm\\store\\temp\\");
    if !allowed_content {
        return true;
    }
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.to_ascii_lowercase())
        .unwrap_or_default();
    file_name.is_empty()
        || file_name.ends_with(".lock")
        || file_name.ends_with(".json")
        || file_name.ends_with(".yaml")
        || file_name.ends_with(".yml")
        || file_name.ends_with(".log")
        || file_name == "metadata"
}

fn recycle_bin_drive_root(value: &str) -> Option<String> {
    let path = resolve_dry_run_target(value);
    let text = path_to_string(&path);
    let mut chars = text.trim().chars();
    let letter = chars.next()?;
    let colon = chars.next()?;
    if !letter.is_ascii_alphabetic() || colon != ':' {
        return None;
    }
    Some(format!("{}:\\", letter.to_ascii_uppercase()))
}

fn empty_recycle_bin_target(value: &str) -> RecycleBinEmptyResult {
    let Some(root) = recycle_bin_drive_root(value) else {
        return RecycleBinEmptyResult {
            succeeded: false,
            before_bytes: 0,
            after_bytes: 0,
            before_items: 0,
            after_items: 0,
            hresult: -1,
        };
    };
    empty_recycle_bin_drive_root(&root)
}

#[cfg(target_os = "windows")]
fn empty_recycle_bin_drive_root(root: &str) -> RecycleBinEmptyResult {
    let before = query_recycle_bin_drive_root(root);
    let wide_root = wide_null(root);
    let hresult = unsafe {
        SHEmptyRecycleBinW(
            std::ptr::null_mut(),
            wide_root.as_ptr(),
            SHERB_NOCONFIRMATION | SHERB_NOPROGRESSUI | SHERB_NOSOUND,
        )
    };
    let after = query_recycle_bin_drive_root(root);
    RecycleBinEmptyResult {
        succeeded: hresult_succeeded(hresult),
        before_bytes: before.map(|info| info.0).unwrap_or(0),
        after_bytes: after.map(|info| info.0).unwrap_or(0),
        before_items: before.map(|info| info.1).unwrap_or(0),
        after_items: after.map(|info| info.1).unwrap_or(0),
        hresult,
    }
}

#[cfg(not(target_os = "windows"))]
fn empty_recycle_bin_drive_root(_root: &str) -> RecycleBinEmptyResult {
    RecycleBinEmptyResult {
        succeeded: false,
        before_bytes: 0,
        after_bytes: 0,
        before_items: 0,
        after_items: 0,
        hresult: -1,
    }
}

#[cfg(target_os = "windows")]
fn move_download_file_to_recycle_bin(path: &Path) -> DownloadsRecycleMoveResult {
    let bytes = fs::metadata(path)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    let from = wide_double_null(&path_to_string(path));
    let mut operation = ShFileOpStructW {
        hwnd: std::ptr::null_mut(),
        w_func: FO_DELETE,
        p_from: from.as_ptr(),
        p_to: std::ptr::null(),
        f_flags: FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_NOERRORUI | FOF_SILENT,
        f_any_operations_aborted: 0,
        h_name_mappings: std::ptr::null_mut(),
        lpsz_progress_title: std::ptr::null(),
    };
    let error_code = unsafe { SHFileOperationW(&mut operation) };
    let succeeded = error_code == 0 && operation.f_any_operations_aborted == 0 && !path.exists();
    DownloadsRecycleMoveResult {
        succeeded,
        bytes: if succeeded { bytes } else { 0 },
        error_code,
    }
}

#[cfg(not(target_os = "windows"))]
fn move_download_file_to_recycle_bin(_path: &Path) -> DownloadsRecycleMoveResult {
    DownloadsRecycleMoveResult {
        succeeded: false,
        bytes: 0,
        error_code: -1,
    }
}

fn archive_large_file_to_destination(
    source: &Path,
    destination_root: &Path,
    plan_id: &str,
) -> LargeFileArchiveMoveResult {
    let bytes = fs::metadata(source)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    let archive_dir = destination_root
        .join("SpaceGuard Archive")
        .join(sanitize_archive_segment(plan_id));
    if fs::create_dir_all(&archive_dir).is_err() {
        return LargeFileArchiveMoveResult {
            succeeded: false,
            bytes: 0,
            error_code: 1,
            archive_path: path_to_string(&archive_dir),
        };
    }

    let file_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.trim().is_empty())
        .unwrap_or("archived-file");
    let archive_path = unique_archive_path(&archive_dir, file_name);
    let archive_path_text = path_to_string(&archive_path);

    let Ok(copied_bytes) = fs::copy(source, &archive_path) else {
        return LargeFileArchiveMoveResult {
            succeeded: false,
            bytes: 0,
            error_code: 2,
            archive_path: archive_path_text,
        };
    };
    let archive_len = fs::metadata(&archive_path)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    if copied_bytes < bytes || archive_len < bytes {
        return LargeFileArchiveMoveResult {
            succeeded: false,
            bytes: 0,
            error_code: 3,
            archive_path: archive_path_text,
        };
    }
    if fs::remove_file(source).is_err() || source.exists() {
        return LargeFileArchiveMoveResult {
            succeeded: false,
            bytes: 0,
            error_code: 4,
            archive_path: archive_path_text,
        };
    }

    LargeFileArchiveMoveResult {
        succeeded: true,
        bytes,
        error_code: 0,
        archive_path: archive_path_text,
    }
}

fn sanitize_archive_segment(value: &str) -> String {
    let clean = value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();
    if clean.is_empty() {
        "plan".to_string()
    } else {
        clean.chars().take(80).collect()
    }
}

fn unique_archive_path(root: &Path, file_name: &str) -> PathBuf {
    let candidate = root.join(file_name);
    if !candidate.exists() {
        return candidate;
    }
    let path = Path::new(file_name);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("archived-file");
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    for index in 1..1000 {
        let name = if extension.is_empty() {
            format!("{stem}-{index}")
        } else {
            format!("{stem}-{index}.{extension}")
        };
        let candidate = root.join(name);
        if !candidate.exists() {
            return candidate;
        }
    }
    root.join(format!("{stem}-overflow"))
}

fn delete_project_dependency_target(root: &Path) -> ProjectDependencyDeleteResult {
    let mut result = ProjectDependencyDeleteResult::default();
    if project_dependency_target_reject_code(&path_to_string(root)).is_some() {
        result.skipped_count += 1;
        return result;
    }

    let mut queue = VecDeque::from([root.to_path_buf()]);
    let mut dirs = Vec::new();
    let mut visited = 0usize;
    while let Some(path) = queue.pop_front() {
        if visited >= 200_000 || result.deleted_files >= 100_000 {
            result.skipped_count += 1;
            break;
        }
        visited += 1;

        let Ok(metadata) = fs::symlink_metadata(&path) else {
            result.skipped_count += 1;
            continue;
        };
        if metadata.file_type().is_symlink() {
            result.skipped_count += 1;
            continue;
        }
        if metadata.is_file() {
            let bytes = metadata.len();
            match fs::remove_file(&path) {
                Ok(_) => {
                    result.deleted_bytes = result.deleted_bytes.saturating_add(bytes);
                    result.deleted_files = result.deleted_files.saturating_add(1);
                }
                Err(_) => result.skipped_count += 1,
            }
            continue;
        }
        if metadata.is_dir() {
            dirs.push(path.clone());
            match fs::read_dir(&path) {
                Ok(entries) => {
                    for entry in entries.flatten() {
                        queue.push_back(entry.path());
                    }
                }
                Err(_) => result.skipped_count += 1,
            }
        }
    }

    dirs.sort_by(|left, right| right.components().count().cmp(&left.components().count()));
    for dir in dirs {
        match fs::remove_dir(&dir) {
            Ok(_) => result.deleted_dirs = result.deleted_dirs.saturating_add(1),
            Err(_) => result.skipped_count += 1,
        }
    }

    result
}

fn delete_temp_action_targets(value: &str) -> TempDeleteResult {
    let mut result = TempDeleteResult::default();
    for target in split_dry_run_targets(value) {
        let path = resolve_dry_run_target(&target);
        let deleted = delete_temp_files_under(&path, 1_000);
        result.deleted_bytes = result.deleted_bytes.saturating_add(deleted.deleted_bytes);
        result.deleted_files = result.deleted_files.saturating_add(deleted.deleted_files);
        result.skipped_count = result.skipped_count.saturating_add(deleted.skipped_count);
    }
    result
}

fn delete_temp_files_under(root: &Path, limit: usize) -> TempDeleteResult {
    let mut result = TempDeleteResult::default();
    let Ok(root_metadata) = fs::symlink_metadata(root) else {
        result.skipped_count += 1;
        return result;
    };
    if root_metadata.file_type().is_symlink() {
        result.skipped_count += 1;
        return result;
    }
    if root_metadata.is_file() {
        delete_single_temp_file(root, &root_metadata, &mut result);
        return result;
    }

    let mut queue = VecDeque::from([root.to_path_buf()]);
    let mut visited = 0usize;
    while let Some(path) = queue.pop_front() {
        if visited >= 20_000 || result.deleted_files as usize >= limit {
            break;
        }
        visited += 1;

        let Ok(metadata) = fs::symlink_metadata(&path) else {
            result.skipped_count += 1;
            continue;
        };
        if metadata.file_type().is_symlink() {
            result.skipped_count += 1;
            continue;
        }
        if metadata.is_file() {
            delete_single_temp_file(&path, &metadata, &mut result);
            continue;
        }
        if metadata.is_dir() {
            match fs::read_dir(&path) {
                Ok(entries) => {
                    for entry in entries.flatten() {
                        queue.push_back(entry.path());
                    }
                }
                Err(_) => result.skipped_count += 1,
            }
        }
    }
    result
}

fn delete_single_temp_file(path: &Path, metadata: &fs::Metadata, result: &mut TempDeleteResult) {
    if !file_old_enough_for_temp_delete(metadata) {
        result.skipped_count += 1;
        return;
    }
    let bytes = metadata.len();
    match fs::remove_file(path) {
        Ok(_) => {
            result.deleted_bytes = result.deleted_bytes.saturating_add(bytes);
            result.deleted_files = result.deleted_files.saturating_add(1);
        }
        Err(_) => result.skipped_count += 1,
    }
}

fn file_old_enough_for_temp_delete(metadata: &fs::Metadata) -> bool {
    let Ok(modified) = metadata.modified() else {
        return false;
    };
    let Ok(age) = SystemTime::now().duration_since(modified) else {
        return false;
    };
    age.as_secs() >= 24 * 60 * 60
}

fn openai_response_format() -> Value {
    json!({
        "type": "json_schema",
        "name": "spaceguard_cleanup_agent_advice",
        "description": "A bounded cleanup advisor response for SpaceGuard. It recommends UI-mediated cleanup actions without tool authority.",
        "strict": true,
        "schema": {
            "type": "object",
            "additionalProperties": false,
            "required": ["summary", "nextAction", "confidence", "recommendedActions", "blockedActions", "questions", "warnings"],
            "properties": {
                "summary": { "type": "string" },
                "nextAction": { "type": "string" },
                "confidence": { "type": "string", "enum": ["high", "medium", "low"] },
                "recommendedActions": {
                    "type": "array",
                    "maxItems": 8,
                    "items": openai_advice_row_schema()
                },
                "blockedActions": {
                    "type": "array",
                    "maxItems": 8,
                    "items": openai_advice_row_schema()
                },
                "questions": { "type": "array", "maxItems": 6, "items": { "type": "string" } },
                "warnings": { "type": "array", "maxItems": 6, "items": { "type": "string" } }
            }
        }
    })
}

fn openai_advice_row_schema() -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "title", "reason", "priority", "actionType", "targetId", "route"],
        "properties": {
            "id": { "type": "string" },
            "title": { "type": "string" },
            "reason": { "type": "string" },
            "priority": { "type": "string", "enum": ["high", "medium", "low"] },
            "actionType": {
                "type": "string",
                "enum": ["select-action", "review-target", "run-temp-executor", "run-downloads-cleanup-executor", "run-large-file-archive-executor", "run-project-deps-executor", "run-browser-cache-executor", "run-gradle-cache-executor", "run-user-cache-executor", "run-android-cache-executor", "run-shader-cache-executor", "run-pip-cache-executor", "run-docker-build-cache-executor", "run-npm-cache-executor", "run-pnpm-store-executor", "run-recycle-bin-executor", "rescan", "ask-user", "manual-only"]
            },
            "targetId": { "type": "string" },
            "route": { "type": "string" }
        }
    })
}

fn extract_openai_response_text(payload: &Value) -> String {
    if let Some(text) = payload.get("output_text").and_then(Value::as_str) {
        return text.trim().to_string();
    }
    let mut parts = Vec::new();
    if let Some(output) = payload.get("output").and_then(Value::as_array) {
        for item in output {
            if let Some(content) = item.get("content").and_then(Value::as_array) {
                for content_item in content {
                    if let Some(text) = content_item.get("text").and_then(Value::as_str) {
                        parts.push(text.to_string());
                    }
                    if let Some(text) = content_item.get("output_text").and_then(Value::as_str) {
                        parts.push(text.to_string());
                    }
                }
            }
        }
    }
    parts.join("\n").trim().to_string()
}

fn parse_openai_advice(text: &str) -> Value {
    let clean = strip_json_fence(text);
    serde_json::from_str::<Value>(&clean).unwrap_or_else(|_| {
        json!({
            "summary": if text.trim().is_empty() { "OpenAI returned no text." } else { text.trim() },
            "nextAction": "Review the raw response.",
            "confidence": "low",
            "recommendedActions": [],
            "blockedActions": [],
            "questions": [],
            "warnings": []
        })
    })
}

fn strip_json_fence(text: &str) -> String {
    let mut clean = text.trim();
    if let Some(rest) = clean.strip_prefix("```json") {
        clean = rest.trim();
    } else if let Some(rest) = clean.strip_prefix("```") {
        clean = rest.trim();
    }
    if let Some(rest) = clean.strip_suffix("```") {
        clean = rest.trim();
    }
    clean.to_string()
}

fn normalize_openai_reasoning_effort(value: &str) -> String {
    let clean = value.trim().to_lowercase();
    match clean.as_str() {
        "default" | "none" | "minimal" | "low" | "medium" | "high" | "xhigh" => clean,
        _ => DEFAULT_OPENAI_REASONING_EFFORT.to_string(),
    }
}

fn openai_env_value(names: &[&str]) -> Option<(String, String)> {
    runtime_env_value(names)
}

fn runtime_env_value(names: &[&str]) -> Option<(String, String)> {
    for name in names {
        if let Ok(value) = env::var(name) {
            let value = value.trim().to_string();
            if !value.is_empty() {
                return Some((value, (*name).to_string()));
            }
        }
    }
    for path in dotenv_candidate_paths() {
        for name in names {
            if let Some(value) = dotenv_value(&path, name) {
                return Some((value, format!(".env:{name}")));
            }
        }
    }
    None
}

fn dotenv_candidate_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(current) = env::current_dir() {
        let mut cursor = Some(current.as_path());
        let mut depth = 0;
        while let Some(path) = cursor {
            if depth > 2 {
                break;
            }
            push_unique_path(&mut paths, path.join(".env"));
            cursor = path.parent();
            depth += 1;
        }
    }
    if let Ok(exe) = env::current_exe() {
        if let Some(dir) = exe.parent() {
            push_unique_path(&mut paths, dir.join(".env"));
        }
    }
    paths
}

fn push_unique_path(paths: &mut Vec<PathBuf>, path: PathBuf) {
    if !paths.iter().any(|existing| existing == &path) {
        paths.push(path);
    }
}

fn dotenv_value(path: &Path, name: &str) -> Option<String> {
    let content = fs::read_to_string(path).ok()?;
    for line in content.lines() {
        let clean = line.trim();
        if clean.is_empty() || clean.starts_with('#') {
            continue;
        }
        let clean = clean.strip_prefix("export ").unwrap_or(clean);
        let Some((key, value)) = clean.split_once('=') else {
            continue;
        };
        if key.trim() != name {
            continue;
        }
        let value = unquote_env_value(value.trim()).trim().to_string();
        if !value.is_empty() {
            return Some(value);
        }
    }
    None
}

fn unquote_env_value(value: &str) -> String {
    let bytes = value.as_bytes();
    if bytes.len() >= 2
        && ((bytes[0] == b'"' && bytes[bytes.len() - 1] == b'"')
            || (bytes[0] == b'\'' && bytes[bytes.len() - 1] == b'\''))
    {
        value[1..value.len() - 1].to_string()
    } else {
        value.to_string()
    }
}

fn json_string_field(value: &Value, camel_case: &str, snake_case: &str) -> String {
    value
        .get(camel_case)
        .or_else(|| value.get(snake_case))
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string()
}

fn json_bool_field(value: &Value, camel_case: &str, snake_case: &str) -> bool {
    value
        .get(camel_case)
        .or_else(|| value.get(snake_case))
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

#[tauri::command]
fn runtime_capabilities() -> RuntimeCapabilities {
    let temp_enabled = cfg!(target_os = "windows") && temp_executor_enabled();
    let project_dependency_enabled =
        cfg!(target_os = "windows") && project_dependency_executor_enabled();
    let downloads_cleanup_enabled =
        cfg!(target_os = "windows") && downloads_cleanup_executor_enabled();
    let large_file_archive_enabled =
        cfg!(target_os = "windows") && large_file_archive_executor_enabled();
    let browser_cache_enabled = cfg!(target_os = "windows") && browser_cache_executor_enabled();
    let gradle_cache_enabled = cfg!(target_os = "windows") && gradle_cache_executor_enabled();
    let user_cache_enabled = cfg!(target_os = "windows") && user_cache_executor_enabled();
    let android_cache_enabled = cfg!(target_os = "windows") && android_cache_executor_enabled();
    let shader_cache_enabled = cfg!(target_os = "windows") && shader_cache_executor_enabled();
    let pip_cache_enabled = cfg!(target_os = "windows") && pip_cache_executor_enabled();
    let tool_native_prune_enabled =
        cfg!(target_os = "windows") && tool_native_prune_executors_enabled();
    let npm_cache_enabled = cfg!(target_os = "windows") && npm_cache_executor_enabled();
    let pnpm_store_enabled = cfg!(target_os = "windows") && pnpm_store_executor_enabled();
    let recycle_bin_enabled = cfg!(target_os = "windows") && recycle_bin_executor_enabled();
    let openai_key_source = openai_env_value(&["OPENAI_API_KEY", "VITE_OPENAI_API_KEY"])
        .map(|(_, source)| source)
        .unwrap_or_else(|| "missing".to_string());
    let openai_advisor_configured = openai_key_source != "missing";
    let enabled_scoped_executor_flags = enabled_scoped_executor_flags_on_windows();
    let enabled_scoped_executor_flag_count = enabled_scoped_executor_flags.len();
    let executor_scope_status = if enabled_scoped_executor_flag_count > 1 {
        "multiple-scoped-flags"
    } else if enabled_scoped_executor_flag_count == 1 {
        "single-scoped-flag"
    } else {
        "no-scoped-flags"
    };
    let real_execution_enabled = enabled_scoped_executor_flag_count == 1;
    RuntimeCapabilities {
        mode: if enabled_scoped_executor_flag_count > 1 {
            "native-scope-invalid"
        } else if real_execution_enabled {
            "native-scoped-write"
        } else {
            "native-readonly"
        },
        platform: env::consts::OS.to_string(),
        windows: cfg!(target_os = "windows"),
        elevated: is_process_elevated(),
        elevation_source: elevation_source(),
        real_run_enabled: real_execution_enabled,
        destructive_commands: real_execution_enabled,
        scan_known_roots: true,
        execute_cleanup_plan: true,
        openai_agent_advice: true,
        openai_advisor_configured,
        openai_key_source,
        safe_executors_enabled: real_execution_enabled,
        enabled_scoped_executor_flags,
        enabled_scoped_executor_flag_count,
        executor_scope_status,
        executor_flags: ExecutorFeatureFlags {
            temp_cleanup_executor: temp_enabled,
            project_dependency_executor: project_dependency_enabled,
            downloads_cleanup_executor: downloads_cleanup_enabled,
            large_file_archive_executor: large_file_archive_enabled,
            gradle_cache_executor: gradle_cache_enabled,
            user_cache_executor: user_cache_enabled,
            android_cache_executor: android_cache_enabled,
            shader_cache_executor: shader_cache_enabled,
            pip_cache_executor: pip_cache_enabled,
            tool_native_prune_executors: tool_native_prune_enabled,
            npm_cache_executor: npm_cache_enabled,
            pnpm_store_executor: pnpm_store_enabled,
            recycle_bin_executor: recycle_bin_enabled,
            browser_cache_executor: browser_cache_enabled,
        },
        reason: if enabled_scoped_executor_flag_count > 1 {
            "Multiple scoped cleanup executor flags are enabled; turn off all but one before real cleanup."
        } else if real_execution_enabled {
            "Exactly one scoped cleanup executor is enabled by environment flag."
        } else {
            "Real executors are disabled until a scoped executor flag is enabled on Windows."
        }
        .to_string(),
    }
}

#[cfg(target_os = "windows")]
#[link(name = "shell32")]
extern "system" {
    fn IsUserAnAdmin() -> i32;
    fn SHQueryRecycleBinW(
        psz_root_path: *const u16,
        p_sh_query_rb_info: *mut ShQueryRecycleBinInfo,
    ) -> i32;
    fn SHEmptyRecycleBinW(
        hwnd: *mut std::ffi::c_void,
        psz_root_path: *const u16,
        dw_flags: u32,
    ) -> i32;
    fn SHFileOperationW(lp_file_op: *mut ShFileOpStructW) -> i32;
}

#[cfg(target_os = "windows")]
const SHERB_NOCONFIRMATION: u32 = 0x0000_0001;
#[cfg(target_os = "windows")]
const SHERB_NOPROGRESSUI: u32 = 0x0000_0002;
#[cfg(target_os = "windows")]
const SHERB_NOSOUND: u32 = 0x0000_0004;

#[cfg(target_os = "windows")]
const FO_DELETE: u32 = 0x0003;
#[cfg(target_os = "windows")]
const FOF_SILENT: u16 = 0x0004;
#[cfg(target_os = "windows")]
const FOF_NOCONFIRMATION: u16 = 0x0010;
#[cfg(target_os = "windows")]
const FOF_ALLOWUNDO: u16 = 0x0040;
#[cfg(target_os = "windows")]
const FOF_NOERRORUI: u16 = 0x0400;

#[cfg(target_os = "windows")]
#[repr(C)]
struct ShFileOpStructW {
    hwnd: *mut std::ffi::c_void,
    w_func: u32,
    p_from: *const u16,
    p_to: *const u16,
    f_flags: u16,
    f_any_operations_aborted: i32,
    h_name_mappings: *mut std::ffi::c_void,
    lpsz_progress_title: *const u16,
}

#[cfg(target_os = "windows")]
#[repr(C)]
struct ShQueryRecycleBinInfo {
    cb_size: u32,
    i64_size: i64,
    i64_num_items: i64,
}

#[cfg(target_os = "windows")]
fn is_process_elevated() -> bool {
    unsafe { IsUserAnAdmin() != 0 }
}

#[cfg(not(target_os = "windows"))]
fn is_process_elevated() -> bool {
    false
}

#[cfg(target_os = "windows")]
fn elevation_source() -> &'static str {
    "IsUserAnAdmin"
}

#[cfg(not(target_os = "windows"))]
fn elevation_source() -> &'static str {
    "non-windows"
}

#[cfg(target_os = "windows")]
fn wide_null(value: &str) -> Vec<u16> {
    OsStr::new(value)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

#[cfg(target_os = "windows")]
fn wide_double_null(value: &str) -> Vec<u16> {
    OsStr::new(value).encode_wide().chain([0, 0]).collect()
}

#[cfg(target_os = "windows")]
type RegistryKeyHandle = isize;

#[cfg(target_os = "windows")]
const HKEY_CURRENT_USER: RegistryKeyHandle = 0x8000_0001_u32 as i32 as isize;
#[cfg(target_os = "windows")]
const HKEY_LOCAL_MACHINE: RegistryKeyHandle = 0x8000_0002_u32 as i32 as isize;
#[cfg(target_os = "windows")]
const KEY_READ: u32 = 0x0002_0019;
#[cfg(target_os = "windows")]
const KEY_WOW64_64KEY: u32 = 0x0000_0100;
#[cfg(target_os = "windows")]
const KEY_WOW64_32KEY: u32 = 0x0000_0200;
#[cfg(target_os = "windows")]
const ERROR_SUCCESS: i32 = 0;
#[cfg(target_os = "windows")]
const ERROR_NO_MORE_ITEMS: i32 = 259;
#[cfg(target_os = "windows")]
const REG_SZ: u32 = 1;
#[cfg(target_os = "windows")]
const REG_EXPAND_SZ: u32 = 2;
#[cfg(target_os = "windows")]
const REG_DWORD: u32 = 4;

#[cfg(target_os = "windows")]
#[link(name = "Advapi32")]
extern "system" {
    fn RegOpenKeyExW(
        h_key: RegistryKeyHandle,
        lp_sub_key: *const u16,
        ul_options: u32,
        sam_desired: u32,
        phk_result: *mut RegistryKeyHandle,
    ) -> i32;
    fn RegEnumKeyExW(
        h_key: RegistryKeyHandle,
        dw_index: u32,
        lp_name: *mut u16,
        lpcch_name: *mut u32,
        lp_reserved: *mut u32,
        lp_class: *mut u16,
        lpcch_class: *mut u32,
        lpft_last_write_time: *mut std::ffi::c_void,
    ) -> i32;
    fn RegQueryValueExW(
        h_key: RegistryKeyHandle,
        lp_value_name: *const u16,
        lp_reserved: *mut u32,
        lp_type: *mut u32,
        lp_data: *mut u8,
        lpcb_data: *mut u32,
    ) -> i32;
    fn RegEnumValueW(
        h_key: RegistryKeyHandle,
        dw_index: u32,
        lp_value_name: *mut u16,
        lpcch_value_name: *mut u32,
        lp_reserved: *mut u32,
        lp_type: *mut u32,
        lp_data: *mut u8,
        lpcb_data: *mut u32,
    ) -> i32;
    fn RegCloseKey(h_key: RegistryKeyHandle) -> i32;
}

#[cfg(target_os = "windows")]
fn installed_app_registry_inventory() -> Vec<InstalledAppMetadata> {
    const UNINSTALL_KEY: &str = "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall";
    let roots = [
        (HKEY_LOCAL_MACHINE, KEY_READ | KEY_WOW64_64KEY),
        (HKEY_LOCAL_MACHINE, KEY_READ | KEY_WOW64_32KEY),
        (HKEY_CURRENT_USER, KEY_READ | KEY_WOW64_64KEY),
        (HKEY_CURRENT_USER, KEY_READ | KEY_WOW64_32KEY),
    ];
    let mut rows = Vec::new();

    for (root, access) in roots {
        rows.extend(read_uninstall_registry_view(root, UNINSTALL_KEY, access));
    }

    dedupe_installed_app_metadata(rows)
}

#[cfg(not(target_os = "windows"))]
fn installed_app_registry_inventory() -> Vec<InstalledAppMetadata> {
    Vec::new()
}

#[cfg(target_os = "windows")]
fn installed_app_usage_inventory() -> Vec<String> {
    const USER_ASSIST_KEY: &str =
        "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\UserAssist";
    let Some(base_key) = registry_open_key(HKEY_CURRENT_USER, USER_ASSIST_KEY, KEY_READ) else {
        return Vec::new();
    };
    let mut rows = Vec::new();
    let mut index = 0_u32;

    loop {
        let mut name = vec![0_u16; 512];
        let mut name_len = name.len() as u32;
        let result = unsafe {
            RegEnumKeyExW(
                base_key,
                index,
                name.as_mut_ptr(),
                &mut name_len,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
            )
        };
        if result == ERROR_NO_MORE_ITEMS {
            break;
        }
        index = index.saturating_add(1);
        if result != ERROR_SUCCESS {
            continue;
        }

        let guid = String::from_utf16_lossy(&name[..name_len as usize]);
        let count_key = format!("{guid}\\Count");
        if let Some(child_key) = registry_open_key(base_key, &count_key, KEY_READ) {
            rows.extend(read_userassist_value_names(child_key));
            unsafe {
                RegCloseKey(child_key);
            }
        }
    }

    unsafe {
        RegCloseKey(base_key);
    }
    dedupe_usage_inventory(rows)
}

#[cfg(not(target_os = "windows"))]
fn installed_app_usage_inventory() -> Vec<String> {
    Vec::new()
}

#[cfg(target_os = "windows")]
fn read_userassist_value_names(key: RegistryKeyHandle) -> Vec<String> {
    let mut rows = Vec::new();
    let mut index = 0_u32;

    loop {
        let mut name = vec![0_u16; 2048];
        let mut name_len = name.len() as u32;
        let result = unsafe {
            RegEnumValueW(
                key,
                index,
                name.as_mut_ptr(),
                &mut name_len,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
            )
        };
        if result == ERROR_NO_MORE_ITEMS {
            break;
        }
        index = index.saturating_add(1);
        if result != ERROR_SUCCESS || name_len == 0 {
            continue;
        }

        let encoded = String::from_utf16_lossy(&name[..name_len as usize]);
        let decoded = userassist_rot13_decode(&encoded);
        if !decoded.trim().is_empty() {
            rows.push(decoded);
        }
    }

    rows
}

fn userassist_rot13_decode(value: &str) -> String {
    value
        .chars()
        .map(|ch| match ch {
            'a'..='z' => ((((ch as u8 - b'a') + 13) % 26) + b'a') as char,
            'A'..='Z' => ((((ch as u8 - b'A') + 13) % 26) + b'A') as char,
            _ => ch,
        })
        .collect()
}

fn dedupe_usage_inventory(rows: Vec<String>) -> Vec<String> {
    let mut deduped = Vec::new();
    for row in rows {
        let normalized = normalize_usage_match_text(&row);
        if normalized.is_empty()
            || deduped
                .iter()
                .any(|existing: &String| normalize_usage_match_text(existing) == normalized)
        {
            continue;
        }
        deduped.push(row);
    }
    deduped
}

#[cfg(target_os = "windows")]
fn read_uninstall_registry_view(
    root: RegistryKeyHandle,
    subkey: &str,
    access: u32,
) -> Vec<InstalledAppMetadata> {
    let Some(base_key) = registry_open_key(root, subkey, access) else {
        return Vec::new();
    };
    let mut rows = Vec::new();
    let mut index = 0_u32;

    loop {
        let mut name = vec![0_u16; 512];
        let mut name_len = name.len() as u32;
        let result = unsafe {
            RegEnumKeyExW(
                base_key,
                index,
                name.as_mut_ptr(),
                &mut name_len,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
            )
        };
        if result == ERROR_NO_MORE_ITEMS {
            break;
        }
        index = index.saturating_add(1);
        if result != ERROR_SUCCESS {
            continue;
        }

        let child_name = String::from_utf16_lossy(&name[..name_len as usize]);
        if let Some(child_key) = registry_open_key(base_key, &child_name, KEY_READ) {
            if let Some(metadata) = read_installed_app_metadata(child_key) {
                rows.push(metadata);
            }
            unsafe {
                RegCloseKey(child_key);
            }
        }
    }

    unsafe {
        RegCloseKey(base_key);
    }
    rows
}

#[cfg(target_os = "windows")]
fn registry_open_key(
    root: RegistryKeyHandle,
    subkey: &str,
    access: u32,
) -> Option<RegistryKeyHandle> {
    let wide = wide_null(subkey);
    let mut handle = 0_isize;
    let result = unsafe { RegOpenKeyExW(root, wide.as_ptr(), 0, access, &mut handle) };
    if result == ERROR_SUCCESS && handle != 0 {
        Some(handle)
    } else {
        None
    }
}

#[cfg(target_os = "windows")]
fn read_installed_app_metadata(key: RegistryKeyHandle) -> Option<InstalledAppMetadata> {
    let display_name = registry_query_string(key, "DisplayName")?;
    if display_name.trim().is_empty() {
        return None;
    }
    if registry_query_dword(key, "SystemComponent").unwrap_or(0) == 1 {
        return None;
    }

    let estimated_kb = registry_query_dword(key, "EstimatedSize").unwrap_or(0);
    let uninstall_available = registry_query_string(key, "UninstallString")
        .or_else(|| registry_query_string(key, "QuietUninstallString"))
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);

    Some(InstalledAppMetadata {
        display_name,
        publisher: registry_query_string(key, "Publisher").unwrap_or_default(),
        display_version: registry_query_string(key, "DisplayVersion").unwrap_or_default(),
        install_location: registry_query_string(key, "InstallLocation").unwrap_or_default(),
        install_date: registry_query_string(key, "InstallDate").unwrap_or_default(),
        estimated_bytes: u64::from(estimated_kb).saturating_mul(1024),
        uninstall_available,
    })
}

#[cfg(target_os = "windows")]
fn registry_query_string(key: RegistryKeyHandle, name: &str) -> Option<String> {
    let wide_name = wide_null(name);
    let mut value_type = 0_u32;
    let mut byte_len = 0_u32;
    let result = unsafe {
        RegQueryValueExW(
            key,
            wide_name.as_ptr(),
            std::ptr::null_mut(),
            &mut value_type,
            std::ptr::null_mut(),
            &mut byte_len,
        )
    };
    if result != ERROR_SUCCESS
        || byte_len == 0
        || (value_type != REG_SZ && value_type != REG_EXPAND_SZ)
    {
        return None;
    }

    let mut bytes = vec![0_u8; byte_len as usize + 2];
    let result = unsafe {
        RegQueryValueExW(
            key,
            wide_name.as_ptr(),
            std::ptr::null_mut(),
            &mut value_type,
            bytes.as_mut_ptr(),
            &mut byte_len,
        )
    };
    if result != ERROR_SUCCESS || (value_type != REG_SZ && value_type != REG_EXPAND_SZ) {
        return None;
    }

    let u16_len = (byte_len as usize) / 2;
    let mut wide = Vec::with_capacity(u16_len);
    for chunk in bytes[..u16_len * 2].chunks_exact(2) {
        wide.push(u16::from_le_bytes([chunk[0], chunk[1]]));
    }
    while wide.last() == Some(&0) {
        wide.pop();
    }

    Some(String::from_utf16_lossy(&wide).trim().to_string())
}

#[cfg(target_os = "windows")]
fn registry_query_dword(key: RegistryKeyHandle, name: &str) -> Option<u32> {
    let wide_name = wide_null(name);
    let mut value_type = 0_u32;
    let mut byte_len = 4_u32;
    let mut bytes = [0_u8; 4];
    let result = unsafe {
        RegQueryValueExW(
            key,
            wide_name.as_ptr(),
            std::ptr::null_mut(),
            &mut value_type,
            bytes.as_mut_ptr(),
            &mut byte_len,
        )
    };
    if result != ERROR_SUCCESS || value_type != REG_DWORD || byte_len != 4 {
        return None;
    }
    Some(u32::from_le_bytes(bytes))
}

fn dedupe_installed_app_metadata(rows: Vec<InstalledAppMetadata>) -> Vec<InstalledAppMetadata> {
    let mut deduped = Vec::new();
    for row in rows {
        let key = format!(
            "{}|{}",
            row.display_name.to_ascii_lowercase(),
            normalize_registry_path_match(&row.install_location)
        );
        if deduped.iter().any(|existing: &InstalledAppMetadata| {
            format!(
                "{}|{}",
                existing.display_name.to_ascii_lowercase(),
                normalize_registry_path_match(&existing.install_location)
            ) == key
        }) {
            continue;
        }
        deduped.push(row);
    }
    deduped
}

fn hresult_succeeded(value: i32) -> bool {
    value >= 0
}

#[cfg(target_os = "windows")]
fn query_recycle_bin_drive_root(root: &str) -> Option<(u64, u64)> {
    let wide_root = wide_null(root);
    let mut info = ShQueryRecycleBinInfo {
        cb_size: std::mem::size_of::<ShQueryRecycleBinInfo>() as u32,
        i64_size: 0,
        i64_num_items: 0,
    };
    let hresult = unsafe { SHQueryRecycleBinW(wide_root.as_ptr(), &mut info) };
    if !hresult_succeeded(hresult) {
        return None;
    }
    Some((
        u64::try_from(info.i64_size.max(0)).unwrap_or(0),
        u64::try_from(info.i64_num_items.max(0)).unwrap_or(0),
    ))
}

#[cfg(not(target_os = "windows"))]
fn query_recycle_bin_drive_root(_root: &str) -> Option<(u64, u64)> {
    None
}

#[cfg(target_os = "windows")]
#[link(name = "kernel32")]
extern "system" {
    fn GetDiskFreeSpaceExW(
        lp_directory_name: *const u16,
        lp_free_bytes_available_to_caller: *mut u64,
        lp_total_number_of_bytes: *mut u64,
        lp_total_number_of_free_bytes: *mut u64,
    ) -> i32;
}

fn resolve_target_drive(request: &ScanRequest, warnings: &mut Vec<String>) -> String {
    if let Some(target_drive) = request
        .target_drive
        .as_deref()
        .and_then(normalize_drive_value)
    {
        return target_drive;
    }

    if request
        .target_drive
        .as_deref()
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
    {
        warnings.push("Invalid target drive ignored; using the system drive.".to_string());
    }

    system_drive_fallback()
}

fn system_drive_fallback() -> String {
    env::var("SystemDrive")
        .ok()
        .and_then(|value| normalize_drive_value(&value))
        .unwrap_or_else(|| "C:".to_string())
}

fn normalize_drive_value(value: &str) -> Option<String> {
    let trimmed = value.trim().trim_end_matches('\\');
    let mut chars = trimmed.chars();
    let letter = chars.next()?;
    if !letter.is_ascii_alphabetic() {
        return None;
    }
    let rest = chars.collect::<String>();
    if !rest.is_empty() && rest != ":" {
        return None;
    }
    Some(format!("{}:", letter.to_ascii_uppercase()))
}

fn target_drive_path(target_drive: &str, suffix: &str) -> PathBuf {
    let drive = normalize_drive_value(target_drive).unwrap_or_else(system_drive_fallback);
    let suffix = suffix.trim_start_matches('\\');
    PathBuf::from(format!("{drive}\\{suffix}"))
}

#[cfg(target_os = "windows")]
fn primary_volume_info(target_drive: &str) -> Option<VolumeInfo> {
    let drive = normalize_drive_value(target_drive).unwrap_or_else(system_drive_fallback);
    let root = if drive.ends_with('\\') {
        drive.clone()
    } else {
        format!("{drive}\\")
    };
    let wide_root = OsStr::new(&root)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let mut available_bytes = 0_u64;
    let mut total_bytes = 0_u64;
    let mut free_bytes = 0_u64;

    let ok = unsafe {
        GetDiskFreeSpaceExW(
            wide_root.as_ptr(),
            &mut available_bytes,
            &mut total_bytes,
            &mut free_bytes,
        )
    };

    if ok == 0 || total_bytes == 0 {
        return None;
    }

    Some(VolumeInfo {
        drive,
        total_bytes,
        used_bytes: total_bytes.saturating_sub(free_bytes),
        free_bytes,
        source: "GetDiskFreeSpaceExW",
    })
}

#[cfg(not(target_os = "windows"))]
fn primary_volume_info(_target_drive: &str) -> Option<VolumeInfo> {
    None
}

fn exact_specs(target_drive: &str) -> Vec<ExactSpec> {
    let mut specs = Vec::new();
    let user_profile = env_path("USERPROFILE").or_else(|| env_path("HOME"));
    let local_app_data = env_path("LOCALAPPDATA").or_else(|| {
        user_profile
            .as_ref()
            .map(|path| path.join("AppData").join("Local"))
    });

    if let Some(temp) = env_path("TEMP").or_else(|| env_path("TMP")) {
        specs.push(ExactSpec {
            recipe_id: "windows-temp",
            title: "Windows temporary files",
            path: temp,
            kind: MeasureKind::FullTree,
        });
    }

    if cfg!(target_os = "windows") {
        for (recipe_id, title, path) in [
            (
                "windows-temp",
                "Windows temporary files",
                target_drive_path(target_drive, "Windows\\Temp"),
            ),
            (
                "recycle-bin",
                "Recycle Bin",
                target_drive_path(target_drive, "$Recycle.Bin"),
            ),
            (
                "windows-old",
                "Previous Windows installation",
                target_drive_path(target_drive, "Windows.old"),
            ),
            (
                "hibernation",
                "Disable hibernation file",
                target_drive_path(target_drive, "hiberfil.sys"),
            ),
            (
                "pagefile",
                "Pagefile size changes",
                target_drive_path(target_drive, "pagefile.sys"),
            ),
        ] {
            specs.push(ExactSpec {
                recipe_id,
                title,
                path,
                kind: MeasureKind::FullTree,
            });
        }
    }

    if let Some(profile) = &user_profile {
        specs.push(ExactSpec {
            recipe_id: "gradle-cache",
            title: "Gradle dependency and build cache",
            path: profile.join(".gradle").join("caches"),
            kind: MeasureKind::FullTree,
        });
        specs.push(ExactSpec {
            recipe_id: "user-cache",
            title: "User .cache folder",
            path: profile.join(".cache"),
            kind: MeasureKind::FullTree,
        });
        specs.push(ExactSpec {
            recipe_id: "android-cache",
            title: "Android .android build cache",
            path: profile.join(".android").join("build-cache"),
            kind: MeasureKind::FullTree,
        });
        specs.push(ExactSpec {
            recipe_id: "downloads-installers",
            title: "Old installers and archives in Downloads",
            path: profile.join("Downloads"),
            kind: MeasureKind::DownloadInstallers,
        });
        specs.push(ExactSpec {
            recipe_id: "large-user-files",
            title: "Large personal files",
            path: profile.to_path_buf(),
            kind: MeasureKind::LargeUserFiles,
        });
        specs.push(ExactSpec {
            recipe_id: "android-studio",
            title: "Android Studio emulator images and caches",
            path: profile.join(".android"),
            kind: MeasureKind::FullTree,
        });
    }

    if let Some(local) = &local_app_data {
        specs.push(ExactSpec {
            recipe_id: "npm-cache",
            title: "npm package cache",
            path: local.join("npm-cache").join("_cacache"),
            kind: MeasureKind::FullTree,
        });
        specs.push(ExactSpec {
            recipe_id: "pnpm-store",
            title: "pnpm global store",
            path: local.join("pnpm").join("store"),
            kind: MeasureKind::FullTree,
        });
    }

    specs
}

fn measure_drive_inventory(
    target_drive: &str,
    request: &ScanRequest,
    warnings: &mut Vec<String>,
) -> Vec<DriveInventoryEntry> {
    let root = target_drive_path(target_drive, "");
    let Ok(entries) = fs::read_dir(&root) else {
        warnings.push(format!(
            "Drive inventory unavailable for {}.",
            path_to_string(&root)
        ));
        return Vec::new();
    };

    let mut rows = Vec::new();
    let inventory_request = drive_inventory_request(request);

    for entry in entries.flatten() {
        if rows.len() >= 32 {
            warnings.push("Drive inventory is capped at 32 top-level entries.".to_string());
            break;
        }

        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.trim().is_empty() {
            continue;
        }

        rows.push(measure_drive_inventory_entry(
            &name,
            &path,
            &inventory_request,
        ));
    }

    rows.sort_by(|a, b| b.bytes.cmp(&a.bytes).then(a.name.cmp(&b.name)));
    rows
}

fn drive_inventory_request(request: &ScanRequest) -> ScanRequest {
    ScanRequest {
        protected_paths: request.protected_paths.clone(),
        include_project_artifacts: request.include_project_artifacts,
        max_depth: Some(request.max_depth.unwrap_or(8).min(3)),
        max_entries_per_root: Some(request.max_entries_per_root.unwrap_or(25_000).min(5_000)),
        target_drive: request.target_drive.clone(),
        custom_roots: Vec::new(),
    }
}

fn measure_drive_inventory_entry(
    name: &str,
    path: &Path,
    request: &ScanRequest,
) -> DriveInventoryEntry {
    let mut row = DriveInventoryEntry {
        id: stable_item_id("drive-inventory", path),
        name: name.to_string(),
        path: path_to_string(path),
        bytes: 0,
        status: "missing".to_string(),
        files: 0,
        dirs: 0,
        errors: 0,
        kind: "unknown".to_string(),
        classification: drive_inventory_classification(name).to_string(),
        can_create_executor: false,
        note: "Top-level drive inventory is read-only context and never creates executor routes."
            .to_string(),
    };

    if is_path_protected(path, &request.protected_paths) {
        row.status = "protected".to_string();
        row.note = "Skipped because the path is user-protected.".to_string();
        return row;
    }

    let Ok(metadata) = fs::symlink_metadata(path) else {
        row.status = "limited".to_string();
        row.errors = 1;
        row.note = "Top-level entry could not be opened for read-only inventory.".to_string();
        return row;
    };

    if metadata.file_type().is_symlink() {
        row.status = "limited".to_string();
        row.note = "Skipped symbolic link or reparse point in drive inventory.".to_string();
        return row;
    }

    if metadata.is_file() {
        row.bytes = metadata.len();
        row.files = 1;
        row.kind = "file".to_string();
        row.status = "measured".to_string();
        return row;
    }

    if metadata.is_dir() {
        let stats = walk_dir_size(path, MeasureKind::FullTree, request);
        row.bytes = stats.bytes;
        row.files = stats.files;
        row.dirs = stats.dirs;
        row.errors = stats.errors;
        row.kind = "directory".to_string();
        row.status = if stats.limited { "limited" } else { "measured" }.to_string();
        row.note = if stats.limited {
            "Measured with drive-inventory depth and entry caps. Add as a custom root for manual detail; no executor route is created."
                .to_string()
        } else {
            "Measured from filesystem metadata only. This row is context, not cleanup authority."
                .to_string()
        };
        return row;
    }

    row.status = "limited".to_string();
    row.note = "Unsupported top-level filesystem entry type.".to_string();
    row
}

fn drive_inventory_classification(name: &str) -> &'static str {
    let lower = name.to_ascii_lowercase();
    if matches!(
        lower.as_str(),
        "windows"
            | "program files"
            | "program files (x86)"
            | "programdata"
            | "recovery"
            | "system volume information"
            | "$recycle.bin"
    ) || lower.starts_with('$')
    {
        return "system-or-protected";
    }
    if matches!(lower.as_str(), "users" | "documents and settings") {
        return "user-data-review";
    }
    if matches!(
        lower.as_str(),
        "hiberfil.sys" | "pagefile.sys" | "swapfile.sys"
    ) {
        return "advanced-system";
    }
    "unknown-review"
}

fn measure_custom_roots(request: &ScanRequest, warnings: &mut Vec<String>) -> Vec<ScanFinding> {
    let mut findings = Vec::new();
    let mut seen = Vec::new();

    for raw_root in request.custom_roots.iter() {
        let clean = raw_root.trim();
        if clean.is_empty() {
            continue;
        }

        let normalized = normalize_path(clean);
        if seen.iter().any(|item: &String| item == &normalized) {
            warnings.push(format!("Duplicate custom root ignored: {clean}"));
            continue;
        }
        if findings.len() >= 8 {
            warnings.push("Custom root scan is capped at 8 roots per run.".to_string());
            break;
        }
        seen.push(normalized);

        let path = PathBuf::from(clean);
        let title = path
            .file_name()
            .and_then(|name| name.to_str())
            .filter(|name| !name.trim().is_empty())
            .map(|name| format!("Custom folder: {name}"))
            .unwrap_or_else(|| "Custom folder".to_string());
        let recipe_id = format!("custom-root-{}", findings.len() + 1);
        let mut finding = measure_path(&recipe_id, &title, &path, MeasureKind::FullTree, request);
        finding.note = format!(
            "{} Advisory read-only custom root measurement; no executor route is created.",
            finding.note
        );
        findings.push(finding);
    }

    findings
}

fn measure_android_studio_roots(request: &ScanRequest) -> Vec<ScanFinding> {
    let Some(local) = env_path("LOCALAPPDATA") else {
        return Vec::new();
    };

    let google_dir = local.join("Google");
    let mut findings = Vec::new();

    if let Ok(entries) = fs::read_dir(&google_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("AndroidStudio") {
                findings.push(measure_path(
                    "android-studio",
                    "Android Studio emulator images and caches",
                    &path,
                    MeasureKind::FullTree,
                    request,
                ));
                for cache_path in [path.join("caches"), path.join("system").join("caches")] {
                    if cache_path.exists() {
                        findings.push(measure_path(
                            "android-cache",
                            "Android Studio cache folders",
                            &cache_path,
                            MeasureKind::FullTree,
                            request,
                        ));
                    }
                }
            }
        }
    }

    findings
}

fn measure_shader_cache_roots(request: &ScanRequest) -> Vec<ScanFinding> {
    let Some(local) = env_path("LOCALAPPDATA").or_else(|| {
        env_path("USERPROFILE")
            .or_else(|| env_path("HOME"))
            .map(|profile| profile.join("AppData").join("Local"))
    }) else {
        return vec![missing_finding(
            "steam-shader-cache",
            "Graphics shader caches",
            "Graphics driver shader cache directories",
            "LOCALAPPDATA was not available.",
        )];
    };

    let findings = known_shader_cache_roots(&local)
        .into_iter()
        .filter(|(_, path)| path.exists())
        .map(|(title, path)| {
            measure_path(
                "steam-shader-cache",
                title,
                &path,
                MeasureKind::FullTree,
                request,
            )
        })
        .collect::<Vec<_>>();

    if findings.is_empty() {
        return vec![missing_finding(
            "steam-shader-cache",
            "Graphics shader caches",
            "Graphics driver shader cache directories",
            "No supported shader cache roots were found.",
        )];
    }

    findings
}

fn measure_pip_cache_roots(request: &ScanRequest) -> Vec<ScanFinding> {
    let Some(local) = env_path("LOCALAPPDATA").or_else(|| {
        env_path("USERPROFILE")
            .or_else(|| env_path("HOME"))
            .map(|profile| profile.join("AppData").join("Local"))
    }) else {
        return vec![missing_finding(
            "pip-cache",
            "pip package cache",
            "Python pip cache directory",
            "LOCALAPPDATA was not available.",
        )];
    };

    let path = local.join("pip").join("Cache");
    if !path.exists() {
        return vec![missing_finding(
            "pip-cache",
            "pip package cache",
            "Python pip cache directory",
            "No supported pip cache root was found.",
        )];
    }

    vec![measure_path(
        "pip-cache",
        "pip package cache",
        &path,
        MeasureKind::FullTree,
        request,
    )]
}

fn measure_docker_build_cache() -> ScanFinding {
    if !cfg!(target_os = "windows") {
        return unsupported_finding(
            "docker-build-cache",
            "Docker build cache",
            "Docker Desktop build cache",
            "Docker build-cache inventory is Windows-only in this build.",
        );
    }

    let result = run_docker_command(&["system", "df", "-v"], 12);
    if result.timed_out {
        return ScanFinding {
            recipe_id: "docker-build-cache".to_string(),
            title: "Docker build cache".to_string(),
            path: "Docker Desktop build cache".to_string(),
            bytes: 0,
            status: "limited".to_string(),
            files: 0,
            dirs: 0,
            errors: 1,
            note: "Docker CLI inventory timed out; no cleanup target was created.".to_string(),
            metadata_sources: None,
            evidence_summary: None,
            items: Vec::new(),
        };
    }
    if !result.error.is_empty() {
        return missing_finding(
            "docker-build-cache",
            "Docker build cache",
            "Docker Desktop build cache",
            "Docker CLI was not available; install or start Docker Desktop before inventory.",
        );
    }
    if !result.ok {
        return ScanFinding {
            recipe_id: "docker-build-cache".to_string(),
            title: "Docker build cache".to_string(),
            path: "Docker Desktop build cache".to_string(),
            bytes: 0,
            status: "limited".to_string(),
            files: 0,
            dirs: 0,
            errors: 1,
            note: format!(
                "Docker CLI inventory failed; no cleanup target was created. {}",
                result.summary()
            ),
            metadata_sources: None,
            evidence_summary: None,
            items: Vec::new(),
        };
    }

    let bytes = docker_build_cache_inventory_bytes(&result.stdout).unwrap_or(0);
    ScanFinding {
        recipe_id: "docker-build-cache".to_string(),
        title: "Docker build cache".to_string(),
        path: "Docker Desktop build cache".to_string(),
        bytes,
        status: "measured".to_string(),
        files: 0,
        dirs: 0,
        errors: 0,
        note: "Measured with `docker system df -v`; only build cache can be passed to the tool-native prune executor. Volumes, containers, images, and Docker data folders are not cleanup targets.".to_string(),
        metadata_sources: None,
        evidence_summary: None,
        items: Vec::new(),
    }
}

fn measure_browser_cache_roots(request: &ScanRequest) -> Vec<ScanFinding> {
    let Some(local) = env_path("LOCALAPPDATA") else {
        return vec![missing_finding(
            "browser-cache",
            "Browser cache only",
            "Browser cache directories",
            "LOCALAPPDATA was not available.",
        )];
    };

    let mut findings = Vec::new();
    findings.extend(measure_chromium_cache_roots(
        &local.join("Google").join("Chrome").join("User Data"),
        "browser-cache",
        "Browser cache only",
        request,
    ));
    findings.extend(measure_chromium_cache_roots(
        &local.join("Microsoft").join("Edge").join("User Data"),
        "browser-cache",
        "Browser cache only",
        request,
    ));

    let firefox_profiles = local.join("Mozilla").join("Firefox").join("Profiles");
    if let Ok(entries) = fs::read_dir(&firefox_profiles) {
        for entry in entries.flatten() {
            let cache = entry.path().join("cache2");
            findings.push(measure_path(
                "browser-cache",
                "Browser cache only",
                &cache,
                MeasureKind::FullTree,
                request,
            ));
        }
    }

    if findings.is_empty() {
        findings.push(missing_finding(
            "browser-cache",
            "Browser cache only",
            "Browser cache directories",
            "No supported browser cache roots were found.",
        ));
    }

    findings
}

fn measure_wsl_vhdx_roots(request: &ScanRequest) -> Vec<ScanFinding> {
    let Some(local) = env_path("LOCALAPPDATA") else {
        return vec![missing_finding(
            "wsl-vhdx",
            "WSL virtual disk compaction",
            "%LocalAppData%\\Packages\\*\\LocalState\\ext4.vhdx",
            "LOCALAPPDATA was not available.",
        )];
    };

    let packages = local.join("Packages");
    let mut findings = Vec::new();

    if let Ok(entries) = fs::read_dir(&packages) {
        for entry in entries.flatten() {
            let path = entry.path().join("LocalState").join("ext4.vhdx");
            if path.exists() {
                findings.push(measure_path(
                    "wsl-vhdx",
                    "WSL virtual disk compaction",
                    &path,
                    MeasureKind::FullTree,
                    request,
                ));
            }
        }
    }

    if findings.is_empty() {
        findings.push(missing_finding(
            "wsl-vhdx",
            "WSL virtual disk compaction",
            "%LocalAppData%\\Packages\\*\\LocalState\\ext4.vhdx",
            "No WSL ext4.vhdx files were found.",
        ));
    }

    findings
}

fn measure_installed_app_footprints(
    target_drive: &str,
    request: &ScanRequest,
    warnings: &mut Vec<String>,
) -> ScanFinding {
    let mut roots = vec![
        target_drive_path(target_drive, "Program Files"),
        target_drive_path(target_drive, "Program Files (x86)"),
        target_drive_path(target_drive, "ProgramData"),
    ];
    if let Some(local) = env_path("LOCALAPPDATA") {
        roots.push(local.join("Programs"));
    }

    let mut seen_roots = Vec::new();
    let mut items = Vec::new();
    let mut files = 0_u64;
    let mut dirs = 0_u64;
    let mut errors = 0_u64;
    let mut limited = false;
    let registry_inventory = installed_app_registry_inventory();
    let usage_inventory = installed_app_usage_inventory();

    for root in roots {
        let normalized = normalize_path(&path_to_string(&root));
        if seen_roots.iter().any(|item: &String| item == &normalized) {
            continue;
        }
        seen_roots.push(normalized);

        let Ok(entries) = fs::read_dir(&root) else {
            errors = errors.saturating_add(1);
            continue;
        };

        for entry in entries.flatten() {
            if items.len() >= 24 {
                limited = true;
                warnings.push(
                    "Installed app footprint discovery is capped at 24 top-level candidates."
                        .to_string(),
                );
                break;
            }

            let path = entry.path();
            if is_path_protected(&path, &request.protected_paths) {
                continue;
            }

            let Ok(metadata) = fs::symlink_metadata(&path) else {
                errors = errors.saturating_add(1);
                continue;
            };
            if metadata.file_type().is_symlink() || !metadata.is_dir() {
                continue;
            }

            let app_request = installed_app_measure_request(request);
            let stats = walk_dir_size(&path, MeasureKind::InstalledAppFootprints, &app_request);
            files = files.saturating_add(stats.files);
            dirs = dirs.saturating_add(stats.dirs);
            errors = errors.saturating_add(stats.errors);
            limited = limited || stats.limited;
            if stats.bytes > 0 {
                items.push(installed_app_scan_item(
                    &path,
                    stats.bytes,
                    &registry_inventory,
                    &usage_inventory,
                ));
            }
        }
    }

    items.sort_by(|left, right| right.bytes.cmp(&left.bytes));
    items.truncate(16);
    let bytes = items
        .iter()
        .fold(0_u64, |sum, item| sum.saturating_add(item.bytes));

    if items.is_empty() {
        return missing_finding(
            "installed-app-footprints",
            "Installed app footprints",
            "Program Files, ProgramData, LocalAppData\\Programs",
            "No readable installed-app footprint candidates were found within the configured search budget.",
        );
    }

    ScanFinding {
        recipe_id: "installed-app-footprints".to_string(),
        title: "Installed app footprints".to_string(),
        path: "Program Files, ProgramData, LocalAppData\\Programs".to_string(),
        bytes,
        status: if limited { "limited" } else { "measured" }.to_string(),
        files,
        dirs,
        errors,
        note: if limited {
            "Read-only installed app footprint discovery with depth, entry, and candidate caps. Windows uninstall metadata may enrich candidates, but modification age is still not proof of app usage."
                .to_string()
        } else {
            "Read-only installed app footprint discovery. Windows uninstall metadata may enrich candidates, but uninstall decisions stay manual."
                .to_string()
        },
        metadata_sources: Some(installed_app_metadata_sources(
            registry_inventory.len(),
            usage_inventory.len(),
        )),
        evidence_summary: Some(installed_app_evidence_summary(&items)),
        items,
    }
}

fn installed_app_measure_request(request: &ScanRequest) -> ScanRequest {
    ScanRequest {
        protected_paths: request.protected_paths.clone(),
        include_project_artifacts: false,
        max_depth: Some(request.max_depth.unwrap_or(8).min(5)),
        max_entries_per_root: Some(request.max_entries_per_root.unwrap_or(25_000).min(8_000)),
        target_drive: request.target_drive.clone(),
        custom_roots: Vec::new(),
    }
}

fn installed_app_scan_item(
    path: &Path,
    bytes: u64,
    registry_inventory: &[InstalledAppMetadata],
    usage_inventory: &[String],
) -> ScanItem {
    let age_days = path_age_days(path).unwrap_or(0);
    let folder_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("installed app");
    let metadata = find_installed_app_metadata(path, folder_name, registry_inventory);
    let name = metadata
        .as_ref()
        .map(|item| item.display_name.as_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(folder_name);
    let usage_evidence =
        find_installed_app_usage_evidence(path, folder_name, name, usage_inventory);
    let recommendation =
        if bytes >= 1024 * 1024 * 1024 && age_days >= 45 && usage_evidence.is_none() {
            "review"
        } else {
            "keep"
        };
    let kind = installed_app_kind(folder_name, path);
    let reason = installed_app_review_reason(
        path,
        bytes,
        age_days,
        recommendation,
        metadata.as_ref(),
        usage_evidence.as_ref(),
    );
    let signals = installed_app_review_signals(
        bytes,
        age_days,
        recommendation,
        kind,
        metadata.as_ref(),
        usage_evidence.as_ref(),
    );

    ScanItem {
        id: stable_item_id("installed-app-footprints", path),
        name: name.to_string(),
        path: path_to_string(path),
        bytes,
        age_days,
        kind: kind.to_string(),
        recommendation: recommendation.to_string(),
        reason,
        signals,
    }
}

fn installed_app_review_signals(
    bytes: u64,
    age_days: u64,
    recommendation: &str,
    kind: &str,
    metadata: Option<&InstalledAppMetadata>,
    usage_evidence: Option<&InstalledAppUsageEvidence>,
) -> Vec<ScanSignal> {
    let mut signals = vec![
        review_signal(
            "candidate",
            if recommendation == "review" {
                "large old footprint without launch evidence"
            } else {
                "weak unused-app signal"
            },
            if recommendation == "review" {
                "review"
            } else {
                "safe"
            },
        ),
        review_signal(
            "usage proof",
            usage_evidence
                .map(|evidence| evidence.source)
                .unwrap_or("not proven"),
            if usage_evidence.is_some() {
                "safe"
            } else {
                "restricted"
            },
        ),
        review_signal("kind", kind, "review"),
        review_signal(
            "modified age",
            format!("{age_days}d"),
            age_signal_tone(age_days, 45),
        ),
        review_signal(
            "measured size",
            format!("{bytes} bytes"),
            size_signal_tone(bytes),
        ),
        review_signal(
            "official action",
            "Windows Settings or vendor uninstaller",
            "restricted",
        ),
    ];

    if let Some(evidence) = usage_evidence {
        signals.push(review_signal(
            "usage match",
            evidence.match_label.as_str(),
            "safe",
        ));
    } else {
        signals.push(review_signal(
            "usage evidence",
            "no UserAssist match",
            "review",
        ));
    }

    if let Some(metadata) = metadata {
        signals.push(review_signal(
            "registry match",
            "Windows uninstall metadata",
            "safe",
        ));
        if !metadata.publisher.trim().is_empty() {
            signals.push(review_signal(
                "publisher",
                metadata.publisher.as_str(),
                "review",
            ));
        }
        if !metadata.display_version.trim().is_empty() {
            signals.push(review_signal(
                "version",
                metadata.display_version.as_str(),
                "review",
            ));
        }
        if !metadata.install_date.trim().is_empty() {
            signals.push(review_signal(
                "install date",
                metadata.install_date.as_str(),
                "review",
            ));
        }
        if metadata.estimated_bytes > 0 {
            signals.push(review_signal(
                "Windows estimate",
                format!("{} bytes", metadata.estimated_bytes),
                "review",
            ));
        }
        signals.push(review_signal(
            "uninstall entry",
            if metadata.uninstall_available {
                "present"
            } else {
                "missing"
            },
            if metadata.uninstall_available {
                "safe"
            } else {
                "review"
            },
        ));
    } else {
        signals.push(review_signal("registry match", "none", "review"));
    }

    signals
}

fn installed_app_metadata_sources(
    uninstall_registry_rows: usize,
    user_assist_rows: usize,
) -> ScanFindingMetadataSources {
    ScanFindingMetadataSources {
        uninstall_registry: if cfg!(target_os = "windows") {
            "scanned"
        } else {
            "unavailable"
        }
        .to_string(),
        user_assist: if cfg!(target_os = "windows") {
            "scanned"
        } else {
            "unavailable"
        }
        .to_string(),
        uninstall_registry_rows: uninstall_registry_rows as u64,
        user_assist_rows: user_assist_rows as u64,
    }
}

fn installed_app_evidence_summary(items: &[ScanItem]) -> ScanFindingEvidenceSummary {
    ScanFindingEvidenceSummary {
        candidate_count: items.len() as u64,
        registry_matched: items
            .iter()
            .filter(|item| {
                scan_item_signal_value(item, "registry match") == Some("Windows uninstall metadata")
            })
            .count() as u64,
        user_assist_matched: items
            .iter()
            .filter(|item| {
                scan_item_signal_value(item, "usage proof")
                    .map(|value| value.contains("UserAssist"))
                    .unwrap_or(false)
            })
            .count() as u64,
        usage_proof_missing: items
            .iter()
            .filter(|item| scan_item_signal_value(item, "usage proof") == Some("not proven"))
            .count() as u64,
        manual_only: true,
        can_create_executor: false,
    }
}

fn scan_item_signal_value<'a>(item: &'a ScanItem, label: &str) -> Option<&'a str> {
    item.signals
        .iter()
        .find(|signal| signal.label.eq_ignore_ascii_case(label))
        .map(|signal| signal.value.as_str())
}

fn installed_app_review_reason(
    path: &Path,
    bytes: u64,
    age_days: u64,
    recommendation: &str,
    metadata: Option<&InstalledAppMetadata>,
    usage_evidence: Option<&InstalledAppUsageEvidence>,
) -> String {
    let mut details = Vec::new();
    if recommendation == "review" {
        details.push(format!(
            "Large app footprint last modified about {age_days} day(s) ago with no matching UserAssist launch evidence."
        ));
    } else {
        details.push("Recent, small, or ambiguous app footprint.".to_string());
    }

    if let Some(evidence) = usage_evidence {
        details.push(format!(
            "Read-only app usage evidence found via {} matching {}.",
            evidence.source, evidence.match_label
        ));
    } else {
        details.push("No matching UserAssist launch-history evidence was found.".to_string());
    }

    if let Some(metadata) = metadata {
        if !metadata.publisher.is_empty() {
            details.push(format!("publisher={}", metadata.publisher));
        }
        if !metadata.display_version.is_empty() {
            details.push(format!("version={}", metadata.display_version));
        }
        if !metadata.install_date.is_empty() {
            details.push(format!("installDate={}", metadata.install_date));
        }
        if metadata.estimated_bytes > 0 {
            details.push(format!(
                "windowsEstimatedSize={} bytes",
                metadata.estimated_bytes
            ));
        }
        if metadata.uninstall_available {
            details.push("Windows uninstall entry is present.".to_string());
        }
    } else {
        details.push("No matching Windows uninstall metadata was found.".to_string());
    }

    details.push(format!(
        "Measured folder bytes={} at {}.",
        bytes,
        path_to_string(path)
    ));
    details.push(
        "Treat this as an uninstall review hint only; use Windows Settings or the vendor uninstaller. SpaceGuard must not delete Program Files folders or run uninstall commands."
            .to_string(),
    );
    details.join(" ")
}

fn find_installed_app_metadata(
    path: &Path,
    folder_name: &str,
    registry_inventory: &[InstalledAppMetadata],
) -> Option<InstalledAppMetadata> {
    let path_text = path_to_string(path);
    let path_key = normalize_registry_path_match(&path_text);
    let folder_key = folder_name.to_ascii_lowercase();

    registry_inventory
        .iter()
        .find(|metadata| {
            let install_location = normalize_registry_path_match(&metadata.install_location);
            !install_location.is_empty()
                && (path_key == install_location
                    || path_key.starts_with(&format!("{install_location}\\"))
                    || install_location.starts_with(&format!("{path_key}\\")))
        })
        .or_else(|| {
            registry_inventory.iter().find(|metadata| {
                let display_name = metadata.display_name.to_ascii_lowercase();
                !folder_key.is_empty()
                    && !display_name.is_empty()
                    && (display_name == folder_key
                        || display_name.contains(&folder_key)
                        || folder_key.contains(&display_name))
            })
        })
        .cloned()
}

fn find_installed_app_usage_evidence(
    path: &Path,
    folder_name: &str,
    display_name: &str,
    usage_inventory: &[String],
) -> Option<InstalledAppUsageEvidence> {
    let folder_key = normalize_usage_match_text(folder_name);
    let display_key = normalize_usage_match_text(display_name);
    let basename_key = path
        .file_stem()
        .and_then(|name| name.to_str())
        .map(normalize_usage_match_text)
        .unwrap_or_default();
    let candidates = [folder_key, display_key, basename_key]
        .into_iter()
        .filter(|candidate| candidate.len() >= 4)
        .collect::<Vec<_>>();
    if candidates.is_empty() {
        return None;
    }

    for row in usage_inventory {
        let normalized = normalize_usage_match_text(row);
        if normalized.is_empty() {
            continue;
        }
        if let Some(candidate) = candidates.iter().find(|candidate| {
            let candidate = candidate.as_str();
            normalized == candidate
                || normalized.contains(&format!("\\{candidate}\\"))
                || normalized.contains(&format!("\\{candidate}."))
                || normalized.contains(&format!("/{candidate}/"))
                || normalized.contains(&format!("/{candidate}."))
                || normalized.contains(candidate)
        }) {
            return Some(InstalledAppUsageEvidence {
                source: "UserAssist launch evidence",
                match_label: format!("name match: {candidate}"),
            });
        }
    }

    None
}

fn normalize_registry_path_match(value: &str) -> String {
    value
        .trim()
        .trim_matches('"')
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_ascii_lowercase()
}

fn normalize_usage_match_text(value: &str) -> String {
    value
        .trim()
        .trim_matches('"')
        .replace('/', "\\")
        .to_ascii_lowercase()
}

fn installed_app_kind(name: &str, path: &Path) -> &'static str {
    let lower = name.to_ascii_lowercase();
    let parent = path
        .parent()
        .and_then(|parent| parent.file_name())
        .and_then(|name| name.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if lower.contains("steam")
        || lower.contains("epic")
        || lower.contains("riot")
        || lower.contains("ubisoft")
        || lower.contains("xbox")
    {
        return "game or launcher footprint";
    }
    if lower.contains("android")
        || lower.contains("visual studio")
        || lower.contains("jetbrains")
        || lower.contains("unity")
        || lower.contains("nodejs")
        || lower.contains("docker")
    {
        return "developer tool footprint";
    }
    if parent == "programdata" {
        return "shared app data footprint";
    }
    "installed app footprint"
}

fn measure_chromium_cache_roots(
    user_data_root: &Path,
    recipe_id: &'static str,
    title: &'static str,
    request: &ScanRequest,
) -> Vec<ScanFinding> {
    let mut findings = Vec::new();

    if let Ok(entries) = fs::read_dir(user_data_root) {
        for entry in entries.flatten() {
            let profile_path = entry.path();
            let cache = profile_path.join("Cache");
            let cache_data = cache.join("Cache_Data");
            if cache_data.exists() {
                findings.push(measure_path(
                    recipe_id,
                    title,
                    &cache_data,
                    MeasureKind::FullTree,
                    request,
                ));
            } else if cache.exists() {
                findings.push(measure_path(
                    recipe_id,
                    title,
                    &cache,
                    MeasureKind::FullTree,
                    request,
                ));
            }
        }
    }

    findings
}

fn measure_node_modules_roots(
    request: &ScanRequest,
    warnings: &mut Vec<String>,
) -> Vec<ScanFinding> {
    let Some(profile) = env_path("USERPROFILE").or_else(|| env_path("HOME")) else {
        return Vec::new();
    };

    let candidates = [
        "Code",
        "source",
        "Documents",
        "dev",
        "Developer",
        "Development",
        "Projects",
        "repos",
        "workspace",
        "workspaces",
    ]
    .iter()
    .map(|name| profile.join(name))
    .filter(|path| path.exists())
    .collect::<Vec<_>>();

    let mut roots = Vec::new();
    let mut limited = false;

    for candidate in candidates {
        let found = find_named_dirs(&candidate, "node_modules", request);
        limited = limited || found.1;
        roots.extend(found.0);
    }

    if limited {
        warnings.push("Project artifact discovery hit the configured entry limit.".to_string());
    }

    let findings = roots
        .into_iter()
        .map(|path| {
            measure_path(
                "node-modules-old",
                "Old project node_modules folders",
                &path,
                MeasureKind::FullTree,
                request,
            )
        })
        .collect::<Vec<_>>();

    if findings.is_empty() {
        return vec![missing_finding(
            "node-modules-old",
            "Old project node_modules folders",
            "Common project roots",
            "No node_modules directories were found within the configured search budget.",
        )];
    }

    findings
}

fn find_named_dirs(root: &Path, target_name: &str, request: &ScanRequest) -> (Vec<PathBuf>, bool) {
    let max_depth = request.max_depth.unwrap_or(8);
    let max_entries = request.max_entries_per_root.unwrap_or(25_000);
    let mut queue = VecDeque::from([(root.to_path_buf(), 0usize)]);
    let mut found = Vec::new();
    let mut visited = 0usize;
    let mut limited = false;

    while let Some((path, depth)) = queue.pop_front() {
        if visited >= max_entries {
            limited = true;
            break;
        }
        visited += 1;

        if depth > max_depth || is_path_protected(&path, &request.protected_paths) {
            continue;
        }

        let Ok(entries) = fs::read_dir(&path) else {
            continue;
        };

        for entry in entries.flatten() {
            if visited >= max_entries {
                limited = true;
                break;
            }

            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if !file_type.is_dir() || file_type.is_symlink() {
                continue;
            }

            let child = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if name == target_name {
                found.push(child);
                continue;
            }

            queue.push_back((child, depth + 1));
        }
    }

    (found, limited)
}

fn measure_path(
    recipe_id: &str,
    title: &str,
    path: &Path,
    kind: MeasureKind,
    request: &ScanRequest,
) -> ScanFinding {
    if is_path_protected(path, &request.protected_paths) {
        return ScanFinding {
            recipe_id: recipe_id.to_string(),
            title: title.to_string(),
            path: path_to_string(path),
            bytes: 0,
            status: "protected".to_string(),
            files: 0,
            dirs: 0,
            errors: 0,
            note: "Skipped because the path is user-protected.".to_string(),
            metadata_sources: None,
            evidence_summary: None,
            items: Vec::new(),
        };
    }

    if recipe_id == "recycle-bin" {
        let target = path_to_string(path);
        if let Some(root) = recycle_bin_drive_root(&target) {
            if let Some((bytes, item_count)) = query_recycle_bin_drive_root(&root) {
                return ScanFinding {
                    recipe_id: recipe_id.to_string(),
                    title: title.to_string(),
                    path: target,
                    bytes,
                    status: "measured".to_string(),
                    files: item_count,
                    dirs: 0,
                    errors: 0,
                    note: format!(
                        "Measured through SHQueryRecycleBinW for drive root {root}; no filesystem traversal was required."
                    ),
                    metadata_sources: None,
                    evidence_summary: None,
                    items: Vec::new(),
                };
            }
        }
    }

    let Ok(metadata) = fs::symlink_metadata(path) else {
        return ScanFinding {
            recipe_id: recipe_id.to_string(),
            title: title.to_string(),
            path: path_to_string(path),
            bytes: 0,
            status: "missing".to_string(),
            files: 0,
            dirs: 0,
            errors: 0,
            note: "Path was not present or could not be opened.".to_string(),
            metadata_sources: None,
            evidence_summary: None,
            items: Vec::new(),
        };
    };

    if metadata.file_type().is_symlink() {
        return ScanFinding {
            recipe_id: recipe_id.to_string(),
            title: title.to_string(),
            path: path_to_string(path),
            bytes: 0,
            status: "limited".to_string(),
            files: 0,
            dirs: 0,
            errors: 0,
            note: "Skipped symbolic link or reparse point.".to_string(),
            metadata_sources: None,
            evidence_summary: None,
            items: Vec::new(),
        };
    }

    if matches!(kind, MeasureKind::LargeUserFiles) {
        let items = large_user_file_items(path, request, 15);
        let bytes = items
            .iter()
            .fold(0_u64, |sum, item| sum.saturating_add(item.bytes));
        return ScanFinding {
            recipe_id: recipe_id.to_string(),
            title: title.to_string(),
            path: path_to_string(path),
            bytes,
            status: "measured".to_string(),
            files: items.len() as u64,
            dirs: 0,
            errors: 0,
            note: "Large-file discovery only. Personal files require item review.".to_string(),
            metadata_sources: None,
            evidence_summary: None,
            items,
        };
    }

    let stats = if metadata.is_file() {
        let bytes = if should_count_file(kind, path) {
            metadata.len()
        } else {
            0
        };
        SizeStats {
            bytes,
            files: u64::from(bytes > 0),
            ..SizeStats::default()
        }
    } else {
        walk_dir_size(path, kind, request)
    };

    ScanFinding {
        recipe_id: recipe_id.to_string(),
        title: title.to_string(),
        path: path_to_string(path),
        bytes: stats.bytes,
        status: if stats.limited { "limited" } else { "measured" }.to_string(),
        files: stats.files,
        dirs: stats.dirs,
        errors: stats.errors,
        note: if stats.limited {
            "Measured with configured depth or entry limits.".to_string()
        } else {
            "Measured from filesystem metadata only.".to_string()
        },
        metadata_sources: None,
        evidence_summary: None,
        items: review_items_for_path(recipe_id, path, kind, &stats, request),
    }
}

fn walk_dir_size(root: &Path, kind: MeasureKind, request: &ScanRequest) -> SizeStats {
    let max_depth = request.max_depth.unwrap_or(8);
    let max_entries = request.max_entries_per_root.unwrap_or(25_000);
    let mut queue = VecDeque::from([(root.to_path_buf(), 0usize)]);
    let mut stats = SizeStats::default();
    let mut visited = 0usize;

    while let Some((path, depth)) = queue.pop_front() {
        if visited >= max_entries {
            stats.limited = true;
            break;
        }
        visited += 1;

        if depth > max_depth || is_path_protected(&path, &request.protected_paths) {
            stats.limited = true;
            continue;
        }

        let Ok(metadata) = fs::symlink_metadata(&path) else {
            stats.errors += 1;
            continue;
        };

        if metadata.file_type().is_symlink() {
            continue;
        }

        if metadata.is_file() {
            if should_count_file(kind, &path) {
                stats.bytes = stats.bytes.saturating_add(metadata.len());
                stats.files += 1;
            }
            continue;
        }

        if !metadata.is_dir() {
            continue;
        }

        stats.dirs += 1;
        if depth == max_depth {
            stats.limited = true;
            continue;
        }

        match fs::read_dir(&path) {
            Ok(entries) => {
                for entry in entries.flatten() {
                    queue.push_back((entry.path(), depth + 1));
                }
            }
            Err(_) => {
                stats.errors += 1;
            }
        }
    }

    stats
}

fn should_count_file(kind: MeasureKind, path: &Path) -> bool {
    match kind {
        MeasureKind::FullTree => true,
        MeasureKind::DownloadInstallers => path
            .extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| {
                matches!(
                    extension.to_ascii_lowercase().as_str(),
                    "exe"
                        | "msi"
                        | "msix"
                        | "appx"
                        | "zip"
                        | "7z"
                        | "rar"
                        | "iso"
                        | "tar"
                        | "gz"
                        | "tgz"
                )
            })
            .unwrap_or(false),
        MeasureKind::LargeUserFiles => path
            .metadata()
            .map(|metadata| metadata.len() >= 1024 * 1024 * 1024)
            .unwrap_or(false),
        MeasureKind::InstalledAppFootprints => true,
    }
}

fn review_items_for_path(
    recipe_id: &str,
    root: &Path,
    kind: MeasureKind,
    stats: &SizeStats,
    request: &ScanRequest,
) -> Vec<ScanItem> {
    match recipe_id {
        "downloads-installers" => top_file_items(recipe_id, root, kind, request, 12),
        "large-user-files" => large_user_file_items(root, request, 15),
        "node-modules-old" => vec![project_dependency_scan_item(recipe_id, root, stats.bytes)],
        "android-studio" => top_child_items(recipe_id, root, request, 10),
        "installed-app-footprints" => top_child_items(recipe_id, root, request, 10),
        _ => Vec::new(),
    }
}

fn project_dependency_scan_item(recipe_id: &str, node_modules: &Path, bytes: u64) -> ScanItem {
    let age_days = path_age_days(node_modules).unwrap_or(0);
    let project_root = node_modules.parent().unwrap_or(node_modules);
    let project_name = project_root
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("project");
    let package_json = project_root.join("package.json");
    let package_text = fs::read_to_string(&package_json).unwrap_or_default();
    let package_value = serde_json::from_str::<Value>(&package_text).ok();
    let package_lower = package_text.to_ascii_lowercase();
    let has_package_json = package_json.exists();
    let package_name = package_value
        .as_ref()
        .and_then(|value| value.get("name"))
        .and_then(Value::as_str)
        .unwrap_or("");
    let dependency_names = package_dependency_names(package_value.as_ref());
    let lockfile = project_lockfile(project_root);
    let has_lockfile = lockfile.is_some();
    let package_manager =
        package_manager_signal(project_root, package_value.as_ref(), lockfile.as_deref());
    let framework_signals = project_framework_signals(&dependency_names, &package_lower);
    let script_signals = package_script_signals(package_value.as_ref());
    let expo_hint = framework_signals.iter().any(|signal| *signal == "expo");
    let react_native_hint = framework_signals
        .iter()
        .any(|signal| *signal == "react-native");
    let rebuildable = has_package_json && has_lockfile;
    let recommendation = if (rebuildable && age_days >= 45) || (has_package_json && age_days >= 75)
    {
        "review"
    } else {
        "keep"
    };
    let kind = if expo_hint {
        "Expo project dependency folder"
    } else if react_native_hint {
        "React Native project dependency folder"
    } else {
        "project dependency folder"
    };
    let mut signals = Vec::new();
    signals.push(format!("project={project_name}"));
    if !package_name.trim().is_empty() {
        signals.push(format!("package={package_name}"));
    }
    if has_package_json {
        signals.push("package.json".to_string());
    }
    if let Some(lockfile) = lockfile.as_deref() {
        signals.push(format!("lockfile={lockfile}"));
    }
    if let Some(package_manager) = package_manager.as_deref() {
        signals.push(format!("manager={package_manager}"));
    }
    if !framework_signals.is_empty() {
        signals.push(format!("frameworks={}", framework_signals.join("+")));
    }
    if !script_signals.is_empty() {
        signals.push(format!("scripts={}", script_signals.join(",")));
    }

    ScanItem {
        id: stable_item_id(recipe_id, node_modules),
        name: format!("{project_name}\\node_modules"),
        path: path_to_string(node_modules),
        bytes,
        age_days,
        kind: kind.to_string(),
        recommendation: recommendation.to_string(),
        reason: if recommendation == "review" {
            format!(
                "Rebuildable dependency folder is about {age_days} day(s) old; signals: {}. Source files are not selected; reinstall dependencies with the detected package manager if needed.",
                signals.join(", ")
            )
        } else if !has_package_json {
            "Dependency folder has no readable parent package.json; keep until the project is inspected.".to_string()
        } else {
            format!(
                "Project dependency folder is recent, missing rebuild proof, or ambiguous; signals: {}.",
                signals.join(", ")
            )
        },
        signals: project_dependency_review_signals(
            project_name,
            package_name,
            has_package_json,
            lockfile.as_deref(),
            package_manager.as_deref(),
            &framework_signals,
            &script_signals,
            age_days,
            rebuildable,
        ),
    }
}

fn project_dependency_review_signals(
    project_name: &str,
    package_name: &str,
    has_package_json: bool,
    lockfile: Option<&str>,
    package_manager: Option<&str>,
    framework_signals: &[&str],
    script_signals: &[String],
    age_days: u64,
    rebuildable: bool,
) -> Vec<ScanSignal> {
    let mut signals = vec![
        review_signal("project", project_name, "review"),
        review_signal(
            "modified age",
            format!("{age_days}d"),
            age_signal_tone(age_days, 45),
        ),
        review_signal(
            "rebuild proof",
            if rebuildable {
                "package + lockfile"
            } else {
                "incomplete"
            },
            if rebuildable { "safe" } else { "review" },
        ),
    ];
    if !package_name.trim().is_empty() {
        signals.push(review_signal("package", package_name, "review"));
    }
    signals.push(review_signal(
        "package.json",
        if has_package_json {
            "present"
        } else {
            "missing"
        },
        if has_package_json {
            "safe"
        } else {
            "restricted"
        },
    ));
    if let Some(lockfile) = lockfile {
        signals.push(review_signal("lockfile", lockfile, "safe"));
    }
    if let Some(package_manager) = package_manager {
        signals.push(review_signal("manager", package_manager, "safe"));
    }
    if !framework_signals.is_empty() {
        signals.push(review_signal(
            "framework",
            framework_signals.join("+"),
            "advanced",
        ));
    }
    if !script_signals.is_empty() {
        signals.push(review_signal("scripts", script_signals.join(","), "review"));
    }
    signals
}

fn package_dependency_names(package_value: Option<&Value>) -> Vec<String> {
    let mut names = Vec::new();
    let Some(package_value) = package_value else {
        return names;
    };

    for section in [
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "optionalDependencies",
    ] {
        let Some(object) = package_value.get(section).and_then(Value::as_object) else {
            continue;
        };
        for key in object.keys() {
            if names.len() >= 96 {
                return names;
            }
            if !names.iter().any(|name| name == key) {
                names.push(key.to_string());
            }
        }
    }

    names
}

fn project_lockfile(project_root: &Path) -> Option<String> {
    [
        "pnpm-lock.yaml",
        "yarn.lock",
        "bun.lockb",
        "package-lock.json",
    ]
    .iter()
    .find(|name| project_root.join(name).exists())
    .map(|name| (*name).to_string())
}

fn package_manager_signal(
    project_root: &Path,
    package_value: Option<&Value>,
    lockfile: Option<&str>,
) -> Option<String> {
    if let Some(package_manager) = package_value
        .and_then(|value| value.get("packageManager"))
        .and_then(Value::as_str)
        .map(package_manager_name)
        .filter(|value| !value.trim().is_empty())
    {
        return Some(package_manager);
    }

    match lockfile {
        Some("pnpm-lock.yaml") => Some("pnpm".to_string()),
        Some("yarn.lock") => Some("yarn".to_string()),
        Some("bun.lockb") => Some("bun".to_string()),
        Some("package-lock.json") => Some("npm".to_string()),
        _ if project_root.join("pnpm-workspace.yaml").exists() => Some("pnpm".to_string()),
        _ => None,
    }
}

fn package_manager_name(value: &str) -> String {
    value.split('@').next().unwrap_or(value).trim().to_string()
}

fn project_framework_signals(
    dependency_names: &[String],
    package_lower: &str,
) -> Vec<&'static str> {
    let mut signals = Vec::new();
    if has_dependency(dependency_names, "expo")
        || has_dependency_prefix(dependency_names, "expo-")
        || package_lower.contains("expo-router")
    {
        signals.push("expo");
    }
    if has_dependency(dependency_names, "react-native") || package_lower.contains("react-native") {
        signals.push("react-native");
    }
    if has_dependency(dependency_names, "next") {
        signals.push("next");
    }
    if has_dependency(dependency_names, "vite")
        || has_dependency_prefix(dependency_names, "@vitejs/")
    {
        signals.push("vite");
    }
    if has_dependency(dependency_names, "electron") {
        signals.push("electron");
    }
    if has_dependency(dependency_names, "@tauri-apps/api") {
        signals.push("tauri");
    }
    if has_dependency(dependency_names, "vue") {
        signals.push("vue");
    }
    if has_dependency(dependency_names, "svelte")
        || has_dependency(dependency_names, "@sveltejs/kit")
    {
        signals.push("svelte");
    }
    signals
}

fn has_dependency(dependency_names: &[String], expected: &str) -> bool {
    dependency_names.iter().any(|name| name == expected)
}

fn has_dependency_prefix(dependency_names: &[String], expected_prefix: &str) -> bool {
    dependency_names
        .iter()
        .any(|name| name.starts_with(expected_prefix))
}

fn package_script_signals(package_value: Option<&Value>) -> Vec<String> {
    let Some(scripts) = package_value
        .and_then(|value| value.get("scripts"))
        .and_then(Value::as_object)
    else {
        return Vec::new();
    };

    ["dev", "start", "build", "test", "android", "ios", "web"]
        .iter()
        .filter(|name| scripts.contains_key(*name))
        .take(5)
        .map(|name| (*name).to_string())
        .collect()
}

fn top_file_items(
    recipe_id: &str,
    root: &Path,
    kind: MeasureKind,
    request: &ScanRequest,
    limit: usize,
) -> Vec<ScanItem> {
    let max_entries = request.max_entries_per_root.unwrap_or(25_000);
    let mut queue = VecDeque::from([root.to_path_buf()]);
    let mut visited = 0usize;
    let mut items = Vec::new();

    while let Some(path) = queue.pop_front() {
        if visited >= max_entries {
            break;
        }
        visited += 1;

        if is_path_protected(&path, &request.protected_paths) {
            continue;
        }

        let Ok(metadata) = fs::symlink_metadata(&path) else {
            continue;
        };
        if metadata.file_type().is_symlink() {
            continue;
        }
        if metadata.is_file() {
            if should_count_file(kind, &path) {
                items.push(scan_item_from_path(
                    recipe_id,
                    &path,
                    metadata.len(),
                    "download file",
                ));
            }
            continue;
        }
        if metadata.is_dir() {
            if let Ok(entries) = fs::read_dir(&path) {
                for entry in entries.flatten() {
                    queue.push_back(entry.path());
                }
            }
        }
    }

    items.sort_by(|a, b| b.bytes.cmp(&a.bytes));
    items.truncate(limit);
    items
}

fn large_user_file_items(profile: &Path, request: &ScanRequest, limit: usize) -> Vec<ScanItem> {
    let roots = ["Downloads", "Desktop", "Documents", "Videos"]
        .iter()
        .map(|name| profile.join(name))
        .filter(|path| path.exists())
        .collect::<Vec<_>>();
    let max_depth = request.max_depth.unwrap_or(8).min(4);
    let max_entries = request.max_entries_per_root.unwrap_or(25_000);
    let threshold = 1024_u64 * 1024 * 1024;
    let mut queue = roots
        .into_iter()
        .map(|path| (path, 0usize))
        .collect::<VecDeque<_>>();
    let mut visited = 0usize;
    let mut items = Vec::new();

    while let Some((path, depth)) = queue.pop_front() {
        if visited >= max_entries {
            break;
        }
        visited += 1;

        if depth > max_depth || is_path_protected(&path, &request.protected_paths) {
            continue;
        }

        let Ok(metadata) = fs::symlink_metadata(&path) else {
            continue;
        };
        if metadata.file_type().is_symlink() {
            continue;
        }

        if metadata.is_file() {
            if metadata.len() >= threshold {
                items.push(scan_item_from_path(
                    "large-user-files",
                    &path,
                    metadata.len(),
                    "large personal file",
                ));
            }
            continue;
        }

        if metadata.is_dir() && depth < max_depth {
            if let Ok(entries) = fs::read_dir(&path) {
                for entry in entries.flatten() {
                    queue.push_back((entry.path(), depth + 1));
                }
            }
        }
    }

    items.sort_by(|a, b| b.bytes.cmp(&a.bytes));
    items.truncate(limit);
    items
}

fn top_child_items(
    recipe_id: &str,
    root: &Path,
    request: &ScanRequest,
    limit: usize,
) -> Vec<ScanItem> {
    let mut items = Vec::new();
    let Ok(entries) = fs::read_dir(root) else {
        return items;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if is_path_protected(&path, &request.protected_paths) {
            continue;
        }
        let Ok(metadata) = fs::symlink_metadata(&path) else {
            continue;
        };
        if metadata.file_type().is_symlink() {
            continue;
        }
        let bytes = if metadata.is_file() {
            metadata.len()
        } else if metadata.is_dir() {
            walk_dir_size(&path, MeasureKind::FullTree, request).bytes
        } else {
            0
        };
        if bytes > 0 {
            items.push(scan_item_from_path(recipe_id, &path, bytes, "tooling item"));
        }
    }

    items.sort_by(|a, b| b.bytes.cmp(&a.bytes));
    items.truncate(limit);
    items
}

fn scan_item_from_path(recipe_id: &str, path: &Path, bytes: u64, kind: &str) -> ScanItem {
    let age_days = path_age_days(path).unwrap_or(0);
    let review_age_days = if recipe_id == "large-user-files" {
        90
    } else {
        30
    };
    let recommendation = if age_days >= review_age_days {
        "review"
    } else {
        "keep"
    };
    ScanItem {
        id: stable_item_id(recipe_id, path),
        name: path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("item")
            .to_string(),
        path: path_to_string(path),
        bytes,
        age_days,
        kind: kind.to_string(),
        recommendation: recommendation.to_string(),
        reason: if recommendation == "review" {
            format!(
                "Candidate is about {age_days} day(s) old and should be reviewed before cleanup."
            )
        } else {
            "Recent or ambiguous item; keep until the user confirms.".to_string()
        },
        signals: vec![
            review_signal("kind", kind, "review"),
            review_signal(
                "modified age",
                format!("{age_days}d"),
                age_signal_tone(age_days, review_age_days),
            ),
            review_signal(
                "measured size",
                format!("{bytes} bytes"),
                size_signal_tone(bytes),
            ),
        ],
    }
}

fn review_signal(label: &str, value: impl Into<String>, tone: &str) -> ScanSignal {
    ScanSignal {
        label: label.to_string(),
        value: value.into(),
        tone: tone.to_string(),
    }
}

fn age_signal_tone(age_days: u64, threshold_days: u64) -> &'static str {
    if age_days >= threshold_days {
        "review"
    } else {
        "safe"
    }
}

fn size_signal_tone(bytes: u64) -> &'static str {
    if bytes >= 1024 * 1024 * 1024 {
        "review"
    } else {
        "safe"
    }
}

fn stable_item_id(recipe_id: &str, path: &Path) -> String {
    let mut hash = 0u64;
    for byte in path_to_string(path).bytes() {
        hash = hash.wrapping_mul(31).wrapping_add(u64::from(byte));
    }
    format!("{recipe_id}-{hash:x}")
}

fn path_age_days(path: &Path) -> Option<u64> {
    path_age_days_at(path, SystemTime::now())
}

fn path_age_days_at(path: &Path, now: SystemTime) -> Option<u64> {
    let modified = fs::metadata(path).ok()?.modified().ok()?;
    let elapsed = now.duration_since(modified).ok()?;
    Some(elapsed.as_secs() / 86_400)
}

fn unsupported_finding(
    recipe_id: &'static str,
    title: &'static str,
    path: &'static str,
    note: &'static str,
) -> ScanFinding {
    ScanFinding {
        recipe_id: recipe_id.to_string(),
        title: title.to_string(),
        path: path.to_string(),
        bytes: 0,
        status: "unsupported".to_string(),
        files: 0,
        dirs: 0,
        errors: 0,
        note: note.to_string(),
        metadata_sources: None,
        evidence_summary: None,
        items: Vec::new(),
    }
}

fn missing_finding(
    recipe_id: &'static str,
    title: &'static str,
    path: &'static str,
    note: &'static str,
) -> ScanFinding {
    ScanFinding {
        recipe_id: recipe_id.to_string(),
        title: title.to_string(),
        path: path.to_string(),
        bytes: 0,
        status: "missing".to_string(),
        files: 0,
        dirs: 0,
        errors: 0,
        note: note.to_string(),
        metadata_sources: None,
        evidence_summary: None,
        items: Vec::new(),
    }
}

fn env_path(name: &str) -> Option<PathBuf> {
    env::var_os(name)
        .map(PathBuf::from)
        .filter(|path| !path.as_os_str().is_empty())
}

fn path_to_string(path: &Path) -> String {
    path.display().to_string()
}

fn is_path_protected(path: &Path, protected_paths: &[String]) -> bool {
    let path = normalize_path(&path_to_string(path));
    protected_paths.iter().any(|protected| {
        let protected = normalize_path(protected);
        !protected.is_empty() && (path == protected || path.starts_with(&format!("{protected}\\")))
    })
}

fn normalize_path(value: &str) -> String {
    value
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_ascii_lowercase()
}

fn same_normalized_path(left: &Path, right: &Path) -> bool {
    normalize_path(&path_to_string(left)) == normalize_path(&path_to_string(right))
}

fn generated_at() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    format!("unix-ms:{millis}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsString;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    struct EnvRestore {
        name: &'static str,
        value: Option<OsString>,
    }

    impl EnvRestore {
        fn set(name: &'static str, value: &Path) -> Self {
            let previous = env::var_os(name);
            env::set_var(name, value);
            Self {
                name,
                value: previous,
            }
        }
    }

    impl Drop for EnvRestore {
        fn drop(&mut self) {
            if let Some(value) = &self.value {
                env::set_var(self.name, value);
            } else {
                env::remove_var(self.name);
            }
        }
    }

    fn unique_test_dir(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        env::temp_dir().join(format!("spaceguard-{label}-{}-{nanos}", std::process::id()))
    }

    #[test]
    fn npm_cache_target_gate_accepts_only_current_user_cacache() {
        let _lock = ENV_LOCK.lock().expect("env lock");
        let local_app_data = unique_test_dir("npm-target-gate");
        let cacache = local_app_data.join("npm-cache").join("_cacache");
        let node_modules = local_app_data
            .join("projects")
            .join("app")
            .join("node_modules");
        fs::create_dir_all(&cacache).expect("create test npm _cacache");
        fs::create_dir_all(&node_modules).expect("create test node_modules");
        let _restore = EnvRestore::set("LOCALAPPDATA", &local_app_data);

        assert_eq!(
            npm_cache_target_reject_code(&path_to_string(&cacache)),
            None,
            "exact current-user npm-cache _cacache root should be allowed"
        );
        assert_eq!(
            npm_cache_target_reject_code(&path_to_string(&local_app_data.join("npm-cache"))),
            Some("target-not-npm-cache"),
            "parent npm-cache directory should stay outside the executor target"
        );
        assert_eq!(
            npm_cache_target_reject_code(&path_to_string(&node_modules)),
            Some("target-forbidden"),
            "project dependency folders must never pass through the npm cache executor"
        );
        assert_eq!(
            npm_cache_target_reject_code(""),
            Some("target-missing"),
            "empty targets should be rejected before route execution"
        );

        let _ = fs::remove_dir(&cacache);
        let _ = fs::remove_dir(local_app_data.join("npm-cache"));
        let _ = fs::remove_dir(&node_modules);
        let _ = fs::remove_dir(local_app_data.join("projects").join("app"));
        let _ = fs::remove_dir(local_app_data.join("projects"));
        let _ = fs::remove_dir(local_app_data);
    }

    #[test]
    fn temp_target_gate_rejects_parent_traversal_out_of_env_temp() {
        let _lock = ENV_LOCK.lock().expect("env lock");
        let root = unique_test_dir("temp-target-gate");
        let temp_root = root.join("Temp");
        let temp_child_root = temp_root.join("old-cache");
        let outside_root = root.join("outside-temp");
        fs::create_dir_all(&temp_child_root).expect("create temp child root");
        fs::create_dir_all(&outside_root).expect("create outside temp sibling");
        let _temp_restore = EnvRestore::set("TEMP", &temp_root);
        let _tmp_restore = EnvRestore::set("TMP", &temp_root);

        assert_eq!(
            write_action_target_reject_code(
                "known-temp-delete",
                &Some("%TEMP%\\old-cache".to_string())
            ),
            None,
            "scoped child target under TEMP should be allowed"
        );
        assert_eq!(
            write_action_target_reject_code(
                "known-temp-delete",
                &Some("%TEMP%\\..\\outside-temp".to_string())
            ),
            Some("target-forbidden"),
            "parent traversal must not escape the TEMP root"
        );

        let _ = fs::remove_dir(&temp_child_root);
        let _ = fs::remove_dir(&temp_root);
        let _ = fs::remove_dir(&outside_root);
        let _ = fs::remove_dir(root);
    }

    #[test]
    fn npm_cache_file_filter_limits_deletion_to_old_content_and_tmp_files() {
        let root = unique_test_dir("npm-file-filter")
            .join("npm-cache")
            .join("_cacache");
        assert!(
            !npm_cache_file_forbidden(&root.join("content-v2").join("sha512").join("ab")),
            "content-v2 cache blobs are eligible for age-gated deletion"
        );
        assert!(
            !npm_cache_file_forbidden(&root.join("tmp").join("scratch-file")),
            "tmp cache files are eligible for age-gated deletion"
        );
        assert!(
            npm_cache_file_forbidden(&root.join("index-v5").join("bucket")),
            "npm index metadata should stay outside the file deleter"
        );
        assert!(
            npm_cache_file_forbidden(&root.join("tmp").join("cache.lock")),
            "lock files should never be deleted by the npm cache executor"
        );
    }

    #[test]
    fn browser_cache_deleter_removes_only_old_cache_files() {
        let base = unique_test_dir("browser-delete-proof");
        let root = base.join("Cache").join("Cache_Data");
        let cache_file = root.join("entry");
        let cache_bytes = b"delete-cache";

        fs::create_dir_all(&root).expect("create browser cache dir");
        fs::write(&cache_file, cache_bytes).expect("write browser cache file");

        let recent_result = delete_browser_cache_target_at(&root, SystemTime::now());

        assert_eq!(
            recent_result.deleted_files, 0,
            "browser cache files younger than the age gate should be skipped"
        );
        assert!(
            cache_file.exists(),
            "recent browser cache file should survive"
        );

        let old_enough_now = SystemTime::now() + Duration::from_secs(11 * 60);
        let result = delete_browser_cache_target_at(&root, old_enough_now);

        assert_eq!(
            result.deleted_files, 1,
            "old browser cache file should be deleted"
        );
        assert_eq!(
            result.deleted_bytes,
            cache_bytes.len() as u64,
            "deleted bytes should match removed browser cache file length"
        );
        assert!(
            !cache_file.exists(),
            "old browser cache file should be removed"
        );

        let _ = fs::remove_dir(&root);
        let _ = fs::remove_dir(base.join("Cache"));
        let _ = fs::remove_dir(&base);
    }

    #[test]
    fn gradle_cache_deleter_removes_only_old_cache_files() {
        let user_profile = unique_test_dir("gradle-delete-proof");
        let root = user_profile.join(".gradle").join("caches");
        let old_artifact = root
            .join("modules-2")
            .join("files-2.1")
            .join("group")
            .join("module")
            .join("1.0.0")
            .join("artifact.jar");
        let old_transform = root
            .join("transforms-3")
            .join("hash")
            .join("transformed")
            .join("classes.bin");
        let lock_file = root.join("modules-2").join("metadata.lock");
        let gc_properties = root.join("gc.properties");

        fs::create_dir_all(old_artifact.parent().expect("old artifact parent"))
            .expect("create old artifact dir");
        fs::create_dir_all(old_transform.parent().expect("old transform parent"))
            .expect("create old transform dir");
        fs::create_dir_all(lock_file.parent().expect("lock parent")).expect("create lock dir");
        fs::write(&old_artifact, b"delete-artifact").expect("write old artifact");
        fs::write(&old_transform, b"delete-transform").expect("write old transform");
        fs::write(&lock_file, b"keep-lock").expect("write lock");
        fs::write(&gc_properties, b"keep-gc").expect("write gc properties");

        let _lock = ENV_LOCK.lock().expect("env lock");
        let _restore_profile = EnvRestore::set("USERPROFILE", &user_profile);
        let _restore_home = EnvRestore::set("HOME", &user_profile);
        let old_enough_now = SystemTime::now() + Duration::from_secs(31 * 24 * 60 * 60);

        let result = delete_gradle_cache_target_at(&root, old_enough_now);

        assert_eq!(
            result.deleted_files, 2,
            "old Gradle cache files should be deleted"
        );
        assert_eq!(
            result.deleted_bytes, 31,
            "deleted bytes should match removed Gradle file lengths"
        );
        assert!(
            !old_artifact.exists(),
            "old Gradle artifact should be removed"
        );
        assert!(
            !old_transform.exists(),
            "old Gradle transform should be removed"
        );
        assert!(lock_file.exists(), "Gradle lock files must survive");
        assert!(gc_properties.exists(), "Gradle gc.properties must survive");

        let _ = fs::remove_file(&lock_file);
        let _ = fs::remove_file(&gc_properties);
        let _ = fs::remove_dir(lock_file.parent().expect("lock parent"));
        let _ = fs::remove_dir(root.join("modules-2"));
        let _ = fs::remove_dir(root.join("transforms-3").join("hash").join("transformed"));
        let _ = fs::remove_dir(root.join("transforms-3").join("hash"));
        let _ = fs::remove_dir(root.join("transforms-3"));
        let _ = fs::remove_dir(&root);
        let _ = fs::remove_dir(user_profile.join(".gradle"));
        let _ = fs::remove_dir(&user_profile);
    }

    #[test]
    fn user_cache_deleter_removes_only_old_non_metadata_files() {
        let user_profile = unique_test_dir("user-cache-delete-proof");
        let root = user_profile.join(".cache");
        let old_blob = root.join("tool").join("blob.bin");
        let old_temp = root.join("tool").join("tmp").join("scratch.bin");
        let json_metadata = root.join("tool").join("settings.json");
        let config_file = root.join("config").join("state.bin");
        let session_file = root.join("sessions").join("token.bin");
        let blob_bytes = b"delete-user-cache";
        let temp_bytes = b"delete-user-temp";

        fs::create_dir_all(old_blob.parent().expect("old blob parent"))
            .expect("create old blob dir");
        fs::create_dir_all(old_temp.parent().expect("old temp parent"))
            .expect("create old temp dir");
        fs::create_dir_all(config_file.parent().expect("config parent"))
            .expect("create config dir");
        fs::create_dir_all(session_file.parent().expect("session parent"))
            .expect("create session dir");
        fs::write(&old_blob, blob_bytes).expect("write old user cache blob");
        fs::write(&old_temp, temp_bytes).expect("write old user cache temp");
        fs::write(&json_metadata, b"keep-json").expect("write json metadata");
        fs::write(&config_file, b"keep-config").expect("write config file");
        fs::write(&session_file, b"keep-session").expect("write session file");

        let _lock = ENV_LOCK.lock().expect("env lock");
        let _restore_profile = EnvRestore::set("USERPROFILE", &user_profile);
        let _restore_home = EnvRestore::set("HOME", &user_profile);
        let old_enough_now = SystemTime::now() + Duration::from_secs(31 * 24 * 60 * 60);

        let result = delete_user_cache_target_at(&root, old_enough_now);

        assert_eq!(
            result.deleted_files, 2,
            "old non-metadata user cache files should be deleted"
        );
        assert_eq!(
            result.deleted_bytes,
            (blob_bytes.len() + temp_bytes.len()) as u64,
            "deleted bytes should match removed user cache file lengths"
        );
        assert!(!old_blob.exists(), "old user cache blob should be removed");
        assert!(
            !old_temp.exists(),
            "old user cache temp file should be removed"
        );
        assert!(
            json_metadata.exists(),
            "user cache json metadata must survive"
        );
        assert!(config_file.exists(), "user cache config dirs must survive");
        assert!(
            session_file.exists(),
            "user cache session dirs must survive"
        );

        let _ = fs::remove_file(&json_metadata);
        let _ = fs::remove_file(&config_file);
        let _ = fs::remove_file(&session_file);
        let _ = fs::remove_dir(root.join("tool"));
        let _ = fs::remove_dir(root.join("config"));
        let _ = fs::remove_dir(root.join("sessions"));
        let _ = fs::remove_dir(&root);
        let _ = fs::remove_dir(&user_profile);
    }

    #[test]
    fn android_cache_deleter_removes_only_old_cache_files() {
        let user_profile = unique_test_dir("android-cache-delete-proof");
        let root = user_profile.join(".android").join("build-cache");
        let old_blob = root.join("tool").join("blob.bin");
        let old_temp = root.join("tool").join("tmp").join("scratch.bin");
        let json_metadata = root.join("tool").join("metadata.json");
        let config_file = root.join("config").join("state.bin");
        let blob_bytes = b"delete-android-cache";
        let temp_bytes = b"delete-android-temp";

        fs::create_dir_all(old_blob.parent().expect("old blob parent"))
            .expect("create old Android blob dir");
        fs::create_dir_all(old_temp.parent().expect("old temp parent"))
            .expect("create old Android temp dir");
        fs::create_dir_all(config_file.parent().expect("config parent"))
            .expect("create Android config dir");
        fs::write(&old_blob, blob_bytes).expect("write old Android cache blob");
        fs::write(&old_temp, temp_bytes).expect("write old Android cache temp");
        fs::write(&json_metadata, b"keep-json").expect("write Android json metadata");
        fs::write(&config_file, b"keep-config").expect("write Android config file");

        let _lock = ENV_LOCK.lock().expect("env lock");
        let _restore_profile = EnvRestore::set("USERPROFILE", &user_profile);
        let _restore_home = EnvRestore::set("HOME", &user_profile);
        let old_enough_now = SystemTime::now() + Duration::from_secs(31 * 24 * 60 * 60);

        let result = delete_android_cache_target_at(&root, old_enough_now);

        assert_eq!(
            result.deleted_files, 2,
            "old Android cache files should be deleted"
        );
        assert_eq!(
            result.deleted_bytes,
            (blob_bytes.len() + temp_bytes.len()) as u64,
            "deleted bytes should match removed Android cache file lengths"
        );
        assert!(
            !old_blob.exists(),
            "old Android cache blob should be removed"
        );
        assert!(
            !old_temp.exists(),
            "old Android cache temp file should be removed"
        );
        assert!(
            json_metadata.exists(),
            "Android cache json metadata must survive"
        );
        assert!(
            config_file.exists(),
            "Android cache config dirs must survive"
        );

        let _ = fs::remove_file(&json_metadata);
        let _ = fs::remove_file(&config_file);
        let _ = fs::remove_dir(root.join("tool"));
        let _ = fs::remove_dir(root.join("config"));
        let _ = fs::remove_dir(&root);
        let _ = fs::remove_dir(user_profile.join(".android"));
        let _ = fs::remove_dir(&user_profile);
    }

    #[test]
    fn shader_cache_deleter_removes_only_old_cache_files() {
        let local_app_data = unique_test_dir("shader-cache-delete-proof");
        let root = local_app_data.join("D3DSCache");
        let old_blob = root.join("shader.bin");
        let old_nested = root.join("pipeline").join("cache.bin");
        let json_metadata = root.join("metadata.json");
        let config_file = root.join("config").join("state.bin");
        let blob_bytes = b"delete-shader-cache";
        let nested_bytes = b"delete-shader-nested";

        fs::create_dir_all(old_nested.parent().expect("old nested parent"))
            .expect("create shader nested dir");
        fs::create_dir_all(config_file.parent().expect("config parent"))
            .expect("create shader config dir");
        fs::write(&old_blob, blob_bytes).expect("write old shader cache blob");
        fs::write(&old_nested, nested_bytes).expect("write old shader nested cache");
        fs::write(&json_metadata, b"keep-json").expect("write shader json metadata");
        fs::write(&config_file, b"keep-config").expect("write shader config file");

        let _lock = ENV_LOCK.lock().expect("env lock");
        let _restore_local = EnvRestore::set("LOCALAPPDATA", &local_app_data);
        let old_enough_now = SystemTime::now() + Duration::from_secs(15 * 24 * 60 * 60);

        let result = delete_shader_cache_target_at(&root, old_enough_now);

        assert_eq!(
            result.deleted_files, 2,
            "old shader cache files should be deleted"
        );
        assert_eq!(
            result.deleted_bytes,
            (blob_bytes.len() + nested_bytes.len()) as u64,
            "deleted bytes should match removed shader cache file lengths"
        );
        assert!(
            !old_blob.exists(),
            "old shader cache blob should be removed"
        );
        assert!(
            !old_nested.exists(),
            "old nested shader cache file should be removed"
        );
        assert!(
            json_metadata.exists(),
            "shader cache json metadata must survive"
        );
        assert!(
            config_file.exists(),
            "shader cache config dirs must survive"
        );

        let _ = fs::remove_file(&json_metadata);
        let _ = fs::remove_file(&config_file);
        let _ = fs::remove_dir(root.join("pipeline"));
        let _ = fs::remove_dir(root.join("config"));
        let _ = fs::remove_dir(&root);
        let _ = fs::remove_dir(&local_app_data);
    }

    #[test]
    fn pip_cache_deleter_removes_only_old_cache_files() {
        let local_app_data = unique_test_dir("pip-cache-delete-proof");
        let root = local_app_data.join("pip").join("Cache");
        let old_wheel = root.join("http").join("package.whl");
        let old_body = root.join("http-v2").join("ab").join("body");
        let selfcheck_file = root.join("selfcheck").join("state.bin");
        let config_file = root.join("pip.conf");
        let wheel_bytes = b"delete-pip-wheel";
        let body_bytes = b"delete-pip-body";

        fs::create_dir_all(old_wheel.parent().expect("old wheel parent"))
            .expect("create pip wheel dir");
        fs::create_dir_all(old_body.parent().expect("old body parent"))
            .expect("create pip body dir");
        fs::create_dir_all(selfcheck_file.parent().expect("selfcheck parent"))
            .expect("create pip selfcheck dir");
        fs::write(&old_wheel, wheel_bytes).expect("write old pip wheel");
        fs::write(&old_body, body_bytes).expect("write old pip body");
        fs::write(&selfcheck_file, b"keep-selfcheck").expect("write pip selfcheck file");
        fs::write(&config_file, b"keep-config").expect("write pip config file");

        let _lock = ENV_LOCK.lock().expect("env lock");
        let _restore_local = EnvRestore::set("LOCALAPPDATA", &local_app_data);
        let old_enough_now = SystemTime::now() + Duration::from_secs(15 * 24 * 60 * 60);

        let result = delete_pip_cache_target_at(&root, old_enough_now);

        assert_eq!(
            result.deleted_files, 2,
            "old pip cache files should be deleted"
        );
        assert_eq!(
            result.deleted_bytes,
            (wheel_bytes.len() + body_bytes.len()) as u64,
            "deleted bytes should match removed pip cache file lengths"
        );
        assert!(!old_wheel.exists(), "old pip wheel cache should be removed");
        assert!(!old_body.exists(), "old pip body cache should be removed");
        assert!(selfcheck_file.exists(), "pip selfcheck files must survive");
        assert!(config_file.exists(), "pip config files must survive");

        let _ = fs::remove_file(&selfcheck_file);
        let _ = fs::remove_file(&config_file);
        let _ = fs::remove_dir(root.join("http"));
        let _ = fs::remove_dir(root.join("http-v2").join("ab"));
        let _ = fs::remove_dir(root.join("http-v2"));
        let _ = fs::remove_dir(root.join("selfcheck"));
        let _ = fs::remove_dir(&root);
        let _ = fs::remove_dir(local_app_data.join("pip"));
        let _ = fs::remove_dir(&local_app_data);
    }

    #[test]
    fn downloads_target_validation_accepts_only_old_reviewed_installer_files() {
        let user_profile = unique_test_dir("downloads-target-proof");
        let downloads = user_profile.join("Downloads");
        let old_installer = downloads.join("setup-old.exe");
        let recent_installer = downloads.join("setup-recent.msi");
        let old_note = downloads.join("notes.txt");
        let outside_installer = user_profile.join("Desktop").join("setup-old.exe");
        let folder_target = downloads.join("archive.zip");

        fs::create_dir_all(&downloads).expect("create downloads dir");
        fs::create_dir_all(outside_installer.parent().expect("outside parent"))
            .expect("create outside dir");
        fs::create_dir_all(&folder_target).expect("create folder target");
        fs::write(&old_installer, b"old installer").expect("write old installer");
        fs::write(&recent_installer, b"recent installer").expect("write recent installer");
        fs::write(&old_note, b"old note").expect("write old note");
        fs::write(&outside_installer, b"outside installer").expect("write outside installer");

        let _lock = ENV_LOCK.lock().expect("env lock");
        let _restore_profile = EnvRestore::set("USERPROFILE", &user_profile);
        let _restore_home = EnvRestore::set("HOME", &user_profile);
        let old_enough_now = SystemTime::now() + Duration::from_secs(31 * 24 * 60 * 60);

        assert_eq!(
            downloads_cleanup_target_reject_code_at(
                &path_to_string(&old_installer),
                old_enough_now
            ),
            None,
            "old reviewed installer/archive files in Downloads should be accepted"
        );
        assert_eq!(
            downloads_cleanup_target_reject_code_at(
                &path_to_string(&recent_installer),
                SystemTime::now()
            ),
            Some("target-too-recent"),
            "recent Downloads installers should be blocked"
        );
        assert_eq!(
            downloads_cleanup_target_reject_code_at(&path_to_string(&old_note), old_enough_now),
            Some("target-not-downloads-file"),
            "non-installer/archive Downloads files should be blocked"
        );
        assert_eq!(
            downloads_cleanup_target_reject_code_at(
                &path_to_string(&folder_target),
                old_enough_now
            ),
            Some("target-link-or-not-file"),
            "Downloads directories should be blocked"
        );
        assert_eq!(
            downloads_cleanup_target_reject_code_at(
                &path_to_string(&outside_installer),
                old_enough_now
            ),
            Some("target-not-downloads-folder"),
            "installer/archive files outside Downloads should be blocked"
        );

        let _ = fs::remove_file(&old_installer);
        let _ = fs::remove_file(&recent_installer);
        let _ = fs::remove_file(&old_note);
        let _ = fs::remove_file(&outside_installer);
        let _ = fs::remove_dir(&folder_target);
        let _ = fs::remove_dir(&downloads);
        let _ = fs::remove_dir(user_profile.join("Desktop"));
        let _ = fs::remove_dir(&user_profile);
    }

    #[test]
    fn docker_build_cache_target_validation_accepts_only_inventory_marker() {
        assert_eq!(
            docker_build_cache_target_reject_code("Docker Desktop build cache"),
            None,
            "Docker build-cache executor should accept only the native inventory marker"
        );
        assert_eq!(
            docker_build_cache_target_reject_code("docker system prune"),
            Some("target-forbidden"),
            "arbitrary Docker prune commands must stay outside the executor target"
        );
        assert_eq!(
            docker_build_cache_target_reject_code("C:\\Users\\LocalUser\\.docker"),
            Some("target-not-docker-build-cache"),
            "Docker filesystem paths must not pass through the build-cache command executor"
        );
        assert_eq!(
            docker_build_cache_target_reject_code(""),
            Some("target-missing"),
            "empty Docker build-cache targets should be rejected before execution"
        );
    }

    #[test]
    fn recycle_bin_target_validation_accepts_only_drive_recycle_bin_root() {
        assert_eq!(
            recycle_bin_target_reject_code("C:\\$Recycle.Bin"),
            None,
            "Recycle Bin executor should accept only the selected drive recycle-bin root"
        );
        assert_eq!(
            recycle_bin_target_reject_code("C:\\Users\\LocalUser\\Downloads"),
            Some("target-forbidden"),
            "Recycle Bin executor must reject ordinary user folders"
        );
        assert_eq!(
            recycle_bin_target_reject_code("C:\\Windows"),
            Some("target-forbidden"),
            "Recycle Bin executor must reject protected system folders"
        );
        assert_eq!(
            recycle_bin_target_reject_code("Recycle Bin"),
            Some("target-not-recycle-bin"),
            "Recycle Bin labels without a drive root are not enough for native execution"
        );
    }

    #[test]
    fn large_file_archive_target_validation_accepts_only_old_large_reviewed_files() {
        let user_profile = unique_test_dir("large-file-target-proof");
        let videos = user_profile.join("Videos");
        let desktop = user_profile.join("Desktop");
        let app_data = user_profile.join("AppData").join("Local");
        let archive_destination = unique_test_dir("large-file-archive-destination");
        let old_large_file = videos.join("old-export.mov");
        let recent_large_file = videos.join("recent-export.mov");
        let small_file = videos.join("small-export.mov");
        let outside_large_file = user_profile.join("Projects").join("old-export.mov");
        let folder_target = desktop.join("folder.mov");
        let forbidden_destination = app_data.join("Archive");
        let large_size = 1024_u64 * 1024 * 1024 + 1;

        fs::create_dir_all(&videos).expect("create videos dir");
        fs::create_dir_all(&desktop).expect("create desktop dir");
        fs::create_dir_all(outside_large_file.parent().expect("outside parent"))
            .expect("create outside dir");
        fs::create_dir_all(&folder_target).expect("create folder target");
        fs::create_dir_all(&archive_destination).expect("create archive destination");
        fs::create_dir_all(&forbidden_destination).expect("create forbidden destination");
        fs::File::create(&old_large_file)
            .expect("create old large file")
            .set_len(large_size)
            .expect("size old large file");
        fs::File::create(&recent_large_file)
            .expect("create recent large file")
            .set_len(large_size)
            .expect("size recent large file");
        fs::write(&small_file, b"small file").expect("write small file");
        fs::File::create(&outside_large_file)
            .expect("create outside large file")
            .set_len(large_size)
            .expect("size outside large file");

        let _lock = ENV_LOCK.lock().expect("env lock");
        let _restore_profile = EnvRestore::set("USERPROFILE", &user_profile);
        let _restore_home = EnvRestore::set("HOME", &user_profile);
        let old_enough_now = SystemTime::now() + Duration::from_secs(91 * 24 * 60 * 60);
        let archive_destination_text = path_to_string(&archive_destination);

        assert_eq!(
            large_file_archive_target_reject_code_at(
                &path_to_string(&old_large_file),
                &archive_destination_text,
                old_enough_now
            ),
            None,
            "old reviewed 1GB+ files in allowed user folders should be accepted"
        );
        assert_eq!(
            large_file_archive_target_reject_code_at(
                &path_to_string(&recent_large_file),
                &archive_destination_text,
                SystemTime::now()
            ),
            Some("target-too-recent"),
            "recent large files should be blocked"
        );
        assert_eq!(
            large_file_archive_target_reject_code_at(
                &path_to_string(&small_file),
                &archive_destination_text,
                old_enough_now
            ),
            Some("target-too-small"),
            "small files should be blocked"
        );
        assert_eq!(
            large_file_archive_target_reject_code_at(
                &path_to_string(&outside_large_file),
                &archive_destination_text,
                old_enough_now
            ),
            Some("target-not-user-review-folder"),
            "files outside allowed review folders should be blocked"
        );
        assert_eq!(
            large_file_archive_target_reject_code_at(
                &path_to_string(&folder_target),
                &archive_destination_text,
                old_enough_now
            ),
            Some("target-link-or-not-file"),
            "directory targets should be blocked"
        );
        assert_eq!(
            large_file_archive_target_reject_code_at(
                &path_to_string(&old_large_file),
                &path_to_string(&forbidden_destination),
                old_enough_now
            ),
            Some("archive-destination-forbidden"),
            "AppData archive destinations should be blocked"
        );
        assert!(same_windows_drive(
            "C:\\Users\\me\\Videos\\old.mov",
            "C:\\Archive"
        ));
        assert!(!same_windows_drive(
            "C:\\Users\\me\\Videos\\old.mov",
            "D:\\Archive"
        ));

        let _ = fs::remove_file(&old_large_file);
        let _ = fs::remove_file(&recent_large_file);
        let _ = fs::remove_file(&small_file);
        let _ = fs::remove_file(&outside_large_file);
        let _ = fs::remove_dir(&folder_target);
        let _ = fs::remove_dir(&videos);
        let _ = fs::remove_dir(&desktop);
        let _ = fs::remove_dir(user_profile.join("Projects"));
        let _ = fs::remove_dir(&forbidden_destination);
        let _ = fs::remove_dir(&app_data);
        let _ = fs::remove_dir(user_profile.join("AppData"));
        let _ = fs::remove_dir(&archive_destination);
        let _ = fs::remove_dir(&user_profile);
    }

    #[test]
    fn project_dependency_target_validation_rejects_forbidden_locations() {
        let project_root = unique_test_dir("project-dependency-target-proof");
        let node_modules = project_root.join("node_modules");
        let package_file = node_modules.join("left-pad").join("index.js");
        let non_node_modules = project_root.join("vendor-cache");
        let missing_package_root = unique_test_dir("project-dependency-missing-package");
        let missing_package_node_modules = missing_package_root.join("node_modules");
        let forbidden_base = unique_test_dir("project-dependency-forbidden");
        let forbidden_program_files = forbidden_base.join("Program Files");
        let forbidden_project_root = forbidden_program_files.join("Vendor");
        let forbidden_node_modules = forbidden_project_root.join("node_modules");

        fs::create_dir_all(package_file.parent().expect("dependency package parent"))
            .expect("create dependency package dir");
        fs::write(project_root.join("package.json"), b"{}").expect("write package manifest");
        fs::write(&package_file, b"module.exports = 1;").expect("write dependency file");
        fs::create_dir_all(&non_node_modules).expect("create non node_modules target");
        fs::create_dir_all(&missing_package_node_modules)
            .expect("create missing-package node_modules target");
        fs::create_dir_all(&forbidden_node_modules).expect("create forbidden node_modules target");
        fs::write(forbidden_project_root.join("package.json"), b"{}")
            .expect("write forbidden package manifest");

        assert_eq!(
            project_dependency_target_reject_code(&path_to_string(&node_modules)),
            None,
            "reviewed node_modules under a project manifest should be accepted"
        );
        assert_eq!(
            project_dependency_target_reject_code(&path_to_string(&non_node_modules)),
            Some("target-not-node-modules"),
            "project dependency cleanup must only accept node_modules folders"
        );
        assert_eq!(
            project_dependency_target_reject_code(&path_to_string(&missing_package_node_modules)),
            Some("target-missing-package-json"),
            "node_modules without a project package.json should stay outside the executor"
        );
        assert_eq!(
            project_dependency_target_reject_code(&path_to_string(&forbidden_node_modules)),
            Some("target-forbidden"),
            "node_modules in protected install locations should be blocked"
        );

        let _ = fs::remove_file(&package_file);
        let _ = fs::remove_dir(package_file.parent().expect("dependency package parent"));
        let _ = fs::remove_dir(&node_modules);
        let _ = fs::remove_dir(&non_node_modules);
        let _ = fs::remove_file(project_root.join("package.json"));
        let _ = fs::remove_dir(&project_root);
        let _ = fs::remove_dir(&missing_package_node_modules);
        let _ = fs::remove_dir(&missing_package_root);
        let _ = fs::remove_dir(&forbidden_node_modules);
        let _ = fs::remove_file(forbidden_project_root.join("package.json"));
        let _ = fs::remove_dir(&forbidden_project_root);
        let _ = fs::remove_dir(&forbidden_program_files);
        let _ = fs::remove_dir(&forbidden_base);
    }

    #[test]
    fn project_dependency_deleter_removes_only_reviewed_node_modules() {
        let project_root = unique_test_dir("project-dependency-delete-proof");
        let node_modules = project_root.join("node_modules");
        let dependency_file = node_modules.join("dep").join("index.js");
        let bin_file = node_modules.join(".bin").join("tool.cmd");
        let source_file = project_root.join("src").join("index.js");
        let package_json = project_root.join("package.json");
        let forbidden_base = unique_test_dir("project-dependency-delete-forbidden");
        let forbidden_program_files = forbidden_base.join("Program Files");
        let forbidden_project_root = forbidden_program_files.join("Vendor");
        let forbidden_node_modules = forbidden_project_root.join("node_modules");
        let forbidden_file = forbidden_node_modules.join("dep").join("index.js");

        fs::create_dir_all(dependency_file.parent().expect("dependency parent"))
            .expect("create dependency dir");
        fs::create_dir_all(bin_file.parent().expect("bin parent")).expect("create bin dir");
        fs::create_dir_all(source_file.parent().expect("source parent"))
            .expect("create source dir");
        fs::write(&dependency_file, b"delete dependency").expect("write dependency file");
        fs::write(&bin_file, b"delete bin").expect("write bin file");
        fs::write(&source_file, b"keep source").expect("write source file");
        fs::write(&package_json, b"{}").expect("write package manifest");
        fs::create_dir_all(
            forbidden_file
                .parent()
                .expect("forbidden dependency parent"),
        )
        .expect("create forbidden dependency dir");
        fs::write(forbidden_project_root.join("package.json"), b"{}")
            .expect("write forbidden package manifest");
        fs::write(&forbidden_file, b"keep forbidden dependency")
            .expect("write forbidden dependency file");

        let result = delete_project_dependency_target(&node_modules);

        assert_eq!(
            result.deleted_files, 2,
            "reviewed node_modules files should be deleted"
        );
        assert_eq!(
            result.deleted_bytes, 28,
            "deleted bytes should match removed dependency files"
        );
        assert!(
            !node_modules.exists(),
            "reviewed node_modules directory should be removed"
        );
        assert!(source_file.exists(), "project source files must survive");
        assert!(
            package_json.exists(),
            "project package manifest must survive"
        );

        let skipped = delete_project_dependency_target(&forbidden_node_modules);

        assert_eq!(
            skipped.deleted_files, 0,
            "forbidden node_modules targets must not delete files"
        );
        assert_eq!(
            skipped.skipped_count, 1,
            "forbidden node_modules targets should be counted as skipped"
        );
        assert!(
            forbidden_file.exists(),
            "forbidden node_modules dependency file should survive"
        );

        let _ = fs::remove_file(&dependency_file);
        let _ = fs::remove_file(&bin_file);
        let _ = fs::remove_dir(dependency_file.parent().expect("dependency parent"));
        let _ = fs::remove_dir(bin_file.parent().expect("bin parent"));
        let _ = fs::remove_dir(&node_modules);
        let _ = fs::remove_file(&source_file);
        let _ = fs::remove_dir(source_file.parent().expect("source parent"));
        let _ = fs::remove_file(&package_json);
        let _ = fs::remove_dir(&project_root);
        let _ = fs::remove_file(&forbidden_file);
        let _ = fs::remove_dir(
            forbidden_file
                .parent()
                .expect("forbidden dependency parent"),
        );
        let _ = fs::remove_dir(&forbidden_node_modules);
        let _ = fs::remove_file(forbidden_project_root.join("package.json"));
        let _ = fs::remove_dir(&forbidden_project_root);
        let _ = fs::remove_dir(&forbidden_program_files);
        let _ = fs::remove_dir(&forbidden_base);
    }

    #[test]
    fn npm_cache_deleter_removes_only_old_content_and_tmp_files() {
        let local_app_data = unique_test_dir("npm-delete-proof");
        let root = local_app_data.join("npm-cache").join("_cacache");
        let old_content = root
            .join("content-v2")
            .join("sha512")
            .join("ab")
            .join("blob");
        let old_tmp = root.join("tmp").join("scratch");
        let index_metadata = root.join("index-v5").join("bucket").join("entry");
        let lock_file = root.join("tmp").join("cache.lock");

        fs::create_dir_all(old_content.parent().expect("old content parent"))
            .expect("create old content dir");
        fs::create_dir_all(old_tmp.parent().expect("old tmp parent")).expect("create old tmp dir");
        fs::create_dir_all(index_metadata.parent().expect("index parent"))
            .expect("create index dir");
        fs::write(&old_content, b"delete-content").expect("write old content");
        fs::write(&old_tmp, b"delete-tmp").expect("write old tmp");
        fs::write(&index_metadata, b"keep-index").expect("write index");
        fs::write(&lock_file, b"keep-lock").expect("write lock");

        let _lock = ENV_LOCK.lock().expect("env lock");
        let _restore = EnvRestore::set("LOCALAPPDATA", &local_app_data);
        let old_enough_now = SystemTime::now() + Duration::from_secs(15 * 24 * 60 * 60);

        let result = delete_npm_cache_target_at(&root, old_enough_now);

        assert_eq!(
            result.deleted_files, 2,
            "old npm content and tmp files should be deleted"
        );
        assert_eq!(
            result.deleted_bytes, 24,
            "deleted bytes should match removed file lengths"
        );
        assert!(!old_content.exists(), "old content blob should be removed");
        assert!(!old_tmp.exists(), "old tmp file should be removed");
        assert!(index_metadata.exists(), "index metadata must survive");
        assert!(lock_file.exists(), "lock files must survive");

        let _ = fs::remove_file(&index_metadata);
        let _ = fs::remove_file(&lock_file);
        let _ = fs::remove_dir(index_metadata.parent().expect("index metadata parent"));
        let _ = fs::remove_dir(root.join("index-v5"));
        let _ = fs::remove_dir(root.join("tmp"));
        let _ = fs::remove_dir(root.join("content-v2").join("sha512").join("ab"));
        let _ = fs::remove_dir(root.join("content-v2").join("sha512"));
        let _ = fs::remove_dir(root.join("content-v2"));
        let _ = fs::remove_dir(&root);
        let _ = fs::remove_dir(local_app_data.join("npm-cache"));
        let _ = fs::remove_dir(&local_app_data);
    }

    #[test]
    fn pnpm_store_deleter_removes_only_old_content_and_temp_files() {
        let local_app_data = unique_test_dir("pnpm-delete-proof");
        let root = local_app_data.join("pnpm").join("store");
        let old_content = root.join("v3").join("files").join("ab").join("blob");
        let old_temp = root.join("tmp").join("scratch");
        let metadata_file = root.join("v3").join("files").join("ab").join("metadata");
        let json_file = root.join("files").join("package.json");
        let lock_file = root.join("tmp").join("store.lock");

        fs::create_dir_all(old_content.parent().expect("old content parent"))
            .expect("create old content dir");
        fs::create_dir_all(old_temp.parent().expect("old temp parent"))
            .expect("create old temp dir");
        fs::create_dir_all(json_file.parent().expect("json parent")).expect("create json dir");
        fs::write(&old_content, b"delete-content").expect("write old content");
        fs::write(&old_temp, b"delete-temp").expect("write old temp");
        fs::write(&metadata_file, b"keep-metadata").expect("write metadata");
        fs::write(&json_file, b"keep-json").expect("write json");
        fs::write(&lock_file, b"keep-lock").expect("write lock");

        let _lock = ENV_LOCK.lock().expect("env lock");
        let _restore = EnvRestore::set("LOCALAPPDATA", &local_app_data);
        let old_enough_now = SystemTime::now() + Duration::from_secs(31 * 24 * 60 * 60);

        let result = delete_pnpm_store_target_at(&root, old_enough_now);

        assert_eq!(
            result.deleted_files, 2,
            "old pnpm store content and temp files should be deleted"
        );
        assert_eq!(
            result.deleted_bytes, 25,
            "deleted bytes should match removed file lengths"
        );
        assert!(!old_content.exists(), "old content blob should be removed");
        assert!(!old_temp.exists(), "old temp file should be removed");
        assert!(metadata_file.exists(), "pnpm metadata must survive");
        assert!(json_file.exists(), "pnpm json metadata must survive");
        assert!(lock_file.exists(), "pnpm lock files must survive");

        let _ = fs::remove_file(&metadata_file);
        let _ = fs::remove_file(&json_file);
        let _ = fs::remove_file(&lock_file);
        let _ = fs::remove_dir(metadata_file.parent().expect("metadata parent"));
        let _ = fs::remove_dir(root.join("v3").join("files"));
        let _ = fs::remove_dir(root.join("v3"));
        let _ = fs::remove_dir(root.join("files"));
        let _ = fs::remove_dir(root.join("tmp"));
        let _ = fs::remove_dir(&root);
        let _ = fs::remove_dir(local_app_data.join("pnpm"));
        let _ = fs::remove_dir(&local_app_data);
    }
}
