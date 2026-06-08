const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const runnerPath = path.join(root, "scripts", "run-private-v1-windows-proof.ps1");
const readinessPath = path.join(root, "scripts", "run-private-demo-readiness.mjs");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const windowsSetup = fs.readFileSync(path.join(root, "WINDOWS_REAL_DATA_SETUP.md"), "utf8");

(async () => {
  assert(fs.existsSync(runnerPath), "Windows private V1 proof coordinator should exist");
  assert(
    packageJson.scripts["demo:private-v1-windows"]?.includes("run-private-v1-windows-proof.ps1"),
    "package.json should expose the Windows private V1 proof coordinator"
  );

  const runner = fs.readFileSync(runnerPath, "utf8");
  assert(runner.includes("spaceguard-private-v1-windows-proof/v1"), "V1 proof coordinator should write a stable schema");
  assert(runner.includes("[System.PlatformID]::Win32NT"), "V1 proof coordinator should refuse non-Windows execution");
  assert(runner.includes("npm run demo:private-windows-preflight"), "V1 proof coordinator should start with host preflight");
  assert(runner.includes("-SelectedRoute $SelectedRoute"), "V1 proof coordinator should pass the selected route into host preflight");
  assert(runner.includes("npm run proof:first-route:windows -- -Route temp-fixture"), "V1 proof coordinator should run the seeded first route");
  assert(runner.includes("first-route-completion-check.json"), "V1 proof coordinator should require the first-route completion artifact");
  assert(runner.includes("SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK"), "V1 proof coordinator should bind first-route completion for selected routes");
  assert(runner.includes("archived-first-route-root-exports"), "V1 proof coordinator should archive first-route root exports before selected-route launch");
  assert(runner.includes("npm run proof:route:windows -- -Route $SelectedRoute"), "V1 proof coordinator should run the selected real-data route");
  assert(runner.includes("selected-route-completion-check.json"), "V1 proof coordinator should capture selected-route completion");
  assert(runner.includes("ledgerReclaimedBytes"), "V1 proof coordinator should summarize completion ledger reclaimed bytes");
  assert(runner.includes("rescanExpectedBytes"), "V1 proof coordinator should summarize completion rescan expected bytes");
  assert(runner.includes("rescanActualRemainingBytes"), "V1 proof coordinator should summarize completion rescan remaining bytes");
  assert(runner.includes("private-v1-proof.json"), "V1 proof coordinator should write the final V1 proof artifact");
  assert(runner.includes("commands.ndjson"), "V1 proof coordinator should keep a command ledger");
  assert(gitignore.includes("private-v1-proof.json"), ".gitignore should exclude copied private V1 proof artifacts");
  assert(
    readme.includes("npm run demo:private-v1-windows -- -SelectedRoute npm-cache"),
    "README should expose the single-command private V1 Windows proof"
  );
  assert(
    windowsSetup.includes("npm run demo:private-v1-windows -- -SelectedRoute npm-cache"),
    "Windows setup guide should expose the single-command private V1 Windows proof"
  );
  assert(readme.includes("-SelectedRoute gradle-cache"), "README should show that the private V1 coordinator can target another scoped route");
  assert(windowsSetup.includes("-SelectedRoute gradle-cache"), "Windows setup guide should show that the private V1 coordinator can target another scoped route");
  assert(!/\bRemove-Item\b/i.test(runner), "V1 proof coordinator must not delete files");
  assert(!/\bClear-RecycleBin\b/i.test(runner), "V1 proof coordinator must not empty Recycle Bin");
  assert(!/\bdel\s+/i.test(runner), "V1 proof coordinator must not call del directly");
  assert(!/\brmdir\s+/i.test(runner), "V1 proof coordinator must not call rmdir directly");

  const readiness = await import(pathToFileURL(readinessPath).href);
  const summary = readiness.buildPrivateDemoReadinessSummary({
    rootDir: root,
    generatedAt: "2026-06-08T15:00:00.000Z"
  });
  assertReadyCheck(summary, "windows-private-v1-proof-runner");
  assert(
    summary.nextCommands.includes("npm run demo:private-v1-windows -- -SelectedRoute npm-cache"),
    "private demo readiness should expose the single-command Windows V1 proof coordinator"
  );

  console.log("private v1 windows proof ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

function assertReadyCheck(summary, id) {
  const row = summary.checks.find((check) => check.id === id);
  assert(row, `${id} check should be present`);
  assert.strictEqual(row.passed, true, `${id} check should pass: ${row.detail || "no detail"}`);
}
