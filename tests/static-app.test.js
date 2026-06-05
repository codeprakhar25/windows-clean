const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "src", "index.css"), "utf8");
const app = fs.readFileSync(path.join(root, "src", "App.jsx"), "utf8");
const model = fs.readFileSync(path.join(root, "src", "spaceguard-model.mjs"), "utf8");
const nativeAdapter = fs.readFileSync(path.join(root, "src", "native-scanner.mjs"), "utf8");
const tauriConfig = fs.readFileSync(path.join(root, "src-tauri", "tauri.conf.json"), "utf8");
const rustScanner = fs.readFileSync(path.join(root, "src-tauri", "src", "main.rs"), "utf8");
const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const realDataGuide = fs.readFileSync(path.join(root, "WINDOWS_REAL_DATA_SETUP.md"), "utf8");
const nativeBetaRunbook = fs.readFileSync(path.join(root, "NATIVE_BETA_DISTRIBUTION.md"), "utf8");
const fixtureScript = fs.readFileSync(path.join(root, "scripts", "seed-spaceguard-fixtures.ps1"), "utf8");
const fixtureInspectScript = fs.readFileSync(path.join(root, "scripts", "inspect-spaceguard-fixtures.ps1"), "utf8");

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
  "Open item review",
  "Question queue is clear",
  "Storage strategy",
  "Manual storage strategy",
  "Manual strategy checklist",
  "Manual-only boundary",
  "Review workbench",
  "Decision log",
  "Item review",
  "Inspect",
  "Executor policy",
  "Native dry-run",
  "Scope evidence export",
  "Rejected samples",
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
  "rejecting stub",
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
assert(app.includes("buildRealDataLaunchRoadmap"), "real data launch roadmap should be wired");
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
assert(app.includes("buildScanSessionEvidence"), "scan session freshness guard should be wired");
assert(app.includes("buildRecoveryAdvisor"), "recovery advisor should be wired");
assert(app.includes("buildAgentQuestionQueue"), "agent question queue should be wired");
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
assert(app.includes("buildToolCommandInventory"), "tool command inventory should be wired");
assert(app.includes("buildPrivilegeBoundary"), "privilege boundary should be wired");
assert(app.includes("buildPrivacyBoundary"), "privacy boundary should be wired");
assert(app.includes("buildPublicBetaReadiness"), "public beta readiness should be wired");
assert(app.includes("buildReleaseGate"), "release gate should be wired");
assert(app.includes("executorFlags"), "release gate should consume per-executor runtime feature flags");
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
assert(app.includes("buildWriteBoundaryProbe"), "write boundary probe should be wired");
assert(app.includes("buildValidationEvidencePack"), "validation evidence pack should be wired");
assert(app.includes("buildValidationPackMarkdown"), "validation pack markdown export should be wired");
assert(app.includes("validationPackImportText"), "validation pack import text should be tracked in UI state");
assert(app.includes("importValidationPackEvidence"), "validation pack import should be wired");
assert(model.includes("buildValidationPackImport"), "model should import validation pack evidence");
assert(model.includes("spaceguard-validation-pack-import/v1"), "validation pack import should expose a schema");
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
assert(app.includes("Open approvals"), "agent question action should label approval gate focus");
assert(app.includes("Open checklist"), "agent question action should label manual checklist focus");
assert(app.includes("Open validation evidence"), "agent question action should label validation detail focus");
assert(app.includes("Evidence path or artifact id"), "validation evidence should require artifact path input");
assert(app.includes("Reviewer"), "validation evidence should require reviewer input");
assert(app.includes("Validation pack import"), "validation evidence panel should expose validation pack import");
assert(app.includes("Paste spaceguard-validation-pack/v1 JSON"), "validation pack import should accept exported JSON");
assert(app.includes("Import validation pack"), "validation pack import should have an explicit action");
assert(app.includes("Dry-run scope cases"), "fixture evidence import UI should expose dry-run scope case counts");
assert(app.includes("setManualStrategyCheckEvidence"), "manual strategy checklist should be editable");
assert(app.includes("buildPlanSnapshot"), "plan snapshot should be wired");
assert(app.includes("buildVerificationSummary"), "verification summary should be wired");
assert(app.includes("buildPostRunVerificationPlan"), "post-run verification plan should be wired");
assert(app.includes("buildPostRunVerificationMarkdown"), "post-run verification export should be wired");
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
assert(app.includes("localStorage"), "ledger history should use local browser storage");
assert(app.includes("runNativeExecutorDryRun"), "native executor dry-run should be wired");
assert(app.includes("runNativeDryRunScopeValidation"), "native dry-run scope validation probe should be wired");
assert(app.includes("buildNativeDryRunScopeEvidence"), "native dry-run scope evidence export should be wired");
assert(app.includes("Export scope evidence"), "native dry-run scope evidence export action should be visible");
assert(app.includes("runNativeWriteBoundary"), "native write boundary probe should be wired");
assert(app.includes("getNativeRuntimeCapabilities"), "native runtime capability should be wired");
assert(app.includes("executeCleanupPlan"), "runtime UI should expose rejecting write command capability");
assert(app.includes("Write boundary probe"), "write boundary probe panel should be rendered");
assert(app.includes("Release review packet"), "release review packet panel should be rendered");
assert(app.includes("Export review packet"), "release review packet export action should be visible");
assert(app.includes("Probe write boundary"), "write boundary probe action should be visible");
assert(app.includes("rejection evidence"), "write boundary probe should frame evidence as rejection evidence");
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
assert(model.includes("spaceguard-fixture-evidence-import/v1"), "model should expose fixture evidence import schema");
assert(model.includes("destructive-evidence"), "fixture evidence import should reject destructive evidence");
assert(model.includes("scanner-fixtures"), "fixture evidence import should map scanner fixture readiness evidence");
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
assert(nativeAdapter.includes("execute_cleanup_plan"), "native adapter should invoke the rejecting write boundary command");
assert(nativeAdapter.includes("rejectCode"), "native adapter should normalize write-boundary reject codes");
assert(nativeAdapter.includes("targetPath"), "native adapter should pass selected target paths to the write boundary");
assert(nativeAdapter.includes("executorScaffold"), "native adapter should normalize write executor scaffold metadata");
assert(nativeAdapter.includes("preflightChecks"), "native adapter should normalize write preflight checks");
assert(nativeAdapter.includes("runtime_capabilities"), "native adapter should invoke runtime capability command");
assert(nativeAdapter.includes("executorFlags"), "native adapter should normalize per-executor feature flags");
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
assert(rustScanner.includes("execute_cleanup_plan"), "Rust rejecting write boundary command should exist");
assert(rustScanner.includes("contract_echo"), "Rust rejecting write boundary should echo the first-safe contract");
assert(rustScanner.includes("WriteExecutorScaffold"), "Rust write boundary should expose disabled executor scaffold metadata");
assert(rustScanner.includes("WritePreflightCheck"), "Rust write boundary should expose per-action preflight checks");
assert(rustScanner.includes("write_action_preflight"), "Rust write boundary should build per-action preflight evidence");
assert(rustScanner.includes("tempCleanupExecutor"), "Rust write boundary should name the temp executor feature flag");
assert(rustScanner.includes("temp-executor-feature-flag-disabled"), "Rust write boundary should reject the temp scaffold while disabled");
assert(rustScanner.includes("write_boundary_rejections"), "Rust write boundary should validate request shape before rejection");
assert(rustScanner.includes("dry-run-only-required"), "Rust write boundary should reject non-dry-run request shapes");
assert(rustScanner.includes("route-not-first-safe"), "Rust write boundary should reject non-first-safe routes");
assert(rustScanner.includes("target-not-allowlisted"), "Rust write boundary should reject targets outside route allowlists");
assert(rustScanner.includes("target-forbidden"), "Rust write boundary should reject forbidden targets");
assert(rustScanner.includes("runtime_capabilities"), "Rust runtime capability command should exist");
assert(rustScanner.includes("ExecutorFeatureFlags"), "Rust runtime capabilities should expose per-executor feature flags");
assert(rustScanner.includes("GetDiskFreeSpaceExW"), "Rust native scanner should read Windows volume totals");
assert(rustScanner.includes("IsUserAnAdmin"), "Rust native scanner should read elevation state");
assert(rustScanner.includes("LargeUserFiles"), "Rust scanner should include large personal file measurement");
assert(rustScanner.includes("large_user_file_items"), "Rust scanner should return large-file review candidates");
assert(rustScanner.includes("struct ScanItem"), "Rust scanner should expose item-level review candidates");
assert(rustScanner.includes("struct VolumeInfo"), "Rust scanner should expose read-only volume info");
assert(rustScanner.includes("real_run_enabled: false"), "native dry-run should report real run disabled");
assert(rustScanner.includes("write_capability: false"), "native scanner should report write capability disabled");
assert(rustScanner.includes("destructive_commands: false"), "native scanner should report destructive commands disabled");
assert(rustScanner.includes("accepted: false"), "native write boundary should reject execution");
assert(!/\bremove_file\b|\bremove_dir\b|\bCommand::new\b|powercfg|reg\.exe/i.test(rustScanner), "native scanner should not contain delete, shell, registry, or powercfg execution");
assert(packageJson.includes("vite"), "package should use Vite");
assert(packageJson.includes("@radix-ui/react-slot"), "package should include shadcn primitive dependency");
assert(packageJson.includes("@tauri-apps/cli"), "package should include Tauri CLI for native setup");
assert(realDataGuide.includes("Run real scan"), "real-data guide should include native scan UI steps");
assert(realDataGuide.includes("Disposable Fixture Run"), "real-data guide should include fixture validation setup");
assert(realDataGuide.includes("inspect-spaceguard-fixtures.ps1"), "real-data guide should include fixture evidence inspection");
assert(realDataGuide.includes("DryRunScopeEvidencePath"), "real-data guide should explain dry-run scope evidence inspection");
assert(realDataGuide.includes("Validation pack import"), "real-data guide should explain validation pack import resume flow");
assert(realDataGuide.includes("beta handoff manifest"), "real-data guide should include beta handoff manifest export");
assert(realDataGuide.includes("local evidence backup"), "real-data guide should include local evidence backup export");
assert(realDataGuide.includes("Drive inventory"), "real-data guide should require drive inventory review");
assert(realDataGuide.includes("Storage pressure diagnosis"), "real-data guide should require storage pressure diagnosis review");
assert(realDataGuide.includes("Native evidence quality"), "real-data guide should require native evidence quality review");
assert(readme.includes("NATIVE_BETA_DISTRIBUTION.md"), "README should link native beta distribution runbook");
assert(readme.includes("Beta handoff manifest"), "README should describe beta handoff manifest");
assert(readme.includes("Local evidence backup"), "README should describe local evidence backup");
assert(readme.includes("Read-only drive inventory"), "README should describe drive inventory");
assert(readme.includes("Storage pressure diagnosis"), "README should describe storage pressure diagnosis");
assert(readme.includes("Native evidence quality"), "README should describe native evidence quality");
assert(realDataGuide.includes("NATIVE_BETA_DISTRIBUTION.md"), "real-data guide should link native beta distribution runbook");
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
assert(realDataGuide.includes("Real executors remain disabled"), "real-data guide should keep execution boundary explicit");
assert(fixtureScript.includes("spaceguard-fixture"), "fixture script should seed named SpaceGuard fixture roots");
assert(fixtureScript.includes("LargeCandidateMB"), "fixture script should support optional large-file validation");
assert(fixtureScript.includes("destructiveCommands = $false"), "fixture manifest should mark destructive commands disabled");
assert(!/\bRemove-Item\b|\bClear-Item\b|\bFormat-Volume\b|\bResize-Partition\b|\breg\.exe\b/i.test(fixtureScript), "fixture script should not contain destructive Windows commands");
assert(fixtureInspectScript.includes("spaceguard-fixture-evidence/v1"), "fixture inspection should emit structured evidence");
assert(fixtureInspectScript.includes("destructiveCommands = $false"), "fixture inspection should mark destructive commands disabled");
assert(!/\bRemove-Item\b|\bClear-Item\b|\bFormat-Volume\b|\bResize-Partition\b|\breg\.exe\b/i.test(fixtureInspectScript), "fixture inspection should not contain destructive Windows commands");

console.log("static app ok");
