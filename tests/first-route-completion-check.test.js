const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "run-first-route-completion-check.mjs");

function writeJson(file, value, { npmWrapped = false, markdown = false } = {}) {
  const text = JSON.stringify(value, null, 2);
  if (markdown) {
    fs.writeFileSync(file, ["# SpaceGuard Real Workflow Proof", "", "```json", text, "```", ""].join("\n"));
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

function createFirstRouteEvidence(patch = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spaceguard-complete-"));
  const artifacts = {
    commandLog: path.join(dir, "commands.ndjson"),
    firstRouteProofPacket: path.join(dir, "first-route-proof-packet.json"),
    fixtureManifest: path.join(dir, "fixture-manifest.json"),
    fixtureBeforeCleanup: path.join(dir, "fixture-before-cleanup.json"),
    fixtureAfterCleanup: path.join(dir, "fixture-after-cleanup.json"),
    setupDoctor: path.join(dir, "setup-doctor.json"),
    setupRoute: path.join(dir, "setup-route.json"),
    validateRoute: path.join(dir, "validate-route.json"),
    openAiFixtureSmoke: path.join(dir, "openai-fixture-smoke.txt"),
    openAiLiveSmoke: path.join(dir, "openai-live-smoke.txt"),
    nativeDevExit: path.join(dir, "native-dev-exit.json"),
    operatorAppHandoff: path.join(dir, "operator-app-handoff.md"),
    selectedRouteProofPacket: path.join(dir, "spaceguard-selected-route-proof-packet.md")
  };
  const preflight = {
    schemaVersion: "spaceguard-first-route-windows-operator/v1",
    routeInput: "temp-fixture",
    route: "known-temp-delete",
    evidenceRoot: dir,
    destructiveCommands: false,
    directCleanupCommands: false,
    scopedExecutor: {
      enabledFlag: "SPACEGUARD_ENABLE_TEMP_EXECUTOR",
      enabledValue: "1",
      dotenvExecutorFlagsIgnored: "1",
      siblingFlagsForcedOff: true
    },
    artifacts
  };
  preflight.appCloseContract = {
    schemaVersion: "spaceguard-first-route-app-close-contract/v1",
    workflowProofPath: path.join(dir, "spaceguard-real-workflow-proof.md"),
    selectedRouteProofPacketPath: artifacts.selectedRouteProofPacket,
    expectedWorkflowProofSchema: "spaceguard-real-workflow-proof/v1",
    minimumReclaimedBytes: 1,
    nextRouteBlockedUntil: "validate:first-route-completion accepted",
    requiredBeforeClosingApp: [
      "post-run-rescan-matched",
      "selected-route-proof-packet-exported",
      "selected-route-proof-import-complete",
      "spaceguard-real-workflow-proof-exported"
    ]
  };
  const firstRouteProof = {
    schemaVersion: "spaceguard-first-route-proof-run/v1",
    status: "ready-for-windows-proof",
    routeInput: "temp-fixture",
    route: "known-temp-delete",
    recommendedFirstRoute: true,
    counts: { routeContracts: 14, routeContractsPassed: 14, routeContractsFailed: 0, validationReady: 1 }
  };
  const fixtureBefore = {
    schemaVersion: "spaceguard-fixture-evidence/v1",
    generatedAt: "2026-06-07T13:10:00.000Z",
    passed: true,
    destructiveCommands: false,
    afterCleanupRoute: "",
    counts: { records: 2, missing: 0, sizeMismatches: 0, ageMismatches: 0 },
    records: [
      { purpose: "known-temp-fixture", exists: true, actualBytes: 8388608, expectedBytes: 8388608, presenceMatches: true },
      { purpose: "downloads-installers", exists: true, actualBytes: 16777216, expectedBytes: 16777216, presenceMatches: true }
    ]
  };
  const fixtureAfter = {
    schemaVersion: "spaceguard-fixture-evidence/v1",
    generatedAt: "2026-06-07T14:35:00.000Z",
    passed: true,
    destructiveCommands: false,
    afterCleanupRoute: "known-temp-delete",
    counts: {
      records: 2,
      missing: 0,
      expectedMissingAfterCleanup: 1,
      unexpectedPresentAfterCleanup: 0,
      sizeMismatches: 0,
      ageMismatches: 0
    },
    records: [
      {
        purpose: "known-temp-fixture",
        exists: false,
        actualBytes: 0,
        expectedBytes: 8388608,
        expectedMissingAfterCleanup: true,
        presenceMatches: true
      },
      {
        purpose: "downloads-installers",
        exists: true,
        actualBytes: 16777216,
        expectedBytes: 16777216,
        expectedMissingAfterCleanup: false,
        presenceMatches: true,
        sizeMatches: true,
        oldEnough: true
      }
    ]
  };
  const setupDoctor = {
    schemaVersion: "spaceguard-setup-doctor/v1",
    status: "one-route-ready",
    scopedExecutors: {
      enabledCount: 1,
      selectedFlag: "SPACEGUARD_ENABLE_TEMP_EXECUTOR",
      enabledFlags: ["SPACEGUARD_ENABLE_TEMP_EXECUTOR"],
      safeToLaunchWriteMode: true
    }
  };
  const setupRoute = {
    schemaVersion: "spaceguard-route-setup-packet/v1",
    status: "ready",
    routeInput: "temp-fixture",
    route: "known-temp-delete",
    selected: { envVar: "SPACEGUARD_ENABLE_TEMP_EXECUTOR", enabled: true }
  };
  const validateRoute = {
    schemaVersion: "spaceguard-windows-validation-packet/v1",
    status: "ready",
    routeInput: "temp-fixture",
    route: "known-temp-delete",
    enabledFlags: ["SPACEGUARD_ENABLE_TEMP_EXECUTOR"],
    liveValidationManifest: {
      route: "known-temp-delete",
      status: "ready",
      runtime: { routeFlagReady: true, canAttemptWindowsValidation: true, canExecuteWithoutAppEvidence: false }
    }
  };
  const workflowProof = {
    schemaVersion: "spaceguard-real-workflow-proof/v1",
    generatedAt: "2026-06-07T14:45:00.000Z",
    status: "workflow-proven",
    route: "known-temp-delete",
    routeInput: "temp-fixture",
    appCloseContract: {
      schemaVersion: "spaceguard-first-route-app-close-contract/v1",
      workflowProofPath: ".\\spaceguard-real-workflow-proof.md",
      selectedRouteProofPacketPath: ".\\spaceguard-selected-route-proof-packet.md",
      expectedWorkflowProofSchema: "spaceguard-real-workflow-proof/v1",
      minimumReclaimedBytes: 1,
      nextRouteBlockedUntil: "validate:first-route-completion accepted",
      requiredBeforeClosingApp: [
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
    counts: { ledgerEntries: 1, matchedRows: 1, reclaimedBytes: 8388608 },
    rows: [
      { id: "native-scan-current", passed: true },
      { id: "post-run-proof-complete", passed: true },
      { id: "selected-route-proof-import", passed: true },
      { id: "selected-route-proof-export", passed: true },
      { id: "next-route-clearance", passed: true }
    ]
  };
  const selectedRouteProofPacket = {
    schemaVersion: "spaceguard-selected-route-proof-packet/v1",
    generatedAt: "2026-06-07T14:40:00.000Z",
    status: "proof-complete",
    route: "known-temp-delete",
    routeInput: "temp-fixture",
    rescanStatus: "matched",
    verificationStatus: "ready-for-rescan",
    scopedNativeExecution: true,
    postRunScanEvidence: true,
    readyForNextRoute: true,
    latestExecutionAt: "2026-06-07T14:30:00.000Z",
    scanGeneratedAt: "2026-06-07T14:35:00.000Z",
    counts: { ledgerEntries: 1, matchedRows: 1, reclaimedBytes: 8388608 },
    volumeProof: { status: "measured", drive: "C:", freeBytesDelta: 8388608, source: "GetDiskFreeSpaceExW" },
    validationImport: { status: "import-complete", complete: true, route: "known-temp-delete", evidencePath: artifacts.selectedRouteProofPacket },
    ledgerEntries: [{ id: "temp-fixture-cleanup", route: "known-temp-delete", result: "executed", bytes: 8388608 }],
    rescanRows: [{ id: "temp-fixture-cleanup", route: "known-temp-delete", state: "matched", actualBytes: 0, expectedBytes: 8388608 }]
  };
  const nativeDevExit = {
    schemaVersion: "spaceguard-native-dev-exit/v1",
    command: "npm run native:dev",
    exitCode: 0,
    success: true,
    evidenceRoot: dir
  };
  const commands = [
    "first-route-proof-packet",
    "seed-fixtures",
    "inspect-fixtures-before",
    "setup-doctor",
    "openai-fixture-smoke",
    "setup-route",
    "validate-route"
  ].map((id) => ({ id, command: id, outputPath: path.join(dir, `${id}.txt`), exitCode: 0 }));
  commands.push(
    {
      id: "native-dev-launch",
      command: "npm run native:dev",
      outputPath: "",
      exitCode: null,
      userGated: true,
      startedAt: "2026-06-07T14:20:00.000Z"
    },
    {
      id: "native-dev-exit",
      command: "npm run native:dev",
      outputPath: artifacts.nativeDevExit,
      exitCode: 0,
      userGated: true,
      endedAt: "2026-06-07T14:30:00.000Z"
    },
    {
      id: "finalize-after-app",
      command: "inspect fixtures, validate workflow proof, validate first-route completion",
      outputPath: path.join(dir, "post-app-finalization.json"),
      exitCode: null,
      userGated: true
    },
    {
      id: "inspect-fixtures-after",
      command: "inspect-fixtures-after",
      outputPath: path.join(dir, "inspect-fixtures-after.txt"),
      exitCode: 0
    },
    {
      id: "workflow-proof-check",
      command: "workflow-proof-check",
      outputPath: path.join(dir, "workflow-proof-check.json"),
      exitCode: 0
    }
  );

  writeJson(path.join(dir, "operator-preflight.json"), { ...preflight, ...patch.preflight });
  writeJson(artifacts.firstRouteProofPacket, { ...firstRouteProof, ...patch.firstRouteProof });
  writeJson(artifacts.fixtureManifest, { schemaVersion: "spaceguard-fixture-manifest/v1" });
  writeJson(artifacts.fixtureBeforeCleanup, { ...fixtureBefore, ...patch.fixtureBefore });
  writeJson(artifacts.fixtureAfterCleanup, { ...fixtureAfter, ...patch.fixtureAfter });
  writeJson(artifacts.setupDoctor, { ...setupDoctor, ...patch.setupDoctor }, { npmWrapped: true });
  writeJson(artifacts.setupRoute, { ...setupRoute, ...patch.setupRoute }, { npmWrapped: true });
  writeJson(artifacts.validateRoute, { ...validateRoute, ...patch.validateRoute }, { npmWrapped: true });
  writeText(artifacts.openAiFixtureSmoke, "routeInput=temp route=known-temp-delete title=Known temp cleanup\nvalidation=broker-ready\n");
  writeText(artifacts.openAiLiveSmoke, "");
  writeText(
    artifacts.operatorAppHandoff,
    [
      "# SpaceGuard First-Route App Handoff",
      "",
      "Select only Seeded temp fixture under %TEMP%\\spaceguard-fixture.",
      "Export spaceguard-selected-route-proof-packet.md.",
      "Complete Selected route proof import with reviewer and artifact path.",
      "Export spaceguard-real-workflow-proof.md to the repo root.",
      "Resume with npm run proof:first-route:windows:finalize -- -EvidenceRoot evidence\\first-route-proof-YYYYMMDD-HHMMSS."
    ].join("\n")
  );
  writeJson(artifacts.selectedRouteProofPacket, { ...selectedRouteProofPacket, ...patch.selectedRouteProofPacket }, { markdown: true });
  writeJson(artifacts.nativeDevExit, { ...nativeDevExit, ...patch.nativeDevExit });
  writeNdjson(artifacts.commandLog, patch.commands || commands);

  const workflowProofPath = path.join(dir, "spaceguard-real-workflow-proof.md");
  writeJson(workflowProofPath, { ...workflowProof, ...patch.workflowProof }, { markdown: true });
  return {
    dir,
    preflightPath: path.join(dir, "operator-preflight.json"),
    afterFixturePath: artifacts.fixtureAfterCleanup,
    workflowProofPath,
    nativeExitPath: artifacts.nativeDevExit
  };
}

(async () => {
  const verifier = await import(pathToFileURL(script).href);

  const acceptedEvidence = createFirstRouteEvidence();
  const accepted = verifier.buildFirstRouteCompletionCheck({
    preflightPath: acceptedEvidence.preflightPath,
    afterFixturePath: acceptedEvidence.afterFixturePath,
    workflowProofPath: acceptedEvidence.workflowProofPath,
    checkedAt: "2026-06-07T14:00:00.000Z"
  });
  assert.strictEqual(accepted.schemaVersion, "spaceguard-first-route-completion-check/v1", "completion check should expose a stable schema");
  assert.strictEqual(accepted.status, "accepted", "complete first-route evidence should be accepted");
  assert.strictEqual(accepted.canStartNextRoute, true, "accepted first-route completion should clear next route");
  assert.strictEqual(accepted.route, "known-temp-delete", "completion check should preserve the temp route");
  assert.strictEqual(accepted.nativeExitPath, acceptedEvidence.nativeExitPath, "completion check should expose native app exit evidence");
  assert.strictEqual(accepted.counts.nativeExitCode, 0, "completion check should preserve successful native app exit code");
  assert.strictEqual(accepted.counts.postAppCommandsPassed, 5, "completion check should count required post-app command records");
  assert.strictEqual(accepted.counts.reclaimedBytes, 8388608, "completion check should preserve recovered bytes");
  assert.strictEqual(accepted.counts.selectedRouteProofPacketReclaimedBytes, 8388608, "completion check should preserve selected-route proof packet recovered bytes");
  assert.strictEqual(accepted.counts.rescanExpectedBytes, 8388608, "completion should expose first-route rescan expected bytes");
  assert.strictEqual(accepted.counts.rescanActualRemainingBytes, 0, "completion should expose first-route rescan remaining bytes");
  assert.strictEqual(accepted.counts.nativeLaunchStartedAt, "2026-06-07T14:20:00.000Z", "completion should expose the native launch timestamp used for proof freshness");

  const retriedPostAppEvidence = createFirstRouteEvidence({
    commands: [
      "first-route-proof-packet",
      "seed-fixtures",
      "inspect-fixtures-before",
      "setup-doctor",
      "openai-fixture-smoke",
      "setup-route",
      "validate-route"
    ].map((id) => ({ id, command: id, outputPath: path.join(os.tmpdir(), `${id}.txt`), exitCode: 0 })).concat([
      {
        id: "native-dev-launch",
        command: "npm run native:dev",
        outputPath: "",
        exitCode: null,
        userGated: true,
        startedAt: "2026-06-07T14:20:00.000Z"
      },
      {
        id: "native-dev-exit",
        command: "npm run native:dev",
        outputPath: path.join(os.tmpdir(), "native-dev-exit.json"),
        exitCode: 0,
        userGated: true,
        endedAt: "2026-06-07T14:30:00.000Z"
      },
      {
        id: "finalize-after-app",
        command: "inspect fixtures, validate workflow proof, validate first-route completion",
        outputPath: path.join(os.tmpdir(), "post-app-finalization.json"),
        exitCode: null,
        userGated: true
      },
      {
        id: "workflow-proof-check",
        command: "workflow-proof-check",
        outputPath: path.join(os.tmpdir(), "workflow-proof-check.json"),
        exitCode: 1
      },
      {
        id: "inspect-fixtures-after",
        command: "inspect-fixtures-after",
        outputPath: path.join(os.tmpdir(), "inspect-fixtures-after.txt"),
        exitCode: 0
      },
      {
        id: "workflow-proof-check",
        command: "workflow-proof-check",
        outputPath: path.join(os.tmpdir(), "workflow-proof-check-retry.json"),
        exitCode: 0
      }
    ])
  });
  const retriedPostApp = verifier.buildFirstRouteCompletionCheck({
    preflightPath: retriedPostAppEvidence.preflightPath,
    afterFixturePath: retriedPostAppEvidence.afterFixturePath,
    workflowProofPath: retriedPostAppEvidence.workflowProofPath
  });
  assert.strictEqual(retriedPostApp.status, "accepted", "completion should use the latest post-app command record after a proof retry");
  assert.strictEqual(retriedPostApp.counts.postAppCommandsPassed, 5, "retried completion should count the latest successful post-app command records");

  const acceptedWithContractDefault = verifier.buildFirstRouteCompletionCheck({
    preflightPath: acceptedEvidence.preflightPath,
    afterFixturePath: acceptedEvidence.afterFixturePath,
    checkedAt: "2026-06-07T14:00:00.000Z"
  });
  assert.strictEqual(acceptedWithContractDefault.status, "accepted", "completion should default to the preflight app-close workflow proof path");
  assert.strictEqual(acceptedWithContractDefault.workflowProofPath, acceptedEvidence.workflowProofPath, "completion should expose the contracted workflow proof path");

  const wrongWorkflowProofPath = path.join(acceptedEvidence.dir, "wrong-workflow-proof.md");
  fs.copyFileSync(acceptedEvidence.workflowProofPath, wrongWorkflowProofPath);
  const mismatchedWorkflowPath = verifier.buildFirstRouteCompletionCheck({
    preflightPath: acceptedEvidence.preflightPath,
    afterFixturePath: acceptedEvidence.afterFixturePath,
    workflowProofPath: wrongWorkflowProofPath
  });
  assert.strictEqual(mismatchedWorkflowPath.status, "blocked", "completion should block workflow proof files outside the app-close contract path");
  assert(mismatchedWorkflowPath.blockers.some((blocker) => blocker.id === "workflow-proof-path"), "mismatched workflow proof path blocker should be surfaced");

  const stillPresentEvidence = createFirstRouteEvidence({
    fixtureAfter: {
      passed: false,
      counts: {
        records: 2,
        missing: 0,
        expectedMissingAfterCleanup: 1,
        unexpectedPresentAfterCleanup: 1,
        sizeMismatches: 0,
        ageMismatches: 0
      },
      records: [
        {
          purpose: "known-temp-fixture",
          exists: true,
          actualBytes: 8388608,
          expectedMissingAfterCleanup: true,
          presenceMatches: false
        }
      ]
    }
  });
  const stillPresent = verifier.buildFirstRouteCompletionCheck({
    preflightPath: stillPresentEvidence.preflightPath,
    afterFixturePath: stillPresentEvidence.afterFixturePath,
    workflowProofPath: stillPresentEvidence.workflowProofPath
  });
  assert.strictEqual(stillPresent.status, "blocked", "completion should block if temp fixture still exists");
  assert(stillPresent.blockers.some((blocker) => blocker.id === "after-fixture"), "fixture blocker should name after-fixture evidence");

  const missingSelectedRouteProofEvidence = createFirstRouteEvidence();
  fs.unlinkSync(path.join(missingSelectedRouteProofEvidence.dir, "spaceguard-selected-route-proof-packet.md"));
  const missingSelectedRouteProof = verifier.buildFirstRouteCompletionCheck({
    preflightPath: missingSelectedRouteProofEvidence.preflightPath,
    afterFixturePath: missingSelectedRouteProofEvidence.afterFixturePath,
    workflowProofPath: missingSelectedRouteProofEvidence.workflowProofPath
  });
  assert.strictEqual(missingSelectedRouteProof.status, "blocked", "completion should block missing selected-route proof packet export");
  assert(missingSelectedRouteProof.blockers.some((blocker) => blocker.id === "selected-route-proof-packet"), "missing selected-route proof packet blocker should be surfaced");

  const staleSelectedRouteProofEvidence = createFirstRouteEvidence({
    selectedRouteProofPacket: {
      readyForNextRoute: false,
      validationImport: { status: "needs-import", complete: false, route: "known-temp-delete" }
    }
  });
  const staleSelectedRouteProof = verifier.buildFirstRouteCompletionCheck({
    preflightPath: staleSelectedRouteProofEvidence.preflightPath,
    afterFixturePath: staleSelectedRouteProofEvidence.afterFixturePath,
    workflowProofPath: staleSelectedRouteProofEvidence.workflowProofPath
  });
  assert.strictEqual(staleSelectedRouteProof.status, "blocked", "completion should block stale proof packets exported before validation import");
  assert(staleSelectedRouteProof.blockers.some((blocker) => blocker.id === "selected-route-proof-packet"), "stale selected-route proof packet blocker should be surfaced");

  const wrongRescanRouteEvidence = createFirstRouteEvidence({
    selectedRouteProofPacket: {
      rescanRows: [{ id: "temp-fixture-cleanup", route: "bounded-npm-cache-delete", state: "matched", actualBytes: 0, expectedBytes: 8388608 }]
    }
  });
  const wrongRescanRoute = verifier.buildFirstRouteCompletionCheck({
    preflightPath: wrongRescanRouteEvidence.preflightPath,
    afterFixturePath: wrongRescanRouteEvidence.afterFixturePath,
    workflowProofPath: wrongRescanRouteEvidence.workflowProofPath
  });
  assert.strictEqual(wrongRescanRoute.status, "blocked", "completion should block first-route rescan rows from another route");
  assert(wrongRescanRoute.blockers.some((blocker) => blocker.id === "selected-route-rescan-rows"), "wrong first-route rescan route blocker should be surfaced");

  const rescanByteMismatchEvidence = createFirstRouteEvidence({
    selectedRouteProofPacket: {
      rescanRows: [{ id: "temp-fixture-cleanup", route: "known-temp-delete", state: "matched", actualBytes: 0, expectedBytes: 4096 }]
    }
  });
  const rescanByteMismatch = verifier.buildFirstRouteCompletionCheck({
    preflightPath: rescanByteMismatchEvidence.preflightPath,
    afterFixturePath: rescanByteMismatchEvidence.afterFixturePath,
    workflowProofPath: rescanByteMismatchEvidence.workflowProofPath
  });
  assert.strictEqual(rescanByteMismatch.status, "blocked", "completion should block first-route rescan bytes that do not match reclaimed bytes");
  assert(rescanByteMismatch.blockers.some((blocker) => blocker.id === "selected-route-rescan-bytes"), "first-route rescan byte mismatch blocker should be surfaced");

  const workflowByteMismatchEvidence = createFirstRouteEvidence({
    workflowProof: { counts: { ledgerEntries: 1, matchedRows: 1, reclaimedBytes: 4096 } }
  });
  const workflowByteMismatch = verifier.buildFirstRouteCompletionCheck({
    preflightPath: workflowByteMismatchEvidence.preflightPath,
    afterFixturePath: workflowByteMismatchEvidence.afterFixturePath,
    workflowProofPath: workflowByteMismatchEvidence.workflowProofPath
  });
  assert.strictEqual(workflowByteMismatch.status, "blocked", "completion should block first-route workflow proof bytes that disagree with selected-route proof bytes");
  assert(workflowByteMismatch.blockers.some((blocker) => blocker.id === "selected-route-proof-parity"), "first-route selected-route/workflow byte parity blocker should be surfaced");

  const mismatchedImportPathEvidence = createFirstRouteEvidence({
    selectedRouteProofPacket: {
      validationImport: {
        status: "import-complete",
        complete: true,
        route: "known-temp-delete",
        evidencePath: "other-selected-route-proof-packet.md"
      }
    }
  });
  const mismatchedImportPath = verifier.buildFirstRouteCompletionCheck({
    preflightPath: mismatchedImportPathEvidence.preflightPath,
    afterFixturePath: mismatchedImportPathEvidence.afterFixturePath,
    workflowProofPath: mismatchedImportPathEvidence.workflowProofPath
  });
  assert.strictEqual(mismatchedImportPath.status, "blocked", "completion should block proof imports that point to another selected-route artifact");
  assert(mismatchedImportPath.blockers.some((blocker) => blocker.id === "selected-route-proof-packet"), "mismatched selected-route proof import path blocker should be surfaced");

  const zeroByteEvidence = createFirstRouteEvidence({
    workflowProof: { counts: { ledgerEntries: 1, matchedRows: 1, reclaimedBytes: 0 } }
  });
  const zeroByte = verifier.buildFirstRouteCompletionCheck({
    preflightPath: zeroByteEvidence.preflightPath,
    afterFixturePath: zeroByteEvidence.afterFixturePath,
    workflowProofPath: zeroByteEvidence.workflowProofPath
  });
  assert.strictEqual(zeroByte.status, "blocked", "completion should block zero-byte workflow proof");
  assert(zeroByte.blockers.some((blocker) => blocker.id === "workflow-proof"), "workflow proof blocker should be surfaced");

  const staleAfterFixtureEvidence = createFirstRouteEvidence({
    fixtureAfter: { generatedAt: "2026-06-07T14:10:00.000Z" }
  });
  const staleAfterFixture = verifier.buildFirstRouteCompletionCheck({
    preflightPath: staleAfterFixtureEvidence.preflightPath,
    afterFixturePath: staleAfterFixtureEvidence.afterFixturePath,
    workflowProofPath: staleAfterFixtureEvidence.workflowProofPath
  });
  assert.strictEqual(staleAfterFixture.status, "blocked", "completion should block after-fixture evidence older than the native app launch");
  assert(staleAfterFixture.blockers.some((blocker) => blocker.id === "proof-freshness"), "stale after-fixture blocker should be surfaced");

  const staleSelectedRouteProofExportEvidence = createFirstRouteEvidence({
    selectedRouteProofPacket: {
      generatedAt: "2026-06-07T14:10:00.000Z",
      latestExecutionAt: "2026-06-07T14:10:00.000Z",
      scanGeneratedAt: "2026-06-07T14:10:00.000Z"
    }
  });
  const staleSelectedRouteProofExport = verifier.buildFirstRouteCompletionCheck({
    preflightPath: staleSelectedRouteProofExportEvidence.preflightPath,
    afterFixturePath: staleSelectedRouteProofExportEvidence.afterFixturePath,
    workflowProofPath: staleSelectedRouteProofExportEvidence.workflowProofPath
  });
  assert.strictEqual(staleSelectedRouteProofExport.status, "blocked", "completion should block selected-route proof exports older than the native app launch");
  assert(staleSelectedRouteProofExport.blockers.some((blocker) => blocker.id === "proof-freshness"), "stale selected-route proof export blocker should be surfaced");

  const staleWorkflowProofEvidence = createFirstRouteEvidence({
    workflowProof: { generatedAt: "2026-06-07T14:10:00.000Z" }
  });
  const staleWorkflowProof = verifier.buildFirstRouteCompletionCheck({
    preflightPath: staleWorkflowProofEvidence.preflightPath,
    afterFixturePath: staleWorkflowProofEvidence.afterFixturePath,
    workflowProofPath: staleWorkflowProofEvidence.workflowProofPath
  });
  assert.strictEqual(staleWorkflowProof.status, "blocked", "completion should block workflow proof older than the native app launch");
  assert(staleWorkflowProof.blockers.some((blocker) => blocker.id === "proof-freshness"), "stale workflow proof blocker should be surfaced");

  const failedNativeEvidence = createFirstRouteEvidence({
    nativeDevExit: { exitCode: 1, success: false }
  });
  const failedNative = verifier.buildFirstRouteCompletionCheck({
    preflightPath: failedNativeEvidence.preflightPath,
    afterFixturePath: failedNativeEvidence.afterFixturePath,
    workflowProofPath: failedNativeEvidence.workflowProofPath
  });
  assert.strictEqual(failedNative.status, "blocked", "completion should block a failed native desktop session");
  assert(failedNative.blockers.some((blocker) => blocker.id === "native-exit"), "native exit blocker should be surfaced");

  const missingPostAppLedgerEvidence = createFirstRouteEvidence({
    commands: [
      "first-route-proof-packet",
      "seed-fixtures",
      "inspect-fixtures-before",
      "setup-doctor",
      "openai-fixture-smoke",
      "setup-route",
      "validate-route"
    ].map((id) => ({ id, command: id, outputPath: path.join(os.tmpdir(), `${id}.txt`), exitCode: 0 }))
  });
  const missingPostAppLedger = verifier.buildFirstRouteCompletionCheck({
    preflightPath: missingPostAppLedgerEvidence.preflightPath,
    afterFixturePath: missingPostAppLedgerEvidence.afterFixturePath,
    workflowProofPath: missingPostAppLedgerEvidence.workflowProofPath
  });
  assert.strictEqual(missingPostAppLedger.status, "blocked", "completion should block missing post-app command ledger records");
  assert(missingPostAppLedger.blockers.some((blocker) => blocker.id === "command-finalize-after-app"), "missing post-app ledger blocker should name finalization");

  const missingPreflight = verifier.buildFirstRouteCompletionCheck({
    preflightPath: path.join(os.tmpdir(), "missing-operator-preflight.json"),
    afterFixturePath: acceptedEvidence.afterFixturePath,
    workflowProofPath: acceptedEvidence.workflowProofPath
  });
  assert.strictEqual(missingPreflight.status, "blocked", "completion should block missing preflight evidence");
  assert(missingPreflight.blockers.some((blocker) => blocker.id === "preflight"), "missing preflight blocker should be surfaced");

  console.log("first route completion check ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
