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
const supportBundleScript = fs.readFileSync(path.join(root, "scripts", "run-support-bundle.mjs"), "utf8");
const workflowProofModule = fs.readFileSync(path.join(root, "src", "workflow-proof-check.mjs"), "utf8");
const realWorkflow = fs.readFileSync(path.join(root, "src", "real-workflow.mjs"), "utf8");
const tauriIcons = [
  path.join(root, "src-tauri", "icons", "icon.ico"),
  path.join(root, "src-tauri", "icons", "32x32.png"),
  path.join(root, "src-tauri", "icons", "128x128.png"),
  path.join(root, "src-tauri", "icons", "128x128@2x.png")
];
const removedDataWord = "de" + "mo";
const removedSampleWord = "sce" + "nario";
const removedModelImportPattern = new RegExp(`\\.\\/spaceguard-${"model"}\\.mjs`);

for (const iconPath of tauriIcons) {
  assert(fs.existsSync(iconPath), `${path.relative(root, iconPath)} should exist for Tauri desktop builds`);
}

const requiredAppMarkers = [
  "SpaceGuard",
  "Real Windows cleanup",
  "Connect the Windows desktop app",
  "No local folders are scanned from this browser session.",
  "npm run native:dev",
  "npm run windows:ready",
  "OPENAI_API_KEY",
  "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR",
  "Scan PC",
  "Clean space",
  "Explore C: allocation",
  "Selected item",
  "Delete selected files",
  "Space check",
  "Refresh space",
  "Cleanup history",
  "Troubleshooting",
  "Export troubleshooting bundle",
  "selected item",
  "Ask AI",
  "Review only"
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
assert(app.includes("buildOpenAIAgentRecommendationBroker"), "OpenAI advisor should broker model recommendations through deterministic app gates");
assert(app.includes("useRef"), "OpenAI advisor should track the active workflow context across async requests");
assert(app.includes("buildAgentContextKey"), "OpenAI advisor should key advice to the current real workflow context");
assert(app.includes("agentContextKeyRef.current !== requestContextKey"), "OpenAI advisor should ignore stale async responses after workflow context changes");
assert(app.includes("agentAdvice?.contextKey === agentContextKey"), "OpenAI advisor should hide advice from stale scan, target, proof, or prompt context");
assert(app.includes("advice={currentAgentAdvice}"), "OpenAI panel should only render advice for the active workflow context");
assert(app.includes("./real-workflow.mjs"), "app should import tested real workflow helpers");
assert(app.includes("buildAppAgentTaskQueue"), "app should build a deterministic task queue for OpenAI advisor context");
assert(app.includes("buildRouteReadiness"), "app should use tested route readiness guardrails");
assert(app.includes("buildCleanupCandidates(scan, runtime)"), "app cleanup candidates should come from measured native findings and built-in allowlists");
assert(app.includes("buildExecutionLedgerRows"), "app should normalize native execution ledger rows for rendering");
assert(app.includes("buildExecutionGate"), "app should use tested execution dispatch gate guardrails");
assert(app.includes("buildExecutionPrerequisites"), "app should use tested route-specific execution prerequisites");
assert(!app.includes("resolveRuntimeRouteInput"), "app shell should not sync cleanup selection from legacy route flags");
assert(!app.includes("setSetupRouteInput"), "app shell should not require route arming before native cleanup");
assert(app.includes("resetWorkflowForRouteChange"), "app should keep a shared reset helper for workflow state resets");
assert(app.includes("buildWorkflowLocks"), "app should use tested workflow lock policy for cleanup continuation");
assert(app.includes("buildBaselinePromotion"), "app should use tested baseline promotion after optional proof export");
assert(!app.includes("buildRouteSetupChecklist"), "app shell should not render the legacy route setup checklist");
assert(!app.includes("RouteReadinessList"), "clean screen should not render internal readiness rows");
assert(app.includes("formatNotReadyReason"), "clean screen should convert internal blockers into simple not-ready copy");
assert(app.includes("selectWorkflowCandidate"), "cleanup target selection should reuse the guarded selection reset helper");
assert(app.includes("useState(\"clean\")"), "app should open directly on the Clean screen");
assert(!app.includes("id: \"overview\""), "sidebar should not force users through an overview detour");
assert(app.includes("Advanced scan options"), "scan tuning should stay collapsed behind advanced options");
assert(/activeView === "clean"[\s\S]*<ScanPanel[\s\S]*<CleanPanel/.test(app), "Clean screen should contain scan and cleanup controls in one flow");
assert(app.includes("const canExecute = executionGate.ready"), "execute button should stay locked through the shared execution gate");
assert(app.includes("const currentExecutionGate = buildExecutionGate"), "execute handler should recheck the execution gate before native dispatch");
assert(app.includes("if (!currentExecutionGate.ready)"), "execute handler should block native dispatch when execution gate is not ready");
assert(app.includes("formatExecutionGateError"), "execute handler should convert dispatch blockers into plain user-facing copy");
assert(app.includes("Technical details"), "clean panel should collapse native diagnostics behind technical details");
assert(app.includes("ledger.warnings"), "clean panel should keep native executor warnings inside collapsed technical details");
assert(app.includes("entry.rejectCode"), "clean panel should keep native reject codes inside collapsed technical details");
assert(!app.includes("Delete this selected item from this PC."), "normal cleanup should use the selected row checkbox as the confirmation");
assert(app.includes("workflowLocks"), "execution gate should receive workflow lock state from the shared cleanup policy");
assert(app.includes("activeScanGeneratedAt: scan?.generatedAt || \"\""), "execution gate should receive active scan timestamp for execution context");
assert(app.includes("executionRecord?.accepted"), "proof export should require an accepted native execution record");
assert(!app.includes("targetSwitchLocked"), "cleanup queue should not lock target switching behind proof export");
assert(!app.includes("routeSetupLocked"), "app shell should not carry route setup locks in the production flow");
assert(app.includes("workflowProofAccepted"), "optional proof export should still track in-app verifier state");
assert(app.includes("buildWorkflowProofCheck"), "proof export should run the shared workflow proof verifier inside the app");
assert(app.includes("workflowProofCheck"), "support details should render workflow validation output from the app");
assert(app.includes("Troubleshooting bundle exported"), "support export should report accepted in-app workflow validation with user-facing copy");
assert(app.includes("proofKind: \"workflow-proof-check\""), "proof export should persist the in-app verifier output as a restricted artifact");
assert(app.includes("proofKind: \"support-bundle\""), "proof export should persist an in-app support bundle as a restricted artifact");
assert(app.includes("buildInAppSupportBundleReport"), "proof export should build the support bundle inside the desktop app");
assert(app.includes("renderInAppSupportBundleMarkdown"), "proof export should render support bundle markdown inside the desktop app");
assert(realWorkflow.includes("no post-clean evidence is needed"), "accepted no-op executions should explain that post-clean rescan is skipped");
assert(app.includes("supportBundleWritten"), "optional proof export should keep support bundle completion state");
assert(app.includes("supportBundleWritten: Boolean(supportBundleWritten)"), "OpenAI context should receive support bundle completion state");
assert(app.includes("proofAllowsNextExecutor: workflowLocks.proofAllowsNextExecutor"), "OpenAI context should use the tested workflow lock policy for next-executor allowance");
assert(app.includes("noOpExecution: Boolean(workflowLocks.noOpExecution)"), "OpenAI context should expose accepted zero-byte no-op handoff state");
assert(app.includes("agentTaskQueue"), "OpenAI context should include the app task queue that the advisor instructions require");
assert(app.includes("manualReviewTargets"), "OpenAI context should include manual review targets");
assert(app.includes("visibleTargets"), "OpenAI panel should unlock for executable or manual review findings");
assert(app.includes("scan.driveInventory"), "manual findings should include native drive inventory evidence");
assert(app.includes("Drive inventory:"), "drive inventory rows should be visible as manual review cards");
assert(app.includes("slugifyId"), "drive inventory manual finding ids should be stable and normalized");
assert(app.includes("selected-route-proof-reviewed"), "app workflow proof should require reviewed selected-route proof export");
assert(!app.includes("selected-route-proof-import"), "app workflow proof should not require obsolete selected-route proof import");
assert(!app.includes("Export proof, let the in-app verifier accept it, and capture the support bundle before selecting another cleanup target."), "cleanup queue should not describe proof export as a target-switch lock");
assert(!app.includes("disabled={targetSwitchLocked && candidate.id !== selectedId}"), "cleanup queue should not disable other targets behind proof export");
assert(!app.includes("disabled={routeSetupLocked && route.routeInput !== selectedRouteInput}"), "route setup locks should not exist in the app shell");
assert(!app.includes("Current route is locked until proof export and support bundle capture finish."), "route setup proof lock copy should not render in the app shell");
assert(app.includes("workflowLocks?.noOpExecution"), "support details should render accepted zero-byte no-op handoff state");
assert(app.includes("buildProofCandidateFromExecutionRecord"), "proof panel should preserve executed target proof context after baseline promotion");
assert(app.includes("recipeId: selectedCandidate.recipeId"), "execution records should preserve recipe id for post-run proof matching");
assert(app.includes("envVar: selectedCandidate.envVar"), "execution records should preserve selected route flag for proof/support re-export");
assert(app.includes("const exportCandidate = selectedCandidate || proofCandidate"), "proof export should use preserved execution context after baseline promotion clears queue selection");
assert(!app.includes("if (!selectedCandidate || !executionRecord) return;"), "proof export should not silently stop after baseline promotion clears selected candidate");
assert(app.includes("setScan(baselinePromotion.activeScan)"), "proof export should promote accepted post-run scan to active cleanup baseline");
assert(app.includes("Latest scan is now active."), "support export should tell the user when baseline promotion succeeds");
assert(!app.includes("npm run validate:workflow-proof -- --file spaceguard-real-workflow-proof.md returned accepted"), "proof panel should not rely on a manual CLI acceptance checkbox");
assert(
  /function selectWorkflowCandidate\(id\) \{[\s\S]*setSelectedId\(id\);[\s\S]*setExecutionResult\(null\);[\s\S]*setExecutionRecord\(null\);[\s\S]*setPostRunScan\(null\);[\s\S]*setProofExportStatus\("idle"\);[\s\S]*setProofExportMessage\(""\);[\s\S]*\}/.test(app),
  "selecting a different cleanup target should clear stale execution, rescan, and proof export state"
);
assert(
  /if \(afterExecution\) \{[\s\S]*setPostRunScan\(result\);[\s\S]*setProofReviewed\(false\);[\s\S]*setProofExportStatus\("idle"\);[\s\S]*setProofExportMessage\(""\);[\s\S]*\}/.test(app),
  "post-clean rescan should force fresh proof review and clear stale export status"
);
assert(app.includes("buildManualFindingGuidance"), "app should use tested manual finding guidance");
assert(app.includes("buildManualFindingReviewRows"), "app should use tested manual review row guidance");
assert(app.includes("\"windows-old\": \"Previous Windows installation review\""), "manual panel should surface Windows.old findings");
assert(app.includes("hibernation: \"Hibernation file review\""), "manual panel should surface hibernation file findings");
assert(app.includes("pagefile: \"Pagefile review\""), "manual panel should surface pagefile findings");
assert(app.includes("\"wsl-vhdx\": \"WSL virtual disk review\""), "manual panel should surface WSL virtual disk findings");
assert(app.includes("Recommended action"), "manual review panel should render simple recommended action copy");
assert(app.includes("Review details"), "manual review panel should collapse manual details");
assert(app.includes("Items inside"), "manual review panel should render visible review candidates inside details");
assert(app.includes("Signals"), "manual review panel should render candidate usage signals inside details");
assert(app.includes("Why review only"), "manual review panel should render guardrails inside details");
assert(!app.includes("Selected .env block"), "app shell should not ask users to copy route-specific env blocks");
assert(!app.includes("copyEnvBlock"), "app shell should not expose route setup copy actions");
assert(!app.includes("navigator.clipboard.writeText(checklist.envBlock.content)"), "app shell should not copy route setup env content");
assert(!app.includes("Windows test runbook"), "app shell should not render the legacy route test runbook");
assert(!app.includes("copyRunbook"), "app shell should not expose route runbook copy actions");
assert(!app.includes("navigator.clipboard.writeText(checklist.runbook.content)"), "app shell should not copy route setup runbooks");
assert(!app.includes("npm run openai:smoke -- --local-contract --route"), "app shell should not show route-contract smoke setup steps");
assert(app.includes("function ConnectionRequired({ runtime, runtimeStatus, runtimeError, onRefresh })"), "browser-only setup state should accept only runtime status and refresh props");
assert(app.includes("This screen contains no preloaded cleanup data and cannot touch local files."), "browser-only setup state should explicitly avoid bundled cleanup data");
assert(app.includes("This setup page is intentionally non-executable. Start the desktop shell to test real Windows data."), "browser-only setup state should explain that real execution requires the desktop shell");
assert(/if \(!nativeConnected\) \{[\s\S]*return \(\s*<AppFrame[\s\S]*<ConnectionRequired/.test(app), "browser-only setup state should keep the pinned sidebar while rendering non-executable setup content");
assert(app.includes("Windows launch steps"), "browser-only setup state should present the desktop launch checklist");
assert(app.includes("Scan -> check -> delete"), "browser-only setup should describe the simplified cleanup flow");
assert(!/<RouteSetupPanel\s+routes=\{routes\}/.test(app), "browser-only setup state should not render the route setup wizard");
assert(app.includes("spaceguard-openai-agent-context/v1"), "OpenAI context should keep a stable schema");
assert(app.includes("Recommendation diagnostics"), "OpenAI panel should collapse deterministic broker status");
assert(app.includes("agentBroker.rows"), "OpenAI panel should render broker rows for recommendations");
assert(app.includes("row.blockedReason"), "OpenAI panel should expose broker blockers");
assert(app.includes("runAgentBrokerAction"), "OpenAI broker recommendations should route through guarded app actions");
assert(app.includes("resolveWorkflowAgentBrokerCandidate"), "OpenAI broker actions should resolve model target ids to real cleanup candidates");
assert(app.includes("onBrokerAction(row)"), "OpenAI panel should expose a user-clicked broker action button");
assert(app.includes("formatAgentButtonLabel(row)"), "OpenAI broker action button should use simple user-facing labels");
assert(app.includes("redactPath"), "OpenAI context should redact local paths before provider calls");
assert(app.includes("No local folders are scanned from this browser session."), "browser-only state should be setup-only");
assert(app.includes("Native proof artifact writer is required"), "proof export should block when the native artifact writer does not write proof files");
assert(!app.includes("downloadTextFile(fileName, content)"), "proof export must not silently fall back to browser downloads");

assert(nativeAdapter.includes("writeNativeProofArtifact"), "native adapter should expose a restricted proof artifact writer");
assert(nativeAdapter.includes("runNativeReadonlyScan"), "native adapter should expose the read-only native scanner");
assert(nativeAdapter.includes("runNativeNpmCacheExecutor"), "native adapter should expose scoped npm cache execution");
assert(rustScanner.includes("fn write_proof_artifact"), "Rust backend should expose a restricted proof artifact writer");
assert(rustScanner.includes("spaceguard-real-workflow-proof.md"), "Rust proof artifact writer should allow workflow proof export");
assert(rustScanner.includes("spaceguard-selected-route-proof-packet.md"), "Rust proof artifact writer should allow selected-route proof export");
assert(rustScanner.includes("spaceguard-workflow-proof-check.json"), "Rust proof artifact writer should allow workflow proof check export");
assert(rustScanner.includes("spaceguard-support-bundle.md"), "Rust proof artifact writer should allow support bundle export");
assert(rustScanner.includes("support bundle capture instead of another executor"), "native OpenAI advisor should recommend support bundle handoff while next executor is locked");
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
assert(packageJson.includes("\"support:bundle\""), "package scripts should expose support bundle capture");
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
assert(gitignore.includes("spaceguard-workflow-proof-check.json"), ".gitignore should exclude workflow proof check exports");
assert(gitignore.includes("spaceguard-support-bundle.md"), ".gitignore should exclude support bundle exports");
assert(gitignore.includes("commands.ndjson"), ".gitignore should exclude copied command ledgers");

assert(setupDoctorScript.includes("OPENAI_API_KEY"), "setup doctor should check OpenAI key configuration");
assert(setupDoctorScript.includes("multi-flag-blocked"), "setup doctor should expose multi-flag blocking status");
assert(setupDoctorScript.includes("realWorkflow"), "setup doctor should expose a compact real workflow");
assert(setupRouteScript.includes("spaceguard-route-setup-packet/v1"), "route setup script should emit a stable packet schema");
assert(setupRouteScript.includes("SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR"), "route setup script should know the npm cache feature flag");
assert(workflowProofScript.includes("../src/workflow-proof-check.mjs"), "workflow proof CLI should use the shared verifier module");
assert(supportBundleScript.includes("spaceguard-support-bundle/v1"), "support bundle should emit a stable schema");
assert(supportBundleScript.includes("spaceguard-selected-route-proof-packet.md"), "support bundle should inspect selected-route proof");
assert(supportBundleScript.includes("spaceguard-real-workflow-proof.md"), "support bundle should inspect real workflow proof");
assert(supportBundleScript.includes("spaceguard-workflow-proof-check.json"), "support bundle should inspect workflow proof check output");
assert(workflowProofModule.includes("spaceguard-workflow-proof-check/v1"), "workflow proof verifier should emit a stable schema");
assert(workflowProofModule.includes("spaceguard-real-workflow-proof/v1"), "workflow proof verifier should require real workflow proof packets");
assert(workflowProofModule.includes("readyForNextRoute"), "workflow proof verifier should require next-route clearance");
assert(workflowProofModule.includes("selected-route-proof-reviewed"), "workflow proof verifier should require selected-route proof review");
assert(!workflowProofModule.includes("selected-route-proof-import"), "workflow proof verifier should not require obsolete selected-route proof import");
assert(realWorkflow.includes("findPostRunTargetEvidence"), "real workflow helper should expose post-run target evidence matching");
assert(realWorkflow.includes("reviewTarget?.path"), "real workflow helper should compare selected review item paths");
assert(realWorkflow.includes("built-in-allowlist"), "real workflow helper should expose built-in allowlists as execution guardrails");
assert(realWorkflow.includes("production-cleanup"), "real workflow helper should expose production cleanup authority as an execution guardrail");
assert(realWorkflow.includes("spaceguard-execution-gate/v1"), "real workflow helper should expose a stable execution gate schema");
assert(!realWorkflow.includes("proof-handoff"), "execution gate should not block dispatch behind proof handoff");
assert(!realWorkflow.includes("baseline-scan-current"), "execution gate should not block dispatch behind stale-baseline proof handoff");
assert(realWorkflow.includes("spaceguard-workflow-locks/v1"), "real workflow helper should expose a stable workflow lock schema");
assert(realWorkflow.includes("spaceguard-baseline-promotion/v1"), "real workflow helper should expose a stable baseline promotion schema");
assert(!realWorkflow.includes("temp-fixture"), "real workflow helper must not point app setup at seeded fixture routes");
assert(!realWorkflow.includes("first-route-proof"), "real workflow helper must not block real routes behind seeded first-route proof rows");
assert(!realWorkflow.includes("SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK"), "real workflow helper must not emit seeded proof env vars");
assert(!nativeAdapter.includes("TEMP_FIXTURE_ACTION_ID"), "native scanner adapter must not expose seeded fixture cleanup action ids");
assert(!nativeAdapter.includes("spaceguard-fixture"), "native scanner adapter must not promote seeded fixture paths into cleanup rows");
assert(!nativeAdapter.includes("SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK"), "native scanner adapter must not synthesize seeded proof env vars");
assert(!openAiAgent.includes("first-route-proof-required"), "OpenAI broker must not preserve seeded proof route blockers");
assert(!openAiAgent.includes("selected-route-proof-import"), "OpenAI broker must not recommend obsolete selected-route proof import tasks");
assert(!openAiAgent.includes("candidateSamples"), "OpenAI broker must not expose sample-named candidate context");
assert(!openAiAgent.includes("sampleNames"), "OpenAI broker must not expose sample-named candidate entries");
assert(openAiAgent.includes("support-bundle"), "OpenAI broker should guide proof-complete users toward support bundle capture");
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

assert(readme.includes("npm run native:dev"), "README should document the Tauri Windows desktop launcher");
assert(!readme.includes("npm run setup:route -- --route npm-cache"), "README should not put route setup in the normal cleanup path");
assert(readme.indexOf("npm run windows:ready") < readme.indexOf("npm run native:dev"), "README quick start should check Windows readiness before launch");
assert(readme.includes("Cleanup does not require route arming"), "README should explain that production cleanup uses built-in allowlists");
assert(!readme.includes("npm run validate:workflow-proof -- --file"), "README should not put proof verification in the normal cleanup path");
assert(!readme.includes("spaceguard-workflow-proof-check.json"), "README should not list proof artifact files in the normal cleanup path");
assert(!readme.includes("npm run support:bundle"), "README should not require support bundle capture for normal cleanup");
assert(readme.includes("Support export tools are for troubleshooting only"), "README should keep support export clearly optional");
assert(realDataGuide.includes("npm run native:dev"), "Windows setup guide should document the Tauri Windows desktop launcher");
assert(realDataGuide.indexOf("npm run windows:ready") < realDataGuide.indexOf("npm run native:dev"), "Windows setup guide should check readiness before launch");
assert(realDataGuide.includes("Cleanup does not require route arming"), "Windows setup guide should explain built-in allowlists");
assert(realDataGuide.includes("OPENAI_API_KEY"), "Windows setup guide should document OpenAI key setup");
assert(!realDataGuide.includes("npm run validate:workflow-proof -- --file"), "Windows setup guide should not put proof verification in the normal cleanup path");
assert(!realDataGuide.includes("spaceguard-workflow-proof-check.json"), "Windows setup guide should not list proof artifact files in the normal cleanup path");
assert(!realDataGuide.includes("npm run support:bundle"), "Windows setup guide should not require support bundle capture for normal cleanup");
assert(realDataGuide.includes("Support export is only for troubleshooting"), "Windows setup guide should keep support export clearly optional");

console.log("static app ok");
