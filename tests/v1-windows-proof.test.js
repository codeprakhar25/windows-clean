const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const runnerPath = path.join(root, "scripts", "run-v1-windows-proof.ps1");
const readinessPath = path.join(root, "scripts", "run-v1-readiness.mjs");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const windowsSetup = fs.readFileSync(path.join(root, "WINDOWS_REAL_DATA_SETUP.md"), "utf8");

(async () => {
  assert(fs.existsSync(runnerPath), "Windows V1 proof coordinator should exist");
  assert(
    packageJson.scripts["v1:windows"]?.includes("run-v1-windows-proof.ps1"),
    "package.json should expose the Windows V1 proof coordinator"
  );

  const runner = fs.readFileSync(runnerPath, "utf8");
  assert(runner.includes("spaceguard-v1-windows-proof/v1"), "V1 proof coordinator should write a stable schema");
  assert(runner.includes("[System.PlatformID]::Win32NT"), "V1 proof coordinator should refuse non-Windows execution");
  assert(runner.includes("[System.Diagnostics.ProcessStartInfo]::new()"), "V1 proof coordinator should use ProcessStartInfo for logged child commands");
  assert(runner.includes("stderrPath"), "V1 proof coordinator should preserve stderr evidence for logged child commands");
  assert(!runner.includes("Tee-Object"), "V1 proof coordinator should not use Tee-Object to infer child command exit state");
  assert(runner.includes("v1-openai-live-required"), "V1 proof coordinator should reject live OpenAI skips for V1 acceptance");
  assert(runner.includes("v1-openai-key-required"), "V1 proof coordinator should fail early when OPENAI_API_KEY is missing");
  assert(runner.includes("Import-SpaceGuardDotEnv"), "V1 proof coordinator should load .env before checking the V1 OpenAI key");
  assert(runner.includes("npm run v1:preflight"), "V1 proof coordinator should start with host preflight");
  assert(runner.includes("-SelectedRoute $SelectedRoute"), "V1 proof coordinator should pass the selected route into host preflight");
  assert(runner.includes("$SelectedRouteSetupPath"), "V1 proof coordinator should capture selected-route setup evidence");
  assert(runner.includes("Assert-KnownSelectedRoute"), "V1 proof coordinator should validate selected route before preflight");
  assert(runner.includes("selected-route-setup.json"), "V1 proof coordinator should write selected-route setup JSON");
  assert(runner.includes("selected-route-unknown"), "V1 proof coordinator should fail early for unknown selected routes");
  assert(runner.includes("selected-route-bootstrap-disallowed"), "V1 proof coordinator should reject temp-fixture as the selected real-data route");
  assert(
    runner.indexOf("Assert-KnownSelectedRoute -Route $SelectedRoute") < runner.indexOf("npm run v1:preflight"),
    "V1 proof coordinator should validate selected route before building/running preflight commands"
  );
  assert(runner.includes("$PreflightSummaryPath"), "V1 proof coordinator should track the exact V1 preflight JSON path");
  assert(runner.includes("Assert-ExistingV1WindowsPreflight"), "V1 proof coordinator should validate reused preflight evidence");
  assert(runner.includes("v1-windows-preflight-skipped-missing"), "V1 proof coordinator should fail early when skipped preflight evidence is missing");
  assert(runner.includes("SkipPreflightExistingEvidence"), "V1 proof coordinator should log reused preflight evidence explicitly");
  assert(runner.includes("reused = $true"), "V1 proof coordinator command ledger should mark reused preflight proof");
  assert(runner.includes("npm run proof:first-route:windows -- -Route temp-fixture"), "V1 proof coordinator should run the seeded first route");
  assert(runner.includes("first-route-completion-check.json"), "V1 proof coordinator should require the first-route completion artifact");
  assert(runner.includes("Assert-CompletionProofCounts"), "V1 proof coordinator should assert child completion parity counts before summary");
  assert(runner.includes('Assert-CompletionProofCounts -Proof $proof -Prefix "first-route"'), "V1 proof coordinator should fail early on weak first-route completion parity");
  assert(runner.includes('Assert-CompletionProofCounts -Proof $proof -Prefix "selected-route"'), "V1 proof coordinator should fail early on weak selected-route completion parity");
  assert(runner.includes("SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK"), "V1 proof coordinator should bind first-route completion for selected routes");
  assert(runner.includes("archived-first-route-root-exports"), "V1 proof coordinator should archive first-route root exports before selected-route launch");
  assert(runner.includes("npm run proof:route:windows -- -Route $SelectedRoute"), "V1 proof coordinator should run the selected real-data route");
  assert(runner.includes("selected-route-completion-check.json"), "V1 proof coordinator should capture selected-route completion");
  assert(runner.includes("ledgerReclaimedBytes"), "V1 proof coordinator should summarize completion ledger reclaimed bytes");
  assert(runner.includes("rescanExpectedBytes"), "V1 proof coordinator should summarize completion rescan expected bytes");
  assert(runner.includes("rescanActualRemainingBytes"), "V1 proof coordinator should summarize completion rescan remaining bytes");
  assert(runner.includes("v1-proof.json"), "V1 proof coordinator should write the final V1 proof artifact");
  assert(runner.includes("commands.ndjson"), "V1 proof coordinator should keep a command ledger");
  assert(gitignore.includes("v1-proof.json"), ".gitignore should exclude copied V1 proof artifacts");
  assert(
    readme.includes("npm run v1:windows -- -SelectedRoute npm-cache"),
    "README should expose the single-command V1 Windows proof"
  );
  assert(
    windowsSetup.includes("npm run v1:windows -- -SelectedRoute npm-cache"),
    "Windows setup guide should expose the single-command V1 Windows proof"
  );
  assert(readme.includes("-SelectedRoute gradle-cache"), "README should show that the V1 coordinator can target another scoped route");
  assert(windowsSetup.includes("-SelectedRoute gradle-cache"), "Windows setup guide should show that the V1 coordinator can target another scoped route");
  assert(!/\bRemove-Item\b/i.test(runner), "V1 proof coordinator must not delete files");
  assert(!/\bClear-RecycleBin\b/i.test(runner), "V1 proof coordinator must not empty Recycle Bin");
  assert(!/\bdel\s+/i.test(runner), "V1 proof coordinator must not call del directly");
  assert(!/\brmdir\s+/i.test(runner), "V1 proof coordinator must not call rmdir directly");

  const readiness = await import(pathToFileURL(readinessPath).href);
  const summary = readiness.buildV1ReadinessSummary({
    rootDir: root,
    generatedAt: "2026-06-08T15:00:00.000Z"
  });
  assertReadyCheck(summary, "windows-v1-proof-runner");
  assert(
    summary.nextCommands.includes("npm run v1:windows -- -SelectedRoute npm-cache"),
    "V1 readiness should expose the single-command Windows V1 proof coordinator"
  );

  console.log("v1 windows proof ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

function assertReadyCheck(summary, id) {
  const row = summary.checks.find((check) => check.id === id);
  assert(row, `${id} check should be present`);
  assert.strictEqual(row.passed, true, `${id} check should pass: ${row.detail || "no detail"}`);
}
