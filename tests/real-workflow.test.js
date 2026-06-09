const assert = require("assert");

(async () => {
  const workflow = await import("../src/real-workflow.mjs");

  const executedAt = "2026-06-08T15:00:00.000Z";
  const postRunGeneratedAt = "2026-06-08T15:01:00.000Z";
  const selectedInstaller = {
    id: "downloads-installers:setup-old",
    recipeId: "downloads-installers",
    title: "setup-old.exe",
    route: "item-review-recycle-bin",
    routeInput: "downloads",
    targetPath: "C:\\Users\\LocalUser\\Downloads\\setup-old.exe",
    bytes: 128 * 1024 * 1024,
    sourceFinding: {
      recipeId: "downloads-installers",
      path: "C:\\Users\\LocalUser\\Downloads"
    },
    reviewTarget: {
      path: "C:\\Users\\LocalUser\\Downloads\\setup-old.exe",
      bytes: 128 * 1024 * 1024
    }
  };

  const proof = workflow.buildPostRunProof({
    candidate: selectedInstaller,
    executionRecord: {
      executedAt,
      bytes: 128 * 1024 * 1024
    },
    postRunScan: {
      generatedAt: postRunGeneratedAt,
      findings: [
        {
          recipeId: "downloads-installers",
          path: "C:\\Users\\LocalUser\\Downloads",
          bytes: 512 * 1024 * 1024,
          items: [
            {
              id: "setup-new",
              path: "C:\\Users\\LocalUser\\Downloads\\setup-new.exe",
              bytes: 512 * 1024 * 1024
            }
          ]
        }
      ]
    }
  });

  assert.strictEqual(proof.status, "matched", "selected item proof should match when that item is absent after rescan");
  assert.strictEqual(proof.actualBytes, 0, "selected item proof should compare the selected item, not parent finding bytes");
  assert.strictEqual(proof.targetEvidence.kind, "item", "selected item proof should record item-level evidence");

  const archiveCandidate = {
    route: "item-review-large-files",
    routeInput: "large-files",
    title: "old-video.mkv",
    targetPath: "C:\\Users\\LocalUser\\Videos\\old-video.mkv",
    requiresArchiveDestination: true
  };
  const missingArchiveDestination = workflow.buildExecutionPrerequisites({
    candidate: archiveCandidate,
    archiveDestination: ""
  });
  assert.strictEqual(missingArchiveDestination.ready, false, "large-file archive should require a destination before execution");
  assert(missingArchiveDestination.rows.some((row) => row.id === "archive-destination" && !row.passed), "archive prerequisites should expose the missing destination row");

  const relativeArchiveDestination = workflow.buildExecutionPrerequisites({
    candidate: archiveCandidate,
    archiveDestination: "Archives"
  });
  assert.strictEqual(relativeArchiveDestination.ready, false, "large-file archive should reject relative destinations before native execution");
  assert(relativeArchiveDestination.rows.some((row) => row.id === "archive-destination-absolute" && !row.passed), "archive prerequisites should require an absolute Windows destination");

  const sameDriveArchiveDestination = workflow.buildExecutionPrerequisites({
    candidate: archiveCandidate,
    archiveDestination: "C:\\SpaceGuardArchive"
  });
  assert.strictEqual(sameDriveArchiveDestination.ready, false, "large-file archive should reject same-drive archive destinations before native execution");
  assert(sameDriveArchiveDestination.rows.some((row) => row.id === "archive-destination-drive" && !row.passed), "archive prerequisites should require a different drive");

  const protectedArchiveDestination = workflow.buildExecutionPrerequisites({
    candidate: archiveCandidate,
    archiveDestination: "D:\\Windows\\SpaceGuardArchive"
  });
  assert.strictEqual(protectedArchiveDestination.ready, false, "large-file archive should reject protected archive destinations before native execution");
  assert(protectedArchiveDestination.rows.some((row) => row.id === "archive-destination-protected" && !row.passed), "archive prerequisites should block protected roots");

  const validArchiveDestination = workflow.buildExecutionPrerequisites({
    candidate: archiveCandidate,
    archiveDestination: "D:\\SpaceGuardArchive"
  });
  assert.strictEqual(validArchiveDestination.ready, true, "large-file archive should allow a different-drive archive destination");

  const recyclePrerequisites = workflow.buildExecutionPrerequisites({
    candidate: {
      route: "shell-recycle-bin",
      routeInput: "recycle-bin",
      title: "Recycle Bin",
      targetPath: "C:\\$Recycle.Bin",
      requiresPermanentConfirmation: true
    },
    permanentRemovalConfirmed: false
  });
  assert.strictEqual(recyclePrerequisites.ready, false, "Recycle Bin execution should require permanent-removal confirmation");
  assert(recyclePrerequisites.rows.some((row) => row.id === "permanent-removal-confirmation" && !row.passed), "Recycle Bin prerequisites should expose the missing permanent confirmation");

  const confirmedRecyclePrerequisites = workflow.buildExecutionPrerequisites({
    candidate: {
      route: "shell-recycle-bin",
      routeInput: "recycle-bin",
      title: "Recycle Bin",
      targetPath: "C:\\$Recycle.Bin",
      requiresPermanentConfirmation: true
    },
    permanentRemovalConfirmed: true
  });
  assert.strictEqual(confirmedRecyclePrerequisites.ready, true, "Recycle Bin execution should unlock after explicit permanent-removal confirmation");

  const brokerCandidate = {
    id: "npm-cache:C:\\Users\\LocalUser\\AppData\\Local\\npm-cache\\_cacache",
    title: "npm cache",
    route: "bounded-npm-cache-delete",
    routeInput: "npm-cache",
    actionType: "run-npm-cache-executor",
    targetPath: "C:\\Users\\LocalUser\\AppData\\Local\\npm-cache\\_cacache",
    bytes: 512 * 1024 * 1024
  };
  assert.strictEqual(
    workflow.buildWorkflowAgentTargetId(brokerCandidate, 0),
    "npm-cache-1",
    "workflow agent target ids should match the OpenAI cleanup queue target ids"
  );
  assert.strictEqual(
    workflow.resolveWorkflowAgentBrokerCandidate(
      {
        kind: "scoped-executor",
        actionType: "run-npm-cache-executor",
        targetId: "npm-cache-1",
        executorRoute: "bounded-npm-cache-delete"
      },
      [brokerCandidate]
    )?.id,
    brokerCandidate.id,
    "broker recommendations should resolve back to the exact guarded cleanup candidate"
  );
  assert.strictEqual(
    workflow.resolveWorkflowAgentBrokerCandidate(
      {
        kind: "scoped-executor",
        actionType: "run-npm-cache-executor",
        targetId: "npm-cache-1",
        executorRoute: "bounded-pnpm-store-delete"
      },
      [brokerCandidate]
    ),
    null,
    "broker recommendations should not resolve when the executor route does not match"
  );

  const executionLedger = workflow.buildExecutionLedgerRows({
    accepted: false,
    mode: "native-npm-cache-executor-rejected",
    reason: "npm cache executor rejected the request before mutation.",
    warnings: ["SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR is not enabled."],
    entries: [
      {
        id: "npm-cache",
        title: "npm cache",
        route: "bounded-npm-cache-delete",
        result: "rejected",
        rejectCode: "real-executor-disabled",
        bytes: 0,
        preflightStatus: "target-blocked",
        note: "No bytes were removed.",
        preflightChecks: [
          {
            id: "feature-flag",
            label: "Executor feature flag",
            status: "blocked",
            detail: "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR is not enabled."
          }
        ]
      }
    ]
  });
  assert.strictEqual(executionLedger.status, "rejected", "execution ledger should keep rejected native executor status");
  assert.strictEqual(executionLedger.rows[0].rejectCode, "real-executor-disabled", "execution ledger should expose native reject codes");
  assert.strictEqual(executionLedger.rows[0].checks[0].status, "blocked", "execution ledger should preserve preflight check status");
  assert(executionLedger.warnings[0].includes("SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR"), "execution ledger should expose native executor warnings");

  const routeOptions = [
    { routeInput: "npm-cache", envVar: "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR", flagKey: "npmCacheExecutor" },
    { routeInput: "pnpm-store", envVar: "SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR", flagKey: "pnpmStoreExecutor" },
    { routeInput: "gradle-cache", envVar: "SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR", flagKey: "gradleCacheExecutor" }
  ];
  assert.strictEqual(
    workflow.resolveRuntimeRouteInput({
      routes: routeOptions,
      runtime: {
        enabledScopedExecutorFlags: ["SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR"],
        executorFlags: { pnpmStoreExecutor: true }
      },
      fallbackRouteInput: "npm-cache"
    }),
    "pnpm-store",
    "runtime route sync should select the route for the single enabled scoped flag"
  );
  assert.strictEqual(
    workflow.resolveRuntimeRouteInput({
      routes: routeOptions,
      runtime: {
        enabledScopedExecutorFlags: ["SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR", "SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR"],
        executorFlags: { npmCacheExecutor: true, gradleCacheExecutor: true }
      },
      fallbackRouteInput: "npm-cache"
    }),
    "npm-cache",
    "runtime route sync should preserve the current route when multiple scoped flags are enabled"
  );
  assert.strictEqual(
    workflow.resolveRuntimeRouteInput({
      routes: routeOptions,
      runtime: { enabledScopedExecutorFlags: [], executorFlags: {} },
      fallbackRouteInput: "gradle-cache"
    }),
    "gradle-cache",
    "runtime route sync should preserve the current route when no scoped flag is enabled"
  );

  const setupMismatchRuntime = {
    windows: true,
    executeCleanupPlan: true,
    realRunEnabled: true,
    destructiveCommands: true,
    executorScopeStatus: "single-scoped-flag",
    executorFlags: {
      npmCacheExecutor: true
    }
  };
  const setupMismatchRecipe = {
    executor: "npm",
    routeInput: "npm-cache",
    route: "bounded-npm-cache-delete",
    flagKey: "npmCacheExecutor",
    envVar: "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR"
  };
  const setupMismatchFinding = {
    status: "measured",
    recipeId: "npm-cache",
    path: "C:\\Users\\LocalUser\\AppData\\Local\\npm-cache\\_cacache",
    bytes: 512 * 1024 * 1024
  };
  const mismatchedRouteReadiness = workflow.buildRouteReadiness({
    recipe: setupMismatchRecipe,
    finding: setupMismatchFinding,
    runtime: setupMismatchRuntime,
    selectedRouteInput: "gradle-cache"
  });
  assert.strictEqual(mismatchedRouteReadiness.canExecute, false, "route readiness should block execution when selected route setup points at a different route");
  assert(mismatchedRouteReadiness.rows.some((row) => row.id === "selected-route-setup" && !row.passed), "route readiness should expose selected route setup mismatch as a blocker");

  const matchedRouteReadiness = workflow.buildRouteReadiness({
    recipe: setupMismatchRecipe,
    finding: setupMismatchFinding,
    runtime: setupMismatchRuntime,
    selectedRouteInput: "npm-cache"
  });
  assert.strictEqual(matchedRouteReadiness.canExecute, true, "route readiness should allow execution when selected route setup matches the target route");

  const zeroByteNoOpLocks = workflow.buildWorkflowLocks({
    executionRecord: {
      accepted: true,
      bytes: 0
    },
    workflowProofAccepted: false,
    supportBundleWritten: false
  });
  assert.strictEqual(zeroByteNoOpLocks.noOpExecution, true, "accepted zero-byte executions should be classified as no-op handoffs");
  assert.strictEqual(zeroByteNoOpLocks.proofHandoffRequired, false, "accepted zero-byte executions should not require impossible positive-byte proof handoff");
  assert.strictEqual(zeroByteNoOpLocks.proofAllowsNextExecutor, true, "accepted zero-byte executions should allow the next executor without support bundle proof handoff");
  assert.strictEqual(zeroByteNoOpLocks.targetSwitchLocked, false, "accepted zero-byte executions should not lock target switching");
  assert.strictEqual(zeroByteNoOpLocks.routeSetupLocked, false, "accepted zero-byte executions should not lock route setup switching");

  const positiveExecutionLocks = workflow.buildWorkflowLocks({
    executionRecord: {
      accepted: true,
      bytes: 1024
    },
    workflowProofAccepted: false,
    supportBundleWritten: false
  });
  assert.strictEqual(positiveExecutionLocks.proofHandoffRequired, true, "positive accepted executions should require proof handoff");
  assert.strictEqual(positiveExecutionLocks.proofAllowsNextExecutor, false, "positive accepted executions should block next executor until support bundle handoff");
  assert.strictEqual(positiveExecutionLocks.targetSwitchLocked, true, "positive accepted executions should lock target switching before support bundle handoff");
  assert.strictEqual(positiveExecutionLocks.routeSetupLocked, true, "positive accepted executions should lock route setup before support bundle handoff");

  const handedOffLocks = workflow.buildWorkflowLocks({
    executionRecord: {
      accepted: true,
      bytes: 1024
    },
    workflowProofAccepted: true,
    supportBundleWritten: true
  });
  assert.strictEqual(handedOffLocks.proofAllowsNextExecutor, true, "support bundle handoff should allow the next executor");
  assert.strictEqual(handedOffLocks.targetSwitchLocked, false, "support bundle handoff should unlock target switching");
  assert.strictEqual(handedOffLocks.routeSetupLocked, false, "support bundle handoff should unlock route setup switching");

  const gateCandidate = {
    id: "npm-cache:C:\\Users\\LocalUser\\AppData\\Local\\npm-cache\\_cacache",
    title: "npm cache",
    routeInput: "npm-cache",
    targetPath: "C:\\Users\\LocalUser\\AppData\\Local\\npm-cache\\_cacache",
    bytes: 512 * 1024 * 1024,
    canExecute: true
  };
  const missingConsentGate = workflow.buildExecutionGate({
    candidate: gateCandidate,
    consentChecked: false,
    confirmationText: "RUN npm-cache",
    expectedConfirmation: "RUN npm-cache",
    executionPrerequisites: { ready: true },
    scanFingerprint: "scan-123",
    executionStatus: "idle"
  });
  assert.strictEqual(missingConsentGate.ready, false, "execution gate should block without explicit consent");
  assert(missingConsentGate.rows.some((row) => row.id === "consent-checkbox" && !row.passed), "execution gate should name missing consent");

  const wrongPhraseGate = workflow.buildExecutionGate({
    candidate: gateCandidate,
    consentChecked: true,
    confirmationText: "RUN gradle-cache",
    expectedConfirmation: "RUN npm-cache",
    executionPrerequisites: { ready: true },
    scanFingerprint: "scan-123",
    executionStatus: "idle"
  });
  assert.strictEqual(wrongPhraseGate.ready, false, "execution gate should block when confirmation text does not match the selected route");
  assert(wrongPhraseGate.rows.some((row) => row.id === "confirmation-phrase" && !row.passed), "execution gate should expose confirmation mismatch");

  const missingScanGate = workflow.buildExecutionGate({
    candidate: gateCandidate,
    consentChecked: true,
    confirmationText: "RUN npm-cache",
    expectedConfirmation: "RUN npm-cache",
    executionPrerequisites: { ready: true },
    scanFingerprint: "",
    executionStatus: "idle"
  });
  assert.strictEqual(missingScanGate.ready, false, "execution gate should block without a current scan fingerprint");
  assert(missingScanGate.rows.some((row) => row.id === "scan-fingerprint" && !row.passed), "execution gate should expose missing scan fingerprint");

  const blockedPrerequisiteGate = workflow.buildExecutionGate({
    candidate: gateCandidate,
    consentChecked: true,
    confirmationText: "RUN npm-cache",
    expectedConfirmation: "RUN npm-cache",
    executionPrerequisites: {
      ready: false,
      blockers: [{ id: "archive-destination" }]
    },
    scanFingerprint: "scan-123",
    executionStatus: "idle"
  });
  assert.strictEqual(blockedPrerequisiteGate.ready, false, "execution gate should block when route-specific prerequisites are blocked");
  assert(blockedPrerequisiteGate.rows.some((row) => row.id === "execution-prerequisites" && !row.passed), "execution gate should expose blocked route-specific prerequisites");

  const readyExecutionGate = workflow.buildExecutionGate({
    candidate: gateCandidate,
    consentChecked: true,
    confirmationText: "RUN npm-cache",
    expectedConfirmation: "RUN npm-cache",
    executionPrerequisites: { ready: true },
    scanFingerprint: "scan-123",
    executionStatus: "idle"
  });
  assert.strictEqual(readyExecutionGate.schemaVersion, "spaceguard-execution-gate/v1", "execution gate should expose a stable schema");
  assert.strictEqual(readyExecutionGate.ready, true, "execution gate should pass only when all dispatch prerequisites are ready");

  const scanNextGuide = workflow.buildWorkflowGuide({
    nativeConnected: true,
    scan: null,
    candidates: [],
    selectedCandidate: null,
    executionGate: missingConsentGate,
    executionRecord: null,
    postRunProof: { status: "not-run", scanGeneratedAt: "" },
    proofReviewed: false,
    workflowProofAccepted: false,
    supportBundleWritten: false,
    canExportProof: false
  });
  assert.strictEqual(scanNextGuide.schemaVersion, "spaceguard-workflow-guide/v1", "workflow guide should expose a stable schema");
  assert.strictEqual(scanNextGuide.currentStepId, "scan", "workflow guide should point connected users at the real scan before target selection");
  assert.strictEqual(scanNextGuide.primaryAction, "Run real scan", "workflow guide should name the next real action");
  assert.strictEqual(scanNextGuide.primaryActionKind, "run-scan", "workflow guide should expose the scan action kind");
  assert.strictEqual(scanNextGuide.actionEnabled, true, "workflow guide should allow the primary scan action when connected");
  assert(scanNextGuide.steps.some((step) => step.id === "scan" && step.status === "current"), "workflow guide should mark the scan step as current");

  const scanBusyGuide = workflow.buildWorkflowGuide({
    nativeConnected: true,
    scan: null,
    scanStatus: "scanning",
    candidates: [],
    selectedCandidate: null,
    executionGate: missingConsentGate,
    executionRecord: null,
    postRunProof: { status: "not-run", scanGeneratedAt: "" },
    proofReviewed: false,
    workflowProofAccepted: false,
    supportBundleWritten: false,
    canExportProof: false
  });
  assert.strictEqual(scanBusyGuide.currentStepId, "scan", "workflow guide should still show scan as current while scan is running");
  assert.strictEqual(scanBusyGuide.actionBusy, true, "workflow guide should mark scan action busy while native scan is running");
  assert.strictEqual(scanBusyGuide.actionEnabled, false, "workflow guide should not allow duplicate scan dispatch while scan is running");

  const selectNextGuide = workflow.buildWorkflowGuide({
    nativeConnected: true,
    scan: { generatedAt: "2026-06-08T14:59:00.000Z" },
    candidates: [
      { id: "blocked-target", title: "blocked target", canExecute: false },
      {
        id: "ready-target",
        title: "ready target",
        routeInput: "npm-cache",
        targetPath: "C:\\Users\\LocalUser\\AppData\\Local\\npm-cache\\_cacache",
        bytes: 256 * 1024 * 1024,
        canExecute: true
      }
    ],
    selectedCandidate: null,
    executionGate: missingConsentGate,
    executionRecord: null,
    postRunProof: { status: "not-run", scanGeneratedAt: "" },
    proofReviewed: false,
    workflowProofAccepted: false,
    supportBundleWritten: false,
    canExportProof: false
  });
  assert.strictEqual(selectNextGuide.currentStepId, "select", "workflow guide should move to target selection after a scan finds candidates");
  assert.strictEqual(selectNextGuide.primaryActionKind, "select-target", "workflow guide should expose the select-target action kind");
  assert.strictEqual(selectNextGuide.primaryTargetId, "ready-target", "workflow guide should recommend the first executable target when available");
  assert.strictEqual(selectNextGuide.primaryTargetTitle, "ready target", "workflow guide should name the recommended target before selection");
  assert.strictEqual(selectNextGuide.primaryTargetRouteInput, "npm-cache", "workflow guide should expose the recommended target route");
  assert.strictEqual(selectNextGuide.primaryTargetBytes, 256 * 1024 * 1024, "workflow guide should expose expected reclaim bytes for the recommended target");
  assert(selectNextGuide.primaryTargetPath.includes("%USERPROFILE%"), "workflow guide should redact the recommended target path");
  assert.strictEqual(selectNextGuide.actionEnabled, true, "workflow guide should allow selecting the recommended target");

  const emptySelectGuide = workflow.buildWorkflowGuide({
    nativeConnected: true,
    scan: { generatedAt: "2026-06-08T14:59:00.000Z" },
    candidates: [],
    selectedCandidate: null,
    executionGate: missingConsentGate,
    executionRecord: null,
    postRunProof: { status: "not-run", scanGeneratedAt: "" },
    proofReviewed: false,
    workflowProofAccepted: false,
    supportBundleWritten: false,
    canExportProof: false
  });
  assert.strictEqual(emptySelectGuide.currentStepId, "select", "workflow guide should still explain selection when a scan has no route candidates");
  assert.strictEqual(emptySelectGuide.actionEnabled, false, "workflow guide should not enable selection when no candidate exists");

  const executeNextGuide = workflow.buildWorkflowGuide({
    nativeConnected: true,
    scan: { generatedAt: "2026-06-08T14:59:00.000Z" },
    candidates: [gateCandidate],
    selectedCandidate: gateCandidate,
    executionGate: readyExecutionGate,
    executionRecord: null,
    postRunProof: { status: "not-run", scanGeneratedAt: "" },
    proofReviewed: false,
    workflowProofAccepted: false,
    supportBundleWritten: false,
    canExportProof: false
  });
  assert.strictEqual(executeNextGuide.currentStepId, "execute", "workflow guide should move to execution once consent gate is ready");
  assert.strictEqual(executeNextGuide.primaryAction, "Execute selected cleanup", "workflow guide should tell the user to execute only after gates pass");
  assert.strictEqual(executeNextGuide.primaryActionKind, "execute-cleanup", "workflow guide should expose the guarded execute action kind");
  assert.strictEqual(executeNextGuide.primaryTargetTitle, "npm cache", "workflow guide should name the selected target before execution");
  assert.strictEqual(executeNextGuide.primaryTargetBytes, 512 * 1024 * 1024, "workflow guide should expose selected target expected bytes before execution");
  assert.strictEqual(executeNextGuide.actionEnabled, true, "workflow guide should allow execute only once the execution gate is ready");

  const noOpCompleteGuide = workflow.buildWorkflowGuide({
    nativeConnected: true,
    scan: { generatedAt: "2026-06-08T14:59:00.000Z" },
    candidates: [gateCandidate],
    selectedCandidate: gateCandidate,
    executionGate: readyExecutionGate,
    executionRecord: { accepted: true, bytes: 0, resultMode: "native-npm-cache-executor" },
    postRunProof: { status: "needs-rescan", scanGeneratedAt: "" },
    proofReviewed: false,
    workflowProofAccepted: false,
    supportBundleWritten: false,
    canExportProof: false
  });
  assert.strictEqual(noOpCompleteGuide.status, "complete", "accepted no-op workflow should complete without impossible positive-byte proof");
  assert.strictEqual(noOpCompleteGuide.currentStepId, "next-route", "accepted no-op workflow should release route switching without post-run proof");
  assert.strictEqual(noOpCompleteGuide.primaryAction, "Ready for next route", "accepted no-op workflow should show the next-route handoff");
  assert(noOpCompleteGuide.primaryDetail.includes("proof handoff is not required"), "accepted no-op workflow should explain why proof export is skipped");

  const exportNextGuide = workflow.buildWorkflowGuide({
    nativeConnected: true,
    scan: { generatedAt: "2026-06-08T14:59:00.000Z" },
    candidates: [gateCandidate],
    selectedCandidate: gateCandidate,
    executionGate: readyExecutionGate,
    executionRecord: { accepted: true, bytes: 1024 },
    postRunProof: { status: "matched", scanGeneratedAt: "2026-06-08T15:01:00.000Z" },
    proofReviewed: true,
    workflowProofAccepted: false,
    supportBundleWritten: false,
    canExportProof: true
  });
  assert.strictEqual(exportNextGuide.currentStepId, "export-proof", "workflow guide should require proof export after reviewed matched rescan");
  assert.strictEqual(exportNextGuide.primaryAction, "Export proof packet", "workflow guide should name proof export as the next handoff action");
  assert.strictEqual(exportNextGuide.primaryActionKind, "export-proof", "workflow guide should expose the proof export action kind");
  assert.strictEqual(exportNextGuide.actionEnabled, true, "workflow guide should allow proof export only when the proof export gate is ready");

  const exportBusyGuide = workflow.buildWorkflowGuide({
    nativeConnected: true,
    scan: { generatedAt: "2026-06-08T14:59:00.000Z" },
    candidates: [gateCandidate],
    selectedCandidate: gateCandidate,
    executionGate: readyExecutionGate,
    executionRecord: { accepted: true, bytes: 1024 },
    postRunProof: { status: "matched", scanGeneratedAt: "2026-06-08T15:01:00.000Z" },
    proofReviewed: true,
    workflowProofAccepted: false,
    supportBundleWritten: false,
    canExportProof: true,
    proofExportStatus: "running"
  });
  assert.strictEqual(exportBusyGuide.currentStepId, "export-proof", "workflow guide should keep export as current while proof export is running");
  assert.strictEqual(exportBusyGuide.actionBusy, true, "workflow guide should mark proof export busy during export");
  assert.strictEqual(exportBusyGuide.actionEnabled, false, "workflow guide should not allow duplicate proof export dispatch");

  const completeGuide = workflow.buildWorkflowGuide({
    nativeConnected: true,
    scan: { generatedAt: "2026-06-08T15:02:00.000Z" },
    candidates: [],
    selectedCandidate: null,
    executionGate: readyExecutionGate,
    executionRecord: { accepted: true, bytes: 1024 },
    postRunProof: { status: "matched", scanGeneratedAt: "2026-06-08T15:01:00.000Z" },
    proofReviewed: true,
    workflowProofAccepted: true,
    supportBundleWritten: true,
    canExportProof: false
  });
  assert.strictEqual(completeGuide.status, "complete", "workflow guide should mark handoff complete after accepted proof and support bundle");
  assert.strictEqual(completeGuide.currentStepId, "next-route", "workflow guide should release the operator to the next route after proof handoff");

  const repeatDuringProofHandoffGate = workflow.buildExecutionGate({
    candidate: gateCandidate,
    consentChecked: true,
    confirmationText: "RUN npm-cache",
    expectedConfirmation: "RUN npm-cache",
    executionPrerequisites: { ready: true },
    scanFingerprint: "scan-123",
    executionStatus: "complete",
    workflowLocks: positiveExecutionLocks
  });
  assert.strictEqual(repeatDuringProofHandoffGate.ready, false, "execution gate should block repeat dispatch while proof handoff is required");
  assert(repeatDuringProofHandoffGate.rows.some((row) => row.id === "proof-handoff" && !row.passed), "execution gate should expose proof handoff as the repeat-dispatch blocker");

  const noOpRepeatGate = workflow.buildExecutionGate({
    candidate: gateCandidate,
    consentChecked: true,
    confirmationText: "RUN npm-cache",
    expectedConfirmation: "RUN npm-cache",
    executionPrerequisites: { ready: true },
    scanFingerprint: "scan-123",
    executionStatus: "complete",
    workflowLocks: zeroByteNoOpLocks
  });
  assert.strictEqual(noOpRepeatGate.ready, true, "execution gate should allow dispatch after accepted no-op handoff");

  const staleBaselineAfterHandoffGate = workflow.buildExecutionGate({
    candidate: gateCandidate,
    consentChecked: true,
    confirmationText: "RUN npm-cache",
    expectedConfirmation: "RUN npm-cache",
    executionPrerequisites: { ready: true },
    scanFingerprint: "scan-before-execution",
    executionStatus: "complete",
    workflowLocks: handedOffLocks,
    executionRecord: {
      accepted: true,
      bytes: 1024,
      executedAt
    },
    activeScanGeneratedAt: "2026-06-08T14:59:00.000Z"
  });
  assert.strictEqual(staleBaselineAfterHandoffGate.ready, false, "execution gate should block next dispatch when the active scan baseline predates the accepted execution");
  assert(staleBaselineAfterHandoffGate.rows.some((row) => row.id === "baseline-scan-current" && !row.passed), "execution gate should expose stale active scan baseline as the blocker");

  const currentBaselineAfterHandoffGate = workflow.buildExecutionGate({
    candidate: gateCandidate,
    consentChecked: true,
    confirmationText: "RUN npm-cache",
    expectedConfirmation: "RUN npm-cache",
    executionPrerequisites: { ready: true },
    scanFingerprint: "scan-after-execution",
    executionStatus: "complete",
    workflowLocks: handedOffLocks,
    executionRecord: {
      accepted: true,
      bytes: 1024,
      executedAt
    },
    activeScanGeneratedAt: postRunGeneratedAt
  });
  assert.strictEqual(currentBaselineAfterHandoffGate.ready, true, "execution gate should allow next dispatch after the active scan baseline is newer than the accepted execution");

  const acceptedBaselinePromotion = workflow.buildBaselinePromotion({
    currentScan: {
      generatedAt: "2026-06-08T14:58:00.000Z",
      findings: []
    },
    postRunScan: {
      generatedAt: postRunGeneratedAt,
      findings: [{ recipeId: "npm-cache" }]
    },
    executionRecord: {
      accepted: true,
      bytes: 1024,
      executedAt
    },
    workflowProofAccepted: true,
    supportBundleWritten: true
  });
  assert.strictEqual(acceptedBaselinePromotion.canPromote, true, "accepted proof handoff should promote the newer post-run scan as the next active baseline");
  assert.strictEqual(acceptedBaselinePromotion.activeScan.generatedAt, postRunGeneratedAt, "baseline promotion should use the post-run scan");

  const staleBaselinePromotion = workflow.buildBaselinePromotion({
    currentScan: {
      generatedAt: "2026-06-08T14:58:00.000Z",
      findings: []
    },
    postRunScan: {
      generatedAt: "2026-06-08T14:59:00.000Z",
      findings: [{ recipeId: "npm-cache" }]
    },
    executionRecord: {
      accepted: true,
      bytes: 1024,
      executedAt
    },
    workflowProofAccepted: true,
    supportBundleWritten: true
  });
  assert.strictEqual(staleBaselinePromotion.canPromote, false, "baseline promotion should reject a post-run scan that predates execution");
  assert.strictEqual(staleBaselinePromotion.activeScan.generatedAt, "2026-06-08T14:58:00.000Z", "stale promotion should keep the current active scan");

  const inAppBundle = workflow.buildInAppSupportBundleReport({
    generatedAt: "2026-06-08T19:30:00.000Z",
    routeInput: "npm-cache",
    selectedFlag: "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR",
    proofArtifacts: [
      { fileName: "spaceguard-selected-route-proof-packet.md", written: true, path: "C:\\repo\\spaceguard-selected-route-proof-packet.md", bytes: 100 },
      { fileName: "spaceguard-real-workflow-proof.md", written: true, path: "C:\\repo\\spaceguard-real-workflow-proof.md", bytes: 200 },
      { fileName: "spaceguard-workflow-proof-check.json", written: true, path: "C:\\repo\\spaceguard-workflow-proof-check.json", bytes: 300 }
    ],
    workflowProofCheck: {
      schemaVersion: "spaceguard-workflow-proof-check/v1",
      status: "accepted",
      canAccept: true,
      primary: "Workflow proof for npm-cache is accepted.",
      counts: {
        reclaimedBytes: 1024,
        blockers: 0
      },
      blockers: []
    }
  });
  assert.strictEqual(inAppBundle.schemaVersion, "spaceguard-support-bundle/v1", "in-app support bundle should use the same stable schema as the CLI bundle");
  assert.strictEqual(inAppBundle.status, "handoff-ready", "accepted in-app workflow proof should make the app support bundle handoff-ready");
  assert.strictEqual(inAppBundle.readyForHandoff, true, "accepted in-app support bundle should clear handoff readiness");
  assert.strictEqual(inAppBundle.selectedRoute, "npm-cache", "in-app support bundle should preserve route input");
  assert.strictEqual(inAppBundle.selectedFlag, "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR", "in-app support bundle should preserve selected route flag");
  assert(inAppBundle.nextStep.includes("archive this bundle"), "ready in-app support bundle should produce archive-ready next step");

  const inAppBundleMarkdown = workflow.renderInAppSupportBundleMarkdown(inAppBundle);
  assert(inAppBundleMarkdown.includes("spaceguard-support-bundle/v1"), "in-app support bundle markdown should include the schema");
  assert(inAppBundleMarkdown.includes("spaceguard-selected-route-proof-packet.md"), "in-app support bundle markdown should list selected-route proof");
  assert(inAppBundleMarkdown.includes("spaceguard-real-workflow-proof.md"), "in-app support bundle markdown should list workflow proof");
  assert(inAppBundleMarkdown.includes("spaceguard-workflow-proof-check.json"), "in-app support bundle markdown should list workflow proof check");
  assert(inAppBundleMarkdown.includes("Workflow proof for npm-cache is accepted."), "in-app support bundle markdown should include proof summary");

  const queueCandidate = {
    id: "npm-cache:C:\\Users\\LocalUser\\AppData\\Local\\npm-cache\\_cacache",
    title: "npm cache",
    route: "bounded-npm-cache-delete",
    routeInput: "npm-cache",
    actionType: "run-npm-cache-executor",
    targetId: "npm-cache:C:\\Users\\LocalUser\\AppData\\Local\\npm-cache\\_cacache",
    bytes: 512 * 1024 * 1024,
    canExecute: true,
    envVar: "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR",
    blockedReason: ""
  };
  const readyAgentQueue = workflow.buildAppAgentTaskQueue({
    cleanupQueue: [queueCandidate],
    execution: {
      proofStatus: "waiting-for-execution",
      proofAllowsNextExecutor: true,
      consentMatchesPlan: true,
      scanFingerprintPresent: true
    }
  });
  assert.strictEqual(readyAgentQueue.schemaVersion, "spaceguard-app-agent-task-queue/v1", "app agent task queue should expose a stable schema");
  assert(readyAgentQueue.rows.some((row) => row.source === "scoped-executor" && row.status === "ready"), "app agent task queue should expose ready executor rows only after current consent exists");

  const manualOnlyAgentQueue = workflow.buildAppAgentTaskQueue({
    cleanupQueue: [],
    manualReviewTargets: [
      {
        id: "manual:wsl-vhdx:C:\\Users\\LocalUser\\AppData\\Local\\Packages\\Ubuntu\\LocalState\\ext4.vhdx",
        title: "WSL virtual disk compaction",
        route: "tool-owned-data-review",
        bytes: 20 * 1024 * 1024 * 1024,
        reason: "Shut down WSL and compact manually after backup/review."
      }
    ],
    execution: {
      proofStatus: "waiting-for-execution",
      proofAllowsNextExecutor: true,
      consentMatchesPlan: false,
      scanFingerprintPresent: true
    }
  });
  const manualOnlyRow = manualOnlyAgentQueue.rows.find((row) => row.source === "manual-review");
  assert.strictEqual(manualOnlyRow.status, "manual-only", "manual review targets should become manual-only app agent rows");
  assert.strictEqual(manualOnlyRow.canExecuteNow, false, "manual review targets must not become executable recommendations");
  assert(manualOnlyRow.checks.some((check) => check.id === "no-executor" && check.passed), "manual review rows should state that no executor is mapped");
  assert.strictEqual(manualOnlyAgentQueue.counts.manual, 1, "manual review rows should be counted separately from executor rows");

  const preConsentAgentQueue = workflow.buildAppAgentTaskQueue({
    cleanupQueue: [queueCandidate],
    execution: {
      proofStatus: "waiting-for-execution",
      proofAllowsNextExecutor: true,
      consentMatchesPlan: false,
      scanFingerprintPresent: true
    }
  });
  const preConsentExecutor = preConsentAgentQueue.rows.find((row) => row.source === "scoped-executor");
  assert.strictEqual(preConsentExecutor.status, "blocked", "app agent task queue should not mark executor rows ready before current consent");
  assert.strictEqual(preConsentExecutor.blocker, "consent", "pre-consent executor rows should name consent as the blocker");

  const rescanAgentQueue = workflow.buildAppAgentTaskQueue({
    cleanupQueue: [queueCandidate],
    execution: {
      accepted: true,
      proofStatus: "needs-rescan",
      proofAllowsNextExecutor: false,
      canRunPostRunRescan: true,
      rescanComparisonStatus: "needs-rescan",
      postRunScanEvidence: false
    }
  });
  assert(rescanAgentQueue.rows.some((row) => row.source === "post-run-proof" && row.actionType === "rescan"), "app agent task queue should prioritize post-run rescan while proof is pending");
  assert(!rescanAgentQueue.rows.some((row) => row.source === "scoped-executor" && row.status === "ready"), "app agent task queue should not expose ready executor rows before proof handoff is complete");

  const noOpAgentQueue = workflow.buildAppAgentTaskQueue({
    cleanupQueue: [queueCandidate],
    execution: {
      accepted: true,
      noOpExecution: true,
      proofStatus: "proof-not-required-no-op",
      proofAllowsNextExecutor: true,
      canRunPostRunRescan: true,
      rescanComparisonStatus: "needs-rescan",
      postRunScanEvidence: false,
      consentMatchesPlan: true,
      scanFingerprintPresent: true
    }
  });
  assert(!noOpAgentQueue.rows.some((row) => row.source === "post-run-proof"), "accepted no-op executions should not force a post-run proof task");
  assert(noOpAgentQueue.rows.some((row) => row.source === "scoped-executor" && row.status === "ready"), "accepted no-op executions should allow ready executor rows");

  const supportAgentQueue = workflow.buildAppAgentTaskQueue({
    cleanupQueue: [queueCandidate],
    execution: {
      accepted: true,
      proofStatus: "proof-complete",
      proofAllowsNextExecutor: false,
      workflowProofCheckCanAccept: true,
      supportBundleWritten: false,
      rescanComparisonStatus: "matched",
      postRunScanEvidence: true
    }
  });
  assert(supportAgentQueue.rows.some((row) => row.source === "support-bundle" && row.targetId === "spaceguard-support-bundle"), "app agent task queue should prioritize support bundle capture after accepted proof");
  assert(!supportAgentQueue.rows.some((row) => row.source === "scoped-executor" && row.status === "ready"), "support-bundle handoff should block ready executor rows");

  const handedOffAgentQueue = workflow.buildAppAgentTaskQueue({
    cleanupQueue: [queueCandidate],
    execution: {
      accepted: true,
      proofStatus: "proof-complete",
      proofAllowsNextExecutor: true,
      workflowProofCheckCanAccept: true,
      supportBundleWritten: true,
      rescanComparisonStatus: "matched",
      postRunScanEvidence: true,
      consentMatchesPlan: true,
      scanFingerprintPresent: true
    }
  });
  assert(handedOffAgentQueue.rows.some((row) => row.source === "scoped-executor" && row.status === "ready"), "app agent task queue should restore executor rows after support bundle handoff");

  const stillPresent = workflow.buildPostRunProof({
    candidate: selectedInstaller,
    executionRecord: {
      executedAt,
      bytes: 128 * 1024 * 1024
    },
    postRunScan: {
      generatedAt: postRunGeneratedAt,
      findings: [
        {
          recipeId: "downloads-installers",
          path: "C:\\Users\\LocalUser\\Downloads",
          bytes: 640 * 1024 * 1024,
          items: [
            {
              id: "setup-old",
              path: "C:\\Users\\LocalUser\\Downloads\\setup-old.exe",
              bytes: 128 * 1024 * 1024
            }
          ]
        }
      ]
    }
  });

  assert.strictEqual(stillPresent.status, "review-needed", "selected item proof should fail if the selected item is still present");
  assert.strictEqual(stillPresent.actualBytes, 128 * 1024 * 1024, "selected item proof should report remaining selected item bytes");

  const rootCandidate = {
    id: "npm-cache:C:\\Users\\LocalUser\\AppData\\Local\\npm-cache\\_cacache",
    recipeId: "npm-cache",
    route: "bounded-npm-cache-delete",
    routeInput: "npm-cache",
    targetPath: "C:\\Users\\LocalUser\\AppData\\Local\\npm-cache\\_cacache",
    bytes: 300 * 1024 * 1024,
    sourceFinding: {
      recipeId: "npm-cache",
      path: "C:\\Users\\LocalUser\\AppData\\Local\\npm-cache\\_cacache"
    }
  };
  const rootProof = workflow.buildPostRunProof({
    candidate: rootCandidate,
    executionRecord: {
      executedAt,
      bytes: 250 * 1024 * 1024
    },
    postRunScan: {
      generatedAt: postRunGeneratedAt,
      findings: [
        {
          recipeId: "npm-cache",
          path: "C:\\Users\\LocalUser\\AppData\\Local\\npm-cache\\_cacache",
          bytes: 40 * 1024 * 1024
        }
      ]
    }
  });

  assert.strictEqual(rootProof.status, "matched", "root proof should keep using root finding bytes");
  assert.strictEqual(rootProof.targetEvidence.kind, "finding", "root proof should record finding-level evidence");

  const npmRecipe = {
    route: "bounded-npm-cache-delete",
    flagKey: "npmCacheExecutor",
    envVar: "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR",
    executor: "npm"
  };
  const readyRuntime = {
    windows: true,
    executeCleanupPlan: true,
    executorScopeStatus: "single-scoped-flag",
    executorFlags: { npmCacheExecutor: true },
    realRunEnabled: true,
    destructiveCommands: true
  };
  const readyStatus = workflow.buildRouteReadiness({
    recipe: npmRecipe,
    finding: { status: "measured" },
    runtime: readyRuntime
  });

  assert.strictEqual(readyStatus.canExecute, true, "ready route should pass every guardrail");
  assert.deepStrictEqual(
    readyStatus.rows.map((row) => row.id),
    ["native-runtime", "executor-command", "single-route-scope", "route-flag", "selected-route-setup", "real-run-authority", "native-finding-status"],
    "route readiness should expose each execution guardrail in order"
  );
  assert(readyStatus.rows.every((row) => row.passed), "ready route readiness rows should all pass");

  const missingFlag = workflow.buildRouteReadiness({
    recipe: npmRecipe,
    finding: { status: "measured" },
    runtime: {
      ...readyRuntime,
      executorFlags: { npmCacheExecutor: false },
      realRunEnabled: false
    }
  });
  assert.strictEqual(missingFlag.canExecute, false, "missing route flag should block execution");
  assert.strictEqual(missingFlag.blockedReason, "Set SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR=1 in .env and restart the desktop app.");
  assert.strictEqual(missingFlag.rows.find((row) => row.id === "route-flag").status, "blocked", "route flag row should fail explicitly");
  assert(missingFlag.rows.find((row) => row.id === "route-flag").detail.includes("SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR=1"), "route flag row should show exact env var");

  const multiFlag = workflow.buildRouteReadiness({
    recipe: npmRecipe,
    finding: { status: "measured" },
    runtime: {
      ...readyRuntime,
      executorScopeStatus: "multiple-scoped-flags",
      enabledScopedExecutorFlags: ["SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR", "SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR"]
    }
  });
  assert.strictEqual(multiFlag.canExecute, false, "multiple route flags should block execution");
  assert(multiFlag.rows.find((row) => row.id === "single-route-scope").detail.includes("SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR"), "scope row should show enabled flags");

  const tempRoute = workflow.buildRouteReadiness({
    recipe: { route: "known-temp-delete", flagKey: "tempCleanupExecutor", envVar: "SPACEGUARD_ENABLE_TEMP_EXECUTOR", executor: "temp" },
    finding: { status: "measured" },
    runtime: {
      ...readyRuntime,
      executorFlags: { tempCleanupExecutor: true }
    }
  });
  assert.strictEqual(tempRoute.canExecute, true, "known-temp-delete should not require prior first-route proof");

  const npmSetup = workflow.buildRouteSetupChecklist({
    route: {
      routeInput: "npm-cache",
      route: "bounded-npm-cache-delete",
      label: "npm cache cleanup",
      envVar: "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR"
    },
    runtime: {
      executorScopeStatus: "no-scoped-flags",
      executorFlags: { npmCacheExecutor: false },
      enabledScopedExecutorFlags: [],
      openAiAdvisorConfigured: true
    }
  });

  assert.strictEqual(npmSetup.schemaVersion, "spaceguard-route-setup-checklist/v1", "route setup checklist should expose a stable schema");
  assert.strictEqual(npmSetup.routeInput, "npm-cache", "route setup should preserve selected route input");
  assert.strictEqual(npmSetup.ready, false, "npm setup should not be ready without the route flag");
  assert(!Object.prototype.hasOwnProperty.call(npmSetup, "requiresFirstRouteProof"), "route setup should not expose seeded proof requirements");
  assert(npmSetup.steps.some((step) => step.id === "route-flag" && step.command === "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR=1"), "setup should show exact env flag");
  assert(npmSetup.steps.some((step) => step.command === "npm run setup:route -- --route npm-cache"), "setup should show route setup command");
  assert(npmSetup.steps.some((step) => step.command === "npm run openai:smoke -- --route npm-cache"), "setup should show live OpenAI smoke command");
  assert(npmSetup.steps.some((step) => step.command.includes("validate:workflow-proof")), "setup should show app proof export validation command");
  assert(npmSetup.blockers.some((blocker) => blocker.id === "route-flag"), "missing route flag should be a blocker");
  assert.strictEqual(npmSetup.envBlock.schemaVersion, "spaceguard-route-env-block/v1", "route setup should expose a stable selected .env block schema");
  assert.strictEqual(npmSetup.envBlock.fileName, ".env", "route setup env block should target .env");
  assert.strictEqual(npmSetup.envBlock.selectedEnvVar, "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR", "route setup env block should mark the selected route flag");
  assert.strictEqual(npmSetup.runbook.schemaVersion, "spaceguard-windows-real-test-runbook/v1", "route setup should expose a Windows test runbook");
  assert.strictEqual(npmSetup.runbook.routeInput, "npm-cache", "Windows test runbook should preserve route input");
  assert(npmSetup.runbook.commands.some((row) => row.command === "npm run setup:doctor"), "Windows test runbook should include setup doctor");
  assert(npmSetup.runbook.commands.some((row) => row.command === "npm run route:arm -- --route npm-cache"), "Windows test runbook should include route arming");
  assert(npmSetup.runbook.commands.some((row) => row.command === "npm run openai:smoke -- --local-contract --route npm-cache"), "Windows test runbook should include offline route-contract smoke");
  assert(npmSetup.runbook.commands.some((row) => row.command === "npm run openai:smoke -- --route npm-cache"), "Windows test runbook should include live OpenAI smoke");
  assert(npmSetup.runbook.commands.some((row) => row.command === "npm run windows:dev -- --route npm-cache"), "Windows test runbook should launch the guarded desktop app");
  assert(npmSetup.runbook.commands.some((row) => row.command === "npm run validate:workflow-proof -- --file spaceguard-real-workflow-proof.md"), "Windows test runbook should include proof verifier");
  assert(npmSetup.runbook.commands.some((row) => row.command === "npm run support:bundle"), "Windows test runbook should include support bundle capture");
  assert(npmSetup.runbook.appSteps.some((row) => row.id === "execute-route"), "Windows test runbook should include the app execution step");
  assert(npmSetup.runbook.appSteps.some((row) => row.id === "support-bundle"), "Windows test runbook should include support bundle app step");
  assert(npmSetup.runbook.guardrails.some((row) => row.id === "one-route"), "Windows test runbook should keep the one-route guardrail visible");
  assert(npmSetup.runbook.content.includes("Windows real-route test runbook"), "Windows test runbook should expose copyable markdown");
  assert(!npmSetup.runbook.commands.some((row) => row.command === "Copy-Item .env.example .env"), "Windows test runbook should rely on route:arm to create or update .env");
  assert(!npmSetup.runbook.content.includes("validate:route"), "Windows test runbook must not include removed validation commands");
  assert(npmSetup.envBlock.content.includes("OPENAI_API_KEY=sk-..."), "route setup env block should include the OpenAI placeholder");
  assert(npmSetup.envBlock.content.includes("SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR=1"), "route setup env block should enable the selected route");
  assert(npmSetup.envBlock.content.includes("SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR=0"), "route setup env block should disable competing route flags");
  assert(!npmSetup.envBlock.content.includes("SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK"), "real-data route env block must not include seeded proof env vars");
  assert(!npmSetup.envBlock.content.includes("first-route-completion-check.json"), "real-data route env block must not require seeded proof artifacts");
  assert.strictEqual(
    npmSetup.envBlock.executorFlagLines.filter((line) => line.endsWith("=1")).length,
    1,
    "route setup env block should enable exactly one executor flag"
  );
  assert(npmSetup.steps.some((step) => step.id === "env-block" && step.command === "npm run route:arm -- --route npm-cache"), "setup should include route arming before launch");

  const tempSetup = workflow.buildRouteSetupChecklist({
    route: {
      routeInput: "known-temp-delete",
      route: "known-temp-delete",
      label: "Windows temp cleanup",
      envVar: "SPACEGUARD_ENABLE_TEMP_EXECUTOR"
    },
    runtime: {
      executorScopeStatus: "single-scoped-flag",
      executorFlags: { tempCleanupExecutor: true },
      enabledScopedExecutorFlags: ["SPACEGUARD_ENABLE_TEMP_EXECUTOR"],
      openAiAdvisorConfigured: false
    }
  });

  assert(!Object.prototype.hasOwnProperty.call(tempSetup, "requiresFirstRouteProof"), "known-temp setup should not expose prior proof ceremony");
  assert(tempSetup.envBlock.content.includes("SPACEGUARD_ENABLE_TEMP_EXECUTOR=1"), "known-temp env block should enable the temp route");
  assert(!tempSetup.envBlock.content.includes("SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK"), "known-temp env block should not include prior proof env vars");

  const multiFlagSetup = workflow.buildRouteSetupChecklist({
    route: {
      routeInput: "gradle-cache",
      route: "bounded-cache-delete",
      label: "Gradle cache cleanup",
      envVar: "SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR"
    },
    runtime: {
      executorScopeStatus: "multiple-scoped-flags",
      enabledScopedExecutorFlags: ["SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR", "SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR"],
      executorFlags: { gradleCacheExecutor: true },
      openAiAdvisorConfigured: true
    }
  });

  assert.strictEqual(multiFlagSetup.ready, false, "multi-flag setup should not be ready");
  assert(multiFlagSetup.blockers.find((blocker) => blocker.id === "single-route-scope").detail.includes("SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR"), "multi-flag blocker should name enabled flags");

  const installedAppGuidance = workflow.buildManualFindingGuidance({
    recipeId: "installed-app-footprints",
    title: "Installed app footprints",
    path: "Windows uninstall inventory",
    bytes: 8 * 1024 * 1024 * 1024,
    status: "measured"
  });
  assert.strictEqual(installedAppGuidance.schemaVersion, "spaceguard-manual-finding-guidance/v1", "manual guidance should expose a stable schema");
  assert.strictEqual(installedAppGuidance.kind, "installed-app-review", "installed app findings should use app review guidance");
  assert.strictEqual(installedAppGuidance.primaryAction, "Review in Windows Settings before uninstalling.", "installed app guidance should point to Windows uninstall review");
  assert.strictEqual(installedAppGuidance.command, "ms-settings:appsfeatures", "installed app guidance should expose the Windows settings URI");
  assert(installedAppGuidance.blockedActions.includes("Do not delete application folders directly."), "installed app guidance should block raw folder deletion");

  const customRootGuidance = workflow.buildManualFindingGuidance({
    recipeId: "custom-root-0",
    title: "Custom root",
    path: "D:\\Archive",
    bytes: 20 * 1024 * 1024 * 1024,
    status: "measured"
  });
  assert.strictEqual(customRootGuidance.kind, "manual-filesystem-review", "custom roots should stay manual filesystem review");
  assert.strictEqual(customRootGuidance.command, "explorer.exe /select,\"D:\\Archive\"", "custom root guidance should expose an Explorer review command");
  assert(customRootGuidance.blockedActions.includes("No SpaceGuard executor is mapped to this finding."), "custom root guidance should block unmapped execution");

  const windowsOldGuidance = workflow.buildManualFindingGuidance({
    recipeId: "windows-old",
    title: "Previous Windows installation",
    path: "C:\\Windows.old",
    bytes: 14 * 1024 * 1024 * 1024,
    status: "measured"
  });
  assert.strictEqual(windowsOldGuidance.kind, "windows-servicing-review", "Windows.old should route to Windows servicing review");
  assert.strictEqual(windowsOldGuidance.command, "cleanmgr.exe", "Windows.old guidance should point to Windows cleanup tooling");
  assert(windowsOldGuidance.blockedActions.includes("Do not delete Windows.old directly from File Explorer."), "Windows.old guidance should block direct folder deletion");

  const hibernationGuidance = workflow.buildManualFindingGuidance({
    recipeId: "hibernation",
    title: "Disable hibernation file",
    path: "C:\\hiberfil.sys",
    bytes: 8 * 1024 * 1024 * 1024,
    status: "measured"
  });
  assert.strictEqual(hibernationGuidance.kind, "advanced-system-setting", "hibernation file should stay an advanced system setting");
  assert(hibernationGuidance.command.includes("powercfg /hibernate off"), "hibernation guidance should point to the OS setting command");
  assert(hibernationGuidance.blockedActions.includes("Do not delete hiberfil.sys manually."), "hibernation guidance should block raw system file deletion");

  const pagefileGuidance = workflow.buildManualFindingGuidance({
    recipeId: "pagefile",
    title: "Pagefile size changes",
    path: "C:\\pagefile.sys",
    bytes: 12 * 1024 * 1024 * 1024,
    status: "measured"
  });
  assert.strictEqual(pagefileGuidance.command, "SystemPropertiesAdvanced.exe", "pagefile guidance should open Windows virtual memory settings");
  assert(pagefileGuidance.blockedActions.includes("Do not delete pagefile.sys manually."), "pagefile guidance should block direct deletion");

  const wslGuidance = workflow.buildManualFindingGuidance({
    recipeId: "wsl-vhdx",
    title: "WSL virtual disk compaction",
    path: "C:\\Users\\LocalUser\\AppData\\Local\\Packages\\Ubuntu\\LocalState\\ext4.vhdx",
    bytes: 20 * 1024 * 1024 * 1024,
    status: "measured"
  });
  assert.strictEqual(wslGuidance.kind, "tool-owned-data-review", "WSL VHDX should route to tool-owned data review");
  assert(wslGuidance.command.includes("wsl --shutdown"), "WSL VHDX guidance should require WSL shutdown before review");
  assert(wslGuidance.blockedActions.includes("Do not delete ext4.vhdx directly unless removing the distro intentionally."), "WSL VHDX guidance should block direct disk deletion");

  const installedAppRows = workflow.buildManualFindingReviewRows({
    recipeId: "installed-app-footprints",
    items: [
      {
        id: "app-old-ide",
        name: "Old IDE 2023",
        path: "C:\\Program Files\\Old IDE 2023",
        bytes: 6 * 1024 * 1024 * 1024,
        recommendation: "review",
        reason: "Manual uninstall candidate",
        signals: [
          { label: "usage proof", value: "not proven", tone: "restricted" },
          { label: "uninstall entry", value: "present", tone: "safe" }
        ]
      },
      {
        id: "app-unity-hub",
        name: "Unity Hub",
        path: "C:\\Program Files\\Unity Hub",
        bytes: 4 * 1024 * 1024 * 1024,
        recommendation: "keep",
        reason: "Read-only app usage evidence found via UserAssist launch evidence matching Unity Hub.",
        signals: [
          { label: "usage proof", value: "UserAssist launch evidence", tone: "safe" },
          { label: "usage match", value: "name match: unity hub", tone: "safe" }
        ]
      }
    ]
  });
  assert.strictEqual(installedAppRows.schemaVersion, "spaceguard-manual-review-rows/v1", "manual review rows should expose a stable schema");
  assert.strictEqual(installedAppRows.rows.length, 2, "manual review rows should preserve visible installed-app candidates");
  assert.strictEqual(installedAppRows.rows[0].action, "review-uninstall", "unused-app candidates should be review-only uninstall hints");
  assert.strictEqual(installedAppRows.rows[0].actionLabel, "Review uninstall");
  assert.strictEqual(installedAppRows.rows[0].blockedAction, "Do not delete this folder directly.");
  assert(installedAppRows.rows[0].signals.some((signal) => signal.label === "usage proof" && signal.value === "not proven"), "review row should preserve missing usage proof");
  assert.strictEqual(installedAppRows.rows[1].action, "keep-installed", "apps with usage evidence should not be framed as uninstall candidates");
  assert(installedAppRows.rows[1].signals.some((signal) => signal.label === "usage proof" && signal.value === "UserAssist launch evidence"), "keep row should preserve usage evidence");

  console.log("real workflow ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
