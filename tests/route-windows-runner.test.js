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
assert(
  packageJson.scripts["validate:route-preflight"]?.includes("run-route-preflight-check.mjs"),
  "package.json should expose the selected-route preflight verifier"
);
assert(
  packageJson.scripts["validate:route-completion"]?.includes("run-route-completion-check.mjs"),
  "package.json should expose the selected-route completion verifier"
);
assert(runner.includes("spaceguard-selected-route-windows-operator/v1"), "runner should write a stable selected-route operator schema");
assert(runner.includes("[System.PlatformID]::Win32NT"), "runner should refuse non-Windows execution");
assert(runner.includes("SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK"), "runner should require accepted first-route completion proof");
assert(runner.includes("spaceguard-first-route-completion-check/v1"), "runner should validate the first-route completion schema");
assert(runner.includes("Assert-AcceptedFirstRouteCompletion"), "runner should validate the proof file before route launch");
assert(runner.includes("$RouteResolutionPath"), "runner should capture route-resolution evidence before selected-route proof");
assert(runner.includes("selected-route-setup.json"), "runner should write selected-route setup resolution evidence");
assert(runner.includes("Resolve-SelectedRouteSpecFromSetup"), "runner should resolve selected routes through setup:route");
assert(runner.includes("spaceguard-route-setup-packet/v1"), "runner should validate the setup:route schema when resolving routes");
assert(runner.includes("selected-route-unknown"), "runner should fail early on unknown selected routes");
assert(runner.includes("selected-route-bootstrap-disallowed"), "runner should reject the temp bootstrap route as a selected real-data route");
assert(runner.includes("resolve-selected-route"), "runner should log the route-resolution command");
assert(
  runner.indexOf("$RouteSpec = Resolve-SelectedRouteSpecFromSetup -InputRoute $Route -Path $RouteResolutionPath") <
    runner.indexOf("Set-SelectedRouteExecutorEnvironment -Spec $RouteSpec"),
  "runner should resolve route identity before enabling scoped executor flags"
);
assert(!runner.includes("switch ($key)"), "runner should not duplicate setup:route aliases in a hard-coded PowerShell switch");
assert(runner.includes("Assert-CleanProofExportSlots"), "runner should reject stale root proof exports before a new app launch");
assert(runner.includes("stale-proof-export"), "runner should name stale proof export blockers");
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
assert(runner.includes("operator-preflight-check.json"), "runner should write selected-route preflight check output");
assert(runner.includes("operator-app-handoff.md"), "runner should write selected-route app handoff");
assert(runner.includes("## Selected route fast path"), "runner handoff should include a selected-route fast path section");
assert(runner.includes("$EnableRouteFlagCommand = '$env:' + $RouteSpec.envVar + '=\"1\"'"), "runner handoff should print the exact selected route PowerShell flag command");
assert(runner.includes("$IgnoreDotEnvCommand = '$env:SPACEGUARD_ROUTE_SETUP_IGNORE_DOTENV=\"1\"'"), "runner handoff should print the dotenv override command");
assert(runner.includes("npm run proof:route:windows -- -Route $Route"), "runner handoff should print the selected-route proof command");
assert(runner.includes("Use OpenAI cleanup agent only for ranking and brokered follow-through"), "runner handoff should keep OpenAI advisory-only authority explicit");
assert(runner.includes("Do not close the app until native volume proof, selected-route proof packet export, selected-route proof import, and workflow proof export are complete"), "runner handoff should make the app-close stop condition explicit");
assert(runner.includes("commands.ndjson"), "runner should write command evidence records");
assert(runner.includes("run-route-preflight-check.mjs"), "runner should validate selected-route preflight evidence before app launch");
assert(runner.includes("spaceguard-selected-route-proof-packet.md"), "runner handoff should name the selected-route proof export");
assert(runner.includes("spaceguard-real-workflow-proof.md"), "runner handoff should name the workflow proof export");
assert(runner.includes("proof:route:windows:finalize"), "runner handoff should name the selected-route finalize command");
assert(runner.includes("workflow-proof-check.json"), "runner should write workflow proof check output after app exit");
assert(runner.includes("selected-route-completion-check.json"), "runner should write selected-route completion check output after app exit");
assert(runner.includes("post-app-finalization.json"), "runner should write post-app finalization summary");
assert(runner.includes("postAppFinalization = $PostAppFinalizationPath"), "runner preflight should bind native exit to the selected-route post-app finalization artifact");
assert(runner.includes("native-dev-exit.json"), "runner should write native app exit evidence");
assert(runner.includes("$LASTEXITCODE"), "runner should capture npm run native:dev exit code");
assert(runner.includes("native-dev-failed"), "runner should skip post-app proof validation when native app launch fails");
assert(runner.includes("validate-selected-route-preflight"), "runner should log selected-route preflight validation");
assert(runner.includes("validate-selected-route-completion"), "runner should log selected-route completion validation");
assert(runner.includes("run-route-completion-check.mjs"), "runner should invoke the selected-route completion verifier");
assert(runner.includes("selected-route-workflow-proof-required"), "runner should keep selected routes blocked until workflow proof validates");
assert(
  runner.includes("Import artifact path must be spaceguard-selected-route-proof-packet.md"),
  "runner handoff should tell the operator the exact selected-route proof import artifact path"
);

assert(!/\bRemove-Item\b/i.test(runner), "runner must not delete files directly");
assert(!/\bClear-RecycleBin\b/i.test(runner), "runner must not empty Recycle Bin");
assert(!/\bdel\s+/i.test(runner), "runner must not call del directly");
assert(!/\brmdir\s+/i.test(runner), "runner must not call rmdir directly");

console.log("route windows runner ok");
