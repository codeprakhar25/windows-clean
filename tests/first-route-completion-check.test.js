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
    nativeDevExit: path.join(dir, "native-dev-exit.json")
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
    status: "workflow-proven",
    route: "known-temp-delete",
    routeInput: "temp-fixture",
    proofStatus: "proof-complete",
    proofImportStatus: "import-complete",
    readyForNextRoute: true,
    unsafeRuntime: false,
    counts: { ledgerEntries: 1, matchedRows: 1, reclaimedBytes: 8388608 },
    rows: [
      { id: "native-scan-current", passed: true },
      { id: "post-run-proof-complete", passed: true },
      { id: "selected-route-proof-import", passed: true },
      { id: "next-route-clearance", passed: true }
    ]
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
  assert.strictEqual(accepted.counts.reclaimedBytes, 8388608, "completion check should preserve recovered bytes");

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
