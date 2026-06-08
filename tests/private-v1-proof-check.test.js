const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "run-private-v1-proof-check.mjs");
const coordinatorPath = path.join(root, "scripts", "run-private-v1-windows-proof.ps1");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const windowsSetup = fs.readFileSync(path.join(root, "WINDOWS_REAL_DATA_SETUP.md"), "utf8");

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function writeNdjson(file, records) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, records.map((record) => JSON.stringify(record)).join("\n") + "\n");
}

function createPrivateV1Evidence(patch = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spaceguard-private-v1-"));
  const selectedRouteSetupPath = path.join(dir, "selected-route-setup.json");
  const preflightPath = path.join(dir, "private-demo-preflight", "private-demo-preflight.json");
  const firstRouteCompletionPath = path.join(dir, "first-route-proof", "first-route-completion-check.json");
  const selectedRouteCompletionPath = path.join(dir, "selected-route-proof-npm-cache", "selected-route-completion-check.json");
  const commandLogPath = path.join(dir, "commands.ndjson");
  const proofPath = path.join(dir, "private-v1-proof.json");
  const archivedProofPath = path.join(dir, "archived-first-route-root-exports", "spaceguard-real-workflow-proof.md");
  const privatePreflightCommandLogPath = path.join(dir, "private-demo-preflight", "commands.ndjson");
  const firstRouteCommandLogPath = path.join(dir, "first-route-proof", "commands.ndjson");
  const selectedRouteCommandLogPath = path.join(dir, "selected-route-proof-npm-cache", "commands.ndjson");
  const firstRouteFixtureSmokePath = path.join(dir, "first-route-proof", "openai-fixture-smoke.txt");
  const firstRouteLiveSmokePath = path.join(dir, "first-route-proof", "openai-live-smoke.txt");
  const selectedRouteFixtureSmokePath = path.join(dir, "selected-route-proof-npm-cache", "openai-fixture-smoke.txt");
  const selectedRouteLiveSmokePath = path.join(dir, "selected-route-proof-npm-cache", "openai-live-smoke.txt");
  const bundleArtifactPath = path.join(dir, "private-demo-preflight", "src-tauri", "target", "release", "bundle", "nsis", "SpaceGuard_0.1.0_x64-setup.exe");
  const bundleEvidencePath = path.join(dir, "private-demo-preflight", "native-bundle-artifacts", "SpaceGuard_0.1.0_x64-setup.exe");
  const bundleBytes = Buffer.from("spaceguard-native-bundle-fixture");
  const bundleSha256 = crypto.createHash("sha256").update(bundleBytes).digest("hex");

  const preflight = {
    schemaVersion: "spaceguard-private-demo-windows-preflight/v1",
    status: "passed",
    evidenceRoot: path.join(dir, "private-demo-preflight"),
    commandLogPath: privatePreflightCommandLogPath,
    commands: {
      nativeBuild: "npm run native:build",
      nextFirstRoute: "npm run proof:first-route:windows -- -Route temp-fixture",
      nextSelectedRoute: "npm run proof:route:windows -- -Route npm-cache"
    },
    nativeBundleArtifacts: [
      {
        path: bundleArtifactPath,
        fileName: "SpaceGuard_0.1.0_x64-setup.exe",
        extension: ".exe",
        bytes: bundleBytes.length,
        evidencePath: bundleEvidencePath,
        sha256: bundleSha256,
        modifiedAt: "2026-06-08T10:00:00.000Z"
      }
    ],
    ...patch.preflight
  };
  const selectedRouteSetup = {
    schemaVersion: "spaceguard-route-setup-packet/v1",
    status: "flag-disabled",
    routeInput: "npm-cache",
    route: "bounded-npm-cache-delete",
    selected: {
      route: "bounded-npm-cache-delete",
      aliases: ["npm-cache", "npm", "bounded-npm-cache-delete"],
      title: "npm cache cleanup",
      envVar: "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR",
      requestMode: "execute-npm-cache",
      panelId: "npm-cache-executor-panel",
      actionLabel: "Run npm cache cleanup",
      enabled: false
    },
    ...patch.selectedRouteSetup
  };
  const firstRouteCompletion = {
    schemaVersion: "spaceguard-first-route-completion-check/v1",
    status: "accepted",
    canStartNextRoute: true,
    route: "known-temp-delete",
    commandLogPath: firstRouteCommandLogPath,
    counts: {
      reclaimedBytes: 8388608,
      selectedRouteProofPacketReclaimedBytes: 8388608,
      ledgerReclaimedBytes: 8388608,
      rescanExpectedBytes: 8388608,
      rescanActualRemainingBytes: 0
    },
    ...patch.firstRouteCompletion
  };
  const selectedRouteCompletion = {
    schemaVersion: "spaceguard-selected-route-completion-check/v1",
    status: "accepted",
    canStartNextRoute: true,
    route: "bounded-npm-cache-delete",
    routeInput: "npm-cache",
    commandLogPath: selectedRouteCommandLogPath,
    counts: {
      reclaimedBytes: 1048576,
      selectedRouteProofPacketReclaimedBytes: 1048576,
      ledgerReclaimedBytes: 1048576,
      rescanExpectedBytes: 1048576,
      rescanActualRemainingBytes: 0
    },
    ...patch.selectedRouteCompletion
  };
  const privatePreflightOutputPath = path.join(dir, "private-demo-preflight.txt");
  const firstRouteProofOutputPath = path.join(dir, "first-route-proof.txt");
  const selectedRouteProofOutputPath = path.join(dir, "selected-route-proof.txt");
  const commands = [
    { id: "selected-route-setup", command: "node scripts\\run-setup-route.mjs --route \"npm-cache\"", outputPath: selectedRouteSetupPath, exitCode: 0 },
    { id: "private-windows-preflight", command: "npm run demo:private-windows-preflight", outputPath: privatePreflightOutputPath, stderrPath: `${privatePreflightOutputPath}.stderr.txt`, exitCode: 0 },
    { id: "first-route-proof", command: "npm run proof:first-route:windows -- -Route temp-fixture", outputPath: firstRouteProofOutputPath, stderrPath: `${firstRouteProofOutputPath}.stderr.txt`, exitCode: 0 },
    { id: "bind-first-route-completion", command: "set SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK", outputPath: firstRouteCompletionPath, exitCode: 0 },
    { id: "archive-first-route-root-exports", command: "archive first-route repo-root proof exports", outputPath: path.dirname(archivedProofPath), exitCode: 0 },
    { id: "selected-route-proof", command: "npm run proof:route:windows -- -Route npm-cache", outputPath: selectedRouteProofOutputPath, stderrPath: `${selectedRouteProofOutputPath}.stderr.txt`, exitCode: 0 },
    ...(patch.commands || [])
  ];
  const privatePreflightCommands = [
    { id: "js-tests", command: "npm test", outputPath: path.join(dir, "private-demo-preflight", "npm-test.txt"), exitCode: 0 },
    { id: "native-build", command: "npm run native:build", outputPath: path.join(dir, "private-demo-preflight", "native-build.txt"), exitCode: 0 },
    ...(patch.privatePreflightCommands || [])
  ];
  const firstRouteCommands = [
    { id: "openai-fixture-smoke", command: "npm run openai:smoke:fixture -- --route temp-fixture", outputPath: firstRouteFixtureSmokePath, stderrPath: `${firstRouteFixtureSmokePath}.stderr.txt`, exitCode: 0 },
    { id: "openai-live-smoke", command: "npm run openai:smoke -- --route temp-fixture", outputPath: firstRouteLiveSmokePath, stderrPath: `${firstRouteLiveSmokePath}.stderr.txt`, exitCode: 0 },
    ...(patch.firstRouteCommands || [])
  ];
  const selectedRouteCommands = [
    { id: "openai-fixture-smoke", command: "npm run openai:smoke:fixture -- --route npm-cache", outputPath: selectedRouteFixtureSmokePath, stderrPath: `${selectedRouteFixtureSmokePath}.stderr.txt`, exitCode: 0 },
    { id: "openai-live-smoke", command: "npm run openai:smoke -- --route npm-cache", outputPath: selectedRouteLiveSmokePath, stderrPath: `${selectedRouteLiveSmokePath}.stderr.txt`, exitCode: 0 },
    ...(patch.selectedRouteCommands || [])
  ];
  const proof = {
    schemaVersion: "spaceguard-private-v1-windows-proof/v1",
    generatedAt: "2026-06-08T11:00:00.000Z",
    startedAt: "2026-06-08T10:00:00.000Z",
    status: "accepted",
    selectedRoute: "npm-cache",
    evidenceRoot: dir,
    commandLogPath,
    destructiveCommands: false,
    directCleanupCommands: false,
    artifacts: {
      privateV1Proof: proofPath,
      selectedRouteSetup: selectedRouteSetupPath,
      privateWindowsPreflight: preflightPath,
      firstRouteCompletionCheck: firstRouteCompletionPath,
      selectedRouteCompletionCheck: selectedRouteCompletionPath,
      privateV1ProofCheck: path.join(dir, "private-v1-proof-check.json"),
      archivedFirstRouteRootExports: path.dirname(archivedProofPath)
    },
    routes: {
      firstRoute: "temp-fixture",
      firstRouteStatus: "accepted",
      selectedRoute: "npm-cache",
      selectedRouteSetupStatus: "flag-disabled",
      selectedRouteCanonical: "bounded-npm-cache-delete",
      selectedRouteStatus: "accepted"
    },
    firstRouteCompletion: {
      path: firstRouteCompletionPath,
      status: "accepted",
      canStartNextRoute: true,
      reclaimedBytes: 8388608,
      ledgerReclaimedBytes: 8388608,
      rescanExpectedBytes: 8388608,
      rescanActualRemainingBytes: 0
    },
    selectedRouteCompletion: {
      path: selectedRouteCompletionPath,
      status: "accepted",
      canStartNextRoute: true,
      route: "bounded-npm-cache-delete",
      reclaimedBytes: 1048576,
      ledgerReclaimedBytes: 1048576,
      rescanExpectedBytes: 1048576,
      rescanActualRemainingBytes: 0
    },
    archivedRootExports: [{ source: path.join(dir, "spaceguard-real-workflow-proof.md"), destination: archivedProofPath }],
    commands: {
      selectedRouteSetup: "node scripts\\run-setup-route.mjs --route \"npm-cache\"",
      privateWindowsPreflight: "npm run demo:private-windows-preflight",
      firstRouteProof: "npm run proof:first-route:windows -- -Route temp-fixture",
      selectedRouteProof: "npm run proof:route:windows -- -Route npm-cache"
    },
    ...patch.proof
  };

  writeJson(selectedRouteSetupPath, selectedRouteSetup);
  writeJson(preflightPath, preflight);
  writeJson(firstRouteCompletionPath, firstRouteCompletion);
  writeJson(selectedRouteCompletionPath, selectedRouteCompletion);
  for (const command of commands) {
    if (command.stderrPath) {
      fs.mkdirSync(path.dirname(command.stderrPath), { recursive: true });
      fs.writeFileSync(command.stderrPath, "");
    }
  }
  writeOpenAiSmokeEvidence(firstRouteFixtureSmokePath, { routeInput: "temp-fixture", route: "known-temp-delete", transport: "fixture-only" });
  writeOpenAiSmokeEvidence(firstRouteLiveSmokePath, { routeInput: "temp-fixture", route: "known-temp-delete", transport: "openai" });
  writeOpenAiSmokeEvidence(selectedRouteFixtureSmokePath, { routeInput: "npm-cache", route: "bounded-npm-cache-delete", transport: "fixture-only" });
  writeOpenAiSmokeEvidence(selectedRouteLiveSmokePath, { routeInput: "npm-cache", route: "bounded-npm-cache-delete", transport: "openai" });
  for (const command of [...firstRouteCommands, ...selectedRouteCommands]) {
    if (command.stderrPath) {
      fs.mkdirSync(path.dirname(command.stderrPath), { recursive: true });
      fs.writeFileSync(command.stderrPath, "");
    }
  }
  writeNdjson(commandLogPath, commands);
  writeNdjson(privatePreflightCommandLogPath, privatePreflightCommands);
  writeNdjson(firstRouteCommandLogPath, firstRouteCommands);
  writeNdjson(selectedRouteCommandLogPath, selectedRouteCommands);
  writeJson(proofPath, proof);
  fs.mkdirSync(path.dirname(archivedProofPath), { recursive: true });
  fs.writeFileSync(archivedProofPath, "# archived first route proof\n");
  fs.mkdirSync(path.dirname(bundleArtifactPath), { recursive: true });
  fs.writeFileSync(bundleArtifactPath, bundleBytes);
  fs.mkdirSync(path.dirname(bundleEvidencePath), { recursive: true });
  fs.writeFileSync(bundleEvidencePath, bundleBytes);

  return { dir, proofPath, commandLogPath, selectedRouteSetupPath, firstRouteCompletionPath, selectedRouteCompletionPath, privatePreflightCommandLogPath, firstRouteCommandLogPath, selectedRouteCommandLogPath };
}

function writeOpenAiSmokeEvidence(filePath, { routeInput, route, transport }) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, [
    "run-openai-advisor-smoke: OpenAI advisor smoke complete",
    "No local filesystem scan was performed; this used fixture data only.",
    `provider=openai model=gpt-5.2 transport=${transport}`,
    `routeInput=${routeInput} route=${route} title=Fixture route`,
    `required=run-npm-cache-executor route=${route} target=npm-cache`,
    "taskStatus=ready expected=ready",
    "validation=broker-ready",
    "summary=Fixture advice is broker ready."
  ].join("\n"));
}

(async () => {
  assert(fs.existsSync(script), "private V1 proof verifier should exist");
  assert(
    packageJson.scripts["validate:private-v1-proof"]?.includes("run-private-v1-proof-check.mjs"),
    "package.json should expose the private V1 proof verifier"
  );

  const verifier = await import(pathToFileURL(script).href);
  const acceptedEvidence = createPrivateV1Evidence();
  const accepted = verifier.buildPrivateV1ProofCheck({
    proofPath: acceptedEvidence.proofPath,
    checkedAt: "2026-06-08T11:05:00.000Z"
  });
  assert.strictEqual(accepted.schemaVersion, "spaceguard-private-v1-proof-check/v1", "verifier should expose a stable schema");
  assert.strictEqual(accepted.status, "accepted", "complete private V1 proof should be accepted");
  assert.strictEqual(accepted.canAcceptPrivateV1Proof, true, "accepted private V1 proof should be marked usable");
  assert.strictEqual(accepted.selectedRoute, "npm-cache", "verifier should preserve the selected route alias");
  assert.strictEqual(accepted.counts.reclaimedBytes, 1048576, "verifier should report selected-route reclaimed bytes");
  assert.strictEqual(accepted.counts.firstRouteRescanExpectedBytes, 8388608, "verifier should report first-route rescan expected bytes");
  assert.strictEqual(accepted.counts.selectedRouteRescanExpectedBytes, 1048576, "verifier should report selected-route rescan expected bytes");
  assert.strictEqual(accepted.counts.selectedRouteLedgerReclaimedBytes, 1048576, "verifier should report selected-route ledger reclaimed bytes");
  assert.strictEqual(accepted.counts.nativeBundleArtifacts, 1, "verifier should count native bundle artifacts");
  assert.strictEqual(accepted.counts.openAiSmokeArtifacts, 4, "verifier should count required child OpenAI smoke artifacts");
  assert.strictEqual(accepted.counts.commandRecords, 6, "verifier should count command ledger records");
  assert.strictEqual(accepted.blockers.length, 0, "accepted V1 proof should not have blockers");

  const reusedPreflight = createPrivateV1Evidence();
  const reusedPreflightRecords = fs.readFileSync(reusedPreflight.commandLogPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  const reusedPreflightRecord = reusedPreflightRecords.find((record) => record.id === "private-windows-preflight");
  reusedPreflightRecord.skipped = true;
  reusedPreflightRecord.reused = true;
  reusedPreflightRecord.reason = "SkipPreflightExistingEvidence";
  reusedPreflightRecord.outputPath = path.join(reusedPreflight.dir, "private-demo-preflight", "private-demo-preflight.json");
  delete reusedPreflightRecord.stderrPath;
  writeNdjson(reusedPreflight.commandLogPath, reusedPreflightRecords);
  const reusedPreflightCheck = verifier.buildPrivateV1ProofCheck({ proofPath: reusedPreflight.proofPath });
  assert.strictEqual(reusedPreflightCheck.status, "accepted", "reused passed private preflight evidence should be accepted for V1 proof");
  assert.strictEqual(reusedPreflightCheck.counts.requiredCommandsPassed, 6, "reused private preflight should count as a satisfied required command");

  const missingChildStderr = createPrivateV1Evidence();
  const childRecords = fs.readFileSync(missingChildStderr.commandLogPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  const firstRouteRecord = childRecords.find((record) => record.id === "first-route-proof");
  fs.unlinkSync(firstRouteRecord.stderrPath);
  writeNdjson(missingChildStderr.commandLogPath, childRecords);
  const missingChildStderrCheck = verifier.buildPrivateV1ProofCheck({ proofPath: missingChildStderr.proofPath });
  assert.strictEqual(missingChildStderrCheck.status, "blocked", "missing child command stderr evidence should block private V1 proof");
  assert(
    missingChildStderrCheck.blockers.some((blocker) => blocker.id === "command-stderr-first-route-proof"),
    "missing child command stderr blocker should name the command"
  );

  const missingSelectedOpenAi = createPrivateV1Evidence();
  const selectedChildRecords = fs.readFileSync(missingSelectedOpenAi.selectedRouteCommandLogPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  const selectedLiveOpenAiRecord = selectedChildRecords.find((record) => record.id === "openai-live-smoke");
  fs.unlinkSync(selectedLiveOpenAiRecord.outputPath);
  writeNdjson(missingSelectedOpenAi.selectedRouteCommandLogPath, selectedChildRecords);
  const missingSelectedOpenAiCheck = verifier.buildPrivateV1ProofCheck({ proofPath: missingSelectedOpenAi.proofPath });
  assert.strictEqual(missingSelectedOpenAiCheck.status, "blocked", "missing selected-route live OpenAI smoke evidence should block private V1 proof");
  assert(
    missingSelectedOpenAiCheck.blockers.some((blocker) => blocker.id === "selected-route-openai-live-smoke"),
    "missing selected-route live OpenAI smoke blocker should be explicit"
  );

  const childDirectCleanup = createPrivateV1Evidence({
    selectedRouteCommands: [
      { id: "unsafe-cleanup", command: "powershell -Command Remove-Item -Recurse C:\\Users\\demo\\Downloads\\old.zip", exitCode: 0 }
    ]
  });
  const childDirectCleanupCheck = verifier.buildPrivateV1ProofCheck({ proofPath: childDirectCleanup.proofPath });
  assert.strictEqual(childDirectCleanupCheck.status, "blocked", "direct cleanup commands in child evidence should block private V1 proof");
  assert(
    childDirectCleanupCheck.blockers.some((blocker) => blocker.id === "selected-route-command-direct-cleanup"),
    "child direct cleanup blocker should name the child route"
  );

  const preflightDirectCleanup = createPrivateV1Evidence({
    privatePreflightCommands: [
      { id: "unsafe-preflight-cleanup", command: "cmd /c rmdir /s /q C:\\Users\\demo\\Downloads\\old", exitCode: 0 }
    ]
  });
  const preflightDirectCleanupCheck = verifier.buildPrivateV1ProofCheck({ proofPath: preflightDirectCleanup.proofPath });
  assert.strictEqual(preflightDirectCleanupCheck.status, "blocked", "direct cleanup commands in private preflight evidence should block private V1 proof");
  assert(
    preflightDirectCleanupCheck.blockers.some((blocker) => blocker.id === "private-preflight-command-direct-cleanup"),
    "private preflight direct cleanup blocker should be explicit"
  );

  const missingSelectedRouteSetup = createPrivateV1Evidence();
  fs.unlinkSync(missingSelectedRouteSetup.selectedRouteSetupPath);
  const missingSelectedRouteSetupCheck = verifier.buildPrivateV1ProofCheck({ proofPath: missingSelectedRouteSetup.proofPath });
  assert.strictEqual(missingSelectedRouteSetupCheck.status, "blocked", "missing selected-route setup evidence should block private V1 proof");
  assert(
    missingSelectedRouteSetupCheck.blockers.some((blocker) => blocker.id === "selected-route-setup"),
    "selected-route setup blocker should be explicit"
  );

  const missingBind = createPrivateV1Evidence({
    commands: [],
    proof: {}
  });
  writeNdjson(missingBind.commandLogPath, [
    { id: "private-windows-preflight", command: "npm run demo:private-windows-preflight", exitCode: 0 },
    { id: "first-route-proof", command: "npm run proof:first-route:windows -- -Route temp-fixture", exitCode: 0 },
    { id: "archive-first-route-root-exports", command: "archive first-route repo-root proof exports", exitCode: 0 },
    { id: "selected-route-proof", command: "npm run proof:route:windows -- -Route npm-cache", exitCode: 0 }
  ]);
  const missingBindCheck = verifier.buildPrivateV1ProofCheck({ proofPath: missingBind.proofPath });
  assert.strictEqual(missingBindCheck.status, "blocked", "missing first-route binding should block private V1 proof");
  assert(
    missingBindCheck.blockers.some((blocker) => blocker.id === "command-bind-first-route-completion"),
    "missing binding blocker should be explicit"
  );

  const unsafeProof = createPrivateV1Evidence({ proof: { directCleanupCommands: true } });
  const unsafeCheck = verifier.buildPrivateV1ProofCheck({ proofPath: unsafeProof.proofPath });
  assert.strictEqual(unsafeCheck.status, "blocked", "direct cleanup authority in V1 proof should block acceptance");
  assert(
    unsafeCheck.blockers.some((blocker) => blocker.id === "direct-cleanup-commands"),
    "direct cleanup blocker should be explicit"
  );

  const selectedBlocked = createPrivateV1Evidence({
    selectedRouteCompletion: { status: "blocked", canStartNextRoute: false, counts: { reclaimedBytes: 0 } }
  });
  const selectedBlockedCheck = verifier.buildPrivateV1ProofCheck({ proofPath: selectedBlocked.proofPath });
  assert.strictEqual(selectedBlockedCheck.status, "blocked", "blocked selected-route completion should block private V1 proof");
  assert(
    selectedBlockedCheck.blockers.some((blocker) => blocker.id === "selected-route-completion"),
    "selected-route completion blocker should be explicit"
  );

  const missingSelectedRouteParity = createPrivateV1Evidence({
    selectedRouteCompletion: {
      counts: { reclaimedBytes: 1048576 }
    }
  });
  const missingSelectedRouteParityCheck = verifier.buildPrivateV1ProofCheck({ proofPath: missingSelectedRouteParity.proofPath });
  assert.strictEqual(missingSelectedRouteParityCheck.status, "blocked", "selected-route completion without rescan parity counts should block private V1 proof");
  assert(
    missingSelectedRouteParityCheck.blockers.some((blocker) => blocker.id === "selected-route-completion-parity"),
    "selected-route completion parity blocker should be explicit"
  );

  const mismatchedFirstRouteSummary = createPrivateV1Evidence({
    proof: {
      firstRouteCompletion: {
        status: "accepted",
        canStartNextRoute: true,
        reclaimedBytes: 8388608,
        ledgerReclaimedBytes: 4096,
        rescanExpectedBytes: 8388608,
        rescanActualRemainingBytes: 0
      }
    }
  });
  const mismatchedFirstRouteSummaryCheck = verifier.buildPrivateV1ProofCheck({ proofPath: mismatchedFirstRouteSummary.proofPath });
  assert.strictEqual(mismatchedFirstRouteSummaryCheck.status, "blocked", "private V1 summary bytes that disagree with first-route completion should block");
  assert(
    mismatchedFirstRouteSummaryCheck.blockers.some((blocker) => blocker.id === "first-route-completion-summary"),
    "first-route completion summary parity blocker should be explicit"
  );

  const missingBundle = createPrivateV1Evidence({ preflight: { nativeBundleArtifacts: [] } });
  const missingBundleCheck = verifier.buildPrivateV1ProofCheck({ proofPath: missingBundle.proofPath });
  assert.strictEqual(missingBundleCheck.status, "blocked", "missing native bundle artifact evidence should block private V1 proof");
  assert(
    missingBundleCheck.blockers.some((blocker) => blocker.id === "native-bundle-artifacts"),
    "native bundle artifact blocker should be explicit"
  );

  const missingBundleEvidence = createPrivateV1Evidence({
    preflight: {
      nativeBundleArtifacts: [
        {
          path: path.join(os.tmpdir(), "SpaceGuard_0.1.0_x64-setup.exe"),
          fileName: "SpaceGuard_0.1.0_x64-setup.exe",
          extension: ".exe",
          bytes: 10485760,
          sha256: "0".repeat(64)
        }
      ]
    }
  });
  const missingBundleEvidenceCheck = verifier.buildPrivateV1ProofCheck({ proofPath: missingBundleEvidence.proofPath });
  assert.strictEqual(missingBundleEvidenceCheck.status, "blocked", "missing copied bundle artifact evidence should block private V1 proof");
  assert(
    missingBundleEvidenceCheck.blockers.some((blocker) => blocker.id === "native-bundle-artifact-evidence"),
    "copied bundle evidence blocker should be explicit"
  );

  const coordinator = fs.readFileSync(coordinatorPath, "utf8");
  assert(coordinator.includes("private-v1-proof-check.json"), "V1 coordinator should write private V1 proof verifier output");
  assert(coordinator.includes("run-private-v1-proof-check.mjs --file"), "V1 coordinator should invoke the independent private V1 proof verifier");
  assert(gitignore.includes("private-v1-proof-check.json"), ".gitignore should exclude copied private V1 proof check artifacts");
  assert(readme.includes("npm run validate:private-v1-proof -- --file"), "README should document private V1 proof validation");
  assert(windowsSetup.includes("npm run validate:private-v1-proof -- --file"), "Windows setup guide should document private V1 proof validation");
  assert(readme.includes("native bundle artifact"), "README should mention native bundle artifact evidence in the V1 proof");
  assert(windowsSetup.includes("native bundle artifact"), "Windows setup guide should mention native bundle artifact evidence in the V1 proof");
  assert(readme.includes("copied native bundle artifact") && readme.includes("SHA-256"), "README should document copied native bundle artifact hashes");
  assert(windowsSetup.includes("copied native bundle artifact") && windowsSetup.includes("SHA-256"), "Windows setup guide should document copied native bundle artifact hashes");

  console.log("private v1 proof check ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
