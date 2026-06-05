import {
  GB,
  appendLedgerRunRecord,
  buildAgentQuestionQueue,
  buildAgentTaskRunbook,
  buildDemoRehearsalRunbook,
  buildDryRunLaunchGuard,
  buildExecutionConsentReceipt,
  buildExecutionPreflight,
  buildExecutorManifest,
  buildExecutorPlan,
  buildExecutorReadiness,
  buildFirstSafeExecutorContract,
  buildFirstSafeImplementationWorkOrder,
  buildFirstSafeValidationGate,
  buildIntakePolicy,
  buildLedgerRunRecord,
  buildPlanLock,
  buildPlanSnapshot,
  buildRealExecutorCapsule,
  buildReleaseGate,
  buildRestrictionPolicyMatrix,
  buildRiskBudget,
  buildRunReadiness,
  buildSafetyInterlock,
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
  getScenario,
  makeExecutionLedgerForActions,
  selectedByDefault
} from "../src/spaceguard-model.mjs";
import { pathToFileURL } from "node:url";

export function buildDemoRehearsalSummary() {
const executedAt = "2026-06-04T00:00:00.000Z";
const scenarioId = "developer";
const scenario = getScenario(scenarioId);
const scanSettings = {
  targetDrive: "C:",
  includeProjectArtifacts: true,
  maxDepth: 8,
  maxEntriesPerRoot: 25000,
  customRoots: []
};
const runtimeCapabilities = {
  available: false,
  mode: "browser-demo",
  platform: "browser",
  realRunEnabled: false,
  destructiveCommands: false,
  scanKnownRoots: false,
  simulateCleanupPlan: false,
  executeCleanupPlan: false,
  safeExecutorsEnabled: false
};
const actionList = buildScenarioActions(scenarioId);
const intakePolicy = buildIntakePolicy({
  targetDrive: "C:",
  goalBytes: 35 * GB,
  mode: "safe",
  protectedPaths: [],
  adminAllowed: false
});
const selectedIds = new Set(
  actionList
    .filter((action) => selectedByDefault(action, [], intakePolicy))
    .map((action) => action.id)
);
const approvals = {
  groupConfirm: true,
  permanentConfirm: true,
  reviewed: {},
  reviewItems: {},
  typed: {}
};
const scanSession = buildScanSessionEvidence({
  scanned: true,
  scanning: false,
  scanMode: "demo",
  scanSettings,
  protectedPaths: [],
  nativeScan: null
});
const readiness = getExecutionReadinessForActions(selectedIds, approvals, actionList, [], null, intakePolicy);
const riskBudget = buildRiskBudget({ actionList, selectedIds, intakePolicy });
const planSnapshot = buildPlanSnapshot({
  selectedIds,
  actionList,
  approvals,
  protectedPaths: [],
  scanMode: "demo",
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
  scanMode: "demo",
  preflight,
  intakePolicy
});
const executorReadiness = buildExecutorReadiness(executorPlan, preflight);
const runReadiness = buildRunReadiness(preflight, executorReadiness);
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
  scanMode: "demo",
  nativeCapability: { available: false },
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
  scanMode: "demo",
  runtimeCapabilities,
  nativeScan: null
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
  scanMode: "demo"
});
const taskCapabilityGrants = buildTaskCapabilityGrants({
  executorPlan,
  taskPowerCatalog,
  planSnapshot,
  scanSession,
  consentReceipt,
  runtimeCapabilities
});
const agentQuestionQueue = buildAgentQuestionQueue({
  scanned: true,
  scanning: false,
  scanMode: "demo",
  scanSession,
  nativeCapability: { available: false },
  runtimeCapabilities,
  actionList,
  selectedIds,
  approvals,
  readiness,
  runReadiness,
  consentReceipt,
  intakePolicy
});
const taskPowerBroker = buildTaskPowerBroker({
  taskPowerCatalog,
  taskCapabilityGrants,
  agentQuestionQueue,
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
const restrictionPolicyMatrix = buildRestrictionPolicyMatrix({
  actionList,
  selectedIds,
  protectedPaths: [],
  intakePolicy,
  runtimeCapabilities
});
const taskRunbook = buildAgentTaskRunbook({
  executorPlan,
  taskCapabilityGrants,
  agentQuestionQueue,
  rollbackPlan: null
});
const safetyInterlock = buildSafetyInterlock({
  runtimeCapabilities,
  nativeScan: null,
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
const runRecord = buildLedgerRunRecord({
  planSnapshot,
  ledger,
  executorPlan,
  scanMode: "demo",
  nativeScan: null,
  runtimeCapabilities,
  runReadiness,
  dryRunLaunchGuard,
  createdAt: executedAt
});
const runHistory = appendLedgerRunRecord([], runRecord);
const windowsSetupAssistant = buildWindowsSetupAssistant({
  nativeCapability: { available: false },
  runtimeCapabilities,
  scanMode: "demo",
  scanSession
});
const demoRehearsalRunbook = buildDemoRehearsalRunbook({
  scanned: true,
  scanning: false,
  scanMode: "demo",
  scanSession,
  actionList,
  selectedIds,
  readiness,
  executorPlan,
  taskRunbook,
  restrictionPolicyMatrix,
  windowsSetupAssistant,
  runReadiness,
  consentReceipt,
  ledger,
  planSnapshot,
  agentQuestionQueue,
  runtimeCapabilities
});

const failures = [
  ["scan session ready", scanSession.status === "demo-current" && scanSession.readyForPlanning],
  ["readiness resolved", readiness.ready],
  ["risk budget satisfied", riskBudget.status === "within-risk-budget"],
  ["preflight ready", preflight.ready],
  ["run readiness ready", runReadiness.ready],
  ["plan lock launch-ready", planLock.readyForLaunch],
  ["consent receipt ready", consentReceipt.ready],
  ["task leases current", taskPowerLeaseAudit.status === "leases-current"],
  ["safety interlock allows dry-run", safetyInterlock.dryRunAllowed],
  ["dry-run launch guard ready", dryRunLaunchGuard.ready],
  ["ledger captured", ledger.length > 0],
  ["demo evidence complete", demoRehearsalRunbook.evidenceComplete],
  ["public demo safe", demoRehearsalRunbook.safeForPublicDemo],
  ["no native data required", !demoRehearsalRunbook.requiresNativeData],
  ["real cleanup locked", !demoRehearsalRunbook.realCleanupEnabled],
  ["first-safe work order validation-blocked", firstSafeImplementationWorkOrder.status === "validation-blocked"],
  ["first-safe work order keeps real run locked", !firstSafeImplementationWorkOrder.realRunAllowed && !firstSafeImplementationWorkOrder.destructiveActionAvailable],
  ["zero real-run routes", demoRehearsalRunbook.counts.realRun === 0 && planLock.counts.realRun === 0],
  ["history current", runHistory.length === 1 && runHistory[0].planId === planSnapshot.id]
].filter(([, passed]) => !passed);

const summary = {
  schemaVersion: "spaceguard-demo-run/v1",
  status: failures.length ? "failed" : "passed",
  scenario: scenario.label,
  scanMode: "demo",
  planId: planSnapshot.id,
  planLockId: planLock.lockId,
  selectedCount: selectedIds.size,
  dryRunRows: executorPlan.dryRunCount,
  ledgerRows: ledger.length,
  runbookStatus: demoRehearsalRunbook.status,
  safetyStatus: safetyInterlock.status,
  launchStatus: dryRunLaunchGuard.status,
  workOrderStatus: firstSafeImplementationWorkOrder.status,
  realRunEnabled: false,
  destructiveCommands: false,
  failures: failures.map(([label]) => label)
};

return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const summary = buildDemoRehearsalSummary();
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failures.length) {
  process.exitCode = 1;
  }
}
