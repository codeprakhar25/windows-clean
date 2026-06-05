#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

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

#[derive(Debug, Serialize)]
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
    items: Vec<ScanItem>,
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
struct DryRunRequest {
    actions: Vec<DryRunAction>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DryRunAction {
    id: String,
    title: String,
    bytes: u64,
    route: String,
    target_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DryRunResponse {
    mode: &'static str,
    real_run_enabled: bool,
    destructive_commands: bool,
    entries: Vec<DryRunEntry>,
    warnings: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DryRunEntry {
    id: String,
    title: String,
    route: String,
    target_path: String,
    target_scope_status: String,
    reject_code: String,
    result: String,
    bytes: u64,
    candidate_bytes: u64,
    candidate_count: u64,
    skipped_count: u64,
    candidates: Vec<DryRunCandidate>,
    note: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DryRunCandidate {
    name: String,
    path: String,
    bytes: u64,
    result: String,
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
    warnings: Vec<String>,
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
    simulate_cleanup_plan: bool,
    execute_cleanup_plan: bool,
    safe_executors_enabled: bool,
    executor_flags: ExecutorFeatureFlags,
    reason: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExecutorFeatureFlags {
    temp_cleanup_executor: bool,
    project_dependency_executor: bool,
    recycle_bin_executor: bool,
    browser_cache_executor: bool,
    tool_native_prune_executors: bool,
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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            scan_known_roots,
            simulate_cleanup_plan,
            execute_cleanup_plan,
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

    findings.push(unsupported_finding(
        "docker-build-cache",
        "Docker build cache",
        "Docker Desktop",
        "Requires Docker CLI inventory before cleanup. Folder size is not used because it can mix cache, images, and volumes.",
    ));
    findings.push(unsupported_finding(
        "steam-shader-cache",
        "Game shader and launcher caches",
        "Game launchers",
        "Launcher-specific cache roots are intentionally not guessed in the first native scanner.",
    ));
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
fn simulate_cleanup_plan(request: Option<DryRunRequest>) -> DryRunResponse {
    let request = request.unwrap_or(DryRunRequest {
        actions: Vec::new(),
    });
    let entries = request
        .actions
        .iter()
        .map(|action| {
            let manifest = build_dry_run_candidate_manifest(action);
            DryRunEntry {
                id: action.id.clone(),
                title: action.title.clone(),
                route: action.route.clone(),
                target_path: action.target_path.clone().unwrap_or_default(),
                target_scope_status: manifest.target_scope_status,
                reject_code: manifest.reject_code,
                result: "dry-run".to_string(),
                bytes: action.bytes,
                candidate_bytes: manifest.candidate_bytes,
                candidate_count: manifest.candidate_count,
                skipped_count: manifest.skipped_count,
                candidates: manifest.candidates,
                note: manifest.note,
            }
        })
        .collect::<Vec<_>>();

    DryRunResponse {
        mode: "native-dry-run",
        real_run_enabled: false,
        destructive_commands: false,
        entries,
        warnings: vec![
            "Real cleanup is disabled until Windows validation and rollback tests exist."
                .to_string(),
        ],
    }
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
        actions: Vec::new(),
    });
    if request.request_mode.as_deref() == Some("execute-first-safe") {
        return execute_first_safe_temp_cleanup(request);
    }
    if request.request_mode.as_deref() == Some("execute-project-deps") {
        return execute_project_dependency_cleanup(request);
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

    WriteExecutionResponse {
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
        warnings,
    }
}

fn execute_first_safe_temp_cleanup(request: WriteExecutionRequest) -> WriteExecutionResponse {
    let route = request.route.clone();
    let plan_id = request.plan_id.clone();
    let expected_bytes = request
        .expected_bytes
        .unwrap_or_else(|| request.actions.iter().map(|action| action.bytes).sum());
    let flag_enabled = temp_executor_enabled();
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
                            "Only known-temp-delete can execute in this first real executor."
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
        warnings,
    }
}

fn execute_project_dependency_cleanup(request: WriteExecutionRequest) -> WriteExecutionResponse {
    let route = request.route.clone();
    let plan_id = request.plan_id.clone();
    let expected_bytes = request
        .expected_bytes
        .unwrap_or_else(|| request.actions.iter().map(|action| action.bytes).sum());
    let flag_enabled = project_dependency_executor_enabled();
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
            "Windows fixture validation, rollback/rescan proof, and release review must pass before mutation can be considered.",
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
            | "browser-cache-only"
            | "item-review-project-cache"
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
        _ => None,
    }
}

fn write_executor_scaffold_reject_code(route: &str) -> &'static str {
    match route {
        "known-temp-delete" => "temp-executor-feature-flag-disabled",
        "item-review-project-cache" => "project-deps-executor-disabled",
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
        "browser-cache-only" => {
            target.contains("cookie")
                || target.contains("session")
                || target.contains("login")
                || target.contains("password")
                || target.contains("extension")
                || target.contains("identity")
                || target.contains("profile database")
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
        "browser-cache-only" => {
            target.contains("\\cache") || target.contains("cache2") || target.contains("code cache")
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
        "target-not-node-modules" => "Write request rejected: project dependency target is not node_modules.",
        "target-link-or-not-directory" => "Write request rejected: project dependency target is link-like or not a directory.",
        "target-missing-package-json" => "Write request rejected: parent project package.json is missing.",
        "no-actions" => "Write request rejected: no selected actions were supplied.",
        _ => "Write request rejected by native boundary validation.",
    }
}

fn temp_executor_enabled() -> bool {
    env::var("SPACEGUARD_ENABLE_TEMP_EXECUTOR")
        .map(|value| {
            matches!(
                value.to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(false)
}

fn project_dependency_executor_enabled() -> bool {
    env::var("SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR")
        .map(|value| {
            matches!(
                value.to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(false)
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

#[tauri::command]
fn runtime_capabilities() -> RuntimeCapabilities {
    let temp_enabled = cfg!(target_os = "windows") && temp_executor_enabled();
    let project_dependency_enabled =
        cfg!(target_os = "windows") && project_dependency_executor_enabled();
    let real_execution_enabled = temp_enabled || project_dependency_enabled;
    RuntimeCapabilities {
        mode: if real_execution_enabled { "native-scoped-write" } else { "native-readonly" },
        platform: env::consts::OS.to_string(),
        windows: cfg!(target_os = "windows"),
        elevated: is_process_elevated(),
        elevation_source: elevation_source(),
        real_run_enabled: real_execution_enabled,
        destructive_commands: real_execution_enabled,
        scan_known_roots: true,
        simulate_cleanup_plan: true,
        execute_cleanup_plan: true,
        safe_executors_enabled: real_execution_enabled,
        executor_flags: ExecutorFeatureFlags {
            temp_cleanup_executor: temp_enabled,
            project_dependency_executor: project_dependency_enabled,
            recycle_bin_executor: false,
            browser_cache_executor: false,
            tool_native_prune_executors: false,
        },
        reason: if temp_enabled && project_dependency_enabled {
            "Scoped temp and project dependency executors are enabled by environment flags."
        } else if temp_enabled {
            "First-safe temp cleanup executor is enabled by SPACEGUARD_ENABLE_TEMP_EXECUTOR."
        } else if project_dependency_enabled {
            "Reviewed project dependency executor is enabled by SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR."
        } else {
            "Real executors are disabled until a scoped executor flag is enabled on Windows."
        }
        .to_string(),
    }
}

struct DryRunCandidateManifest {
    target_scope_status: String,
    reject_code: String,
    candidate_bytes: u64,
    candidate_count: u64,
    skipped_count: u64,
    candidates: Vec<DryRunCandidate>,
    note: String,
}

fn build_dry_run_candidate_manifest(action: &DryRunAction) -> DryRunCandidateManifest {
    if !is_first_safe_write_route(&action.route) {
        return DryRunCandidateManifest {
            target_scope_status: "route-blocked".to_string(),
            reject_code: "route-not-first-safe".to_string(),
            candidate_bytes: 0,
            candidate_count: 0,
            skipped_count: 0,
            candidates: Vec::new(),
            note: "Native dry-run only. This route has no file-level candidate manifest in the current build.".to_string(),
        };
    }

    if let Some(reject_code) = write_action_target_reject_code(&action.route, &action.target_path) {
        return DryRunCandidateManifest {
            target_scope_status: "target-blocked".to_string(),
            reject_code: reject_code.to_string(),
            candidate_bytes: 0,
            candidate_count: 0,
            skipped_count: 1,
            candidates: Vec::new(),
            note: format!(
                "Native dry-run only. Target scope was rejected with code {reject_code}; no candidate files were enumerated."
            ),
        };
    }

    let targets = split_dry_run_targets(action.target_path.as_deref().unwrap_or(""));
    let mut candidates = Vec::new();
    let mut skipped_count = 0_u64;
    let mut candidate_bytes = 0_u64;

    for target in targets {
        if candidates.len() >= 8 {
            break;
        }
        let path = resolve_dry_run_target(&target);
        if !path.exists() {
            skipped_count += 1;
            continue;
        }

        let remaining = 8usize.saturating_sub(candidates.len());
        let mut sample = collect_dry_run_candidates(&path, remaining);
        skipped_count = skipped_count.saturating_add(sample.skipped_count);
        candidate_bytes = candidate_bytes.saturating_add(sample.candidate_bytes);
        candidates.append(&mut sample.candidates);
    }

    let candidate_count = candidates.len() as u64;
    DryRunCandidateManifest {
        target_scope_status: "target-allowed".to_string(),
        reject_code: String::new(),
        candidate_bytes,
        candidate_count,
        skipped_count,
        candidates,
        note: format!(
            "Native dry-run only. Candidate manifest sampled {candidate_count} item(s), skipped {skipped_count} inaccessible, missing, or link-like target(s), and attempted no mutation."
        ),
    }
}

struct DryRunCandidateSample {
    candidate_bytes: u64,
    skipped_count: u64,
    candidates: Vec<DryRunCandidate>,
}

fn collect_dry_run_candidates(root: &Path, limit: usize) -> DryRunCandidateSample {
    let mut queue = VecDeque::from([root.to_path_buf()]);
    let mut candidates = Vec::new();
    let mut candidate_bytes = 0_u64;
    let mut skipped_count = 0_u64;
    let mut visited = 0usize;

    while let Some(path) = queue.pop_front() {
        if visited >= 500 || candidates.len() >= limit {
            break;
        }
        visited += 1;

        let Ok(metadata) = fs::symlink_metadata(&path) else {
            skipped_count += 1;
            continue;
        };
        if metadata.file_type().is_symlink() {
            skipped_count += 1;
            continue;
        }
        if metadata.is_file() {
            let bytes = metadata.len();
            candidate_bytes = candidate_bytes.saturating_add(bytes);
            candidates.push(DryRunCandidate {
                name: path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("file")
                    .to_string(),
                path: path_to_string(&path),
                bytes,
                result: "candidate".to_string(),
                note:
                    "Would be eligible for first-safe dry-run preview only; no deletion attempted."
                        .to_string(),
            });
            continue;
        }
        if metadata.is_dir() {
            match fs::read_dir(&path) {
                Ok(entries) => {
                    for entry in entries.flatten() {
                        queue.push_back(entry.path());
                    }
                }
                Err(_) => skipped_count += 1,
            }
        }
    }

    DryRunCandidateSample {
        candidate_bytes,
        skipped_count,
        candidates,
    }
}

fn split_dry_run_targets(value: &str) -> Vec<String> {
    value
        .split(',')
        .map(|target| target.trim())
        .filter(|target| !target.is_empty())
        .map(|target| target.to_string())
        .collect()
}

fn resolve_dry_run_target(value: &str) -> PathBuf {
    let upper = value.to_ascii_uppercase();
    if let Some(suffix) = env_token_suffix(&upper, value, "%TEMP%") {
        return env_path_with_suffix("TEMP", suffix)
            .or_else(|| env_path_with_suffix("TMP", suffix))
            .unwrap_or_else(|| PathBuf::from(value));
    }
    if let Some(suffix) = env_token_suffix(&upper, value, "%TMP%") {
        return env_path_with_suffix("TMP", suffix)
            .or_else(|| env_path_with_suffix("TEMP", suffix))
            .unwrap_or_else(|| PathBuf::from(value));
    }
    if let Some(suffix) = env_token_suffix(&upper, value, "%LOCALAPPDATA%") {
        return env_path_with_suffix("LOCALAPPDATA", suffix)
            .unwrap_or_else(|| PathBuf::from(value));
    }
    if let Some(suffix) = env_token_suffix(&upper, value, "%USERPROFILE%") {
        return env_path_with_suffix("USERPROFILE", suffix)
            .or_else(|| env_path_with_suffix("HOME", suffix))
            .unwrap_or_else(|| PathBuf::from(value));
    }
    PathBuf::from(value)
}

fn env_token_suffix<'a>(upper: &str, value: &'a str, token: &str) -> Option<&'a str> {
    if upper.starts_with(token) {
        Some(&value[token.len()..])
    } else {
        None
    }
}

fn env_path_with_suffix(name: &str, suffix: &str) -> Option<PathBuf> {
    env_path(name).map(|root| {
        let suffix = suffix.trim_start_matches(|ch| ch == '\\' || ch == '/');
        if suffix.is_empty() {
            root
        } else {
            root.join(suffix)
        }
    })
}

#[cfg(target_os = "windows")]
#[link(name = "shell32")]
extern "system" {
    fn IsUserAnAdmin() -> i32;
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
            path: local.join("npm-cache"),
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
            }
        }
    }

    findings
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
                items.push(installed_app_scan_item(&path, stats.bytes));
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
            "Read-only installed app footprint discovery with depth, entry, and candidate caps. Modification age is a weak signal, not proof of app usage."
                .to_string()
        } else {
            "Read-only installed app footprint discovery. Modification age is a weak signal; uninstall decisions stay manual."
                .to_string()
        },
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

fn installed_app_scan_item(path: &Path, bytes: u64) -> ScanItem {
    let age_days = path_age_days(path).unwrap_or(0);
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("installed app");
    let recommendation = if bytes >= 1024 * 1024 * 1024 && age_days >= 45 {
        "review"
    } else {
        "keep"
    };
    let kind = installed_app_kind(name, path);

    ScanItem {
        id: stable_item_id("installed-app-footprints", path),
        name: name.to_string(),
        path: path_to_string(path),
        bytes,
        age_days,
        kind: kind.to_string(),
        recommendation: recommendation.to_string(),
        reason: if recommendation == "review" {
            format!(
                "Large app footprint last modified about {age_days} day(s) ago. Treat this as an uninstall review hint only; use Windows Settings or the vendor uninstaller."
            )
        } else {
            "Recent, small, or ambiguous app footprint. Keep unless the user recognizes it as unused."
                .to_string()
        },
    }
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

    let candidates = ["Code", "source", "Documents", "dev"]
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
            items: Vec::new(),
        };
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
    let package_lower = package_text.to_ascii_lowercase();
    let has_package_json = package_json.exists();
    let has_lockfile = [
        "package-lock.json",
        "pnpm-lock.yaml",
        "yarn.lock",
        "bun.lockb",
    ]
    .iter()
    .any(|name| project_root.join(name).exists());
    let expo_hint = package_lower.contains("\"expo\"") || package_lower.contains("expo-router");
    let react_native_hint = package_lower.contains("react-native");
    let recommendation = if has_package_json && age_days >= 60 {
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
    if has_package_json {
        signals.push("package.json".to_string());
    }
    if has_lockfile {
        signals.push("lockfile".to_string());
    }
    if expo_hint {
        signals.push("expo".to_string());
    }
    if react_native_hint {
        signals.push("react-native".to_string());
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
                "Rebuildable dependency folder is about {age_days} day(s) old; signals: {}.",
                signals.join(", ")
            )
        } else if !has_package_json {
            "Dependency folder has no readable parent package.json; keep until the project is inspected.".to_string()
        } else {
            format!(
                "Project dependency folder is recent or ambiguous; signals: {}.",
                signals.join(", ")
            )
        },
    }
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
    let modified = fs::metadata(path).ok()?.modified().ok()?;
    let elapsed = SystemTime::now().duration_since(modified).ok()?;
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

fn generated_at() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    format!("unix:{seconds}")
}
