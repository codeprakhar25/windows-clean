const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "run-route-completion-check.mjs");

function writeJson(file, value, { npmWrapped = false, markdown = false } = {}) {
  const text = JSON.stringify(value, null, 2);
  if (markdown) {
    fs.writeFileSync(file, ["# SpaceGuard Route Proof", "", "```json", text, "```", ""].join("\n"));
    return;
  }
  fs.writeFileSync(
    file,
    npmWrapped ? ["> windows-clean@0.1.0 command", "> node script", "", text, ""].join("\n") : text
  );
}

function writeText(file, value) {
  fs.writeFileSync(file, value);
}

function writeNdjson(file, records) {
  fs.writeFileSync(file, records.map((record) => JSON.stringify(record)).join("\n") + "\n");
}

function createSelectedRouteEvidence(patch = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spaceguard-route-complete-"));
  const firstRouteCompletionCheck = path.join(dir, "first-route-completion-check.json");
  const artifacts = {
    commandLog: path.join(dir, "commands.ndjson"),
    setupDoctor: path.join(dir, "setup-doctor.json"),
    setupRoute: path.join(dir, "setup-route.json"),
    validateRoute: path.join(dir, "validate-route.json"),
    routePreflightCheck: path.join(dir, "operator-preflight-check.json"),
    openAiFixtureSmoke: path.join(dir, "openai-fixture-smoke.txt"),
    openAiLiveSmoke: path.join(dir, "openai-live-smoke.txt"),
    nativeDevExit: path.join(dir, "native-dev-exit.json"),
    operatorAppHandoff: path.join(dir, "operator-app-handoff.md"),
    selectedRouteProofPacket: path.join(dir, "spaceguard-selected-route-proof-packet.md"),
    workflowProof: path.join(dir, "spaceguard-real-workflow-proof.md"),
    workflowProofCheck: path.join(dir, "workflow-proof-check.json"),
    postAppFinalization: path.join(dir, "post-app-finalization.json"),
    selectedRouteCompletionCheck: path.join(dir, "selected-route-completion-check.json")
  };
  const route = "bounded-npm-cache-delete";
  const routeInput = "npm-cache";
  const preflight = {
    schemaVersion: "spaceguard-selected-route-windows-operator/v1",
    generatedAt: "2026-06-08T10:00:00.000Z",
    routeInput,
    route,
    routeAlias: routeInput,
    requestMode: "execute-npm-cache",
    panelId: "npm-cache-executor-panel",
    evidenceRoot: dir,
    firstRouteCompletionCheck,
    destructiveCommands: false,
    directCleanupCommands: false,
    scopedExecutor: {
      enabledFlag: "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR",
      enabledValue: "1",
      dotenvExecutorFlagsIgnored: "1",
      siblingFlagsForcedOff: true
    },
    artifacts,
    appCloseContract: {
      schemaVersion: "spaceguard-selected-route-app-close-contract/v1",
      workflowProofPath: artifacts.workflowProof,
      selectedRouteProofPacketPath: artifacts.selectedRouteProofPacket,
      expectedWorkflowProofSchema: "spaceguard-real-workflow-proof/v1",
      minimumReclaimedBytes: 1,
      nextRouteBlockedUntil: "validate:workflow-proof accepted",
      requiredBeforeClosingApp: [
        "native-volume-proof-captured",
        "post-run-rescan-matched",
        "selected-route-proof-packet-exported",
        "selected-route-proof-import-complete",
        "spaceguard-real-workflow-proof-exported"
      ]
    },
    userGatedAppSteps: ["Run real scan in the Tauri desktop app.", "Run post-run rescan."],
    afterAppCommands: {
      validateWorkflowProof: "npm run validate:workflow-proof -- --file .\\spaceguard-real-workflow-proof.md",
      validateSelectedRouteCompletion: "npm run validate:route-completion -- --preflight operator-preflight.json"
    },
    ...patch.preflight
  };
  const firstRouteCompletion = {
    schemaVersion: "spaceguard-first-route-completion-check/v1",
    status: "accepted",
    canStartNextRoute: true,
    route: "known-temp-delete",
    counts: { reclaimedBytes: 8388608, selectedRouteProofPacketReclaimedBytes: 8388608 },
    ...patch.firstRouteCompletion
  };
  const setupDoctor = {
    schemaVersion: "spaceguard-setup-doctor/v1",
    status: "one-route-ready",
    scopedExecutors: {
      enabledCount: 1,
      selectedFlag: "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR",
      selectedRoute: { routeInput, route },
      validationStatus: "one-route-ready",
      safeToLaunchWriteMode: true,
      firstRouteProof: { status: "accepted", accepted: true }
    }
  };
  const setupRoute = {
    schemaVersion: "spaceguard-route-setup-packet/v1",
    status: "ready",
    routeInput,
    route,
    selected: {
      envVar: "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR",
      enabled: true,
      requestMode: "execute-npm-cache",
      panelId: "npm-cache-executor-panel"
    },
    firstRouteProof: { status: "accepted", accepted: true }
  };
  const validateRoute = {
    schemaVersion: "spaceguard-windows-validation-packet/v1",
    status: "ready",
    routeInput,
    route,
    selected: {
      envVar: "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR",
      requestMode: "execute-npm-cache",
      panelId: "npm-cache-executor-panel"
    },
    firstRouteProof: { status: "accepted", accepted: true },
    enabledFlags: ["SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR"],
    liveValidationManifest: {
      route,
      status: "ready",
      runtime: { routeFlagReady: true, canAttemptWindowsValidation: true, canExecuteWithoutAppEvidence: false }
    }
  };
  const selectedRouteProofPacket = {
    schemaVersion: "spaceguard-selected-route-proof-packet/v1",
    generatedAt: "2026-06-08T10:40:00.000Z",
    status: "proof-complete",
    route,
    routeInput,
    rescanStatus: "matched",
    verificationStatus: "ready-for-rescan",
    scopedNativeExecution: true,
    postRunScanEvidence: true,
    readyForNextRoute: true,
    latestExecutionAt: "2026-06-08T10:35:00.000Z",
    scanGeneratedAt: "2026-06-08T10:36:00.000Z",
    counts: { ledgerEntries: 1, matchedRows: 1, reclaimedBytes: 1048576 },
    volumeProof: { status: "measured", drive: "C:", freeBytesDelta: 1048576, source: "GetDiskFreeSpaceExW" },
    validationImport: { status: "import-complete", complete: true, route, evidencePath: artifacts.selectedRouteProofPacket },
    ledgerEntries: [{ id: "npm-cache-cleanup", route, result: "executed", bytes: 1048576 }],
    rescanRows: [{ id: "npm-cache-cleanup", route, state: "matched", actualBytes: 0, expectedBytes: 1048576 }],
    ...patch.selectedRouteProofPacket
  };
  const workflowProof = {
    schemaVersion: "spaceguard-real-workflow-proof/v1",
    generatedAt: "2026-06-08T10:45:00.000Z",
    status: "workflow-proven",
    route,
    routeInput,
    appCloseContract: {
      schemaVersion: "spaceguard-selected-route-app-close-contract/v1",
      workflowProofPath: ".\\spaceguard-real-workflow-proof.md",
      selectedRouteProofPacketPath: ".\\spaceguard-selected-route-proof-packet.md",
      expectedWorkflowProofSchema: "spaceguard-real-workflow-proof/v1",
      minimumReclaimedBytes: 1,
      nextRouteBlockedUntil: "validate:workflow-proof accepted",
      requiredBeforeClosingApp: [
        "native-volume-proof-captured",
        "post-run-rescan-matched",
        "selected-route-proof-packet-exported",
        "selected-route-proof-import-complete",
        "spaceguard-real-workflow-proof-exported"
      ]
    },
    proofStatus: "proof-complete",
    proofImportStatus: "import-complete",
    readyForNextRoute: true,
    unsafeRuntime: false,
    volumeProof: { status: "measured", measured: true, driveLabel: "C:", freeBytesDelta: 1048576, entries: 1 },
    counts: { ledgerEntries: 1, matchedRows: 1, reclaimedBytes: 1048576 },
    rows: [
      { id: "native-scan-current", passed: true },
      { id: "post-run-proof-complete", passed: true },
      { id: "selected-route-proof-import", passed: true },
      { id: "selected-route-proof-export", passed: true },
      { id: "native-volume-proof", passed: true },
      { id: "next-route-clearance", passed: true }
    ],
    ...patch.workflowProof
  };
  const nativeDevExit = {
    schemaVersion: "spaceguard-native-dev-exit/v1",
    generatedAt: "2026-06-08T10:30:00.000Z",
    command: "npm run native:dev",
    exitCode: 0,
    success: true,
    evidenceRoot: dir,
    postAppFinalizationPath: artifacts.postAppFinalization,
    ...patch.nativeDevExit
  };
  const commands = [
    "setup-doctor",
    "openai-fixture-smoke",
    "setup-route",
    "validate-route"
  ].map((id) => ({ id, command: id, outputPath: path.join(dir, `${id}.txt`), exitCode: 0 }));
  commands.push(
    { id: "validate-selected-route-preflight", command: "node scripts\\run-route-preflight-check.mjs", outputPath: artifacts.routePreflightCheck, exitCode: 0 },
    { id: "native-dev-launch", command: "npm run native:dev", outputPath: "", exitCode: null, userGated: true, startedAt: "2026-06-08T10:20:00.000Z" },
    { id: "native-dev-exit", command: "npm run native:dev", outputPath: artifacts.nativeDevExit, exitCode: 0, userGated: true, endedAt: "2026-06-08T10:30:00.000Z" },
    { id: "finalize-after-app", command: "validate selected-route workflow proof", outputPath: artifacts.postAppFinalization, exitCode: null, userGated: true },
    { id: "workflow-proof-check", command: "node scripts\\run-workflow-proof-check.mjs", outputPath: artifacts.workflowProofCheck, exitCode: 0 }
  );

  writeJson(path.join(dir, "operator-preflight.json"), preflight);
  writeJson(firstRouteCompletionCheck, firstRouteCompletion);
  writeJson(artifacts.setupDoctor, { ...setupDoctor, ...patch.setupDoctor }, { npmWrapped: true });
  writeJson(artifacts.setupRoute, { ...setupRoute, ...patch.setupRoute }, { npmWrapped: true });
  writeJson(artifacts.validateRoute, { ...validateRoute, ...patch.validateRoute }, { npmWrapped: true });
  writeText(artifacts.openAiFixtureSmoke, `routeInput=${routeInput} route=${route} title=npm cache cleanup\nvalidation=broker-ready\n`);
  writeText(artifacts.openAiLiveSmoke, "");
  writeText(
    artifacts.operatorAppHandoff,
    [
      "# SpaceGuard Selected-Route App Handoff",
      "",
      "Route: npm-cache",
      "Required flag: SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR",
      "Export spaceguard-selected-route-proof-packet.md.",
      "Complete Selected route proof import with reviewer and artifact path.",
      "Export spaceguard-real-workflow-proof.md to the repo root.",
      "Resume with npm run proof:route:windows:finalize -- -Route npm-cache -EvidenceRoot evidence\\route-proof-npm-cache-YYYYMMDD-HHMMSS."
    ].join("\n")
  );
  writeJson(artifacts.selectedRouteProofPacket, selectedRouteProofPacket, { markdown: true });
  writeJson(artifacts.workflowProof, workflowProof, { markdown: true });
  writeJson(artifacts.nativeDevExit, nativeDevExit);
  writeJson(artifacts.workflowProofCheck, { schemaVersion: "spaceguard-workflow-proof-check/v1", status: "accepted", canAccept: true });
  writeJson(artifacts.postAppFinalization, { schemaVersion: "spaceguard-selected-route-post-app-finalization/v1", status: "selected-route-workflow-proof-accepted" });
  writeNdjson(artifacts.commandLog, patch.commands || commands);

  return {
    dir,
    preflightPath: path.join(dir, "operator-preflight.json"),
    workflowProofPath: artifacts.workflowProof,
    nativeExitPath: artifacts.nativeDevExit,
    selectedRouteProofPacketPath: artifacts.selectedRouteProofPacket
  };
}

(async () => {
  const verifier = await import(pathToFileURL(script).href);

  const acceptedEvidence = createSelectedRouteEvidence();
  const accepted = verifier.buildSelectedRouteCompletionCheck({
    preflightPath: acceptedEvidence.preflightPath,
    workflowProofPath: acceptedEvidence.workflowProofPath,
    nativeExitPath: acceptedEvidence.nativeExitPath,
    checkedAt: "2026-06-08T11:00:00.000Z"
  });
  assert.strictEqual(accepted.schemaVersion, "spaceguard-selected-route-completion-check/v1", "completion check should expose a stable schema");
  assert.strictEqual(accepted.status, "accepted", "complete selected-route evidence should be accepted");
  assert.strictEqual(accepted.canStartNextRoute, true, "accepted selected-route completion should clear next route");
  assert.strictEqual(accepted.route, "bounded-npm-cache-delete", "completion should preserve selected native route");
  assert.strictEqual(accepted.routeInput, "npm-cache", "completion should preserve selected route input");
  assert.strictEqual(accepted.nativeExitPath, acceptedEvidence.nativeExitPath, "completion should expose native app exit evidence");
  assert.strictEqual(accepted.counts.nativeExitCode, 0, "completion should preserve successful native app exit code");
  assert.strictEqual(accepted.counts.routeCommandsPassed, 5, "completion should count required route command records");
  assert.strictEqual(accepted.counts.reclaimedBytes, 1048576, "completion should preserve workflow recovered bytes");
  assert.strictEqual(accepted.counts.selectedRouteProofPacketReclaimedBytes, 1048576, "completion should preserve selected-route packet recovered bytes");
  assert.strictEqual(accepted.counts.nativeLaunchStartedAt, "2026-06-08T10:20:00.000Z", "completion should expose the native launch timestamp used for proof freshness");

  const missingNativeExitEvidence = createSelectedRouteEvidence();
  fs.unlinkSync(missingNativeExitEvidence.nativeExitPath);
  const missingNativeExit = verifier.buildSelectedRouteCompletionCheck({
    preflightPath: missingNativeExitEvidence.preflightPath,
    workflowProofPath: missingNativeExitEvidence.workflowProofPath,
    nativeExitPath: missingNativeExitEvidence.nativeExitPath
  });
  assert.strictEqual(missingNativeExit.status, "blocked", "completion should block missing native exit evidence");
  assert(missingNativeExit.blockers.some((blocker) => blocker.id === "native-exit"), "missing native exit blocker should be surfaced");

  const wrongRouteEvidence = createSelectedRouteEvidence({
    selectedRouteProofPacket: { route: "bounded-gradle-cache-delete" }
  });
  const wrongRoute = verifier.buildSelectedRouteCompletionCheck({
    preflightPath: wrongRouteEvidence.preflightPath,
    workflowProofPath: wrongRouteEvidence.workflowProofPath,
    nativeExitPath: wrongRouteEvidence.nativeExitPath
  });
  assert.strictEqual(wrongRoute.status, "blocked", "completion should block selected-route proof route mismatch");
  assert(wrongRoute.blockers.some((blocker) => blocker.id === "selected-route-proof-packet"), "route mismatch blocker should name selected-route proof packet");

  const skippedFinalizeEvidence = createSelectedRouteEvidence({
    commands: [
      { id: "setup-doctor", exitCode: 0 },
      { id: "openai-fixture-smoke", exitCode: 0 },
      { id: "setup-route", exitCode: 0 },
      { id: "validate-route", exitCode: 0 },
      { id: "validate-selected-route-preflight", exitCode: 0 },
      { id: "native-dev-launch", exitCode: null, userGated: true },
      { id: "native-dev-exit", exitCode: 0, userGated: true },
      { id: "finalize-after-app", exitCode: null, userGated: true, skipped: true, reason: "SkipPostAppValidation" },
      { id: "workflow-proof-check", exitCode: 0 }
    ]
  });
  const skippedFinalize = verifier.buildSelectedRouteCompletionCheck({
    preflightPath: skippedFinalizeEvidence.preflightPath,
    workflowProofPath: skippedFinalizeEvidence.workflowProofPath,
    nativeExitPath: skippedFinalizeEvidence.nativeExitPath
  });
  assert.strictEqual(skippedFinalize.status, "blocked", "completion should block skipped post-app finalization");
  assert(skippedFinalize.blockers.some((blocker) => blocker.id === "command-finalize-after-app"), "skipped finalization blocker should be surfaced");

  const zeroByteWorkflowEvidence = createSelectedRouteEvidence({
    workflowProof: { counts: { ledgerEntries: 1, matchedRows: 1, reclaimedBytes: 0 } }
  });
  const zeroByteWorkflow = verifier.buildSelectedRouteCompletionCheck({
    preflightPath: zeroByteWorkflowEvidence.preflightPath,
    workflowProofPath: zeroByteWorkflowEvidence.workflowProofPath,
    nativeExitPath: zeroByteWorkflowEvidence.nativeExitPath
  });
  assert.strictEqual(zeroByteWorkflow.status, "blocked", "completion should block zero-byte workflow proof");
  assert(zeroByteWorkflow.blockers.some((blocker) => blocker.id === "workflow-proof"), "zero-byte workflow blocker should be surfaced");

  const staleProofPacketEvidence = createSelectedRouteEvidence({
    selectedRouteProofPacket: {
      generatedAt: "2026-06-08T10:10:00.000Z",
      latestExecutionAt: "2026-06-08T10:10:00.000Z",
      scanGeneratedAt: "2026-06-08T10:10:00.000Z"
    }
  });
  const staleProofPacket = verifier.buildSelectedRouteCompletionCheck({
    preflightPath: staleProofPacketEvidence.preflightPath,
    workflowProofPath: staleProofPacketEvidence.workflowProofPath,
    nativeExitPath: staleProofPacketEvidence.nativeExitPath
  });
  assert.strictEqual(staleProofPacket.status, "blocked", "completion should block proof packets older than the native app launch");
  assert(staleProofPacket.blockers.some((blocker) => blocker.id === "proof-freshness"), "stale proof packet blocker should be surfaced");

  const staleWorkflowProofEvidence = createSelectedRouteEvidence({
    workflowProof: {
      generatedAt: "2026-06-08T10:10:00.000Z"
    }
  });
  const staleWorkflowProof = verifier.buildSelectedRouteCompletionCheck({
    preflightPath: staleWorkflowProofEvidence.preflightPath,
    workflowProofPath: staleWorkflowProofEvidence.workflowProofPath,
    nativeExitPath: staleWorkflowProofEvidence.nativeExitPath
  });
  assert.strictEqual(staleWorkflowProof.status, "blocked", "completion should block workflow proof older than the native app launch");
  assert(staleWorkflowProof.blockers.some((blocker) => blocker.id === "proof-freshness"), "stale workflow proof blocker should be surfaced");

  console.log("route completion check ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
