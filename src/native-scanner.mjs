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
  const normalizedRequest = normalizeNativeScanRequest(request);
  if (!capability.available) {
    return {
      available: false,
      mode: capability.mode,
      platform: "browser",
      windows: false,
      targetDrive: normalizedRequest.targetDrive,
      request: normalizedRequest,
      volume: null,
      totalBytes: 0,
      findings: [],
      driveInventory: [],
      warnings: ["Native scanner is not available in the browser demo."],
      writeCapability: false,
      destructiveCommands: false
    };
  }

  const result = await host.__TAURI__.core.invoke("scan_known_roots", {
    request: {
      protectedPaths: normalizedRequest.protectedPaths,
      includeProjectArtifacts: normalizedRequest.includeProjectArtifacts,
      maxDepth: normalizedRequest.maxDepth,
      maxEntriesPerRoot: normalizedRequest.maxEntriesPerRoot,
      targetDrive: normalizedRequest.targetDrive,
      customRoots: normalizedRequest.customRoots
    }
  });

  return {
    ...normalizeNativeScan(result),
    request: normalizedRequest
  };
}

function normalizeTargetDriveRequest(value = "C:") {
  const raw = String(value || "").trim();
  const match = raw.match(/^([a-zA-Z])(?::)?(?:\\)?$/);
  if (!match) return "C:";
  return `${match[1].toUpperCase()}:`;
}

function normalizeCustomRootRequest(customRoots = []) {
  if (!Array.isArray(customRoots)) return [];
  const seen = new Set();
  const roots = [];
  for (const value of customRoots) {
    const root = String(value || "").trim();
    const key = root.toLowerCase();
    if (!root || seen.has(key)) continue;
    seen.add(key);
    roots.push(root);
    if (roots.length >= 8) break;
  }
  return roots;
}

function normalizeNativeScanRequest(request = {}) {
  const source = request && typeof request === "object" ? request : {};
  return {
    protectedPaths: normalizeRequestStringList(source.protectedPaths || source.protected_paths),
    includeProjectArtifacts: Boolean(source.includeProjectArtifacts ?? source.include_project_artifacts ?? true),
    maxDepth: Number(source.maxDepth || source.max_depth || 8),
    maxEntriesPerRoot: Number(source.maxEntriesPerRoot || source.max_entries_per_root || 25000),
    targetDrive: normalizeTargetDriveRequest(source.targetDrive || source.target_drive || "C:"),
    customRoots: normalizeCustomRootRequest(source.customRoots || source.custom_roots)
  };
}

function normalizeRequestStringList(values = []) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const rows = [];
  for (const value of values) {
    const row = String(value || "").trim();
    const key = row.toLowerCase();
    if (!row || seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  return rows;
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
        .flatMap((row) => {
          if (Array.isArray(row.reviewTargets) && row.reviewTargets.length) {
            return row.reviewTargets.map((target) => ({
              id: target.id || row.id,
              title: target.name || row.title,
              bytes: Number(target.bytes || 0),
              route: row.route,
              targetPath: target.path || ""
            }));
          }
          return [{
            id: row.id,
            title: row.title,
            bytes: row.bytes,
            route: row.route,
            targetPath: row.targetPath || row.target || row.path || ""
          }];
        })
    }
  });

  return normalizeNativeExecutorDryRun(result);
}

export async function runNativeDryRunScopeValidation(host = globalThis) {
  const capability = getNativeScannerCapability(host);
  if (!capability.available) {
    return {
      available: false,
      mode: "browser-demo",
      realRunEnabled: false,
      destructiveCommands: false,
      entries: [],
      warnings: ["Native dry-run scope validation is not available in the browser demo."]
    };
  }

  const result = await host.__TAURI__.core.invoke("simulate_cleanup_plan", {
    request: {
      actions: [
        {
          id: "windows-temp",
          title: "Known temp allowed target",
          bytes: 0,
          route: "known-temp-delete",
          targetPath: "%TEMP%, C:\\Windows\\Temp"
        },
        {
          id: "downloads-forbidden-as-temp",
          title: "Downloads forbidden as temp target",
          bytes: 0,
          route: "known-temp-delete",
          targetPath: "%USERPROFILE%\\Downloads"
        },
        {
          id: "browser-identity-forbidden",
          title: "Browser identity forbidden as cache target",
          bytes: 0,
          route: "browser-cache-only",
          targetPath: "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\Cookies"
        }
      ]
    }
  });

  return normalizeNativeExecutorDryRun(result);
}

export async function runNativeWriteBoundary(boundary = {}, host = globalThis) {
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
  const capsule = boundary.capsule || boundary.realExecutorCapsule || boundary;
  const contract = boundary.contract || boundary.firstSafeExecutorContract || (boundary.schemaVersion === "spaceguard-first-safe-executor-contract/v1" ? boundary : null);
  const preview = contract?.requestPreview || {};
  const route = preview.route || capsule.route?.id || "";
  const rows = Array.isArray(preview.actions) && preview.actions.length ? preview.actions : capsule.selectedRows || [];
  const expectedBytes = Number(preview.expectedBytes ?? rows.reduce((sum, row) => sum + Number(row.bytes || 0), 0));

  const result = await host.__TAURI__.core.invoke("execute_cleanup_plan", {
    request: {
      schemaVersion: contract?.schemaVersion || "spaceguard-write-boundary-request/v1",
      requestMode: preview.mode || "capsule-probe",
      planId: preview.planId || boundary.planId || capsule.planId || "",
      route,
      scanFingerprint: preview.scanFingerprint || "",
      consentPlanId: preview.consentPlanId || "",
      expectedBytes,
      dryRunOnly: preview.dryRunOnly !== false,
      mutationAttempted: Boolean(preview.mutationAttempted),
      actions: rows.map((row) => ({
        id: row.id,
        title: row.title,
        bytes: Number(row.bytes || 0),
        route: route || row.route || "",
        targetPath: row.targetPath || row.target || row.path || ""
      }))
    }
  });

  return normalizeNativeWriteBoundary(result);
}

export async function runNativeTempCleanupExecutor(boundary = {}, host = globalThis) {
  const capability = getNativeScannerCapability(host);
  if (!capability.available) {
    return {
      available: false,
      mode: "browser-demo",
      realRunEnabled: false,
      destructiveCommands: false,
      accepted: false,
      reason: "Native temp cleanup executor is not available in the browser demo.",
      entries: [],
      warnings: ["Run the Tauri desktop shell before executing cleanup."]
    };
  }

  const capsule = boundary.capsule || boundary.realExecutorCapsule || boundary;
  const contract = boundary.contract || boundary.firstSafeExecutorContract || (boundary.schemaVersion === "spaceguard-first-safe-executor-contract/v1" ? boundary : null);
  const preview = contract?.requestPreview || {};
  const route = preview.route || capsule.route?.id || "known-temp-delete";
  const rows = Array.isArray(preview.actions) && preview.actions.length ? preview.actions : capsule.selectedRows || [];
  const expectedBytes = Number(preview.expectedBytes ?? rows.reduce((sum, row) => sum + Number(row.bytes || 0), 0));

  const result = await host.__TAURI__.core.invoke("execute_cleanup_plan", {
    request: {
      schemaVersion: contract?.schemaVersion || "spaceguard-write-boundary-request/v1",
      requestMode: "execute-first-safe",
      planId: preview.planId || boundary.planId || capsule.planId || "",
      route,
      scanFingerprint: preview.scanFingerprint || "",
      consentPlanId: preview.consentPlanId || "",
      expectedBytes,
      dryRunOnly: false,
      mutationAttempted: true,
      actions: rows.map((row) => ({
        id: row.id,
        title: row.title,
        bytes: Number(row.bytes || 0),
        route: route || row.route || "",
        targetPath: row.targetPath || row.target || row.path || ""
      }))
    }
  });

  return normalizeNativeWriteBoundary(result);
}

export async function runNativeProjectDependencyExecutor(boundary = {}, host = globalThis) {
  const capability = getNativeScannerCapability(host);
  if (!capability.available) {
    return {
      available: false,
      mode: "browser-demo",
      realRunEnabled: false,
      destructiveCommands: false,
      accepted: false,
      reason: "Native project dependency executor is not available in the browser demo.",
      entries: [],
      warnings: ["Run the Tauri desktop shell before executing cleanup."]
    };
  }

  const rows = boundary.rows || boundary.selectedRows || [];
  const reviewTargets = rows.flatMap((row) =>
    Array.isArray(row.reviewTargets)
      ? row.reviewTargets.map((target) => ({
          id: target.id || row.id,
          title: target.name || row.title,
          bytes: Number(target.bytes || 0),
          route: "item-review-project-cache",
          targetPath: target.path || ""
        }))
      : []
  );
  const expectedBytes = Number(boundary.expectedBytes ?? reviewTargets.reduce((sum, row) => sum + Number(row.bytes || 0), 0));

  const result = await host.__TAURI__.core.invoke("execute_cleanup_plan", {
    request: {
      schemaVersion: "spaceguard-project-deps-request/v1",
      requestMode: "execute-project-deps",
      planId: boundary.planId || "",
      route: "item-review-project-cache",
      scanFingerprint: boundary.scanFingerprint || "",
      consentPlanId: boundary.consentPlanId || "",
      expectedBytes,
      dryRunOnly: false,
      mutationAttempted: true,
      actions: reviewTargets
    }
  });

  return normalizeNativeWriteBoundary(result);
}

export async function runNativeDownloadsCleanupExecutor(boundary = {}, host = globalThis) {
  const capability = getNativeScannerCapability(host);
  if (!capability.available) {
    return {
      available: false,
      mode: "browser-demo",
      realRunEnabled: false,
      destructiveCommands: false,
      accepted: false,
      reason: "Native reviewed Downloads executor is not available in the browser demo.",
      entries: [],
      warnings: ["Run the Tauri desktop shell before executing reviewed Downloads cleanup."]
    };
  }

  const rows = boundary.rows || boundary.selectedRows || [];
  const reviewTargets = rows.flatMap((row) =>
    Array.isArray(row.reviewTargets)
      ? row.reviewTargets.map((target) => ({
          id: target.id || row.id,
          title: target.name || row.title,
          bytes: Number(target.bytes || 0),
          route: "item-review-recycle-bin",
          targetPath: target.path || ""
        }))
      : []
  );
  const expectedBytes = Number(boundary.expectedBytes ?? reviewTargets.reduce((sum, row) => sum + Number(row.bytes || 0), 0));

  const result = await host.__TAURI__.core.invoke("execute_cleanup_plan", {
    request: {
      schemaVersion: "spaceguard-downloads-recycle-bin-request/v1",
      requestMode: "execute-downloads-recycle-bin",
      planId: boundary.planId || "",
      route: "item-review-recycle-bin",
      scanFingerprint: boundary.scanFingerprint || "",
      consentPlanId: boundary.consentPlanId || "",
      expectedBytes,
      dryRunOnly: false,
      mutationAttempted: true,
      actions: reviewTargets
    }
  });

  return normalizeNativeWriteBoundary(result);
}

export async function runNativeLargeFileArchiveExecutor(boundary = {}, host = globalThis) {
  const capability = getNativeScannerCapability(host);
  if (!capability.available) {
    return {
      available: false,
      mode: "browser-demo",
      realRunEnabled: false,
      destructiveCommands: false,
      accepted: false,
      reason: "Native reviewed large-file archive executor is not available in the browser demo.",
      entries: [],
      warnings: ["Run the Tauri desktop shell before archiving reviewed large files."]
    };
  }

  const rows = boundary.rows || boundary.selectedRows || [];
  const archiveTargets = rows.flatMap((row) =>
    Array.isArray(row.archiveTargets)
      ? row.archiveTargets.map((target) => ({
          id: target.id || row.id,
          title: target.name || row.title,
          bytes: Number(target.bytes || 0),
          route: "item-review-large-files",
          targetPath: target.path || ""
        }))
      : []
  );
  const expectedBytes = Number(boundary.expectedBytes ?? archiveTargets.reduce((sum, row) => sum + Number(row.bytes || 0), 0));

  const result = await host.__TAURI__.core.invoke("execute_cleanup_plan", {
    request: {
      schemaVersion: "spaceguard-large-file-archive-request/v1",
      requestMode: "execute-large-file-archive",
      planId: boundary.planId || "",
      route: "item-review-large-files",
      scanFingerprint: boundary.scanFingerprint || "",
      consentPlanId: boundary.consentPlanId || "",
      expectedBytes,
      dryRunOnly: false,
      mutationAttempted: true,
      archiveDestination: boundary.archiveDestination || "",
      actions: archiveTargets
    }
  });

  return normalizeNativeWriteBoundary(result);
}

export async function runNativeBrowserCacheExecutor(boundary = {}, host = globalThis) {
  const capability = getNativeScannerCapability(host);
  if (!capability.available) {
    return {
      available: false,
      mode: "browser-demo",
      realRunEnabled: false,
      destructiveCommands: false,
      accepted: false,
      reason: "Native browser cache executor is not available in the browser demo.",
      entries: [],
      warnings: ["Run the Tauri desktop shell before executing browser cache cleanup."]
    };
  }

  const rows = boundary.rows || boundary.selectedRows || [];
  const cacheTargets = rows
    .filter((row) => row && (row.path || row.targetPath || row.target))
    .map((row, index) => ({
      id: row.id || `browser-cache-${index + 1}`,
      title: row.title || row.name || "Browser cache root",
      bytes: Number(row.bytes || 0),
      route: "browser-cache-only",
      targetPath: row.targetPath || row.target || row.path || ""
    }));
  const expectedBytes = Number(boundary.expectedBytes ?? cacheTargets.reduce((sum, row) => sum + Number(row.bytes || 0), 0));

  const result = await host.__TAURI__.core.invoke("execute_cleanup_plan", {
    request: {
      schemaVersion: "spaceguard-browser-cache-request/v1",
      requestMode: "execute-browser-cache",
      planId: boundary.planId || "",
      route: "browser-cache-only",
      scanFingerprint: boundary.scanFingerprint || "",
      consentPlanId: boundary.consentPlanId || "",
      expectedBytes,
      dryRunOnly: false,
      mutationAttempted: true,
      actions: cacheTargets
    }
  });

  return normalizeNativeWriteBoundary(result);
}

export async function runNativeGradleCacheExecutor(boundary = {}, host = globalThis) {
  const capability = getNativeScannerCapability(host);
  if (!capability.available) {
    return {
      available: false,
      mode: "browser-demo",
      realRunEnabled: false,
      destructiveCommands: false,
      accepted: false,
      reason: "Native Gradle cache executor is not available in the browser demo.",
      entries: [],
      warnings: ["Run the Tauri desktop shell before executing Gradle cache cleanup."]
    };
  }

  const row = boundary.row || boundary.selectedRow || {};
  const targetPath = row.targetPath || row.target || row.path || "";
  const action = {
    id: row.id || "gradle-cache",
    title: row.title || "Gradle dependency and build cache",
    bytes: Number(row.bytes || boundary.expectedBytes || 0),
    route: "bounded-cache-delete",
    targetPath
  };
  const expectedBytes = Number(boundary.expectedBytes ?? action.bytes);

  const result = await host.__TAURI__.core.invoke("execute_cleanup_plan", {
    request: {
      schemaVersion: "spaceguard-gradle-cache-request/v1",
      requestMode: "execute-gradle-cache",
      planId: boundary.planId || "",
      route: "bounded-cache-delete",
      scanFingerprint: boundary.scanFingerprint || "",
      consentPlanId: boundary.consentPlanId || "",
      expectedBytes,
      dryRunOnly: false,
      mutationAttempted: true,
      actions: [action]
    }
  });

  return normalizeNativeWriteBoundary(result);
}

export async function runNativeNpmCacheExecutor(boundary = {}, host = globalThis) {
  const capability = getNativeScannerCapability(host);
  if (!capability.available) {
    return {
      available: false,
      mode: "browser-demo",
      realRunEnabled: false,
      destructiveCommands: false,
      accepted: false,
      reason: "Native npm cache executor is not available in the browser demo.",
      entries: [],
      warnings: ["Run the Tauri desktop shell before executing npm cache cleanup."]
    };
  }

  const row = boundary.row || boundary.selectedRow || {};
  const targetPath = row.targetPath || row.target || row.path || "";
  const action = {
    id: row.id || "npm-cache",
    title: row.title || "npm package cache",
    bytes: Number(row.bytes || boundary.expectedBytes || 0),
    route: "bounded-npm-cache-delete",
    targetPath
  };
  const expectedBytes = Number(boundary.expectedBytes ?? action.bytes);

  const result = await host.__TAURI__.core.invoke("execute_cleanup_plan", {
    request: {
      schemaVersion: "spaceguard-npm-cache-request/v1",
      requestMode: "execute-npm-cache",
      planId: boundary.planId || "",
      route: "bounded-npm-cache-delete",
      scanFingerprint: boundary.scanFingerprint || "",
      consentPlanId: boundary.consentPlanId || "",
      expectedBytes,
      dryRunOnly: false,
      mutationAttempted: true,
      actions: [action]
    }
  });

  return normalizeNativeWriteBoundary(result);
}

export async function runNativeRecycleBinExecutor(boundary = {}, host = globalThis) {
  const capability = getNativeScannerCapability(host);
  if (!capability.available) {
    return {
      available: false,
      mode: "browser-demo",
      realRunEnabled: false,
      destructiveCommands: false,
      accepted: false,
      reason: "Native Recycle Bin executor is not available in the browser demo.",
      entries: [],
      warnings: ["Run the Tauri desktop shell before executing Recycle Bin cleanup."]
    };
  }

  const row = boundary.row || boundary.selectedRow || {};
  const targetPath = row.targetPath || row.target || row.path || "";
  const action = {
    id: row.id || "recycle-bin",
    title: row.title || "Recycle Bin",
    bytes: Number(row.bytes || boundary.expectedBytes || 0),
    route: "shell-recycle-bin",
    targetPath
  };
  const expectedBytes = Number(boundary.expectedBytes ?? action.bytes);

  const result = await host.__TAURI__.core.invoke("execute_cleanup_plan", {
    request: {
      schemaVersion: "spaceguard-recycle-bin-request/v1",
      requestMode: "execute-recycle-bin",
      planId: boundary.planId || "",
      route: "shell-recycle-bin",
      scanFingerprint: boundary.scanFingerprint || "",
      consentPlanId: boundary.consentPlanId || "",
      expectedBytes,
      dryRunOnly: false,
      mutationAttempted: true,
      permanentRemovalConfirmed: true,
      actions: [action]
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
      openAiAgentAdvice: false,
      openAiAdvisorConfigured: false,
      openAiKeySource: "missing",
      safeExecutorsEnabled: false,
      executorFlags: defaultExecutorFlags(),
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
              reason: item.reason || item.note || "",
              signals: normalizeNativeReviewSignals(item.signals || item.reviewSignals || item.review_signals)
            }))
          : []
      }))
    : [];

  return {
    available: scanResult.available !== false,
    mode: scanResult.mode || NATIVE_SCAN_MODE,
    platform: scanResult.platform || "unknown",
    windows: Boolean(scanResult.windows),
    targetDrive: normalizeTargetDriveRequest(scanResult.targetDrive || scanResult.target_drive || scanResult.volume?.drive || "C:"),
    generatedAt: scanResult.generatedAt || scanResult.generated_at || "",
    request: scanResult.request || scanResult.scanRequest || scanResult.scan_request
      ? normalizeNativeScanRequest(scanResult.request || scanResult.scanRequest || scanResult.scan_request)
      : null,
    volume: normalizeNativeVolume(scanResult.volume),
    totalBytes: Number(scanResult.totalBytes || scanResult.total_bytes || findings.reduce((sum, finding) => sum + finding.bytes, 0)),
    findings,
    driveInventory: normalizeNativeDriveInventory(scanResult.driveInventory || scanResult.drive_inventory),
    warnings: Array.isArray(scanResult.warnings) ? scanResult.warnings : [],
    writeCapability: Boolean(scanResult.writeCapability || scanResult.write_capability),
    destructiveCommands: Boolean(scanResult.destructiveCommands || scanResult.destructive_commands)
  };
}

function normalizeNativeReviewSignals(value = []) {
  return Array.isArray(value)
    ? value
        .map((signal) => ({
          label: String(signal?.label || signal?.name || "").trim(),
          value: String(signal?.value || signal?.detail || "").trim(),
          tone: normalizeSignalTone(signal?.tone || signal?.status || "")
        }))
        .filter((signal) => signal.label || signal.value)
        .slice(0, 12)
    : [];
}

function normalizeSignalTone(value = "") {
  const clean = String(value || "").trim().toLowerCase();
  if (clean === "safe" || clean === "review" || clean === "restricted" || clean === "advanced") return clean;
  return "outline";
}

export function normalizeNativeDriveInventory(rows = []) {
  return Array.isArray(rows)
    ? rows.map((row) => ({
        id: row.id || "",
        name: row.name || "",
        path: row.path || "",
        bytes: Number(row.bytes || 0),
        status: row.status || "unknown",
        files: Number(row.files || 0),
        dirs: Number(row.dirs || 0),
        errors: Number(row.errors || 0),
        kind: row.kind || "filesystem entry",
        classification: row.classification || "unknown-review",
        canCreateExecutor: Boolean(row.canCreateExecutor || row.can_create_executor),
        note: row.note || ""
      }))
    : [];
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
          targetPath: entry.targetPath || entry.target_path || "",
          targetScopeStatus: entry.targetScopeStatus || entry.target_scope_status || "",
          rejectCode: entry.rejectCode || entry.reject_code || "",
          result: entry.result || "dry-run",
          bytes: Number(entry.bytes || 0),
          candidateBytes: Number(entry.candidateBytes || entry.candidate_bytes || 0),
          candidateCount: Number(entry.candidateCount || entry.candidate_count || 0),
          skippedCount: Number(entry.skippedCount || entry.skipped_count || 0),
          candidates: Array.isArray(entry.candidates)
            ? entry.candidates.map((candidate) => ({
                name: candidate.name || "",
                path: candidate.path || "",
                bytes: Number(candidate.bytes || 0),
                result: candidate.result || "candidate",
                note: candidate.note || ""
              }))
            : [],
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
          rejectCode: entry.rejectCode || entry.reject_code || "",
          bytes: Number(entry.bytes || 0),
          preflightStatus: entry.preflightStatus || entry.preflight_status || "",
          preflightChecks: normalizeWritePreflightChecks(entry.preflightChecks || entry.preflight_checks),
          note: entry.note || ""
        }))
      : [],
    contractEcho: normalizeWriteContractEcho(result.contractEcho || result.contract_echo),
    executorScaffold: normalizeWriteExecutorScaffold(result.executorScaffold || result.executor_scaffold),
    warnings: Array.isArray(result.warnings) ? result.warnings : []
  };
}

function normalizeWritePreflightChecks(value = []) {
  return Array.isArray(value)
    ? value.map((check) => ({
        id: check.id || "",
        label: check.label || "",
        status: check.status || "waiting",
        detail: check.detail || ""
      }))
    : [];
}

function normalizeWriteExecutorScaffold(value = null) {
  if (!value || typeof value !== "object") return null;
  return {
    route: value.route || "",
    title: value.title || "",
    featureFlag: value.featureFlag || value.feature_flag || "",
    status: value.status || "",
    validationStatus: value.validationStatus || value.validation_status || "",
    mutationEnabled: Boolean(value.mutationEnabled || value.mutation_enabled),
    reason: value.reason || ""
  };
}

function normalizeWriteContractEcho(value = null) {
  if (!value || typeof value !== "object") return null;
  return {
    schemaVersion: value.schemaVersion || value.schema_version || "",
    requestMode: value.requestMode || value.request_mode || "",
    planId: value.planId || value.plan_id || "",
    route: value.route || "",
    scanFingerprint: value.scanFingerprint || value.scan_fingerprint || "",
    consentPlanId: value.consentPlanId || value.consent_plan_id || "",
    expectedBytes: Number(value.expectedBytes || value.expected_bytes || 0),
    dryRunOnly: value.dryRunOnly ?? value.dry_run_only ?? true,
    mutationAttempted: Boolean(value.mutationAttempted || value.mutation_attempted),
    actionCount: Number(value.actionCount || value.action_count || 0)
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
    openAiAgentAdvice: Boolean(result.openAiAgentAdvice || result.openaiAgentAdvice || result.openai_agent_advice),
    openAiAdvisorConfigured: Boolean(result.openAiAdvisorConfigured || result.openaiAdvisorConfigured || result.openai_advisor_configured),
    openAiKeySource: result.openAiKeySource || result.openaiKeySource || result.openai_key_source || "missing",
    safeExecutorsEnabled: Boolean(result.safeExecutorsEnabled || result.safe_executors_enabled),
    executorFlags: normalizeExecutorFlags(result.executorFlags || result.executor_flags),
    reason: result.reason || ""
  };
}

function normalizeExecutorFlags(value = {}) {
  return {
    tempCleanupExecutor: Boolean(value.tempCleanupExecutor || value.temp_cleanup_executor),
    projectDependencyExecutor: Boolean(value.projectDependencyExecutor || value.project_dependency_executor),
    downloadsCleanupExecutor: Boolean(value.downloadsCleanupExecutor || value.downloads_cleanup_executor),
    largeFileArchiveExecutor: Boolean(value.largeFileArchiveExecutor || value.large_file_archive_executor),
    gradleCacheExecutor: Boolean(value.gradleCacheExecutor || value.gradle_cache_executor),
    npmCacheExecutor: Boolean(value.npmCacheExecutor || value.npm_cache_executor),
    recycleBinExecutor: Boolean(value.recycleBinExecutor || value.recycle_bin_executor),
    browserCacheExecutor: Boolean(value.browserCacheExecutor || value.browser_cache_executor),
    toolNativePruneExecutors: Boolean(value.toolNativePruneExecutors || value.tool_native_prune_executors)
  };
}

function defaultExecutorFlags() {
  return normalizeExecutorFlags();
}

function summarizePaths(paths, fallback) {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  if (uniquePaths.length === 0) return fallback;
  if (uniquePaths.length <= 2) return uniquePaths.join(", ");
  return `${uniquePaths.slice(0, 2).join(", ")} +${uniquePaths.length - 2} more`;
}
