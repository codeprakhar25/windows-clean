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
const windowsReadinessScript = fs.readFileSync(path.join(root, "scripts", "run-windows-readiness.mjs"), "utf8");
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
  "Open SpaceGuard for Windows",
  "This browser page cannot scan or delete files.",
  "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR",
  "Scan PC",
  "Scan for cleanup",
  "Fast scan first",
  "Explore C:",
  "Select one or more rows, then delete them.",
  "Select items to delete",
  "Scan again",
  "Ask AI"
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
  "runNativeRecycleBinExecutor"
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
assert(app.includes("buildExecutionLedgerRows"), "app should normalize native rejection details before converting them to simple user copy");
assert(app.includes("buildExecutionGate"), "app should use tested execution dispatch gate guardrails");
assert(app.includes("buildExecutionPrerequisites"), "app should use tested route-specific execution prerequisites");
assert(!app.includes("resolveRuntimeRouteInput"), "app shell should not sync cleanup selection from legacy route flags");
assert(!app.includes("setSetupRouteInput"), "app shell should not require route arming before native cleanup");
assert(!app.includes("resetWorkflowForRouteChange"), "app shell should not carry unused workflow reset helpers");
assert(app.includes("buildWorkflowLocks"), "app should use tested workflow lock policy for cleanup continuation");
assert(!app.includes("buildBaselinePromotion"), "app shell should not run hidden proof/support baseline promotion after cleanup");
assert(!app.includes("buildRouteSetupChecklist"), "app shell should not render the legacy route setup checklist");
assert(!app.includes("RouteReadinessList"), "clean screen should not render internal readiness rows");
assert(!app.includes("formatNotReadyReason"), "Clean screen should not carry a separate not-ready detail panel");
assert(app.includes("selectWorkflowCandidate"), "cleanup target selection should reuse the guarded selection reset helper");
assert(app.includes("useState(\"clean\")"), "app should open directly on the Clean screen");
assert(!app.includes("id: \"overview\""), "sidebar should not force users through an overview detour");
assert(app.includes("function MobileTabNav"), "mobile layout should expose tab switching between app views");
assert(app.includes("role=\"tablist\""), "mobile view switching should use tab semantics");
assert(!app.includes("Advanced scan options"), "Clean screen should not expose advanced scan tuning");
assert(!app.includes("Target drive"), "Clean screen should not ask users to configure the target drive before scanning");
assert(!app.includes("@/components/ui/input"), "app shell should not import unused input controls");
assert(!app.includes("Entry cap"), "Clean screen should not expose native scan cap controls");
assert(!app.includes("Protected paths"), "Clean screen should not expose protected-path editing");
assert(!app.includes("Extra folders to scan"), "Clean screen should not expose custom root setup");
assert(/activeView === "clean"[\s\S]*!scan \? \([\s\S]*<ScanPanel[\s\S]*\) : \([\s\S]*<CleanPanel/.test(app), "Clean screen should show scan setup only before the first scan and then show the cleanup queue");
assert(app.includes("onScanAgain={() => runRealScan()}"), "post-scan cleanup queue header should run a normal scan refresh");
assert(app.includes("onRescan={() => runRealScan({ afterExecution: true })}"), "cleanup result retry should keep the post-execution rescan path");
assert(app.includes("const canExecute = executionGate.ready"), "execute button should stay locked through the shared execution gate");
assert(app.includes("const currentExecutionGate = buildExecutionGate"), "execute handler should recheck the execution gate before native dispatch");
assert(app.includes("if (!currentExecutionGate.ready)"), "execute handler should block native dispatch when execution gate is not ready");
assert(app.includes("formatExecutionGateError"), "execute handler should convert dispatch blockers into plain user-facing copy");
assert(app.includes("const [checkedIds, setCheckedIds] = useState([])"), "cleanup queue should support multiple checked rows");
assert(app.includes("const nextCheckedIds = isChecked"), "clicking an already checked cleanup row should remove it from the checked set");
assert(app.includes("includeProjectArtifacts: false"), "default scan should skip slower project artifact digging");
assert(app.includes("maxDepth: 6"), "default scan should use a faster native depth");
assert(app.includes("maxEntriesPerRoot: 12000"), "default scan should use a smaller per-root entry cap");
assert(app.includes("DEFAULT_SCAN_REQUEST.maxDepth"), "native scan conversion should reuse the fast default depth");
assert(!app.includes("Check row"), "selected cleanup rows should not render a disabled check-row action");
assert(!app.includes("Cleanup status"), "sidebar should not duplicate the active cleanup status");
assert(!app.includes("cleanup available"), "top bar should not expose redundant runtime status copy");
assert(!app.includes("<Badge variant=\"safe\">ready</Badge>"), "ready-only cleanup rows should not repeat a ready badge on every row");
assert(!app.includes("StatusDot"), "sidebar navigation should not show extra status dots");
assert(app.includes("function selectWorkflowCandidate(id, options = {})"), "cleanup target selection should support checked handoff state");
assert(app.includes("setCheckedIds(checked ? [id] : [])"), "checked handoff should only check executable cleanup targets");
assert(app.includes("const [exploreConfirmIds, setExploreConfirmIds] = useState([])"), "Explore cleanup buttons should open a confirmation modal");
assert(app.includes("function CleanupConfirmModal"), "Explore cleanup should confirm before deleting from the PC");
assert(app.includes("function CleanupConfirmModal({ candidates = []"), "Explore cleanup modal should support selected rows from Explore");
assert(app.includes("executeExploreCleanupCandidates"), "Explore confirmation should execute through the guarded cleanup path");
assert(app.includes("onRequestSelectedCleanup"), "Explore list should support deleting multiple selected items");
assert(app.includes("selectedIds.includes(row.candidateId)"), "Explore cleanable rows should expose checkbox selection");
assert(app.includes("selected cleanable items"), "Explore delete confirmation should describe multi-select cleanup simply");
assert(app.includes("Only the selected cleanable items are deleted."), "Explore multi-delete confirmation should keep consequences simple");
assert(app.includes("runRealScan({ afterExecution: true, nextView: \"explore\" })"), "Explore cleanup should refresh and stay on Explore after deletion");
assert(!app.includes("async function executeSelectedCleanup"), "Clean screen should not carry a second per-row delete handler");
assert(!app.includes("onExecuteCandidate(row);"), "ready cleanup rows should use checkbox selection instead of per-row Delete buttons");
assert(!app.includes("onExecuteCandidate={"), "CleanPanel should expose one delete action for checked rows");
assert(app.includes("async function executeCheckedCleanups()"), "cleanup queue should execute multiple checked rows from one action");
assert(app.includes("const targets = checkedCandidates;"), "Delete selected should only run checked cleanup rows");
assert(app.includes("if (scanStatus === \"scanning\" || scanStatus === \"rescanning\") return;"), "Delete selected should not run while a scan refresh is in progress");
assert(app.includes("const actionDisabled = running || refreshing"), "Clean rows should share one disabled state while deleting or scanning");
assert(app.includes("disabled={actionDisabled}"), "Clean row selection should be disabled while deleting or scanning");
assert(app.includes("onExecuteChecked={executeCheckedCleanups}"), "Clean screen should wire the Delete selected action");
assert(app.includes("Delete selected"), "Clean screen should expose a simple Delete selected action");
assert(app.includes("Select all"), "Clean screen should expose a simple select-all action");
assert(app.includes("Choose items to delete"), "Clean screen should lead empty selection state with direct checkbox guidance");
assert(app.includes("Use the checkboxes, then click Delete selected."), "Clean screen should explain the checkbox-to-delete flow without internal details");
assert(app.includes("selected to delete"), "selected cleanup rows should use direct delete copy");
assert(!app.includes("will be cleaned"), "cleanup selection copy should avoid vague cleaned wording");
assert(!app.includes("Nothing selected"), "Clean action bar should avoid dead-end empty selection copy");
assert(app.includes("sticky top-16"), "Clean delete controls should stay reachable while scrolling long cleanup lists");
assert(app.includes("function setCheckedCleanupCandidates(rows = [])"), "Clean screen should support selecting all ready cleanup rows");
assert(app.includes("Some selected items cleaned"), "selected cleanup result should explain partial success simply");
assert(app.includes("Could not clean selected items"), "selected cleanup result should use selected-items failure copy");
assert(app.includes("formatCheckedCleanupMessage"), "checked cleanup result should use dedicated user-facing copy");
assert(app.includes("buildRejectedCheckedCleanupEntry"), "checked cleanup should keep going when one selected row cannot start");
assert(app.includes("app-dispatch-error"), "checked cleanup should record simple per-row failures");
assert(app.includes("Select items to delete"), "post-scan clean screen should lead with the actionable cleanup queue");
assert(!app.includes("{ id: \"history\""), "primary navigation should not include a separate activity page");
assert(!app.includes("function HistoryPanel"), "cleanup results should stay inline instead of moving to a separate Activity screen");
assert(/role="tablist"[\s\S]*grid-cols-3/.test(app), "mobile navigation should expose the simplified three-tab app");
assert(!app.includes("Scan details"), "Clean screen should not carry post-scan metrics or diagnostic details");
assert(!app.includes("items need review"), "Clean screen should not show a secondary review queue beside delete actions");
assert(app.includes("isOneClickCleanupCandidate"), "cleanup queue should use a shared one-click eligibility helper");
assert(app.includes("candidates.filter(isOneClickCleanupCandidate)"), "main cleanup queue should only show one-click cleanup rows");
assert(!app.includes("reviewCandidates"), "extra-input cleanup rows should stay out of the main Clean delete queue");
assert(app.includes("candidateId: isOneClickCleanupCandidate(candidate) ? candidate.id : \"\""), "Explore should only hand off ready cleanup rows to Clean");
assert(app.includes("Choose an archive folder before cleaning this item."), "Explore should keep archive rows out of the immediate delete path");
assert(app.includes("No items available to delete"), "cleanup queue should avoid preselecting blocked targets when nothing can run");
assert(app.includes("Run another scan or open Explore to inspect what was found."), "cleanup queue should route non-deletable findings to inspection without review jargon");
assert(/function selectDefaultCleanupCandidateId\(candidates = \[\]\) \{[\s\S]*return ""/.test(app), "cleanup scan should not auto-select a row before the user checks it");
assert(!app.includes("candidates.find((candidate) => candidate.executable)?.id"), "default cleanup selection should not choose blocked executable rows");
assert(!app.includes("Technical details"), "clean panel should not expose native diagnostics in the primary cleanup result");
assert(app.includes("formatAcceptedCleanupMessage"), "clean panel should format accepted cleanup outcomes with simple user copy");
assert(!app.includes("formatSignedBytes"), "app shell should not carry unused signed-byte formatting helpers");
assert(app.includes("Nothing to remove"), "accepted zero-byte cleanup should not be presented as cleaned space");
assert(app.includes("No eligible files were removed"), "accepted zero-byte cleanup should explain that nothing was eligible");
assert(!app.includes("Last cleanup result"), "activity screen should not duplicate the inline cleanup result");
assert(app.includes("formatCleanupRejectMessage"), "clean panel should translate native rejection details into plain user-facing copy");
assert(app.includes("Cleanup could not verify the current scan"), "cleanup rejection copy should tell users to scan again when confirmation evidence is stale");
assert(app.includes("setScanError(formatScanError(error))"), "scan failures should be converted to product-facing copy");
assert(app.includes("setAgentError(formatAgentError(error))"), "AI failures should be converted to product-facing copy");
assert(app.includes("formatBlockedCleanupDetail(candidate)"), "Explore blocked cleanup rows should not expose raw backend blocker text");
assert(app.includes("This item is not ready for one-click deletion"), "blocked cleanup rows should keep route and executor details out of the UI");
assert(!app.includes("Native scan failed"), "scan errors should not expose native implementation wording");
assert(!app.includes("OpenAI advisor failed"), "AI errors should not expose provider adapter wording");
assert(!app.includes("`Cleanup did not start. ${detail}`"), "cleanup start failures should not append raw backend exceptions");
assert(app.includes("cleanable"), "secondary screens should describe selectable cleanup items without internal readiness language");
assert(!app.includes("{suggestedAction.canAct ? \"ready\""), "AI recommendations should not show internal ready status copy");
assert(app.includes("Windows blocked some files because they are in use"), "cleanup rejection copy should explain locked-file retries without reject codes");
assert(!app.includes("Delete this selected item from this PC."), "normal cleanup should use the selected row checkbox as the confirmation");
assert(app.includes("effectivePermanentRemovalConfirmed"), "Recycle Bin cleanup should use the selected row checkbox as the permanent-removal confirmation");
assert(!app.includes("I understand this permanently empties Recycle Bin contents"), "Recycle Bin cleanup should not require a second confirmation checkbox");
assert(!app.includes("setPermanentRemovalConfirmed"), "Recycle Bin cleanup should not keep a second UI confirmation state");
assert(app.includes("workflowLocks"), "execution gate should receive workflow lock state from the shared cleanup policy");
assert(app.includes("activeScanGeneratedAt: scan?.generatedAt || \"\""), "execution gate should receive active scan timestamp for execution context");
assert(app.includes("executionRecord?.accepted"), "agent context key should track accepted native execution records");
assert(!app.includes("targetSwitchLocked"), "cleanup queue should not lock target switching behind proof export");
assert(!app.includes("routeSetupLocked"), "app shell should not carry route setup locks in the production flow");
assert(!app.includes("workflowProofAccepted"), "app shell should not track hidden proof verifier state");
assert(!app.includes("buildWorkflowProofCheck"), "app shell should not run proof verifier handoff inside the cleanup UI");
assert(!app.includes("workflowProofCheck"), "app shell should not carry workflow validation handoff state");
assert(!app.includes("Support check"), "app shell should not render internal workflow validation details");
assert(!app.includes("Support file exported"), "app shell should not report support export as part of cleanup");
assert(!app.includes("proofKind: \"workflow-proof-check\""), "app shell should not persist proof-check artifacts from the cleanup UI");
assert(!app.includes("proofKind: \"support-bundle\""), "app shell should not persist support-bundle artifacts from the cleanup UI");
assert(!app.includes("buildInAppSupportBundleReport"), "app shell should not build support bundles inside the cleanup UI");
assert(!app.includes("renderInAppSupportBundleMarkdown"), "app shell should not render support-bundle markdown inside the cleanup UI");
assert(realWorkflow.includes("no post-clean evidence is needed"), "accepted no-op executions should explain that post-clean rescan is skipped");
assert(!app.includes("supportBundleWritten"), "OpenAI app context should not require support-bundle handoff for cleanup continuation");
assert(app.includes("proofAllowsNextExecutor: workflowLocks.proofAllowsNextExecutor"), "OpenAI context should use the tested workflow lock policy for next-executor allowance");
assert(app.includes("noOpExecution: Boolean(workflowLocks.noOpExecution)"), "OpenAI context should expose accepted zero-byte no-op handoff state");
assert(app.includes("agentTaskQueue"), "OpenAI context should include the app task queue that the advisor instructions require");
assert(app.includes("manualReviewTargets"), "OpenAI context should include manual review targets");
assert(app.includes("visibleTargets"), "OpenAI panel should unlock for executable or manual review findings");
assert(app.includes("scan.driveInventory"), "manual findings should include native drive inventory evidence");
assert(app.includes("Drive inventory:"), "drive inventory rows should be visible as manual review cards");
assert(app.includes("slugifyId"), "drive inventory manual finding ids should be stable and normalized");
assert(app.includes("function ExplorePanel({"), "Explore scan button should share scan status with the rest of the app");
assert(app.includes("disabled={scanning}"), "Explore scan button should not launch another scan while one is running");
assert(app.includes("Visualize"), "Explore should expose a visual space view");
assert(app.includes("C: space map"), "Explore visualization should show a C: allocation map");
assert(app.includes("buildExploreVisualRows"), "Explore visualization should derive rows from scan inventory");
assert(app.includes("buildExploreAllocationBreakdown"), "Explore visualization should build a detailed drive allocation model");
assert(app.includes("Other used space"), "Explore visualization should account for remaining drive usage");
assert(app.includes("formatDriveInventoryDetail"), "Explore visualization should explain major drive allocation categories");
assert(app.includes("Full C: breakdown"), "Explore visualization should show a full measured C: allocation list");
assert(app.includes("Mapped from C:"), "Explore visualization should show how much used space is itemized");
assert(app.includes("Not itemized"), "Explore visualization should label space that Windows reports but the scanner cannot assign");
assert(app.includes("NTFS metadata"), "Other used space should explain low-level Windows storage contributors");
assert(app.includes("formatAllocationKindLabel"), "Explore breakdown rows should label system, user, review, and cleanable categories");
assert(app.includes("formatCount(row.files)"), "Explore breakdown rows should show file and folder counts when available");
assert(app.includes("Some of it can become removable"), "Other used space should explain possible future cleanup without implying unsafe deletion");
assert(app.includes("Show delete list"), "Explore visualization should lead users to actionable cleanup rows");
assert(app.includes("can be deleted"), "Explore visualization should summarize cleanable space");
assert(app.includes("onShowList={() => setMode(\"list\")}"), "Explore visualization should switch directly to the delete list");
assert(app.includes("onRunScan={() => runRealScan({ nextView: \"explore\" })}"), "Explore scan refresh should stay on Explore");
assert(!app.includes("selected-route-proof-reviewed"), "app shell should not require selected-route proof review before more cleanup");
assert(!app.includes("selected-route-proof-import"), "app workflow proof should not require obsolete selected-route proof import");
assert(!app.includes("Export proof, let the in-app verifier accept it, and capture the support bundle before selecting another cleanup target."), "cleanup queue should not describe proof export as a target-switch lock");
assert(!app.includes("disabled={targetSwitchLocked && candidate.id !== selectedId}"), "cleanup queue should not disable other targets behind proof export");
assert(!app.includes("disabled={routeSetupLocked && route.routeInput !== selectedRouteInput}"), "route setup locks should not exist in the app shell");
assert(!app.includes("Current route is locked until proof export and support bundle capture finish."), "route setup proof lock copy should not render in the app shell");
assert(!app.includes("I reviewed the refreshed scan."), "support export should not require a manual proof-review checkbox");
assert(!app.includes("Export troubleshooting bundle"), "support export should use product-facing support file copy");
assert(!app.includes("Export support file"), "normal Activity UI should not expose support export controls");
assert(!app.includes("SupportDetails"), "normal Activity UI should not render a support diagnostics component");
assert(!app.includes("Refresh space before exporting troubleshooting info."), "support export should not expose troubleshooting proof copy");
assert(!app.includes("Support details"), "support export should not expose a nested diagnostic details panel");
assert(app.includes("buildProofCandidateFromExecutionRecord"), "post-clean comparison should preserve executed target context after the selected row clears");
assert(app.includes("recipeId: candidateForExecution.recipeId"), "execution records should preserve recipe id for post-run proof matching");
assert(app.includes("envVar: candidateForExecution.envVar"), "execution records should preserve selected route flag for native ledger context");
assert(!app.includes("const exportCandidate = selectedCandidate || proofCandidate"), "app shell should not carry a hidden proof export candidate");
assert(!app.includes("if (!selectedCandidate || !executionRecord) return;"), "app shell should not carry the old proof export guard");
assert(!app.includes("setScan(baselinePromotion.activeScan)"), "app shell should not wait for proof export before promoting the refreshed scan");
assert(!app.includes("Latest scan is now active."), "app shell should not show support-export baseline promotion copy");
assert(!app.includes("npm run validate:workflow-proof -- --file spaceguard-real-workflow-proof.md returned accepted"), "proof panel should not rely on a manual CLI acceptance checkbox");
assert(
  /function selectWorkflowCandidate\(id, options = \{\}\) \{[\s\S]*setSelectedId\(id\);[\s\S]*setExecutionResult\(null\);[\s\S]*setExecutionRecord\(null\);[\s\S]*setPostRunScan\(null\);[\s\S]*setExecutionStatus\("idle"\);[\s\S]*setExecutionError\(""\);[\s\S]*\}/.test(app),
  "selecting a different cleanup target should clear stale execution and rescan state"
);
assert(
  /if \(afterExecution\) \{[\s\S]*setScan\(result\);[\s\S]*setPostRunScan\(result\);[\s\S]*setSelectedId\(""\);[\s\S]*setConsentChecked\(false\);[\s\S]*setArchiveDestination\(""\);[\s\S]*\}/.test(app),
  "post-clean rescan should update the normal cleanup list and clear stale selection state"
);
assert(/if \(rescanAfter && result\.accepted\) \{[\s\S]*await runRealScan\(\{ afterExecution: true \}\);[\s\S]*\}/.test(app), "accepted cleanup should refresh the list automatically");
assert(app.includes("buildManualFindingGuidance"), "app should use tested manual finding guidance");
assert(!app.includes("buildManualFindingReviewRows"), "app shell should not carry nested manual review rows");
assert(!app.includes("function ManualReviewPanel"), "app shell should not carry an unused manual review panel");
assert(app.includes("\"windows-old\": \"Previous Windows installation\""), "Explore should surface Windows.old findings");
assert(app.includes("hibernation: \"Hibernation file\""), "Explore should surface hibernation file findings");
assert(app.includes("pagefile: \"Pagefile\""), "Explore should surface pagefile findings");
assert(app.includes("\"wsl-vhdx\": \"WSL virtual disk\""), "Explore should surface WSL virtual disk findings");
assert(app.includes("can delete"), "Explore should use product-facing delete labels");
assert(app.includes("inspect"), "Explore should use product-facing inspection labels");
assert(app.includes("Delete this item?"), "Explore delete action should ask for modal confirmation");
assert(app.includes("variant=\"destructive\" onClick={() => onRequestCleanup(row.candidateId)}"), "Explore cleanable rows should expose a direct Delete action");
assert(app.includes("label: \"Downloads cleanup\""), "Downloads cleanup should use direct product wording");
assert(app.includes("label: \"Project dependency cleanup\""), "project dependency cleanup should use direct product wording");
assert(!app.includes("Reviewed Downloads cleanup"), "Explore should not expose reviewed-downloads fallback copy");
assert(!app.includes("Reviewed project dependency cleanup"), "Explore should not expose reviewed-dependency fallback copy");
assert(app.includes("Inspect this area before removing anything."), "manual fallback guidance should use inspect wording");
assert(app.includes("manualFindings.map"), "Explore should render manual findings in the same allocation list");
assert(app.includes("finding.manualGuidance?.primaryAction"), "Explore should show simple manual guidance without an extra panel");
assert(app.includes("formatManualFindingNote"), "manual findings should convert internal notes into plain copy");
assert(!app.includes("manualGuidance.command"), "manual findings should not render command snippets");
assert(!app.includes("Review details"), "manual findings should not expose a nested diagnostic details panel");
assert(!app.includes("Signals"), "manual findings should not render candidate usage signals as user-facing UI");
assert(!app.includes("Why review only"), "manual findings should not expose internal guardrail details");
assert(!app.includes("Selected .env block"), "app shell should not ask users to copy route-specific env blocks");
assert(!app.includes("copyEnvBlock"), "app shell should not expose route setup copy actions");
assert(!app.includes("navigator.clipboard.writeText(checklist.envBlock.content)"), "app shell should not copy route setup env content");
assert(!app.includes("Windows test runbook"), "app shell should not render the legacy route test runbook");
assert(!app.includes("copyRunbook"), "app shell should not expose route runbook copy actions");
assert(!app.includes("navigator.clipboard.writeText(checklist.runbook.content)"), "app shell should not copy route setup runbooks");
assert(!app.includes("npm run openai:smoke -- --local-contract --route"), "app shell should not show route-contract smoke setup steps");
assert(app.includes("function ConnectionRequired({ runtime, runtimeStatus, runtimeError, onRefresh })"), "browser-only setup state should accept only runtime status and refresh props");
assert(app.includes("This browser page cannot scan or delete files."), "browser-only setup state should explicitly avoid bundled cleanup data");
assert(app.includes("The cleanup tools are available only inside the Windows desktop app."), "browser-only setup state should explain that real execution requires the desktop app");
assert(/if \(!nativeConnected\) \{[\s\S]*return \(\s*<AppFrame[\s\S]*<ConnectionRequired/.test(app), "browser-only setup state should keep the pinned sidebar while rendering non-executable setup content");
assert(!app.includes("Developer launch"), "browser-only setup state should not expose developer command boxes in the production UI");
assert(!app.includes("npm run native:dev"), "browser-only setup state should not show terminal launch commands");
assert(!app.includes("npm run windows:ready"), "browser-only setup state should not show setup command boxes");
assert(app.includes("Safe cleanup areas"), "browser-only setup should describe the simplified cleanup flow");
assert(!app.includes("Activity summary"), "browser-only setup should not advertise a diagnostic activity area as a cleanup target");
assert(!app.includes("Desktop connection"), "browser-only setup should not expose runtime diagnostics as a product panel");
assert(!app.includes("Native bridge"), "browser-only setup should not expose internal bridge metrics");
assert(!/<RouteSetupPanel\s+routes=\{routes\}/.test(app), "browser-only setup state should not render the route setup wizard");
assert(app.includes("spaceguard-openai-agent-context/v1"), "OpenAI context should keep a stable schema");
assert(!app.includes("Recommendation diagnostics"), "OpenAI panel should not expose deterministic broker diagnostics");
assert(app.includes("agentBroker?.rows"), "OpenAI panel should still read broker rows to choose the best recommendation");
assert(app.includes("Open Explore to inspect this item."), "OpenAI panel should show simple inspection guidance for blocked recommendations");
assert(!app.includes("suggestedAction.blockedReason"), "OpenAI panel should not expose internal broker blocker text");
assert(!app.includes("Why this recommendation"), "OpenAI panel should not expose recommendation diagnostic details");
assert(!app.includes("Current selection:"), "OpenAI panel should not repeat cleanup selection status");
assert(/resolveWorkflowAgentBrokerCandidate\(row, candidates\)[\s\S]*selectWorkflowCandidate\(brokerCandidate\.id, \{[\s\S]*checked: row\.kind === "scoped-executor" && isOneClickCleanupCandidate\(brokerCandidate\)/.test(app), "OpenAI cleanup recommendations should check one-click cleanup rows before returning to Clean");
assert(app.includes("runAgentBrokerAction"), "OpenAI broker recommendations should route through guarded app actions");
assert(app.includes("resolveWorkflowAgentBrokerCandidate"), "OpenAI broker actions should resolve model target ids to real cleanup candidates");
assert(app.includes("onBrokerAction(suggestedAction)"), "OpenAI panel should expose a user-clicked broker action button");
assert(app.includes("formatAgentButtonLabel(suggestedAction)"), "OpenAI broker action button should use simple user-facing labels");
assert(app.includes("redactPath"), "OpenAI context should redact local paths before provider calls");
assert(app.includes("This browser page cannot scan or delete files."), "browser-only state should be setup-only");
assert(!app.includes("Native proof artifact writer is required"), "cleanup UI should not expose proof artifact writer failures");
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
assert(readme.includes("Select one or more cleanup rows."), "README should match the current cleanup row label");
assert(readme.includes("Click `Delete selected`"), "README should match the current cleanup button label");
assert(!readme.includes("marked `ready`"), "README should not mention removed ready row labels");
assert(!readme.includes("can clean"), "README should not mention obsolete cleanup row labels");
assert(!readme.includes("Delete selected files"), "README should not mention obsolete cleanup button labels");
assert(!readme.includes("npm run validate:workflow-proof -- --file"), "README should not put proof verification in the normal cleanup path");
assert(!readme.includes("spaceguard-workflow-proof-check.json"), "README should not list proof artifact files in the normal cleanup path");
assert(!readme.includes("npm run support:bundle"), "README should not require support bundle capture for normal cleanup");
assert(readme.includes("Support export tools are for troubleshooting only"), "README should keep support export clearly optional");
assert(realDataGuide.includes("npm run native:dev"), "Windows setup guide should document the Tauri Windows desktop launcher");
assert(realDataGuide.indexOf("npm run windows:ready") < realDataGuide.indexOf("npm run native:dev"), "Windows setup guide should check readiness before launch");
assert(realDataGuide.includes("Cleanup does not require route arming"), "Windows setup guide should explain built-in allowlists");
assert(realDataGuide.includes("Select one or more cleanup rows."), "Windows setup guide should match the current cleanup row label");
assert(realDataGuide.includes("Click `Delete selected`"), "Windows setup guide should match the current cleanup button label");
assert(!realDataGuide.includes("marked `ready`"), "Windows setup guide should not mention removed ready row labels");
assert(!realDataGuide.includes("can clean"), "Windows setup guide should not mention obsolete cleanup row labels");
assert(!realDataGuide.includes("Delete selected files"), "Windows setup guide should not mention obsolete cleanup button labels");
assert(realDataGuide.includes("OPENAI_API_KEY"), "Windows setup guide should document OpenAI key setup");
assert(!realDataGuide.includes("npm run validate:workflow-proof -- --file"), "Windows setup guide should not put proof verification in the normal cleanup path");
assert(!realDataGuide.includes("spaceguard-workflow-proof-check.json"), "Windows setup guide should not list proof artifact files in the normal cleanup path");
assert(!realDataGuide.includes("npm run support:bundle"), "Windows setup guide should not require support bundle capture for normal cleanup");
assert(realDataGuide.includes("Support export is only for troubleshooting"), "Windows setup guide should keep support export clearly optional");
assert(windowsReadinessScript.includes("select one or more cleanup rows"), "Windows readiness next steps should match the simplified cleanup flow");
assert(!/can clean|delete confirmation|delete selected files|refresh space/i.test(windowsReadinessScript), "Windows readiness next steps should not mention obsolete cleanup UI labels");

console.log("static app ok");
