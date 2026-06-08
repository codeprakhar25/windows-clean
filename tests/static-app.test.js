const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "src", "index.css"), "utf8");
const app = fs.readFileSync(path.join(root, "src", "App.jsx"), "utf8");
const nativeAdapter = fs.readFileSync(path.join(root, "src", "native-scanner.mjs"), "utf8");
const openAiAgent = fs.readFileSync(path.join(root, "src", "openai-agent.mjs"), "utf8");
const viteConfig = fs.readFileSync(path.join(root, "vite.config.mjs"), "utf8");
const rustScanner = fs.readFileSync(path.join(root, "src-tauri", "src", "main.rs"), "utf8");
const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");
const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const realDataGuide = fs.readFileSync(path.join(root, "WINDOWS_REAL_DATA_SETUP.md"), "utf8");
const setupDoctorScript = fs.readFileSync(path.join(root, "scripts", "run-setup-doctor.mjs"), "utf8");
const setupRouteScript = fs.readFileSync(path.join(root, "scripts", "run-setup-route.mjs"), "utf8");
const openAiSmokeScript = fs.readFileSync(path.join(root, "scripts", "run-openai-advisor-smoke.mjs"), "utf8");
const workflowProofScript = fs.readFileSync(path.join(root, "scripts", "run-workflow-proof-check.mjs"), "utf8");
const realWorkflow = fs.readFileSync(path.join(root, "src", "real-workflow.mjs"), "utf8");
const removedDataWord = "de" + "mo";
const removedSampleWord = "sce" + "nario";
const removedModelImportPattern = new RegExp(`\\.\\/spaceguard-${"model"}\\.mjs`);

const requiredAppMarkers = [
  "SpaceGuard",
  "Real Windows cleanup",
  "Connect the Windows desktop app",
  "No local folders are scanned from this browser session.",
  "npm run native:dev",
  "OPENAI_API_KEY",
  "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR",
  "Run real scan",
  "Real cleanup queue",
  "User gate",
  "Type the confirmation phrase",
  "Execute selected cleanup",
  "Run post-run rescan",
  "Export proof packet",
  "Proof target",
  "selected item",
  "Route readiness",
  "OpenAI cleanup agent",
  "Manual review findings",
  "spaceguard-selected-route-proof-packet.md",
  "spaceguard-real-workflow-proof.md"
];

for (const marker of requiredAppMarkers) {
  assert(app.includes(marker), `App.jsx should render ${marker}`);
}

const forbiddenAppMarkers = [
  new RegExp(`\\b${removedDataWord}\\b`, "i"),
  new RegExp(`\\b${removedSampleWord}\\b`, "i"),
  /temp-fixture/i,
  /spaceguard-fixture/i,
  /Seeded temp fixture/i,
  /openai:smoke:fixture/i,
  /Review setup steps/i,
  /Legacy sample fixture/i,
  /buildLegacySampleActions/,
  /buildDemoRehearsalRunbook/,
  /simulateCleanup/,
  /getLegacySample/,
  removedModelImportPattern
];

for (const marker of forbiddenAppMarkers) {
  assert(!marker.test(app), `App.jsx must not contain removed runtime marker ${marker}`);
}

assert(html.includes('<div id="root"></div>'), "index.html should expose React root");
assert(html.includes("/src/main.jsx"), "index.html should load React entrypoint");
assert(css.includes("Roboto+Flex"), "app should use a Roboto-family font");
assert(css.includes("@tailwind"), "Tailwind should be configured");
assert(app.includes("@/components/ui/button"), "app should use shadcn-style Button component");
assert(app.includes("@/components/ui/card"), "app should use shadcn-style Card component");
assert(app.includes("@/components/ui/checkbox"), "app should use shadcn-style Checkbox component");
assert(app.includes("sticky top-0"), "left sidebar should stay pinned");

for (const marker of [
  "getNativeRuntimeCapabilities",
  "runNativeReadonlyScan",
  "runNativeTempCleanupExecutor",
  "runNativeNpmCacheExecutor",
  "runNativePnpmStoreExecutor",
  "runNativeGradleCacheExecutor",
  "runNativeProjectDependencyExecutor",
  "runNativeDownloadsCleanupExecutor",
  "runNativeBrowserCacheExecutor",
  "runNativeRecycleBinExecutor",
  "writeNativeProofArtifact"
]) {
  assert(app.includes(marker), `App.jsx should wire native API ${marker}`);
}

assert(app.includes("requestOpenAIAgentAdvice"), "OpenAI advisor should be wired into the real desktop shell");
assert(app.includes("./real-workflow.mjs"), "app should import tested real workflow helpers");
assert(app.includes("buildRouteReadiness"), "app should use tested route readiness guardrails");
assert(app.includes("buildRouteSetupChecklist"), "app should use tested route setup checklist guardrails");
assert(app.includes("RouteReadinessList"), "app should render route readiness guardrails before execution");
assert(app.includes("buildManualFindingGuidance"), "app should use tested manual finding guidance");
assert(app.includes("buildManualFindingReviewRows"), "app should use tested manual review row guidance");
assert(app.includes("Recommended safe action"), "manual review panel should render recommended safe action copy");
assert(app.includes("Review candidates"), "manual review panel should render visible review candidates");
assert(app.includes("Usage evidence"), "manual review panel should render candidate usage evidence");
assert(app.includes("Blocked actions"), "manual review panel should render blocked action guardrails");
assert(app.includes("Selected .env block"), "route setup panel should render a copyable selected .env block");
assert(app.includes("copyEnvBlock"), "route setup panel should expose a copy action for selected .env content");
assert(app.includes("navigator.clipboard.writeText(checklist.envBlock.content)"), "route setup copy action should copy the tested env block");
assert(app.includes("Windows test runbook"), "route setup panel should render the Windows test runbook");
assert(app.includes("copyRunbook"), "route setup panel should expose a copy action for the Windows runbook");
assert(app.includes("navigator.clipboard.writeText(checklist.runbook.content)"), "route setup runbook copy action should copy the tested runbook");
assert(app.includes("npm run openai:smoke -- --local-contract --route"), "route setup panel should show offline OpenAI route-contract smoke");
assert(app.includes("function ConnectionRequired({ runtimeError, onRefresh, routes, selectedRouteInput, setSelectedRouteInput, checklist })"), "browser-only setup state should accept route setup wizard props");
assert(/<RouteSetupPanel\s+routes=\{routes\}/.test(app), "browser-only setup state should render the route setup wizard");
assert(app.includes("spaceguard-openai-agent-context/v1"), "OpenAI context should keep a stable schema");
assert(app.includes("redactPath"), "OpenAI context should redact local paths before provider calls");
assert(app.includes("No local folders are scanned from this browser session."), "browser-only state should be setup-only");

assert(nativeAdapter.includes("writeNativeProofArtifact"), "native adapter should expose a restricted proof artifact writer");
assert(nativeAdapter.includes("runNativeReadonlyScan"), "native adapter should expose the read-only native scanner");
assert(nativeAdapter.includes("runNativeNpmCacheExecutor"), "native adapter should expose scoped npm cache execution");
assert(rustScanner.includes("fn write_proof_artifact"), "Rust backend should expose a restricted proof artifact writer");
assert(rustScanner.includes("spaceguard-real-workflow-proof.md"), "Rust proof artifact writer should allow workflow proof export");
assert(rustScanner.includes("spaceguard-selected-route-proof-packet.md"), "Rust proof artifact writer should allow selected-route proof export");
assert(rustScanner.includes("execute_cleanup_plan"), "Rust backend should expose the guarded executor command");
assert(rustScanner.includes("SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR"), "Rust backend should gate npm cleanup behind a route flag");
assert(!rustScanner.includes("first-route-proof-required"), "Rust backend should not reject real-data routes behind seeded proof ceremony");

assert(openAiAgent.includes("https://api.openai.com/v1/responses"), "OpenAI adapter should use the Responses API endpoint");
assert(openAiAgent.includes("OPENAI_API_KEY"), "OpenAI adapter should read the primary .env API key");
assert(openAiAgent.includes("openai_agent_advice"), "OpenAI adapter should prefer the native Tauri advisor command");
assert(openAiAgent.includes("type: \"json_schema\""), "OpenAI adapter should request strict structured output");
assert(openAiAgent.includes("directToolAccess: false"), "OpenAI recommendation broker should deny direct tool access");
assert(!viteConfig.includes('envPrefix: ["VITE_", "OPENAI_"]'), "Vite must not expose OPENAI_* secrets to the renderer");
assert(viteConfig.includes("/api/openai-agent/advice"), "Vite proxy should expose the local OpenAI advice endpoint");

assert(packageJson.includes("\"real-app:shell\""), "package tests should expose the real app shell regression");
assert(packageJson.includes("\"openai:smoke\""), "package scripts should expose the OpenAI smoke command");
assert(packageJson.includes("\"setup:doctor\""), "package scripts should expose the setup doctor command");
assert(packageJson.includes("\"setup:route\""), "package scripts should expose route setup");
assert(packageJson.includes("\"validate:workflow-proof\""), "package scripts should expose workflow proof validation");
for (const removedScript of [
  "\"openai:smoke:fixture\"",
  "\"validate:route\"",
  "\"validate:route-preflight\"",
  "\"validate:route-completion\"",
  "\"validate:route-contracts\"",
  "\"proof:route:windows\"",
  "\"proof:first-route\"",
  "\"v1:windows\""
]) {
  assert(!packageJson.includes(removedScript), `package scripts must not expose legacy demo/proof command ${removedScript}`);
}

assert(gitignore.includes("evidence/"), ".gitignore should exclude generated Windows proof evidence folders");
assert(gitignore.includes("spaceguard-real-workflow-proof.md"), ".gitignore should exclude exported workflow proof artifacts");
assert(gitignore.includes("spaceguard-selected-route-proof-packet.md"), ".gitignore should exclude selected-route proof packet exports");
assert(gitignore.includes("commands.ndjson"), ".gitignore should exclude copied command ledgers");

assert(setupDoctorScript.includes("OPENAI_API_KEY"), "setup doctor should check OpenAI key configuration");
assert(setupDoctorScript.includes("multi-flag-blocked"), "setup doctor should expose multi-flag blocking status");
assert(setupDoctorScript.includes("realWorkflow"), "setup doctor should expose a compact real workflow");
assert(setupRouteScript.includes("spaceguard-route-setup-packet/v1"), "route setup script should emit a stable packet schema");
assert(setupRouteScript.includes("SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR"), "route setup script should know the npm cache feature flag");
assert(workflowProofScript.includes("spaceguard-workflow-proof-check/v1"), "workflow proof verifier should emit a stable schema");
assert(workflowProofScript.includes("spaceguard-real-workflow-proof/v1"), "workflow proof verifier should require real workflow proof packets");
assert(workflowProofScript.includes("readyForNextRoute"), "workflow proof verifier should require next-route clearance");
assert(realWorkflow.includes("findPostRunTargetEvidence"), "real workflow helper should expose post-run target evidence matching");
assert(realWorkflow.includes("reviewTarget?.path"), "real workflow helper should compare selected review item paths");
assert(realWorkflow.includes("single-route-scope"), "real workflow helper should expose single route scope guardrail rows");
assert(!realWorkflow.includes("temp-fixture"), "real workflow helper must not point app setup at seeded fixture routes");
assert(!realWorkflow.includes("first-route-proof"), "real workflow helper must not block real routes behind seeded first-route proof rows");
assert(!realWorkflow.includes("SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK"), "real workflow helper must not emit seeded proof env vars");
assert(!nativeAdapter.includes("TEMP_FIXTURE_ACTION_ID"), "native scanner adapter must not expose seeded fixture cleanup action ids");
assert(!nativeAdapter.includes("spaceguard-fixture"), "native scanner adapter must not promote seeded fixture paths into cleanup rows");
assert(!nativeAdapter.includes("SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK"), "native scanner adapter must not synthesize seeded proof env vars");
assert(!openAiAgent.includes("first-route-proof-required"), "OpenAI broker must not preserve seeded proof route blockers");
assert(openAiSmokeScript.includes("buildRouteContractContext"), "OpenAI smoke should validate real route contracts");
assert(openAiSmokeScript.includes("--local-contract"), "OpenAI smoke should expose offline contract validation without fixture data");
for (const removedSmokeMarker of [
  "fixture",
  "Fixture",
  "--fixture-only",
  "buildFixture",
  "temp-fixture",
  "spaceguard-fixture",
  "first-route"
]) {
  assert(!openAiSmokeScript.includes(removedSmokeMarker), `OpenAI smoke must not contain removed marker ${removedSmokeMarker}`);
}
assert(!setupRouteScript.includes("firstRouteProof"), "setup route must not expose seeded proof fields");
assert(!setupRouteScript.includes("SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK"), "setup route must not emit seeded proof env vars");
assert(!setupDoctorScript.includes("firstRouteProof"), "setup doctor must not expose seeded proof fields");
assert(!setupDoctorScript.includes("validate:route"), "setup doctor must not print removed validation packet commands");
for (const removedPath of [
  "scripts/run-first-route-proof.mjs",
  "scripts/run-first-route-proof-windows.ps1",
  "scripts/run-first-route-preflight-check.mjs",
  "scripts/run-first-route-completion-check.mjs",
  "scripts/run-route-proof-windows.ps1",
  "scripts/run-route-preflight-check.mjs",
  "scripts/run-route-completion-check.mjs",
  "scripts/run-windows-validation-packet.mjs",
  "scripts/run-route-contract-audit.mjs",
  "scripts/run-v1-readiness.mjs",
  "scripts/run-v1-windows-preflight.ps1",
  "scripts/run-v1-windows-proof.ps1",
  "scripts/run-v1-proof-check.mjs",
  "scripts/seed-spaceguard-fixtures.ps1",
  "scripts/inspect-spaceguard-fixtures.ps1"
]) {
  assert(!fs.existsSync(path.join(root, removedPath)), `${removedPath} should be removed from the real-app repo surface`);
}

assert(readme.includes("npm run native:dev"), "README should document the desktop shell");
assert(readme.includes("npm run setup:route -- --route npm-cache"), "README should document route setup packet usage");
assert(readme.includes("npm run validate:workflow-proof -- --file"), "README should document workflow proof verifier usage");
assert(realDataGuide.includes("npm run native:dev"), "Windows setup guide should document the desktop shell");
assert(realDataGuide.includes("OPENAI_API_KEY"), "Windows setup guide should document OpenAI key setup");
assert(realDataGuide.includes("npm run validate:workflow-proof -- --file"), "Windows setup guide should document workflow proof verifier usage");

console.log("static app ok");
