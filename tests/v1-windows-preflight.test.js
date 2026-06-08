const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const runnerPath = path.join(root, "scripts", "run-v1-windows-preflight.ps1");
const readinessPath = path.join(root, "scripts", "run-v1-readiness.mjs");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

(async () => {
  assert(fs.existsSync(runnerPath), "Windows V1 preflight runner should exist");
  assert(
    packageJson.scripts["v1:preflight"]?.includes("run-v1-windows-preflight.ps1"),
    "package.json should expose the Windows V1 preflight runner"
  );

  const runner = fs.readFileSync(runnerPath, "utf8");
  assert(runner.includes("spaceguard-v1-windows-preflight/v1"), "preflight runner should write a stable schema");
  assert(runner.includes("[System.PlatformID]::Win32NT"), "preflight runner should refuse non-Windows execution");
  assert(runner.includes("[string]$SelectedRoute = \"npm-cache\""), "preflight runner should accept a selected route argument with npm-cache as default");
  assert(runner.includes("npm test"), "preflight runner should run the JS verification suite");
  assert(runner.includes("npm run native:executor-coverage"), "preflight runner should prove native executor coverage is visible");
  assert(runner.includes("cargo test --manifest-path src-tauri\\Cargo.toml"), "preflight runner should run Rust unit tests on the Windows host");
  assert(runner.includes("npm run build"), "preflight runner should run the Vite production build");
  assert(runner.includes("npm run v1:readiness"), "preflight runner should capture V1 readiness");
  assert(runner.includes("npm run openai:smoke:fixture -- --route $SelectedRoute"), "preflight runner should run selected-route OpenAI fixture smoke");
  assert(runner.includes("npm run openai:smoke -- --route $SelectedRoute"), "preflight runner should run selected-route live OpenAI smoke");
  assert(runner.includes("npm run native:build"), "preflight runner should produce the native bundle");
  assert(runner.includes("Get-NativeBundleArtifacts"), "preflight runner should enumerate native bundle artifacts");
  assert(runner.includes("Copy-NativeBundleArtifacts"), "preflight runner should copy native bundle artifacts into evidence");
  assert(runner.includes("native-bundle-artifacts"), "preflight runner should use a native bundle evidence folder");
  assert(runner.includes("Get-FileHash"), "preflight runner should hash copied native bundle artifacts");
  assert(runner.includes("src-tauri\\target\\release\\bundle"), "preflight runner should inspect the Tauri bundle output folder");
  assert(runner.includes("evidencePath"), "preflight runner should record copied bundle artifact evidence paths");
  assert(runner.includes("sha256"), "preflight runner should record copied bundle artifact hashes");
  assert(runner.includes("nativeBundleArtifacts"), "preflight runner should write native bundle artifact evidence");
  assert(runner.includes("proof:first-route:windows -- -Route temp-fixture"), "preflight runner should print the first-route proof as the next command");
  assert(runner.includes("proof:route:windows -- -Route $SelectedRoute"), "preflight runner should print the selected real-data route command");
  assert(runner.includes("commands.ndjson"), "preflight runner should keep a command ledger");
  assert(runner.includes("v1-preflight.json"), "preflight runner should write a final preflight artifact");
  assert(!/\bRemove-Item\b/i.test(runner), "preflight runner must not delete files");
  assert(!/\bClear-RecycleBin\b/i.test(runner), "preflight runner must not empty Recycle Bin");
  assert(!/\bdel\s+/i.test(runner), "preflight runner must not call del directly");
  assert(!/\brmdir\s+/i.test(runner), "preflight runner must not call rmdir directly");

  const readiness = await import(pathToFileURL(readinessPath).href);
  const summary = readiness.buildV1ReadinessSummary({
    rootDir: root,
    generatedAt: "2026-06-08T14:00:00.000Z"
  });
  assertReadyCheck(summary, "windows-v1-preflight-runner");
  assert(
    summary.nextCommands.includes("npm run v1:preflight"),
    "V1 readiness should put the Windows preflight before manual proof commands"
  );
  assert(
    summary.nextCommands.includes("npm run openai:smoke:fixture -- --route npm-cache") &&
      summary.nextCommands.includes("npm run openai:smoke -- --route npm-cache"),
    "V1 readiness should expose both OpenAI smoke commands before Windows preflight"
  );

  console.log("V1 windows preflight ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

function assertReadyCheck(summary, id) {
  const row = summary.checks.find((check) => check.id === id);
  assert(row, `${id} check should be present`);
  assert.strictEqual(row.passed, true, `${id} check should pass: ${row.detail || "no detail"}`);
}
