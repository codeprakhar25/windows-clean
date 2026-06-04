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
const realDataGuide = fs.readFileSync(path.join(root, "WINDOWS_REAL_DATA_SETUP.md"), "utf8");
const fixtureScript = fs.readFileSync(path.join(root, "scripts", "seed-spaceguard-fixtures.ps1"), "utf8");
const fixtureInspectScript = fs.readFileSync(path.join(root, "scripts", "inspect-spaceguard-fixtures.ps1"), "utf8");

const requiredAppMarkers = [
  "SpaceGuard",
  "Dry-run agent",
  "Run demo scan",
  "Cleanup actions",
  "Agent gates",
  "Plan review queue",
  "Execution preflight",
  "Execution ledger",
  "Protected paths",
  "Demo scenario",
  "Export report",
  "Real data readiness",
  "Intake constraints",
  "Admin/system actions",
  "intake gated",
  "Run real scan",
  "Native app required",
  "Real scan settings",
  "Custom read-only roots",
  "Add root",
  "Custom root discovery",
  "Project artifacts",
  "Traversal depth",
  "Entry cap",
  "Actual volume usage",
  "drive evidence",
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
  "Privilege boundary",
  "Privacy boundary",
  "Public beta readiness",
  "Distribution boundary",
  "Native beta",
  "Support bundle",
  "Redaction boundary",
  "Export support bundle",
  "Runtime privilege",
  "Release gate",
  "Write readiness",
  "Final write gate",
  "write hidden",
  "Real executor capsule",
  "destructive hidden",
  "Runtime capability",
  "Write command",
  "rejecting stub",
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
  "Export history"
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
assert(app.includes("runNativeReadonlyScan"), "real read-only scan workflow should be wired");
assert(app.includes("scanSettings"), "native scan settings should be wired");
assert(app.includes("updateScanSetting"), "native scan settings should invalidate stale evidence");
assert(app.includes("customRoots"), "native scan settings should include custom read-only roots");
assert(app.includes("addCustomScanRoot"), "custom scan roots should be editable");
assert(app.includes("buildScanCoverageSummary"), "scan coverage summary should be wired");
assert(app.includes("buildRecoveryAdvisor"), "recovery advisor should be wired");
assert(app.includes("buildAgentQuestionQueue"), "agent question queue should be wired");
assert(app.includes("buildStorageStrategyPlan"), "storage strategy workflow should be wired");
assert(app.includes("buildManualStrategyChecklist"), "manual strategy checklist should be wired");
assert(app.includes("buildReviewWorkbench"), "review workbench should be wired");
assert(app.includes("buildDecisionLog"), "decision log should be wired");
assert(app.includes("buildItemReview"), "item review should be wired");
assert(app.includes("buildExecutorPlan"), "executor plan should be wired");
assert(app.includes("buildExecutorManifest"), "executor manifest should be wired");
assert(app.includes("buildToolCommandInventory"), "tool command inventory should be wired");
assert(app.includes("buildPrivilegeBoundary"), "privilege boundary should be wired");
assert(app.includes("buildPrivacyBoundary"), "privacy boundary should be wired");
assert(app.includes("buildPublicBetaReadiness"), "public beta readiness should be wired");
assert(app.includes("buildReleaseGate"), "release gate should be wired");
assert(app.includes("buildWriteReadiness"), "write readiness should be wired");
assert(app.includes("buildRealExecutorCapsule"), "real executor capsule should be wired");
assert(app.includes("buildWriteBoundaryProbe"), "write boundary probe should be wired");
assert(app.includes("buildValidationEvidencePack"), "validation evidence pack should be wired");
assert(app.includes("buildValidationPackMarkdown"), "validation pack markdown export should be wired");
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
assert(app.includes("rollback-plan-panel"), "question queue should be able to focus rollback proof");
assert(app.includes("validation-evidence-panel"), "question queue should be able to focus validation evidence");
assert(app.includes("Evidence path or artifact id"), "validation evidence should require artifact path input");
assert(app.includes("Reviewer"), "validation evidence should require reviewer input");
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
assert(app.includes("buildRunReadiness"), "combined run readiness should be wired");
assert(app.includes("buildLedgerRunRecord"), "ledger run records should be wired");
assert(app.includes("buildLedgerHistorySummary"), "ledger history summary should be wired");
assert(app.includes("buildLedgerHistoryMarkdown"), "ledger history export should be wired");
assert(app.includes("localStorage"), "ledger history should use local browser storage");
assert(app.includes("runNativeExecutorDryRun"), "native executor dry-run should be wired");
assert(app.includes("runNativeWriteBoundary"), "native write boundary probe should be wired");
assert(app.includes("getNativeRuntimeCapabilities"), "native runtime capability should be wired");
assert(app.includes("executeCleanupPlan"), "runtime UI should expose rejecting write command capability");
assert(app.includes("Write boundary probe"), "write boundary probe panel should be rendered");
assert(app.includes("Probe write boundary"), "write boundary probe action should be visible");
assert(app.includes("rejection evidence"), "write boundary probe should frame evidence as rejection evidence");
assert(app.includes("zero bytes"), "write boundary probe should make zero-byte outcome visible");
assert(!app.includes("function clearExecutionState() {\n    clearExecutionState();"), "execution reset should not recursively call itself");
assert(model.includes("large-user-files"), "model should include large personal file discovery");
assert(model.includes("Large personal files"), "model should label large personal file discovery");
assert(model.includes("item-review-large-files"), "model should route large personal files through item review");
assert(model.includes("spaceguard-storage-strategy/v1"), "model should expose storage strategy schema");
assert(model.includes("spaceguard-manual-strategy-checklist/v1"), "model should expose manual strategy checklist schema");
assert(model.includes("spaceguard-question-queue/v1"), "model should expose agent question queue schema");
assert(model.includes("spaceguard-intake-policy/v1"), "model should expose intake policy schema");
assert(model.includes("intake admin boundary"), "model should name admin intake blockers");
assert(model.includes("run-first-scan"), "question queue should ask scan-first questions");
assert(model.includes("approve-rebuildable-caches"), "question queue should ask approval questions");
assert(model.includes("validation-evidence-detail"), "question queue should ask validation evidence questions");
assert(model.includes("rollback-proof-detail"), "question queue should ask rollback proof questions");
assert(model.includes("import-fixture-evidence"), "question queue should ask fixture import questions");
assert(model.includes("manualDispositionBytes"), "model should separate manual move/archive bytes from executor bytes");
assert(model.includes("isItemReviewDecision"), "model should validate expanded item review decisions");
assert(model.includes("spaceguard-scan-coverage/v1"), "model should expose scan coverage schema");
assert(model.includes("spaceguard-privacy-boundary/v1"), "model should expose privacy boundary schema");
assert(model.includes("spaceguard-rollback-plan/v1"), "model should expose rollback plan schema");
assert(model.includes("normalizeRollbackEvidenceRecord"), "model should normalize structured rollback evidence");
assert(model.includes("legacy-needs-detail"), "legacy rollback evidence should need details");
assert(model.includes("proof-complete"), "rollback rows should expose complete proof status");
assert(model.includes("spaceguard-rescan-comparison/v1"), "model should expose rescan comparison schema");
assert(model.includes("executedAt"), "ledger entries should carry absolute execution timestamps");
assert(model.includes("spaceguard-public-beta-readiness/v1"), "model should expose public beta readiness schema");
assert(model.includes("spaceguard-support-bundle/v1"), "model should expose support bundle schema");
assert(model.includes("spaceguard-tool-command-inventory/v1"), "model should expose tool command inventory schema");
assert(model.includes("spaceguard-write-readiness/v1"), "model should expose write readiness schema");
assert(model.includes("Real executor implementation"), "write readiness should require real executor implementation");
assert(model.includes("spaceguard-real-executor-capsule/v1"), "model should expose real executor capsule schema");
assert(model.includes("spaceguard-write-boundary-probe/v1"), "model should expose write boundary probe schema");
assert(model.includes("normalizeValidationEvidenceRecord"), "model should normalize structured validation evidence");
assert(model.includes("spaceguard-fixture-evidence-import/v1"), "model should expose fixture evidence import schema");
assert(model.includes("destructive-evidence"), "fixture evidence import should reject destructive evidence");
assert(model.includes("scanner-fixtures"), "fixture evidence import should map only fixture readiness evidence");
assert(model.includes("legacy-needs-detail"), "legacy validation evidence should need details");
assert(model.includes("needs-evidence-detail"), "marked validation evidence should require reviewer and artifact path");
assert(model.includes("destructiveActionAvailable"), "real executor capsule should keep destructive availability explicit");
assert(model.includes("toolNativeCommandSpecs"), "model should declare tool-native command specs");
assert(model.includes("commandExecutionEnabled: false"), "tool command inventory should keep command execution disabled");
assert(model.includes("This bundle intentionally excludes local paths"), "support bundle should state redaction boundary");
assert(model.includes("permanent-removal acknowledgement"), "model should disclose permanent-removal rollback boundary");
assert(model.includes("No cloud telemetry"), "model should keep cloud telemetry disabled");
assert(model.includes("demo-estimate"), "model should keep demo-estimated roots visible");
assert(model.includes("uninstall-apps-manually"), "model should include manual installed-app strategy");
assert(model.includes("review-custom-roots"), "model should include manual custom root strategy");
assert(model.includes("No executor route"), "custom root strategy should keep automation blocked");
assert(model.includes("No automated partition writes"), "model should keep partition strategy advisory");
assert(nativeAdapter.includes("scan_known_roots"), "native adapter should invoke the read-only scanner command");
assert(nativeAdapter.includes("customRoots"), "native adapter should pass custom read-only roots");
assert(nativeAdapter.includes("simulate_cleanup_plan"), "native adapter should invoke the dry-run executor command");
assert(nativeAdapter.includes("execute_cleanup_plan"), "native adapter should invoke the rejecting write boundary command");
assert(nativeAdapter.includes("runtime_capabilities"), "native adapter should invoke runtime capability command");
assert(nativeAdapter.includes("items.map"), "native adapter should preserve item-level review candidates");
assert(tauriConfig.includes('"withGlobalTauri": true'), "Tauri config should expose the global bridge used by the adapter");
assert(rustScanner.includes("scan_known_roots"), "Rust scanner command should exist");
assert(rustScanner.includes("custom_roots"), "Rust scanner should accept custom read-only roots");
assert(rustScanner.includes("measure_custom_roots"), "Rust scanner should measure custom roots read-only");
assert(rustScanner.includes("simulate_cleanup_plan"), "Rust native dry-run command should exist");
assert(rustScanner.includes("execute_cleanup_plan"), "Rust rejecting write boundary command should exist");
assert(rustScanner.includes("runtime_capabilities"), "Rust runtime capability command should exist");
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
assert(realDataGuide.includes("Real executors remain disabled"), "real-data guide should keep execution boundary explicit");
assert(fixtureScript.includes("spaceguard-fixture"), "fixture script should seed named SpaceGuard fixture roots");
assert(fixtureScript.includes("LargeCandidateMB"), "fixture script should support optional large-file validation");
assert(fixtureScript.includes("destructiveCommands = $false"), "fixture manifest should mark destructive commands disabled");
assert(!/\bRemove-Item\b|\bClear-Item\b|\bFormat-Volume\b|\bResize-Partition\b|\breg\.exe\b/i.test(fixtureScript), "fixture script should not contain destructive Windows commands");
assert(fixtureInspectScript.includes("spaceguard-fixture-evidence/v1"), "fixture inspection should emit structured evidence");
assert(fixtureInspectScript.includes("destructiveCommands = $false"), "fixture inspection should mark destructive commands disabled");
assert(!/\bRemove-Item\b|\bClear-Item\b|\bFormat-Volume\b|\bResize-Partition\b|\breg\.exe\b/i.test(fixtureInspectScript), "fixture inspection should not contain destructive Windows commands");

console.log("static app ok");
