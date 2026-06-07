const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const runnerPath = path.join(root, "scripts", "run-first-route-proof-windows.ps1");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

assert(fs.existsSync(runnerPath), "Windows first-route proof runner should exist");

const runner = fs.readFileSync(runnerPath, "utf8");

assert(
  packageJson.scripts["proof:first-route:windows"]?.includes("run-first-route-proof-windows.ps1"),
  "package.json should expose the Windows first-route proof runner"
);
assert(runner.includes("spaceguard-first-route-windows-operator/v1"), "runner should write a stable operator evidence schema");
assert(runner.includes("[System.PlatformID]::Win32NT"), "runner should refuse non-Windows execution");
assert(runner.includes("Unsupported first-route proof route"), "runner should reject non-temp first-proof routes");
assert(runner.includes("SPACEGUARD_ROUTE_SETUP_IGNORE_DOTENV"), "runner should force scoped env over .env executor flags");
assert(runner.includes("SPACEGUARD_ENABLE_TEMP_EXECUTOR"), "runner should enable only the temp executor flag");
assert(runner.includes("run-first-route-proof.mjs"), "runner should capture the first-route proof packet");
assert(runner.includes("seed-spaceguard-fixtures.ps1"), "runner should seed disposable fixtures");
assert(runner.includes("inspect-spaceguard-fixtures.ps1"), "runner should inspect fixture evidence");
assert(runner.includes("fixture-before-cleanup.json"), "runner should capture pre-cleanup fixture evidence");
assert(runner.includes("fixture-after-cleanup.json"), "runner should print post-cleanup fixture inspection path");
assert(runner.includes("npm run setup:doctor"), "runner should capture setup doctor output");
assert(runner.includes("npm run openai:smoke:fixture"), "runner should always run fixture-only OpenAI broker smoke");
assert(runner.includes("npm run openai:smoke"), "runner should support live OpenAI smoke when configured");
assert(runner.includes("npm run setup:route -- --route $Route"), "runner should capture route setup packet");
assert(runner.includes("npm run validate:route -- --route $Route"), "runner should capture route validation packet");
assert(runner.includes("npm run native:dev"), "runner should launch the user-gated Tauri workflow");
assert(runner.includes("validate:workflow-proof"), "runner should print final workflow proof validation");
assert(runner.includes("operator-preflight.json"), "runner should write a preflight evidence bundle");
assert(runner.includes("commands.ndjson"), "runner should write command evidence records");

assert(!/\bRemove-Item\b/i.test(runner), "runner must not delete files directly");
assert(!/\bClear-RecycleBin\b/i.test(runner), "runner must not empty Recycle Bin");
assert(!/\bdel\s+/i.test(runner), "runner must not call del directly");
assert(!/\brmdir\s+/i.test(runner), "runner must not call rmdir directly");

console.log("first route windows runner ok");
