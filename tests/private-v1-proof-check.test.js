const assert = require("assert");
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
  const preflightPath = path.join(dir, "private-demo-preflight", "private-demo-preflight.json");
  const firstRouteCompletionPath = path.join(dir, "first-route-proof", "first-route-completion-check.json");
  const selectedRouteCompletionPath = path.join(dir, "selected-route-proof-npm-cache", "selected-route-completion-check.json");
  const commandLogPath = path.join(dir, "commands.ndjson");
  const proofPath = path.join(dir, "private-v1-proof.json");
  const archivedProofPath = path.join(dir, "archived-first-route-root-exports", "spaceguard-real-workflow-proof.md");

  const preflight = {
    schemaVersion: "spaceguard-private-demo-windows-preflight/v1",
    status: "passed",
    evidenceRoot: path.join(dir, "private-demo-preflight"),
    commandLogPath: path.join(dir, "private-demo-preflight", "commands.ndjson"),
    commands: {
      nativeBuild: "npm run native:build",
      nextFirstRoute: "npm run proof:first-route:windows -- -Route temp-fixture",
      nextSelectedRoute: "npm run proof:route:windows -- -Route npm-cache"
    },
    ...patch.preflight
  };
  const firstRouteCompletion = {
    schemaVersion: "spaceguard-first-route-completion-check/v1",
    status: "accepted",
    canStartNextRoute: true,
    route: "known-temp-delete",
    counts: { reclaimedBytes: 8388608 },
    ...patch.firstRouteCompletion
  };
  const selectedRouteCompletion = {
    schemaVersion: "spaceguard-selected-route-completion-check/v1",
    status: "accepted",
    canStartNextRoute: true,
    route: "bounded-npm-cache-delete",
    routeInput: "npm-cache",
    counts: { reclaimedBytes: 1048576 },
    ...patch.selectedRouteCompletion
  };
  const commands = [
    { id: "private-windows-preflight", command: "npm run demo:private-windows-preflight", outputPath: preflightPath, exitCode: 0 },
    { id: "first-route-proof", command: "npm run proof:first-route:windows -- -Route temp-fixture", outputPath: path.join(dir, "first-route-proof.txt"), exitCode: 0 },
    { id: "bind-first-route-completion", command: "set SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK", outputPath: firstRouteCompletionPath, exitCode: 0 },
    { id: "archive-first-route-root-exports", command: "archive first-route repo-root proof exports", outputPath: path.dirname(archivedProofPath), exitCode: 0 },
    { id: "selected-route-proof", command: "npm run proof:route:windows -- -Route npm-cache", outputPath: path.join(dir, "selected-route-proof.txt"), exitCode: 0 },
    ...(patch.commands || [])
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
      selectedRouteStatus: "accepted"
    },
    firstRouteCompletion: {
      path: firstRouteCompletionPath,
      status: "accepted",
      canStartNextRoute: true,
      reclaimedBytes: 8388608
    },
    selectedRouteCompletion: {
      path: selectedRouteCompletionPath,
      status: "accepted",
      canStartNextRoute: true,
      route: "bounded-npm-cache-delete",
      reclaimedBytes: 1048576
    },
    archivedRootExports: [{ source: path.join(dir, "spaceguard-real-workflow-proof.md"), destination: archivedProofPath }],
    commands: {
      privateWindowsPreflight: "npm run demo:private-windows-preflight",
      firstRouteProof: "npm run proof:first-route:windows -- -Route temp-fixture",
      selectedRouteProof: "npm run proof:route:windows -- -Route npm-cache"
    },
    ...patch.proof
  };

  writeJson(preflightPath, preflight);
  writeJson(firstRouteCompletionPath, firstRouteCompletion);
  writeJson(selectedRouteCompletionPath, selectedRouteCompletion);
  writeNdjson(commandLogPath, commands);
  writeJson(proofPath, proof);
  fs.mkdirSync(path.dirname(archivedProofPath), { recursive: true });
  fs.writeFileSync(archivedProofPath, "# archived first route proof\n");

  return { dir, proofPath, commandLogPath, firstRouteCompletionPath, selectedRouteCompletionPath };
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
  assert.strictEqual(accepted.counts.commandRecords, 5, "verifier should count command ledger records");
  assert.strictEqual(accepted.blockers.length, 0, "accepted V1 proof should not have blockers");

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

  const coordinator = fs.readFileSync(coordinatorPath, "utf8");
  assert(coordinator.includes("private-v1-proof-check.json"), "V1 coordinator should write private V1 proof verifier output");
  assert(coordinator.includes("run-private-v1-proof-check.mjs --file"), "V1 coordinator should invoke the independent private V1 proof verifier");
  assert(gitignore.includes("private-v1-proof-check.json"), ".gitignore should exclude copied private V1 proof check artifacts");
  assert(readme.includes("npm run validate:private-v1-proof -- --file"), "README should document private V1 proof validation");
  assert(windowsSetup.includes("npm run validate:private-v1-proof -- --file"), "Windows setup guide should document private V1 proof validation");

  console.log("private v1 proof check ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
