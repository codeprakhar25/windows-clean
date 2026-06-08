const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const runnerPath = path.join(root, "scripts", "run-private-demo-windows-preflight.ps1");
const readinessPath = path.join(root, "scripts", "run-private-demo-readiness.mjs");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

(async () => {
  assert(fs.existsSync(runnerPath), "Windows private demo preflight runner should exist");
  assert(
    packageJson.scripts["demo:private-windows-preflight"]?.includes("run-private-demo-windows-preflight.ps1"),
    "package.json should expose the Windows private demo preflight runner"
  );

  const runner = fs.readFileSync(runnerPath, "utf8");
  assert(runner.includes("spaceguard-private-demo-windows-preflight/v1"), "preflight runner should write a stable schema");
  assert(runner.includes("[System.PlatformID]::Win32NT"), "preflight runner should refuse non-Windows execution");
  assert(runner.includes("npm test"), "preflight runner should run the JS verification suite");
  assert(runner.includes("npm run native:executor-coverage"), "preflight runner should prove native executor coverage is visible");
  assert(runner.includes("cargo test --manifest-path src-tauri\\Cargo.toml"), "preflight runner should run Rust unit tests on the Windows host");
  assert(runner.includes("npm run build"), "preflight runner should run the Vite production build");
  assert(runner.includes("npm run demo:private-readiness"), "preflight runner should capture private demo readiness");
  assert(runner.includes("npm run native:build"), "preflight runner should produce the native bundle");
  assert(runner.includes("proof:first-route:windows -- -Route temp-fixture"), "preflight runner should print the first-route proof as the next command");
  assert(runner.includes("proof:route:windows -- -Route npm-cache"), "preflight runner should print npm-cache as the selected real-data route command");
  assert(runner.includes("commands.ndjson"), "preflight runner should keep a command ledger");
  assert(runner.includes("private-demo-preflight.json"), "preflight runner should write a final preflight artifact");
  assert(!/\bRemove-Item\b/i.test(runner), "preflight runner must not delete files");
  assert(!/\bClear-RecycleBin\b/i.test(runner), "preflight runner must not empty Recycle Bin");
  assert(!/\bdel\s+/i.test(runner), "preflight runner must not call del directly");
  assert(!/\brmdir\s+/i.test(runner), "preflight runner must not call rmdir directly");

  const readiness = await import(pathToFileURL(readinessPath).href);
  const summary = readiness.buildPrivateDemoReadinessSummary({
    rootDir: root,
    generatedAt: "2026-06-08T14:00:00.000Z"
  });
  assertReadyCheck(summary, "windows-private-preflight-runner");
  assert(
    summary.nextCommands.includes("npm run demo:private-windows-preflight"),
    "private demo readiness should put the Windows preflight before manual proof commands"
  );

  console.log("private demo windows preflight ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

function assertReadyCheck(summary, id) {
  const row = summary.checks.find((check) => check.id === id);
  assert(row, `${id} check should be present`);
  assert.strictEqual(row.passed, true, `${id} check should pass: ${row.detail || "no detail"}`);
}
