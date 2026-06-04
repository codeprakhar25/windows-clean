const NATIVE_SCAN_MODE = "native-readonly";

export function getNativeScannerCapability(host = globalThis) {
  const invoke = host?.__TAURI__?.core?.invoke;
  return {
    available: typeof invoke === "function",
    mode: typeof invoke === "function" ? NATIVE_SCAN_MODE : "browser-demo",
    label: typeof invoke === "function" ? "Native read-only scanner" : "Browser demo",
    detail:
      typeof invoke === "function"
        ? "Tauri bridge detected. Real scans can measure known local roots without write commands."
        : "Run the Tauri desktop shell to scan real Windows folders."
  };
}

export async function runNativeReadonlyScan(request = {}, host = globalThis) {
  const capability = getNativeScannerCapability(host);
  if (!capability.available) {
    return {
      available: false,
      mode: capability.mode,
      platform: "browser",
      windows: false,
      volume: null,
      totalBytes: 0,
      findings: [],
      warnings: ["Native scanner is not available in the browser demo."],
      writeCapability: false,
      destructiveCommands: false
    };
  }

  const result = await host.__TAURI__.core.invoke("scan_known_roots", {
    request: {
      protectedPaths: request.protectedPaths || [],
      includeProjectArtifacts: Boolean(request.includeProjectArtifacts),
      maxDepth: request.maxDepth || 8,
      maxEntriesPerRoot: request.maxEntriesPerRoot || 25000
    }
  });

  return normalizeNativeScan(result);
}

export async function runNativeExecutorDryRun(executorPlan, host = globalThis) {
  const capability = getNativeScannerCapability(host);
  if (!capability.available) {
    return {
      available: false,
      mode: "browser-demo",
      realRunEnabled: false,
      destructiveCommands: false,
      entries: [],
      warnings: ["Native executor dry-run is not available in the browser demo."]
    };
  }

  const result = await host.__TAURI__.core.invoke("simulate_cleanup_plan", {
    request: {
      actions: (executorPlan?.rows || [])
        .filter((row) => row.canSimulate)
        .map((row) => ({
          id: row.id,
          title: row.title,
          bytes: row.bytes,
          route: row.route
        }))
    }
  });

  return normalizeNativeExecutorDryRun(result);
}

export async function runNativeWriteBoundary(capsule = {}, host = globalThis) {
  const capability = getNativeScannerCapability(host);
  if (!capability.available) {
    return {
      available: false,
      mode: "browser-demo",
      realRunEnabled: false,
      destructiveCommands: false,
      accepted: false,
      reason: "Native write boundary is not available in the browser demo.",
      entries: [],
      warnings: ["Native write execution is unavailable and real cleanup is disabled."]
    };
  }

  const result = await host.__TAURI__.core.invoke("execute_cleanup_plan", {
    request: {
      planId: capsule.planId || "",
      route: capsule.route?.id || "",
      actions: (capsule.selectedRows || []).map((row) => ({
        id: row.id,
        title: row.title,
        bytes: row.bytes,
        route: capsule.route?.id || row.route || ""
      }))
    }
  });

  return normalizeNativeWriteBoundary(result);
}

export async function getNativeRuntimeCapabilities(host = globalThis) {
  const capability = getNativeScannerCapability(host);
  if (!capability.available) {
    return {
      available: false,
      mode: "browser-demo",
      platform: "browser",
      windows: false,
      elevated: false,
      elevationSource: "browser-demo",
      realRunEnabled: false,
      destructiveCommands: false,
      scanKnownRoots: false,
      simulateCleanupPlan: false,
      executeCleanupPlan: false,
      safeExecutorsEnabled: false,
      reason: "Browser demo cannot perform native scans or cleanup."
    };
  }

  const result = await host.__TAURI__.core.invoke("runtime_capabilities");
  return normalizeNativeRuntimeCapabilities(result);
}

export function mergeNativeScanIntoActions(actionList, scanResult) {
  if (!scanResult?.findings?.length) return actionList;

  const findingsByRecipe = scanResult.findings.reduce((map, finding) => {
    if (!finding.recipeId) return map;
    const rows = map.get(finding.recipeId) || [];
    rows.push(finding);
    map.set(finding.recipeId, rows);
    return map;
  }, new Map());

  return actionList.map((action) => {
    const findings = findingsByRecipe.get(action.id);
    if (!findings) return action;

    const measured = findings.filter((finding) => finding.status === "measured" || finding.status === "limited");
    const bytes = measured.reduce((sum, finding) => sum + Number(finding.bytes || 0), 0);
    const paths = measured.length ? measured.map((finding) => finding.path).filter(Boolean) : findings.map((finding) => finding.path).filter(Boolean);
    const status = measured.some((finding) => finding.status === "limited")
      ? "limited"
      : measured.length
        ? "measured"
        : findings.some((finding) => finding.status === "protected")
          ? "protected"
          : findings.some((finding) => finding.status === "unsupported")
            ? "unsupported"
            : "missing";

    return {
      ...action,
      bytes,
      path: summarizePaths(paths, action.path),
      scanSource: NATIVE_SCAN_MODE,
      scanStatus: status,
      scanFindingCount: findings.length,
      scanWarningCount: findings.reduce((sum, finding) => sum + Number(finding.errors || 0), 0)
    };
  });
}

export function normalizeNativeScan(scanResult = {}) {
  const findings = Array.isArray(scanResult.findings)
    ? scanResult.findings.map((finding) => ({
        recipeId: finding.recipeId || finding.recipe_id || "",
        title: finding.title || "",
        path: finding.path || "",
        bytes: Number(finding.bytes || 0),
        status: finding.status || "unknown",
        files: Number(finding.files || 0),
        dirs: Number(finding.dirs || 0),
        errors: Number(finding.errors || 0),
        note: finding.note || "",
        items: Array.isArray(finding.items)
          ? finding.items.map((item) => ({
              id: item.id || "",
              name: item.name || "",
              path: item.path || "",
              bytes: Number(item.bytes || 0),
              ageDays: Number(item.ageDays || item.age_days || 0),
              kind: item.kind || "filesystem item",
              recommendation: item.recommendation || "review",
              reason: item.reason || item.note || ""
            }))
          : []
      }))
    : [];

  return {
    available: scanResult.available !== false,
    mode: scanResult.mode || NATIVE_SCAN_MODE,
    platform: scanResult.platform || "unknown",
    windows: Boolean(scanResult.windows),
    generatedAt: scanResult.generatedAt || scanResult.generated_at || "",
    volume: normalizeNativeVolume(scanResult.volume),
    totalBytes: Number(scanResult.totalBytes || scanResult.total_bytes || findings.reduce((sum, finding) => sum + finding.bytes, 0)),
    findings,
    warnings: Array.isArray(scanResult.warnings) ? scanResult.warnings : [],
    writeCapability: Boolean(scanResult.writeCapability || scanResult.write_capability),
    destructiveCommands: Boolean(scanResult.destructiveCommands || scanResult.destructive_commands)
  };
}

export function normalizeNativeVolume(volume = null) {
  if (!volume || typeof volume !== "object") return null;
  const totalBytes = Number(volume.totalBytes || volume.total_bytes || 0);
  const freeBytes = Number(volume.freeBytes || volume.free_bytes || 0);
  const usedBytes = Number(volume.usedBytes || volume.used_bytes || Math.max(0, totalBytes - freeBytes));
  if (!totalBytes || !volume.drive) return null;

  return {
    drive: String(volume.drive),
    totalBytes,
    usedBytes,
    freeBytes,
    source: volume.source || "native-volume"
  };
}

export function normalizeNativeExecutorDryRun(result = {}) {
  return {
    available: true,
    mode: result.mode || "native-dry-run",
    realRunEnabled: Boolean(result.realRunEnabled || result.real_run_enabled),
    destructiveCommands: Boolean(result.destructiveCommands || result.destructive_commands),
    entries: Array.isArray(result.entries)
      ? result.entries.map((entry) => ({
          id: entry.id || "",
          title: entry.title || "",
          route: entry.route || "",
          result: entry.result || "dry-run",
          bytes: Number(entry.bytes || 0),
          note: entry.note || ""
        }))
      : [],
    warnings: Array.isArray(result.warnings) ? result.warnings : []
  };
}

export function normalizeNativeWriteBoundary(result = {}) {
  return {
    available: true,
    mode: result.mode || "native-write-rejected",
    realRunEnabled: Boolean(result.realRunEnabled || result.real_run_enabled),
    destructiveCommands: Boolean(result.destructiveCommands || result.destructive_commands),
    accepted: Boolean(result.accepted),
    reason: result.reason || "",
    entries: Array.isArray(result.entries)
      ? result.entries.map((entry) => ({
          id: entry.id || "",
          title: entry.title || "",
          route: entry.route || "",
          result: entry.result || "rejected",
          bytes: Number(entry.bytes || 0),
          note: entry.note || ""
        }))
      : [],
    warnings: Array.isArray(result.warnings) ? result.warnings : []
  };
}

export function normalizeNativeRuntimeCapabilities(result = {}) {
  return {
    available: true,
    mode: result.mode || "native-readonly",
    platform: result.platform || "unknown",
    windows: Boolean(result.windows),
    elevated: Boolean(result.elevated),
    elevationSource: result.elevationSource || result.elevation_source || "",
    realRunEnabled: Boolean(result.realRunEnabled || result.real_run_enabled),
    destructiveCommands: Boolean(result.destructiveCommands || result.destructive_commands),
    scanKnownRoots: Boolean(result.scanKnownRoots || result.scan_known_roots),
    simulateCleanupPlan: Boolean(result.simulateCleanupPlan || result.simulate_cleanup_plan),
    executeCleanupPlan: Boolean(result.executeCleanupPlan || result.execute_cleanup_plan),
    safeExecutorsEnabled: Boolean(result.safeExecutorsEnabled || result.safe_executors_enabled),
    reason: result.reason || ""
  };
}

function summarizePaths(paths, fallback) {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  if (uniquePaths.length === 0) return fallback;
  if (uniquePaths.length <= 2) return uniquePaths.join(", ");
  return `${uniquePaths.slice(0, 2).join(", ")} +${uniquePaths.length - 2} more`;
}
