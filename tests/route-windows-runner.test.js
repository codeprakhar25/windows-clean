const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const runnerPath = path.join(root, "scripts", "run-route-proof-windows.ps1");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

assert(fs.existsSync(runnerPath), "Windows selected-route proof runner should exist");

const runner = fs.readFileSync(runnerPath, "utf8");

assert(
  packageJson.scripts["proof:route:windows"]?.includes("run-route-proof-windows.ps1"),
  "package.json should expose the Windows selected-route proof runner"
);
assert(
  packageJson.scripts["proof:route:windows:finalize"]?.includes("-FinalizeOnly"),
  "package.json should expose a finalize-only selected-route proof command"
);
assert(runner.includes("spaceguard-selected-route-windows-operator/v1"), "runner should write a stable selected-route operator schema");
assert(runner.includes("[System.PlatformID]::Win32NT"), "runner should refuse non-Windows execution");
assert(runner.includes("SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK"), "runner should require accepted first-route completion proof");
assert(runner.includes("spaceguard-first-route-completion-check/v1"), "runner should validate the first-route completion schema");
assert(runner.includes("Assert-AcceptedFirstRouteCompletion"), "runner should validate the proof file before route launch");
assert(runner.includes("Assert-OneSelectedRouteFlag"), "runner should enforce exactly one scoped selected-route flag");
assert(runner.includes("SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR"), "runner should support npm cache route flag validation");
assert(runner.includes("SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR"), "runner should support pnpm store route flag validation");
assert(runner.includes("SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR"), "runner should support Gradle cache route flag validation");
assert(runner.includes("SPACEGUARD_ENABLE_USER_CACHE_EXECUTOR"), "runner should support user cache route flag validation");
assert(runner.includes("SPACEGUARD_ENABLE_BROWSER_CACHE_EXECUTOR"), "runner should support browser cache route flag validation");
assert(runner.includes("SPACEGUARD_ROUTE_SETUP_IGNORE_DOTENV"), "runner should force process env over .env executor flags");
assert(runner.includes("npm run setup:doctor"), "runner should capture setup doctor output");
assert(runner.includes("npm run openai:smoke:fixture -- --route $Route"), "runner should always run route fixture OpenAI broker smoke");
assert(runner.includes("npm run openai:smoke -- --route $Route"), "runner should support live OpenAI smoke when configured");
assert(runner.includes("npm run setup:route -- --route $Route"), "runner should capture selected route setup packet");
assert(runner.includes("npm run validate:route -- --route $Route"), "runner should capture selected route validation packet");
assert(runner.includes("npm run native:dev"), "runner should launch the user-gated Tauri workflow");
assert(runner.includes("validate:workflow-proof"), "runner should validate the final workflow proof");
assert(runner.includes("operator-preflight.json"), "runner should write selected-route preflight evidence");
assert(runner.includes("operator-app-handoff.md"), "runner should write selected-route app handoff");
assert(runner.includes("commands.ndjson"), "runner should write command evidence records");
assert(runner.includes("spaceguard-selected-route-proof-packet.md"), "runner handoff should name the selected-route proof export");
assert(runner.includes("spaceguard-real-workflow-proof.md"), "runner handoff should name the workflow proof export");
assert(runner.includes("proof:route:windows:finalize"), "runner handoff should name the selected-route finalize command");
assert(runner.includes("workflow-proof-check.json"), "runner should write workflow proof check output after app exit");
assert(runner.includes("post-app-finalization.json"), "runner should write post-app finalization summary");
assert(runner.includes("native-dev-exit.json"), "runner should write native app exit evidence");
assert(runner.includes("$LASTEXITCODE"), "runner should capture npm run native:dev exit code");
assert(runner.includes("native-dev-failed"), "runner should skip post-app proof validation when native app launch fails");
assert(runner.includes("selected-route-workflow-proof-required"), "runner should keep selected routes blocked until workflow proof validates");

assert(!/\bRemove-Item\b/i.test(runner), "runner must not delete files directly");
assert(!/\bClear-RecycleBin\b/i.test(runner), "runner must not empty Recycle Bin");
assert(!/\bdel\s+/i.test(runner), "runner must not call del directly");
assert(!/\brmdir\s+/i.test(runner), "runner must not call rmdir directly");

console.log("route windows runner ok");
