const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "run-first-route-preflight-check.mjs");

function writeJson(file, value, { npmWrapped = false } = {}) {
  const text = JSON.stringify(value, null, 2);
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

function createEvidenceFolder(patch = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spaceguard-preflight-"));
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
    operatorAppHandoff: path.join(dir, "operator-app-handoff.md")
  };
  const preflight = {
    schemaVersion: "spaceguard-first-route-windows-operator/v1",
    generatedAt: "2026-06-07T13:00:00.000Z",
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
    openAi: {
      liveSmokeConfigured: false,
      liveSmokeSkipped: true
    },
    artifacts,
    appCloseContract: {
      schemaVersion: "spaceguard-first-route-app-close-contract/v1",
      workflowProofPath: path.join(dir, "spaceguard-real-workflow-proof.md"),
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
    userGatedAppSteps: ["Run real scan in the Tauri desktop app.", "Select only Seeded temp fixture."],
    afterAppCommands: {
      inspectAfterCleanup: "powershell -ExecutionPolicy Bypass -File .\\scripts\\inspect-spaceguard-fixtures.ps1 -AfterCleanupRoute known-temp-delete",
      validateWorkflowProof: "npm run validate:workflow-proof -- --file .\\spaceguard-real-workflow-proof.md"
    },
    ...patch.preflight
  };

  const firstRouteProof = {
    schemaVersion: "spaceguard-first-route-proof-run/v1",
    status: "ready-for-windows-proof",
    routeInput: "temp-fixture",
    route: "known-temp-delete",
    recommendedFirstRoute: true,
    counts: { routeContracts: 14, routeContractsPassed: 14, routeContractsFailed: 0, validationReady: 1 }
  };
  const fixtureEvidence = {
    schemaVersion: "spaceguard-fixture-evidence/v1",
    passed: true,
    destructiveCommands: false,
    afterCleanupRoute: "",
    counts: { records: 6, missing: 0, sizeMismatches: 0, ageMismatches: 0 },
    records: [
      { purpose: "known-temp-fixture", exists: true, actualBytes: 8388608, expectedBytes: 8388608, presenceMatches: true },
      { purpose: "downloads-installers", exists: true, actualBytes: 16777216, expectedBytes: 16777216, presenceMatches: true }
    ]
  };
  const setupDoctor = {
    schemaVersion: "spaceguard-setup-doctor/v1",
    status: "one-route-ready",
    scopedExecutors: {
      enabledCount: 1,
      selectedFlag: "SPACEGUARD_ENABLE_TEMP_EXECUTOR",
      enabledFlags: ["SPACEGUARD_ENABLE_TEMP_EXECUTOR"],
      validationStatus: "one-route-ready",
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
  const commands = [
    "first-route-proof-packet",
    "seed-fixtures",
    "inspect-fixtures-before",
    "setup-doctor",
    "openai-fixture-smoke",
    "setup-route",
    "validate-route"
  ].map((id) => ({ id, command: id, outputPath: path.join(dir, `${id}.txt`), exitCode: 0 }));
  commands.push({
    id: "openai-live-smoke",
    command: "npm run openai:smoke -- --route temp-fixture",
    outputPath: artifacts.openAiLiveSmoke,
    exitCode: null,
    skipped: true,
    reason: "OPENAI_API_KEY missing"
  });

  writeJson(path.join(dir, "operator-preflight.json"), preflight);
  writeJson(artifacts.firstRouteProofPacket, { ...firstRouteProof, ...patch.firstRouteProof });
  writeJson(artifacts.fixtureManifest, { schemaVersion: "spaceguard-fixture-manifest/v1" });
  writeJson(artifacts.fixtureBeforeCleanup, { ...fixtureEvidence, ...patch.fixtureEvidence });
  writeJson(artifacts.setupDoctor, { ...setupDoctor, ...patch.setupDoctor }, { npmWrapped: true });
  writeJson(artifacts.setupRoute, { ...setupRoute, ...patch.setupRoute }, { npmWrapped: true });
  writeJson(artifacts.validateRoute, { ...validateRoute, ...patch.validateRoute }, { npmWrapped: true });
  writeText(
    artifacts.openAiFixtureSmoke,
    patch.openAiFixtureSmoke || "routeInput=temp route=known-temp-delete title=Known temp cleanup\nvalidation=broker-ready\n"
  );
  writeText(artifacts.openAiLiveSmoke, "");
  writeText(
    artifacts.operatorAppHandoff,
    patch.operatorAppHandoff || [
      "# SpaceGuard First-Route App Handoff",
      "",
      "Select only Seeded temp fixture under %TEMP%\\spaceguard-fixture.",
      "Export spaceguard-selected-route-proof-packet.md.",
      "Complete Selected route proof import with reviewer and artifact path.",
      "Export spaceguard-real-workflow-proof.md to the repo root.",
      "Resume with npm run proof:first-route:windows:finalize -- -EvidenceRoot evidence\\first-route-proof-YYYYMMDD-HHMMSS."
    ].join("\n")
  );
  writeNdjson(artifacts.commandLog, patch.commands || commands);
  return { dir, preflightPath: path.join(dir, "operator-preflight.json"), artifacts };
}

(async () => {
  const verifier = await import(pathToFileURL(script).href);

  const acceptedFolder = createEvidenceFolder();
  const accepted = verifier.buildFirstRoutePreflightCheck({
    preflightPath: acceptedFolder.preflightPath,
    checkedAt: "2026-06-07T13:30:00.000Z"
  });
  assert.strictEqual(accepted.schemaVersion, "spaceguard-first-route-preflight-check/v1", "preflight check should expose a stable schema");
  assert.strictEqual(accepted.status, "accepted", "valid first-route preflight evidence should be accepted");
  assert.strictEqual(accepted.canLaunchApp, true, "accepted preflight should clear the app launch");
  assert.strictEqual(accepted.route, "known-temp-delete", "accepted preflight should preserve selected route");
  assert.strictEqual(accepted.counts.requiredCommandsPassed, 7, "accepted preflight should count required command records");
  assert.strictEqual(accepted.counts.requiredArtifactsPresent, 9, "accepted preflight should count the operator app handoff artifact");
  assert.strictEqual(accepted.counts.appCloseRequirements, 4, "accepted preflight should count app-close requirements");
  assert(accepted.appCloseContract.workflowProofPath.endsWith("spaceguard-real-workflow-proof.md"), "preflight should expose the workflow proof export path");
  assert.strictEqual(accepted.appCloseContract.minimumReclaimedBytes, 1, "preflight should require positive recovered bytes");
  assert(accepted.appCloseContract.requiredBeforeClosingApp.includes("selected-route-proof-import-complete"), "preflight should require selected-route proof import before closing");

  const failedCommandFolder = createEvidenceFolder({
    commands: [
      { id: "first-route-proof-packet", exitCode: 0 },
      { id: "seed-fixtures", exitCode: 0 },
      { id: "inspect-fixtures-before", exitCode: 0 },
      { id: "setup-doctor", exitCode: 0 },
      { id: "openai-fixture-smoke", exitCode: 0 },
      { id: "setup-route", exitCode: 0 },
      { id: "validate-route", exitCode: 1 }
    ]
  });
  const failedCommand = verifier.buildFirstRoutePreflightCheck({ preflightPath: failedCommandFolder.preflightPath });
  assert.strictEqual(failedCommand.status, "blocked", "failed validation command should block preflight");
  assert(failedCommand.blockers.some((blocker) => blocker.id === "command-validate-route"), "failed command blocker should name validate-route");

  const missingExitCodeFolder = createEvidenceFolder({
    commands: [
      { id: "first-route-proof-packet", exitCode: 0 },
      { id: "seed-fixtures", exitCode: 0 },
      { id: "inspect-fixtures-before", exitCode: 0 },
      { id: "setup-doctor", exitCode: 0 },
      { id: "openai-fixture-smoke", exitCode: 0 },
      { id: "setup-route", exitCode: 0 },
      { id: "validate-route", exitCode: null }
    ]
  });
  const missingExitCode = verifier.buildFirstRoutePreflightCheck({ preflightPath: missingExitCodeFolder.preflightPath });
  assert.strictEqual(missingExitCode.status, "blocked", "missing command exit code should block preflight");
  assert(missingExitCode.blockers.some((blocker) => blocker.id === "command-validate-route"), "missing exit-code blocker should name validate-route");

  const skippedConfiguredLiveOpenAiFolder = createEvidenceFolder({
    preflight: {
      openAi: {
        liveSmokeConfigured: true,
        liveSmokeSkipped: true
      }
    }
  });
  const skippedConfiguredLiveOpenAi = verifier.buildFirstRoutePreflightCheck({ preflightPath: skippedConfiguredLiveOpenAiFolder.preflightPath });
  assert.strictEqual(skippedConfiguredLiveOpenAi.status, "blocked", "configured live OpenAI smoke must not be skipped");
  assert(
    skippedConfiguredLiveOpenAi.blockers.some((blocker) => blocker.id === "command-openai-live-smoke"),
    "configured live OpenAI skip blocker should name the live smoke command"
  );

  const unsafeFolder = createEvidenceFolder({
    preflight: {
      route: "bounded-npm-cache-delete",
      directCleanupCommands: true,
      destructiveCommands: true
    }
  });
  const unsafe = verifier.buildFirstRoutePreflightCheck({ preflightPath: unsafeFolder.preflightPath });
  assert.strictEqual(unsafe.status, "blocked", "unsafe preflight should block");
  assert(unsafe.blockers.some((blocker) => blocker.id === "route"), "unsafe preflight should block non-temp route");
  assert(unsafe.blockers.some((blocker) => blocker.id === "direct-cleanup"), "unsafe preflight should block direct cleanup authority");

  const missingAppCloseContractFolder = createEvidenceFolder({
    preflight: { appCloseContract: null }
  });
  const missingAppCloseContract = verifier.buildFirstRoutePreflightCheck({ preflightPath: missingAppCloseContractFolder.preflightPath });
  assert.strictEqual(missingAppCloseContract.status, "blocked", "missing app-close contract should block preflight");
  assert(missingAppCloseContract.blockers.some((blocker) => blocker.id === "app-close-contract"), "missing app-close contract blocker should name the app-close contract");

  const missingFixtureFolder = createEvidenceFolder({
    fixtureEvidence: {
      passed: false,
      counts: { records: 6, missing: 1, sizeMismatches: 0, ageMismatches: 0 },
      records: [{ purpose: "known-temp-fixture", exists: false, presenceMatches: false }]
    }
  });
  const missingFixture = verifier.buildFirstRoutePreflightCheck({ preflightPath: missingFixtureFolder.preflightPath });
  assert.strictEqual(missingFixture.status, "blocked", "missing temp fixture should block preflight");
  assert(missingFixture.blockers.some((blocker) => blocker.id === "fixture-before-cleanup"), "missing fixture blocker should name fixture evidence");

  const missingHandoffFolder = createEvidenceFolder();
  fs.unlinkSync(missingHandoffFolder.artifacts.operatorAppHandoff);
  const missingHandoff = verifier.buildFirstRoutePreflightCheck({ preflightPath: missingHandoffFolder.preflightPath });
  assert.strictEqual(missingHandoff.status, "blocked", "missing operator app handoff should block preflight");
  assert(missingHandoff.blockers.some((blocker) => blocker.id === "operator-app-handoff"), "missing handoff blocker should name operator app handoff");

  const invalidHandoffFolder = createEvidenceFolder({
    operatorAppHandoff: "Select broad Windows temporary files and close the app."
  });
  const invalidHandoff = verifier.buildFirstRoutePreflightCheck({ preflightPath: invalidHandoffFolder.preflightPath });
  assert.strictEqual(invalidHandoff.status, "blocked", "invalid operator app handoff should block preflight");
  assert(invalidHandoff.blockers.some((blocker) => blocker.id === "operator-app-handoff"), "invalid handoff blocker should name operator app handoff");

  const missingFile = verifier.buildFirstRoutePreflightCheck({ preflightPath: path.join(os.tmpdir(), "missing-preflight.json") });
  assert.strictEqual(missingFile.status, "read-error", "missing preflight file should return read-error");

  console.log("first route preflight check ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
