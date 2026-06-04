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
}

impl Default for ScanRequest {
    fn default() -> Self {
        Self {
            protected_paths: Vec::new(),
            include_project_artifacts: true,
            max_depth: Some(8),
            max_entries_per_root: Some(25_000),
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
    generated_at: String,
    volume: Option<VolumeInfo>,
    total_bytes: u64,
    findings: Vec<ScanFinding>,
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
    result: String,
    bytes: u64,
    note: String,
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
    safe_executors_enabled: bool,
    reason: String,
}

#[derive(Clone, Copy)]
enum MeasureKind {
    FullTree,
    DownloadInstallers,
    LargeUserFiles,
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
            runtime_capabilities
        ])
        .run(tauri::generate_context!())
        .expect("failed to run SpaceGuard");
}

#[tauri::command]
fn scan_known_roots(request: Option<ScanRequest>) -> ScanResponse {
    let request = request.unwrap_or_default();
    let mut warnings = Vec::new();

    if !cfg!(target_os = "windows") {
        warnings.push(
            "This scanner is intended for Windows. Non-Windows runs are for development only."
                .to_string(),
        );
    }

    let mut findings = Vec::new();

    for spec in exact_specs() {
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

    if request.include_project_artifacts {
        findings.extend(measure_node_modules_roots(&request, &mut warnings));
    }

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
        generated_at: generated_at(),
        volume: primary_volume_info(),
        total_bytes,
        findings,
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
        .into_iter()
        .map(|action| DryRunEntry {
            id: action.id,
            title: action.title,
            route: action.route,
            result: "dry-run".to_string(),
            bytes: action.bytes,
            note: "Native dry-run only. No filesystem mutation was attempted.".to_string(),
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
fn runtime_capabilities() -> RuntimeCapabilities {
    RuntimeCapabilities {
        mode: "native-readonly",
        platform: env::consts::OS.to_string(),
        windows: cfg!(target_os = "windows"),
        elevated: is_process_elevated(),
        elevation_source: elevation_source(),
        real_run_enabled: false,
        destructive_commands: false,
        scan_known_roots: true,
        simulate_cleanup_plan: true,
        safe_executors_enabled: false,
        reason: "Real executors are disabled until Windows VM validation and rollback tests pass."
            .to_string(),
    }
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

#[cfg(target_os = "windows")]
fn primary_volume_info() -> Option<VolumeInfo> {
    let drive = env::var("SystemDrive").unwrap_or_else(|_| "C:".to_string());
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
fn primary_volume_info() -> Option<VolumeInfo> {
    None
}

fn exact_specs() -> Vec<ExactSpec> {
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
                "C:\\Windows\\Temp",
            ),
            ("recycle-bin", "Recycle Bin", "C:\\$Recycle.Bin"),
            (
                "windows-old",
                "Previous Windows installation",
                "C:\\Windows.old",
            ),
            (
                "hibernation",
                "Disable hibernation file",
                "C:\\hiberfil.sys",
            ),
            ("pagefile", "Pagefile size changes", "C:\\pagefile.sys"),
        ] {
            specs.push(ExactSpec {
                recipe_id,
                title,
                path: PathBuf::from(path),
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
    recipe_id: &'static str,
    title: &'static str,
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
        "node-modules-old" => vec![ScanItem {
            id: stable_item_id(recipe_id, root),
            name: root
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("node_modules")
                .to_string(),
            path: path_to_string(root),
            bytes: stats.bytes,
            age_days: path_age_days(root).unwrap_or(0),
            kind: "project dependency folder".to_string(),
            recommendation: if path_age_days(root).unwrap_or(0) >= 60 {
                "review".to_string()
            } else {
                "keep".to_string()
            },
            reason: "Dependency folder can be recreated, but the parent project should be checked first.".to_string(),
        }],
        "android-studio" => top_child_items(recipe_id, root, request, 10),
        _ => Vec::new(),
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
