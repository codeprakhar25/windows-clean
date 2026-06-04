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
  const merged = native.mergeNativeScanIntoActions(actionList, scan);
  const gradle = merged.find((action) => action.id === "gradle-cache");
  const docker = merged.find((action) => action.id === "docker-build-cache");
  const largeFiles = merged.find((action) => action.id === "large-user-files");

  assert.strictEqual(gradle.bytes, 42 * guard.GB, "real scan bytes should replace demo bytes");
  assert.strictEqual(gradle.scanStatus, "measured", "measured findings should be marked");
  assert(gradle.path.includes("C:\\Users\\real"), "real scan path should replace demo path");
  assert.strictEqual(docker.bytes, 0, "unsupported native findings should not keep demo bytes");
  assert.strictEqual(docker.scanStatus, "unsupported", "unsupported native findings should be explicit");
  assert.strictEqual(largeFiles.bytes, 3 * guard.GB, "native large-file discovery should replace demo bytes");
  assert.strictEqual(largeFiles.scanStatus, "measured", "native large-file discovery should be marked measured");

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

  const largeFileReview = guard.buildItemReview("large-user-files", merged, scan, []);
  assert.strictEqual(largeFileReview.source, "native-readonly", "large-file item review should use native candidates when available");
  assert.strictEqual(largeFileReview.items[0].name, "old-export.mov", "native large-file candidate should be preserved");
  assert.strictEqual(largeFileReview.items[0].decision, "undecided", "native large-file candidate should require user decision");

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
            reason: "Old installer"
          }
        ]
      }
    ]
  });
  assert.strictEqual(normalizedWithItems.findings[0].items[0].ageDays, 45, "native item age should normalize to camelCase");
  assert.strictEqual(normalizedWithItems.findings[0].items[0].recommendation, "review", "native item recommendation should be preserved");
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
    safe_executors_enabled: false,
    reason: "disabled"
  });
  assert.strictEqual(capabilities.elevated, true, "native capabilities should normalize elevation state");
  assert.strictEqual(capabilities.elevationSource, "IsUserAnAdmin", "native capabilities should normalize elevation source");
  assert.strictEqual(capabilities.realRunEnabled, false, "native capabilities should keep real run disabled");
  assert.strictEqual(capabilities.scanKnownRoots, true, "native capabilities should expose scanner availability");
  assert.strictEqual(capabilities.simulateCleanupPlan, true, "native capabilities should expose dry-run availability");
  assert.strictEqual(capabilities.executeCleanupPlan, true, "native capabilities should expose rejecting write boundary availability");

  console.log("native scanner adapter ok");
})();
