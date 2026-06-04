const assert = require("assert");

(async () => {
  const guard = await import("../src/spaceguard-model.mjs");

  function makeReviewApprovals(actionList, protectedPaths = []) {
    const base = { groupConfirm: true, reviewed: {}, reviewItems: {}, typed: {} };
    const reviews = guard.buildReviewItemsByAction(actionList, null, protectedPaths, base);
    const reviewItems = {};
    for (const [actionId, review] of Object.entries(reviews)) {
      reviewItems[actionId] = Object.fromEntries(
        review.items
          .filter((item) => !item.protected)
          .map((item) => [item.id, item.recommendation === "review" ? "remove" : "keep"])
      );
    }
    return { ...base, reviewItems };
  }

  const selected = new Set(guard.actions.filter(guard.selectedByDefault).map((action) => action.id));
  const totals = guard.computeTotals(selected);

  assert(totals.selectedBytes > 0, "default plan should recover some space");
  assert(
    guard.actions.filter((action) => action.gate === "blocked").every((action) => !guard.selectableAction(action)),
    "blocked actions must not be selectable"
  );
  assert(
    !guard.buildSuggestedPlan(90 * guard.GB, new Set()).has("docker-volumes"),
    "suggested plan must not include Docker volumes"
  );
  assert(
    !guard.buildSuggestedPlan(90 * guard.GB, new Set()).has("pagefile"),
    "suggested plan must not include pagefile changes"
  );

  const wslOnly = new Set(["wsl-vhdx"]);
  assert.strictEqual(
    guard.getExecutionReadiness(wslOnly, { groupConfirm: true, reviewed: {}, typed: {} }).ready,
    false,
    "typed advanced actions need exact phrase"
  );
  assert.strictEqual(
    guard.getExecutionReadiness(wslOnly, { groupConfirm: true, reviewed: {}, typed: { "wsl-vhdx": "COMPACT WSL" } }).ready,
    true,
    "typed advanced action should unlock with exact phrase"
  );

  const reviewOnly = new Set(["downloads-installers"]);
  assert.strictEqual(
    guard.getExecutionReadiness(reviewOnly, { groupConfirm: true, reviewed: {}, typed: {} }).ready,
    false,
    "review actions need item review approval"
  );
  assert.strictEqual(
    guard.getExecutionReadiness(reviewOnly, { groupConfirm: true, reviewed: { "downloads-installers": true }, reviewItems: {}, typed: {} }).ready,
    false,
    "broad review approval must not unlock item-level review actions"
  );
  const downloadsItemApprovals = makeReviewApprovals(guard.actions);
  const downloadsItemReviews = guard.buildReviewItemsByAction(guard.actions, null, [], downloadsItemApprovals);
  assert.strictEqual(
    guard.getExecutionReadinessForActions(reviewOnly, downloadsItemApprovals, guard.actions, [], downloadsItemReviews).ready,
    true,
    "review action should unlock only after explicit item decisions"
  );
  const largeFileOnly = new Set(["large-user-files"]);
  assert.strictEqual(
    guard.getExecutionReadiness(largeFileOnly, { groupConfirm: true, reviewed: { "large-user-files": true }, reviewItems: {}, typed: {} }).ready,
    false,
    "large personal files must not unlock from broad review approval"
  );
  const largeFileReview = guard.buildItemReview("large-user-files", guard.actions, null, []);
  assert.strictEqual(largeFileReview.source, "demo-review", "large file review should expose demo discovery candidates");
  assert(largeFileReview.items.some((item) => item.recommendation === "keep"), "large file review should preserve keep recommendations");
  assert(largeFileReview.items.some((item) => item.recommendation === "review"), "large file review should preserve review recommendations");
  assert.strictEqual(largeFileReview.undecidedCount, largeFileReview.items.length, "large files should start undecided");
  const largeFileArchiveApprovals = {
    groupConfirm: true,
    reviewed: {},
    reviewItems: {
      "large-user-files": Object.fromEntries(
        largeFileReview.items
          .filter((item) => !item.protected)
          .map((item) => [item.id, item.recommendation === "review" ? "archive" : "keep"])
      )
    },
    typed: {}
  };
  const largeFileArchiveReviews = guard.buildReviewItemsByAction(guard.actions, null, [], largeFileArchiveApprovals);
  assert.strictEqual(largeFileArchiveReviews["large-user-files"].removeBytes, 0, "archive decisions must not count as executor removal bytes");
  assert(largeFileArchiveReviews["large-user-files"].manualDispositionBytes > 0, "archive decisions should be tracked as manual recovery bytes");
  assert.strictEqual(
    guard.getExecutionReadinessForActions(largeFileOnly, largeFileArchiveApprovals, guard.actions, [], largeFileArchiveReviews).ready,
    true,
    "move/archive/keep decisions should resolve item review without requiring deletion"
  );
  const largeFileArchiveExecutorPlan = guard.buildExecutorPlan({
    selectedIds: largeFileOnly,
    actionList: guard.actions,
    approvals: largeFileArchiveApprovals,
    protectedPaths: [],
    scanMode: "demo",
    itemReviewsByAction: largeFileArchiveReviews
  });
  assert.strictEqual(largeFileArchiveExecutorPlan.dryRunBytes, 0, "manual move/archive review should not create dry-run executor bytes");
  assert.strictEqual(largeFileArchiveExecutorPlan.dryRunCount, 0, "manual move/archive review should not create runnable executor routes");
  assert.strictEqual(
    guard.getExecutionReadinessForActions(largeFileOnly, downloadsItemApprovals, guard.actions, [], downloadsItemReviews).ready,
    true,
    "large personal files should unlock only after explicit item decisions"
  );

  const ledger = guard.makeExecutionLedger(new Set(["windows-temp", "browser-identity"]));
  assert.strictEqual(ledger.find((entry) => entry.id === "browser-identity").bytes, 0, "non-executable demo action must reclaim 0 bytes");

  const developerActions = guard.buildScenarioActions("developer");
  const protectedPaths = ["C:\\Users\\demo\\Code"];
  const nodeModules = developerActions.find((action) => action.id === "node-modules-old");
  assert(guard.isActionProtected(nodeModules, protectedPaths), "protected paths should match action paths");
  assert.strictEqual(
    guard.selectableAction(nodeModules, protectedPaths),
    false,
    "protected matching action must not be selectable"
  );
  assert(
    !guard.buildSuggestedPlan(90 * guard.GB, new Set(), developerActions, protectedPaths).has("node-modules-old"),
    "suggested plan must not include user-protected paths"
  );

  const protectedReadiness = guard.getExecutionReadinessForActions(
    new Set(["node-modules-old"]),
    { groupConfirm: true, reviewed: { "node-modules-old": true }, typed: {} },
    developerActions,
    protectedPaths
  );
  assert.strictEqual(protectedReadiness.ready, false, "protected selected action should block readiness");
  assert.strictEqual(protectedReadiness.unresolved[0].gate, "protected", "protected gate should be explicit");

  const report = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: developerActions,
    selectedIds: new Set(["windows-temp"]),
    readiness: guard.getExecutionReadinessForActions(new Set(["windows-temp"]), { groupConfirm: true, reviewed: {}, typed: {} }, developerActions, protectedPaths),
    ledger: guard.makeExecutionLedgerForActions(new Set(["windows-temp"]), developerActions, protectedPaths),
    protectedPaths,
    goalBytes: 10 * guard.GB
  });
  assert(report.includes("SpaceGuard Dry-Run Report"), "report should have a title");
  assert(report.includes("Protected Paths"), "report should include protected paths");

  const demoCoverage = guard.buildScanCoverageSummary({
    actionList: developerActions,
    scanMode: "demo",
    nativeScan: null
  });
  assert.strictEqual(demoCoverage.status, "demo-only", "demo scan coverage should not claim native evidence");
  assert.strictEqual(demoCoverage.confidenceScore, 0, "demo estimates should not count as coverage confidence");
  assert(demoCoverage.steps.some((step) => step.includes("native read-only scan")), "demo coverage should direct user to native scanning");
  const coverageReport = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: developerActions,
    selectedIds: new Set(["windows-temp"]),
    readiness: guard.getExecutionReadinessForActions(new Set(["windows-temp"]), { groupConfirm: true, reviewed: {}, typed: {} }, developerActions, protectedPaths),
    ledger: [],
    protectedPaths,
    goalBytes: 10 * guard.GB,
    scanCoverage: demoCoverage,
    scanSettings: {
      includeProjectArtifacts: false,
      maxDepth: 4,
      maxEntriesPerRoot: 5000
    }
  });
  assert(coverageReport.includes("## Scan Coverage"), "report should include scan coverage");
  assert(coverageReport.includes("Confidence: 0%"), "report should include scan confidence");
  assert(coverageReport.includes("## Scan Settings"), "report should include scan settings");
  assert(coverageReport.includes("Project artifacts: excluded"), "report should preserve project artifact scan setting");

  const demoPrivacyBoundary = guard.buildPrivacyBoundary({
    scanMode: "demo",
    nativeScan: null,
    runHistory: [],
    validationEvidence: {},
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(demoPrivacyBoundary.schemaVersion, "spaceguard-privacy-boundary/v1", "privacy boundary should expose a schema version");
  assert.strictEqual(demoPrivacyBoundary.status, "demo-local-only", "demo privacy boundary should be local-only");
  assert.strictEqual(demoPrivacyBoundary.cloudDisabled, true, "privacy boundary should keep cloud upload disabled");
  assert.strictEqual(demoPrivacyBoundary.telemetryDisabled, true, "privacy boundary should keep telemetry disabled");
  assert(demoPrivacyBoundary.blockedCollections.includes("Saved logins"), "privacy boundary should list blocked sensitive data classes");
  const nativePrivacyBoundary = guard.buildPrivacyBoundary({
    scanMode: "native-readonly",
    nativeScan: {
      available: true,
      destructiveCommands: false,
      findings: [
        {
          recipeId: "downloads-installers",
          title: "Downloads",
          path: "C:\\Users\\demo\\Downloads",
          status: "measured",
          items: [{ id: "installer", path: "C:\\Users\\demo\\Downloads\\tool.exe" }]
        }
      ],
      warnings: []
    },
    runHistory: [{ id: "run-one" }],
    validationEvidence: { "windows-native-build": "passed" },
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(nativePrivacyBoundary.status, "native-local-only", "native privacy boundary should remain local-only");
  assert.strictEqual(nativePrivacyBoundary.pathEvidencePresent, true, "native privacy boundary should flag local path evidence");
  assert(nativePrivacyBoundary.warnings.some((warning) => warning.includes("local paths")), "native privacy boundary should warn before sharing path-containing exports");
  const privacyReport = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: developerActions,
    selectedIds: new Set(["windows-temp"]),
    readiness: guard.getExecutionReadinessForActions(new Set(["windows-temp"]), { groupConfirm: true, reviewed: {}, typed: {} }, developerActions, protectedPaths),
    ledger: [],
    protectedPaths,
    goalBytes: 10 * guard.GB,
    privacyBoundary: nativePrivacyBoundary
  });
  assert(privacyReport.includes("## Privacy Boundary"), "report should include privacy boundary");
  assert(privacyReport.includes("Cloud disabled: yes"), "report should include cloud boundary");
  const demoPublicReadiness = guard.buildPublicBetaReadiness({
    scanMode: "demo",
    nativeCapability: { available: false },
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false },
    privacyBoundary: demoPrivacyBoundary,
    releaseGate: guard.buildReleaseGate({ scanMode: "demo", nativeCapability: { available: false }, executorPlan: null }),
    documentationEvidence: { publicReleaseResearch: true, windowsRealDataSetup: true }
  });
  assert.strictEqual(demoPublicReadiness.schemaVersion, "spaceguard-public-beta-readiness/v1", "public beta readiness should expose a schema version");
  assert.strictEqual(demoPublicReadiness.readyForWebDemo, true, "demo with locked writes and local privacy should be publishable as web demo");
  assert.strictEqual(demoPublicReadiness.readyForNativeBeta, false, "demo should not claim native beta readiness");
  assert(demoPublicReadiness.waitingRows.some((row) => row.id === "native-readonly-beta"), "native beta should wait on native scan evidence");
  const nativePublicReadiness = guard.buildPublicBetaReadiness({
    scanMode: "native-readonly",
    nativeCapability: { available: true },
    runtimeCapabilities: {
      realRunEnabled: false,
      destructiveCommands: false,
      scanKnownRoots: true
    },
    privacyBoundary: nativePrivacyBoundary,
    releaseGate: guard.buildReleaseGate({
      validationEvidence: { "signing-and-smartscreen": "passed" },
      scanMode: "native-readonly",
      nativeCapability: { available: true },
      executorPlan: null
    }),
    validationEvidence: { "signing-and-smartscreen": "passed" },
    documentationEvidence: { publicReleaseResearch: true, windowsRealDataSetup: true }
  });
  assert.strictEqual(nativePublicReadiness.readyForNativeBeta, true, "native beta should pass when scan, privacy, docs, and signing/support evidence exist");
  assert.strictEqual(nativePublicReadiness.realRunEnabled, false, "native beta readiness should not imply real cleanup");
  const publicReadinessReport = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: developerActions,
    selectedIds: new Set(["windows-temp"]),
    readiness: guard.getExecutionReadinessForActions(new Set(["windows-temp"]), { groupConfirm: true, reviewed: {}, typed: {} }, developerActions, protectedPaths),
    ledger: [],
    protectedPaths,
    goalBytes: 10 * guard.GB,
    publicBetaReadiness: demoPublicReadiness
  });
  assert(publicReadinessReport.includes("## Public Beta Readiness"), "report should include public beta readiness");
  assert(publicReadinessReport.includes("Web demo ready: yes"), "public beta report should distinguish web demo readiness");
  const supportBundle = guard.buildSupportBundle({
    profile: guard.getScenario("developer").profile,
    scanMode: "native-readonly",
    scanSettings: { includeProjectArtifacts: true, maxDepth: 8, maxEntriesPerRoot: 25000 },
    nativeScan: {
      available: true,
      platform: "windows",
      windows: true,
      totalBytes: 512 * guard.MB,
      findings: [
        {
          recipeId: "downloads-installers",
          title: "Downloads",
          path: "C:\\Users\\demo\\Downloads",
          bytes: 512 * guard.MB,
          status: "measured",
          files: 1,
          dirs: 0,
          errors: 0,
          items: [{ id: "installer", name: "secret-client-tool.exe", path: "C:\\Users\\demo\\Downloads\\secret-client-tool.exe", bytes: 512 * guard.MB }]
        }
      ],
      warnings: ["sample warning"],
      writeCapability: false,
      destructiveCommands: false
    },
    privacyBoundary: nativePrivacyBoundary,
    publicBetaReadiness: demoPublicReadiness,
    releaseGate: guard.buildReleaseGate({ scanMode: "demo", nativeCapability: { available: false }, executorPlan: null }),
    runtimeCapabilities: { realRunEnabled: false, destructiveCommands: false, platform: "windows" },
    executorPlan: null,
    rollbackPlan: null
  });
  assert.strictEqual(supportBundle.schemaVersion, "spaceguard-support-bundle/v1", "support bundle should expose a schema version");
  assert.strictEqual(supportBundle.redactedPaths, true, "support bundle should be path-redacted by default");
  const supportJson = JSON.stringify(supportBundle);
  const supportMarkdown = guard.buildSupportBundleMarkdown(supportBundle);
  assert(!supportJson.includes("C:\\Users"), "support bundle JSON should not include local paths");
  assert(!supportJson.includes("secret-client-tool.exe"), "support bundle JSON should not include filenames");
  assert(!supportMarkdown.includes("C:\\Users"), "support bundle markdown should not include local paths");
  assert(supportMarkdown.includes("SpaceGuard Support Bundle"), "support bundle markdown should have a title");
  assert(supportMarkdown.includes("Redacted paths: yes"), "support bundle markdown should disclose redaction");

  const review = guard.buildPlanReview(
    developerActions,
    new Set(["gradle-cache", "node-modules-old", "wsl-vhdx"]),
    { groupConfirm: false, reviewed: { "node-modules-old": true }, typed: {} },
    protectedPaths
  );
  assert(review.pending.some((row) => row.id === "gradle-cache"), "review queue should show rebuildable cache approval as pending");
  assert(review.pending.some((row) => row.id === "wsl-vhdx"), "review queue should show typed gate as pending");
  assert(review.protected.some((row) => row.id === "node-modules-old"), "review queue should show protected paths separately");
  assert(review.blocked.some((row) => row.id === "docker-volumes"), "review queue should keep policy-blocked actions visible");

  const scanFirstAdvisor = guard.buildRecoveryAdvisor({
    scanned: false,
    goalBytes: 25 * guard.GB,
    actionList: developerActions,
    selectedIds: new Set(),
    protectedPaths: []
  });
  assert.strictEqual(scanFirstAdvisor.status, "scan-first", "advisor should require scan before planning");

  const gatedAdvisor = guard.buildRecoveryAdvisor({
    scanned: true,
    goalBytes: 20 * guard.GB,
    actionList: developerActions,
    selectedIds: new Set(["gradle-cache"]),
    approvals: { groupConfirm: false, reviewed: {}, typed: {} },
    protectedPaths: []
  });
  assert.strictEqual(gatedAdvisor.status, "needs-approval", "advisor should surface unresolved gates before expansion");
  assert(gatedAdvisor.steps[0].includes("Approve"), "advisor should provide gate-specific next step");

  const normalSelection = new Set(
    developerActions
      .filter((action) => guard.selectableAction(action) && action.gate !== "typed")
      .map((action) => action.id)
  );
  const normalApprovals = makeReviewApprovals(developerActions);
  const normalReviewItems = guard.buildReviewItemsByAction(developerActions, null, [], normalApprovals);
  const normalBytes = guard.computeTotals(normalSelection, developerActions, {
    approvals: normalApprovals,
    itemReviewsByAction: normalReviewItems
  }).selectedBytes;
  const advancedAdvisor = guard.buildRecoveryAdvisor({
    scanned: true,
    goalBytes: normalBytes + guard.GB,
    actionList: developerActions,
    selectedIds: normalSelection,
    approvals: normalApprovals,
    protectedPaths: [],
    itemReviewsByAction: normalReviewItems
  });
  assert.strictEqual(advancedAdvisor.status, "advanced-options", "advisor should separate typed system options from normal expansion");

  const strategyApprovals = {
    ...makeReviewApprovals(developerActions),
    typed: { "wsl-vhdx": "COMPACT WSL", hibernation: "DISABLE HIBERNATION" }
  };
  const strategyReviewItems = guard.buildReviewItemsByAction(developerActions, null, [], strategyApprovals);
  const strategySelection = guard.buildSuggestedPlan(500 * guard.GB, new Set(), developerActions, []);
  const strategyAdvisor = guard.buildRecoveryAdvisor({
    scanned: true,
    goalBytes: 500 * guard.GB,
    actionList: developerActions,
    selectedIds: strategySelection,
    approvals: strategyApprovals,
    protectedPaths: [],
    itemReviewsByAction: strategyReviewItems
  });
  assert.strictEqual(strategyAdvisor.status, "strategy-needed", "advisor should move to strategy when cleanup cannot meet target");
  const storageStrategy = guard.buildStorageStrategyPlan({
    scanned: true,
    profile: guard.getScenario("developer").profile,
    advisor: strategyAdvisor,
    actionList: developerActions,
    selectedIds: strategySelection,
    approvals: strategyApprovals,
    itemReviewsByAction: strategyReviewItems,
    goalBytes: 500 * guard.GB
  });
  assert.strictEqual(storageStrategy.status, "manual-strategy", "storage strategy should activate when cleanup cannot hit the target");
  assert.strictEqual(storageStrategy.manualOnly, true, "storage strategies must be manual-only");
  assert(storageStrategy.options.some((option) => option.id === "uninstall-apps-manually"), "storage strategy should include manual installed-app review");
  assert(storageStrategy.options.some((option) => option.id === "partition-or-drive-plan"), "storage strategy should include backup-first partition guidance");
  assert(storageStrategy.options.every((option) => option.automation === "manual"), "storage strategy options must not create automation routes");
  const manualChecklist = guard.buildManualStrategyChecklist({ storageStrategy });
  assert.strictEqual(manualChecklist.schemaVersion, "spaceguard-manual-strategy-checklist/v1", "manual strategy checklist should have a schema version");
  assert.strictEqual(manualChecklist.manualOnly, true, "manual strategy checklist must remain manual-only");
  assert.strictEqual(manualChecklist.status, "manual-work-open", "manual strategy should start with waiting evidence");
  assert(manualChecklist.checks.some((check) => check.id === "partition-or-drive-plan:full-backup"), "partition strategy should require full backup evidence");
  assert(manualChecklist.checks.some((check) => check.id === "uninstall-apps-manually:no-automated-uninstall"), "installed app strategy should block automated uninstall");
  const completedManualEvidence = Object.fromEntries(manualChecklist.checks.filter((check) => check.required).map((check) => [check.id, "done"]));
  const completedManualChecklist = guard.buildManualStrategyChecklist({ storageStrategy, evidence: completedManualEvidence });
  assert.strictEqual(completedManualChecklist.status, "manual-plan-documented", "manual checklist should complete only when required evidence is marked");
  const strategyReport = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: developerActions,
    selectedIds: strategySelection,
    approvals: strategyApprovals,
    readiness: guard.getExecutionReadinessForActions(strategySelection, strategyApprovals, developerActions, [], strategyReviewItems),
    ledger: [],
    protectedPaths: [],
    goalBytes: 500 * guard.GB,
    advisor: strategyAdvisor,
    storageStrategy,
    manualStrategyChecklist: manualChecklist,
    itemReviewsByAction: strategyReviewItems
  });
  assert(strategyReport.includes("## Storage Strategy"), "dry-run report should include storage strategy");
  assert(strategyReport.includes("No automated partition writes"), "storage strategy report should include partition guardrails");
  assert(strategyReport.includes("## Manual Strategy Checklist"), "dry-run report should include manual strategy checklist");
  assert(strategyReport.includes("Manual only: yes"), "manual strategy report should keep manual boundary visible");

  const decisionLog = guard.buildDecisionLog({
    scanned: true,
    scanMode: "native-readonly",
    actionList: developerActions,
    selectedIds: new Set(["windows-temp"]),
    goalBytes: 10 * guard.GB,
    protectedPaths
  });
  assert(decisionLog.some((entry) => entry.id === "source" && entry.status === "real-readonly"), "decision log should record native read-only data source");

  const workbench = guard.buildReviewWorkbench(
    developerActions,
    new Set(["gradle-cache", "node-modules-old"]),
    { groupConfirm: false, reviewed: {}, typed: {} },
    protectedPaths
  );
  assert(workbench.needsDecision.some((row) => row.id === "gradle-cache"), "workbench should show unresolved selected gates");
  assert(workbench.protected.some((row) => row.id === "node-modules-old"), "workbench should separate protected paths");

  const demoItemReview = guard.buildItemReview("node-modules-old", developerActions, null, protectedPaths);
  assert.strictEqual(demoItemReview.source, "demo-review", "item review should fall back to demo candidates");
  assert(demoItemReview.items.some((item) => item.protected), "item review should mark protected child paths");
  assert(demoItemReview.protectedBytes > 0, "item review should total protected bytes");
  assert.strictEqual(demoItemReview.removeBytes, 0, "item review should not select removal bytes without explicit decisions");
  const undecidedDownloadsReview = guard.buildItemReview("downloads-installers", developerActions, null, []);
  assert(undecidedDownloadsReview.undecidedCount > 0, "item review should keep undecided candidates gated");

  const nativeItemReview = guard.buildItemReview(
    "downloads-installers",
    developerActions,
    {
      findings: [
        {
          recipeId: "downloads-installers",
          title: "Old installers and archives in Downloads",
          path: "C:\\Users\\demo\\Downloads",
          items: [
            {
              id: "native-installer",
              name: "tool.msi",
              path: "C:\\Users\\demo\\Downloads\\tool.msi",
              bytes: 512 * guard.MB,
              ageDays: 90,
              kind: "installer",
              recommendation: "review",
              reason: "Native item"
            }
          ]
        }
      ]
    },
    []
  );
  assert.strictEqual(nativeItemReview.source, "native-readonly", "native item candidates should override demo items");
  assert.strictEqual(nativeItemReview.items[0].name, "tool.msi", "native item candidate should be preserved");
  assert.strictEqual(nativeItemReview.items[0].decision, "undecided", "native item candidate should start undecided");

  const nativeItemApprovals = {
    groupConfirm: true,
    reviewed: {},
    reviewItems: { "downloads-installers": { "native-installer": "remove" } },
    typed: {}
  };
  const decidedNativeItemReview = guard.buildItemReview(
    "downloads-installers",
    developerActions,
    {
      findings: [
        {
          recipeId: "downloads-installers",
          title: "Old installers and archives in Downloads",
          path: "C:\\Users\\demo\\Downloads",
          items: [
            {
              id: "native-installer",
              name: "tool.msi",
              path: "C:\\Users\\demo\\Downloads\\tool.msi",
              bytes: 512 * guard.MB,
              ageDays: 90,
              kind: "installer",
              recommendation: "review",
              reason: "Native item"
            }
          ]
        }
      ]
    },
    [],
    nativeItemApprovals
  );
  assert.strictEqual(decidedNativeItemReview.removeBytes, 512 * guard.MB, "explicit item decision should count selected removal bytes");
  assert.strictEqual(decidedNativeItemReview.undecidedCount, 0, "explicit item decision should clear the review gate");

  const executorPlan = guard.buildExecutorPlan({
    selectedIds: new Set(["windows-temp", "docker-volumes", "gradle-cache"]),
    actionList: developerActions,
    approvals: { groupConfirm: false, reviewed: {}, typed: {} },
    protectedPaths: [],
    scanMode: "demo"
  });
  assert.strictEqual(executorPlan.realRunEnabled, false, "real execution must remain globally disabled");
  assert(executorPlan.rows.find((row) => row.id === "windows-temp").canSimulate, "safe temp cleanup should be simulatable");
  assert.strictEqual(executorPlan.rows.find((row) => row.id === "docker-volumes").status, "blocked", "Docker volumes must remain executor-blocked");
  assert.strictEqual(executorPlan.rows.find((row) => row.id === "gradle-cache").status, "blocked", "unapproved rebuildable cache should be blocked by gate");
  assert(executorPlan.rows.every((row) => row.canRealRun === false), "no executor row should allow real run");
  const toolCommandExecutorPlan = guard.buildExecutorPlan({
    selectedIds: new Set(["npm-cache", "pnpm-store", "docker-build-cache"]),
    actionList: developerActions,
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    protectedPaths: [],
    scanMode: "demo"
  });
  const toolCommandInventory = guard.buildToolCommandInventory({
    actionList: developerActions,
    executorPlan: toolCommandExecutorPlan,
    releaseGate: guard.buildReleaseGate({ scanMode: "demo", nativeCapability: { available: false }, executorPlan: toolCommandExecutorPlan })
  });
  assert.strictEqual(toolCommandInventory.schemaVersion, "spaceguard-tool-command-inventory/v1", "tool command inventory should have a schema version");
  assert.strictEqual(toolCommandInventory.commandExecutionEnabled, false, "tool command inventory must not enable shell execution");
  assert.strictEqual(toolCommandInventory.realRunEnabled, false, "tool command inventory must not imply real execution");
  assert(toolCommandInventory.selectedRows.some((row) => row.id === "npm-cache" && row.inspectCommand === "npm cache verify"), "npm inventory should prefer npm cache verify");
  assert(toolCommandInventory.selectedRows.some((row) => row.id === "docker-build-cache" && row.guardrails.some((guardrail) => guardrail.includes("No Docker volumes"))), "Docker command inventory should block volumes");
  const commandInventoryReport = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: developerActions,
    selectedIds: new Set(["npm-cache"]),
    readiness: guard.getExecutionReadinessForActions(new Set(["npm-cache"]), { groupConfirm: true, reviewed: {}, typed: {} }, developerActions, []),
    ledger: [],
    protectedPaths: [],
    goalBytes: 10 * guard.GB,
    executorPlan: toolCommandExecutorPlan,
    toolCommandInventory
  });
  assert(commandInventoryReport.includes("## Tool Command Inventory"), "dry-run report should include command inventory");
  assert(commandInventoryReport.includes("Command execution enabled: no"), "command inventory report should keep shell execution disabled");

  const itemExecutorApprovals = makeReviewApprovals(developerActions);
  const itemExecutorReviews = guard.buildReviewItemsByAction(developerActions, null, [], itemExecutorApprovals);
  const downloadsSelectedBytes = itemExecutorReviews["downloads-installers"].selectedBytes;
  const itemExecutorPlan = guard.buildExecutorPlan({
    selectedIds: new Set(["downloads-installers"]),
    actionList: developerActions,
    approvals: itemExecutorApprovals,
    protectedPaths: [],
    scanMode: "demo",
    itemReviewsByAction: itemExecutorReviews
  });
  assert(downloadsSelectedBytes > 0, "review item approvals should select some Downloads bytes");
  assert.strictEqual(
    itemExecutorPlan.rows.find((row) => row.id === "downloads-installers").bytes,
    downloadsSelectedBytes,
    "executor plan should use selected item bytes, not broad category bytes"
  );
  assert(itemExecutorPlan.rows.find((row) => row.id === "downloads-installers").canSimulate, "reviewed item route should simulate after item decisions");
  const itemLedger = guard.makeExecutionLedgerForActions(new Set(["downloads-installers"]), developerActions, [], {
    approvals: itemExecutorApprovals,
    itemReviewsByAction: itemExecutorReviews
  });
  assert.strictEqual(itemLedger[0].bytes, downloadsSelectedBytes, "ledger should only reclaim selected reviewed item bytes");

  const itemPlanSnapshot = guard.buildPlanSnapshot({
    selectedIds: new Set(["downloads-installers"]),
    actionList: developerActions,
    approvals: itemExecutorApprovals,
    protectedPaths: [],
    itemReviewsByAction: itemExecutorReviews,
    scanMode: "demo",
    goalBytes: 10 * guard.GB
  });
  const sameItemPlanSnapshot = guard.buildPlanSnapshot({
    selectedIds: new Set(["downloads-installers"]),
    actionList: developerActions,
    approvals: itemExecutorApprovals,
    protectedPaths: [],
    itemReviewsByAction: itemExecutorReviews,
    scanMode: "demo",
    goalBytes: 10 * guard.GB
  });
  assert.strictEqual(itemPlanSnapshot.id, sameItemPlanSnapshot.id, "same plan inputs should produce the same plan id");
  const changedItemApprovals = {
    ...itemExecutorApprovals,
    reviewItems: {
      ...itemExecutorApprovals.reviewItems,
      "downloads-installers": {
        ...itemExecutorApprovals.reviewItems["downloads-installers"],
        "downloads-installers-vscode": "keep"
      }
    }
  };
  const changedItemReviews = guard.buildReviewItemsByAction(developerActions, null, [], changedItemApprovals);
  const changedItemPlanSnapshot = guard.buildPlanSnapshot({
    selectedIds: new Set(["downloads-installers"]),
    actionList: developerActions,
    approvals: changedItemApprovals,
    protectedPaths: [],
    itemReviewsByAction: changedItemReviews,
    scanMode: "demo",
    goalBytes: 10 * guard.GB
  });
  assert.notStrictEqual(itemPlanSnapshot.id, changedItemPlanSnapshot.id, "item decision changes should change the plan id");
  const itemExecutedAt = "2026-06-04T10:00:00.000Z";
  const taggedItemLedger = guard.makeExecutionLedgerForActions(new Set(["downloads-installers"]), developerActions, [], {
    approvals: itemExecutorApprovals,
    itemReviewsByAction: itemExecutorReviews,
    planSnapshot: itemPlanSnapshot,
    executedAt: itemExecutedAt
  });
  assert.strictEqual(taggedItemLedger[0].planId, itemPlanSnapshot.id, "ledger entries should carry the plan id");
  assert.strictEqual(taggedItemLedger[0].executedAt, itemExecutedAt, "ledger entries should carry an absolute execution timestamp");
  const currentVerification = guard.buildVerificationSummary({
    planSnapshot: itemPlanSnapshot,
    ledger: taggedItemLedger,
    executorPlan: itemExecutorPlan,
    scanMode: "demo"
  });
  assert.strictEqual(currentVerification.status, "ledger-current", "matching ledger and plan should verify as current");
  const postRunVerification = guard.buildPostRunVerificationPlan({
    planSnapshot: itemPlanSnapshot,
    ledger: taggedItemLedger,
    executorPlan: itemExecutorPlan,
    scanMode: "demo"
  });
  assert.strictEqual(postRunVerification.schemaVersion, "spaceguard-post-run-verification/v1", "post-run verification should have a schema version");
  assert.strictEqual(postRunVerification.status, "needs-native-rescan", "post-run verification should require native evidence in demo mode");
  assert.strictEqual(postRunVerification.current, true, "matching post-run ledger should be current");
  assert.strictEqual(postRunVerification.checkpoints.length, taggedItemLedger.length, "post-run verification should create one checkpoint per ledger entry");
  assert(postRunVerification.checkpoints[0].path.includes("Downloads"), "post-run checkpoint should include affected root path");
  const postRunMarkdown = guard.buildPostRunVerificationMarkdown(postRunVerification);
  assert(postRunMarkdown.includes("SpaceGuard Post-Run Verification Checklist"), "post-run verification markdown should have a title");
  assert(postRunMarkdown.includes("needs-native-rescan"), "post-run verification markdown should include status");
  const demoRescanComparison = guard.buildRescanComparison({
    postRunVerification,
    ledger: taggedItemLedger,
    scanMode: "demo"
  });
  assert.strictEqual(demoRescanComparison.schemaVersion, "spaceguard-rescan-comparison/v1", "rescan comparison should have a schema version");
  assert.strictEqual(demoRescanComparison.status, "needs-native-rescan", "demo comparison should require native scan evidence");
  assert.strictEqual(demoRescanComparison.rows[0].state, "needs-native-rescan", "demo row should wait for native rescan evidence");

  const tempPlanSnapshot = guard.buildPlanSnapshot({
    selectedIds: new Set(["windows-temp"]),
    actionList: developerActions,
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    protectedPaths: [],
    scanMode: "native-readonly",
    goalBytes: 10 * guard.GB
  });
  const tempExecutorPlan = guard.buildExecutorPlan({
    selectedIds: new Set(["windows-temp"]),
    actionList: developerActions,
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    protectedPaths: [],
    scanMode: "native-readonly"
  });
  const tempLedger = guard.makeExecutionLedgerForActions(new Set(["windows-temp"]), developerActions, [], {
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    planSnapshot: tempPlanSnapshot,
    executedAt: "2026-06-04T10:00:00.000Z"
  });
  const tempPostRunVerification = guard.buildPostRunVerificationPlan({
    planSnapshot: tempPlanSnapshot,
    ledger: tempLedger,
    executorPlan: tempExecutorPlan,
    scanMode: "native-readonly",
    nativeScan: { available: true, generatedAt: "2026-06-04T09:59:00.000Z", findings: [] }
  });
  const earlyNativeComparison = guard.buildRescanComparison({
    postRunVerification: tempPostRunVerification,
    ledger: tempLedger,
    scanMode: "native-readonly",
    nativeScan: {
      available: true,
      generatedAt: "2026-06-04T09:59:00.000Z",
      findings: [{ recipeId: "windows-temp", title: "Windows temp", path: "%TEMP%", bytes: tempLedger[0].bytes, status: "measured" }]
    }
  });
  assert.strictEqual(earlyNativeComparison.status, "needs-post-run-native-rescan", "native scan older than the ledger should not count as post-run proof");
  assert.strictEqual(earlyNativeComparison.rows[0].state, "needs-post-run-native-rescan", "row should wait for a later native scan");
  const mismatchComparison = guard.buildRescanComparison({
    postRunVerification: tempPostRunVerification,
    ledger: tempLedger,
    scanMode: "native-readonly",
    nativeScan: {
      available: true,
      generatedAt: "2026-06-04T10:05:00.000Z",
      findings: [{ recipeId: "windows-temp", title: "Windows temp", path: "%TEMP%", bytes: tempLedger[0].bytes, status: "measured" }]
    }
  });
  assert.strictEqual(mismatchComparison.status, "mismatch", "native bytes still present after the ledger should be a mismatch");
  assert.strictEqual(mismatchComparison.rows[0].state, "mismatch", "comparison row should flag affected-root mismatch");
  const matchedComparison = guard.buildRescanComparison({
    postRunVerification: tempPostRunVerification,
    ledger: tempLedger,
    scanMode: "native-readonly",
    nativeScan: {
      available: true,
      generatedAt: "2026-06-04T10:05:00.000Z",
      findings: [{ recipeId: "windows-temp", title: "Windows temp", path: "%TEMP%", bytes: 0, status: "measured" }]
    }
  });
  assert.strictEqual(matchedComparison.status, "matched", "zero remaining bytes after a full temp cleanup should match within tolerance");
  const skippedPlanSnapshot = guard.buildPlanSnapshot({
    selectedIds: new Set(["browser-identity"]),
    actionList: developerActions,
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    protectedPaths: [],
    scanMode: "native-readonly",
    goalBytes: 10 * guard.GB
  });
  const skippedExecutorPlan = guard.buildExecutorPlan({
    selectedIds: new Set(["browser-identity"]),
    actionList: developerActions,
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    protectedPaths: [],
    scanMode: "native-readonly"
  });
  const skippedLedger = guard.makeExecutionLedgerForActions(new Set(["browser-identity"]), developerActions, [], {
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    planSnapshot: skippedPlanSnapshot,
    executedAt: "2026-06-04T10:00:00.000Z"
  });
  const skippedPostRunVerification = guard.buildPostRunVerificationPlan({
    planSnapshot: skippedPlanSnapshot,
    ledger: skippedLedger,
    executorPlan: skippedExecutorPlan,
    scanMode: "native-readonly",
    nativeScan: { available: true, generatedAt: "2026-06-04T10:05:00.000Z", findings: [] }
  });
  const skippedComparison = guard.buildRescanComparison({
    postRunVerification: skippedPostRunVerification,
    ledger: skippedLedger,
    scanMode: "native-readonly",
    nativeScan: { available: true, generatedAt: "2026-06-04T10:05:00.000Z", findings: [] }
  });
  assert.strictEqual(skippedComparison.status, "skipped", "all-skipped ledgers should stay skipped in rescan comparison");
  assert.strictEqual(skippedComparison.rows[0].state, "skipped", "skipped checkpoint should not be treated as mismatch");
  const rescanMarkdown = guard.buildRescanComparisonMarkdown(mismatchComparison);
  assert(rescanMarkdown.includes("SpaceGuard Rescan Comparison"), "rescan comparison markdown should have a title");
  assert(rescanMarkdown.includes("mismatch"), "rescan comparison markdown should include row state");
  const itemRollbackPlan = guard.buildRollbackPlan({
    planSnapshot: itemPlanSnapshot,
    executorPlan: itemExecutorPlan,
    itemReviewsByAction: itemExecutorReviews,
    postRunVerification,
    scanMode: "demo"
  });
  const downloadsRollbackRow = itemRollbackPlan.rows.find((row) => row.id === "downloads-installers");
  assert.strictEqual(itemRollbackPlan.schemaVersion, "spaceguard-rollback-plan/v1", "rollback plan should have a schema version");
  assert.strictEqual(itemRollbackPlan.status, "needs-rollback-proof", "reviewed item routes should require restore proof");
  assert.strictEqual(itemRollbackPlan.realRunEnabled, false, "rollback plan must not imply real execution");
  assert.strictEqual(downloadsRollbackRow.status, "restore-proof-required", "downloads review route should require a restore location");
  assert(downloadsRollbackRow.restoreTarget.includes("Recycle Bin"), "downloads rollback row should prefer Recycle Bin or quarantine");
  assert(downloadsRollbackRow.requiredEvidence.some((item) => item.includes("Per-item")), "rollback plan should require item-decision evidence");
  const tempRollbackPlan = guard.buildRollbackPlan({
    executorPlan: guard.buildExecutorPlan({
      selectedIds: new Set(["windows-temp"]),
      actionList: developerActions,
      approvals: { groupConfirm: true, reviewed: {}, typed: {} },
      protectedPaths: [],
      scanMode: "demo"
    }),
    scanMode: "demo"
  });
  assert.strictEqual(tempRollbackPlan.status, "rebuildable-routes", "safe temp route should be classified as rebuildable/disposable");
  assert.strictEqual(tempRollbackPlan.rows[0].status, "rebuildable-rescan", "temp rollback should require rescan proof");
  assert(tempRollbackPlan.steps.some((step) => step.includes("native read-only rescan")), "rebuildable rollback should point to native rescan parity");
  const rollbackReport = guard.buildReport({
    scenario: guard.getScenario("developer"),
    profile: guard.getScenario("developer").profile,
    actionList: developerActions,
    selectedIds: new Set(["downloads-installers"]),
    readiness: guard.getExecutionReadinessForActions(new Set(["downloads-installers"]), itemExecutorApprovals, developerActions, [], itemExecutorReviews),
    ledger: taggedItemLedger,
    protectedPaths: [],
    goalBytes: 10 * guard.GB,
    itemReviewsByAction: itemExecutorReviews,
    rollbackPlan: itemRollbackPlan,
    rescanComparison: demoRescanComparison
  });
  assert(rollbackReport.includes("## Rollback Plan"), "dry-run report should include rollback plan");
  assert(rollbackReport.includes("Routes needing proof: 1"), "rollback report should include proof count");
  assert(rollbackReport.includes("## Rescan Comparison"), "dry-run report should include rescan comparison");
  assert(rollbackReport.includes("Post-run scan evidence: no"), "rescan comparison report should show missing post-run evidence");
  const staleVerification = guard.buildVerificationSummary({
    planSnapshot: changedItemPlanSnapshot,
    ledger: taggedItemLedger,
    executorPlan: itemExecutorPlan,
    scanMode: "demo"
  });
  assert.strictEqual(staleVerification.status, "stale-ledger", "ledger from an older plan should be marked stale");
  const stalePostRunVerification = guard.buildPostRunVerificationPlan({
    planSnapshot: changedItemPlanSnapshot,
    ledger: taggedItemLedger,
    executorPlan: itemExecutorPlan,
    scanMode: "demo"
  });
  assert.strictEqual(stalePostRunVerification.status, "stale-ledger", "post-run verification must reject stale ledger evidence");

  const executorReadiness = guard.buildExecutorReadiness(
    executorPlan,
    guard.buildExecutionPreflight({
      scanned: true,
      scanning: false,
      selectedIds: new Set(["windows-temp"]),
      actionList: developerActions,
      readiness: guard.getExecutionReadinessForActions(new Set(["windows-temp"]), { groupConfirm: true, reviewed: {}, typed: {} }, developerActions, []),
      protectedPaths: [],
      ledger: []
    })
  );
  assert(executorReadiness.items.some((item) => item.id === "real-disabled" && item.passed), "executor readiness should explicitly pass because real deletion is disabled");

  const cleanRunPreflight = guard.buildExecutionPreflight({
      scanned: true,
      scanning: false,
      selectedIds: new Set(["windows-temp"]),
      actionList: developerActions,
      readiness: guard.getExecutionReadinessForActions(new Set(["windows-temp"]), { groupConfirm: true, reviewed: {}, typed: {} }, developerActions, []),
      protectedPaths: [],
      ledger: []
    });
  const cleanRunExecutorPlan = guard.buildExecutorPlan({
    selectedIds: new Set(["windows-temp"]),
    actionList: developerActions,
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    protectedPaths: [],
    scanMode: "demo",
    preflight: cleanRunPreflight
  });
  const runReady = guard.buildRunReadiness(
    cleanRunPreflight,
    guard.buildExecutorReadiness(cleanRunExecutorPlan, cleanRunPreflight)
  );
  assert.strictEqual(runReady.ready, true, "run readiness should pass for approved dry-run routes");
  const cleanRunSnapshot = guard.buildPlanSnapshot({
    selectedIds: new Set(["windows-temp"]),
    actionList: developerActions,
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    protectedPaths: [],
    scanMode: "demo",
    goalBytes: 10 * guard.GB
  });
  const unarmedConsent = guard.buildExecutionConsentReceipt({
    planSnapshot: cleanRunSnapshot,
    executorPlan: cleanRunExecutorPlan,
    runReadiness: runReady,
    consent: { accepted: false, planId: "" }
  });
  assert.strictEqual(unarmedConsent.ready, false, "execution consent should be required even when run readiness passes");
  assert(unarmedConsent.items.some((item) => item.id === "plan-accepted" && !item.passed), "consent receipt should surface missing final acknowledgement");
  const armedConsent = guard.buildExecutionConsentReceipt({
    planSnapshot: cleanRunSnapshot,
    executorPlan: cleanRunExecutorPlan,
    runReadiness: runReady,
    consent: { accepted: true, planId: cleanRunSnapshot.id, acceptedAt: "2026-06-03T00:00:00.000Z" }
  });
  assert.strictEqual(armedConsent.ready, true, "matching consent should arm the current dry-run plan");
  assert.strictEqual(armedConsent.expectedBytes, cleanRunExecutorPlan.dryRunBytes, "consent receipt should summarize expected dry-run bytes");
  const staleConsent = guard.buildExecutionConsentReceipt({
    planSnapshot: changedItemPlanSnapshot,
    executorPlan: cleanRunExecutorPlan,
    runReadiness: runReady,
    consent: { accepted: true, planId: cleanRunSnapshot.id, acceptedAt: "2026-06-03T00:00:00.000Z" }
  });
  assert.strictEqual(staleConsent.ready, false, "consent must reset when the plan snapshot changes");

  const blockedOnlySelection = new Set(["docker-volumes"]);
  const blockedOnlyPreflight = guard.buildExecutionPreflight({
    scanned: true,
    scanning: false,
    selectedIds: blockedOnlySelection,
    actionList: developerActions,
    readiness: { ready: true, unresolved: [] },
    protectedPaths: [],
    ledger: []
  });
  const blockedOnlyExecutorPlan = guard.buildExecutorPlan({
    selectedIds: blockedOnlySelection,
    actionList: developerActions,
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    protectedPaths: [],
    scanMode: "demo",
    preflight: blockedOnlyPreflight
  });
  const blockedOnlyRunReady = guard.buildRunReadiness(
    blockedOnlyPreflight,
    guard.buildExecutorReadiness(blockedOnlyExecutorPlan, blockedOnlyPreflight)
  );
  assert.strictEqual(blockedOnlyPreflight.ready, true, "workflow preflight alone can pass with synthetic blocked selections");
  assert.strictEqual(blockedOnlyRunReady.ready, false, "run readiness must block selections with no valid dry-run route");
  assert(blockedOnlyRunReady.items.some((item) => item.id === "executor-policy" && !item.passed), "run readiness should surface executor policy blockers");

  const adminRoutePlan = guard.buildExecutorPlan({
    selectedIds: new Set(["windows-old"]),
    actionList: developerActions,
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    protectedPaths: [],
    scanMode: "demo"
  });
  const standardPrivilegeBoundary = guard.buildPrivilegeBoundary({
    runtimeCapabilities: {
      available: true,
      platform: "windows",
      elevated: false,
      elevationSource: "IsUserAnAdmin",
      realRunEnabled: false
    },
    executorPlan: adminRoutePlan
  });
  assert.strictEqual(standardPrivilegeBoundary.status, "admin-required", "admin-sensitive routes should be flagged under standard-user runtime");
  assert.strictEqual(standardPrivilegeBoundary.readyForAdminRoutes, false, "standard-user runtime should not be ready for admin-sensitive routes");
  assert(standardPrivilegeBoundary.adminRows.some((row) => row.id === "windows-old"), "privilege boundary should list selected admin-sensitive routes");
  const elevatedPrivilegeBoundary = guard.buildPrivilegeBoundary({
    runtimeCapabilities: {
      available: true,
      platform: "windows",
      elevated: true,
      elevationSource: "IsUserAnAdmin",
      realRunEnabled: false
    },
    executorPlan: adminRoutePlan
  });
  assert.strictEqual(elevatedPrivilegeBoundary.status, "elevated", "elevated runtime should be visible in privilege boundary");
  assert.strictEqual(elevatedPrivilegeBoundary.readyForAdminRoutes, true, "elevated runtime can satisfy admin route boundary evidence");

  const releaseGate = guard.buildReleaseGate({
    scanMode: "demo",
    nativeCapability: { available: false },
    executorPlan
  });
  assert.strictEqual(releaseGate.readyForRealRun, false, "release gate should block real execution by default");
  assert.strictEqual(releaseGate.realFlagEnabled, false, "real executor feature flag should default off");
  assert(releaseGate.missingRows.length > 0, "release gate should require validation evidence");
  assert(releaseGate.vmRows.some((row) => row.totalCount > 0), "release gate should include disposable VM matrix");

  const partialEvidenceGate = guard.buildReleaseGate({
    featureFlags: { realExecutors: true },
    validationEvidence: { "windows-native-build": "passed" },
    scanMode: "native-readonly",
    nativeCapability: { available: true },
    executorPlan
  });
  assert.strictEqual(partialEvidenceGate.rows.find((row) => row.id === "windows-native-build").passed, true, "release gate should accept recorded validation evidence");
  assert.strictEqual(partialEvidenceGate.readyForRealRun, false, "partial validation evidence must not open real run");

  const executorManifest = guard.buildExecutorManifest({
    actionList: developerActions,
    executorPlan,
    releaseGate
  });
  const tempRoute = executorManifest.routes.find((route) => route.route === "known-temp-delete");
  const largeFileRoute = executorManifest.routes.find((route) => route.route === "item-review-large-files");
  const blockedRoute = executorManifest.routes.find((route) => route.route === "blocked");
  assert.strictEqual(executorManifest.schemaVersion, "spaceguard-executor-manifest/v1", "executor manifest should have a schema version");
  assert(tempRoute, "executor manifest should include known temp route");
  assert(tempRoute.requiredChecks.some((check) => check.id === "temp-locked-files"), "temp route should require locked-file evidence");
  assert(tempRoute.fixtureIds.includes("known-temp-fixture"), "temp route should point to the temp fixture");
  assert.strictEqual(tempRoute.status, "needs-validation", "first-safe route should still need Windows validation by default");
  assert.strictEqual(tempRoute.realRunEnabled, false, "manifest must keep temp real execution disabled");
  assert(largeFileRoute, "executor manifest should include large-file item review route");
  assert(largeFileRoute.fixtureIds.includes("review-data-fixture"), "large-file route should point to review data fixtures");
  assert.strictEqual(largeFileRoute.realRunEnabled, false, "large-file route must keep real execution disabled");
  assert.strictEqual(blockedRoute.status, "blocked", "blocked policy route should stay blocked in manifest");
  assert(executorManifest.nextSteps.some((step) => step.includes("Windows validation")), "manifest should produce route validation next steps");

  const validationPack = guard.buildValidationEvidencePack({
    releaseGate,
    executorPlan,
    executorManifest,
    scanMode: "demo",
    runtimeCapabilities: {
      available: false,
      mode: "browser-demo",
      platform: "browser",
      windows: false,
      realRunEnabled: false,
      destructiveCommands: false,
      scanKnownRoots: false,
      simulateCleanupPlan: false,
      safeExecutorsEnabled: false
    }
  });
  assert.strictEqual(validationPack.readyForRealRun, false, "validation pack must not mark real execution ready by default");
  assert.strictEqual(validationPack.vmScenarios.length, guard.disposableVmScenarios.length, "validation pack should include every disposable VM scenario");
  assert(validationPack.fixtureRoots.length >= 5, "validation pack should include concrete fixture roots");
  assert(validationPack.validationChecks.every((check) => check.result === "not-run"), "default validation checks should be evidence templates");
  assert(validationPack.commands.some((command) => command.command === "npm run native:build"), "validation pack should include the Windows native build command");
  assert(validationPack.executorRoutes.some((route) => route.route === "known-temp-delete"), "validation pack should include selected executor routes under review");
  assert(validationPack.executorManifest.routes.some((route) => route.route === "browser-cache-only"), "validation pack should include the full executor manifest");
  const validationMarkdown = guard.buildValidationPackMarkdown(validationPack);
  assert(validationMarkdown.includes("SpaceGuard Validation Evidence Pack"), "validation pack markdown should have a title");
  assert(validationMarkdown.includes("Disposable VM Matrix"), "validation pack markdown should include the VM matrix");
  assert(validationMarkdown.includes("Executor Manifest"), "validation pack markdown should include the executor manifest");
  const recordedValidationPack = guard.buildValidationEvidencePack({
    releaseGate: partialEvidenceGate,
    executorPlan,
    executorManifest,
    scanMode: "native-readonly",
    runtimeCapabilities: { available: true, realRunEnabled: false, destructiveCommands: false }
  });
  assert.strictEqual(recordedValidationPack.validationChecks.find((check) => check.id === "windows-native-build").evidenceValue, "passed", "validation pack should export recorded evidence values");
  assert(guard.buildValidationPackMarkdown(recordedValidationPack).includes("- [x] Windows native build"), "validation markdown should check recorded evidence rows");

  const runRecord = guard.buildLedgerRunRecord({
    planSnapshot: itemPlanSnapshot,
    ledger: taggedItemLedger,
    executorPlan: itemExecutorPlan,
    scanMode: "demo",
    runtimeCapabilities: {
      realRunEnabled: false,
      destructiveCommands: false
    },
    runReadiness: runReady,
    createdAt: "2026-06-03T00:00:00.000Z"
  });
  assert.strictEqual(runRecord.schemaVersion, "spaceguard-ledger-run/v1", "run record should have a schema version");
  assert.strictEqual(runRecord.planId, itemPlanSnapshot.id, "run record should keep the plan id");
  assert.strictEqual(runRecord.reclaimedBytes, taggedItemLedger[0].bytes, "run record should summarize reclaimed bytes");
  assert.strictEqual(runRecord.realRunEnabled, false, "run record must not imply real execution");
  const appendedHistory = guard.appendLedgerRunRecord([], runRecord);
  const dedupedHistory = guard.appendLedgerRunRecord(appendedHistory, runRecord);
  assert.strictEqual(appendedHistory.length, 1, "run history should append valid records");
  assert.strictEqual(dedupedHistory.length, 1, "run history should not duplicate the same record id");
  const currentHistorySummary = guard.buildLedgerHistorySummary(appendedHistory, itemPlanSnapshot);
  const staleHistorySummary = guard.buildLedgerHistorySummary(appendedHistory, changedItemPlanSnapshot);
  assert.strictEqual(currentHistorySummary.hasCurrentPlanRecord, true, "history should identify records for the current plan");
  assert.strictEqual(currentHistorySummary.currentLedger.length, taggedItemLedger.length, "history should expose current plan ledger entries");
  assert.strictEqual(staleHistorySummary.hasCurrentPlanRecord, false, "changed plans should make previous records stale");
  assert.strictEqual(staleHistorySummary.counts.stale, 1, "stale history count should include old plan records");
  const historyMarkdown = guard.buildLedgerHistoryMarkdown(currentHistorySummary);
  assert(historyMarkdown.includes("SpaceGuard Local Run History"), "history markdown should have a title");
  assert(historyMarkdown.includes(itemPlanSnapshot.id), "history markdown should include plan ids");

  const passedEvidence = Object.fromEntries(guard.windowsValidationChecks.map((check) => [check.id, true]));
  const enabledGate = guard.buildReleaseGate({
    featureFlags: { realExecutors: true },
    validationEvidence: passedEvidence,
    scanMode: "native-readonly",
    nativeCapability: { available: true },
    executorPlan
  });
  assert.strictEqual(enabledGate.readyForRealRun, true, "release gate should only open with flag, native evidence, validations, and candidate routes");

  const readySelection = new Set(["windows-temp"]);
  const readyReadiness = guard.getExecutionReadinessForActions(
    readySelection,
    { groupConfirm: true, reviewed: {}, typed: {} },
    developerActions,
    []
  );
  const readyPlanSnapshot = guard.buildPlanSnapshot({
    selectedIds: readySelection,
    actionList: developerActions,
    approvals: { groupConfirm: true, reviewed: {}, typed: {} },
    protectedPaths: [],
    scanMode: "demo",
    goalBytes: 10 * guard.GB
  });
  assert.strictEqual(
    guard.buildExecutionPreflight({
      scanned: false,
      scanning: false,
      selectedIds: readySelection,
      actionList: developerActions,
      readiness: readyReadiness,
      protectedPaths: [],
      ledger: [],
      planSnapshot: readyPlanSnapshot
    }).ready,
    false,
    "preflight must block execution before scan"
  );
  assert.strictEqual(
    guard.buildExecutionPreflight({
      scanned: true,
      scanning: false,
      selectedIds: readySelection,
      actionList: developerActions,
      readiness: readyReadiness,
      protectedPaths: [],
      ledger: [],
      planSnapshot: readyPlanSnapshot
    }).ready,
    true,
    "preflight should pass when scan, selection, and gates are ready"
  );
  assert.strictEqual(
    guard.buildExecutionPreflight({
      scanned: true,
      scanning: false,
      selectedIds: readySelection,
      actionList: developerActions,
      readiness: readyReadiness,
      protectedPaths: [],
      ledger: [{ id: "windows-temp", planId: readyPlanSnapshot.id }],
      planSnapshot: readyPlanSnapshot
    }).ready,
    false,
    "preflight must block duplicate execution after current plan ledger exists"
  );
  assert.strictEqual(
    guard.buildExecutionPreflight({
      scanned: true,
      scanning: false,
      selectedIds: readySelection,
      actionList: developerActions,
      readiness: readyReadiness,
      protectedPaths: [],
      ledger: [{ id: "windows-temp", planId: "plan-old" }],
      planSnapshot: readyPlanSnapshot
    }).ready,
    true,
    "preflight should allow simulation when only stale ledger entries exist"
  );

  console.log("guardrails ok");
})();
