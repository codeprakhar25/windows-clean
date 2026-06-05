import { pathToFileURL } from "node:url";

import {
  GB,
  buildExecutionConsentReceipt,
  buildExecutionPreflight,
  buildExecutorManifest,
  buildExecutorPlan,
  buildExecutorReadiness,
  buildFirstSafeExecutorContract,
  buildFirstSafeImplementationWorkOrder,
  buildFirstSafeValidationGate,
  buildDryRunLaunchGuard,
  buildIntakePolicy,
  buildPlanLock,
  buildPlanSnapshot,
  buildPrivacyBoundary,
  buildRealExecutorCapsule,
  buildReleaseGate,
  buildRiskBudget,
  buildRunReadiness,
  buildSafetyInterlock,
  buildScanCoverageSummary,
  buildScanSessionEvidence,
  buildTaskCapabilityGrants,
  buildTaskPowerBroker,
  buildTaskPowerCatalog,
  buildTaskPowerLeaseAudit,
  buildValidationEvidencePack,
  buildWriteBoundaryProbe,
  buildWriteReadiness,
  buildWindowsSetupAssistant,
  buildScenarioActions,
  getExecutionReadinessForActions,
  makeExecutionLedgerForActions
} from "../src/spaceguard-model.mjs";
import { mergeNativeScanIntoActions, normalizeNativeScan } from "../src/native-scanner.mjs";

export function buildNativeReadonlyRehearsalSummary() {
  const executedAt = "2026-06-04T00:00:00.000Z";
  const scanSettings = {
    targetDrive: "C:",
    includeProjectArtifacts: true,
    maxDepth: 8,
    maxEntriesPerRoot: 25000,
    customRoots: []
  };
  const runtimeCapabilities = {
    available: true,
    mode: "native-readonly",
    platform: "windows",
    windows: true,
    elevated: false,
    elevationSource: "IsUserAnAdmin",
    realRunEnabled: false,
    destructiveCommands: false,
    scanKnownRoots: true,
    simulateCleanupPlan: true,
    executeCleanupPlan: true,
    safeExecutorsEnabled: false
  };
  const nativeScan = normalizeNativeScan({
    available: true,
    mode: "native-readonly",
    platform: "windows",
    windows: true,
    target_drive: "C:",
    generated_at: "2026-06-04T00:00:00.000Z",
    scan_request: {
      protected_paths: [],
      include_project_artifacts: true,
      max_depth: 8,
      max_entries_per_root: 25000,
      target_drive: "C:",
      custom_roots: []
    },
    volume: {
      drive: "C:",
      total_bytes: 512 * GB,
      used_bytes: 488 * GB,
      free_bytes: 24 * GB,
      source: "GetDiskFreeSpaceExW"
    },
    findings: [
      {
        recipe_id: "windows-temp",
        title: "Windows temporary files",
        path: "%TEMP%, C:\\Windows\\Temp",
        bytes: 4 * GB,
        status: "measured",
        files: 1800,
        dirs: 80,
        errors: 0,
        note: "Synthetic native read-only rehearsal evidence."
      },
      {
        recipe_id: "browser-cache",
        title: "Browser cache only",
        path: "C:\\Users\\demo\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache",
        bytes: 2 * GB,
        status: "measured",
        files: 900,
        dirs: 12,
        errors: 0,
        note: "Synthetic cache-only evidence; identity stores excluded."
      },
      {
        recipe_id: "recycle-bin",
        title: "Recycle Bin",
        path: "C:\\$Recycle.Bin",
        bytes: 3 * GB,
        status: "measured",
        files: 120,
        dirs: 4,
        errors: 0,
        note: "Synthetic Recycle Bin inventory evidence."
      },
      {
        recipe_id: "gradle-cache",
        title: "Gradle dependency and build cache",
        path: "C:\\Users\\demo\\.gradle\\caches",
        bytes: 6 * GB,
        status: "limited",
        files: 2400,
        dirs: 300,
        errors: 2,
        note: "Limited synthetic evidence with inaccessible entries."
      },
      {
        recipe_id: "browser-identity",
        title: "Browser cookies, sessions, saved logins",
        path: "Browser profile identity stores",
        bytes: 0,
        status: "unsupported",
        note: "Policy-blocked identity stores are not scanned."
      }
    ],
    warnings: [],
    write_capability: false,
    destructive_commands: false
  });
  const actionList = mergeNativeScanIntoActions(buildScenarioActions("developer"), nativeScan);
  const selectedIds = new Set(["windows-temp", "browser-cache", "recycle-bin"]);
  const approvals = {
    groupConfirm: true,
    permanentConfirm: true,
    reviewed: {},
    reviewItems: {},
    typed: {}
  };
  const intakePolicy = buildIntakePolicy({
    targetDrive: "C:",
    goalBytes: 20 * GB,
    mode: "safe",
    protectedPaths: [],
    adminAllowed: false
  });
  const scanSession = buildScanSessionEvidence({
    scanned: true,
    scanning: false,
    scanMode: "native-readonly",
    scanSettings,
    protectedPaths: [],
    nativeScan
  });
  const scanCoverage = buildScanCoverageSummary({
    actionList,
    scanMode: "native-readonly",
    nativeScan
  });
  const readiness = getExecutionReadinessForActions(selectedIds, approvals, actionList, [], null, intakePolicy);
  const riskBudget = buildRiskBudget({ actionList, selectedIds, intakePolicy });
  const planSnapshot = buildPlanSnapshot({
    selectedIds,
    actionList,
    approvals,
    protectedPaths: [],
    scanMode: "native-readonly",
    goalBytes: intakePolicy.goalBytes,
    intakePolicy,
    scanSession
  });
  const waitingPlanLock = buildPlanLock({ planSnapshot, scanSession, riskBudget });
  const preflight = buildExecutionPreflight({
    scanned: true,
    scanning: false,
    selectedIds,
    actionList,
    readiness,
    protectedPaths: [],
    ledger: [],
    planSnapshot,
    scanSession,
    riskBudget,
    planLock: waitingPlanLock
  });
  const executorPlan = buildExecutorPlan({
    selectedIds,
    actionList,
    approvals,
    protectedPaths: [],
    scanMode: "native-readonly",
    preflight,
    intakePolicy
  });
  const runReadiness = buildRunReadiness(preflight, buildExecutorReadiness(executorPlan, preflight));
  const consent = {
    accepted: true,
    planId: planSnapshot.id,
    planLockId: waitingPlanLock.lockId,
    acceptedAt: executedAt
  };
  const planLock = buildPlanLock({ planSnapshot, scanSession, riskBudget, consent });
  const consentReceipt = buildExecutionConsentReceipt({
    planSnapshot,
    executorPlan,
    runReadiness,
    consent,
    planLock
  });
  const releaseGate = buildReleaseGate({
    scanMode: "native-readonly",
    nativeCapability: { available: true },
    executorPlan
  });
  const writeReadiness = buildWriteReadiness({
    releaseGate,
    runtimeCapabilities,
    executorPlan,
    consentReceipt,
    runReadiness
  });
  const executorManifest = buildExecutorManifest({
    actionList,
    executorPlan,
    releaseGate
  });
  const realExecutorCapsule = buildRealExecutorCapsule({
    executorManifest,
    executorPlan,
    releaseGate,
    writeReadiness,
    runtimeCapabilities
  });
  const firstSafeExecutorContract = buildFirstSafeExecutorContract({
    realExecutorCapsule,
    executorPlan,
    planSnapshot,
    scanSession,
    consentReceipt,
    releaseGate,
    runtimeCapabilities
  });
  const writeBoundaryProbe = buildWriteBoundaryProbe({
    realExecutorCapsule,
    firstSafeExecutorContract,
    runtimeCapabilities
  });
  const validationPack = buildValidationEvidencePack({
    releaseGate,
    executorPlan,
    executorManifest,
    scanMode: "native-readonly",
    runtimeCapabilities,
    nativeScan
  });
  const firstSafeValidationGate = buildFirstSafeValidationGate({
    executorManifest,
    validationPack,
    releaseGate,
    realExecutorCapsule,
    firstSafeExecutorContract,
    writeBoundaryProbe,
    runtimeCapabilities
  });
  const firstSafeImplementationWorkOrder = buildFirstSafeImplementationWorkOrder({
    firstSafeValidationGate,
    realExecutorCapsule,
    firstSafeExecutorContract,
    writeBoundaryProbe,
    runtimeCapabilities
  });
  const taskPowerCatalog = buildTaskPowerCatalog({
    actionList,
    selectedIds,
    approvals,
    protectedPaths: [],
    intakePolicy,
    runtimeCapabilities,
    scanMode: "native-readonly"
  });
  const taskCapabilityGrants = buildTaskCapabilityGrants({
    executorPlan,
    taskPowerCatalog,
    planSnapshot,
    scanSession,
    consentReceipt,
    runtimeCapabilities
  });
  const taskPowerBroker = buildTaskPowerBroker({
    taskPowerCatalog,
    taskCapabilityGrants,
    agentQuestionQueue: { activeQuestion: null },
    runReadiness,
    runtimeCapabilities
  });
  const taskPowerLeaseAudit = buildTaskPowerLeaseAudit({
    taskCapabilityGrants,
    taskPowerBroker,
    planSnapshot,
    scanSession,
    consentReceipt,
    runtimeCapabilities
  });
  const privacyBoundary = buildPrivacyBoundary({
    scanMode: "native-readonly",
    nativeScan,
    runHistory: [],
    validationEvidence: {},
    runtimeCapabilities
  });
  const windowsSetupAssistant = buildWindowsSetupAssistant({
    nativeCapability: { available: true },
    runtimeCapabilities,
    scanMode: "native-readonly",
    scanSession,
    scanCoverage,
    privacyBoundary,
    publicBetaReadiness: { readyForNativeBeta: false },
    validationPack: { readyForRealRun: false },
    releaseGate: { readyForRealRun: false }
  });
  const safetyInterlock = buildSafetyInterlock({
    runtimeCapabilities,
    nativeScan,
    scanSession,
    runReadiness,
    consentReceipt,
    planLock,
    executorPlan,
    taskPowerBroker,
    taskCapabilityGrants,
    taskPowerLeaseAudit,
    writeBoundaryProbe: { status: "not-run" },
    releaseReviewPacket: { status: "waiting-evidence", writeSignalVisible: false },
    writeReadiness: { readyForRealExecution: false, primary: "Real execution remains locked.", status: "implementation-locked" }
  });
  const dryRunLaunchGuard = buildDryRunLaunchGuard({
    runReadiness,
    consentReceipt,
    safetyInterlock,
    planLock
  });
  const ledger = makeExecutionLedgerForActions(selectedIds, actionList, [], { approvals, planSnapshot, executedAt });

  const failures = [
    ["native scan current", scanSession.status === "native-current" && scanSession.readyForPlanning],
    ["native scan is read-only", !nativeScan.writeCapability && !nativeScan.destructiveCommands],
    ["coverage uses native evidence", scanCoverage.scanMode === "native-readonly" && scanCoverage.measuredBytes > 0],
    ["setup assistant native-ready", windowsSetupAssistant.status === "native-scan-ready"],
    ["privacy boundary local-only", privacyBoundary.status === "native-local-only"],
    ["risk budget satisfied", riskBudget.status === "within-risk-budget"],
    ["preflight ready", preflight.ready],
    ["run readiness ready", runReadiness.ready],
    ["plan lock launch-ready", planLock.readyForLaunch],
    ["consent receipt ready", consentReceipt.ready],
    ["task leases current", taskPowerLeaseAudit.status === "leases-current"],
    ["safety interlock allows dry-run", safetyInterlock.dryRunAllowed],
    ["dry-run launch guard ready", dryRunLaunchGuard.ready],
    ["ledger captured", ledger.length > 0],
    ["real cleanup locked", !runtimeCapabilities.realRunEnabled],
    ["first-safe work order validation-blocked", firstSafeImplementationWorkOrder.status === "validation-blocked"],
    ["first-safe work order keeps real run locked", !firstSafeImplementationWorkOrder.realRunAllowed && !firstSafeImplementationWorkOrder.destructiveActionAvailable],
    ["destructive commands absent", !runtimeCapabilities.destructiveCommands],
    ["zero real-run rows", planLock.counts.realRun === 0 && dryRunLaunchGuard.counts.realRun === 0]
  ].filter(([, passed]) => !passed);

  return {
    schemaVersion: "spaceguard-native-readonly-run/v1",
    status: failures.length ? "failed" : "passed",
    scanMode: "native-readonly",
    scanStatus: scanSession.status,
    coverageStatus: scanCoverage.status,
    setupStatus: windowsSetupAssistant.status,
    privacyStatus: privacyBoundary.status,
    planId: planSnapshot.id,
    planLockId: planLock.lockId,
    selectedCount: selectedIds.size,
    dryRunRows: executorPlan.dryRunCount,
    ledgerRows: ledger.length,
    measuredBytes: scanCoverage.measuredBytes,
    safetyStatus: safetyInterlock.status,
    launchStatus: dryRunLaunchGuard.status,
    workOrderStatus: firstSafeImplementationWorkOrder.status,
    realRunEnabled: false,
    destructiveCommands: false,
    failures: failures.map(([label]) => label)
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const summary = buildNativeReadonlyRehearsalSummary();
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failures.length) {
    process.exitCode = 1;
  }
}
