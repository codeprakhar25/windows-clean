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
  assert.strictEqual(unavailable.volume, null, "browser fallback must not expose volume evidence");
  assert.strictEqual(unavailable.writeCapability, false, "browser fallback must not expose write capability");
  assert.strictEqual(unavailable.destructiveCommands, false, "browser fallback must not expose destructive commands");
  const executorUnavailable = await native.runNativeExecutorDryRun({ rows: [] }, {});
  assert.strictEqual(executorUnavailable.available, false, "native executor dry-run should report unavailable outside Tauri");
  assert.strictEqual(executorUnavailable.destructiveCommands, false, "native executor fallback must not expose destructive commands");
  const capabilityUnavailable = await native.getNativeRuntimeCapabilities({});
  assert.strictEqual(capabilityUnavailable.available, false, "runtime capability should report unavailable outside Tauri");
  assert.strictEqual(capabilityUnavailable.elevated, false, "browser runtime capability must not imply elevation");
  assert.strictEqual(capabilityUnavailable.realRunEnabled, false, "browser runtime capability must keep real run disabled");
  let scanInvocation = null;
  await native.runNativeReadonlyScan(
    {
      protectedPaths: ["C:\\Users\\demo\\ClientWork"],
      includeProjectArtifacts: false,
      maxDepth: 4,
      maxEntriesPerRoot: 5000
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

  const actionList = guard.buildScenarioActions("developer");
  const scan = native.normalizeNativeScan({
    mode: "native-readonly",
    platform: "windows",
    windows: true,
    volume: {
      drive: "C:",
      total_bytes: 512 * guard.GB,
      free_bytes: 64 * guard.GB,
      used_bytes: 448 * guard.GB,
      source: "GetDiskFreeSpaceExW"
    },
    totalBytes: 42 * guard.GB,
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
      }
    ],
    writeCapability: false,
    destructiveCommands: false
  });
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
        result: "dry-run",
        bytes: 123,
        note: "No mutation"
      }
    ],
    warnings: ["disabled"]
  });
  assert.strictEqual(dryRun.realRunEnabled, false, "native dry-run normalization should keep real run disabled");
  assert.strictEqual(dryRun.destructiveCommands, false, "native dry-run normalization should keep destructive commands disabled");
  assert.strictEqual(dryRun.entries[0].route, "known-temp-delete", "native dry-run route should be preserved");

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
    safe_executors_enabled: false,
    reason: "disabled"
  });
  assert.strictEqual(capabilities.elevated, true, "native capabilities should normalize elevation state");
  assert.strictEqual(capabilities.elevationSource, "IsUserAnAdmin", "native capabilities should normalize elevation source");
  assert.strictEqual(capabilities.realRunEnabled, false, "native capabilities should keep real run disabled");
  assert.strictEqual(capabilities.scanKnownRoots, true, "native capabilities should expose scanner availability");
  assert.strictEqual(capabilities.simulateCleanupPlan, true, "native capabilities should expose dry-run availability");

  console.log("native scanner adapter ok");
})();
