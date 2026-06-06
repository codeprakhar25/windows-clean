const assert = require("assert");

(async () => {
  const guard = await import("../src/spaceguard-model.mjs");
  const native = await import("../src/native-scanner.mjs");

  assert.strictEqual(native.getNativeScannerCapability({}).available, false, "browser host should not expose native scanner");
  assert.strictEqual(
    native.getNativeScannerCapability({ __TAURI__: { core: { invoke() {} } } }).available,
    true,
    "Tauri host should expose native scanner"
  );

  const unavailable = await native.runNativeReadonlyScan({}, {});
  assert.strictEqual(unavailable.available, false, "native scan should report unavailable outside Tauri");
  assert.strictEqual(unavailable.request.targetDrive, "C:", "browser fallback should still expose normalized scan request");
  assert.strictEqual(unavailable.volume, null, "browser fallback must not expose volume evidence");
  assert.deepStrictEqual(unavailable.driveInventory, [], "browser fallback must not expose drive inventory evidence");
  assert.strictEqual(unavailable.writeCapability, false, "browser fallback must not expose write capability");
  assert.strictEqual(unavailable.destructiveCommands, false, "browser fallback must not expose destructive commands");
  const executorUnavailable = await native.runNativeExecutorDryRun({ rows: [] }, {});
  assert.strictEqual(executorUnavailable.available, false, "native executor dry-run should report unavailable outside Tauri");
  assert.strictEqual(executorUnavailable.destructiveCommands, false, "native executor fallback must not expose destructive commands");
  const writeUnavailable = await native.runNativeWriteBoundary({ selectedRows: [] }, {});
  assert.strictEqual(writeUnavailable.available, false, "native write boundary should report unavailable outside Tauri");
  assert.strictEqual(writeUnavailable.accepted, false, "native write fallback must not accept execution");
  assert.strictEqual(writeUnavailable.destructiveCommands, false, "native write fallback must not expose destructive commands");
  const capabilityUnavailable = await native.getNativeRuntimeCapabilities({});
  assert.strictEqual(capabilityUnavailable.available, false, "runtime capability should report unavailable outside Tauri");
  assert.strictEqual(capabilityUnavailable.elevated, false, "browser runtime capability must not imply elevation");
  assert.strictEqual(capabilityUnavailable.realRunEnabled, false, "browser runtime capability must keep real run disabled");
  assert.strictEqual(capabilityUnavailable.executeCleanupPlan, false, "browser runtime capability must not expose write command");
  let scanInvocation = null;
  const invokedScan = await native.runNativeReadonlyScan(
    {
      protectedPaths: ["C:\\Users\\demo\\ClientWork"],
      includeProjectArtifacts: false,
      maxDepth: 4,
      maxEntriesPerRoot: 5000,
      targetDrive: "d",
      customRoots: ["C:\\Users\\demo\\Archives", "C:\\Users\\demo\\Archives", " "]
    },
    {
      __TAURI__: {
        core: {
          invoke(command, payload) {
            scanInvocation = { command, payload };
            return Promise.resolve({ available: true, findings: [], warnings: [] });
          }
        }
      }
    }
  );
  assert.strictEqual(scanInvocation.command, "scan_known_roots", "native scan should invoke scan_known_roots");
  assert.deepStrictEqual(scanInvocation.payload.request.protectedPaths, ["C:\\Users\\demo\\ClientWork"], "native scan should pass protected paths");
  assert.strictEqual(scanInvocation.payload.request.includeProjectArtifacts, false, "native scan should pass project artifact setting");
  assert.strictEqual(scanInvocation.payload.request.maxDepth, 4, "native scan should pass max depth setting");
  assert.strictEqual(scanInvocation.payload.request.maxEntriesPerRoot, 5000, "native scan should pass entry cap setting");
  assert.strictEqual(scanInvocation.payload.request.targetDrive, "D:", "native scan should pass normalized target drive");
  assert.deepStrictEqual(scanInvocation.payload.request.customRoots, ["C:\\Users\\demo\\Archives"], "native scan should pass deduped custom roots");
  assert.strictEqual(invokedScan.request.targetDrive, "D:", "native scan should return the request that produced evidence");
  assert.deepStrictEqual(invokedScan.request.customRoots, ["C:\\Users\\demo\\Archives"], "native scan request evidence should keep normalized custom roots");

  const actionList = guard.buildScenarioActions("developer");
  const scan = native.normalizeNativeScan({
    mode: "native-readonly",
    platform: "windows",
    windows: true,
    target_drive: "C:",
    volume: {
      drive: "C:",
      total_bytes: 512 * guard.GB,
      free_bytes: 64 * guard.GB,
      used_bytes: 448 * guard.GB,
      source: "GetDiskFreeSpaceExW"
    },
    totalBytes: 42 * guard.GB,
    scan_request: {
      protected_paths: ["C:\\Users\\real\\ClientWork"],
      include_project_artifacts: true,
      max_depth: 8,
      max_entries_per_root: 25000,
      target_drive: "C:",
      custom_roots: ["C:\\Users\\real\\Archives"]
    },
    findings: [
      {
        recipeId: "gradle-cache",
        title: "Gradle dependency and build cache",
        path: "C:\\Users\\real\\.gradle\\caches",
        bytes: 42 * guard.GB,
        status: "measured"
      },
      {
        recipeId: "docker-build-cache",
        title: "Docker build cache",
        path: "Docker Desktop",
        bytes: 0,
        status: "unsupported"
      },
      {
        recipe_id: "large-user-files",
        title: "Large personal files",
        path: "C:\\Users\\real\\Videos",
        bytes: 3 * guard.GB,
        status: "measured",
        items: [
          {
            id: "large-real-video",
            name: "old-export.mov",
            path: "C:\\Users\\real\\Videos\\old-export.mov",
            bytes: 3 * guard.GB,
            age_days: 120,
            kind: "large personal file",
            recommendation: "review",
            reason: "Large native candidate"
          }
        ]
      },
      {
        recipe_id: "custom-root-1",
        title: "Custom folder: Archives",
        path: "C:\\Users\\real\\Archives",
        bytes: 7 * guard.GB,
        status: "measured",
        files: 12,
        dirs: 2,
        note: "Advisory read-only custom root measurement; no executor route is created."
      },
      {
        recipe_id: "installed-app-footprints",
        title: "Installed app footprints",
        path: "Program Files, ProgramData, LocalAppData\\Programs",
        bytes: 10 * guard.GB,
        status: "limited",
        items: [
          {
            id: "app-old-ide",
            name: "Old IDE 2023",
            path: "C:\\Program Files\\Old IDE 2023",
            bytes: 6 * guard.GB,
            age_days: 180,
            kind: "developer tool footprint",
            recommendation: "review",
            reason: "Manual uninstall candidate",
            signals: [
              { label: "usage proof", value: "not proven", tone: "restricted" },
              { label: "uninstall entry", value: "present", tone: "safe" }
            ]
          },
          {
            id: "app-unity-hub",
            name: "Unity Hub",
            path: "C:\\Program Files\\Unity Hub",
            bytes: 4 * guard.GB,
            age_days: 180,
            kind: "developer tool footprint",
            recommendation: "keep",
            reason: "Read-only app usage evidence found via UserAssist launch evidence matching Unity Hub.",
            signals: [
              { label: "usage proof", value: "UserAssist launch evidence", tone: "safe" },
              { label: "usage match", value: "name match: unity hub", tone: "safe" },
              { label: "uninstall entry", value: "present", tone: "safe" }
            ]
          }
        ]
      }
    ],
    drive_inventory: [
      {
        id: "drive-users",
        name: "Users",
        path: "C:\\Users",
        bytes: 256 * guard.GB,
        status: "limited",
        files: 1200,
        dirs: 90,
        errors: 1,
        kind: "directory",
        classification: "user-data-review",
        can_create_executor: false,
        note: "Measured with drive-inventory caps."
      },
      {
        id: "drive-windows",
        name: "Windows",
        path: "C:\\Windows",
        bytes: 80 * guard.GB,
        status: "limited",
        files: 5000,
        dirs: 300,
        errors: 20,
        kind: "directory",
        classification: "system-or-protected",
        can_create_executor: false,
        note: "System context only."
      }
    ],
    writeCapability: false,
    destructiveCommands: false
  });
  assert.strictEqual(scan.targetDrive, "C:", "native scan should normalize target drive");
  assert.strictEqual(scan.request.targetDrive, "C:", "native scan should normalize captured scan request");
  assert.deepStrictEqual(scan.request.protectedPaths, ["C:\\Users\\real\\ClientWork"], "native scan should normalize request protected paths");
  assert.strictEqual(scan.volume.drive, "C:", "native scan should normalize volume drive");
  assert.strictEqual(scan.volume.freeBytes, 64 * guard.GB, "native scan should normalize volume free bytes");
  assert.strictEqual(scan.volume.usedBytes, 448 * guard.GB, "native scan should normalize volume used bytes");
  assert.strictEqual(scan.driveInventory.length, 2, "native scan should normalize drive inventory rows");
  assert.strictEqual(scan.driveInventory[0].classification, "user-data-review", "drive inventory classification should normalize");
  assert.strictEqual(scan.driveInventory[0].canCreateExecutor, false, "drive inventory must not create executor routes");
  const merged = native.mergeNativeScanIntoActions(actionList, scan);
  const gradle = merged.find((action) => action.id === "gradle-cache");
  const docker = merged.find((action) => action.id === "docker-build-cache");
  const largeFiles = merged.find((action) => action.id === "large-user-files");
  const appFootprints = merged.find((action) => action.id === "installed-app-footprints");

  assert.strictEqual(gradle.bytes, 42 * guard.GB, "real scan bytes should replace demo bytes");
  assert.strictEqual(gradle.scanStatus, "measured", "measured findings should be marked");
  assert(gradle.path.includes("C:\\Users\\real"), "real scan path should replace demo path");
  assert.strictEqual(docker.bytes, 0, "unsupported native findings should not keep demo bytes");
  assert.strictEqual(docker.scanStatus, "unsupported", "unsupported native findings should be explicit");
  assert.strictEqual(largeFiles.bytes, 3 * guard.GB, "native large-file discovery should replace demo bytes");
  assert.strictEqual(largeFiles.scanStatus, "measured", "native large-file discovery should be marked measured");
  assert.strictEqual(appFootprints.bytes, 10 * guard.GB, "native app footprint discovery should replace demo bytes");
  assert.strictEqual(appFootprints.scanStatus, "limited", "native app footprint discovery should preserve limited status");

  const scanCoverage = guard.buildScanCoverageSummary({
    actionList: merged,
    scanMode: "native-readonly",
    nativeScan: scan
  });
  assert.strictEqual(scanCoverage.schemaVersion, "spaceguard-scan-coverage/v1", "scan coverage should expose a schema version");
  assert.strictEqual(scanCoverage.status, "partial-native", "mixed native evidence should be marked partial");
  assert(scanCoverage.confidenceScore > 0, "measured native roots should increase scan confidence");
  assert.strictEqual(scanCoverage.customRootRows.length, 1, "scan coverage should expose custom root discovery rows");
  assert.strictEqual(scanCoverage.customRootBytes, 7 * guard.GB, "scan coverage should total custom root bytes separately");
  assert.strictEqual(scanCoverage.customRootRows[0].nextStep.includes("never create executor routes"), true, "custom roots should stay advisory");
  assert(scanCoverage.unverifiedRows.some((row) => row.id === "docker-build-cache" && row.evidence === "unsupported"), "unsupported native roots should stay visible in coverage gaps");
  assert(scanCoverage.unverifiedRows.some((row) => row.evidence === "demo-estimate"), "demo-estimated roots should remain visible after partial native scan");
  const driveInventory = guard.buildDriveInventorySummary({
    nativeScan: scan,
    scanMode: "native-readonly"
  });
  assert.strictEqual(driveInventory.schemaVersion, "spaceguard-drive-inventory/v1", "drive inventory should expose a schema version");
  assert.strictEqual(driveInventory.status, "inventory-ready", "native drive inventory should be ready when rows exist");
  assert.strictEqual(driveInventory.manualOnly, true, "drive inventory should stay manual-only");
  assert.strictEqual(driveInventory.counts.executorRoutes, 0, "drive inventory should never create executor routes");
  assert.strictEqual(driveInventory.counts.realRun, 0, "drive inventory should never create real-run rows");
  assert.strictEqual(driveInventory.counts.system, 1, "drive inventory should identify system buckets");
  assert.strictEqual(driveInventory.topRows[0].name, "Users", "drive inventory should sort largest buckets first");
  const demoDriveInventory = guard.buildDriveInventorySummary({ nativeScan: null, scanMode: "demo" });
  assert.strictEqual(demoDriveInventory.status, "demo-only", "demo mode should not claim drive inventory evidence");

  const largeFileReview = guard.buildItemReview("large-user-files", merged, scan, []);
  assert.strictEqual(largeFileReview.source, "native-readonly", "large-file item review should use native candidates when available");
  assert.strictEqual(largeFileReview.items[0].name, "old-export.mov", "native large-file candidate should be preserved");
  assert.strictEqual(largeFileReview.items[0].decision, "undecided", "native large-file candidate should require user decision");
  const appFootprintReview = guard.buildItemReview("installed-app-footprints", merged, scan, []);
  assert.strictEqual(appFootprintReview.source, "native-readonly", "app footprint item review should use native candidates when available");
  assert.strictEqual(appFootprintReview.items[0].name, "Old IDE 2023", "native app footprint candidate should be preserved");
  assert.strictEqual(appFootprintReview.items[0].signals[0].label, "usage proof", "app footprint review should preserve structured review signals");
  assert.strictEqual(appFootprintReview.items[0].signals[0].value, "not proven", "app footprint signals should make usage uncertainty explicit");
  const usageBackedApp = appFootprintReview.items.find((item) => item.id === "app-unity-hub");
  assert(usageBackedApp, "app footprint review should preserve usage-backed app candidates");
  assert.strictEqual(
    usageBackedApp.signals.find((signal) => signal.label === "usage proof").value,
    "UserAssist launch evidence",
    "app footprint review should preserve read-only app usage evidence"
  );
  assert.strictEqual(appFootprintReview.selectedBytes, 0, "app footprint candidates should not become executor recovery bytes");
  const appReviewDossier = guard.buildInstalledAppReviewDossier({ itemReviewsByAction: { "installed-app-footprints": appFootprintReview } });
  assert.strictEqual(appReviewDossier.status, "needs-user-review", "native app footprint candidates should populate app review dossier");
  assert.strictEqual(appReviewDossier.rows[0].usageProof, "not proven", "app review dossier should keep usage uncertainty explicit");
  assert.strictEqual(appReviewDossier.rows[0].uninstallEntry, "present", "app review dossier should keep uninstall-entry evidence");
  assert(
    appReviewDossier.rows.some((row) => row.usageProof === "UserAssist launch evidence"),
    "app review dossier should preserve UserAssist usage evidence for review"
  );
  assert.strictEqual(appReviewDossier.canCreateExecutor, false, "app review dossier must not create executor routes");

  const normalizedWithItems = native.normalizeNativeScan({
    findings: [
      {
        recipe_id: "downloads-installers",
        title: "Downloads",
        path: "C:\\Users\\real\\Downloads",
        bytes: 100,
        status: "measured",
        items: [
          {
            id: "x",
            name: "setup.exe",
            path: "C:\\Users\\real\\Downloads\\setup.exe",
            bytes: 100,
            age_days: 45,
            kind: "installer",
            recommendation: "review",
            reason: "Old installer",
            signals: [{ label: "modified age", value: "45d", tone: "review" }]
          }
        ]
      }
    ]
  });
  assert.strictEqual(normalizedWithItems.findings[0].items[0].ageDays, 45, "native item age should normalize to camelCase");
  assert.strictEqual(normalizedWithItems.findings[0].items[0].recommendation, "review", "native item recommendation should be preserved");
  assert.strictEqual(normalizedWithItems.findings[0].items[0].signals[0].label, "modified age", "native item signals should normalize");
  assert.strictEqual(normalizedWithItems.findings[0].items[0].signals[0].tone, "review", "native item signal tone should normalize");
  assert.strictEqual(native.normalizeNativeVolume({ drive: "C:", totalBytes: 10, freeBytes: 3 }).usedBytes, 7, "native volume should derive used bytes when needed");
  assert.strictEqual(native.normalizeNativeVolume({ totalBytes: 10, freeBytes: 3 }), null, "native volume should reject missing drive");

  const dryRun = native.normalizeNativeExecutorDryRun({
    mode: "native-dry-run",
    real_run_enabled: false,
    destructive_commands: false,
    entries: [
      {
        id: "windows-temp",
        title: "Windows temporary files",
        route: "known-temp-delete",
        target_path: "C:\\Windows\\Temp",
        target_scope_status: "target-allowed",
        reject_code: "",
        result: "dry-run",
        bytes: 123,
        candidate_bytes: 100,
        candidate_count: 1,
        skipped_count: 2,
        candidates: [{ name: "a.tmp", path: "C:\\Windows\\Temp\\a.tmp", bytes: 100, result: "candidate", note: "sample" }],
        note: "No mutation"
      }
    ],
    warnings: ["disabled"]
  });
  assert.strictEqual(dryRun.realRunEnabled, false, "native dry-run normalization should keep real run disabled");
  assert.strictEqual(dryRun.destructiveCommands, false, "native dry-run normalization should keep destructive commands disabled");
  assert.strictEqual(dryRun.entries[0].route, "known-temp-delete", "native dry-run route should be preserved");
  assert.strictEqual(dryRun.entries[0].targetPath, "C:\\Windows\\Temp", "native dry-run target path should normalize");
  assert.strictEqual(dryRun.entries[0].targetScopeStatus, "target-allowed", "native dry-run target scope status should normalize");
  assert.strictEqual(dryRun.entries[0].rejectCode, "", "native dry-run target scope should omit reject code when allowed");
  assert.strictEqual(dryRun.entries[0].candidateCount, 1, "native dry-run candidate count should normalize");
  assert.strictEqual(dryRun.entries[0].skippedCount, 2, "native dry-run skipped count should normalize");
  assert.strictEqual(dryRun.entries[0].candidates[0].name, "a.tmp", "native dry-run candidate samples should normalize");
  const blockedDryRun = native.normalizeNativeExecutorDryRun({
    entries: [
      {
        id: "bad-temp",
        title: "Bad temp target",
        route: "known-temp-delete",
        target_path: "C:\\Users\\real\\Downloads",
        target_scope_status: "target-blocked",
        reject_code: "target-forbidden",
        candidate_count: 0,
        candidates: [],
        note: "Target rejected"
      }
    ]
  });
  assert.strictEqual(blockedDryRun.entries[0].targetScopeStatus, "target-blocked", "native dry-run should preserve blocked target scope");
  assert.strictEqual(blockedDryRun.entries[0].rejectCode, "target-forbidden", "native dry-run should preserve target-scope reject code");
  assert.strictEqual(blockedDryRun.entries[0].candidateCount, 0, "blocked target scope should not normalize candidate rows");
  let dryRunInvocation = null;
  await native.runNativeExecutorDryRun(
    { rows: [{ id: "windows-temp", title: "Windows temporary files", bytes: 123, route: "known-temp-delete", path: "C:\\Windows\\Temp", canSimulate: true }] },
    {
      __TAURI__: {
        core: {
          invoke(command, payload) {
            dryRunInvocation = { command, payload };
            return Promise.resolve({ entries: [], warnings: [] });
          }
        }
      }
    }
  );
  assert.strictEqual(dryRunInvocation.command, "simulate_cleanup_plan", "native dry-run should invoke simulate_cleanup_plan");
  assert.strictEqual(dryRunInvocation.payload.request.actions[0].targetPath, "C:\\Windows\\Temp", "native dry-run should pass target path evidence");
  let scopeInvocation = null;
  await native.runNativeDryRunScopeValidation({
    __TAURI__: {
      core: {
        invoke(command, payload) {
          scopeInvocation = { command, payload };
          return Promise.resolve({ entries: [], warnings: [] });
        }
      }
    }
  });
  assert.strictEqual(scopeInvocation.command, "simulate_cleanup_plan", "native scope validation should invoke simulate_cleanup_plan");
  assert(scopeInvocation.payload.request.actions.some((action) => action.id === "windows-temp" && action.targetPath.includes("%TEMP%")), "native scope validation should include allowed temp scope");
  assert(scopeInvocation.payload.request.actions.some((action) => action.id === "downloads-forbidden-as-temp" && action.targetPath.includes("Downloads")), "native scope validation should include forbidden Downloads scope");
  assert(scopeInvocation.payload.request.actions.some((action) => action.id === "browser-identity-forbidden" && action.targetPath.includes("Cookies")), "native scope validation should include forbidden browser identity scope");
  let writeInvocation = null;
  const rejectedWrite = await native.runNativeWriteBoundary(
    {
      capsule: {
        route: { id: "known-temp-delete" },
        selectedRows: [{ id: "windows-temp", title: "Windows temporary files", path: "C:\\Windows\\Temp", bytes: 123 }]
      },
      contract: {
        schemaVersion: "spaceguard-first-safe-executor-contract/v1",
        requestPreview: {
          mode: "reject-only-preview",
          planId: "plan-temp",
          route: "known-temp-delete",
          scanFingerprint: "scan-temp",
          consentPlanId: "plan-temp",
          expectedBytes: 123,
          dryRunOnly: true,
          mutationAttempted: false,
          actions: [{ id: "windows-temp", title: "Windows temporary files", targetPath: "C:\\Windows\\Temp", bytes: 123, route: "known-temp-delete" }]
        }
      }
    },
    {
      __TAURI__: {
        core: {
          invoke(command, payload) {
            writeInvocation = { command, payload };
            return Promise.resolve({
              mode: "native-write-rejected",
              real_run_enabled: false,
              destructive_commands: false,
              accepted: false,
              reason: "disabled",
              contract_echo: {
                schema_version: payload.request.schemaVersion,
                request_mode: payload.request.requestMode,
                plan_id: payload.request.planId,
                route: payload.request.route,
                scan_fingerprint: payload.request.scanFingerprint,
                consent_plan_id: payload.request.consentPlanId,
                expected_bytes: payload.request.expectedBytes,
                dry_run_only: payload.request.dryRunOnly,
                mutation_attempted: payload.request.mutationAttempted,
                action_count: payload.request.actions.length
              },
              entries: [{ id: "windows-temp", title: "Windows temporary files", route: "known-temp-delete", result: "rejected", reject_code: "real-executor-disabled", bytes: 0, note: "blocked" }],
              warnings: ["no mutation"]
            });
          }
        }
      }
    }
  );
  assert.strictEqual(writeInvocation.command, "execute_cleanup_plan", "native write boundary should invoke execute_cleanup_plan");
  assert.strictEqual(writeInvocation.payload.request.planId, "plan-temp", "native write boundary should pass plan id");
  assert.strictEqual(writeInvocation.payload.request.route, "known-temp-delete", "native write boundary should pass capsule route");
  assert.strictEqual(writeInvocation.payload.request.requestMode, "reject-only-preview", "native write boundary should pass first-safe request mode");
  assert.strictEqual(writeInvocation.payload.request.scanFingerprint, "scan-temp", "native write boundary should pass scan fingerprint");
  assert.strictEqual(writeInvocation.payload.request.consentPlanId, "plan-temp", "native write boundary should pass consent plan id");
  assert.strictEqual(writeInvocation.payload.request.actions[0].targetPath, "C:\\Windows\\Temp", "native write boundary should pass selected target path");
  assert.strictEqual(writeInvocation.payload.request.dryRunOnly, true, "native write boundary should keep the request dry-run only");
  assert.strictEqual(writeInvocation.payload.request.mutationAttempted, false, "native write boundary should mark mutation as not attempted");
  assert.strictEqual(rejectedWrite.realRunEnabled, false, "native write boundary must keep real run disabled");
  assert.strictEqual(rejectedWrite.destructiveCommands, false, "native write boundary must keep destructive commands disabled");
  assert.strictEqual(rejectedWrite.accepted, false, "native write boundary should reject execution");
  assert.strictEqual(rejectedWrite.contractEcho.requestMode, "reject-only-preview", "native write boundary should normalize contract echo");
  assert.strictEqual(rejectedWrite.contractEcho.scanFingerprint, "scan-temp", "native write boundary should normalize scan fingerprint echo");
  assert.strictEqual(rejectedWrite.entries[0].result, "rejected", "native write boundary should normalize rejected entries");
  assert.strictEqual(rejectedWrite.entries[0].rejectCode, "real-executor-disabled", "native write boundary should normalize reject codes");
  assert.strictEqual(rejectedWrite.entries[0].bytes, 0, "native write boundary should reclaim zero bytes");
  let browserExecutionInvocation = null;
  const browserExecution = await native.runNativeBrowserCacheExecutor(
    {
      rows: [{ id: "chrome-cache-data", title: "Chrome cache data", path: "C:\\Users\\real\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache\\Cache_Data", bytes: 456 }],
      planId: "plan-browser",
      scanFingerprint: "scan-browser",
      consentPlanId: "plan-browser",
      expectedBytes: 456
    },
    {
      __TAURI__: {
        core: {
          invoke(command, payload) {
            browserExecutionInvocation = { command, payload };
            return Promise.resolve({
              mode: "native-browser-cache-executor",
              real_run_enabled: true,
              destructive_commands: true,
              accepted: true,
              reason: "accepted",
              contract_echo: {
                schema_version: payload.request.schemaVersion,
                request_mode: payload.request.requestMode,
                plan_id: payload.request.planId,
                route: payload.request.route,
                scan_fingerprint: payload.request.scanFingerprint,
                consent_plan_id: payload.request.consentPlanId,
                expected_bytes: payload.request.expectedBytes,
                dry_run_only: payload.request.dryRunOnly,
                mutation_attempted: payload.request.mutationAttempted,
                action_count: payload.request.actions.length
              },
              entries: [{ id: "chrome-cache-data", title: "Chrome cache data", route: "browser-cache-only", result: "executed", reject_code: "", bytes: 123, note: "deleted cache" }],
              warnings: ["browser cache done"]
            });
          }
        }
      }
    }
  );
  assert.strictEqual(browserExecutionInvocation.command, "execute_cleanup_plan", "browser cache executor should invoke execute_cleanup_plan");
  assert.strictEqual(browserExecutionInvocation.payload.request.schemaVersion, "spaceguard-browser-cache-request/v1", "browser cache executor should use its schema");
  assert.strictEqual(browserExecutionInvocation.payload.request.requestMode, "execute-browser-cache", "browser cache executor should send execute-browser-cache mode");
  assert.strictEqual(browserExecutionInvocation.payload.request.route, "browser-cache-only", "browser cache executor should stay on browser-cache-only route");
  assert.strictEqual(browserExecutionInvocation.payload.request.scanFingerprint, "scan-browser", "browser cache executor should pass scan fingerprint");
  assert.strictEqual(browserExecutionInvocation.payload.request.consentPlanId, "plan-browser", "browser cache executor should pass consent receipt");
  assert.strictEqual(browserExecutionInvocation.payload.request.dryRunOnly, false, "browser cache executor should be a mutating request");
  assert.strictEqual(browserExecutionInvocation.payload.request.mutationAttempted, true, "browser cache executor should require mutation confirmation");
  assert.strictEqual(browserExecutionInvocation.payload.request.actions[0].targetPath.endsWith("\\Cache\\Cache_Data"), true, "browser cache executor should pass concrete cache root path");
  assert.strictEqual(browserExecution.accepted, true, "browser cache executor should normalize accepted responses");
  assert.strictEqual(browserExecution.entries[0].route, "browser-cache-only", "browser cache executor should normalize executed route");
  let gradleExecutionInvocation = null;
  const gradleExecution = await native.runNativeGradleCacheExecutor(
    {
      row: { id: "gradle-cache", title: "Gradle dependency and build cache", path: "C:\\Users\\real\\.gradle\\caches", bytes: 789 },
      planId: "plan-gradle",
      scanFingerprint: "scan-gradle",
      consentPlanId: "plan-gradle",
      expectedBytes: 789
    },
    {
      __TAURI__: {
        core: {
          invoke(command, payload) {
            gradleExecutionInvocation = { command, payload };
            return Promise.resolve({
              mode: "native-gradle-cache-executor",
              real_run_enabled: true,
              destructive_commands: true,
              accepted: true,
              reason: "accepted",
              contract_echo: {
                schema_version: payload.request.schemaVersion,
                request_mode: payload.request.requestMode,
                plan_id: payload.request.planId,
                route: payload.request.route,
                scan_fingerprint: payload.request.scanFingerprint,
                consent_plan_id: payload.request.consentPlanId,
                expected_bytes: payload.request.expectedBytes,
                dry_run_only: payload.request.dryRunOnly,
                mutation_attempted: payload.request.mutationAttempted,
                action_count: payload.request.actions.length
              },
              entries: [{ id: "gradle-cache", title: "Gradle dependency and build cache", route: "bounded-cache-delete", result: "executed", reject_code: "", bytes: 321, note: "deleted old cache" }],
              warnings: ["gradle cache done"]
            });
          }
        }
      }
    }
  );
  assert.strictEqual(gradleExecutionInvocation.command, "execute_cleanup_plan", "Gradle cache executor should invoke execute_cleanup_plan");
  assert.strictEqual(gradleExecutionInvocation.payload.request.schemaVersion, "spaceguard-gradle-cache-request/v1", "Gradle cache executor should use its schema");
  assert.strictEqual(gradleExecutionInvocation.payload.request.requestMode, "execute-gradle-cache", "Gradle cache executor should send execute-gradle-cache mode");
  assert.strictEqual(gradleExecutionInvocation.payload.request.route, "bounded-cache-delete", "Gradle cache executor should stay on bounded-cache-delete route");
  assert.strictEqual(gradleExecutionInvocation.payload.request.dryRunOnly, false, "Gradle cache executor should be a mutating request");
  assert.strictEqual(gradleExecutionInvocation.payload.request.mutationAttempted, true, "Gradle cache executor should require mutation confirmation");
  assert.strictEqual(gradleExecutionInvocation.payload.request.actions[0].targetPath.endsWith("\\.gradle\\caches"), true, "Gradle cache executor should pass concrete Gradle cache root path");
  assert.strictEqual(gradleExecution.accepted, true, "Gradle cache executor should normalize accepted responses");
  assert.strictEqual(gradleExecution.entries[0].route, "bounded-cache-delete", "Gradle cache executor should normalize executed route");
  let userCacheExecutionInvocation = null;
  const userCacheExecution = await native.runNativeUserCacheExecutor(
    {
      row: { id: "user-cache", title: "User .cache folder", path: "C:\\Users\\real\\.cache", bytes: 654 },
      planId: "plan-user-cache",
      scanFingerprint: "scan-user-cache",
      consentPlanId: "plan-user-cache",
      expectedBytes: 654
    },
    {
      __TAURI__: {
        core: {
          invoke(command, payload) {
            userCacheExecutionInvocation = { command, payload };
            return Promise.resolve({
              mode: "native-user-cache-executor",
              real_run_enabled: true,
              destructive_commands: true,
              accepted: true,
              reason: "accepted",
              contract_echo: {
                schema_version: payload.request.schemaVersion,
                request_mode: payload.request.requestMode,
                plan_id: payload.request.planId,
                route: payload.request.route,
                scan_fingerprint: payload.request.scanFingerprint,
                consent_plan_id: payload.request.consentPlanId,
                expected_bytes: payload.request.expectedBytes,
                dry_run_only: payload.request.dryRunOnly,
                mutation_attempted: payload.request.mutationAttempted,
                action_count: payload.request.actions.length
              },
              entries: [{ id: "user-cache", title: "User .cache folder", route: "bounded-user-cache-delete", result: "executed", reject_code: "", bytes: 222, note: "deleted old user cache" }],
              warnings: ["user cache done"]
            });
          }
        }
      }
    }
  );
  assert.strictEqual(userCacheExecutionInvocation.command, "execute_cleanup_plan", "user .cache executor should invoke execute_cleanup_plan");
  assert.strictEqual(userCacheExecutionInvocation.payload.request.schemaVersion, "spaceguard-user-cache-request/v1", "user .cache executor should use its schema");
  assert.strictEqual(userCacheExecutionInvocation.payload.request.requestMode, "execute-user-cache", "user .cache executor should send execute-user-cache mode");
  assert.strictEqual(userCacheExecutionInvocation.payload.request.route, "bounded-user-cache-delete", "user .cache executor should stay on bounded-user-cache-delete route");
  assert.strictEqual(userCacheExecutionInvocation.payload.request.dryRunOnly, false, "user .cache executor should be a mutating request");
  assert.strictEqual(userCacheExecutionInvocation.payload.request.mutationAttempted, true, "user .cache executor should require mutation confirmation");
  assert.strictEqual(userCacheExecutionInvocation.payload.request.actions[0].targetPath.endsWith("\\.cache"), true, "user .cache executor should pass concrete .cache root path");
  assert.strictEqual(userCacheExecution.accepted, true, "user .cache executor should normalize accepted responses");
  assert.strictEqual(userCacheExecution.entries[0].route, "bounded-user-cache-delete", "user .cache executor should normalize executed route");
  let androidCacheExecutionInvocation = null;
  const androidCacheExecution = await native.runNativeAndroidCacheExecutor(
    {
      rows: [
        { id: "android-cache-1", title: "Android Studio cache", path: "C:\\Users\\real\\AppData\\Local\\Google\\AndroidStudio2025.1\\caches", bytes: 333 },
        { id: "android-cache-2", title: "Android .android build cache", path: "C:\\Users\\real\\.android\\build-cache", bytes: 111 }
      ],
      planId: "plan-android-cache",
      scanFingerprint: "scan-android-cache",
      consentPlanId: "plan-android-cache",
      expectedBytes: 444
    },
    {
      __TAURI__: {
        core: {
          invoke(command, payload) {
            androidCacheExecutionInvocation = { command, payload };
            return Promise.resolve({
              mode: "native-android-cache-executor",
              real_run_enabled: true,
              destructive_commands: true,
              accepted: true,
              reason: "accepted",
              contract_echo: {
                schema_version: payload.request.schemaVersion,
                request_mode: payload.request.requestMode,
                plan_id: payload.request.planId,
                route: payload.request.route,
                scan_fingerprint: payload.request.scanFingerprint,
                consent_plan_id: payload.request.consentPlanId,
                expected_bytes: payload.request.expectedBytes,
                dry_run_only: payload.request.dryRunOnly,
                mutation_attempted: payload.request.mutationAttempted,
                action_count: payload.request.actions.length
              },
              entries: [{ id: "android-cache-1", title: "Android Studio cache", route: "bounded-android-cache-delete", result: "executed", reject_code: "", bytes: 333, note: "deleted old android cache" }],
              warnings: ["android cache done"]
            });
          }
        }
      }
    }
  );
  assert.strictEqual(androidCacheExecutionInvocation.command, "execute_cleanup_plan", "Android cache executor should invoke execute_cleanup_plan");
  assert.strictEqual(androidCacheExecutionInvocation.payload.request.schemaVersion, "spaceguard-android-cache-request/v1", "Android cache executor should use its schema");
  assert.strictEqual(androidCacheExecutionInvocation.payload.request.requestMode, "execute-android-cache", "Android cache executor should send execute-android-cache mode");
  assert.strictEqual(androidCacheExecutionInvocation.payload.request.route, "bounded-android-cache-delete", "Android cache executor should stay on bounded-android-cache-delete route");
  assert.strictEqual(androidCacheExecutionInvocation.payload.request.actions.length, 2, "Android cache executor should pass every scanned cache root");
  assert.strictEqual(androidCacheExecutionInvocation.payload.request.actions[0].targetPath.includes("AndroidStudio2025.1\\caches"), true, "Android cache executor should pass concrete Android Studio cache root path");
  assert.strictEqual(androidCacheExecution.accepted, true, "Android cache executor should normalize accepted responses");
  assert.strictEqual(androidCacheExecution.entries[0].route, "bounded-android-cache-delete", "Android cache executor should normalize executed route");
  let shaderCacheExecutionInvocation = null;
  const shaderCacheExecution = await native.runNativeShaderCacheExecutor(
    {
      rows: [
        { id: "shader-cache-1", title: "NVIDIA DirectX shader cache", path: "C:\\Users\\real\\AppData\\Local\\NVIDIA\\DXCache", bytes: 555 },
        { id: "shader-cache-2", title: "Direct3D shader cache", path: "C:\\Users\\real\\AppData\\Local\\D3DSCache", bytes: 222 }
      ],
      planId: "plan-shader-cache",
      scanFingerprint: "scan-shader-cache",
      consentPlanId: "plan-shader-cache",
      expectedBytes: 777
    },
    {
      __TAURI__: {
        core: {
          invoke(command, payload) {
            shaderCacheExecutionInvocation = { command, payload };
            return Promise.resolve({
              mode: "native-shader-cache-executor",
              real_run_enabled: true,
              destructive_commands: true,
              accepted: true,
              reason: "accepted",
              contract_echo: {
                schema_version: payload.request.schemaVersion,
                request_mode: payload.request.requestMode,
                plan_id: payload.request.planId,
                route: payload.request.route,
                scan_fingerprint: payload.request.scanFingerprint,
                consent_plan_id: payload.request.consentPlanId,
                expected_bytes: payload.request.expectedBytes,
                dry_run_only: payload.request.dryRunOnly,
                mutation_attempted: payload.request.mutationAttempted,
                action_count: payload.request.actions.length
              },
              entries: [{ id: "shader-cache-1", title: "NVIDIA DirectX shader cache", route: "launcher-cache-cleanup", result: "executed", reject_code: "", bytes: 555, note: "deleted old shader cache" }],
              warnings: ["shader cache done"]
            });
          }
        }
      }
    }
  );
  assert.strictEqual(shaderCacheExecutionInvocation.command, "execute_cleanup_plan", "shader cache executor should invoke execute_cleanup_plan");
  assert.strictEqual(shaderCacheExecutionInvocation.payload.request.schemaVersion, "spaceguard-shader-cache-request/v1", "shader cache executor should use its schema");
  assert.strictEqual(shaderCacheExecutionInvocation.payload.request.requestMode, "execute-shader-cache", "shader cache executor should send execute-shader-cache mode");
  assert.strictEqual(shaderCacheExecutionInvocation.payload.request.route, "launcher-cache-cleanup", "shader cache executor should stay on launcher-cache-cleanup route");
  assert.strictEqual(shaderCacheExecutionInvocation.payload.request.actions.length, 2, "shader cache executor should pass every scanned cache root");
  assert.strictEqual(shaderCacheExecutionInvocation.payload.request.actions[0].targetPath.includes("NVIDIA\\DXCache"), true, "shader cache executor should pass concrete shader cache root path");
  assert.strictEqual(shaderCacheExecution.accepted, true, "shader cache executor should normalize accepted responses");
  assert.strictEqual(shaderCacheExecution.entries[0].route, "launcher-cache-cleanup", "shader cache executor should normalize executed route");
  let npmExecutionInvocation = null;
  const npmExecution = await native.runNativeNpmCacheExecutor(
    {
      row: { id: "npm-cache", title: "npm package cache", path: "C:\\Users\\real\\AppData\\Local\\npm-cache\\_cacache", bytes: 456 },
      planId: "plan-npm",
      scanFingerprint: "scan-npm",
      consentPlanId: "plan-npm",
      expectedBytes: 456
    },
    {
      __TAURI__: {
        core: {
          invoke(command, payload) {
            npmExecutionInvocation = { command, payload };
            return Promise.resolve({
              mode: "native-npm-cache-executor",
              real_run_enabled: true,
              destructive_commands: true,
              accepted: true,
              reason: "accepted",
              contract_echo: {
                schema_version: payload.request.schemaVersion,
                request_mode: payload.request.requestMode,
                plan_id: payload.request.planId,
                route: payload.request.route,
                scan_fingerprint: payload.request.scanFingerprint,
                consent_plan_id: payload.request.consentPlanId,
                expected_bytes: payload.request.expectedBytes,
                dry_run_only: payload.request.dryRunOnly,
                mutation_attempted: payload.request.mutationAttempted,
                action_count: payload.request.actions.length
              },
              entries: [{ id: "npm-cache", title: "npm package cache", route: "bounded-npm-cache-delete", result: "executed", reject_code: "", bytes: 222, note: "deleted old npm cache" }],
              warnings: ["npm cache done"]
            });
          }
        }
      }
    }
  );
  assert.strictEqual(npmExecutionInvocation.command, "execute_cleanup_plan", "npm cache executor should invoke execute_cleanup_plan");
  assert.strictEqual(npmExecutionInvocation.payload.request.schemaVersion, "spaceguard-npm-cache-request/v1", "npm cache executor should use its schema");
  assert.strictEqual(npmExecutionInvocation.payload.request.requestMode, "execute-npm-cache", "npm cache executor should send execute-npm-cache mode");
  assert.strictEqual(npmExecutionInvocation.payload.request.route, "bounded-npm-cache-delete", "npm cache executor should stay on bounded-npm-cache-delete route");
  assert.strictEqual(npmExecutionInvocation.payload.request.dryRunOnly, false, "npm cache executor should be a mutating request");
  assert.strictEqual(npmExecutionInvocation.payload.request.mutationAttempted, true, "npm cache executor should require mutation confirmation");
  assert.strictEqual(npmExecutionInvocation.payload.request.actions[0].targetPath.endsWith("\\npm-cache\\_cacache"), true, "npm cache executor should pass concrete _cacache root path");
  assert.strictEqual(npmExecution.accepted, true, "npm cache executor should normalize accepted responses");
  assert.strictEqual(npmExecution.entries[0].route, "bounded-npm-cache-delete", "npm cache executor should normalize executed route");
  let pnpmExecutionInvocation = null;
  const pnpmExecution = await native.runNativePnpmStoreExecutor(
    {
      row: { id: "pnpm-store", title: "pnpm global store", path: "C:\\Users\\real\\AppData\\Local\\pnpm\\store", bytes: 333 },
      planId: "plan-pnpm",
      scanFingerprint: "scan-pnpm",
      consentPlanId: "plan-pnpm",
      expectedBytes: 333
    },
    {
      __TAURI__: {
        core: {
          invoke(command, payload) {
            pnpmExecutionInvocation = { command, payload };
            return Promise.resolve({
              mode: "native-pnpm-store-executor",
              real_run_enabled: true,
              destructive_commands: true,
              accepted: true,
              reason: "accepted",
              contract_echo: {
                schema_version: payload.request.schemaVersion,
                request_mode: payload.request.requestMode,
                plan_id: payload.request.planId,
                route: payload.request.route,
                scan_fingerprint: payload.request.scanFingerprint,
                consent_plan_id: payload.request.consentPlanId,
                expected_bytes: payload.request.expectedBytes,
                dry_run_only: payload.request.dryRunOnly,
                mutation_attempted: payload.request.mutationAttempted,
                action_count: payload.request.actions.length
              },
              entries: [{ id: "pnpm-store", title: "pnpm global store", route: "bounded-pnpm-store-delete", result: "executed", reject_code: "", bytes: 111, note: "deleted old pnpm store" }],
              warnings: ["pnpm store done"]
            });
          }
        }
      }
    }
  );
  assert.strictEqual(pnpmExecutionInvocation.command, "execute_cleanup_plan", "pnpm store executor should invoke execute_cleanup_plan");
  assert.strictEqual(pnpmExecutionInvocation.payload.request.schemaVersion, "spaceguard-pnpm-store-request/v1", "pnpm store executor should use its schema");
  assert.strictEqual(pnpmExecutionInvocation.payload.request.requestMode, "execute-pnpm-store", "pnpm store executor should send execute-pnpm-store mode");
  assert.strictEqual(pnpmExecutionInvocation.payload.request.route, "bounded-pnpm-store-delete", "pnpm store executor should stay on bounded-pnpm-store-delete route");
  assert.strictEqual(pnpmExecutionInvocation.payload.request.dryRunOnly, false, "pnpm store executor should be a mutating request");
  assert.strictEqual(pnpmExecutionInvocation.payload.request.mutationAttempted, true, "pnpm store executor should require mutation confirmation");
  assert.strictEqual(pnpmExecutionInvocation.payload.request.actions[0].targetPath.endsWith("\\pnpm\\store"), true, "pnpm store executor should pass concrete store root path");
  assert.strictEqual(pnpmExecution.accepted, true, "pnpm store executor should normalize accepted responses");
  assert.strictEqual(pnpmExecution.entries[0].route, "bounded-pnpm-store-delete", "pnpm store executor should normalize executed route");
  let downloadsExecutionInvocation = null;
  const downloadsExecution = await native.runNativeDownloadsCleanupExecutor(
    {
      rows: [
        {
          id: "downloads-installers",
          title: "Old installers and archives in Downloads",
          reviewTargets: [
            {
              id: "setup-old",
              name: "setup-old.exe",
              path: "C:\\Users\\real\\Downloads\\setup-old.exe",
              bytes: 789
            }
          ]
        }
      ],
      planId: "plan-downloads",
      scanFingerprint: "scan-downloads",
      consentPlanId: "plan-downloads",
      expectedBytes: 789
    },
    {
      __TAURI__: {
        core: {
          invoke(command, payload) {
            downloadsExecutionInvocation = { command, payload };
            return Promise.resolve({
              mode: "native-downloads-recycle-bin-executor",
              real_run_enabled: true,
              destructive_commands: true,
              accepted: true,
              reason: "accepted",
              contract_echo: {
                schema_version: payload.request.schemaVersion,
                request_mode: payload.request.requestMode,
                plan_id: payload.request.planId,
                route: payload.request.route,
                scan_fingerprint: payload.request.scanFingerprint,
                consent_plan_id: payload.request.consentPlanId,
                expected_bytes: payload.request.expectedBytes,
                dry_run_only: payload.request.dryRunOnly,
                mutation_attempted: payload.request.mutationAttempted,
                action_count: payload.request.actions.length
              },
              entries: [{ id: "setup-old", title: "setup-old.exe", route: "item-review-recycle-bin", result: "executed", reject_code: "", bytes: 789, note: "moved through recycle bin" }],
              warnings: ["downloads done"]
            });
          }
        }
      }
    }
  );
  assert.strictEqual(downloadsExecutionInvocation.command, "execute_cleanup_plan", "Downloads executor should invoke execute_cleanup_plan");
  assert.strictEqual(downloadsExecutionInvocation.payload.request.schemaVersion, "spaceguard-downloads-recycle-bin-request/v1", "Downloads executor should use its schema");
  assert.strictEqual(downloadsExecutionInvocation.payload.request.requestMode, "execute-downloads-recycle-bin", "Downloads executor should send execute-downloads-recycle-bin mode");
  assert.strictEqual(downloadsExecutionInvocation.payload.request.route, "item-review-recycle-bin", "Downloads executor should stay on item-review-recycle-bin route");
  assert.strictEqual(downloadsExecutionInvocation.payload.request.dryRunOnly, false, "Downloads executor should be a mutating request");
  assert.strictEqual(downloadsExecutionInvocation.payload.request.mutationAttempted, true, "Downloads executor should require mutation confirmation");
  assert.strictEqual(downloadsExecutionInvocation.payload.request.actions[0].targetPath.endsWith("\\Downloads\\setup-old.exe"), true, "Downloads executor should pass only exact reviewed file paths");
  assert.strictEqual(downloadsExecution.accepted, true, "Downloads executor should normalize accepted responses");
  assert.strictEqual(downloadsExecution.entries[0].route, "item-review-recycle-bin", "Downloads executor should normalize executed route");
  let archiveExecutionInvocation = null;
  const archiveExecution = await native.runNativeLargeFileArchiveExecutor(
    {
      rows: [
        {
          id: "large-user-files",
          title: "Large personal files",
          archiveTargets: [
            {
              id: "old-video",
              name: "old-video.mov",
              path: "C:\\Users\\real\\Videos\\old-video.mov",
              bytes: 2 * guard.GB,
              decision: "archive"
            }
          ]
        }
      ],
      archiveDestination: "D:\\SpaceGuardArchive",
      planId: "plan-archive",
      scanFingerprint: "scan-archive",
      consentPlanId: "plan-archive",
      expectedBytes: 2 * guard.GB
    },
    {
      __TAURI__: {
        core: {
          invoke(command, payload) {
            archiveExecutionInvocation = { command, payload };
            return Promise.resolve({
              mode: "native-large-file-archive-executor",
              real_run_enabled: true,
              destructive_commands: true,
              accepted: true,
              reason: "accepted",
              contract_echo: {
                schema_version: payload.request.schemaVersion,
                request_mode: payload.request.requestMode,
                plan_id: payload.request.planId,
                route: payload.request.route,
                scan_fingerprint: payload.request.scanFingerprint,
                consent_plan_id: payload.request.consentPlanId,
                expected_bytes: payload.request.expectedBytes,
                dry_run_only: payload.request.dryRunOnly,
                mutation_attempted: payload.request.mutationAttempted,
                action_count: payload.request.actions.length
              },
              entries: [{ id: "old-video", title: "old-video.mov", route: "item-review-large-files", result: "executed", reject_code: "", bytes: 2 * guard.GB, note: "archived" }],
              warnings: ["archive done"]
            });
          }
        }
      }
    }
  );
  assert.strictEqual(archiveExecutionInvocation.command, "execute_cleanup_plan", "large-file archive executor should invoke execute_cleanup_plan");
  assert.strictEqual(archiveExecutionInvocation.payload.request.schemaVersion, "spaceguard-large-file-archive-request/v1", "large-file archive executor should use its schema");
  assert.strictEqual(archiveExecutionInvocation.payload.request.requestMode, "execute-large-file-archive", "large-file archive executor should send execute-large-file-archive mode");
  assert.strictEqual(archiveExecutionInvocation.payload.request.route, "item-review-large-files", "large-file archive executor should stay on item-review-large-files route");
  assert.strictEqual(archiveExecutionInvocation.payload.request.archiveDestination, "D:\\SpaceGuardArchive", "large-file archive executor should send explicit archive destination");
  assert.strictEqual(archiveExecutionInvocation.payload.request.dryRunOnly, false, "large-file archive executor should be a mutating request");
  assert.strictEqual(archiveExecutionInvocation.payload.request.mutationAttempted, true, "large-file archive executor should require mutation confirmation");
  assert.strictEqual(archiveExecutionInvocation.payload.request.actions[0].targetPath.endsWith("\\Videos\\old-video.mov"), true, "large-file archive executor should pass exact reviewed file paths");
  assert.strictEqual(archiveExecution.accepted, true, "large-file archive executor should normalize accepted responses");
  assert.strictEqual(archiveExecution.entries[0].route, "item-review-large-files", "large-file archive executor should normalize executed route");
  let recycleExecutionInvocation = null;
  const recycleExecution = await native.runNativeRecycleBinExecutor(
    {
      row: { id: "recycle-bin", title: "Recycle Bin", path: "C:\\$Recycle.Bin", bytes: 1234 },
      planId: "plan-recycle",
      scanFingerprint: "scan-recycle",
      consentPlanId: "plan-recycle",
      expectedBytes: 1234
    },
    {
      __TAURI__: {
        core: {
          invoke(command, payload) {
            recycleExecutionInvocation = { command, payload };
            return Promise.resolve({
              mode: "native-recycle-bin-executor",
              real_run_enabled: true,
              destructive_commands: true,
              accepted: true,
              reason: "accepted",
              contract_echo: {
                schema_version: payload.request.schemaVersion,
                request_mode: payload.request.requestMode,
                plan_id: payload.request.planId,
                route: payload.request.route,
                scan_fingerprint: payload.request.scanFingerprint,
                consent_plan_id: payload.request.consentPlanId,
                expected_bytes: payload.request.expectedBytes,
                dry_run_only: payload.request.dryRunOnly,
                mutation_attempted: payload.request.mutationAttempted,
                action_count: payload.request.actions.length
              },
              entries: [{ id: "recycle-bin", title: "Recycle Bin", route: "shell-recycle-bin", result: "executed", reject_code: "", bytes: 1111, note: "emptied recycle bin" }],
              warnings: ["recycle bin done"]
            });
          }
        }
      }
    }
  );
  assert.strictEqual(recycleExecutionInvocation.command, "execute_cleanup_plan", "Recycle Bin executor should invoke execute_cleanup_plan");
  assert.strictEqual(recycleExecutionInvocation.payload.request.schemaVersion, "spaceguard-recycle-bin-request/v1", "Recycle Bin executor should use its schema");
  assert.strictEqual(recycleExecutionInvocation.payload.request.requestMode, "execute-recycle-bin", "Recycle Bin executor should send execute-recycle-bin mode");
  assert.strictEqual(recycleExecutionInvocation.payload.request.route, "shell-recycle-bin", "Recycle Bin executor should stay on shell-recycle-bin route");
  assert.strictEqual(recycleExecutionInvocation.payload.request.dryRunOnly, false, "Recycle Bin executor should be a mutating request");
  assert.strictEqual(recycleExecutionInvocation.payload.request.mutationAttempted, true, "Recycle Bin executor should require mutation confirmation");
  assert.strictEqual(recycleExecutionInvocation.payload.request.permanentRemovalConfirmed, true, "Recycle Bin executor should require native permanent-removal acknowledgement");
  assert.strictEqual(recycleExecutionInvocation.payload.request.actions[0].targetPath.endsWith("\\$Recycle.Bin"), true, "Recycle Bin executor should pass concrete scan target path");
  assert.strictEqual(recycleExecution.accepted, true, "Recycle Bin executor should normalize accepted responses");
  assert.strictEqual(recycleExecution.entries[0].route, "shell-recycle-bin", "Recycle Bin executor should normalize executed route");
  const scaffoldedWrite = native.normalizeNativeWriteBoundary({
    mode: "native-write-rejected",
    real_run_enabled: false,
    destructive_commands: false,
    accepted: false,
    executor_scaffold: {
      route: "known-temp-delete",
      title: "Known temp roots",
      feature_flag: "tempCleanupExecutor",
      status: "feature-flag-disabled",
      validation_status: "validation-required",
      mutation_enabled: false
    },
    entries: []
  });
  assert.strictEqual(scaffoldedWrite.executorScaffold.route, "known-temp-delete", "write boundary should normalize scaffold route");
  assert.strictEqual(scaffoldedWrite.executorScaffold.featureFlag, "tempCleanupExecutor", "write boundary should normalize scaffold feature flag");
  assert.strictEqual(scaffoldedWrite.executorScaffold.status, "feature-flag-disabled", "write boundary should normalize scaffold status");
  assert.strictEqual(scaffoldedWrite.executorScaffold.mutationEnabled, false, "write boundary scaffold must keep mutation disabled");
  const preflightWrite = native.normalizeNativeWriteBoundary({
    accepted: false,
    real_run_enabled: false,
    destructive_commands: false,
    entries: [
      {
        id: "windows-temp",
        title: "Windows temporary files",
        route: "known-temp-delete",
        result: "rejected",
        reject_code: "temp-executor-feature-flag-disabled",
        bytes: 0,
        preflight_status: "executor-disabled-after-preflight",
        preflight_checks: [
          { id: "target-allowlist", label: "Target allowlist", status: "passed", detail: "Allowed temp root." },
          { id: "feature-flag", label: "Feature flag", status: "blocked", detail: "tempCleanupExecutor disabled." }
        ]
      }
    ]
  });
  assert.strictEqual(preflightWrite.entries[0].preflightStatus, "executor-disabled-after-preflight", "write boundary should normalize preflight status");
  assert.strictEqual(preflightWrite.entries[0].preflightChecks[0].id, "target-allowlist", "write boundary should normalize preflight checks");
  assert.strictEqual(preflightWrite.entries[0].preflightChecks[1].status, "blocked", "write boundary should preserve blocked preflight checks");

  const capabilities = native.normalizeNativeRuntimeCapabilities({
    mode: "native-readonly",
    platform: "windows",
    windows: true,
    elevated: true,
    elevation_source: "IsUserAnAdmin",
    real_run_enabled: false,
    destructive_commands: false,
    scan_known_roots: true,
    simulate_cleanup_plan: true,
    execute_cleanup_plan: true,
    openai_agent_advice: true,
    openai_advisor_configured: true,
    openai_key_source: ".env:OPENAI_API_KEY",
    safe_executors_enabled: false,
    executor_flags: {
      temp_cleanup_executor: false,
      project_dependency_executor: true,
      downloads_cleanup_executor: true,
      large_file_archive_executor: true,
      gradle_cache_executor: true,
      user_cache_executor: true,
      shader_cache_executor: true,
      npm_cache_executor: true,
      pnpm_store_executor: true,
      recycle_bin_executor: true,
      browser_cache_executor: true,
      tool_native_prune_executors: false
    },
    reason: "disabled"
  });
  assert.strictEqual(capabilities.elevated, true, "native capabilities should normalize elevation state");
  assert.strictEqual(capabilities.elevationSource, "IsUserAnAdmin", "native capabilities should normalize elevation source");
  assert.strictEqual(capabilities.realRunEnabled, false, "native capabilities should keep real run disabled");
  assert.strictEqual(capabilities.scanKnownRoots, true, "native capabilities should expose scanner availability");
  assert.strictEqual(capabilities.simulateCleanupPlan, true, "native capabilities should expose dry-run availability");
  assert.strictEqual(capabilities.executeCleanupPlan, true, "native capabilities should expose rejecting write boundary availability");
  assert.strictEqual(capabilities.openAiAgentAdvice, true, "native capabilities should expose OpenAI advisor availability");
  assert.strictEqual(capabilities.openAiAdvisorConfigured, true, "native capabilities should expose OpenAI key configuration without the key");
  assert.strictEqual(capabilities.openAiKeySource, ".env:OPENAI_API_KEY", "native capabilities should expose only the OpenAI key source");
  assert.deepStrictEqual(
    capabilities.executorFlags,
    {
      tempCleanupExecutor: false,
      projectDependencyExecutor: true,
      downloadsCleanupExecutor: true,
      largeFileArchiveExecutor: true,
      gradleCacheExecutor: true,
      userCacheExecutor: true,
      androidCacheExecutor: false,
      shaderCacheExecutor: true,
      npmCacheExecutor: true,
      pnpmStoreExecutor: true,
      recycleBinExecutor: true,
      browserCacheExecutor: true,
      toolNativePruneExecutors: false
    },
    "native capabilities should normalize per-executor feature flags"
  );

  console.log("native scanner adapter ok");
})();
