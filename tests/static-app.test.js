const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "src", "index.css"), "utf8");
const app = fs.readFileSync(path.join(root, "src", "App.jsx"), "utf8");
const model = fs.readFileSync(path.join(root, "src", "spaceguard-model.mjs"), "utf8");
const nativeAdapter = fs.readFileSync(path.join(root, "src", "native-scanner.mjs"), "utf8");
const openAiAgent = fs.readFileSync(path.join(root, "src", "openai-agent.mjs"), "utf8");
const viteConfig = fs.readFileSync(path.join(root, "vite.config.mjs"), "utf8");
const tauriConfig = fs.readFileSync(path.join(root, "src-tauri", "tauri.conf.json"), "utf8");
const rustScanner = fs.readFileSync(path.join(root, "src-tauri", "src", "main.rs"), "utf8");
const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");
const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const realDataGuide = fs.readFileSync(path.join(root, "WINDOWS_REAL_DATA_SETUP.md"), "utf8");
const agentDesign = fs.readFileSync(path.join(root, "AGENT_DESIGN.md"), "utf8");
const nativeBetaRunbook = fs.readFileSync(path.join(root, "NATIVE_BETA_DISTRIBUTION.md"), "utf8");
const fixtureScript = fs.readFileSync(path.join(root, "scripts", "seed-spaceguard-fixtures.ps1"), "utf8");
const fixtureInspectScript = fs.readFileSync(path.join(root, "scripts", "inspect-spaceguard-fixtures.ps1"), "utf8");
const openAiSmokeScriptPath = path.join(root, "scripts", "run-openai-advisor-smoke.mjs");
const openAiSmokeScript = fs.existsSync(openAiSmokeScriptPath) ? fs.readFileSync(openAiSmokeScriptPath, "utf8") : "";
const setupDoctorScriptPath = path.join(root, "scripts", "run-setup-doctor.mjs");
const setupDoctorScript = fs.existsSync(setupDoctorScriptPath) ? fs.readFileSync(setupDoctorScriptPath, "utf8") : "";
const setupRouteScriptPath = path.join(root, "scripts", "run-setup-route.mjs");
const setupRouteScript = fs.existsSync(setupRouteScriptPath) ? fs.readFileSync(setupRouteScriptPath, "utf8") : "";
const validationRouteScriptPath = path.join(root, "scripts", "run-windows-validation-packet.mjs");
const validationRouteScript = fs.existsSync(validationRouteScriptPath) ? fs.readFileSync(validationRouteScriptPath, "utf8") : "";
const workflowProofScriptPath = path.join(root, "scripts", "run-workflow-proof-check.mjs");
const workflowProofScript = fs.existsSync(workflowProofScriptPath) ? fs.readFileSync(workflowProofScriptPath, "utf8") : "";

function rustFunctionBlock(name) {
  const start = rustScanner.indexOf(`fn ${name}(`);
  assert(start >= 0, `Rust scanner should define ${name}`);
  const next = rustScanner.indexOf("\nfn ", start + 1);
  return rustScanner.slice(start, next === -1 ? rustScanner.length : next);
}

const requiredAppMarkers = [
  "SpaceGuard",
  "Dry-run agent",
  "Run demo scan",
  "Cleanup actions",
  "Agent gates",
  "Confirm permanent removal",
  "Plan review queue",
  "Execution preflight",
  "Execution ledger",
  "Protected paths",
  "Demo scenario",
  "Export report",
  "Real data readiness",
  "Windows setup assistant",
  "Safe setup commands",
  "Intake constraints",
  "Admin/system actions",
  "intake gated",
  "Allow admin routes",
  "Task powers",
  "Scoped powers",
  "Power lease audit",
  "Lease envelope",
  "Safety interlock",
  "Execution envelope",
  "Dry-run launch guard",
  "Consent arm gate",
  "real run disabled",
  "Run real scan",
  "Native app required",
  "Real scan settings",
  "Native scan request guard",
  "Fix scan settings",
  "Target drive scope",
  "System roots resolve to",
  "Custom read-only roots",
  "Add root",
  "Custom root discovery",
  "Project artifacts",
  "Traversal depth",
  "Entry cap",
  "Actual volume usage",
  "drive evidence",
  "Drive inventory",
  "Discovery boundary",
  "no executor routes",
  "Storage pressure diagnosis",
  "Diagnosis boundary",
  "no cleanup authority",
  "Native evidence quality",
  "Evidence boundary",
  "no executor authority",
  "Scan coverage",
  "Coverage confidence",
  "Recovery advisor",
  "Agent questions",
  "OpenAI cleanup agent",
  "AI authority boundary",
  "Real cleanup command flow",
  "AI recommendation path",
  "Selected route proof packet",
  "Ask OpenAI for next cleanup step",
  "Follow AI recommendation",
  "direct tools blocked",
  "Open item review",
  "Question queue is clear",
  "Storage strategy",
  "Manual storage strategy",
  "Manual strategy checklist",
  "Manual-only boundary",
  "Review workbench",
  "Decision log",
  "Item review",
  "Installed app evidence summary",
  "Uninstall registry source",
  "UserAssist source",
  "Usage proof missing",
  "manual-only evidence",
  "Inspect",
  "Executor policy",
  "Native dry-run",
  "Scope evidence export",
  "Rejected samples",
  "Candidate safety manifest",
  "Candidate boundary",
  "no executor authority",
  "Real temp cleanup",
  "Executor boundary",
  "Run real temp cleanup",
  "Reviewed project dependencies",
  "Project executor boundary",
  "Run reviewed dependency cleanup",
  "Privilege boundary",
  "Privacy boundary",
  "Public beta readiness",
  "Distribution boundary",
  "Native beta",
  "Support bundle",
  "Redaction boundary",
  "Export support bundle",
  "Beta handoff manifest",
  "Export beta handoff manifest",
  "Local evidence backup",
  "Import evidence backup",
  "Runtime privilege",
  "Release gate",
  "Write readiness",
  "Final write gate",
  "write hidden",
  "Real executor capsule",
  "First-safe executor contract",
  "Temp executor activation",
  "Temp activation rehearsal",
  "Demo-only evidence",
  "Activation boundary",
  "activation locked",
  "Open temp activation",
  "Allowed targets",
  "Forbidden targets",
  "Target scope audit",
  "destructive hidden",
  "Runtime capability",
  "Write command",
  "route executor available",
  "Contract echo",
  "Disposable VM matrix",
  "Validation evidence",
  "Validation evidence ledger",
  "Fixture evidence import",
  "Import fixture evidence",
  "Export validation pack",
  "Reset evidence",
  "Fixture roots",
  "Evidence commands",
  "Item decisions",
  "Use recommendations",
  "Move/archive",
  "Move",
  "Archive",
  "Keep all",
  "Verification",
  "Plan snapshot",
  "Post-run verification",
  "Rescan proof",
  "Run post-run rescan",
  "Post-run proof requires the Tauri desktop shell",
  "Export verification checklist",
  "Rescan comparison",
  "Post-run scan timing",
  "Export rescan comparison",
  "needs later scan",
  "Rollback plan",
  "Rollback proof ledger",
  "Restore, backup, or acknowledgement reference",
  "Rollback proof notes",
  "Reset proof",
  "Restore posture",
  "real run locked",
  "Dry-run consent",
  "Arm current dry-run",
  "Consent receipt",
  "Run readiness",
  "Executor manifest",
  "Manifest next steps",
  "Tool command inventory",
  "Command boundary",
  "no shell",
  "Run history",
  "Persisted records",
  "Export history",
  "Scan session",
  "Evidence fingerprint",
  "Changed since scan"
];

for (const marker of requiredAppMarkers) {
  assert(app.includes(marker), `App.jsx should render ${marker}`);
}

assert(html.includes('<div id="root"></div>'), "index.html should expose React root");
assert(html.includes("/src/main.jsx"), "index.html should load React entrypoint");
assert(css.includes("Roboto+Flex"), "app should use a Roboto-family font");
assert(css.includes("@tailwind"), "Tailwind should be configured");
assert(app.includes("@/components/ui/button"), "app should use shadcn-style Button component");
assert(app.includes("@/components/ui/card"), "app should use shadcn-style Card component");
assert(app.includes("runScan"), "demo scan workflow should exist");
assert(app.includes("simulateCleanup"), "execution should be simulated");
assert(app.includes("getExecutionReadiness"), "execution gate checks should be wired");
assert(app.includes("buildExecutionConsentReceipt"), "execution consent receipt should be wired");
assert(app.includes("buildTaskPowerCatalog"), "task power catalog should be wired");
assert(app.includes("buildTaskPowerBroker"), "task power broker should be wired");
assert(app.includes("TaskPowerBrokerPanel"), "task power broker panel should be rendered");
assert(app.includes("buildTaskPowerLeaseAudit"), "task power lease audit should be wired");
assert(app.includes("TaskPowerLeaseAuditPanel"), "task power lease audit panel should be rendered");
assert(app.includes("buildTaskCapabilityGrants"), "task capability grants should be wired");
assert(app.includes("TaskCapabilityGrantPanel"), "task capability grant panel should be rendered");
assert(app.includes("buildAgentTaskRunbook"), "task runbook should be wired");
assert(app.includes("TaskRunbookPanel"), "task runbook panel should be rendered");
assert(app.includes("buildRestrictionPolicyMatrix"), "restriction policy matrix should be wired");
assert(app.includes("RestrictionPolicyMatrixPanel"), "restriction policy matrix panel should be rendered");
assert(app.includes("runNativeReadonlyScan"), "real read-only scan workflow should be wired");
assert(app.includes("buildWindowsSetupAssistant"), "Windows setup assistant should be wired");
assert(app.includes("WindowsSetupAssistantPanel"), "Windows setup assistant panel should be rendered");
assert(app.includes("assistant.realWorkflow"), "Windows setup assistant should render the compact real workflow");
assert(app.includes("onWorkflowStep"), "Windows setup assistant should expose workflow step actions");
assert(app.includes("onExportWorkflowProof"), "Windows setup assistant should expose real workflow proof export");
assert(app.includes("handleWindowsSetupWorkflowStep"), "App should route setup workflow steps through existing handlers");
assert(app.includes("step.actionType"), "Windows setup assistant workflow should read model action types");
assert(app.includes("post-run-rescan"), "Windows setup assistant UI should expose post-run rescan workflow step");
assert(app.includes("proof-import"), "Windows setup assistant UI should expose proof import workflow step");
assert(app.includes("appCloseHandoff"), "Windows setup assistant UI should render the app-close proof handoff");
assert(app.includes("appCloseHandoff.finalizeCommand"), "Windows setup assistant UI should render the route-specific finalize command");
assert(app.includes("Proof handoff"), "Windows setup assistant should label the first-route proof handoff");
assert(app.includes("spaceguard-real-workflow-proof.md"), "Windows setup assistant should surface the workflow proof export file");
assert(app.includes("spaceguard-selected-route-proof-packet.md"), "Windows setup assistant should surface the selected-route proof export file");
assert(app.includes("proof:first-route:windows:finalize"), "Windows setup assistant should surface the first-route finalize command");
assert(model.includes("spaceguard-in-app-proof-handoff/v1"), "model should expose the in-app proof handoff schema");
assert(app.includes("buildRealDataLaunchRoadmap"), "real data launch roadmap should be wired");
assert(app.includes("nativeEvidenceQuality"), "native evidence quality should feed downstream planning surfaces");
assert(app.includes("RealDataLaunchRoadmapPanel"), "real data launch roadmap panel should be rendered");
assert(app.includes("real-data-launch-roadmap-panel"), "real data launch roadmap should be focusable");
assert(app.includes("Real data launch roadmap"), "real data roadmap should expose launch status copy");
assert(app.includes("buildNativeBetaDistributionReadiness"), "native beta distribution readiness should be wired");
assert(app.includes("NativeBetaDistributionPanel"), "native beta distribution panel should be rendered");
assert(app.includes("native-beta-distribution-panel"), "native beta distribution panel should be focusable");
assert(app.includes("Native beta distribution"), "native beta distribution panel should expose setup copy");
assert(app.includes("NATIVE_BETA_EVIDENCE_STORAGE_KEY"), "native beta evidence should be persisted locally");
assert(app.includes("nativeBetaEvidenceSpecs"), "native beta evidence checklist should be explicit");
assert(app.includes("readStoredNativeBetaEvidence"), "native beta evidence should load from local storage");
assert(app.includes("writeStoredNativeBetaEvidence"), "native beta evidence should save to local storage");
assert(app.includes("nativeBetaImportText"), "native beta evidence import text should be tracked in UI state");
assert(app.includes("importNativeBetaEvidenceLedger"), "native beta evidence import should be wired");
assert(model.includes("buildNativeBetaEvidenceImport"), "model should import native beta evidence ledgers");
assert(model.includes("spaceguard-native-beta-evidence-import/v1"), "native beta evidence import should expose a schema");
assert(app.includes("buildNativeBetaEvidenceLedger"), "native beta evidence should be exportable as a ledger");
assert(app.includes("buildNativeBetaEvidenceLedgerMarkdown"), "native beta evidence ledger should export markdown");
assert(app.includes("buildNativeBetaDocumentationEvidence"), "native beta documentation readiness should be derived from evidence");
assert(app.includes("nativeBetaEvidenceLedger"), "native beta evidence ledger should feed downstream readiness surfaces");
assert(app.includes("coerceNativeBetaEvidenceFormRecord"), "native beta evidence should migrate older records");
assert(app.includes("setNativeBetaEvidenceRow"), "native beta evidence checklist should be editable");
assert(app.includes("Recorded beta evidence"), "native beta distribution panel should expose editable evidence");
assert(app.includes("Export ledger"), "native beta distribution panel should expose evidence export action");
assert(app.includes("Import exported ledger"), "native beta distribution panel should expose evidence import action");
assert(app.includes("Paste spaceguard-native-beta-evidence/v1 JSON"), "native beta evidence import should accept exported JSON");
assert(app.includes("Import ledger"), "native beta evidence import should have an explicit action");
assert(app.includes("spaceguard-native-beta-evidence.md"), "native beta evidence export should use a stable file name");
assert(app.includes("Structured Native Beta Evidence JSON"), "native beta evidence export should include structured JSON");
assert(app.includes("Evidence path or artifact id"), "native beta evidence should require artifact references");
assert(!app.includes("publicReleaseResearch: true"), "native beta documentation evidence should not be hardcoded as complete in the UI");
assert(model.includes("Native Beta Evidence Ledger"), "report should export native beta evidence records");
assert(model.includes("nativeBetaEvidenceLedger"), "report should accept native beta evidence ledger input");
assert(model.includes("native-beta-evidence-ledger"), "release review should require native beta evidence ledger");
assert(app.includes("buildDemoRehearsalRunbook"), "demo rehearsal runbook should be wired");
assert(app.includes("DemoRehearsalRunbookPanel"), "demo rehearsal runbook panel should be rendered");
assert(app.includes("buildProductCompletionAudit"), "product completion audit should be wired");
assert(app.includes("ProductCompletionAuditPanel"), "product completion audit panel should be rendered");
assert(app.includes("buildSafetyInterlock"), "safety interlock should be wired");
assert(app.includes("SafetyInterlockPanel"), "safety interlock panel should be rendered");
assert(app.includes("buildDryRunLaunchGuard"), "dry-run launch guard should be wired");
assert(app.includes("dryRunLaunchGuard.ready"), "dry-run launch guard should gate simulation");
assert(app.includes("buildOperatingChecklist"), "operating checklist should be wired");
assert(app.includes("OperatingChecklistPanel"), "operating checklist panel should be rendered");
assert(app.includes("operating-checklist-panel"), "operating checklist should be focusable");
assert(app.includes("Current operating mode"), "operating checklist should summarize the current mode");
assert(app.includes("scanSettings"), "native scan settings should be wired");
assert(app.includes("targetDrive"), "native scan settings should include target drive");
assert(app.includes("updateScanSetting"), "native scan settings should invalidate stale evidence");
assert(app.includes("customRoots"), "native scan settings should include custom read-only roots");
assert(app.includes("addCustomScanRoot"), "custom scan roots should be editable");
assert(app.includes("buildCustomRootTriage"), "custom root triage should be wired");
assert(app.includes("CustomRootTriagePanel"), "custom root triage panel should be rendered");
assert(app.includes("CUSTOM_ROOT_TRIAGE_STORAGE_KEY"), "custom root triage should be persisted locally");
assert(app.includes("buildScanCoverageSummary"), "scan coverage summary should be wired");
assert(app.includes("buildDriveInventorySummary"), "drive inventory summary should be wired");
assert(app.includes("DriveInventoryPanel"), "drive inventory panel should be rendered");
assert(app.includes("drive-inventory-panel"), "drive inventory should be focusable");
assert(app.includes("buildStoragePressureDiagnosis"), "storage pressure diagnosis should be wired");
assert(app.includes("StoragePressureDiagnosisPanel"), "storage pressure diagnosis panel should be rendered");
assert(app.includes("storage-pressure-diagnosis-panel"), "storage pressure diagnosis should be focusable");
assert(app.includes("buildNativeEvidenceQualityGate"), "native evidence quality should be wired");
assert(app.includes("NativeEvidenceQualityPanel"), "native evidence quality panel should be rendered");
assert(app.includes("native-evidence-quality-panel"), "native evidence quality should be focusable");
assert(app.includes("buildCandidateSafetyManifest"), "candidate safety manifest should be wired");
assert(app.includes("CandidateSafetyManifestPanel"), "candidate safety manifest panel should be rendered");
assert(app.includes("candidate-safety-manifest-panel"), "candidate safety manifest should be focusable");
assert(app.includes("Candidate samples prove target filtering"), "candidate safety panel copy should keep executor authority separate");
assert(app.includes("buildScanSessionEvidence"), "scan session freshness guard should be wired");
assert(app.includes("buildRecoveryAdvisor"), "recovery advisor should be wired");
assert(app.includes("buildAgentQuestionQueue"), "agent question queue should be wired");
const agentQuestionQueueCallStart = app.indexOf("buildAgentQuestionQueue({");
const agentQuestionQueueCallEnd = app.indexOf("}),\n    [", agentQuestionQueueCallStart);
const agentQuestionQueueCall = app.slice(agentQuestionQueueCallStart, agentQuestionQueueCallEnd);
assert(agentQuestionQueueCall.includes("tempExecutorActivationGate"), "agent question queue should receive temp executor activation state");
assert(app.includes("buildAIAgentIntegration"), "AI agent integration audit should be wired");
assert(app.includes("OpenAIAgentPanel"), "OpenAI agent panel should be rendered");
assert(app.includes("openai-agent-panel"), "OpenAI agent panel should be focusable");
assert(app.includes("requestOpenAIAgentAdvice"), "OpenAI agent should call the provider adapter");
assert(app.includes("handleOpenAIAgentRecommendation"), "OpenAI recommendations should map to guarded UI actions");
assert(app.includes("aiRecommendationActionLabel"), "OpenAI recommendation rows should expose action labels");
assert(app.includes("buildOpenAIAgentRecommendationBroker"), "OpenAI recommendations should be brokered before UI actions run");
assert(app.includes("getOpenAIAgentRecommendationKey"), "OpenAI recommendation broker rows should be keyed consistently");
assert(app.includes("OpenAIRecommendationCard"), "OpenAI recommendation cards should show broker state");
assert(app.includes("Open gate"), "blocked OpenAI recommendations should route users to the relevant gate");
assert(app.includes("brokerRow?.focusActionId || row.targetId || row.id"), "OpenAI review-target actions should focus the broker-resolved parent action id");
assert(app.includes("isSelectedRouteProofImportRecommendation"), "OpenAI proof-import recommendations should be detected before generic manual routing");
assert(app.includes("validation-import-prepared"), "OpenAI proof-import recommendations should record prepared import handoffs");
assert(app.includes("shouldRunPostRunRescanFromOpenAI"), "OpenAI rescan recommendations should detect pending proof before scanning");
assert(app.includes("post-run-scan-requested"), "OpenAI post-run rescan recommendations should record a distinct handoff status");
const openAiHandlerStart = app.indexOf("async function handleOpenAIAgentRecommendation");
const blockedOpenAiRecommendationIndex = app.indexOf("if (brokerRow && !brokerRow.canAct)", openAiHandlerStart);
const openAiRouteArmIndex = app.indexOf("selectScopedExecutorRoute(deterministicRoute)", openAiHandlerStart);
const proofImportPreparationIndex = app.indexOf("prepareSelectedRouteProofImport()", blockedOpenAiRecommendationIndex);
const openAiRescanIndex = app.indexOf('if (actionType === "rescan")', openAiHandlerStart);
const openAiPostRunRescanIndex = app.indexOf("runPostRunReadonlyScan()", openAiRescanIndex);
const openAiRealScanIndex = app.indexOf("runRealReadonlyScan()", openAiRescanIndex);
assert(openAiHandlerStart >= 0, "OpenAI recommendation handler should exist");
assert(blockedOpenAiRecommendationIndex > openAiHandlerStart, "OpenAI handler should check blocked broker rows");
assert(openAiRouteArmIndex > openAiHandlerStart, "OpenAI handler should arm deterministic executor routes");
assert(proofImportPreparationIndex > blockedOpenAiRecommendationIndex, "blocked proof-import recommendations should prepare the validation import");
assert(proofImportPreparationIndex < openAiRouteArmIndex, "proof-import recommendations must prepare evidence before scoped route arming");
assert(openAiRescanIndex > openAiHandlerStart, "OpenAI handler should route rescan recommendations");
assert(openAiPostRunRescanIndex > openAiRescanIndex, "OpenAI rescan recommendations should support post-run rescans");
assert(openAiPostRunRescanIndex < openAiRealScanIndex, "OpenAI rescan recommendations must choose ledger-preserving post-run rescan before normal scans");
assert(
  blockedOpenAiRecommendationIndex < openAiRouteArmIndex,
  "blocked OpenAI recommendations must return before arming a scoped executor route"
);
assert(app.includes("Run npm cleanup"), "OpenAI recommendations should include npm executor action labels");
assert(app.includes("Move Downloads items"), "OpenAI recommendations should include reviewed Downloads executor action labels");
assert(app.includes("onAction={handleOpenAIAgentRecommendation}"), "OpenAI panel should receive the guarded recommendation action handler");
assert(app.includes("OPENAI_AGENT_RUN_HISTORY_STORAGE_KEY"), "OpenAI agent runs should persist as local advisory history");
assert(app.includes("buildOpenAIAgentRunRecord"), "OpenAI advice should create plan-bound run records");
assert(app.includes("appendOpenAIAgentRunRecord"), "OpenAI run history should append through the adapter guard");
assert(openAiAgent.includes("https://api.openai.com/v1/responses"), "OpenAI adapter should use the Responses API endpoint");
assert(openAiAgent.includes("OPENAI_API_KEY"), "OpenAI adapter should read the primary .env API key");
assert(openAiAgent.includes("VITE_OPENAI_API_KEY"), "OpenAI adapter should keep the Vite env API key fallback");
assert(openAiAgent.includes("/api/openai-agent/advice"), "OpenAI adapter should support the local Vite dev proxy endpoint");
assert(openAiAgent.includes("vite-dev-proxy"), "OpenAI adapter should preserve Vite dev proxy provenance");
assert(openAiAgent.includes("gpt-5.2"), "OpenAI adapter should default to the current documented GPT-5.2 model");
assert(openAiAgent.includes("OPENAI_REASONING_EFFORT"), "OpenAI adapter should support configurable reasoning effort");
assert(openAiAgent.includes("body.reasoning"), "OpenAI adapter should send configured reasoning effort");
assert(openAiAgent.includes("openai_agent_advice"), "OpenAI adapter should prefer the native Tauri advisor command");
assert(openAiAgent.includes("getNativeOpenAIAgentCapability"), "OpenAI adapter should expose native advisor capability detection");
assert(rustScanner.includes('"select-action"'), "native OpenAI schema should allow brokered UI selection recommendations");
assert(!viteConfig.includes('envPrefix: ["VITE_", "OPENAI_"]'), "Vite must not expose OPENAI_* secrets to the renderer");
assert(viteConfig.includes("loadEnv(mode, process.cwd(), \"\")"), "Vite should load normal .env keys on the server side");
assert(viteConfig.includes("spaceguardOpenAIAgentProxy"), "Vite should install the local OpenAI agent proxy");
assert(viteConfig.includes("/api/openai-agent/advice"), "Vite proxy should expose the OpenAI advice endpoint");
assert(viteConfig.includes("requestOpenAIAgentAdvice"), "Vite proxy should reuse the guarded OpenAI adapter");
assert(model.includes("spaceguard-selected-route-proof-packet/v1"), "model should expose selected-route proof packets");
assert(model.includes("buildSelectedRouteProofPacketMarkdown"), "model should export selected-route proof packet markdown");
assert(app.includes("buildSelectedRouteProofPacketMarkdown"), "app should wire selected-route proof packet markdown export");
assert(model.includes("buildRealWorkflowProofPacketMarkdown"), "model should export real workflow proof packet markdown");
assert(app.includes("buildRealWorkflowProofPacketMarkdown"), "app should wire real workflow proof markdown export");
assert(app.includes("flow.proofPacket"), "command flow UI should receive the selected-route proof packet");
assert(model.includes("compactNativeVolumeProof"), "selected-route proof packet should compact native volume proof");
assert(model.includes("Volume proof delta"), "selected-route proof markdown should include volume proof deltas");
assert(model.includes("Validation import:"), "selected-route proof markdown should include validation import status");
assert(model.includes("buildSelectedRouteProofValidationImportStatus"), "model should derive selected-route proof validation import status");
assert(app.includes("Export proof packet"), "command flow UI should export the selected-route proof packet");
assert(app.includes("prepareSelectedRouteProofImport"), "command flow should prepare selected-route proof import");
assert(app.includes('proofPacket.status !== "proof-complete"'), "selected-route proof import preparation should require a completed proof packet");
assert(app.includes("Prepare validation import"), "command flow UI should preload proof into validation import");
assert(app.includes("proofPacket?.validationImport"), "command flow UI should display selected-route proof validation import status");
assert(openAiAgent.includes("directDeleteAuthority"), "OpenAI context should deny direct delete authority");
assert(openAiAgent.includes("text: {"), "OpenAI adapter should configure Responses API text output");
assert(openAiAgent.includes("type: \"json_schema\""), "OpenAI adapter should request strict structured output");
assert(openAiAgent.includes("spaceguard_cleanup_agent_advice"), "OpenAI adapter should name the cleanup agent schema");
assert(openAiAgent.includes("reviewedDownloadsTargets"), "OpenAI context should include exact reviewed Downloads targets");
assert(openAiAgent.includes("reviewedProjectTargets"), "OpenAI context should include reviewed project targets");
assert(openAiAgent.includes("projectDependencyReviewTargets"), "OpenAI context should include advisory project dependency review targets");
assert(openAiAgent.includes("gradleCacheTargets"), "OpenAI context should include scanned Gradle cache targets");
assert(openAiAgent.includes("userCacheTargets"), "OpenAI context should include scanned user .cache targets");
assert(openAiAgent.includes("androidCacheTargets"), "OpenAI context should include scanned Android cache targets");
assert(openAiAgent.includes("shaderCacheTargets"), "OpenAI context should include scanned shader cache targets");
assert(openAiAgent.includes("pipCacheTargets"), "OpenAI context should include scanned pip cache targets");
assert(openAiAgent.includes("dockerBuildCacheTargets"), "OpenAI context should include Docker build-cache targets");
assert(openAiAgent.includes("npmCacheTargets"), "OpenAI context should include scanned npm cache targets");
assert(openAiAgent.includes("recycleBinTargets"), "OpenAI context should include scanned Recycle Bin targets");
assert(openAiAgent.includes("browserCacheTargets"), "OpenAI context should include scanned browser cache targets");
assert(openAiAgent.includes("manualReviewTargets"), "OpenAI context should include manual review targets");
assert(openAiAgent.includes("installedAppReview"), "OpenAI context should include installed app review summary");
assert(openAiAgent.includes("automated-uninstall"), "OpenAI installed app context should forbid automated uninstall");
assert(openAiAgent.includes("planSnapshot"), "OpenAI context should include current plan snapshot identity");
assert(openAiAgent.includes("proofAllowsNextExecutor"), "OpenAI context should include post-run proof state");
assert(openAiAgent.includes("consentMatchesPlan"), "OpenAI context should include current consent state");
assert(openAiAgent.includes("enabledScopedExecutorFlags"), "OpenAI context should expose enabled scoped executor flags");
assert(openAiAgent.includes("executorScopeStatus"), "OpenAI context should expose native executor scope status");
assert(openAiAgent.includes("agentTaskQueue"), "OpenAI context should include a deterministic task queue");
assert(openAiAgent.includes("spaceguard-openai-agent-task-queue/v1"), "OpenAI task queue should expose a schema version");
assert(app.includes("Agent task queue"), "OpenAI panel should show the deterministic agent task queue");
assert(app.includes("Usage proof:"), "OpenAI task queue should show installed-app usage-proof evidence");
assert(app.includes("Uninstall entry:"), "OpenAI task queue should show installed-app uninstall-entry evidence");
assert(app.includes("Framework:"), "OpenAI task queue should show project framework evidence");
assert(app.includes("Manual guardrails:"), "OpenAI task queue should show manual-only guardrails");
assert(rustScanner.includes("agentTaskQueue"), "native OpenAI prompt should tell the model to use the deterministic task queue");
assert(openAiAgent.includes("scanFingerprintPresent"), "OpenAI run records should retain only compact scan-fingerprint evidence");
assert(app.includes("Rescan proof"), "OpenAI panel should show post-run proof state");
assert(openAiAgent.includes("spaceguard-openai-agent-run/v1"), "OpenAI adapter should expose local run provenance records");
assert(openAiAgent.includes("spaceguard-openai-recommendation-broker/v1"), "OpenAI adapter should expose recommendation broker records");
assert(openAiAgent.includes("spaceguard-openai-recommendation-broker-summary/v1"), "OpenAI run records should persist compact broker summaries");
assert(openAiAgent.includes("recommendationBroker: compactOpenAIAgentRecommendationBroker"), "OpenAI run records should include broker provenance");
assert(openAiAgent.includes("directToolAccess: false"), "OpenAI recommendation broker should deny direct tool access");
assert(openAiAgent.includes("feature-flag"), "OpenAI recommendation broker should check route feature flags");
assert(openAiAgent.includes("single-scoped-flag"), "OpenAI recommendation broker should block multi-flag executor recommendations");
assert(openAiAgent.includes("route-match"), "OpenAI recommendation broker should check that action type and route agree");
assert(openAiAgent.includes("target-id-match"), "OpenAI recommendation broker should verify model target ids against deterministic targets");
assert(openAiAgent.includes("recommendedRoute"), "OpenAI recommendation broker should retain the model-provided route for audit");
assert(openAiAgent.includes("executorRoute"), "OpenAI recommendation broker should expose the deterministic executor route");
assert(app.includes("brokerRow?.executorRoute"), "OpenAI recommendation clicks should select the broker's deterministic route");
assert(openAiAgent.includes("select-action"), "OpenAI schema should allow brokered UI selection recommendations");
assert(openAiAgent.includes("target-selectable"), "OpenAI select-action broker should prove target selectability");
assert(app.includes("Select action"), "OpenAI select-action recommendations should expose a selection button label");
assert(app.includes("cleanup-actions-panel"), "OpenAI select-action recommendations should focus the cleanup action list");
assert(openAiAgent.includes("storesFullContext: false"), "OpenAI run records should not persist full path-level context");
assert(openAiAgent.includes("storesRawModelText: false"), "OpenAI run records should not persist raw model text");
assert(openAiAgent.includes("driveInventoryRows"), "OpenAI context should include drive inventory rows");
assert(openAiAgent.includes("customRootRows"), "OpenAI context should include custom root triage rows");
assert(openAiAgent.includes("run-gradle-cache-executor"), "OpenAI schema should allow Gradle cache executor recommendations");
assert(openAiAgent.includes("run-user-cache-executor"), "OpenAI schema should allow user .cache executor recommendations");
assert(openAiAgent.includes("run-android-cache-executor"), "OpenAI schema should allow Android cache executor recommendations");
assert(openAiAgent.includes("run-shader-cache-executor"), "OpenAI schema should allow shader cache executor recommendations");
assert(openAiAgent.includes("run-pip-cache-executor"), "OpenAI schema should allow pip cache executor recommendations");
assert(openAiAgent.includes("run-docker-build-cache-executor"), "OpenAI schema should allow Docker build-cache executor recommendations");
assert(openAiAgent.includes("run-downloads-cleanup-executor"), "OpenAI schema should allow reviewed Downloads executor recommendations");
assert(openAiAgent.includes("run-large-file-archive-executor"), "OpenAI schema should allow reviewed large-file archive recommendations");
assert(openAiAgent.includes("run-npm-cache-executor"), "OpenAI schema should allow npm cache executor recommendations");
assert(openAiAgent.includes("run-pnpm-store-executor"), "OpenAI schema should allow pnpm store executor recommendations");
assert(openAiAgent.includes("run-recycle-bin-executor"), "OpenAI schema should allow Recycle Bin executor recommendations");
assert(openAiAgent.includes("run-browser-cache-executor"), "OpenAI schema should allow browser cache executor recommendations");
assert(openAiAgent.includes("manual-only"), "OpenAI schema should allow manual-only recommendations");
assert(openAiSmokeScript.includes("run-openai-advisor-smoke"), "OpenAI fixture smoke script should identify itself");
assert(openAiSmokeScript.includes("No local filesystem scan was performed"), "OpenAI smoke script should be fixture-only");
assert(openAiSmokeScript.includes("OPENAI_API_KEY"), "OpenAI smoke script should read the key from .env or process env");
assert(openAiSmokeScript.includes("requiredSmokeRecommendation"), "OpenAI smoke script should define the required fixture recommendation");
assert(openAiSmokeScript.includes("validateSmokeAdvice"), "OpenAI smoke script should validate brokered advice before passing");
assert(openAiSmokeScript.includes("OpenAI smoke did not return the required broker-ready recommendation"), "OpenAI smoke script should fail on unbrokered fixture advice");
assert(openAiSmokeScript.includes("--fixture-only"), "OpenAI smoke script should support a no-network fixture-only mode");
assert(openAiSmokeScript.includes("--route"), "OpenAI smoke script should support selected route validation");
assert(openAiSmokeScript.includes("bounded-pnpm-store-delete"), "OpenAI smoke script should include pnpm store route fixture coverage");
assert(openAiSmokeScript.includes("buildFixtureOnlyAdviceResult"), "OpenAI smoke script should validate local fixture advice without an API key");
assert(packageJson.includes("\"openai:smoke\""), "package scripts should expose the OpenAI fixture smoke command");
assert(packageJson.includes("\"openai:smoke:fixture\""), "package scripts should expose the no-network OpenAI fixture smoke command");
assert(packageJson.includes("\"setup:doctor\""), "package scripts should expose the setup doctor command");
assert(packageJson.includes("\"setup:route\""), "package scripts should expose the route setup packet command");
assert(packageJson.includes("\"validate:route\""), "package scripts should expose the Windows route validation packet command");
assert(packageJson.includes("\"validate:workflow-proof\""), "package scripts should expose the workflow proof verifier command");
assert(gitignore.includes("evidence/"), ".gitignore should exclude generated Windows proof evidence folders");
assert(gitignore.includes("spaceguard-real-workflow-proof.md"), ".gitignore should exclude exported workflow proof artifacts");
assert(gitignore.includes("spaceguard-selected-route-proof-packet.md"), ".gitignore should exclude selected-route proof packet exports");
assert(gitignore.includes("spaceguard-support-bundle.md"), ".gitignore should exclude exported support bundles by default");
assert(setupDoctorScript.includes("OPENAI_API_KEY"), "setup doctor should check OpenAI key configuration");
assert(setupDoctorScript.includes("openai:smoke:fixture"), "setup doctor should expose the local fixture smoke command");
assert(setupDoctorScript.includes("openai:smoke:fixture -- --route"), "setup doctor should expose route-specific fixture smoke commands");
assert(setupDoctorScript.includes("setup:route"), "setup doctor should expose the route setup packet command");
assert(setupDoctorScript.includes("validate:route"), "setup doctor should expose the route validation packet command");
assert(setupDoctorScript.includes("multi-flag-blocked"), "setup doctor should expose multi-flag blocking status");
assert(setupDoctorScript.includes("safeToLaunchWriteMode"), "setup doctor should expose one-route write launch readiness");
assert(setupDoctorScript.includes("realWorkflow"), "setup doctor should expose a compact real workflow");
assert(setupDoctorScript.includes("post-run-rescan"), "setup doctor workflow should include post-run rescan");
assert(setupDoctorScript.includes("proof-import"), "setup doctor workflow should include selected-route proof import");
assert(setupDoctorScript.includes("selectedRoute"), "setup doctor should expose the selected route for one enabled flag");
assert(setupDoctorScript.includes("routeSpecs"), "setup doctor should use route setup specs for selected route commands");
assert(setupDoctorScript.includes("SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR"), "setup doctor should check scoped executor flags");
assert(setupDoctorScript.includes("spaceguard-setup-doctor/v1"), "setup doctor should emit a stable schema");
assert(setupRouteScript.includes("spaceguard-route-setup-packet/v1"), "route setup script should emit a stable packet schema");
assert(setupRouteScript.includes("SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR"), "route setup script should know the npm cache feature flag");
assert(setupRouteScript.includes("execute-npm-cache"), "route setup script should report native request modes");
assert(setupRouteScript.includes("npm-cache-executor-panel"), "route setup script should report executor panel ids");
assert(setupRouteScript.includes("npm run setup:route -- --route npm-cache"), "route setup script should document route usage");
assert(setupRouteScript.includes("openai:smoke:fixture -- --route"), "route setup script should expose route-specific fixture smoke commands");
assert(validationRouteScript.includes("spaceguard-windows-validation-packet/v1"), "validation packet script should emit a stable schema");
assert(validationRouteScript.includes("post-run-rescan-comparison"), "validation packet should require post-run rescan proof");
assert(validationRouteScript.includes("postRunProofChecklist"), "validation packet should expose a post-run proof checklist");
assert(validationRouteScript.includes("native-write-volume-proof"), "validation packet should require native write volume proof");
assert(validationRouteScript.includes("selected-route-proof-packet"), "validation packet should require selected-route proof packet export");
assert(validationRouteScript.includes("selected-route-proof-import"), "validation packet should require selected-route proof import");
assert(validationRouteScript.includes("enable-second-executor-flag"), "validation packet should forbid multi-route validation");
assert(validationRouteScript.includes("npm run validate:route -- --route npm-cache"), "validation packet script should document route usage");
assert(validationRouteScript.includes("openai:smoke:fixture -- --route"), "validation packet should expose route-specific fixture smoke commands");
assert(workflowProofScript.includes("spaceguard-workflow-proof-check/v1"), "workflow proof verifier should emit a stable schema");
assert(workflowProofScript.includes("spaceguard-real-workflow-proof/v1"), "workflow proof verifier should require real workflow proof packets");
assert(workflowProofScript.includes("readyForNextRoute"), "workflow proof verifier should require next-route clearance");
assert(workflowProofScript.includes("spaceguard-first-route-app-close-contract/v1"), "workflow proof verifier should require the app-close proof contract");
assert(workflowProofScript.includes("--file"), "workflow proof verifier should accept exported proof files");
assert(readme.includes("npm run setup:route -- --route npm-cache"), "README should document route setup packet usage");
assert(readme.includes("npm run validate:route -- --route npm-cache"), "README should document route validation packet usage");
assert(readme.includes("selected-route proof packet export"), "README should document selected-route proof packet validation");
assert(readme.includes("Selected route proof import"), "README should document selected route proof import");
assert(readme.includes("native volume proof expectation"), "README should document native volume proof validation");
assert(readme.includes("multi-flag-blocked"), "README should document multi-flag setup blocking");
assert(readme.includes("realWorkflow"), "README should document setup doctor's compact real workflow");
assert(readme.includes("npm run validate:workflow-proof -- --file"), "README should document workflow proof verifier usage");
assert(readme.includes("app-close proof contract"), "README should document workflow proof app-close contract validation");
assert(readme.includes("--route pnpm-store"), "README should document selected-route setup doctor commands");
assert(realDataGuide.includes("npm run setup:route -- --route npm-cache"), "Windows setup guide should document route setup packet usage");
assert(realDataGuide.includes("npm run validate:route -- --route npm-cache"), "Windows setup guide should document route validation packet usage");
assert(realDataGuide.includes("Windows validation packet post-run proof checklist"), "Windows setup guide should document validation packet post-run proof checklist");
assert(realDataGuide.includes("Selected route proof import"), "Windows setup guide should document selected route proof import");
assert(realDataGuide.includes("multi-flag-blocked"), "Windows setup guide should document multi-flag setup blocking");
assert(realDataGuide.includes("realWorkflow"), "Windows setup guide should document setup doctor's compact real workflow");
assert(realDataGuide.includes("npm run validate:workflow-proof -- --file"), "Windows setup guide should document workflow proof verifier usage");
assert(realDataGuide.includes("app-close proof contract"), "Windows setup guide should document workflow proof app-close contract validation");
assert(realDataGuide.includes("--route pnpm-store"), "Windows setup guide should document selected-route setup doctor commands");
assert(openAiAgent.includes("forbiddenActions"), "OpenAI context should expose forbidden actions");
assert(openAiAgent.includes("task-post-run-rescan"), "OpenAI task queue should expose a deterministic post-run rescan task");
assert(openAiAgent.includes("getOpenAITaskCriticality"), "OpenAI task queue should keep post-run proof work ahead of ordinary review rows");
assert(openAiAgent.includes("execution-proof-handoff-panel"), "OpenAI post-run rescan broker should route to proof handoff");
assert(openAiAgent.includes("selected-route-proof-import"), "OpenAI task queue should expose selected-route proof import tasks");
assert(openAiAgent.includes("validation-evidence-panel"), "OpenAI broker should route proof import recommendations to validation evidence");
assert(app.includes("Open manual review"), "OpenAI manual-only recommendations should expose a review action");
assert(app.includes("validation-evidence-panel"), "app should route proof import recommendations to validation evidence");
assert(model.includes("openai:smoke:fixture -- --route"), "model setup commands should expose route-specific fixture smoke commands");
assert(app.includes("manualReviewTargets"), "OpenAI manual-only recommendations should be visible in the panel");
assert(app.includes("Project targets"), "OpenAI panel should show reviewed project target count");
assert(app.includes("Gradle root"), "OpenAI panel should show Gradle cache target count");
assert(app.includes(".cache root"), "OpenAI panel should show user .cache target count");
assert(app.includes("Android roots"), "OpenAI panel should show Android cache target count");
assert(app.includes("Shader roots"), "OpenAI panel should show shader cache target count");
assert(app.includes("pip root"), "OpenAI panel should show pip cache target count");
assert(app.includes("Docker cache"), "OpenAI panel should show Docker build-cache target count");
assert(app.includes("npm root"), "OpenAI panel should show npm cache target count");
assert(app.includes("pnpm root"), "OpenAI panel should show pnpm store target count");
assert(openAiAgent.includes("pnpmStoreTargets"), "OpenAI context should include scanned pnpm store targets");
assert(app.includes("Recycle"), "OpenAI panel should show Recycle Bin target count");
assert(app.includes("Cache roots"), "OpenAI panel should show browser cache target count");
assert(app.includes("Reviewed Downloads cleanup"), "App should expose reviewed Downloads executor panel");
assert(app.includes("downloads-cleanup-executor-panel"), "Reviewed Downloads executor panel should be focusable");
assert(app.includes("Reviewed large-file archive"), "App should expose reviewed large-file archive panel");
assert(app.includes("large-file-archive-executor-panel"), "Reviewed large-file archive panel should be focusable");
assert(app.includes("strict JSON"), "OpenAI panel should show structured output boundary");
assert(app.includes("Reasoning:"), "OpenAI panel should show configured reasoning effort");
assert(app.includes("Transport:"), "OpenAI panel should show native/browser transport");
assert(app.includes("AI runs"), "OpenAI panel should show advisory run history count");
assert(app.includes("Last advice:"), "OpenAI panel should show last recorded advice");
assert(app.includes("Current plan:"), "OpenAI panel should show the plan sent to OpenAI");
assert(app.includes("OPENAI_MODEL"), "OpenAI panel should mention the primary model env setting");
assert(app.includes("agent-question-panel"), "OpenAI ask-user recommendations should be able to focus the question panel");
assert(app.includes("item-review-panel"), "OpenAI review-target recommendations should be able to focus item review");
assert(app.includes("custom-root-triage-panel"), "OpenAI manual-only recommendations should be able to focus custom root triage");
assert(app.includes("drive-inventory-panel"), "OpenAI manual-only recommendations should be able to focus drive inventory");
assert(model.includes("spaceguard-ai-agent-integration/v1"), "model should expose AI integration status");
assert(app.includes("buildStorageStrategyPlan"), "storage strategy workflow should be wired");
assert(app.includes("buildManualStrategyChecklist"), "manual strategy checklist should be wired");
assert(app.includes("buildReviewWorkbench"), "review workbench should be wired");
assert(app.includes("buildDecisionLog"), "decision log should be wired");
assert(app.includes("buildUserDecisionReceipt"), "user decision receipt should be wired");
assert(app.includes("UserDecisionReceiptPanel"), "user decision receipt panel should be rendered");
assert(app.includes("user-decision-receipt-panel"), "user decision receipt should be focusable");
assert(app.includes("Decision boundary"), "user decision receipt should expose the decision boundary");
assert(app.includes("buildRiskBudget"), "risk budget should be wired");
assert(app.includes("RiskBudgetPanel"), "risk budget panel should be rendered");
assert(app.includes("risk-budget-panel"), "risk budget should be focusable");
assert(app.includes("Mode ceiling"), "risk budget should expose the mode ceiling");
assert(app.includes("buildPlanLock"), "plan lock should be wired");
assert(app.includes("PlanLockPanel"), "plan lock panel should be rendered");
assert(app.includes("plan-lock-panel"), "plan lock should be focusable");
assert(app.includes("planLockId"), "dry-run consent should bind the plan lock id");
assert(app.includes("buildItemReview"), "item review should be wired");
assert(app.includes("buildExecutorPlan"), "executor plan should be wired");
assert(app.includes("buildExecutorManifest"), "executor manifest should be wired");
assert(app.includes("buildExecutorSmokeRunPacket"), "executor smoke-run packet should be wired");
assert(app.includes("buildExecutorSmokeRunPacketMarkdown"), "executor smoke-run packet export should be wired");
assert(app.includes("preferredRoute: selectedScopedExecutorRoute"), "executor smoke-run packet should receive the user-selected scoped route");
assert(app.includes("buildScopedExecutorCommandFlow"), "scoped executor command flow should be wired");
assert(model.includes("spaceguard-scoped-executor-run-gate/v1"), "model should expose the active route run gate");
assert(model.includes("inactive-route"), "scoped executor run gate should block queued inactive routes");
assert(app.includes("buildScopedExecutorRunGate"), "app should wire the scoped executor run gate");
assert(app.includes("blockExecutorForInactiveRoute"), "native executor handlers should block inactive scoped routes");
assert(app.includes("activeRouteOverride: selectedScopedExecutorRouteRef.current"), "inactive route gate should read the synchronously selected route override");
assert(app.includes("ScopedExecutorCommandFlowPanel"), "scoped executor command flow panel should be rendered");
assert(app.includes("scoped-executor-command-flow-panel"), "scoped executor command flow should be focusable");
assert(app.includes("getScopedExecutorRouteForAction(action)"), "selecting an agent action should resolve its scoped executor route");
assert(app.includes("selectScopedExecutorRoute(scopedRoute)"), "selecting an agent action should activate the matching scoped executor route");
const toggleActionStart = app.indexOf("function toggleAction(action)");
const toggleActionEnd = app.indexOf("function selectActionById", toggleActionStart);
const toggleActionBlock = app.slice(toggleActionStart, toggleActionEnd);
assert(toggleActionBlock.includes("getScopedExecutorRouteForAction(action)"), "manual action selection should resolve its scoped executor route");
assert(app.includes("handleScopedExecutorCommand"), "scoped executor command flow should dispatch primary workflow actions");
assert(app.includes("executeScopedExecutorRoute"), "scoped executor command flow should call existing executor handlers");
assert(app.includes("selectedScopedExecutorRoute"), "scoped executor command flow should keep user-selected route state");
assert(app.includes("Choose scoped route"), "scoped executor command flow should expose route selection");
assert(app.includes("one route at a time"), "scoped executor command flow should explain one-route execution");
assert(app.includes("Route setup"), "scoped executor command flow should expose selected-route setup commands");
assert(app.includes("flow.setupCommands"), "scoped executor command flow should render setup command data");
assert(app.includes("OpenAI fixture"), "scoped executor command flow should render route-specific fixture OpenAI smoke commands");
assert(app.includes("OpenAI live"), "scoped executor command flow should render route-specific live OpenAI smoke commands");
assert(app.includes("buildScopedExecutorAgentPrompt"), "scoped executor command flow should build a selected-route OpenAI prompt");
assert(app.includes("onAskAgent(agentPrompt)"), "scoped executor command flow should ask OpenAI with the selected-route prompt");
assert(app.includes("Selected route launch packet"), "scoped executor command flow should render a selected-route launch packet");
assert(app.includes("flow.launchPacket"), "scoped executor command flow should render launch packet data");
assert(app.includes("buildSelectedRouteLaunchPacketMarkdown"), "selected route launch packet export should be wired");
assert(app.includes("Export launch packet"), "scoped executor command flow should expose launch packet export");
assert(model.includes("buildScopedExecutorSetupCommands"), "model should build route setup commands for the command flow");
assert(model.includes("buildScopedExecutorAgentPrompt"), "model should expose a selected-route OpenAI prompt builder");
assert(model.includes("spaceguard-selected-route-launch-packet/v1"), "model should expose selected-route launch packet schema");
assert(model.includes("buildSelectedRouteLaunchPacketMarkdown"), "model should export selected-route launch packet markdown");
assert(model.includes("npm run validate:route -- --route"), "model should expose validation packet commands in the command flow");
assert(model.includes("$env:${envVar}"), "model should expose PowerShell flag commands in the command flow");
assert(app.includes("onSelectRoute"), "scoped executor command flow should accept route selection actions");
assert(app.includes("ExecutorSmokeRunPacketPanel"), "executor smoke-run packet panel should be rendered");
assert(app.includes("executor-smoke-run-packet-panel"), "executor smoke-run packet should be focusable");
assert(app.includes("Export smoke packet"), "executor smoke-run packet should be exportable");
assert(app.includes("buildToolCommandInventory"), "tool command inventory should be wired");
assert(app.includes("buildPrivilegeBoundary"), "privilege boundary should be wired");
assert(app.includes("buildPrivacyBoundary"), "privacy boundary should be wired");
assert(app.includes("buildPublicBetaReadiness"), "public beta readiness should be wired");
assert(app.includes("buildReleaseGate"), "release gate should be wired");
assert(app.includes("executorFlags"), "release gate should consume per-executor runtime feature flags");
assert(app.includes("Executor scope:"), "release gate should show native executor scope status");
assert(app.includes("Scoped flags:"), "release gate should show native scoped executor flag count");
assert(app.includes("Enabled flags:"), "release gate should show native scoped executor flag names when present");
assert(app.includes("buildReleaseReviewPacket"), "release review packet should be wired");
assert(app.includes("buildReleaseReviewPacketMarkdown"), "release review packet export should be wired");
assert(app.includes("buildWriteReadiness"), "write readiness should be wired");
assert(app.includes("buildRealExecutorCapsule"), "real executor capsule should be wired");
assert(app.includes("buildFirstSafeExecutorContract"), "first-safe executor contract should be wired");
assert(app.includes("buildFirstSafeValidationGate"), "first-safe validation gate should be wired");
assert(app.includes("FirstSafeValidationGatePanel"), "first-safe validation gate panel should be rendered");
assert(app.includes("first-safe-validation-gate-panel"), "first-safe validation gate should be focusable");
assert(app.includes("buildFirstSafeImplementationWorkOrder"), "first-safe implementation work order should be wired");
assert(app.includes("FirstSafeImplementationWorkOrderPanel"), "first-safe work order panel should be rendered");
assert(app.includes("first-safe-work-order-panel"), "first-safe work order should be focusable");
assert(app.includes("buildTempExecutorActivationGate"), "temp executor activation gate should be wired");
assert(app.includes("TempExecutorActivationGatePanel"), "temp executor activation gate panel should be rendered");
assert(app.includes("temp-executor-activation-gate-panel"), "temp executor activation gate should be focusable");
assert(app.includes("buildTempExecutorActivationRehearsal"), "temp activation rehearsal should be wired");
assert(app.includes("TempExecutorActivationRehearsalPanel"), "temp activation rehearsal panel should be rendered");
assert(app.includes("temp-activation-rehearsal-panel"), "temp activation rehearsal should be focusable");
assert(app.includes("Open temp activation"), "question queue actions should focus temp activation");
assert(app.includes("FirstSafeTempExecutorPanel"), "first-safe temp executor panel should be rendered");
assert(app.includes("first-safe-temp-executor-panel"), "first-safe temp executor panel should be focusable");
assert(app.includes("runNativeTempCleanupExecutor"), "real temp executor should be wired through the native adapter");
assert(nativeAdapter.includes("requestMode: \"execute-first-safe\""), "native adapter should send the execute-first-safe request mode");
assert(rustScanner.includes("execute_first_safe_temp_cleanup"), "Rust native shell should implement the first-safe temp executor branch");
assert(rustScanner.includes("SPACEGUARD_ENABLE_TEMP_EXECUTOR"), "Rust native shell should require the temp executor feature flag");
assert(rustScanner.includes("runtime_feature_flag_enabled"), "Rust native shell should read scoped executor flags through the shared .env resolver");
assert(rustScanner.includes("fn scoped_executor_enabled_on_windows"), "Rust native shell should centralize Windows-only scoped executor enablement");
assert(rustScanner.includes("scoped_executor_enabled_on_windows(temp_executor_enabled())"), "temp executor responses should not echo real-run capability on non-Windows");
assert(rustScanner.includes("scoped_executor_enabled_on_windows(npm_cache_executor_enabled())"), "npm executor responses should not echo real-run capability on non-Windows");
assert(rustScanner.includes("runtime_env_value"), "Rust native shell should read local .env values for runtime configuration");
assert(rustScanner.includes("fs::remove_file"), "Rust temp executor should perform file deletion only");
assert(!rustScanner.includes("remove_dir_all"), "Rust executors must not use broad recursive directory removal");
const tempExecutionRejections = rustFunctionBlock("temp_execution_rejections");
assert(!tempExecutionRejections.includes("permanent-confirmation-required"), "Temp cleanup should not require permanent-removal confirmation");
assert(app.includes("ProjectDependencyExecutorPanel"), "project dependency executor panel should be rendered");
assert(app.includes("project-dependency-executor-panel"), "project dependency executor panel should be focusable");
assert(app.includes("runNativeProjectDependencyExecutor"), "project dependency executor should be wired through the native adapter");
assert(rustScanner.includes('"Projects"'), "project dependency scanner should search common Projects roots");
assert(rustScanner.includes('"repos"'), "project dependency scanner should search common repos roots");
assert(rustScanner.includes('"workspace"'), "project dependency scanner should search common workspace roots");
assert(nativeAdapter.includes("requestMode: \"execute-project-deps\""), "native adapter should send the execute-project-deps request mode");
assert(nativeAdapter.includes("projectDependencyExecutor"), "native adapter should normalize project dependency executor flag");
assert(rustScanner.includes("execute_project_dependency_cleanup"), "Rust native shell should implement reviewed project dependency cleanup");
assert(rustScanner.includes("SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR"), "Rust native shell should require the project dependency executor feature flag");
assert(rustScanner.includes("project_dependency_scan_item"), "Rust scanner should enrich node_modules review items with project metadata");
assert(rustScanner.includes("Expo project dependency folder"), "Rust scanner should surface Expo project hints");
assert(rustScanner.includes("React Native project dependency folder"), "Rust scanner should surface React Native project hints");
assert(app.includes("DownloadsCleanupExecutorPanel"), "reviewed Downloads executor panel should be rendered");
assert(app.includes("runNativeDownloadsCleanupExecutor"), "reviewed Downloads executor should be wired through the native adapter");
assert(nativeAdapter.includes("requestMode: \"execute-downloads-recycle-bin\""), "native adapter should send the reviewed Downloads request mode");
assert(nativeAdapter.includes("downloadsCleanupExecutor"), "native adapter should normalize reviewed Downloads executor flag");
assert(rustScanner.includes("execute_downloads_review_cleanup"), "Rust native shell should implement reviewed Downloads cleanup");
assert(rustScanner.includes("SPACEGUARD_ENABLE_DOWNLOADS_EXECUTOR"), "Rust native shell should require the reviewed Downloads executor feature flag");
assert(rustScanner.includes("downloads_cleanup_target_reject_code"), "Rust native shell should validate reviewed Downloads targets");
assert(rustScanner.includes("SHFileOperationW"), "Rust reviewed Downloads executor should use Windows Shell file operation");
assert(rustScanner.includes("FOF_ALLOWUNDO"), "Rust reviewed Downloads executor should use Recycle Bin semantics");
assert(app.includes("LargeFileArchiveExecutorPanel"), "reviewed large-file archive panel should be rendered");
assert(app.includes("runNativeLargeFileArchiveExecutor"), "reviewed large-file archive should be wired through the native adapter");
assert(nativeAdapter.includes("requestMode: \"execute-large-file-archive\""), "native adapter should send the large-file archive request mode");
assert(nativeAdapter.includes("spaceguard-large-file-archive-request/v1"), "native adapter should send the large-file archive request schema");
assert(nativeAdapter.includes("largeFileArchiveExecutor"), "native adapter should normalize reviewed large-file archive executor flag");
assert(rustScanner.includes("execute_large_file_archive_cleanup"), "Rust native shell should implement reviewed large-file archive");
assert(rustScanner.includes("SPACEGUARD_ENABLE_LARGE_FILE_ARCHIVE_EXECUTOR"), "Rust native shell should require the large-file archive feature flag");
assert(rustScanner.includes("large_file_archive_target_reject_code"), "Rust native shell should validate large-file archive targets");
assert(rustScanner.includes("archive_destination_reject_code"), "Rust native shell should validate archive destinations");
assert(rustScanner.includes("archive_large_file_to_destination"), "Rust native shell should copy verified archive files before removing sources");
assert(app.includes("GradleCacheExecutorPanel"), "Gradle cache executor panel should be rendered");
assert(app.includes("gradle-cache-executor-panel"), "Gradle cache executor panel should be focusable");
assert(app.includes("Run Gradle cache cleanup"), "Gradle cache executor should expose a user-triggered cleanup button");
assert(app.includes("Gradle executor boundary"), "Gradle cache executor should show the route boundary");
assert(app.includes("runNativeGradleCacheExecutor"), "Gradle cache executor should be wired through the native adapter");
assert(nativeAdapter.includes("requestMode: \"execute-gradle-cache\""), "native adapter should send the execute-gradle-cache request mode");
assert(nativeAdapter.includes("spaceguard-gradle-cache-request/v1"), "native adapter should send the Gradle cache request schema");
assert(nativeAdapter.includes("gradleCacheExecutor"), "native adapter should normalize Gradle cache executor flag");
assert(rustScanner.includes("execute_gradle_cache_cleanup"), "Rust native shell should implement Gradle cache cleanup");
assert(rustScanner.includes("SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR"), "Rust native shell should require the Gradle cache executor feature flag");
assert(rustScanner.includes("gradle_cache_target_reject_code"), "Rust native shell should validate Gradle cache targets");
assert(rustScanner.includes("target-not-gradle-cache"), "Rust native shell should reject non-Gradle cache targets");
assert(rustScanner.includes("file_old_enough_for_gradle_cache_delete"), "Rust Gradle cache cleanup should enforce the age threshold");
assert(app.includes("UserCacheExecutorPanel"), "user .cache executor panel should be rendered");
assert(app.includes("user-cache-executor-panel"), "user .cache executor panel should be focusable");
assert(app.includes("Run user .cache cleanup"), "user .cache executor should expose a user-triggered cleanup button");
assert(app.includes("User .cache executor boundary"), "user .cache executor should show the route boundary");
assert(app.includes("runNativeUserCacheExecutor"), "user .cache executor should be wired through the native adapter");
assert(nativeAdapter.includes("requestMode: \"execute-user-cache\""), "native adapter should send the execute-user-cache request mode");
assert(nativeAdapter.includes("spaceguard-user-cache-request/v1"), "native adapter should send the user .cache request schema");
assert(nativeAdapter.includes("userCacheExecutor"), "native adapter should normalize user .cache executor flag");
assert(rustScanner.includes("execute_user_cache_cleanup"), "Rust native shell should implement user .cache cleanup");
assert(rustScanner.includes("SPACEGUARD_ENABLE_USER_CACHE_EXECUTOR"), "Rust native shell should require the user .cache executor feature flag");
assert(rustScanner.includes("user_cache_target_reject_code"), "Rust native shell should validate user .cache targets");
assert(rustScanner.includes("target-not-user-cache"), "Rust native shell should reject non-user .cache targets");
assert(rustScanner.includes("file_old_enough_for_user_cache_delete"), "Rust user .cache cleanup should enforce the age threshold");
assert(rustScanner.includes("user_cache_file_forbidden"), "Rust user .cache cleanup should skip config and identity-like files");
assert(app.includes("AndroidCacheExecutorPanel"), "Android cache executor panel should be rendered");
assert(app.includes("android-cache-executor-panel"), "Android cache executor panel should be focusable");
assert(app.includes("Run Android cache cleanup"), "Android cache executor should expose a user-triggered cleanup button");
assert(app.includes("Android executor boundary"), "Android cache executor should show the route boundary");
assert(app.includes("runNativeAndroidCacheExecutor"), "Android cache executor should be wired through the native adapter");
assert(nativeAdapter.includes("requestMode: \"execute-android-cache\""), "native adapter should send the execute-android-cache request mode");
assert(nativeAdapter.includes("spaceguard-android-cache-request/v1"), "native adapter should send the Android cache request schema");
assert(nativeAdapter.includes("androidCacheExecutor"), "native adapter should normalize Android cache executor flag");
assert(rustScanner.includes("execute_android_cache_cleanup"), "Rust native shell should implement Android cache cleanup");
assert(rustScanner.includes("SPACEGUARD_ENABLE_ANDROID_CACHE_EXECUTOR"), "Rust native shell should require the Android cache executor feature flag");
assert(rustScanner.includes("android_cache_target_reject_code"), "Rust native shell should validate Android cache targets");
assert(rustScanner.includes("target-not-android-cache"), "Rust native shell should reject non-Android cache targets");
assert(rustScanner.includes("file_old_enough_for_android_cache_delete"), "Rust Android cache cleanup should enforce the age threshold");
assert(rustScanner.includes("android_cache_file_forbidden"), "Rust Android cache cleanup should skip config and identity-like files");
assert(app.includes("ShaderCacheExecutorPanel"), "shader cache executor panel should be rendered");
assert(app.includes("shader-cache-executor-panel"), "shader cache executor panel should be focusable");
assert(app.includes("Run shader cache cleanup"), "shader cache executor should expose a user-triggered cleanup button");
assert(app.includes("Shader executor boundary"), "shader cache executor should show the route boundary");
assert(app.includes("runNativeShaderCacheExecutor"), "shader cache executor should be wired through the native adapter");
assert(nativeAdapter.includes("requestMode: \"execute-shader-cache\""), "native adapter should send the execute-shader-cache request mode");
assert(nativeAdapter.includes("spaceguard-shader-cache-request/v1"), "native adapter should send the shader cache request schema");
assert(nativeAdapter.includes("shaderCacheExecutor"), "native adapter should normalize shader cache executor flag");
assert(rustScanner.includes("execute_shader_cache_cleanup"), "Rust native shell should implement shader cache cleanup");
assert(rustScanner.includes("SPACEGUARD_ENABLE_SHADER_CACHE_EXECUTOR"), "Rust native shell should require the shader cache executor feature flag");
assert(rustScanner.includes("measure_shader_cache_roots"), "Rust native scanner should measure shader cache roots");
assert(rustScanner.includes("shader_cache_target_reject_code"), "Rust native shell should validate shader cache targets");
assert(rustScanner.includes("target-not-shader-cache"), "Rust native shell should reject non-shader cache targets");
assert(rustScanner.includes("file_old_enough_for_shader_cache_delete"), "Rust shader cache cleanup should enforce the age threshold");
assert(rustScanner.includes("shader_cache_file_forbidden"), "Rust shader cache cleanup should skip config and identity-like files");
assert(app.includes("PipCacheExecutorPanel"), "pip cache executor panel should be rendered");
assert(app.includes("pip-cache-executor-panel"), "pip cache executor panel should be focusable");
assert(app.includes("Run pip cache cleanup"), "pip cache executor should expose a user-triggered cleanup button");
assert(app.includes("pip executor boundary"), "pip cache executor should show the route boundary");
assert(app.includes("runNativePipCacheExecutor"), "pip cache executor should be wired through the native adapter");
assert(nativeAdapter.includes("requestMode: \"execute-pip-cache\""), "native adapter should send the execute-pip-cache request mode");
assert(nativeAdapter.includes("spaceguard-pip-cache-request/v1"), "native adapter should send the pip cache request schema");
assert(nativeAdapter.includes("pipCacheExecutor"), "native adapter should normalize pip cache executor flag");
assert(rustScanner.includes("execute_pip_cache_cleanup"), "Rust native shell should implement pip cache cleanup");
assert(rustScanner.includes("SPACEGUARD_ENABLE_PIP_CACHE_EXECUTOR"), "Rust native shell should require the pip cache executor feature flag");
assert(rustScanner.includes("measure_pip_cache_roots"), "Rust native scanner should measure pip cache roots");
assert(rustScanner.includes("pip_cache_target_reject_code"), "Rust native shell should validate pip cache targets");
assert(rustScanner.includes("target-not-pip-cache"), "Rust native shell should reject non-pip cache targets");
assert(rustScanner.includes("file_old_enough_for_pip_cache_delete"), "Rust pip cache cleanup should enforce the age threshold");
assert(rustScanner.includes("pip_cache_file_forbidden"), "Rust pip cache cleanup should skip config and identity-like files");
assert(app.includes("DockerBuildCacheExecutorPanel"), "Docker build-cache executor panel should be rendered");
assert(app.includes("docker-build-cache-executor-panel"), "Docker build-cache executor panel should be focusable");
assert(app.includes("Run Docker prune"), "Docker build-cache executor should expose a user-triggered cleanup button");
assert(app.includes('case "run-docker-build-cache-executor":\n      return "Run Docker prune";'), "OpenAI recommendation cards should label Docker build-cache executor actions");
assert(app.includes("Docker build-cache executor boundary"), "Docker build-cache executor should show the command boundary");
assert(app.includes("runNativeDockerBuildCacheExecutor"), "Docker build-cache executor should be wired through the native adapter");
assert(nativeAdapter.includes("requestMode: \"execute-docker-build-cache\""), "native adapter should send the execute-docker-build-cache request mode");
assert(nativeAdapter.includes("spaceguard-docker-build-cache-request/v1"), "native adapter should send the Docker build-cache request schema");
assert(nativeAdapter.includes("toolNativePruneExecutors"), "native adapter should normalize tool-native executor flag");
assert(rustScanner.includes("execute_docker_build_cache_cleanup"), "Rust native shell should implement Docker build-cache cleanup");
assert(rustScanner.includes("measure_docker_build_cache"), "Rust native scanner should inventory Docker build cache");
assert(rustScanner.includes("SPACEGUARD_ENABLE_TOOL_NATIVE_PRUNE_EXECUTORS"), "Rust native shell should require the tool-native prune feature flag");
assert(rustScanner.includes("Command::new(\"docker\")"), "Rust Docker executor should invoke only the Docker binary directly");
assert(rustScanner.includes("docker_build_cache_prune_result"), "Rust Docker executor should parse Docker build-cache prune output");
assert(!rustScanner.includes("remove_dir_all"), "Rust executors must not use broad recursive directory removal");
assert(!rustScanner.includes("docker system prune --volumes"), "Rust Docker executor must not expose broad volume prune");
assert(app.includes("NpmCacheExecutorPanel"), "npm cache executor panel should be rendered");
assert(app.includes("npm-cache-executor-panel"), "npm cache executor panel should be focusable");
assert(app.includes("Run npm cache cleanup"), "npm cache executor should expose a user-triggered cleanup button");
assert(app.includes("npm executor boundary"), "npm cache executor should show the route boundary");
assert(app.includes("runNativeNpmCacheExecutor"), "npm cache executor should be wired through the native adapter");
assert(nativeAdapter.includes("requestMode: \"execute-npm-cache\""), "native adapter should send the execute-npm-cache request mode");
assert(nativeAdapter.includes("spaceguard-npm-cache-request/v1"), "native adapter should send the npm cache request schema");
assert(nativeAdapter.includes("npmCacheExecutor"), "native adapter should normalize npm cache executor flag");
assert(rustScanner.includes("execute_npm_cache_cleanup"), "Rust native shell should implement npm cache cleanup");
assert(rustScanner.includes("SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR"), "Rust native shell should require the npm cache executor feature flag");
assert(rustScanner.includes("npm_cache_target_reject_code"), "Rust native shell should validate npm cache targets");
assert(rustScanner.includes("target-not-npm-cache"), "Rust native shell should reject non-npm cache targets");
assert(rustScanner.includes("file_old_enough_for_npm_cache_delete"), "Rust npm cache cleanup should enforce the age threshold");
assert(rustScanner.includes("delete_npm_cache_target_at(root, SystemTime::now())"), "Rust npm cache cleanup should keep production deletion on the real clock");
assert(rustScanner.includes("delete_single_npm_cache_file_at"), "Rust npm cache cleanup should expose clock-injected file deletion for proof tests");
assert(rustScanner.includes("npm_cache_deleter_removes_only_old_content_and_tmp_files"), "Rust npm cache cleanup should prove old content and tmp deletion while preserving metadata");
assert(app.includes("PnpmStoreExecutorPanel"), "pnpm store executor panel should be rendered");
assert(app.includes("pnpm-store-executor-panel"), "pnpm store executor panel should be focusable");
assert(app.includes("Run pnpm store cleanup"), "pnpm store executor should expose a user-triggered cleanup button");
assert(app.includes("pnpm executor boundary"), "pnpm store executor should show the route boundary");
assert(app.includes("runNativePnpmStoreExecutor"), "pnpm store executor should be wired through the native adapter");
assert(nativeAdapter.includes("requestMode: \"execute-pnpm-store\""), "native adapter should send the execute-pnpm-store request mode");
assert(nativeAdapter.includes("spaceguard-pnpm-store-request/v1"), "native adapter should send the pnpm store request schema");
assert(nativeAdapter.includes("pnpmStoreExecutor"), "native adapter should normalize pnpm store executor flag");
assert(rustScanner.includes("execute_pnpm_store_cleanup"), "Rust native shell should implement pnpm store cleanup");
assert(rustScanner.includes("SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR"), "Rust native shell should require the pnpm store executor feature flag");
assert(rustScanner.includes("pnpm_store_target_reject_code"), "Rust native shell should validate pnpm store targets");
assert(rustScanner.includes("target-not-pnpm-store"), "Rust native shell should reject non-pnpm store targets");
assert(rustScanner.includes("file_old_enough_for_pnpm_store_delete"), "Rust pnpm store cleanup should enforce the age threshold");
assert(rustScanner.includes("versioned_content"), "Rust pnpm store cleanup should support versioned store file roots");
assert(app.includes("RecycleBinExecutorPanel"), "Recycle Bin executor panel should be rendered");
assert(app.includes("recycle-bin-executor-panel"), "Recycle Bin executor panel should be focusable");
assert(app.includes("Empty Recycle Bin"), "Recycle Bin executor should expose a user-triggered cleanup button");
assert(app.includes("permanentRemovalConfirmed: approvals.permanentConfirm"), "Recycle Bin executor should pass the user's permanent-removal confirmation explicitly");
assert(app.includes("runNativeRecycleBinExecutor"), "Recycle Bin executor should be wired through the native adapter");
assert(nativeAdapter.includes("permanentRemovalConfirmed: Boolean(boundary.permanentRemovalConfirmed)"), "native Recycle Bin adapter must not mint permanent-removal confirmation");
assert(nativeAdapter.includes("requestMode: \"execute-recycle-bin\""), "native adapter should send the execute-recycle-bin request mode");
assert(nativeAdapter.includes("spaceguard-recycle-bin-request/v1"), "native adapter should send the Recycle Bin request schema");
assert(rustScanner.includes("execute_recycle_bin_cleanup"), "Rust native shell should implement Recycle Bin cleanup");
assert(rustScanner.includes("SPACEGUARD_ENABLE_RECYCLE_BIN_EXECUTOR"), "Rust native shell should require the Recycle Bin executor feature flag");
assert(rustScanner.includes("SHEmptyRecycleBinW"), "Rust native shell should use the Windows Shell Recycle Bin API");
const recycleBinExecutionRejections = rustFunctionBlock("recycle_bin_execution_rejections");
assert(recycleBinExecutionRejections.includes("permanent_removal_confirmed"), "Recycle Bin cleanup should enforce native permanent-removal confirmation");
assert(recycleBinExecutionRejections.includes("permanent-confirmation-required"), "Recycle Bin cleanup should reject without permanent-removal confirmation");
assert(app.includes("BrowserCacheExecutorPanel"), "browser cache executor panel should be rendered");
assert(app.includes("browser-cache-executor-panel"), "browser cache executor panel should be focusable");
assert(app.includes("Run browser cache cleanup"), "browser cache executor should expose a user-triggered cleanup button");
assert(app.includes("Browser cache executor boundary"), "browser cache executor should show the route boundary");
assert(app.includes("runNativeBrowserCacheExecutor"), "browser cache executor should be wired through the native adapter");
assert(nativeAdapter.includes("requestMode: \"execute-browser-cache\""), "native adapter should send the execute-browser-cache request mode");
assert(nativeAdapter.includes("spaceguard-browser-cache-request/v1"), "native adapter should send the browser cache request schema");
assert(nativeAdapter.includes("browserCacheExecutor"), "native adapter should normalize browser cache executor flag");
assert(rustScanner.includes("execute_browser_cache_cleanup"), "Rust native shell should implement browser cache cleanup");
assert(rustScanner.includes("SPACEGUARD_ENABLE_BROWSER_CACHE_EXECUTOR"), "Rust native shell should require the browser cache executor feature flag");
assert(rustScanner.includes("browser_cache_target_reject_code"), "Rust native shell should validate browser cache targets");
assert(rustScanner.includes("target-not-browser-cache"), "Rust native shell should reject non-cache browser targets");
assert(rustScanner.includes("file_old_enough_for_browser_cache_delete"), "Rust browser cache cleanup should skip active recent files");
assert(!rustScanner.includes("powershell"), "Rust cleanup executors must not shell through PowerShell");
assert(model.includes("installed-app-footprints"), "model should include installed app footprint review");
assert(model.includes("manual-app-uninstall"), "installed app footprints should stay manual uninstall guidance");
assert(model.includes("spaceguard-installed-app-review/v1"), "model should expose installed app review dossier schema");
assert(model.includes("buildInstalledAppReviewDossier"), "model should build installed app review dossier");
assert(model.includes("spaceguard-app-uninstall-work-order/v1"), "model should expose app uninstall work-order schema");
assert(model.includes("buildInstalledAppUninstallWorkOrder"), "model should build app uninstall work orders");
assert(model.includes("buildInstalledAppUninstallWorkOrderMarkdown"), "model should export app uninstall work orders");
assert(model.includes("No uninstall-string execution."), "app uninstall work order should forbid uninstall-string execution");
assert(model.includes("spaceguard-wsl-compaction-work-order/v1"), "model should expose WSL compaction work-order schema");
assert(model.includes("buildWslCompactionWorkOrder"), "model should build WSL compaction work orders");
assert(model.includes("buildWslCompactionWorkOrderMarkdown"), "model should export WSL compaction work orders");
assert(model.includes("No Optimize-VHD execution."), "WSL compaction work order should forbid native compaction execution");
assert(model.includes("Modification age is not usage proof"), "installed app policy should not overclaim usage detection");
assert(model.includes("unusedReviewScore"), "installed app dossier should expose conservative unused-review scoring");
assert(app.includes("Unused review score"), "installed app review UI should show unused-review scoring");
assert(app.includes("Mark uninstall"), "item review should label app footprint decisions as manual uninstall follow-up");
assert(app.includes("App uninstall review"), "App should expose installed app review dossier panel");
assert(app.includes("installed-app-review-dossier"), "installed app review dossier should be focusable");
assert(app.includes("InstalledAppUninstallWorkOrderPanel"), "App should render app uninstall work-order panel");
assert(app.includes("app-uninstall-work-order-panel"), "app uninstall work order should be focusable");
assert(app.includes("Export work order"), "app uninstall work order should export manual follow-up evidence");
assert(app.includes("spaceguard-app-uninstall-work-order.md"), "app uninstall work order export should use a stable file name");
assert(app.includes("WslCompactionWorkOrderPanel"), "App should render WSL compaction work-order panel");
assert(app.includes("wsl-compaction-work-order-panel"), "WSL compaction work order should be focusable");
assert(app.includes("spaceguard-wsl-compaction-work-order.md"), "WSL compaction work order export should use a stable file name");
assert(app.includes("no Optimize-VHD"), "WSL compaction UI should expose no native compaction boundary");
assert(app.includes("SpaceGuard will not delete Program Files folders"), "item review should preserve the Program Files deletion boundary");
assert(app.includes("ReviewSignalBadges"), "item review should render structured review signal badges");
assert(openAiAgent.includes("spaceguard-app-uninstall-work-order-context/v1"), "OpenAI context should include app uninstall work-order state");
assert(openAiAgent.includes("app-uninstall-work-order-panel"), "OpenAI broker should route manual app recommendations to the work-order panel");
assert(openAiAgent.includes("run-uninstall-string"), "OpenAI app context should forbid uninstall-string execution");
assert(openAiAgent.includes("spaceguard-wsl-compaction-work-order-context/v1"), "OpenAI context should include WSL compaction work-order state");
assert(openAiAgent.includes("wsl-compaction-work-order-panel"), "OpenAI broker should route WSL recommendations to the WSL work-order panel");
assert(openAiAgent.includes("run-optimize-vhd"), "OpenAI WSL context should forbid Optimize-VHD execution");
assert(rustScanner.includes("measure_installed_app_footprints"), "Rust scanner should measure installed app footprints read-only");
assert(rustScanner.includes("InstalledAppFootprints"), "Rust scanner should use an installed-app footprint measure kind");
assert(rustScanner.includes("installed_app_scan_item"), "Rust scanner should emit app footprint review candidates");
assert(rustScanner.includes("installed_app_review_signals"), "Rust scanner should emit structured installed-app review signals");
assert(rustScanner.includes("\"usage proof\""), "Rust scanner should make app usage uncertainty explicit");
assert(rustScanner.includes("\"official action\""), "Rust scanner should identify the manual uninstall action");
assert(rustScanner.includes("installed_app_registry_inventory"), "Rust scanner should enrich installed app review with read-only uninstall metadata");
assert(rustScanner.includes("installed_app_usage_inventory"), "Rust scanner should enrich installed app review with read-only usage evidence");
assert(rustScanner.includes("read_userassist_value_names"), "Rust scanner should read UserAssist value names without parsing executable authority");
assert(rustScanner.includes("RegEnumValueW"), "Rust scanner should enumerate UserAssist values read-only");
assert(rustScanner.includes("UserAssist launch evidence"), "Rust scanner should label app launch evidence explicitly");
assert(rustScanner.includes("no matching UserAssist launch evidence"), "Rust scanner should distinguish missing usage evidence from unused proof");
assert(rustScanner.includes("RegOpenKeyExW"), "Rust scanner should read Windows uninstall metadata through the registry API");
assert(rustScanner.includes("RegQueryValueExW"), "Rust scanner should query uninstall metadata values read-only");
assert(rustScanner.includes("RegEnumKeyExW"), "Rust scanner should enumerate uninstall metadata keys read-only");
assert(rustScanner.includes("DisplayName"), "Rust scanner should read installed app display names");
assert(rustScanner.includes("Publisher"), "Rust scanner should read installed app publisher metadata");
assert(rustScanner.includes("Windows uninstall metadata"), "Rust scanner should label uninstall metadata as app review evidence");
assert(!/\bRegDelete|RegSetValue|RegCreateKey|RegConnectRegistry|reg\.exe/i.test(rustScanner), "installed app metadata reader must not write registry keys or shell out to reg.exe");
assert(rustScanner.includes("Windows Settings or the vendor uninstaller"), "Rust scanner should keep app cleanup as manual uninstall guidance");
assert(app.includes("buildWriteBoundaryProbe"), "write boundary probe should be wired");
assert(app.includes("buildValidationEvidencePack"), "validation evidence pack should be wired");
assert(app.includes("buildValidationPackMarkdown"), "validation pack markdown export should be wired");
assert(app.includes("validationPackImportText"), "validation pack import text should be tracked in UI state");
assert(app.includes("importValidationPackEvidence"), "validation pack import should be wired");
assert(app.includes("routeProofImportText"), "selected route proof import text should be tracked in UI state");
assert(app.includes("importSelectedRouteProofEvidence"), "selected route proof import should be wired");
assert(model.includes("buildValidationPackImport"), "model should import validation pack evidence");
assert(model.includes("spaceguard-validation-pack-import/v1"), "validation pack import should expose a schema");
assert(model.includes("buildSelectedRouteProofEvidenceImport"), "model should import selected route proof evidence");
assert(model.includes("spaceguard-selected-route-proof-evidence-import/v1"), "selected route proof import should expose a schema");
assert(model.includes("ledger-rescan-parity"), "selected route proof import should map into ledger and rescan parity validation");
assert(app.includes("buildFixtureEvidenceImport"), "fixture evidence import should be wired");
assert(app.includes("VALIDATION_EVIDENCE_STORAGE_KEY"), "validation evidence should be persisted locally");
assert(app.includes("MANUAL_STRATEGY_EVIDENCE_STORAGE_KEY"), "manual strategy evidence should be persisted separately");
assert(app.includes("ROLLBACK_EVIDENCE_STORAGE_KEY"), "rollback evidence should be persisted separately");
assert(app.includes("readStoredValidationEvidence"), "validation evidence should be loaded from local storage");
assert(app.includes("readStoredManualStrategyEvidence"), "manual strategy evidence should be loaded from local storage");
assert(app.includes("readStoredRollbackEvidence"), "rollback evidence should be loaded from local storage");
assert(app.includes("setValidationCheckEvidence"), "validation evidence checklist should be editable");
assert(app.includes("updateValidationCheckEvidence"), "validation evidence detail records should be editable");
assert(app.includes("coerceValidationEvidenceFormRecord"), "validation evidence storage should migrate legacy records");
assert(app.includes("setRollbackProofEvidence"), "rollback evidence checklist should be editable");
assert(app.includes("updateRollbackProofEvidence"), "rollback evidence detail records should be editable");
assert(app.includes("coerceRollbackEvidenceFormRecord"), "rollback evidence storage should migrate legacy records");
assert(app.includes("gate-panel"), "question queue should be able to focus approval gates");
assert(app.includes("manual-strategy-checklist-panel"), "question queue should be able to focus manual strategy checklist");
assert(app.includes("rollback-plan-panel"), "question queue should be able to focus rollback proof");
assert(app.includes("validation-evidence-panel"), "question queue should be able to focus validation evidence");
assert(app.includes('question.action === "select-action"'), "agent question actions should select a scoped cleanup action");
assert(app.includes("Open approvals"), "agent question action should label approval gate focus");
assert(app.includes("Select action"), "agent question action should label scoped action selection");
assert(app.includes("Open checklist"), "agent question action should label manual checklist focus");
assert(app.includes("Open validation evidence"), "agent question action should label validation detail focus");
assert(app.includes("Evidence path or artifact id"), "validation evidence should require artifact path input");
assert(app.includes("Reviewer"), "validation evidence should require reviewer input");
assert(app.includes("Validation pack import"), "validation evidence panel should expose validation pack import");
assert(app.includes("Paste spaceguard-validation-pack/v1 JSON"), "validation pack import should accept exported JSON");
assert(app.includes("Import validation pack"), "validation pack import should have an explicit action");
assert(app.includes("Selected route proof import"), "validation evidence panel should expose selected-route proof import");
assert(app.includes("Paste spaceguard-selected-route-proof-packet/v1 JSON"), "selected route proof import should accept exported JSON");
assert(app.includes("Import route proof"), "selected route proof import should have an explicit action");
assert(app.includes("Dry-run scope cases"), "fixture evidence import UI should expose dry-run scope case counts");
assert(app.includes("setManualStrategyCheckEvidence"), "manual strategy checklist should be editable");
assert(app.includes("buildPlanSnapshot"), "plan snapshot should be wired");
assert(app.includes("buildVerificationSummary"), "verification summary should be wired");
assert(app.includes("buildPostRunVerificationPlan"), "post-run verification plan should be wired");
assert(app.includes("buildPostRunVerificationMarkdown"), "post-run verification export should be wired");
assert(model.includes("buildExecutionProofHandoff"), "model should expose execution proof handoff state");
assert(app.includes("ExecutionProofHandoffPanel"), "execution proof handoff panel should be rendered");
assert(app.includes("execution-proof-handoff-panel"), "execution proof handoff panel should be focusable");
assert(app.includes("Execution proof handoff"), "execution proof handoff should be visible after executors");
assert(app.includes("Run post-run rescan"), "execution proof handoff should expose the ledger-preserving rescan action");
assert(model.includes("spaceguard-executor-smoke-run-packet/v1"), "model should expose executor smoke-run packet schema");
assert(model.includes("spaceguard-scoped-executor-command-flow/v1"), "model should expose scoped executor command flow schema");
assert(model.includes("buildScopedExecutorCommandFlow"), "model should build the scoped executor command flow");
assert(model.includes("preferredRoute"), "model should accept a preferred scoped executor route");
assert(model.includes("routeOptions"), "model should expose route selector options");
assert(model.includes("Review proof"), "scoped command flow should review proof before another executor run");
assert(model.includes("SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR"), "smoke packet should name scoped executor env vars");
assert(app.includes("blockExecutorForPendingProof"), "scoped executor handlers should block when post-run proof is pending");
assert(app.includes("consentMatchesCurrentPlan"), "scoped executor handlers should require consent for the current plan");
assert(app.includes("current-plan consent receipt"), "scoped executor errors should call out stale or missing current-plan consent");
assert(app.includes("consentMatchesPlan ? \"current\""), "scoped executor panels should distinguish current consent from stale consent");
assert(app.includes("blockExecutorForMultipleScopedFlags"), "direct scoped executor handlers should block multi-flag real runs");
assert(app.includes("Only one scoped executor flag may be enabled for a real run"), "multi-flag executor errors should tell the operator to narrow scope");
assert(app.includes("singleScopedExecutorFlag"), "scoped executor panels should disable run readiness when multiple route flags are enabled");
assert(rustScanner.includes("enabled_scoped_executor_flags_on_windows"), "Rust native executor should count enabled scoped route flags before dispatch");
assert(rustScanner.includes("real_write_request_attempted(&request)"), "Rust native executor should apply multi-flag checks only to mutating requests");
assert(rustScanner.includes("multiple-scoped-executor-flags"), "Rust native executor should reject mutating requests when multiple scoped flags are enabled");
assert(rustScanner.includes("native-executor-scope-rejected"), "Rust native executor should return a scoped pre-dispatch rejection response");
assert(openAiAgent.includes("post-run-proof"), "OpenAI broker should check pending post-run proof before executor recommendations");
assert(app.includes("runPostRunReadonlyScan"), "post-run verification should have a ledger-preserving native rescan action");
assert(app.includes("executionProofContext"), "post-run verification should freeze the execution plan context");
assert(app.includes("commitExecutionLedger"), "execution ledger writes should go through one proof-context helper");
assert(app.includes("formatNativeWriteVolumeProof"), "execution ledger should format native drive free-space proof");
assert(app.includes("Volume proof"), "execution ledger should make native volume proof visible");
assert(app.includes("nativeVolumeProof"), "execution ledger should preserve structured native volume proof");
assert(app.includes("Native volume proof"), "execution proof handoff should show native volume proof details");
assert(model.includes("buildNativeVolumeProofHandoffSummary"), "model should summarize native volume proof for execution handoff");
const clearExecutionStateStart = app.indexOf("function clearExecutionState()");
const clearExecutionStateEnd = app.indexOf("\n  function updateScanSetting", clearExecutionStateStart);
const clearExecutionStateBlock = app.slice(clearExecutionStateStart, clearExecutionStateEnd);
for (const setter of [
  "setNativeRealExecution",
  "setNativeProjectDependencyExecution",
  "setNativeDownloadsExecution",
  "setNativeLargeFileArchiveExecution",
  "setNativeBrowserCacheExecution",
  "setNativeGradleCacheExecution",
  "setNativeUserCacheExecution",
  "setNativeAndroidCacheExecution",
  "setNativeShaderCacheExecution",
  "setNativePipCacheExecution",
  "setNativeDockerBuildCacheExecution",
  "setNativeNpmCacheExecution",
  "setNativePnpmStoreExecution",
  "setNativeRecycleBinExecution"
]) {
  assert(clearExecutionStateBlock.includes(`${setter}({ status: "idle", result: null, error: "" })`), `clearExecutionState should reset ${setter}`);
}
assert(app.includes("buildOpenAIAgentHandoffRecord"), "OpenAI recommendations should create first-class handoff records");
assert(app.includes("openAiAgentHandoff"), "OpenAI handoff state should survive through executor dispatch");
assert(app.includes("OpenAI handoff"), "native execution ledger should record OpenAI-brokered handoffs");
assert(app.includes("Latest agent handoff"), "OpenAI panel should show the latest routed handoff");
assert(app.includes("verificationPlanSnapshot"), "post-run verification should compare against the frozen execution plan");
assert(app.includes("verificationExecutorPlan"), "post-run verification should compare against the frozen executor plan");
assert(app.includes("Post-run native rescan complete"), "post-run rescan should report completion without starting a new plan scan");
assert(app.includes("buildRescanComparison"), "rescan comparison should be wired");
assert(app.includes("buildRescanComparisonMarkdown"), "rescan comparison export should be wired");
assert(app.includes("buildRollbackPlan"), "rollback plan should be wired");
assert(app.includes("buildSupportBundle"), "support bundle should be wired");
assert(app.includes("buildSupportBundleMarkdown"), "support bundle markdown export should be wired");
assert(app.includes("buildWorkflowHandoffPacket"), "workflow handoff packet should be wired");
assert(app.includes("buildWorkflowHandoffMarkdown"), "workflow handoff export should be wired");
assert(app.includes("buildBetaHandoffManifest"), "beta handoff manifest should be wired");
assert(app.includes("buildBetaHandoffManifestMarkdown"), "beta handoff manifest export should be wired");
assert(app.includes("BetaHandoffManifestPanel"), "beta handoff manifest panel should be rendered");
assert(app.includes("spaceguard-beta-handoff-manifest.md"), "beta handoff manifest export should use a stable file name");
assert(app.includes("buildLocalEvidenceBackup"), "local evidence backup should be wired");
assert(app.includes("buildLocalEvidenceBackupImport"), "local evidence backup import should be wired");
assert(app.includes("buildLocalEvidenceBackupMarkdown"), "local evidence backup export should be wired");
assert(app.includes("LocalEvidenceBackupPanel"), "local evidence backup panel should be rendered");
assert(app.includes("spaceguard-local-evidence-backup.md"), "local evidence backup export should use a stable file name");
assert(app.includes("Paste spaceguard-local-evidence-backup/v1 JSON"), "local evidence backup import should accept exported JSON");
assert(model.includes("nativeBetaEvidenceStatus"), "workflow handoff should carry native beta evidence status");
assert(model.includes("Complete native beta evidence ledger"), "workflow handoff should surface beta evidence as a resume action");
assert(model.includes("spaceguard-beta-handoff-manifest/v1"), "model should expose beta handoff manifest schema");
assert(model.includes("SpaceGuard Beta Handoff Manifest"), "model should export beta handoff manifest markdown");
assert(model.includes("## Beta Handoff Manifest"), "dry-run report should include beta handoff manifest summary");
assert(model.includes("spaceguard-local-evidence-backup/v1"), "model should expose local evidence backup schema");
assert(model.includes("spaceguard-local-evidence-backup-import/v1"), "model should expose local evidence backup import schema");
assert(model.includes("SpaceGuard Local Evidence Backup"), "model should export local evidence backup markdown");
assert(model.includes("Import restores evidence ledgers and run history only"), "local evidence backup should not restore execution state");
assert(app.includes("WorkflowHandoffPanel"), "workflow handoff panel should be rendered");
assert(app.includes("Beta evidence"), "workflow handoff panel should show beta evidence state");
assert(app.includes("Export handoff"), "workflow handoff export action should be visible");
assert(app.includes("buildRunReadiness"), "combined run readiness should be wired");
assert(app.includes("buildLedgerRunRecord"), "ledger run records should be wired");
assert(app.includes("buildLedgerHistorySummary"), "ledger history summary should be wired");
assert(app.includes("buildLedgerHistoryMarkdown"), "ledger history export should be wired");
assert(app.includes("getLedgerRunLabel"), "ledger panels should render source-aware run labels");
assert(app.includes("records dry-runs and scoped native executor runs"), "ledger empty state should describe dry-runs and scoped executor runs");
assert(app.includes("Append-only local run evidence"), "run history copy should include real run evidence");
assert(model.includes("scoped-native-execution"), "model should classify scoped native executor run records");
assert(model.includes("Scoped native execution bytes"), "run history export should separate scoped executor bytes");
assert(model.includes("Run type:"), "post-run exports should include run type");
assert(app.includes("localStorage"), "ledger history should use local browser storage");
assert(app.includes("runNativeExecutorDryRun"), "native executor dry-run should be wired");
assert(app.includes("runNativeDryRunScopeValidation"), "native dry-run scope validation probe should be wired");
assert(app.includes("buildNativeDryRunScopeEvidence"), "native dry-run scope evidence export should be wired");
assert(app.includes("Export scope evidence"), "native dry-run scope evidence export action should be visible");
assert(app.includes("runNativeWriteBoundary"), "native write boundary probe should be wired");
assert(app.includes("getNativeRuntimeCapabilities"), "native runtime capability should be wired");
assert(app.includes("executeCleanupPlan"), "runtime UI should expose route executor command capability");
assert(app.includes("Write boundary probe"), "write boundary probe panel should be rendered");
assert(app.includes("Release review packet"), "release review packet panel should be rendered");
assert(app.includes("Export review packet"), "release review packet export action should be visible");
assert(app.includes("Probe write boundary"), "write boundary probe action should be visible");
assert(app.includes("mutation disabled"), "write boundary probe should frame evidence as non-mutating route evidence");
assert(app.includes("accepted=false"), "write boundary probe should show the accepted=false requirement");
assert(app.includes("zero bytes"), "write boundary probe should make zero-byte outcome visible");
assert(app.includes("rejectCode"), "write boundary probe UI should expose native reject codes");
assert(app.includes("Candidate manifest"), "native dry-run panel should expose candidate manifest metadata");
assert(app.includes("targetScopeStatus"), "native dry-run panel should expose target-scope status");
assert(app.includes("Target scope rejected before sampling"), "native dry-run panel should explain blocked candidate sampling");
assert(!app.includes("function clearExecutionState() {\n    clearExecutionState();"), "execution reset should not recursively call itself");
assert(model.includes("large-user-files"), "model should include large personal file discovery");
assert(model.includes("Large personal files"), "model should label large personal file discovery");
assert(model.includes("item-review-large-files"), "model should route large personal files through item review");
assert(model.includes("spaceguard-storage-strategy/v1"), "model should expose storage strategy schema");
assert(model.includes("spaceguard-manual-strategy-checklist/v1"), "model should expose manual strategy checklist schema");
assert(model.includes("spaceguard-question-queue/v1"), "model should expose agent question queue schema");
assert(model.includes("spaceguard-intake-policy/v1"), "model should expose intake policy schema");
assert(model.includes("normalizeTargetDrive"), "model should normalize target drives");
assert(model.includes("spaceguard-task-powers/v1"), "model should expose task power schema");
assert(model.includes("taskPowerDefinitions"), "model should define scoped task powers");
assert(model.includes("spaceguard-task-power-broker/v1"), "model should expose task power broker schema");
assert(model.includes("defaultDecision: \"deny-unless-current-plan-grant\""), "broker should deny permission unless current plan grants exist");
assert(model.includes("standingPermission: false"), "broker should reject standing permissions");
assert(model.includes("spaceguard-task-capability-grants/v1"), "model should expose task capability grant schema");
assert(model.includes("dry-run-only"), "task capability grants should keep authority dry-run only");
assert(model.includes("expiresWith"), "task capability grants should carry expiry evidence");
assert(model.includes("spaceguard-agent-task-runbook/v1"), "model should expose task runbook schema");
assert(model.includes("task-scoped-dry-run"), "task runbook should stay task-scoped");
assert(model.includes("noCrossTaskAuthority"), "task runbook should forbid cross-task authority");
assert(model.includes("spaceguard-restriction-policy-matrix/v1"), "model should expose restriction policy matrix schema");
assert(model.includes("restrictionPolicyRules"), "model should define restriction policy rules");
assert(model.includes("browser-identity"), "restriction policy should include browser identity stores");
assert(model.includes("counts.realRun"), "restriction policy report should keep real-run count visible");
assert(model.includes("spaceguard-windows-setup-assistant/v1"), "model should expose Windows setup assistant schema");
assert(model.includes("forbiddenCommands"), "setup assistant should list forbidden commands");
assert(model.includes("Remove-Item"), "setup assistant should forbid direct delete commands");
assert(model.includes("spaceguard-demo-rehearsal-runbook/v1"), "model should expose demo rehearsal runbook schema");
assert(model.includes("safeForPublicDemo"), "demo rehearsal should expose public demo safety");
assert(model.includes("requiresNativeData: false"), "demo rehearsal should not require native data");
assert(model.includes("spaceguard-product-completion-audit/v1"), "model should expose product completion audit schema");
assert(model.includes("realCleanupLocked"), "product audit should expose real cleanup lock state");
assert(model.includes("scopedRealCleanupAvailable"), "product audit should expose scoped real cleanup state");
assert(model.includes("broadCleanupLocked"), "product audit should keep broad cleanup lock visible");
assert(model.includes("getScopedRealExecutorRoutes"), "model should derive scoped executor route names from runtime flags");
assert(model.includes("future-locked"), "product audit should name future-locked real cleanup");
assert(model.includes("spaceguard-user-decision-receipt/v1"), "model should expose user decision receipt schema");
assert(model.includes("spaceguard-risk-budget/v1"), "model should expose risk budget schema");
assert(model.includes("spaceguard-plan-lock/v1"), "model should expose plan lock schema");
assert(model.includes("admin-cleanup"), "model should classify admin cleanup as a scoped power");
assert(model.includes("reviewed-item-cleanup"), "model should classify reviewed item cleanup as a scoped power");
assert(model.includes("permanentConfirm"), "model should expose permanent-removal confirmation gate");
assert(model.includes("confirm-permanent-removal"), "question queue should ask permanent-removal questions");
assert(model.includes("intake admin boundary"), "model should name admin intake blockers");
assert(model.includes("allow-admin-system-routes"), "question queue should ask admin intake questions");
assert(model.includes("allow-admin-routes"), "question queue should expose admin allowance action");
assert(model.includes("run-first-scan"), "question queue should ask scan-first questions");
assert(model.includes("select-temp-fixture-cleanup"), "question queue should ask to select the seeded fixture action");
assert(model.includes("approve-rebuildable-caches"), "question queue should ask approval questions");
assert(model.includes("validation-evidence-detail"), "question queue should ask validation evidence questions");
assert(model.includes("rollback-proof-detail"), "question queue should ask rollback proof questions");
assert(model.includes("import-fixture-evidence"), "question queue should ask fixture import questions");
assert(model.includes("manualDispositionBytes"), "model should separate manual move/archive bytes from executor bytes");
assert(model.includes("isItemReviewDecision"), "model should validate expanded item review decisions");
assert(model.includes("spaceguard-scan-coverage/v1"), "model should expose scan coverage schema");
assert(model.includes("spaceguard-drive-inventory/v1"), "model should expose drive inventory schema");
assert(model.includes("top-level drive"), "drive inventory should describe top-level discovery");
assert(model.includes("noExecutorRoute: true"), "drive inventory should block executor route creation");
assert(model.includes("spaceguard-storage-pressure-diagnosis/v1"), "model should expose storage pressure diagnosis schema");
assert(model.includes("diagnose-storage-pressure"), "product audit should track storage pressure diagnosis");
assert(model.includes("Diagnosis can recommend workflow branches"), "diagnosis should not grant cleanup authority");
assert(model.includes("spaceguard-native-evidence-quality/v1"), "model should expose native evidence quality schema");
assert(model.includes("grade-native-evidence"), "product audit should track native evidence quality");
assert(model.includes("Native evidence is planning-grade"), "native evidence quality should grade read-only planning evidence");
assert(model.includes("nativePlanningReady"), "real data roadmap should use native evidence quality before native readiness");
assert(model.includes("spaceguard-candidate-safety-manifest/v1"), "model should expose candidate safety manifest schema");
assert(model.includes("prove-candidate-safety"), "product audit should track candidate safety");
assert(model.includes("spaceguard-custom-root-triage/v1"), "model should expose custom root triage schema");
assert(model.includes("customRootDispositionOptions"), "model should define custom root disposition options");
assert(model.includes("canCreateExecutor: false"), "custom root triage should block executor creation");
assert(model.includes("spaceguard-privacy-boundary/v1"), "model should expose privacy boundary schema");
assert(model.includes("spaceguard-rollback-plan/v1"), "model should expose rollback plan schema");
assert(model.includes("normalizeRollbackEvidenceRecord"), "model should normalize structured rollback evidence");
assert(model.includes("legacy-needs-detail"), "legacy rollback evidence should need details");
assert(model.includes("proof-complete"), "rollback rows should expose complete proof status");
assert(model.includes("spaceguard-rescan-comparison/v1"), "model should expose rescan comparison schema");
assert(model.includes("executedAt"), "ledger entries should carry absolute execution timestamps");
assert(model.includes("spaceguard-public-beta-readiness/v1"), "model should expose public beta readiness schema");
assert(model.includes("spaceguard-native-beta-distribution/v1"), "model should expose native beta distribution schema");
assert(model.includes("spaceguard-support-bundle/v1"), "model should expose support bundle schema");
assert(model.includes("spaceguard-workflow-handoff/v1"), "model should expose workflow handoff schema");
assert(model.includes("SpaceGuard Workflow Handoff"), "model should export workflow handoff markdown");
assert(model.includes("spaceguard-release-review-packet/v1"), "model should expose release review packet schema");
assert(model.includes("unsafe-stop"), "release review packet should stop on unsafe signals");
assert(model.includes("This packet is release review evidence only"), "release packet export should not enable cleanup");
assert(model.includes("spaceguard-tool-command-inventory/v1"), "model should expose tool command inventory schema");
assert(model.includes("spaceguard-write-readiness/v1"), "model should expose write readiness schema");
assert(model.includes("Real executor implementation"), "write readiness should require real executor implementation");
assert(model.includes("spaceguard-real-executor-capsule/v1"), "model should expose real executor capsule schema");
assert(model.includes("spaceguard-first-safe-executor-contract/v1"), "model should expose first-safe executor contract schema");
assert(model.includes("spaceguard-first-safe-work-order/v1"), "model should expose first-safe implementation work order schema");
assert(model.includes("spaceguard-temp-executor-activation-gate/v1"), "model should expose temp executor activation gate schema");
assert(model.includes("spaceguard-temp-activation-rehearsal/v1"), "model should expose temp activation rehearsal schema");
assert(model.includes("feature-flag-disabled"), "temp executor activation should block while the route flag is disabled");
assert(model.includes("Demo-only activation rehearsal"), "temp activation rehearsal should identify synthetic evidence");
assert(model.includes("activation-review-ready"), "temp executor activation should have an explicit review-ready state");
assert(model.includes("review-temp-activation"), "question queue should ask to review temp activation blockers");
assert(model.includes("tempActivationStatus"), "workflow handoff should carry temp activation status");
assert(model.includes("spaceguard-first-safe-target-audit/v1"), "model should expose first-safe target audit schema");
assert(model.includes("targetPath"), "first-safe contract should include native target path evidence");
assert(model.includes("target-scope-rejected"), "write boundary probe should separate target-scope rejection from passing evidence");
assert(model.includes("spaceguard-write-boundary-probe/v1"), "model should expose write boundary probe schema");
assert(model.includes("normalizeWriteExecutorScaffold"), "model should normalize native write executor scaffold metadata");
assert(model.includes("normalizeWritePreflightChecks"), "model should normalize native write preflight checks");
assert(model.includes("normalizeExecutorFeatureFlags"), "model should normalize per-executor runtime feature flags");
assert(model.includes("contract-mismatch"), "write boundary probe should reject mismatched contract echoes");
assert(model.includes("normalizeValidationEvidenceRecord"), "model should normalize structured validation evidence");
assert(model.includes("normalizeSelectedRouteProofSummary"), "model should preserve route proof provenance through validation packs");
assert(model.includes("spaceguard-fixture-evidence-import/v1"), "model should expose fixture evidence import schema");
assert(model.includes("destructive-evidence"), "fixture evidence import should reject destructive evidence");
assert(model.includes("scanner-fixtures"), "fixture evidence import should map scanner fixture readiness evidence");
assert(model.includes("buildFixtureEvidenceArtifactChain"), "fixture evidence import should preserve before/after artifact chains");
assert(model.includes("normalizeFixtureEvidenceSummary"), "validation packs should preserve fixture evidence summaries");
assert(model.includes("after-cleanup"), "fixture evidence import should label after-cleanup fixture artifacts");
assert(model.includes("dry-run-target-scope"), "model should expose dry-run target-scope validation");
assert(model.includes("spaceguard-native-dry-run-scope/v1"), "model should expose native dry-run scope evidence schema");
assert(model.includes("rejectedWithSamples"), "native dry-run scope evidence should track rejected targets that returned samples");
assert(model.includes("summarizeFixtureDryRunScopeCheck"), "fixture evidence import should summarize dry-run scope proof");
assert(model.includes("Dry-run target-scope evidence was not present"), "fixture import should keep dry-run scope proof separate when missing");
assert(model.includes("legacy-needs-detail"), "legacy validation evidence should need details");
assert(model.includes("needs-evidence-detail"), "marked validation evidence should require reviewer and artifact path");
assert(model.includes("destructiveActionAvailable"), "real executor capsule should keep destructive availability explicit");
assert(model.includes("toolNativeCommandSpecs"), "model should declare tool-native command specs");
assert(model.includes("commandExecutionEnabled: false"), "tool command inventory should keep command execution disabled");
assert(model.includes("realRunAvailable: false"), "task powers should keep real run unavailable");
assert(model.includes("This bundle intentionally excludes local paths"), "support bundle should state redaction boundary");
assert(model.includes("permanent-removal acknowledgement"), "model should disclose permanent-removal rollback boundary");
assert(model.includes("No cloud telemetry"), "model should keep cloud telemetry disabled");
assert(model.includes("demo-estimate"), "model should keep demo-estimated roots visible");
assert(model.includes("uninstall-apps-manually"), "model should include manual installed-app strategy");
assert(model.includes("review-custom-roots"), "model should include manual custom root strategy");
assert(model.includes("No executor route"), "custom root strategy should keep automation blocked");
assert(model.includes("No automated partition writes"), "model should keep partition strategy advisory");
assert(model.includes("spaceguard-native-scan-request-guard/v1"), "model should expose native scan request guard schema");
assert(app.includes("buildNativeScanRequestGuard"), "app should gate native scan settings before invoking the scanner");
assert(app.includes("Native scan settings blocked"), "app should surface blocked native scan settings");
assert(nativeAdapter.includes("scan_known_roots"), "native adapter should invoke the read-only scanner command");
assert(nativeAdapter.includes("targetDrive"), "native adapter should pass target drive scope");
assert(nativeAdapter.includes("customRoots"), "native adapter should pass custom read-only roots");
assert(nativeAdapter.includes("driveInventory"), "native adapter should normalize drive inventory rows");
assert(nativeAdapter.includes("simulate_cleanup_plan"), "native adapter should invoke the dry-run executor command");
assert(nativeAdapter.includes("runNativeDryRunScopeValidation"), "native adapter should expose native dry-run scope validation");
assert(nativeAdapter.includes("downloads-forbidden-as-temp"), "native adapter scope validation should include forbidden Downloads case");
assert(nativeAdapter.includes("browser-identity-forbidden"), "native adapter scope validation should include forbidden browser identity case");
assert(nativeAdapter.includes("candidateCount"), "native adapter should normalize dry-run candidate counts");
assert(nativeAdapter.includes("skippedCount"), "native adapter should normalize dry-run skipped counts");
assert(nativeAdapter.includes("targetScopeStatus"), "native adapter should normalize dry-run target-scope status");
assert(nativeAdapter.includes("execute_cleanup_plan"), "native adapter should invoke the route executor command");
assert(nativeAdapter.includes("TEMP_FIXTURE_ACTION_ID"), "native adapter should define the temp fixture action id");
assert(nativeAdapter.includes("%TEMP%\\\\spaceguard-fixture"), "native adapter should keep the fixture target scoped to the temp fixture root");
assert(nativeAdapter.includes("rejectCode"), "native adapter should normalize write-boundary reject codes");
assert(nativeAdapter.includes("targetPath"), "native adapter should pass selected target paths to the write boundary");
assert(nativeAdapter.includes("executorScaffold"), "native adapter should normalize write executor scaffold metadata");
assert(nativeAdapter.includes("preflightChecks"), "native adapter should normalize write preflight checks");
assert(nativeAdapter.includes("volumeProof"), "native adapter should normalize native write volume proof");
assert(nativeAdapter.includes("freeBytesDelta"), "native adapter should expose native write free-byte deltas");
assert(nativeAdapter.includes("runtime_capabilities"), "native adapter should invoke runtime capability command");
assert(nativeAdapter.includes("openAiAgentAdvice"), "native adapter should normalize OpenAI advisor command availability");
assert(nativeAdapter.includes("openAiAdvisorConfigured"), "native adapter should normalize OpenAI key configuration");
assert(nativeAdapter.includes("openAiKeySource"), "native adapter should normalize OpenAI key source");
assert(nativeAdapter.includes("executorFlags"), "native adapter should normalize per-executor feature flags");
assert(nativeAdapter.includes("enabledScopedExecutorFlags"), "native adapter should normalize enabled scoped executor flag names");
assert(nativeAdapter.includes("executorScopeStatus"), "native adapter should normalize executor scope status");
assert(nativeAdapter.includes("firstRouteProof"), "native adapter should normalize first-route proof runtime capability");
assert(nativeAdapter.includes("multiScopedFlagBlock"), "native adapter should suppress write authority when multiple scoped executor flags are enabled");
assert(rustScanner.includes("enabled_scoped_executor_flags"), "Rust runtime capabilities should expose enabled scoped executor flag names");
assert(rustScanner.includes("executor_scope_status"), "Rust runtime capabilities should expose executor scope status");
assert(rustScanner.includes("first_route_proof"), "Rust runtime capabilities should expose first-route proof state");
assert(rustScanner.includes("SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK"), "Rust runtime capabilities should read the first-route proof env var");
assert(rustScanner.includes("spaceguard-first-route-completion-check/v1"), "Rust runtime capabilities should validate the first-route completion schema");
assert(rustScanner.includes("reject_first_route_proof_required"), "Rust executor dispatch should reject real-data routes until first-route proof is accepted");
assert(rustScanner.includes("first-route-proof-required"), "Rust executor dispatch should expose a first-route proof reject code");
assert(rustScanner.includes("native-scope-invalid"), "Rust runtime capabilities should invalidate multi-flag scoped write mode");
assert(nativeAdapter.includes("items.map"), "native adapter should preserve item-level review candidates");
assert(tauriConfig.includes('"withGlobalTauri": true'), "Tauri config should expose the global bridge used by the adapter");
assert(rustScanner.includes("scan_known_roots"), "Rust scanner command should exist");
assert(rustScanner.includes("target_drive"), "Rust scanner should accept target drive scope");
assert(rustScanner.includes("target_drive_path"), "Rust scanner should scope system roots to the target drive");
assert(rustScanner.includes("DriveInventoryEntry"), "Rust scanner should expose drive inventory entries");
assert(rustScanner.includes("drive_inventory"), "Rust scanner should return drive inventory rows");
assert(rustScanner.includes("measure_drive_inventory"), "Rust scanner should measure top-level drive inventory read-only");
assert(rustScanner.includes("custom_roots"), "Rust scanner should accept custom read-only roots");
assert(rustScanner.includes("measure_custom_roots"), "Rust scanner should measure custom roots read-only");
assert(rustScanner.includes("simulate_cleanup_plan"), "Rust native dry-run command should exist");
assert(rustScanner.includes("DryRunCandidate"), "Rust native dry-run should expose candidate manifest entries");
assert(rustScanner.includes("candidate_count"), "Rust native dry-run should report candidate counts");
assert(rustScanner.includes("skipped_count"), "Rust native dry-run should report skipped counts");
assert(rustScanner.includes("target_scope_status"), "Rust native dry-run should report target-scope status");
assert(rustScanner.includes("write_action_target_reject_code(&action.route, &action.target_path)"), "Rust native dry-run should reuse target-scope rejection before candidate enumeration");
assert(rustScanner.includes("execute_cleanup_plan"), "Rust route executor command should exist");
assert(rustScanner.includes("fn temp_fixture_items"), "Rust scanner should emit temp fixture item evidence");
assert(rustScanner.includes("is_current_user_temp_root"), "Rust temp fixture scanner should stay scoped to the current user temp root");
assert(rustScanner.includes("spaceguard-fixture"), "Rust temp fixture scanner should look for the named fixture root");
assert(rustScanner.includes("openai_agent_advice"), "Rust native OpenAI advisor command should exist");
assert(rustScanner.includes("OPENAI_API_KEY"), "Rust native OpenAI advisor should read OPENAI_API_KEY");
assert(rustScanner.includes("dotenv_candidate_paths"), "Rust native OpenAI advisor should read local .env files");
assert(rustScanner.includes("reqwest::Client::new"), "Rust native OpenAI advisor should call OpenAI from native code");
assert(rustScanner.includes("openai_response_format"), "Rust native OpenAI advisor should request strict structured output");
assert(rustScanner.includes("contract_echo"), "Rust route boundary should echo the first-safe contract");
assert(rustScanner.includes("WriteExecutorScaffold"), "Rust write boundary should expose disabled executor scaffold metadata");
assert(rustScanner.includes("WritePreflightCheck"), "Rust write boundary should expose per-action preflight checks");
assert(rustScanner.includes("write_action_preflight"), "Rust write boundary should build per-action preflight evidence");
assert(rustScanner.includes("WriteVolumeProof"), "Rust write boundary should expose before/after volume proof");
assert(rustScanner.includes("finalize_write_volume_proof"), "Rust write boundary should attach volume proof after executor dispatch");
assert(rustScanner.includes("write_volume_free_bytes_delta"), "Rust write boundary should compute drive free-byte deltas");
assert(rustScanner.includes("tempCleanupExecutor"), "Rust write boundary should name the temp executor feature flag");
assert(rustScanner.includes("temp-executor-feature-flag-disabled"), "Rust write boundary should reject the temp scaffold while disabled");
assert(rustScanner.includes("write_boundary_rejections"), "Rust write boundary should validate request shape before rejection");
assert(rustScanner.includes("dry-run-only-required"), "Rust write boundary should reject non-dry-run request shapes");
assert(rustScanner.includes("route-not-first-safe"), "Rust write boundary should reject non-first-safe routes");
assert(rustScanner.includes("target-not-allowlisted"), "Rust write boundary should reject targets outside route allowlists");
assert(rustScanner.includes("target-forbidden"), "Rust write boundary should reject forbidden targets");
assert(rustScanner.includes("temp_cleanup_target_reject_code"), "Rust temp executor should use a route-specific target gate");
assert(rustScanner.includes("path_has_parent_component"), "Rust temp target gate should reject parent traversal before deletion");
assert(rustScanner.includes("runtime_capabilities"), "Rust runtime capability command should exist");
assert(rustScanner.includes("ExecutorFeatureFlags"), "Rust runtime capabilities should expose per-executor feature flags");
assert(rustScanner.includes("GetDiskFreeSpaceExW"), "Rust native scanner should read Windows volume totals");
assert(rustScanner.includes("IsUserAnAdmin"), "Rust native scanner should read elevation state");
assert(rustScanner.includes("LargeUserFiles"), "Rust scanner should include large personal file measurement");
assert(rustScanner.includes("large_user_file_items"), "Rust scanner should return large-file review candidates");
assert(rustScanner.includes("struct ScanItem"), "Rust scanner should expose item-level review candidates");
assert(rustScanner.includes("struct VolumeInfo"), "Rust scanner should expose read-only volume info");
assert(rustScanner.includes("package_dependency_names"), "Rust scanner should parse package dependency metadata for project review");
assert(rustScanner.includes("packageManager"), "Rust scanner should capture package manager metadata from package.json");
assert(rustScanner.includes("project_framework_signals"), "Rust scanner should classify project framework hints");
assert(rustScanner.includes("frameworks="), "Rust scanner should include framework signals in project dependency review reasons");
assert(rustScanner.includes("scripts="), "Rust scanner should include script signals in project dependency review reasons");
assert(rustScanner.includes("real_run_enabled: false"), "native dry-run should report real run disabled");
assert(rustScanner.includes("write_capability: false"), "native scanner should report write capability disabled");
assert(rustScanner.includes("destructive_commands: false"), "native scanner should report destructive commands disabled");
assert(rustScanner.includes("accepted: false"), "native write boundary should reject execution");
assert(!/Command::new\("cmd"|Command::new\("powershell"|powercfg|reg\.exe/i.test(rustScanner), "native scanner should not contain shell, reg.exe, or powercfg execution");
assert(!/\bremove_dir_all\b/i.test(rustScanner), "native executors should not use recursive directory removal");
assert(rustScanner.includes("fs::remove_dir(&dir)"), "project dependency executor may remove only traversed empty directories");
assert(rustScanner.includes("delete_single_temp_file"), "temp deletion should be isolated to the temp file executor");
assert(fixtureInspectScript.includes("AfterCleanupRoute"), "fixture inspector should support after-cleanup route validation");
assert(fixtureInspectScript.includes("expectedMissingAfterCleanup"), "fixture inspector should distinguish expected post-cleanup missing records");
assert(packageJson.includes("vite"), "package should use Vite");
assert(packageJson.includes("@radix-ui/react-slot"), "package should include shadcn primitive dependency");
assert(packageJson.includes("@tauri-apps/cli"), "package should include Tauri CLI for native setup");
assert(packageJson.includes("tests/openai-agent.test.js"), "package test script should include the OpenAI adapter test");
assert(realDataGuide.includes("Run real scan"), "real-data guide should include native scan UI steps");
assert(realDataGuide.includes("Disposable Fixture Run"), "real-data guide should include fixture validation setup");
assert(realDataGuide.includes("inspect-spaceguard-fixtures.ps1"), "real-data guide should include fixture evidence inspection");
assert(realDataGuide.includes("-AfterCleanupRoute known-temp-delete"), "real-data guide should include after-cleanup fixture inspection");
assert(realDataGuide.includes("DryRunScopeEvidencePath"), "real-data guide should explain dry-run scope evidence inspection");
assert(realDataGuide.includes("Validation pack import"), "real-data guide should explain validation pack import resume flow");
assert(realDataGuide.includes("selected route proof import"), "real-data guide should include selected route proof import in proof checklist");
assert(realDataGuide.includes("First npm real-data proof checklist"), "real-data guide should include a compact first npm real-data proof checklist");
assert(realDataGuide.includes("SPACEGUARD_ROUTE_SETUP_IGNORE_DOTENV=\"1\""), "real-data guide should show the dotenv override for route proof runs");
assert(realDataGuide.includes("Do not close the app until native volume proof"), "real-data guide should make the selected-route app-close stop condition explicit");
assert(realDataGuide.includes("beta handoff manifest"), "real-data guide should include beta handoff manifest export");
assert(realDataGuide.includes("OpenAI handoff"), "real-data guide should require OpenAI handoff ledger evidence");
assert(realDataGuide.includes("volume proof"), "real-data guide should distinguish native volume proof");
assert(realDataGuide.includes("local evidence backup"), "real-data guide should include local evidence backup export");
assert(realDataGuide.includes("Drive inventory"), "real-data guide should require drive inventory review");
assert(realDataGuide.includes("Storage pressure diagnosis"), "real-data guide should require storage pressure diagnosis review");
assert(realDataGuide.includes("Native evidence quality"), "real-data guide should require native evidence quality review");
assert(readme.includes("NATIVE_BETA_DISTRIBUTION.md"), "README should link native beta distribution runbook");
assert(readme.includes("Beta handoff manifest"), "README should describe beta handoff manifest");
assert(readme.includes("Latest agent handoff"), "README should describe OpenAI recommendation handoff visibility");
assert(readme.includes("Local evidence backup"), "README should describe local evidence backup");
assert(agentDesign.includes("spaceguard-openai-handoff/v1"), "agent design should document OpenAI handoff schema");
assert(agentDesign.includes("post-run native rescan"), "agent design should keep volume proof below route-level rescan proof");
assert(readme.includes("Docker build-cache"), "README should list Docker build-cache as a scoped executor family");
assert(readme.includes("pip cache"), "README should list pip cache as a scoped executor family");
assert(readme.includes("shader cache"), "README should list shader cache as a scoped executor family");
assert(readme.includes("The only external-command write route is Docker build-cache cleanup"), "README should distinguish Docker as the only external-command write route");
assert(!readme.includes("The one tool-native write route is Docker build-cache cleanup"), "README should not imply Docker is the only write-capable route");
assert(!readme.includes("or execute Windows cleanup APIs"), "README should not claim scoped Windows Shell API routes are absent");
assert(!readme.includes("one scoped executor flag at a time"), "README should not imply only one scoped executor flag can exist in .env");
assert(readme.includes("Read-only drive inventory"), "README should describe drive inventory");
assert(readme.includes("Storage pressure diagnosis"), "README should describe storage pressure diagnosis");
assert(readme.includes("Native evidence quality"), "README should describe native evidence quality");
assert(readme.includes("Installed app footprints"), "README should describe installed app footprint discovery");
assert(readme.includes("unused-review score"), "README should describe installed-app unused-review scoring");
assert(readme.includes("Seeded temp fixture"), "README should describe fixture-only temp cleanup");
assert(readme.includes("active smoke route"), "README should explain one active smoke route and queued ready routes");
assert(!readme.includes("matrix always keeps real-run routes at zero in this build"), "README should not claim all real-run routes are zero after scoped executors exist");
assert(!readme.includes("still cannot become a mutating executor"), "README should not describe the temp executor as permanently unable to mutate");
assert(!readme.includes("real cleanup remains locked. Any runtime write capability"), "README should distinguish scoped executor runtime from broad unsafe write signals");
assert(!readme.includes("while Docker, automated app uninstall, partition work, and broader tool-native prune commands remain future work or manual-only"), "README should not describe Docker build-cache cleanup as future work");
assert(realDataGuide.includes("App footprint decisions"), "real-data guide should describe app footprint manual decisions");
assert(realDataGuide.includes("Seeded temp fixture"), "real-data guide should describe fixture-only first cleanup");
assert(realDataGuide.includes("not selected by default"), "real-data guide should describe broad temp default suppression");
assert(realDataGuide.includes("NATIVE_BETA_DISTRIBUTION.md"), "real-data guide should link native beta distribution runbook");
assert(!realDataGuide.includes("zero executor routes, and zero real-run rows before real-data planning"), "real-data guide should not claim zero executor routes as the current product truth");
assert(nativeBetaRunbook.includes("Native Beta Distribution Runbook"), "native beta runbook should exist");
assert(nativeBetaRunbook.includes("Install Path"), "native beta runbook should cover install evidence");
assert(nativeBetaRunbook.includes("Uninstall Path"), "native beta runbook should cover uninstall evidence");
assert(nativeBetaRunbook.includes("Support Intake"), "native beta runbook should cover support intake");
assert(nativeBetaRunbook.includes("beta handoff manifest"), "native beta runbook should request the beta handoff manifest");
assert(nativeBetaRunbook.includes("Local evidence backup"), "native beta runbook should explain broader evidence restore");
assert(nativeBetaRunbook.includes("Evidence To Record In The App"), "native beta runbook should explain app evidence records");
assert(nativeBetaRunbook.includes("The checkbox alone does not count"), "native beta evidence should require reviewer and artifact detail");
assert(nativeBetaRunbook.includes("Import exported ledger"), "native beta runbook should explain evidence import resume flow");
assert(nativeBetaRunbook.includes("Release Stop Conditions"), "native beta runbook should define distribution stop conditions");
assert(nativeBetaRunbook.includes("must not delete files"), "native beta runbook should preserve the no-real-cleanup boundary");
assert(fixtureScript.includes("dryRunScopeCases"), "fixture seeder should emit dry-run scope validation cases");
assert(fixtureInspectScript.includes("dryRunScopeCheck"), "fixture inspector should emit dry-run scope validation result");
assert(fixtureInspectScript.includes("DryRunScopeEvidencePath"), "fixture inspector should accept dry-run scope evidence input");
assert(realDataGuide.includes("Those flags enable only their named routes"), "real-data guide should keep execution boundary explicit");
assert(fixtureScript.includes("spaceguard-fixture"), "fixture script should seed named SpaceGuard fixture roots");
assert(fixtureScript.includes("LargeCandidateMB"), "fixture script should support optional large-file validation");
assert(fixtureScript.includes("destructiveCommands = $false"), "fixture manifest should mark destructive commands disabled");
assert(!/\bRemove-Item\b|\bClear-Item\b|\bFormat-Volume\b|\bResize-Partition\b|\breg\.exe\b/i.test(fixtureScript), "fixture script should not contain destructive Windows commands");
assert(fixtureInspectScript.includes("spaceguard-fixture-evidence/v1"), "fixture inspection should emit structured evidence");
assert(fixtureInspectScript.includes("destructiveCommands = $false"), "fixture inspection should mark destructive commands disabled");
assert(!/\bRemove-Item\b|\bClear-Item\b|\bFormat-Volume\b|\bResize-Partition\b|\breg\.exe\b/i.test(fixtureInspectScript), "fixture inspection should not contain destructive Windows commands");

console.log("static app ok");
