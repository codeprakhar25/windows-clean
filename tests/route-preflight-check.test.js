const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "run-route-preflight-check.mjs");

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spaceguard-route-preflight-"));
  const firstRouteCompletionCheck = path.join(dir, "first-route-completion-check.json");
  const artifacts = {
    commandLog: path.join(dir, "commands.ndjson"),
    setupDoctor: path.join(dir, "setup-doctor.json"),
    setupRoute: path.join(dir, "setup-route.json"),
    validateRoute: path.join(dir, "validate-route.json"),
    openAiFixtureSmoke: path.join(dir, "openai-fixture-smoke.txt"),
    openAiLiveSmoke: path.join(dir, "openai-live-smoke.txt"),
    operatorAppHandoff: path.join(dir, "operator-app-handoff.md"),
    selectedRouteProofPacket: path.join(dir, "spaceguard-selected-route-proof-packet.md"),
    workflowProof: path.join(dir, "spaceguard-real-workflow-proof.md"),
    workflowProofCheck: path.join(dir, "workflow-proof-check.json")
  };
  const preflight = {
    schemaVersion: "spaceguard-selected-route-windows-operator/v1",
    generatedAt: "2026-06-07T14:00:00.000Z",
    routeInput: "npm-cache",
    route: "bounded-npm-cache-delete",
    routeAlias: "npm-cache",
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
      validateWorkflowProof: "npm run validate:workflow-proof -- --file .\\spaceguard-real-workflow-proof.md"
    },
    ...patch.preflight
  };
  const firstRouteCompletion = {
    schemaVersion: "spaceguard-first-route-completion-check/v1",
    status: "accepted",
    canStartNextRoute: true,
    route: "known-temp-delete",
    counts: { reclaimedBytes: 1024, selectedRouteProofPacketReclaimedBytes: 1024 },
    ...patch.firstRouteCompletion
  };
  const setupDoctor = {
    schemaVersion: "spaceguard-setup-doctor/v1",
    status: "one-route-ready",
    scopedExecutors: {
      enabledCount: 1,
      selectedFlag: "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR",
      selectedRoute: { routeInput: "npm-cache", route: "bounded-npm-cache-delete" },
      validationStatus: "one-route-ready",
      safeToLaunchWriteMode: true,
      firstRouteProof: { status: "accepted", accepted: true }
    }
  };
  const setupRoute = {
    schemaVersion: "spaceguard-route-setup-packet/v1",
    status: "ready",
    routeInput: "npm-cache",
    route: "bounded-npm-cache-delete",
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
    routeInput: "npm-cache",
    route: "bounded-npm-cache-delete",
    selected: {
      envVar: "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR",
      requestMode: "execute-npm-cache",
      panelId: "npm-cache-executor-panel"
    },
    firstRouteProof: { status: "accepted", accepted: true },
    enabledFlags: ["SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR"],
    liveValidationManifest: {
      route: "bounded-npm-cache-delete",
      status: "ready",
      runtime: { routeFlagReady: true, canAttemptWindowsValidation: true, canExecuteWithoutAppEvidence: false },
      requiredAppEvidence: ["current-native-scan-fingerprint", "current-plan-consent-receipt", "native-scanned-target"],
      requiredPostRunProof: ["workflow-proof-check-output"]
    }
  };
  const commands = [
    "setup-doctor",
    "openai-fixture-smoke",
    "setup-route",
    "validate-route"
  ].map((id) => ({ id, command: id, outputPath: path.join(dir, `${id}.txt`), exitCode: 0 }));
  commands.push({
    id: "openai-live-smoke",
    command: "npm run openai:smoke -- --route npm-cache",
    outputPath: artifacts.openAiLiveSmoke,
    exitCode: null,
    skipped: true,
    reason: "OPENAI_API_KEY missing"
  });

  writeJson(path.join(dir, "operator-preflight.json"), preflight);
  writeJson(firstRouteCompletionCheck, firstRouteCompletion);
  writeJson(artifacts.setupDoctor, { ...setupDoctor, ...patch.setupDoctor }, { npmWrapped: true });
  writeJson(artifacts.setupRoute, { ...setupRoute, ...patch.setupRoute }, { npmWrapped: true });
  writeJson(artifacts.validateRoute, { ...validateRoute, ...patch.validateRoute }, { npmWrapped: true });
  writeText(
    artifacts.openAiFixtureSmoke,
    patch.openAiFixtureSmoke || "routeInput=npm-cache route=bounded-npm-cache-delete title=npm cache cleanup\nvalidation=broker-ready\n"
  );
  writeText(artifacts.openAiLiveSmoke, "");
  writeText(
    artifacts.operatorAppHandoff,
    patch.operatorAppHandoff || [
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
  writeNdjson(artifacts.commandLog, patch.commands || commands);
  return { dir, preflightPath: path.join(dir, "operator-preflight.json"), artifacts, firstRouteCompletionCheck };
}

(async () => {
  const verifier = await import(pathToFileURL(script).href);

  const acceptedFolder = createEvidenceFolder();
  const accepted = verifier.buildSelectedRoutePreflightCheck({
    preflightPath: acceptedFolder.preflightPath,
    checkedAt: "2026-06-07T14:30:00.000Z"
  });
  assert.strictEqual(accepted.schemaVersion, "spaceguard-selected-route-preflight-check/v1", "selected-route preflight check should expose a stable schema");
  assert.strictEqual(accepted.status, "accepted", "valid selected-route preflight should be accepted");
  assert.strictEqual(accepted.canLaunchApp, true, "accepted selected-route preflight should clear the app launch");
  assert.strictEqual(accepted.route, "bounded-npm-cache-delete", "accepted preflight should preserve native route");
  assert.strictEqual(accepted.routeInput, "npm-cache", "accepted preflight should preserve route input");
  assert.strictEqual(accepted.counts.requiredCommandsPassed, 4, "accepted preflight should count required command records");
  assert.strictEqual(accepted.counts.requiredArtifactsPresent, 6, "accepted preflight should count required artifacts");
  assert.strictEqual(accepted.appCloseContract.minimumReclaimedBytes, 1, "selected-route app-close contract should require positive recovered bytes");
  assert(accepted.appCloseContract.requiredBeforeClosingApp.includes("native-volume-proof-captured"), "selected-route preflight should require native volume proof before closing");

  const failedCommandFolder = createEvidenceFolder({
    commands: [
      { id: "setup-doctor", exitCode: 0 },
      { id: "openai-fixture-smoke", exitCode: 0 },
      { id: "setup-route", exitCode: 0 },
      { id: "validate-route", exitCode: 1 }
    ]
  });
  const failedCommand = verifier.buildSelectedRoutePreflightCheck({ preflightPath: failedCommandFolder.preflightPath });
  assert.strictEqual(failedCommand.status, "blocked", "failed route validation command should block selected-route preflight");
  assert(failedCommand.blockers.some((blocker) => blocker.id === "command-validate-route"), "failed command blocker should name validate-route");

  const missingProofFolder = createEvidenceFolder();
  fs.unlinkSync(missingProofFolder.firstRouteCompletionCheck);
  const missingProof = verifier.buildSelectedRoutePreflightCheck({ preflightPath: missingProofFolder.preflightPath });
  assert.strictEqual(missingProof.status, "blocked", "missing first-route proof should block selected-route preflight");
  assert(missingProof.blockers.some((blocker) => blocker.id === "first-route-completion"), "missing proof blocker should name first-route completion");

  const unsafeFolder = createEvidenceFolder({
    preflight: {
      directCleanupCommands: true,
      destructiveCommands: true,
      scopedExecutor: {
        enabledFlag: "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR",
        enabledValue: "1",
        dotenvExecutorFlagsIgnored: "0",
        siblingFlagsForcedOff: false
      }
    }
  });
  const unsafe = verifier.buildSelectedRoutePreflightCheck({ preflightPath: unsafeFolder.preflightPath });
  assert.strictEqual(unsafe.status, "blocked", "unsafe selected-route preflight should block");
  assert(unsafe.blockers.some((blocker) => blocker.id === "direct-cleanup"), "unsafe selected-route preflight should block direct cleanup authority");
  assert(unsafe.blockers.some((blocker) => blocker.id === "sibling-flags"), "unsafe selected-route preflight should block sibling flags");

  const routeMismatchFolder = createEvidenceFolder({
    setupRoute: { route: "bounded-pnpm-store-delete" }
  });
  const routeMismatch = verifier.buildSelectedRoutePreflightCheck({ preflightPath: routeMismatchFolder.preflightPath });
  assert.strictEqual(routeMismatch.status, "blocked", "route mismatch should block selected-route preflight");
  assert(routeMismatch.blockers.some((blocker) => blocker.id === "setup-route"), "route mismatch blocker should name setup-route");

  const missingHandoffFolder = createEvidenceFolder();
  fs.unlinkSync(missingHandoffFolder.artifacts.operatorAppHandoff);
  const missingHandoff = verifier.buildSelectedRoutePreflightCheck({ preflightPath: missingHandoffFolder.preflightPath });
  assert.strictEqual(missingHandoff.status, "blocked", "missing selected-route handoff should block preflight");
  assert(missingHandoff.blockers.some((blocker) => blocker.id === "operator-app-handoff"), "missing handoff blocker should name operator app handoff");

  console.log("route preflight check ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
