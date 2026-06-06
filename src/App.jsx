import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  CircleGauge,
  ClipboardList,
  Database,
  Download,
  Eye,
  FileText,
  HardDrive,
  KeyRound,
  Lock,
  Plus,
  Play,
  RefreshCcw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  X
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  GB,
  agentStages,
  buildFamilyGroups,
  buildExecutionPreflight,
  buildExecutionConsentReceipt,
  buildFirstSafeExecutorContract,
  buildFirstSafeImplementationWorkOrder,
  buildFirstSafeValidationGate,
  buildFixtureEvidenceImport,
  buildInstalledAppReviewDossier,
  buildInstalledAppUninstallWorkOrder,
  buildInstalledAppUninstallWorkOrderMarkdown,
  buildIntakePolicy,
  buildCustomRootTriage,
  buildPlanReview,
  buildAgentQuestionQueue,
  buildAIAgentIntegration,
  buildBetaHandoffManifest,
  buildBetaHandoffManifestMarkdown,
  buildCandidateSafetyManifest,
  buildAgentTaskRunbook,
  buildDecisionLog,
  buildDemoRehearsalRunbook,
  buildDriveInventorySummary,
  buildDryRunLaunchGuard,
  appendLedgerRunRecord,
  buildExecutorManifest,
  buildExecutorPlan,
  buildExecutorReadiness,
  buildExecutorSmokeRunPacket,
  buildExecutorSmokeRunPacketMarkdown,
  buildExecutionProofHandoff,
  buildLedgerHistoryMarkdown,
  buildLedgerHistorySummary,
  buildLedgerRunRecord,
  buildLocalEvidenceBackup,
  buildLocalEvidenceBackupImport,
  buildLocalEvidenceBackupMarkdown,
  buildNativeDryRunScopeEvidence,
  buildOperatingChecklist,
  buildPostRunVerificationMarkdown,
  buildPostRunVerificationPlan,
  buildPrivilegeBoundary,
  buildPrivacyBoundary,
  buildPublicBetaReadiness,
  buildRescanComparison,
  buildRescanComparisonMarkdown,
  buildManualStrategyChecklist,
  buildModeDefaultSelection,
  buildNativeBetaDistributionReadiness,
  buildNativeBetaEvidenceImport,
  buildNativeEvidenceQualityGate,
  buildRestrictionPolicyMatrix,
  buildPlanLock,
  buildReleaseGate,
  buildReleaseReviewPacket,
  buildReleaseReviewPacketMarkdown,
  buildRecoveryAdvisor,
  buildRealDataLaunchRoadmap,
  buildRealExecutorCapsule,
  buildRollbackPlan,
  buildItemReview,
  buildReport,
  buildPlanSnapshot,
  buildReviewItemsByAction,
  buildProductCompletionAudit,
  buildReviewWorkbench,
  buildScenarioActions,
  buildSuggestedPlan,
  buildRunReadiness,
  buildRiskBudget,
  buildSafetyInterlock,
  buildScanCoverageSummary,
  buildScanSessionEvidence,
  buildScopedExecutorCommandFlow,
  buildScopedExecutorRunGate,
  buildNativeScanRequestGuard,
  buildStoragePressureDiagnosis,
  buildStorageStrategyPlan,
  buildSupportBundle,
  buildSupportBundleMarkdown,
  buildTaskCapabilityGrants,
  buildTaskPowerBroker,
  buildTaskPowerCatalog,
  buildTaskPowerLeaseAudit,
  buildTempExecutorActivationRehearsal,
  buildTempExecutorActivationGate,
  buildToolCommandInventory,
  buildUserDecisionReceipt,
  buildValidationEvidencePack,
  buildValidationPackMarkdown,
  buildValidationPackImport,
  buildVerificationSummary,
  buildWindowsSetupAssistant,
  buildWorkflowHandoffMarkdown,
  buildWorkflowHandoffPacket,
  buildWslCompactionWorkOrder,
  buildWslCompactionWorkOrderMarkdown,
  buildWriteBoundaryProbe,
  buildWriteReadiness,
  computeTotals,
  customRootDispositionOptions,
  formatBytes,
  gates,
  actionRequiresAdminConsent,
  getActionTaskPower,
  getExecutionReadinessForActions,
  getLedgerRunLabel,
  getScenario,
  getScopedExecutorRouteForAction,
  isActionProtected,
  isScopedExecutorRouteEnabled,
  makeExecutionLedgerForActions,
  normalizeCustomRootTriageRecord,
  normalizeTargetDrive,
  scenarios,
  selectableAction,
  selectedByDefault
} from "./spaceguard-model.mjs";
import {
  getNativeScannerCapability,
  getNativeRuntimeCapabilities,
  mergeNativeScanIntoActions,
  runNativeDryRunScopeValidation,
  runNativeAndroidCacheExecutor,
  runNativeDockerBuildCacheExecutor,
  runNativeDownloadsCleanupExecutor,
  runNativeBrowserCacheExecutor,
  runNativeExecutorDryRun,
  runNativeGradleCacheExecutor,
  runNativeLargeFileArchiveExecutor,
  runNativeNpmCacheExecutor,
  runNativePipCacheExecutor,
  runNativePnpmStoreExecutor,
  runNativeProjectDependencyExecutor,
  runNativeRecycleBinExecutor,
  runNativeShaderCacheExecutor,
  runNativeTempCleanupExecutor,
  runNativeUserCacheExecutor,
  runNativeReadonlyScan,
  runNativeWriteBoundary
} from "./native-scanner.mjs";
import {
  appendOpenAIAgentRunRecord,
  buildOpenAIAgentRunRecord,
  buildOpenAIAgentContext,
  buildOpenAIAgentRecommendationBroker,
  getOpenAIAgentConfig,
  getOpenAIAgentRecommendationKey,
  normalizeOpenAIAgentRunHistory,
  requestOpenAIAgentAdvice
} from "./openai-agent.mjs";

const RUN_HISTORY_STORAGE_KEY = "spaceguard.ledgerHistory.v1";
const OPENAI_AGENT_RUN_HISTORY_STORAGE_KEY = "spaceguard.openAiAgentRuns.v1";
const VALIDATION_EVIDENCE_STORAGE_KEY = "spaceguard.validationEvidence.v1";
const MANUAL_STRATEGY_EVIDENCE_STORAGE_KEY = "spaceguard.manualStrategyEvidence.v1";
const ROLLBACK_EVIDENCE_STORAGE_KEY = "spaceguard.rollbackEvidence.v1";
const CUSTOM_ROOT_TRIAGE_STORAGE_KEY = "spaceguard.customRootTriage.v1";
const NATIVE_BETA_EVIDENCE_STORAGE_KEY = "spaceguard.nativeBetaEvidence.v1";
const RUN_HISTORY_LIMIT = 25;
const OPENAI_AGENT_RUN_HISTORY_LIMIT = 20;
const filters = ["all", "safe", "rebuildable", "review", "advanced", "restricted"];
const modes = [
  ["safe", "Safe"],
  ["balanced", "Balanced"],
  ["emergency", "Emergency"]
];
const nativeBetaEvidenceSpecs = [
  {
    id: "publicReleaseResearch",
    label: "Public release notes",
    detail: "Release copy must describe read-only scanning and avoid real-cleanup claims."
  },
  {
    id: "windowsRealDataSetup",
    label: "Windows real-data setup",
    detail: "Setup docs must explain the desktop shell, read-only scan, privacy, and export boundaries."
  },
  {
    id: "installUninstallRunbook",
    label: "Install and uninstall path",
    detail: "Distribution docs must cover install, uninstall, rollback, and support contact flow."
  },
  {
    id: "supportRunbook",
    label: "Support runbook",
    detail: "Support must start from redacted diagnostics and request path-level reports only when needed."
  },
  {
    id: "supportBundleExport",
    label: "Redacted support export",
    detail: "Support export evidence must prove local paths and filenames are excluded by default."
  }
];

const riskAccent = {
  safe: "bg-emerald-500",
  rebuildable: "bg-sky-500",
  review: "bg-amber-500",
  advanced: "bg-fuchsia-500",
  restricted: "bg-red-500",
  advisory: "bg-zinc-500"
};

export default function App() {
  const [scenarioId, setScenarioId] = useState("developer");
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanLabel, setScanLabel] = useState("Ready for demo scan");
  const [activeStage, setActiveStage] = useState("intake");
  const [goalGb, setGoalGb] = useState(35);
  const [mode, setMode] = useState("safe");
  const [adminActionsAllowed, setAdminActionsAllowed] = useState(false);
  const [filter, setFilter] = useState("all");
  const [protectedPaths, setProtectedPaths] = useState([]);
  const [protectedInput, setProtectedInput] = useState("");
  const [focusedReviewId, setFocusedReviewId] = useState("downloads-installers");
  const [nativeScan, setNativeScan] = useState({ status: "idle", result: null, error: "" });
  const [scanSettings, setScanSettings] = useState({
    targetDrive: "C:",
    includeProjectArtifacts: true,
    maxDepth: 8,
    maxEntriesPerRoot: 25000,
    customRoots: []
  });
  const [customRootInput, setCustomRootInput] = useState("");
  const [nativeExecutorDryRun, setNativeExecutorDryRun] = useState({ status: "idle", result: null, error: "" });
  const [nativeScopeEvidenceExport, setNativeScopeEvidenceExport] = useState({ status: "idle", result: null, error: "" });
  const [nativeWriteBoundary, setNativeWriteBoundary] = useState({ status: "idle", result: null, error: "" });
  const [nativeRealExecution, setNativeRealExecution] = useState({ status: "idle", result: null, error: "" });
  const [nativeProjectDependencyExecution, setNativeProjectDependencyExecution] = useState({ status: "idle", result: null, error: "" });
  const [nativeDownloadsExecution, setNativeDownloadsExecution] = useState({ status: "idle", result: null, error: "" });
  const [nativeLargeFileArchiveExecution, setNativeLargeFileArchiveExecution] = useState({ status: "idle", result: null, error: "" });
  const [largeFileArchiveDestination, setLargeFileArchiveDestination] = useState("");
  const [nativeBrowserCacheExecution, setNativeBrowserCacheExecution] = useState({ status: "idle", result: null, error: "" });
  const [nativeGradleCacheExecution, setNativeGradleCacheExecution] = useState({ status: "idle", result: null, error: "" });
  const [nativeUserCacheExecution, setNativeUserCacheExecution] = useState({ status: "idle", result: null, error: "" });
  const [nativeAndroidCacheExecution, setNativeAndroidCacheExecution] = useState({ status: "idle", result: null, error: "" });
  const [nativeShaderCacheExecution, setNativeShaderCacheExecution] = useState({ status: "idle", result: null, error: "" });
  const [nativePipCacheExecution, setNativePipCacheExecution] = useState({ status: "idle", result: null, error: "" });
  const [nativeDockerBuildCacheExecution, setNativeDockerBuildCacheExecution] = useState({ status: "idle", result: null, error: "" });
  const [nativeNpmCacheExecution, setNativeNpmCacheExecution] = useState({ status: "idle", result: null, error: "" });
  const [nativePnpmStoreExecution, setNativePnpmStoreExecution] = useState({ status: "idle", result: null, error: "" });
  const [nativeRecycleBinExecution, setNativeRecycleBinExecution] = useState({ status: "idle", result: null, error: "" });
  const [aiPrompt, setAiPrompt] = useState("Find the fastest safe path to recover real space from this scan.");
  const [aiAdvice, setAiAdvice] = useState({ status: "idle", result: null, error: "" });
  const [openAiAgentRunHistory, setOpenAiAgentRunHistory] = useState(() => readStoredOpenAIAgentRunHistory());
  const [runtimeCapabilities, setRuntimeCapabilities] = useState({
    status: "loading",
    result: {
      available: false,
      mode: "browser-demo",
      platform: "browser",
      windows: false,
      elevated: false,
      elevationSource: "browser-demo",
      realRunEnabled: false,
      destructiveCommands: false,
      scanKnownRoots: false,
      simulateCleanupPlan: false,
      executeCleanupPlan: false,
      openAiAgentAdvice: false,
      openAiAdvisorConfigured: false,
      openAiKeySource: "missing",
      safeExecutorsEnabled: false,
      executorFlags: {
        tempCleanupExecutor: false,
        projectDependencyExecutor: false,
        downloadsCleanupExecutor: false,
        largeFileArchiveExecutor: false,
        gradleCacheExecutor: false,
        userCacheExecutor: false,
        androidCacheExecutor: false,
        shaderCacheExecutor: false,
        pipCacheExecutor: false,
        npmCacheExecutor: false,
        pnpmStoreExecutor: false,
        recycleBinExecutor: false,
        browserCacheExecutor: false,
        toolNativePruneExecutors: false
      },
      reason: "Runtime capability check has not completed."
    },
    error: ""
  });
  const [selectedIds, setSelectedIds] = useState(() => {
    const initialActions = buildScenarioActions("developer");
    return new Set(initialActions.filter(selectedByDefault).map((action) => action.id));
  });
  const [approvals, setApprovals] = useState({ groupConfirm: false, permanentConfirm: false, reviewed: {}, reviewItems: {}, typed: {} });
  const [ledger, setLedger] = useState([]);
  const [executionProofContext, setExecutionProofContext] = useState(null);
  const [runHistory, setRunHistory] = useState(() => readStoredRunHistory());
  const [validationEvidence, setValidationEvidence] = useState(() => readStoredValidationEvidence());
  const [manualStrategyEvidence, setManualStrategyEvidence] = useState(() => readStoredManualStrategyEvidence());
  const [rollbackEvidence, setRollbackEvidence] = useState(() => readStoredRollbackEvidence());
  const [customRootTriageEvidence, setCustomRootTriageEvidence] = useState(() => readStoredCustomRootTriageEvidence());
  const [nativeBetaEvidence, setNativeBetaEvidence] = useState(() => readStoredNativeBetaEvidence());
  const [fixtureImportText, setFixtureImportText] = useState("");
  const [fixtureImportReviewer, setFixtureImportReviewer] = useState("");
  const [fixtureImportArtifact, setFixtureImportArtifact] = useState("");
  const [fixtureImportResult, setFixtureImportResult] = useState(null);
  const [validationPackImportText, setValidationPackImportText] = useState("");
  const [validationPackImportResult, setValidationPackImportResult] = useState(null);
  const [nativeBetaImportText, setNativeBetaImportText] = useState("");
  const [nativeBetaImportResult, setNativeBetaImportResult] = useState(null);
  const [localEvidenceBackupImportText, setLocalEvidenceBackupImportText] = useState("");
  const [localEvidenceBackupImportResult, setLocalEvidenceBackupImportResult] = useState(null);
  const [executionConsent, setExecutionConsent] = useState({ accepted: false, planId: "", acceptedAt: "" });
  const [selectedScopedExecutorRoute, setSelectedScopedExecutorRoute] = useState("");
  const selectedScopedExecutorRouteRef = useRef("");

  const scenario = useMemo(() => getScenario(scenarioId), [scenarioId]);
  const nativeCapability = useMemo(() => getNativeScannerCapability(globalThis), []);
  const openAiConfig = useMemo(() => getOpenAIAgentConfig(import.meta.env), []);

  function selectScopedExecutorRoute(route = "") {
    const nextRoute = String(route || "");
    selectedScopedExecutorRouteRef.current = nextRoute;
    setSelectedScopedExecutorRoute(nextRoute);
  }

  useEffect(() => {
    selectedScopedExecutorRouteRef.current = selectedScopedExecutorRoute;
  }, [selectedScopedExecutorRoute]);

  useEffect(() => {
    let cancelled = false;
    getNativeRuntimeCapabilities(globalThis)
      .then((result) => {
        if (!cancelled) setRuntimeCapabilities({ status: "complete", result, error: "" });
      })
      .catch((error) => {
        if (!cancelled) {
          setRuntimeCapabilities((current) => ({
            status: "error",
            result: current.result,
            error: error instanceof Error ? error.message : String(error)
          }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    writeStoredRunHistory(runHistory);
  }, [runHistory]);

  useEffect(() => {
    writeStoredOpenAIAgentRunHistory(openAiAgentRunHistory);
  }, [openAiAgentRunHistory]);

  useEffect(() => {
    writeStoredValidationEvidence(validationEvidence);
  }, [validationEvidence]);

  useEffect(() => {
    writeStoredManualStrategyEvidence(manualStrategyEvidence);
  }, [manualStrategyEvidence]);

  useEffect(() => {
    writeStoredRollbackEvidence(rollbackEvidence);
  }, [rollbackEvidence]);

  useEffect(() => {
    writeStoredCustomRootTriageEvidence(customRootTriageEvidence);
  }, [customRootTriageEvidence]);

  useEffect(() => {
    writeStoredNativeBetaEvidence(nativeBetaEvidence);
  }, [nativeBetaEvidence]);

  const dataMode = nativeScan.result?.available ? "native-readonly" : "demo";
  const targetDrive = useMemo(() => normalizeTargetDrive(scanSettings.targetDrive), [scanSettings.targetDrive]);
  const nativeScanRequestGuard = useMemo(
    () => buildNativeScanRequestGuard({ scanSettings, protectedPaths }),
    [scanSettings, protectedPaths]
  );
  const profile = useMemo(
    () => {
      if (!nativeScan.result?.available) {
        return {
          ...scenario.profile,
          drive: targetDrive
        };
      }
      const volume = nativeScan.result.volume;
      return {
        ...scenario.profile,
        machine: "Real read-only scanner",
        drive: volume?.drive || nativeScan.result.targetDrive || targetDrive,
        totalBytes: volume?.totalBytes || scenario.profile.totalBytes,
        usedBytes: volume?.usedBytes || scenario.profile.usedBytes,
        freeBytes: volume?.freeBytes || scenario.profile.freeBytes,
        lastScan: "Native read-only scan",
        mode: "native-readonly",
        note: volume
          ? `Drive totals from ${volume.source}; cleanup roots are still read-only measurements.`
          : "Known roots were measured locally. Drive totals are demo until Windows volume evidence is available."
      };
    },
    [scenario, nativeScan.result, targetDrive]
  );
  const intakePolicy = useMemo(
    () =>
      buildIntakePolicy({
        targetDrive: profile.drive,
        goalBytes: goalGb * GB,
        mode,
        protectedPaths,
        adminAllowed: adminActionsAllowed
      }),
    [profile.drive, goalGb, mode, protectedPaths, adminActionsAllowed]
  );
  const baseActions = useMemo(() => buildScenarioActions(scenarioId), [scenarioId]);
  const actionList = useMemo(() => mergeNativeScanIntoActions(baseActions, nativeScan.result), [baseActions, nativeScan.result]);
  const scanCoverage = useMemo(
    () => buildScanCoverageSummary({ actionList, scanMode: dataMode, nativeScan: nativeScan.result }),
    [actionList, dataMode, nativeScan.result]
  );
  const driveInventorySummary = useMemo(
    () => buildDriveInventorySummary({ nativeScan: nativeScan.result, scanMode: dataMode }),
    [nativeScan.result, dataMode]
  );
  const customRootTriage = useMemo(
    () => buildCustomRootTriage({ scanCoverage, evidence: customRootTriageEvidence }),
    [scanCoverage, customRootTriageEvidence]
  );
  const scanSession = useMemo(
    () =>
      buildScanSessionEvidence({
        scanned,
        scanning,
        scanMode: dataMode,
        scanSettings,
        protectedPaths,
        nativeScan: nativeScan.result
      }),
    [scanned, scanning, dataMode, scanSettings, protectedPaths, nativeScan.result]
  );
  const privacyBoundary = useMemo(
    () =>
      buildPrivacyBoundary({
        scanMode: dataMode,
        nativeScan: nativeScan.result,
        runHistory,
        validationEvidence,
        runtimeCapabilities: runtimeCapabilities.result
      }),
    [dataMode, nativeScan.result, runHistory, validationEvidence, runtimeCapabilities.result]
  );
  const itemReviewsByAction = useMemo(
    () => buildReviewItemsByAction(actionList, nativeScan.result, protectedPaths, approvals),
    [actionList, nativeScan.result, protectedPaths, approvals]
  );
  const installedAppReviewDossier = useMemo(
    () => buildInstalledAppReviewDossier({ itemReviewsByAction, nativeScan: nativeScan.result }),
    [itemReviewsByAction, nativeScan.result]
  );
  const taskPowerCatalog = useMemo(
    () =>
      buildTaskPowerCatalog({
        actionList,
        selectedIds,
        approvals,
        protectedPaths,
        itemReviewsByAction,
        intakePolicy,
        runtimeCapabilities: runtimeCapabilities.result,
        scanMode: dataMode
      }),
    [actionList, selectedIds, approvals, protectedPaths, itemReviewsByAction, intakePolicy, runtimeCapabilities.result, dataMode]
  );
  const planSnapshot = useMemo(
    () =>
      buildPlanSnapshot({
        selectedIds,
        actionList,
        approvals,
        protectedPaths,
        itemReviewsByAction,
        scanMode: dataMode,
        goalBytes: goalGb * GB,
        intakePolicy,
        scanSession
      }),
    [selectedIds, actionList, approvals, protectedPaths, itemReviewsByAction, dataMode, goalGb, intakePolicy, scanSession]
  );
  const ledgerHistorySummary = useMemo(
    () => buildLedgerHistorySummary(runHistory, planSnapshot),
    [runHistory, planSnapshot]
  );
  const activeLedger = ledger.length ? ledger : ledgerHistorySummary.currentLedger;
  const historyExecutionProofContext = !ledger.length && ledgerHistorySummary.currentLedger.length
    ? {
        planSnapshot: ledgerHistorySummary.currentPlanSnapshot || planSnapshot,
        executorPlan: ledgerHistorySummary.currentExecutorPlan,
        scanMode: ledgerHistorySummary.currentRecord?.scanMode || dataMode,
        source: "run-history",
        recordedAt: ledgerHistorySummary.currentRecord?.createdAt || ""
      }
    : null;
  const activeExecutionProofContext = executionProofContext || historyExecutionProofContext;
  const verificationPlanSnapshot = activeLedger.length && activeExecutionProofContext?.planSnapshot ? activeExecutionProofContext.planSnapshot : planSnapshot;
  const verificationScanMode = activeLedger.length && activeExecutionProofContext?.scanMode ? activeExecutionProofContext.scanMode : dataMode;
  const totals = useMemo(() => computeTotals(selectedIds, actionList, { approvals, itemReviewsByAction }), [selectedIds, actionList, approvals, itemReviewsByAction]);
  const readiness = useMemo(
    () => getExecutionReadinessForActions(selectedIds, approvals, actionList, protectedPaths, itemReviewsByAction, intakePolicy),
    [selectedIds, approvals, actionList, protectedPaths, itemReviewsByAction, intakePolicy]
  );
  const planReview = useMemo(
    () => buildPlanReview(actionList, selectedIds, approvals, protectedPaths, itemReviewsByAction, intakePolicy),
    [actionList, selectedIds, approvals, protectedPaths, itemReviewsByAction, intakePolicy]
  );
  const recoveryAdvisor = useMemo(
    () =>
      buildRecoveryAdvisor({
        scanned,
        scanMode: dataMode,
        goalBytes: goalGb * GB,
        actionList,
        selectedIds,
        approvals,
        protectedPaths,
        ledger: activeLedger,
        itemReviewsByAction,
        planSnapshot,
        intakePolicy
      }),
    [scanned, dataMode, goalGb, actionList, selectedIds, approvals, protectedPaths, activeLedger, itemReviewsByAction, planSnapshot, intakePolicy]
  );
  const storagePressureDiagnosis = useMemo(
    () =>
      buildStoragePressureDiagnosis({
        scanned,
        scanMode: dataMode,
        profile,
        goalBytes: goalGb * GB,
        actionList,
        selectedIds,
        approvals,
        protectedPaths,
        itemReviewsByAction,
        intakePolicy,
        scanCoverage,
        driveInventorySummary,
        recoveryAdvisor,
        customRootTriage
      }),
    [
      scanned,
      dataMode,
      profile,
      goalGb,
      actionList,
      selectedIds,
      approvals,
      protectedPaths,
      itemReviewsByAction,
      intakePolicy,
      scanCoverage,
      driveInventorySummary,
      recoveryAdvisor,
      customRootTriage
    ]
  );
  const nativeEvidenceQuality = useMemo(
    () =>
      buildNativeEvidenceQualityGate({
        scanned,
        scanMode: dataMode,
        scanSession,
        scanCoverage,
        driveInventorySummary,
        storagePressureDiagnosis,
        nativeCapability,
        runtimeCapabilities: runtimeCapabilities.result,
        privacyBoundary
      }),
    [
      scanned,
      dataMode,
      scanSession,
      scanCoverage,
      driveInventorySummary,
      storagePressureDiagnosis,
      nativeCapability,
      runtimeCapabilities.result,
      privacyBoundary
    ]
  );
  const storageStrategy = useMemo(
    () =>
      buildStorageStrategyPlan({
        scanned,
        profile,
        advisor: recoveryAdvisor,
        actionList,
        selectedIds,
        approvals,
        protectedPaths,
        itemReviewsByAction,
        scanCoverage,
        goalBytes: goalGb * GB
      }),
    [scanned, profile, recoveryAdvisor, actionList, selectedIds, approvals, protectedPaths, itemReviewsByAction, scanCoverage, goalGb]
  );
  const manualStrategyChecklist = useMemo(
    () =>
      buildManualStrategyChecklist({
        storageStrategy,
        evidence: manualStrategyEvidence
      }),
    [storageStrategy, manualStrategyEvidence]
  );
  const decisionLog = useMemo(
    () =>
      buildDecisionLog({
        scanned,
        scanning,
        scanMode: dataMode,
        actionList,
        selectedIds,
        approvals,
        readiness,
        protectedPaths,
        ledger: activeLedger,
        goalBytes: goalGb * GB,
        itemReviewsByAction,
        intakePolicy,
        scanSession,
        taskPowerCatalog
      }),
    [scanned, scanning, dataMode, scanSession, actionList, selectedIds, approvals, readiness, protectedPaths, activeLedger, goalGb, itemReviewsByAction, intakePolicy, taskPowerCatalog]
  );
  const reviewWorkbench = useMemo(
    () => buildReviewWorkbench(actionList, selectedIds, approvals, protectedPaths, itemReviewsByAction, intakePolicy),
    [actionList, selectedIds, approvals, protectedPaths, itemReviewsByAction, intakePolicy]
  );
  const itemReview = useMemo(
    () => itemReviewsByAction[focusedReviewId] || buildItemReview(focusedReviewId, actionList, nativeScan.result, protectedPaths, approvals),
    [focusedReviewId, itemReviewsByAction, actionList, nativeScan.result, protectedPaths, approvals]
  );
  const riskBudget = useMemo(
    () =>
      buildRiskBudget({
        actionList,
        selectedIds,
        intakePolicy
      }),
    [actionList, selectedIds, intakePolicy]
  );
  const planLock = useMemo(
    () =>
      buildPlanLock({
        planSnapshot,
        scanSession,
        riskBudget,
        consent: executionConsent
      }),
    [planSnapshot, scanSession, riskBudget, executionConsent]
  );
  const preflight = useMemo(
    () => buildExecutionPreflight({ scanned, scanning, selectedIds, actionList, readiness, protectedPaths, ledger: activeLedger, planSnapshot, scanSession, riskBudget, planLock }),
    [scanned, scanning, selectedIds, actionList, readiness, protectedPaths, activeLedger, planSnapshot, scanSession, riskBudget, planLock]
  );
  const executorPlan = useMemo(
    () =>
      buildExecutorPlan({
        selectedIds,
        actionList,
        approvals,
        protectedPaths,
        scanMode: dataMode,
        preflight,
        itemReviewsByAction,
        intakePolicy
      }),
    [selectedIds, actionList, approvals, protectedPaths, dataMode, preflight, itemReviewsByAction, intakePolicy]
  );
  const verificationExecutorPlan = activeLedger.length && activeExecutionProofContext?.executorPlan ? activeExecutionProofContext.executorPlan : executorPlan;
  const executorReadiness = useMemo(
    () => buildExecutorReadiness(executorPlan, preflight),
    [executorPlan, preflight]
  );
  const runReadiness = useMemo(
    () => buildRunReadiness(preflight, executorReadiness),
    [preflight, executorReadiness]
  );
  const consentReceipt = useMemo(
    () => buildExecutionConsentReceipt({ planSnapshot, executorPlan, runReadiness, consent: executionConsent, planLock }),
    [planSnapshot, executorPlan, runReadiness, executionConsent, planLock]
  );
  const verificationSummary = useMemo(
    () =>
      buildVerificationSummary({
        planSnapshot: verificationPlanSnapshot,
        ledger: activeLedger,
        executorPlan: verificationExecutorPlan,
        scanMode: verificationScanMode,
        nativeScan: nativeScan.result
      }),
    [verificationPlanSnapshot, activeLedger, verificationExecutorPlan, verificationScanMode, nativeScan.result]
  );
  const postRunVerification = useMemo(
    () =>
      buildPostRunVerificationPlan({
        planSnapshot: verificationPlanSnapshot,
        ledger: activeLedger,
        executorPlan: verificationExecutorPlan,
        scanMode: verificationScanMode,
        nativeScan: nativeScan.result
      }),
    [verificationPlanSnapshot, activeLedger, verificationExecutorPlan, verificationScanMode, nativeScan.result]
  );
  const rescanComparison = useMemo(
    () =>
      buildRescanComparison({
        postRunVerification,
        nativeScan: nativeScan.result,
        scanMode: verificationScanMode,
        ledger: activeLedger,
        planSnapshot: verificationPlanSnapshot
      }),
    [postRunVerification, nativeScan.result, verificationScanMode, activeLedger, verificationPlanSnapshot]
  );
  const installedAppUninstallWorkOrder = useMemo(
    () =>
      buildInstalledAppUninstallWorkOrder({
        dossier: installedAppReviewDossier,
        planSnapshot,
        scanSession,
        rescanComparison
      }),
    [installedAppReviewDossier, planSnapshot, scanSession, rescanComparison]
  );
  const wslCompactionWorkOrder = useMemo(
    () =>
      buildWslCompactionWorkOrder({
        nativeScan: nativeScan.result,
        actionList,
        selectedIds,
        approvals,
        planSnapshot,
        scanSession,
        rescanComparison
      }),
    [nativeScan.result, actionList, selectedIds, approvals, planSnapshot, scanSession, rescanComparison]
  );
  const executionProofHandoff = useMemo(
    () =>
      buildExecutionProofHandoff({
        ledger: activeLedger,
        verificationSummary,
        postRunVerification,
        rescanComparison,
        nativeCapability,
        scanning
      }),
    [activeLedger, verificationSummary, postRunVerification, rescanComparison, nativeCapability, scanning]
  );
  const rollbackPlan = useMemo(
    () =>
      buildRollbackPlan({
        planSnapshot: verificationPlanSnapshot,
        executorPlan: verificationExecutorPlan,
        itemReviewsByAction,
        postRunVerification,
        rollbackEvidence,
        scanMode: verificationScanMode
      }),
    [verificationPlanSnapshot, verificationExecutorPlan, itemReviewsByAction, postRunVerification, rollbackEvidence, verificationScanMode]
  );
  const releaseGate = useMemo(
    () => {
      const executorFlags = runtimeCapabilities.result.executorFlags || {};
      return buildReleaseGate({
        scanMode: dataMode,
        nativeCapability,
        executorPlan,
        validationEvidence,
        featureFlags: {
          realExecutors: Boolean(runtimeCapabilities.result.realRunEnabled),
          tempCleanupExecutor: Boolean(executorFlags.tempCleanupExecutor),
          downloadsCleanupExecutor: Boolean(executorFlags.downloadsCleanupExecutor),
          largeFileArchiveExecutor: Boolean(executorFlags.largeFileArchiveExecutor),
          gradleCacheExecutor: Boolean(executorFlags.gradleCacheExecutor),
          userCacheExecutor: Boolean(executorFlags.userCacheExecutor),
          androidCacheExecutor: Boolean(executorFlags.androidCacheExecutor),
          shaderCacheExecutor: Boolean(executorFlags.shaderCacheExecutor),
          pipCacheExecutor: Boolean(executorFlags.pipCacheExecutor),
          npmCacheExecutor: Boolean(executorFlags.npmCacheExecutor),
          pnpmStoreExecutor: Boolean(executorFlags.pnpmStoreExecutor),
          recycleBinExecutor: Boolean(executorFlags.recycleBinExecutor),
          browserCacheExecutor: Boolean(executorFlags.browserCacheExecutor),
          toolNativePruneExecutors: Boolean(executorFlags.toolNativePruneExecutors)
        }
      });
    },
    [dataMode, nativeCapability, executorPlan, validationEvidence, runtimeCapabilities.result]
  );
  const privilegeBoundary = useMemo(
    () => buildPrivilegeBoundary({ runtimeCapabilities: runtimeCapabilities.result, executorPlan }),
    [runtimeCapabilities.result, executorPlan]
  );
  const writeReadiness = useMemo(
    () =>
      buildWriteReadiness({
        releaseGate,
        runtimeCapabilities: runtimeCapabilities.result,
        executorPlan,
        rollbackPlan,
        rescanComparison,
        privilegeBoundary,
        privacyBoundary,
        consentReceipt,
        runReadiness
      }),
    [releaseGate, runtimeCapabilities.result, executorPlan, rollbackPlan, rescanComparison, privilegeBoundary, privacyBoundary, consentReceipt, runReadiness]
  );
  const executorManifest = useMemo(
    () => buildExecutorManifest({ actionList, executorPlan, releaseGate }),
    [actionList, executorPlan, releaseGate]
  );
  const realExecutorCapsule = useMemo(
    () =>
      buildRealExecutorCapsule({
        executorManifest,
        executorPlan,
        releaseGate,
        writeReadiness,
        rollbackPlan,
        rescanComparison,
        privilegeBoundary,
        privacyBoundary,
        runtimeCapabilities: runtimeCapabilities.result
      }),
    [executorManifest, executorPlan, releaseGate, writeReadiness, rollbackPlan, rescanComparison, privilegeBoundary, privacyBoundary, runtimeCapabilities.result]
  );
  const firstSafeExecutorContract = useMemo(
    () =>
      buildFirstSafeExecutorContract({
        realExecutorCapsule,
        executorPlan,
        planSnapshot,
        scanSession,
        consentReceipt,
        releaseGate,
        runtimeCapabilities: runtimeCapabilities.result
      }),
    [realExecutorCapsule, executorPlan, planSnapshot, scanSession, consentReceipt, releaseGate, runtimeCapabilities.result]
  );
  const candidateSafetyManifest = useMemo(
    () =>
      buildCandidateSafetyManifest({
        nativeExecutorDryRun,
        executorPlan,
        firstSafeExecutorContract,
        nativeEvidenceQuality,
        runtimeCapabilities: runtimeCapabilities.result
      }),
    [nativeExecutorDryRun, executorPlan, firstSafeExecutorContract, nativeEvidenceQuality, runtimeCapabilities.result]
  );
  const writeBoundaryProbe = useMemo(
    () =>
      buildWriteBoundaryProbe({
        nativeWriteBoundary,
        realExecutorCapsule,
        firstSafeExecutorContract,
        runtimeCapabilities: runtimeCapabilities.result
      }),
    [nativeWriteBoundary, realExecutorCapsule, firstSafeExecutorContract, runtimeCapabilities.result]
  );
  const taskCapabilityGrants = useMemo(
    () =>
      buildTaskCapabilityGrants({
        executorPlan,
        taskPowerCatalog,
        planSnapshot,
        scanSession,
        consentReceipt,
        firstSafeExecutorContract,
        writeBoundaryProbe,
        runtimeCapabilities: runtimeCapabilities.result
      }),
    [executorPlan, taskPowerCatalog, planSnapshot, scanSession, consentReceipt, firstSafeExecutorContract, writeBoundaryProbe, runtimeCapabilities.result]
  );
  const toolCommandInventory = useMemo(
    () => buildToolCommandInventory({ actionList, executorPlan, releaseGate }),
    [actionList, executorPlan, releaseGate]
  );
  const validationPack = useMemo(
    () =>
      buildValidationEvidencePack({
        releaseGate,
        executorPlan,
        executorManifest,
        scanMode: dataMode,
        runtimeCapabilities: runtimeCapabilities.result,
        nativeScan: nativeScan.result
      }),
    [releaseGate, executorPlan, executorManifest, dataMode, runtimeCapabilities.result, nativeScan.result]
  );
  const executorSmokeRunPacket = useMemo(
    () =>
      buildExecutorSmokeRunPacket({
        executorPlan,
        runtimeCapabilities: runtimeCapabilities.result,
        scanSession,
        consentReceipt,
        executionProofHandoff,
        rescanComparison,
        validationPack,
        releaseGate,
        planSnapshot,
        nativeScan: nativeScan.result,
        archiveDestination: largeFileArchiveDestination,
        permanentRemovalConfirmed: Boolean(approvals.permanentConfirm),
        preferredRoute: selectedScopedExecutorRoute
      }),
    [
      executorPlan,
      runtimeCapabilities.result,
      scanSession,
      consentReceipt,
      executionProofHandoff,
      rescanComparison,
      validationPack,
      releaseGate,
      planSnapshot,
      nativeScan.result,
      largeFileArchiveDestination,
      approvals.permanentConfirm,
      selectedScopedExecutorRoute
    ]
  );
  const scopedExecutorCommandFlow = useMemo(
    () =>
      buildScopedExecutorCommandFlow({
        smokeRunPacket: executorSmokeRunPacket,
        preferredRoute: selectedScopedExecutorRoute,
        executionProofHandoff,
        nativeCapability,
        scanning
      }),
    [executorSmokeRunPacket, selectedScopedExecutorRoute, executionProofHandoff, nativeCapability, scanning]
  );
  const firstSafeValidationGate = useMemo(
    () =>
      buildFirstSafeValidationGate({
        executorManifest,
        validationPack,
        releaseGate,
        realExecutorCapsule,
        firstSafeExecutorContract,
        writeBoundaryProbe,
        runtimeCapabilities: runtimeCapabilities.result
      }),
    [executorManifest, validationPack, releaseGate, realExecutorCapsule, firstSafeExecutorContract, writeBoundaryProbe, runtimeCapabilities.result]
  );
  const firstSafeImplementationWorkOrder = useMemo(
    () =>
      buildFirstSafeImplementationWorkOrder({
        firstSafeValidationGate,
        realExecutorCapsule,
        firstSafeExecutorContract,
        writeBoundaryProbe,
        runtimeCapabilities: runtimeCapabilities.result
      }),
    [firstSafeValidationGate, realExecutorCapsule, firstSafeExecutorContract, writeBoundaryProbe, runtimeCapabilities.result]
  );
  const tempExecutorActivationGate = useMemo(
    () =>
      buildTempExecutorActivationGate({
        runtimeCapabilities: runtimeCapabilities.result,
        firstSafeValidationGate,
        firstSafeImplementationWorkOrder,
        writeBoundaryProbe,
        releaseGate,
        writeReadiness,
        realExecutorCapsule
      }),
    [runtimeCapabilities.result, firstSafeValidationGate, firstSafeImplementationWorkOrder, writeBoundaryProbe, releaseGate, writeReadiness, realExecutorCapsule]
  );
  const tempExecutorActivationRehearsal = useMemo(
    () =>
      buildTempExecutorActivationRehearsal({
        runtimeCapabilities: runtimeCapabilities.result,
        firstSafeExecutorContract,
        firstSafeValidationGate,
        firstSafeImplementationWorkOrder,
        releaseGate,
        writeReadiness,
        realExecutorCapsule
      }),
    [runtimeCapabilities.result, firstSafeExecutorContract, firstSafeValidationGate, firstSafeImplementationWorkOrder, releaseGate, writeReadiness, realExecutorCapsule]
  );
  const baseAgentQuestionQueue = useMemo(
    () =>
      buildAgentQuestionQueue({
        scanned,
        scanning,
        scanMode: dataMode,
        scanSession,
        nativeCapability,
        runtimeCapabilities: runtimeCapabilities.result,
        actionList,
        selectedIds,
        approvals,
        readiness,
        reviewWorkbench,
        recoveryAdvisor,
        manualStrategyChecklist,
        runReadiness,
        consentReceipt,
        verificationSummary,
        rescanComparison,
        rollbackPlan,
        customRootTriage,
        validationPack,
        fixtureImportResult,
        writeBoundaryProbe,
        tempExecutorActivationGate,
        intakePolicy
      }),
    [
      scanned,
      scanning,
      dataMode,
      scanSession,
      nativeCapability,
      runtimeCapabilities.result,
      actionList,
      selectedIds,
      approvals,
      readiness,
      reviewWorkbench,
      recoveryAdvisor,
      manualStrategyChecklist,
      runReadiness,
      consentReceipt,
      verificationSummary,
      rescanComparison,
      rollbackPlan,
      customRootTriage,
      validationPack,
      fixtureImportResult,
      writeBoundaryProbe,
      tempExecutorActivationGate,
      intakePolicy
    ]
  );
  const taskPowerBroker = useMemo(
    () =>
      buildTaskPowerBroker({
        taskPowerCatalog,
        taskCapabilityGrants,
        agentQuestionQueue: baseAgentQuestionQueue,
        runReadiness,
        runtimeCapabilities: runtimeCapabilities.result
      }),
    [taskPowerCatalog, taskCapabilityGrants, baseAgentQuestionQueue, runReadiness, runtimeCapabilities.result]
  );
  const taskPowerLeaseAudit = useMemo(
    () =>
      buildTaskPowerLeaseAudit({
        taskCapabilityGrants,
        taskPowerBroker,
        planSnapshot,
        scanSession,
        consentReceipt,
        runtimeCapabilities: runtimeCapabilities.result
      }),
    [taskCapabilityGrants, taskPowerBroker, planSnapshot, scanSession, consentReceipt, runtimeCapabilities.result]
  );
  const taskRunbook = useMemo(
    () =>
      buildAgentTaskRunbook({
        executorPlan,
        taskCapabilityGrants,
        agentQuestionQueue: baseAgentQuestionQueue,
        rollbackPlan
      }),
    [executorPlan, taskCapabilityGrants, baseAgentQuestionQueue, rollbackPlan]
  );
  const restrictionPolicyMatrix = useMemo(
    () =>
      buildRestrictionPolicyMatrix({
        actionList,
        selectedIds,
        protectedPaths,
        intakePolicy,
        customRootTriage,
        taskRunbook,
        runtimeCapabilities: runtimeCapabilities.result
      }),
    [actionList, selectedIds, protectedPaths, intakePolicy, customRootTriage, taskRunbook, runtimeCapabilities.result]
  );
  const nativeBetaEvidenceLedger = useMemo(
    () => buildNativeBetaEvidenceLedger(nativeBetaEvidence),
    [nativeBetaEvidence]
  );
  const nativeBetaDocumentationEvidence = useMemo(
    () => buildNativeBetaDocumentationEvidence(nativeBetaEvidenceLedger),
    [nativeBetaEvidenceLedger]
  );
  const nativeBetaDistributionReadiness = useMemo(
    () =>
      buildNativeBetaDistributionReadiness({
        scanMode: dataMode,
        nativeCapability,
        runtimeCapabilities: runtimeCapabilities.result,
        scanSession,
        privacyBoundary,
        releaseGate,
        validationEvidence,
        documentationEvidence: nativeBetaDocumentationEvidence
      }),
    [dataMode, nativeCapability, runtimeCapabilities.result, scanSession, privacyBoundary, releaseGate, validationEvidence, nativeBetaDocumentationEvidence]
  );
  const publicBetaReadiness = useMemo(
    () =>
      buildPublicBetaReadiness({
        scanMode: dataMode,
        nativeCapability,
        runtimeCapabilities: runtimeCapabilities.result,
        releaseGate,
        privacyBoundary,
        validationEvidence,
        documentationEvidence: nativeBetaDocumentationEvidence,
        distributionReadiness: nativeBetaDistributionReadiness
      }),
    [dataMode, nativeCapability, runtimeCapabilities.result, releaseGate, privacyBoundary, validationEvidence, nativeBetaDocumentationEvidence, nativeBetaDistributionReadiness]
  );
  const supportBundle = useMemo(
    () =>
      buildSupportBundle({
        profile,
        scanMode: dataMode,
        scanSettings,
        scanSession,
        nativeScan: nativeScan.result,
        scanCoverage,
        privacyBoundary,
        publicBetaReadiness,
        releaseGate,
        runtimeCapabilities: runtimeCapabilities.result,
        executorPlan,
        rollbackPlan,
        ledgerHistorySummary
      }),
    [profile, dataMode, scanSettings, scanSession, nativeScan.result, scanCoverage, privacyBoundary, publicBetaReadiness, releaseGate, runtimeCapabilities.result, executorPlan, rollbackPlan, ledgerHistorySummary]
  );
  const windowsSetupAssistant = useMemo(
    () =>
      buildWindowsSetupAssistant({
        nativeCapability,
        runtimeCapabilities: runtimeCapabilities.result,
        scanMode: dataMode,
        scanSession,
        scanCoverage,
        privacyBoundary,
        publicBetaReadiness,
        validationPack,
        releaseGate,
        supportBundle
      }),
    [nativeCapability, runtimeCapabilities.result, dataMode, scanSession, scanCoverage, privacyBoundary, publicBetaReadiness, validationPack, releaseGate, supportBundle]
  );
  const demoRehearsalRunbook = useMemo(
    () =>
      buildDemoRehearsalRunbook({
        scanned,
        scanning,
        scanMode: dataMode,
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
        ledger: activeLedger,
        planSnapshot,
        agentQuestionQueue: baseAgentQuestionQueue,
        runtimeCapabilities: runtimeCapabilities.result
      }),
    [
      scanned,
      scanning,
      dataMode,
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
      activeLedger,
      planSnapshot,
      baseAgentQuestionQueue,
      runtimeCapabilities.result
    ]
  );
  const releaseReviewPacket = useMemo(
    () =>
      buildReleaseReviewPacket({
        planSnapshot,
        scanSession,
        taskCapabilityGrants,
        firstSafeExecutorContract,
        writeBoundaryProbe,
        validationPack,
        rollbackPlan,
        rescanComparison,
        privilegeBoundary,
        privacyBoundary,
        publicBetaReadiness,
        nativeBetaDistributionReadiness,
        nativeBetaEvidenceLedger,
        supportBundle,
        releaseGate,
        writeReadiness,
        realExecutorCapsule,
        executorPlan,
        runtimeCapabilities: runtimeCapabilities.result,
        consentReceipt
      }),
    [
      planSnapshot,
      scanSession,
      taskCapabilityGrants,
      firstSafeExecutorContract,
      writeBoundaryProbe,
      validationPack,
      rollbackPlan,
      rescanComparison,
      privilegeBoundary,
      privacyBoundary,
      publicBetaReadiness,
      nativeBetaDistributionReadiness,
      nativeBetaEvidenceLedger,
      supportBundle,
      releaseGate,
      writeReadiness,
      realExecutorCapsule,
      executorPlan,
      runtimeCapabilities.result,
      consentReceipt
    ]
  );
  const safetyInterlock = useMemo(
    () =>
      buildSafetyInterlock({
        runtimeCapabilities: runtimeCapabilities.result,
        nativeScan: nativeScan.result,
        scanSession,
        runReadiness,
        consentReceipt,
        planLock,
        executorPlan,
        taskPowerBroker,
        taskCapabilityGrants,
        taskPowerLeaseAudit,
        writeBoundaryProbe,
        releaseReviewPacket,
        writeReadiness
      }),
    [
      runtimeCapabilities.result,
      nativeScan.result,
      scanSession,
      runReadiness,
      consentReceipt,
      planLock,
      executorPlan,
      taskPowerBroker,
      taskCapabilityGrants,
      taskPowerLeaseAudit,
      writeBoundaryProbe,
      releaseReviewPacket,
      writeReadiness
    ]
  );
  const dryRunLaunchGuard = useMemo(
    () =>
      buildDryRunLaunchGuard({
        runReadiness,
        consentReceipt,
        safetyInterlock,
        planLock
      }),
    [runReadiness, consentReceipt, safetyInterlock, planLock]
  );
  const realDataLaunchRoadmap = useMemo(
    () =>
      buildRealDataLaunchRoadmap({
        scanMode: dataMode,
        scanSession,
        scanCoverage,
        driveInventorySummary,
        nativeEvidenceQuality,
        demoRehearsalRunbook,
        windowsSetupAssistant,
        publicBetaReadiness,
        nativeBetaDistributionReadiness,
        validationPack,
        releaseReviewPacket,
        writeReadiness,
        realExecutorCapsule,
        firstSafeValidationGate,
        firstSafeImplementationWorkOrder,
        tempExecutorActivationGate,
        tempExecutorActivationRehearsal,
        writeBoundaryProbe,
        runtimeCapabilities: runtimeCapabilities.result
      }),
    [
      dataMode,
      scanSession,
      scanCoverage,
      driveInventorySummary,
      nativeEvidenceQuality,
      demoRehearsalRunbook,
      windowsSetupAssistant,
      publicBetaReadiness,
      nativeBetaDistributionReadiness,
      validationPack,
      releaseReviewPacket,
      writeReadiness,
      realExecutorCapsule,
      firstSafeValidationGate,
      firstSafeImplementationWorkOrder,
      tempExecutorActivationGate,
      tempExecutorActivationRehearsal,
      writeBoundaryProbe,
      runtimeCapabilities.result
    ]
  );
  const agentQuestionQueue = useMemo(
    () =>
      buildAgentQuestionQueue({
        scanned,
        scanning,
        scanMode: dataMode,
        scanSession,
        nativeCapability,
        runtimeCapabilities: runtimeCapabilities.result,
        actionList,
        selectedIds,
        approvals,
        readiness,
        reviewWorkbench,
        recoveryAdvisor,
        manualStrategyChecklist,
        runReadiness,
        consentReceipt,
        dryRunLaunchGuard,
        safetyInterlock,
        verificationSummary,
        rescanComparison,
        rollbackPlan,
        customRootTriage,
        validationPack,
        fixtureImportResult,
        writeBoundaryProbe,
        intakePolicy
      }),
    [
      scanned,
      scanning,
      dataMode,
      scanSession,
      nativeCapability,
      runtimeCapabilities.result,
      actionList,
      selectedIds,
      approvals,
      readiness,
      reviewWorkbench,
      recoveryAdvisor,
      manualStrategyChecklist,
      runReadiness,
      consentReceipt,
      dryRunLaunchGuard,
      safetyInterlock,
      verificationSummary,
      rescanComparison,
      rollbackPlan,
      customRootTriage,
      validationPack,
      fixtureImportResult,
      writeBoundaryProbe,
      intakePolicy
    ]
  );
  const operatingChecklist = useMemo(
    () =>
      buildOperatingChecklist({
        scanned,
        scanning,
        scanMode: dataMode,
        scanSession,
        agentQuestionQueue,
        runReadiness,
        consentReceipt,
        dryRunLaunchGuard,
        safetyInterlock,
        ledger: activeLedger,
        planSnapshot,
        writeReadiness,
        releaseReviewPacket,
        runtimeCapabilities: runtimeCapabilities.result
      }),
    [
      scanned,
      scanning,
      dataMode,
      scanSession,
      agentQuestionQueue,
      runReadiness,
      consentReceipt,
      dryRunLaunchGuard,
      safetyInterlock,
      activeLedger,
      planSnapshot,
      writeReadiness,
      releaseReviewPacket,
      runtimeCapabilities.result
    ]
  );
  const openAiAgentContext = useMemo(
    () =>
      buildOpenAIAgentContext({
        profile,
        scanMode: dataMode,
        scanSession,
        actionList,
        selectedIds,
        readiness,
        runReadiness,
        dryRunLaunchGuard,
        safetyInterlock,
        candidateSafetyManifest,
        nativeEvidenceQuality,
        storagePressureDiagnosis,
        executorPlan,
        nativeScan: nativeScan.result,
        runtimeCapabilities: runtimeCapabilities.result,
        itemReviewsByAction,
        approvals,
        driveInventorySummary,
        customRootTriage,
        writeReadiness,
        releaseGate,
        validationPack,
        consentReceipt,
        executionProofHandoff,
        rescanComparison,
        planSnapshot
      }),
    [
      profile,
      dataMode,
      scanSession,
      actionList,
      selectedIds,
      readiness,
      runReadiness,
      dryRunLaunchGuard,
      safetyInterlock,
      candidateSafetyManifest,
      nativeEvidenceQuality,
      storagePressureDiagnosis,
      executorPlan,
      nativeScan.result,
      runtimeCapabilities.result,
      itemReviewsByAction,
      approvals,
      driveInventorySummary,
      customRootTriage,
      writeReadiness,
      releaseGate,
      validationPack,
      consentReceipt,
      executionProofHandoff,
      rescanComparison,
      planSnapshot
    ]
  );
  const openAiRecommendationExecutionState = useMemo(
    () => ({
      planId: planSnapshot.id,
      scanFingerprint: scanSession.currentFingerprint,
      consentPlanId: consentReceipt.planId,
      proofStatus: executionProofHandoff.status,
      largeFileArchiveDestination,
      permanentRemovalConfirmed: approvals.permanentConfirm
    }),
    [planSnapshot.id, scanSession.currentFingerprint, consentReceipt.planId, executionProofHandoff.status, largeFileArchiveDestination, approvals.permanentConfirm]
  );
  const openAiRecommendationBroker = useMemo(
    () =>
      buildOpenAIAgentRecommendationBroker({
        advice: aiAdvice.result?.advice,
        context: openAiAgentContext,
        executionState: openAiRecommendationExecutionState
      }),
    [aiAdvice.result, openAiAgentContext, openAiRecommendationExecutionState]
  );
  const aiAgentIntegration = useMemo(
    () =>
      buildAIAgentIntegration({
        providerConfig: {
          connected: openAiConfig.connected || runtimeCapabilities.result.openAiAdvisorConfigured,
          provider: openAiConfig.provider,
          model: openAiConfig.model,
          endpoint: openAiConfig.endpoint,
          keySource: runtimeCapabilities.result.openAiAdvisorConfigured ? runtimeCapabilities.result.openAiKeySource : openAiConfig.keySource,
          reasoningEffort: openAiConfig.reasoningEffort
        },
        agentQuestionQueue,
        operatingChecklist,
        nativeEvidenceQuality,
        candidateSafetyManifest,
        runtimeCapabilities: runtimeCapabilities.result
      }),
    [openAiConfig, agentQuestionQueue, operatingChecklist, nativeEvidenceQuality, candidateSafetyManifest, runtimeCapabilities.result]
  );
  const userDecisionReceipt = useMemo(
    () =>
      buildUserDecisionReceipt({
        actionList,
        selectedIds,
        approvals,
        itemReviewsByAction,
        protectedPaths,
        intakePolicy,
        consentReceipt,
        planSnapshot,
        agentQuestionQueue,
        operatingChecklist,
        safetyInterlock,
        runtimeCapabilities: runtimeCapabilities.result
      }),
    [
      actionList,
      selectedIds,
      approvals,
      itemReviewsByAction,
      protectedPaths,
      intakePolicy,
      consentReceipt,
      planSnapshot,
      agentQuestionQueue,
      operatingChecklist,
      safetyInterlock,
      runtimeCapabilities.result
    ]
  );
  const productCompletionAudit = useMemo(
    () =>
      buildProductCompletionAudit({
        scanned,
        scanMode: dataMode,
        actionList,
        selectedIds,
        readiness,
        scanSession,
        scanCoverage,
        driveInventorySummary,
        storagePressureDiagnosis,
        nativeEvidenceQuality,
        candidateSafetyManifest,
        aiAgentIntegration,
        demoRehearsalRunbook,
        windowsSetupAssistant,
        taskPowerCatalog,
        taskPowerBroker,
        taskCapabilityGrants,
        taskRunbook,
        restrictionPolicyMatrix,
        agentQuestionQueue,
        executorPlan,
        runReadiness,
        consentReceipt,
        ledger: activeLedger,
        planSnapshot,
        storageStrategy,
        manualStrategyChecklist,
        customRootTriage,
        privacyBoundary,
        publicBetaReadiness,
        supportBundle,
        validationPack,
        releaseReviewPacket,
        safetyInterlock,
        writeReadiness,
        realExecutorCapsule,
        tempExecutorActivationGate,
        planLock,
        runtimeCapabilities: runtimeCapabilities.result
      }),
    [
      scanned,
      dataMode,
      actionList,
      selectedIds,
      readiness,
      scanSession,
      scanCoverage,
      driveInventorySummary,
      storagePressureDiagnosis,
      nativeEvidenceQuality,
      candidateSafetyManifest,
      aiAgentIntegration,
      demoRehearsalRunbook,
      windowsSetupAssistant,
      taskPowerCatalog,
      taskPowerBroker,
      taskCapabilityGrants,
      taskRunbook,
      restrictionPolicyMatrix,
      agentQuestionQueue,
      executorPlan,
      runReadiness,
      consentReceipt,
      activeLedger,
      planSnapshot,
      storageStrategy,
      manualStrategyChecklist,
      customRootTriage,
      privacyBoundary,
      publicBetaReadiness,
      supportBundle,
      validationPack,
      releaseReviewPacket,
      safetyInterlock,
      writeReadiness,
      realExecutorCapsule,
      tempExecutorActivationGate,
      planLock,
      runtimeCapabilities.result
    ]
  );
  const workflowHandoff = useMemo(
    () =>
      buildWorkflowHandoffPacket({
        agentQuestionQueue,
        productCompletionAudit,
        demoRehearsalRunbook,
        windowsSetupAssistant,
        scanSession,
        nativeBetaEvidenceLedger,
        supportBundle,
        releaseReviewPacket,
        tempExecutorActivationGate,
        runReadiness,
        consentReceipt,
        ledgerHistorySummary,
        runtimeCapabilities: runtimeCapabilities.result
      }),
    [
      agentQuestionQueue,
      productCompletionAudit,
      demoRehearsalRunbook,
      windowsSetupAssistant,
      scanSession,
      nativeBetaEvidenceLedger,
      supportBundle,
      releaseReviewPacket,
      tempExecutorActivationGate,
      runReadiness,
      consentReceipt,
      ledgerHistorySummary,
      runtimeCapabilities.result
    ]
  );
  const betaHandoffManifest = useMemo(
    () =>
      buildBetaHandoffManifest({
        workflowHandoff,
        supportBundle,
        releaseReviewPacket,
        validationPack,
        nativeBetaEvidenceLedger,
        productCompletionAudit,
        nativeBetaDistributionReadiness,
        publicBetaReadiness,
        runtimeCapabilities: runtimeCapabilities.result
      }),
    [
      workflowHandoff,
      supportBundle,
      releaseReviewPacket,
      validationPack,
      nativeBetaEvidenceLedger,
      productCompletionAudit,
      nativeBetaDistributionReadiness,
      publicBetaReadiness,
      runtimeCapabilities.result
    ]
  );
  const localEvidenceBackup = useMemo(
    () =>
      buildLocalEvidenceBackup({
        validationEvidence,
        rollbackEvidence,
        manualStrategyEvidence,
        customRootTriageEvidence,
        nativeBetaEvidence,
        runHistory
      }),
    [validationEvidence, rollbackEvidence, manualStrategyEvidence, customRootTriageEvidence, nativeBetaEvidence, runHistory]
  );
  const families = useMemo(() => buildFamilyGroups(selectedIds, actionList, { approvals, itemReviewsByAction }), [selectedIds, actionList, approvals, itemReviewsByAction]);
  const usedPercent = Math.round((profile.usedBytes / profile.totalBytes) * 100);
  const selectedPercent = Math.min(100, Math.round((totals.selectedBytes / (goalGb * GB)) * 100));

  const filteredActions = useMemo(() => {
    return actionList.filter((action) => filter === "all" || action.risk === filter);
  }, [filter, actionList]);

  function clearExecutionState() {
    setLedger([]);
    setExecutionProofContext(null);
    setNativeExecutorDryRun({ status: "idle", result: null, error: "" });
    setNativeScopeEvidenceExport({ status: "idle", result: null, error: "" });
    setNativeWriteBoundary({ status: "idle", result: null, error: "" });
    setNativeRealExecution({ status: "idle", result: null, error: "" });
    setNativeProjectDependencyExecution({ status: "idle", result: null, error: "" });
    setNativeBrowserCacheExecution({ status: "idle", result: null, error: "" });
    setNativeGradleCacheExecution({ status: "idle", result: null, error: "" });
    setNativePipCacheExecution({ status: "idle", result: null, error: "" });
    setNativeDockerBuildCacheExecution({ status: "idle", result: null, error: "" });
    setNativeNpmCacheExecution({ status: "idle", result: null, error: "" });
    setNativeRecycleBinExecution({ status: "idle", result: null, error: "" });
    setExecutionConsent({ accepted: false, planId: "", acceptedAt: "" });
  }

  function updateScanSetting(key, value) {
    const nextValue = key === "targetDrive" && typeof value === "string" ? value.toUpperCase().slice(0, 3) : value;
    setScanSettings((current) => ({ ...current, [key]: nextValue }));
    if (nativeScan.result) {
      setNativeScan({ status: "idle", result: null, error: "" });
      setScanned(false);
      setScanProgress(0);
      setScanLabel("Scan settings changed");
    }
    clearExecutionState();
  }

  function addCustomScanRoot() {
    const cleanRoot = customRootInput.trim();
    if (!cleanRoot) return;
    const currentRoots = scanSettings.customRoots || [];
    const exists = currentRoots.some((root) => root.toLowerCase() === cleanRoot.toLowerCase());
    if (exists || currentRoots.length >= 8) {
      setCustomRootInput("");
      return;
    }
    updateScanSetting("customRoots", [...currentRoots, cleanRoot]);
    setCustomRootInput("");
  }

  function removeCustomScanRoot(root) {
    updateScanSetting(
      "customRoots",
      (scanSettings.customRoots || []).filter((item) => item !== root)
    );
  }

  function runScan() {
    if (scanning) return;

    setScanning(true);
    setScanned(false);
    setNativeScan({ status: "idle", result: null, error: "" });
    setApprovals({ groupConfirm: false, permanentConfirm: false, reviewed: {}, reviewItems: {}, typed: {} });
    setScanProgress(0);
    clearExecutionState();
    setActiveStage("discover");

    const labels = [
      "Reading disk shape",
      "Matching known cleanup recipes",
      "Classifying risk gates",
      "Preparing guarded plan"
    ];

    let tick = 0;
    const timer = window.setInterval(() => {
      tick += 1;
      const progress = Math.min(100, tick * 10);
      setScanProgress(progress);
      setScanLabel(labels[Math.min(labels.length - 1, Math.floor(tick / 3))]);

      if (progress >= 100) {
        window.clearInterval(timer);
        setScanning(false);
        setScanned(true);
        setScanLabel("Demo scan complete");
        setActiveStage("gate");
        applyModeDefaults(mode, true, actionList);
      }
    }, 90);
  }

  async function runRealReadonlyScan() {
    if (nativeScan.status === "scanning" || scanning) return;
    if (!nativeScanRequestGuard.canScan) {
      clearExecutionState();
      setNativeScan({ status: "blocked", result: null, error: nativeScanRequestGuard.primary });
      setScanned(false);
      setScanProgress(0);
      setScanLabel("Native scan settings blocked");
      setActiveStage("discover");
      return;
    }

    setNativeScan({ status: "scanning", result: null, error: "" });
    setApprovals({ groupConfirm: false, permanentConfirm: false, reviewed: {}, reviewItems: {}, typed: {} });
    setScanning(true);
    setScanned(false);
    setScanProgress(0);
    setScanLabel("Starting native read-only scan");
    clearExecutionState();
    setActiveStage("discover");

    try {
      const result = await runNativeReadonlyScan({
        protectedPaths,
        ...scanSettings,
        targetDrive
      });

      if (!result.available) {
        setNativeScan({ status: "unavailable", result: null, error: result.warnings[0] || "Native scanner unavailable." });
        setScanLabel("Native scanner unavailable");
        setScanProgress(0);
        return;
      }

      const nativeActions = mergeNativeScanIntoActions(buildScenarioActions(scenarioId), result);
      setNativeScan({ status: "complete", result, error: "" });
      setScanned(true);
      setScanProgress(100);
      setScanLabel("Real read-only scan complete");
      setActiveStage("gate");
      applyModeDefaults(mode, true, nativeActions);
    } catch (error) {
      setNativeScan({ status: "error", result: null, error: error instanceof Error ? error.message : String(error) });
      setScanLabel("Native scan failed");
      setScanProgress(0);
    } finally {
      setScanning(false);
    }
  }

  async function runPostRunReadonlyScan() {
    if (nativeScan.status === "scanning" || scanning) return;
    if (!activeLedger.length) {
      setScanLabel("Run execution before post-run rescan");
      setActiveStage("verify");
      return;
    }
    if (!nativeCapability.available) {
      setNativeScan({ status: "unavailable", result: nativeScan.result, error: "Post-run rescan requires the Tauri desktop shell." });
      setScanLabel("Native scanner unavailable");
      setActiveStage("verify");
      return;
    }
    if (!nativeScanRequestGuard.canScan) {
      setNativeScan({ status: "blocked", result: nativeScan.result, error: nativeScanRequestGuard.primary });
      setScanLabel("Native scan settings blocked");
      setActiveStage("verify");
      return;
    }

    setNativeScan({ status: "scanning", result: nativeScan.result, error: "" });
    setScanning(true);
    setScanned(true);
    setScanProgress(0);
    setScanLabel("Starting post-run native rescan");
    setActiveStage("verify");

    try {
      const result = await runNativeReadonlyScan({
        protectedPaths,
        ...scanSettings,
        targetDrive
      });

      if (!result.available) {
        setNativeScan({ status: "unavailable", result: nativeScan.result, error: result.warnings[0] || "Native scanner unavailable." });
        setScanLabel("Native scanner unavailable");
        setScanProgress(0);
        return;
      }

      setNativeScan({ status: "complete", result, error: "" });
      setScanned(true);
      setScanProgress(100);
      setScanLabel("Post-run native rescan complete");
      setActiveStage("verify");
    } catch (error) {
      setNativeScan({ status: "error", result: nativeScan.result, error: error instanceof Error ? error.message : String(error) });
      setScanLabel("Post-run native rescan failed");
      setScanProgress(0);
    } finally {
      setScanning(false);
    }
  }

  function applyModeDefaults(nextMode, force = false, planActions = actionList) {
    if (!scanned && !force) return;

    setSelectedIds(
      buildModeDefaultSelection(nextMode, {
        goalBytes: goalGb * GB,
        actionList: planActions,
        protectedPaths,
        intakePolicy
      })
    );

    clearExecutionState();
    setActiveStage("gate");
  }

  function setModeAndPlan(nextMode) {
    setMode(nextMode);
    applyModeDefaults(nextMode);
  }

  function setAdminAllowance(nextAllowed) {
    setAdminActionsAllowed(nextAllowed);
    if (!nextAllowed) {
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const action of actionList) {
          if (actionRequiresAdminConsent(action)) next.delete(action.id);
        }
        return next;
      });
    }
    clearExecutionState();
    setActiveStage("intake");
  }

  function approveRebuildableCaches() {
    setApprovals((current) => ({ ...current, groupConfirm: true }));
    clearExecutionState();
    setActiveStage("gate");
  }

  function confirmPermanentRemoval() {
    setApprovals((current) => ({ ...current, permanentConfirm: true }));
    clearExecutionState();
    setActiveStage("gate");
  }

  function suggestPlan() {
    if (!scanned) {
      runScan();
      return;
    }
    setSelectedIds(buildSuggestedPlan(goalGb * GB, new Set(), actionList, protectedPaths, intakePolicy));
    clearExecutionState();
    setActiveStage("gate");
  }

  function toggleAction(action) {
    if (!scanned || !selectableAction(action, protectedPaths, intakePolicy)) return;
    const willSelect = !selectedIds.has(action.id);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return next;
    });
    if (willSelect) {
      const scopedRoute = getScopedExecutorRouteForAction(action);
      if (scopedRoute) selectScopedExecutorRoute(scopedRoute);
    }
    if (willSelect && action.gate === "review") setFocusedReviewId(action.id);
    clearExecutionState();
  }

  function selectActionById(actionId) {
    const action = actionList.find((item) => item.id === actionId);
    if (!scanned || !action || !selectableAction(action, protectedPaths, intakePolicy)) return;
    setSelectedIds((current) => new Set([...current, action.id]));
    const scopedRoute = getScopedExecutorRouteForAction(action);
    if (scopedRoute) selectScopedExecutorRoute(scopedRoute);
    if (action.gate === "review") setFocusedReviewId(action.id);
    clearExecutionState();
    setActiveStage("gate");
  }

  async function simulateCleanup() {
    if (!dryRunLaunchGuard.ready || !planLock.readyForLaunch) return;
    setActiveStage("execute");
    setNativeExecutorDryRun({ status: "running", result: null, error: "" });
    const executedAt = new Date().toISOString();
    let nextLedger = [];

    if (nativeCapability.available) {
      try {
        const result = await runNativeExecutorDryRun(executorPlan);
        setNativeExecutorDryRun({ status: "complete", result, error: "" });
        nextLedger = result.entries.map((entry, index) => ({
          id: entry.id,
          planId: planSnapshot.id,
          executedAt,
          time: `T+${String(index + 1).padStart(2, "0")}m`,
          title: entry.title,
          result: entry.result,
          bytes: entry.bytes,
          method: `${entry.route}: ${entry.note}`
        }));
      } catch (error) {
        setNativeExecutorDryRun({ status: "error", result: null, error: error instanceof Error ? error.message : String(error) });
        nextLedger = makeExecutionLedgerForActions(selectedIds, actionList, protectedPaths, { approvals, itemReviewsByAction, planSnapshot, executedAt });
      }
    } else {
      setNativeExecutorDryRun({ status: "browser-demo", result: null, error: "" });
      nextLedger = makeExecutionLedgerForActions(selectedIds, actionList, protectedPaths, { approvals, itemReviewsByAction, planSnapshot, executedAt });
    }

    commitExecutionLedger(nextLedger, { executedAt, source: nativeCapability.available ? "native-dry-run" : "browser-demo" });
  }

  function recordLedgerRun(nextLedger, source = "execution", createdAt = new Date().toISOString()) {
    if (!nextLedger.length) return;
    const record = buildLedgerRunRecord({
      planSnapshot,
      ledger: nextLedger,
      executorPlan,
      scanMode: dataMode,
      scanSettings,
      nativeScan: nativeScan.result,
      runtimeCapabilities: runtimeCapabilities.result,
      runReadiness,
      dryRunLaunchGuard,
      source,
      createdAt
    });
    setRunHistory((current) => appendLedgerRunRecord(current, record, { limit: RUN_HISTORY_LIMIT }));
  }

  function buildNativeExecutionLedger(result, executedAt) {
    return (result.entries || []).map((entry, index) => ({
      id: entry.id,
      planId: planSnapshot.id,
      executedAt,
      time: `T+${String(index + 1).padStart(2, "0")}m`,
      title: entry.title,
      result: entry.result,
      bytes: entry.bytes,
      method: `${entry.route}: ${entry.note}`
    }));
  }

  function commitExecutionLedger(nextLedger, { executedAt = new Date().toISOString(), source = "execution" } = {}) {
    const sourcedLedger = nextLedger.map((entry) => ({
      ...entry,
      executedAt: entry.executedAt || executedAt,
      source: entry.source || source
    }));
    setLedger(sourcedLedger);
    setExecutionProofContext({
      planSnapshot,
      executorPlan,
      scanMode: dataMode,
      source,
      recordedAt: executedAt
    });
    recordLedgerRun(sourcedLedger, source, executedAt);
    window.setTimeout(() => setActiveStage("verify"), 240);
  }

  function getPostRunProofExecutionBlocker() {
    if (!activeLedger.length) return "";
    if (executionProofHandoff.status === "waiting-for-execution" || executionProofHandoff.status === "proof-complete") return "";
    return `Finish post-run proof before another scoped executor. Current proof state: ${executionProofHandoff.status}.`;
  }

  function blockExecutorForPendingProof(setExecution) {
    const blocker = getPostRunProofExecutionBlocker();
    if (!blocker) return false;
    setExecution({
      status: "blocked",
      result: null,
      error: blocker
    });
    setActiveStage("verify");
    return true;
  }

  function blockExecutorForInactiveRoute(route, setExecution) {
    const gate = buildScopedExecutorRunGate({
      route,
      smokeRunPacket: executorSmokeRunPacket,
      activeRouteOverride: selectedScopedExecutorRouteRef.current,
      executionProofHandoff
    });
    if (gate.status !== "inactive-route") return false;
    setExecution({
      status: "blocked",
      result: null,
      error: gate.primary
    });
    selectScopedExecutorRoute(gate.activeRoute || route);
    focusWorkflowPanel("scoped-executor-command-flow-panel");
    return true;
  }

  function armExecutionConsent() {
    const activeRoute = selectedScopedExecutorRoute || realExecutorCapsule?.route?.id || "";
    const scopedExecutorRuntime = isScopedExecutorRouteEnabled(activeRoute, runtimeCapabilities.result);
    if (!runReadiness.ready || !planLock.readyForPreflight || (safetyInterlock.status === "unsafe-stop" && !scopedExecutorRuntime)) return;
    setExecutionConsent({
      accepted: true,
      planId: planSnapshot.id,
      planLockId: planLock.lockId,
      acceptedAt: new Date().toISOString()
    });
  }

  async function probeNativeWriteBoundary() {
    if (nativeWriteBoundary.status === "running") return;
    if (!runtimeCapabilities.result.executeCleanupPlan) {
      setNativeWriteBoundary({
        status: "unavailable",
        result: {
          available: false,
          accepted: false,
          realRunEnabled: false,
          destructiveCommands: false,
          entries: [],
          warnings: ["Native write boundary is unavailable in this runtime."]
        },
        error: "Native rejecting write command is not available."
      });
      return;
    }

    setNativeWriteBoundary({ status: "running", result: null, error: "" });
    try {
      const result = await runNativeWriteBoundary({
        capsule: realExecutorCapsule,
        contract: firstSafeExecutorContract,
        planId: planSnapshot.id
      });
      setNativeWriteBoundary({ status: "complete", result, error: "" });
    } catch (error) {
      setNativeWriteBoundary({
        status: "error",
        result: null,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function askOpenAIAgent() {
    if (aiAdvice.status === "running") return;
    setAiAdvice({ status: "running", result: null, error: "" });
    try {
      const result = await requestOpenAIAgentAdvice({
        context: openAiAgentContext,
        userPrompt: aiPrompt,
        config: openAiConfig
      });
      setAiAdvice({ status: "complete", result, error: "" });
      const recommendationBroker = buildOpenAIAgentRecommendationBroker({
        advice: result.advice,
        context: openAiAgentContext,
        executionState: openAiRecommendationExecutionState
      });
      const runRecord = buildOpenAIAgentRunRecord({
        result,
        context: openAiAgentContext,
        userPrompt: aiPrompt,
        planSnapshot,
        recommendationBroker
      });
      setOpenAiAgentRunHistory((current) => appendOpenAIAgentRunRecord(current, runRecord, { limit: OPENAI_AGENT_RUN_HISTORY_LIMIT }));
    } catch (error) {
      setAiAdvice({
        status: "error",
        result: null,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  function getOpenAIBrokerRow(row = {}) {
    const key = getOpenAIAgentRecommendationKey(row);
    return openAiRecommendationBroker.rows.find((item) => item.key === key) || null;
  }

  async function handleOpenAIAgentRecommendation(row = {}) {
    const brokerRow = getOpenAIBrokerRow(row);
    const actionType = String(row.actionType || "").toLowerCase();
    const deterministicRoute = brokerRow?.kind === "scoped-executor"
      ? brokerRow?.executorRoute || brokerRow?.route || row.route
      : actionType.startsWith("run-")
        ? row.route
        : "";
    if (brokerRow && !brokerRow.canAct) {
      if (brokerRow.targetPanel) focusWorkflowPanel(brokerRow.targetPanel);
      return;
    }
    if (deterministicRoute) selectScopedExecutorRoute(deterministicRoute);
    if (actionType === "rescan") {
      if (nativeCapability.available) {
        await runRealReadonlyScan();
      } else {
        await runScan();
      }
      return;
    }
    if (actionType === "review-target") {
      const actionId = brokerRow?.focusActionId || row.targetId || row.id;
      if (actionId) setFocusedReviewId(actionId);
      focusWorkflowPanel("item-review-panel");
      return;
    }
    if (actionType === "select-action") {
      const actionId = brokerRow?.targetId || row.targetId || row.id;
      if (actionId) selectActionById(actionId);
      focusWorkflowPanel("cleanup-actions-panel");
      return;
    }
    if (actionType === "ask-user") {
      focusWorkflowPanel("agent-question-panel");
      return;
    }
    if (actionType === "manual-only") {
      const targetId = String(row.targetId || row.id || "").toLowerCase();
      const route = String(row.route || "").toLowerCase();
      if (targetId.startsWith("custom-root") || route.includes("custom-root")) {
        focusWorkflowPanel("custom-root-triage-panel");
        return;
      }
      if (targetId.startsWith("drive-") || route.includes("drive-inventory")) {
        focusWorkflowPanel("drive-inventory-panel");
        return;
      }
      if (targetId.includes("installed-app") || route.includes("manual-app-uninstall")) {
        setFocusedReviewId("installed-app-footprints");
        focusWorkflowPanel("app-uninstall-work-order-panel");
        return;
      }
      if (targetId.includes("wsl") || route.includes("advanced-checklist")) {
        focusWorkflowPanel("wsl-compaction-work-order-panel");
        return;
      }
      setFocusedReviewId("installed-app-footprints");
      focusWorkflowPanel("item-review-panel");
      return;
    }
    if (actionType === "run-temp-executor") {
      focusWorkflowPanel("first-safe-temp-executor-panel");
      await executeFirstSafeTempCleanup();
      return;
    }
    if (actionType === "run-downloads-cleanup-executor") {
      focusWorkflowPanel("downloads-cleanup-executor-panel");
      await executeReviewedDownloadsCleanup();
      return;
    }
    if (actionType === "run-large-file-archive-executor") {
      focusWorkflowPanel("large-file-archive-executor-panel");
      await executeLargeFileArchive();
      return;
    }
    if (actionType === "run-project-deps-executor") {
      focusWorkflowPanel("project-dependency-executor-panel");
      await executeReviewedProjectDependencies();
      return;
    }
    if (actionType === "run-browser-cache-executor") {
      focusWorkflowPanel("browser-cache-executor-panel");
      await executeBrowserCacheCleanup();
      return;
    }
    if (actionType === "run-gradle-cache-executor") {
      focusWorkflowPanel("gradle-cache-executor-panel");
      await executeGradleCacheCleanup();
      return;
    }
    if (actionType === "run-user-cache-executor") {
      focusWorkflowPanel("user-cache-executor-panel");
      await executeUserCacheCleanup();
      return;
    }
    if (actionType === "run-android-cache-executor") {
      focusWorkflowPanel("android-cache-executor-panel");
      await executeAndroidCacheCleanup();
      return;
    }
    if (actionType === "run-shader-cache-executor") {
      focusWorkflowPanel("shader-cache-executor-panel");
      await executeShaderCacheCleanup();
      return;
    }
    if (actionType === "run-pip-cache-executor") {
      focusWorkflowPanel("pip-cache-executor-panel");
      await executePipCacheCleanup();
      return;
    }
    if (actionType === "run-docker-build-cache-executor") {
      focusWorkflowPanel("docker-build-cache-executor-panel");
      await executeDockerBuildCacheCleanup();
      return;
    }
    if (actionType === "run-npm-cache-executor") {
      focusWorkflowPanel("npm-cache-executor-panel");
      await executeNpmCacheCleanup();
      return;
    }
    if (actionType === "run-pnpm-store-executor") {
      focusWorkflowPanel("pnpm-store-executor-panel");
      await executePnpmStoreCleanup();
      return;
    }
    if (actionType === "run-recycle-bin-executor") {
      focusWorkflowPanel("recycle-bin-executor-panel");
      await executeRecycleBinCleanup();
    }
  }

  async function executeFirstSafeTempCleanup() {
    if (nativeRealExecution.status === "running") return;
    if (blockExecutorForPendingProof(setNativeRealExecution)) return;
    if (blockExecutorForInactiveRoute("known-temp-delete", setNativeRealExecution)) return;
    if (!runtimeCapabilities.result.realRunEnabled || !runtimeCapabilities.result.executorFlags?.tempCleanupExecutor) {
      setNativeRealExecution({
        status: "blocked",
        result: null,
        error: "Temp cleanup executor is not enabled. Set SPACEGUARD_ENABLE_TEMP_EXECUTOR=1 before launching the Tauri app."
      });
      return;
    }

    setActiveStage("execute");
    setNativeRealExecution({ status: "running", result: null, error: "" });
    try {
      const result = await runNativeTempCleanupExecutor({
        capsule: realExecutorCapsule,
        contract: firstSafeExecutorContract,
        planId: planSnapshot.id
      });
      setNativeRealExecution({ status: "complete", result, error: "" });
      const executedAt = new Date().toISOString();
      commitExecutionLedger(buildNativeExecutionLedger(result, executedAt), { executedAt, source: "native-temp-executor" });
    } catch (error) {
      setNativeRealExecution({
        status: "error",
        result: null,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function executeReviewedProjectDependencies() {
    if (nativeProjectDependencyExecution.status === "running") return;
    if (blockExecutorForPendingProof(setNativeProjectDependencyExecution)) return;
    if (blockExecutorForInactiveRoute("item-review-project-cache", setNativeProjectDependencyExecution)) return;
    const projectRows = executorPlan.rows.filter((row) => row.route === "item-review-project-cache" && row.reviewTargets?.length);
    const projectTargets = projectRows.flatMap((row) => row.reviewTargets || []);
    if (!runtimeCapabilities.result.realRunEnabled || !runtimeCapabilities.result.executorFlags?.projectDependencyExecutor) {
      setNativeProjectDependencyExecution({
        status: "blocked",
        result: null,
        error: "Project dependency executor is not enabled. Set SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR=1 before launching the Tauri app."
      });
      return;
    }
    if (!planSnapshot.id || !scanSession.currentFingerprint || !consentReceipt.planId || !projectRows.length) {
      setNativeProjectDependencyExecution({
        status: "blocked",
        result: null,
        error: "Project dependency cleanup needs reviewed remove targets plus current plan, scan fingerprint, and consent receipt."
      });
      return;
    }

    setActiveStage("execute");
    setNativeProjectDependencyExecution({ status: "running", result: null, error: "" });
    try {
      const result = await runNativeProjectDependencyExecutor({
        rows: projectRows,
        planId: planSnapshot.id,
        scanFingerprint: scanSession.currentFingerprint,
        consentPlanId: consentReceipt.planId,
        expectedBytes: projectTargets.reduce((sum, target) => sum + Number(target.bytes || 0), 0)
      });
      setNativeProjectDependencyExecution({ status: "complete", result, error: "" });
      const executedAt = new Date().toISOString();
      commitExecutionLedger(buildNativeExecutionLedger(result, executedAt), { executedAt, source: "native-project-dependency-executor" });
    } catch (error) {
      setNativeProjectDependencyExecution({
        status: "error",
        result: null,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function executeReviewedDownloadsCleanup() {
    if (nativeDownloadsExecution.status === "running") return;
    if (blockExecutorForPendingProof(setNativeDownloadsExecution)) return;
    if (blockExecutorForInactiveRoute("item-review-recycle-bin", setNativeDownloadsExecution)) return;
    const downloadRows = executorPlan.rows.filter((row) => row.route === "item-review-recycle-bin" && row.reviewTargets?.length);
    const downloadTargets = downloadRows.flatMap((row) => row.reviewTargets || []);
    if (!runtimeCapabilities.result.realRunEnabled || !runtimeCapabilities.result.executorFlags?.downloadsCleanupExecutor) {
      setNativeDownloadsExecution({
        status: "blocked",
        result: null,
        error: "Reviewed Downloads executor is not enabled. Set SPACEGUARD_ENABLE_DOWNLOADS_EXECUTOR=1 before launching the Tauri app."
      });
      return;
    }
    if (!planSnapshot.id || !scanSession.currentFingerprint || !consentReceipt.planId || !downloadRows.length) {
      setNativeDownloadsExecution({
        status: "blocked",
        result: null,
        error: "Reviewed Downloads cleanup needs item Remove targets plus current plan, scan fingerprint, and consent receipt."
      });
      return;
    }

    setActiveStage("execute");
    setNativeDownloadsExecution({ status: "running", result: null, error: "" });
    try {
      const result = await runNativeDownloadsCleanupExecutor({
        rows: downloadRows,
        planId: planSnapshot.id,
        scanFingerprint: scanSession.currentFingerprint,
        consentPlanId: consentReceipt.planId,
        expectedBytes: downloadTargets.reduce((sum, target) => sum + Number(target.bytes || 0), 0)
      });
      setNativeDownloadsExecution({ status: "complete", result, error: "" });
      const executedAt = new Date().toISOString();
      commitExecutionLedger(buildNativeExecutionLedger(result, executedAt), { executedAt, source: "native-downloads-recycle-bin-executor" });
    } catch (error) {
      setNativeDownloadsExecution({
        status: "error",
        result: null,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function executeLargeFileArchive() {
    if (nativeLargeFileArchiveExecution.status === "running") return;
    if (blockExecutorForPendingProof(setNativeLargeFileArchiveExecution)) return;
    if (blockExecutorForInactiveRoute("item-review-large-files", setNativeLargeFileArchiveExecution)) return;
    const archiveRows = executorPlan.rows.filter((row) => row.route === "item-review-large-files" && row.archiveTargets?.length);
    const archiveTargets = archiveRows.flatMap((row) => row.archiveTargets || []);
    const archiveDestination = largeFileArchiveDestination.trim();
    if (!runtimeCapabilities.result.realRunEnabled || !runtimeCapabilities.result.executorFlags?.largeFileArchiveExecutor) {
      setNativeLargeFileArchiveExecution({
        status: "blocked",
        result: null,
        error: "Large-file archive executor is not enabled. Set SPACEGUARD_ENABLE_LARGE_FILE_ARCHIVE_EXECUTOR=1 before launching the Tauri app."
      });
      return;
    }
    if (!archiveDestination) {
      setNativeLargeFileArchiveExecution({
        status: "blocked",
        result: null,
        error: "Large-file archive needs an explicit destination folder on another drive."
      });
      return;
    }
    if (!planSnapshot.id || !scanSession.currentFingerprint || !consentReceipt.planId || !archiveRows.length) {
      setNativeLargeFileArchiveExecution({
        status: "blocked",
        result: null,
        error: "Large-file archive needs Move/Archive item targets plus current plan, scan fingerprint, and consent receipt."
      });
      return;
    }

    setActiveStage("execute");
    setNativeLargeFileArchiveExecution({ status: "running", result: null, error: "" });
    try {
      const result = await runNativeLargeFileArchiveExecutor({
        rows: archiveRows,
        archiveDestination,
        planId: planSnapshot.id,
        scanFingerprint: scanSession.currentFingerprint,
        consentPlanId: consentReceipt.planId,
        expectedBytes: archiveTargets.reduce((sum, target) => sum + Number(target.bytes || 0), 0)
      });
      setNativeLargeFileArchiveExecution({ status: "complete", result, error: "" });
      const executedAt = new Date().toISOString();
      commitExecutionLedger(buildNativeExecutionLedger(result, executedAt), { executedAt, source: "native-large-file-archive-executor" });
    } catch (error) {
      setNativeLargeFileArchiveExecution({
        status: "error",
        result: null,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function executeBrowserCacheCleanup() {
    if (nativeBrowserCacheExecution.status === "running") return;
    if (blockExecutorForPendingProof(setNativeBrowserCacheExecution)) return;
    if (blockExecutorForInactiveRoute("browser-cache-only", setNativeBrowserCacheExecution)) return;
    const browserRows = executorPlan.rows.filter((row) => row.route === "browser-cache-only");
    const cacheTargets = (nativeScan.result?.findings || [])
      .filter((finding) => finding.recipeId === "browser-cache")
      .filter((finding) => (finding.status === "measured" || finding.status === "limited") && finding.path)
      .map((finding, index) => ({
        id: `browser-cache-${index + 1}`,
        title: finding.title || "Browser cache root",
        path: finding.path,
        bytes: Number(finding.bytes || 0)
      }));

    if (!runtimeCapabilities.result.realRunEnabled || !runtimeCapabilities.result.executorFlags?.browserCacheExecutor) {
      setNativeBrowserCacheExecution({
        status: "blocked",
        result: null,
        error: "Browser cache executor is not enabled. Set SPACEGUARD_ENABLE_BROWSER_CACHE_EXECUTOR=1 before launching the Tauri app."
      });
      return;
    }
    if (!planSnapshot.id || !scanSession.currentFingerprint || !consentReceipt.planId || !browserRows.length || !cacheTargets.length) {
      setNativeBrowserCacheExecution({
        status: "blocked",
        result: null,
        error: "Browser cache cleanup needs the browser-cache action selected, scanned cache root evidence, current plan, scan fingerprint, and consent receipt."
      });
      return;
    }

    setActiveStage("execute");
    setNativeBrowserCacheExecution({ status: "running", result: null, error: "" });
    try {
      const result = await runNativeBrowserCacheExecutor({
        rows: cacheTargets,
        planId: planSnapshot.id,
        scanFingerprint: scanSession.currentFingerprint,
        consentPlanId: consentReceipt.planId,
        expectedBytes: cacheTargets.reduce((sum, target) => sum + Number(target.bytes || 0), 0)
      });
      setNativeBrowserCacheExecution({ status: "complete", result, error: "" });
      const executedAt = new Date().toISOString();
      commitExecutionLedger(buildNativeExecutionLedger(result, executedAt), { executedAt, source: "native-browser-cache-executor" });
    } catch (error) {
      setNativeBrowserCacheExecution({
        status: "error",
        result: null,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function executeGradleCacheCleanup() {
    if (nativeGradleCacheExecution.status === "running") return;
    if (blockExecutorForPendingProof(setNativeGradleCacheExecution)) return;
    if (blockExecutorForInactiveRoute("bounded-cache-delete", setNativeGradleCacheExecution)) return;
    const gradleRows = executorPlan.rows.filter((row) => row.id === "gradle-cache" && row.route === "bounded-cache-delete");
    const finding = (nativeScan.result?.findings || [])
      .find((row) => row.recipeId === "gradle-cache" && (row.status === "measured" || row.status === "limited") && row.path);
    const gradleTarget = finding
      ? {
          id: "gradle-cache",
          title: finding.title || "Gradle dependency and build cache",
          path: finding.path,
          bytes: Number(finding.bytes || 0)
        }
      : null;

    if (!runtimeCapabilities.result.realRunEnabled || !runtimeCapabilities.result.executorFlags?.gradleCacheExecutor) {
      setNativeGradleCacheExecution({
        status: "blocked",
        result: null,
        error: "Gradle cache executor is not enabled. Set SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR=1 before launching the Tauri app."
      });
      return;
    }
    if (!planSnapshot.id || !scanSession.currentFingerprint || !consentReceipt.planId || !gradleRows.length || !gradleTarget) {
      setNativeGradleCacheExecution({
        status: "blocked",
        result: null,
        error: "Gradle cache cleanup needs the gradle-cache action selected, native Gradle cache evidence, current plan, scan fingerprint, and consent receipt."
      });
      return;
    }

    setActiveStage("execute");
    setNativeGradleCacheExecution({ status: "running", result: null, error: "" });
    try {
      const result = await runNativeGradleCacheExecutor({
        row: gradleTarget,
        planId: planSnapshot.id,
        scanFingerprint: scanSession.currentFingerprint,
        consentPlanId: consentReceipt.planId,
        expectedBytes: gradleTarget.bytes
      });
      setNativeGradleCacheExecution({ status: "complete", result, error: "" });
      const executedAt = new Date().toISOString();
      commitExecutionLedger(buildNativeExecutionLedger(result, executedAt), { executedAt, source: "native-gradle-cache-executor" });
    } catch (error) {
      setNativeGradleCacheExecution({
        status: "error",
        result: null,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function executeNpmCacheCleanup() {
    if (nativeNpmCacheExecution.status === "running") return;
    if (blockExecutorForPendingProof(setNativeNpmCacheExecution)) return;
    if (blockExecutorForInactiveRoute("bounded-npm-cache-delete", setNativeNpmCacheExecution)) return;
    const npmRows = executorPlan.rows.filter((row) => row.id === "npm-cache" && row.route === "bounded-npm-cache-delete");
    const finding = (nativeScan.result?.findings || [])
      .find((row) => row.recipeId === "npm-cache" && (row.status === "measured" || row.status === "limited") && row.path);
    const npmTarget = finding
      ? {
          id: "npm-cache",
          title: finding.title || "npm package cache",
          path: finding.path,
          bytes: Number(finding.bytes || 0)
        }
      : null;

    if (!runtimeCapabilities.result.realRunEnabled || !runtimeCapabilities.result.executorFlags?.npmCacheExecutor) {
      setNativeNpmCacheExecution({
        status: "blocked",
        result: null,
        error: "npm cache executor is not enabled. Set SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR=1 before launching the Tauri app."
      });
      return;
    }
    if (!planSnapshot.id || !scanSession.currentFingerprint || !consentReceipt.planId || !npmRows.length || !npmTarget) {
      setNativeNpmCacheExecution({
        status: "blocked",
        result: null,
        error: "npm cache cleanup needs the npm-cache action selected, native npm _cacache evidence, current plan, scan fingerprint, and consent receipt."
      });
      return;
    }

    setActiveStage("execute");
    setNativeNpmCacheExecution({ status: "running", result: null, error: "" });
    try {
      const result = await runNativeNpmCacheExecutor({
        row: npmTarget,
        planId: planSnapshot.id,
        scanFingerprint: scanSession.currentFingerprint,
        consentPlanId: consentReceipt.planId,
        expectedBytes: npmTarget.bytes
      });
      setNativeNpmCacheExecution({ status: "complete", result, error: "" });
      const executedAt = new Date().toISOString();
      commitExecutionLedger(buildNativeExecutionLedger(result, executedAt), { executedAt, source: "native-npm-cache-executor" });
    } catch (error) {
      setNativeNpmCacheExecution({
        status: "error",
        result: null,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function executeUserCacheCleanup() {
    if (nativeUserCacheExecution.status === "running") return;
    if (blockExecutorForPendingProof(setNativeUserCacheExecution)) return;
    if (blockExecutorForInactiveRoute("bounded-user-cache-delete", setNativeUserCacheExecution)) return;
    const userCacheRows = executorPlan.rows.filter((row) => row.id === "user-cache" && row.route === "bounded-user-cache-delete");
    const finding = (nativeScan.result?.findings || [])
      .find((row) => row.recipeId === "user-cache" && (row.status === "measured" || row.status === "limited") && row.path);
    const userCacheTarget = finding
      ? {
          id: "user-cache",
          title: finding.title || "User .cache folder",
          path: finding.path,
          bytes: Number(finding.bytes || 0)
        }
      : null;

    if (!runtimeCapabilities.result.realRunEnabled || !runtimeCapabilities.result.executorFlags?.userCacheExecutor) {
      setNativeUserCacheExecution({
        status: "blocked",
        result: null,
        error: "User .cache executor is not enabled. Set SPACEGUARD_ENABLE_USER_CACHE_EXECUTOR=1 before launching the Tauri app."
      });
      return;
    }
    if (!planSnapshot.id || !scanSession.currentFingerprint || !consentReceipt.planId || !userCacheRows.length || !userCacheTarget) {
      setNativeUserCacheExecution({
        status: "blocked",
        result: null,
        error: "User .cache cleanup needs the user-cache action selected, native .cache evidence, current plan, scan fingerprint, and consent receipt."
      });
      return;
    }

    setActiveStage("execute");
    setNativeUserCacheExecution({ status: "running", result: null, error: "" });
    try {
      const result = await runNativeUserCacheExecutor({
        row: userCacheTarget,
        planId: planSnapshot.id,
        scanFingerprint: scanSession.currentFingerprint,
        consentPlanId: consentReceipt.planId,
        expectedBytes: userCacheTarget.bytes
      });
      setNativeUserCacheExecution({ status: "complete", result, error: "" });
      const executedAt = new Date().toISOString();
      commitExecutionLedger(buildNativeExecutionLedger(result, executedAt), { executedAt, source: "native-user-cache-executor" });
    } catch (error) {
      setNativeUserCacheExecution({
        status: "error",
        result: null,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function executeAndroidCacheCleanup() {
    if (nativeAndroidCacheExecution.status === "running") return;
    if (blockExecutorForPendingProof(setNativeAndroidCacheExecution)) return;
    if (blockExecutorForInactiveRoute("bounded-android-cache-delete", setNativeAndroidCacheExecution)) return;
    const androidRows = executorPlan.rows.filter((row) => row.id === "android-cache" && row.route === "bounded-android-cache-delete");
    const androidTargets = (nativeScan.result?.findings || [])
      .filter((row) => row.recipeId === "android-cache" && (row.status === "measured" || row.status === "limited") && row.path)
      .map((finding, index) => ({
        id: `android-cache-${index + 1}`,
        title: finding.title || "Android Studio cache folder",
        path: finding.path,
        bytes: Number(finding.bytes || 0),
        status: finding.status
      }));

    if (!runtimeCapabilities.result.realRunEnabled || !runtimeCapabilities.result.executorFlags?.androidCacheExecutor) {
      setNativeAndroidCacheExecution({
        status: "blocked",
        result: null,
        error: "Android cache executor is not enabled. Set SPACEGUARD_ENABLE_ANDROID_CACHE_EXECUTOR=1 before launching the Tauri app."
      });
      return;
    }
    if (!planSnapshot.id || !scanSession.currentFingerprint || !consentReceipt.planId || !androidRows.length || !androidTargets.length) {
      setNativeAndroidCacheExecution({
        status: "blocked",
        result: null,
        error: "Android cache cleanup needs the android-cache action selected, native Android cache evidence, current plan, scan fingerprint, and consent receipt."
      });
      return;
    }

    setActiveStage("execute");
    setNativeAndroidCacheExecution({ status: "running", result: null, error: "" });
    try {
      const result = await runNativeAndroidCacheExecutor({
        rows: androidTargets,
        planId: planSnapshot.id,
        scanFingerprint: scanSession.currentFingerprint,
        consentPlanId: consentReceipt.planId,
        expectedBytes: androidTargets.reduce((sum, target) => sum + Number(target.bytes || 0), 0)
      });
      setNativeAndroidCacheExecution({ status: "complete", result, error: "" });
      const executedAt = new Date().toISOString();
      commitExecutionLedger(buildNativeExecutionLedger(result, executedAt), { executedAt, source: "native-android-cache-executor" });
    } catch (error) {
      setNativeAndroidCacheExecution({
        status: "error",
        result: null,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function executeShaderCacheCleanup() {
    if (nativeShaderCacheExecution.status === "running") return;
    if (blockExecutorForPendingProof(setNativeShaderCacheExecution)) return;
    if (blockExecutorForInactiveRoute("launcher-cache-cleanup", setNativeShaderCacheExecution)) return;
    const shaderRows = executorPlan.rows.filter((row) => row.id === "steam-shader-cache" && row.route === "launcher-cache-cleanup");
    const shaderTargets = (nativeScan.result?.findings || [])
      .filter((row) => row.recipeId === "steam-shader-cache" && (row.status === "measured" || row.status === "limited") && row.path)
      .map((finding, index) => ({
        id: `shader-cache-${index + 1}`,
        title: finding.title || "Graphics shader cache folder",
        path: finding.path,
        bytes: Number(finding.bytes || 0),
        status: finding.status
      }));

    if (!runtimeCapabilities.result.realRunEnabled || !runtimeCapabilities.result.executorFlags?.shaderCacheExecutor) {
      setNativeShaderCacheExecution({
        status: "blocked",
        result: null,
        error: "Shader cache executor is not enabled. Set SPACEGUARD_ENABLE_SHADER_CACHE_EXECUTOR=1 before launching the Tauri app."
      });
      return;
    }
    if (!planSnapshot.id || !scanSession.currentFingerprint || !consentReceipt.planId || !shaderRows.length || !shaderTargets.length) {
      setNativeShaderCacheExecution({
        status: "blocked",
        result: null,
        error: "Shader cache cleanup needs the steam-shader-cache action selected, native shader cache evidence, current plan, scan fingerprint, and consent receipt."
      });
      return;
    }

    setActiveStage("execute");
    setNativeShaderCacheExecution({ status: "running", result: null, error: "" });
    try {
      const result = await runNativeShaderCacheExecutor({
        rows: shaderTargets,
        planId: planSnapshot.id,
        scanFingerprint: scanSession.currentFingerprint,
        consentPlanId: consentReceipt.planId,
        expectedBytes: shaderTargets.reduce((sum, target) => sum + Number(target.bytes || 0), 0)
      });
      setNativeShaderCacheExecution({ status: "complete", result, error: "" });
      const executedAt = new Date().toISOString();
      commitExecutionLedger(buildNativeExecutionLedger(result, executedAt), { executedAt, source: "native-shader-cache-executor" });
    } catch (error) {
      setNativeShaderCacheExecution({
        status: "error",
        result: null,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function executePipCacheCleanup() {
    if (nativePipCacheExecution.status === "running") return;
    if (blockExecutorForPendingProof(setNativePipCacheExecution)) return;
    if (blockExecutorForInactiveRoute("bounded-pip-cache-delete", setNativePipCacheExecution)) return;
    const pipRows = executorPlan.rows.filter((row) => row.id === "pip-cache" && row.route === "bounded-pip-cache-delete");
    const finding = (nativeScan.result?.findings || [])
      .find((row) => row.recipeId === "pip-cache" && (row.status === "measured" || row.status === "limited") && row.path);
    const pipTarget = finding
      ? {
          id: "pip-cache",
          title: finding.title || "pip package cache",
          path: finding.path,
          bytes: Number(finding.bytes || 0),
          status: finding.status
        }
      : null;

    if (!runtimeCapabilities.result.realRunEnabled || !runtimeCapabilities.result.executorFlags?.pipCacheExecutor) {
      setNativePipCacheExecution({
        status: "blocked",
        result: null,
        error: "pip cache executor is not enabled. Set SPACEGUARD_ENABLE_PIP_CACHE_EXECUTOR=1 before launching the Tauri app."
      });
      return;
    }
    if (!planSnapshot.id || !scanSession.currentFingerprint || !consentReceipt.planId || !pipRows.length || !pipTarget) {
      setNativePipCacheExecution({
        status: "blocked",
        result: null,
        error: "pip cache cleanup needs the pip-cache action selected, native pip cache evidence, current plan, scan fingerprint, and consent receipt."
      });
      return;
    }

    setActiveStage("execute");
    setNativePipCacheExecution({ status: "running", result: null, error: "" });
    try {
      const result = await runNativePipCacheExecutor({
        row: pipTarget,
        planId: planSnapshot.id,
        scanFingerprint: scanSession.currentFingerprint,
        consentPlanId: consentReceipt.planId,
        expectedBytes: pipTarget.bytes
      });
      setNativePipCacheExecution({ status: "complete", result, error: "" });
      const executedAt = new Date().toISOString();
      commitExecutionLedger(buildNativeExecutionLedger(result, executedAt), { executedAt, source: "native-pip-cache-executor" });
    } catch (error) {
      setNativePipCacheExecution({
        status: "error",
        result: null,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function executeDockerBuildCacheCleanup() {
    if (nativeDockerBuildCacheExecution.status === "running") return;
    if (blockExecutorForPendingProof(setNativeDockerBuildCacheExecution)) return;
    if (blockExecutorForInactiveRoute("tool-native-docker-build-cache-prune", setNativeDockerBuildCacheExecution)) return;
    const dockerRows = executorPlan.rows.filter((row) => row.id === "docker-build-cache" && row.route === "tool-native-docker-build-cache-prune");
    const finding = (nativeScan.result?.findings || [])
      .find((row) => row.recipeId === "docker-build-cache" && (row.status === "measured" || row.status === "limited") && row.path);
    const dockerTarget = finding
      ? {
          id: "docker-build-cache",
          title: finding.title || "Docker build cache",
          path: finding.path,
          bytes: Number(finding.bytes || 0),
          status: finding.status
        }
      : null;

    if (!runtimeCapabilities.result.realRunEnabled || !runtimeCapabilities.result.executorFlags?.toolNativePruneExecutors) {
      setNativeDockerBuildCacheExecution({
        status: "blocked",
        result: null,
        error: "Docker build-cache executor is not enabled. Set SPACEGUARD_ENABLE_TOOL_NATIVE_PRUNE_EXECUTORS=1 before launching the Tauri app."
      });
      return;
    }
    if (!planSnapshot.id || !scanSession.currentFingerprint || !consentReceipt.planId || !dockerRows.length || !dockerTarget) {
      setNativeDockerBuildCacheExecution({
        status: "blocked",
        result: null,
        error: "Docker build-cache cleanup needs the docker-build-cache action selected, Docker CLI inventory evidence, current plan, scan fingerprint, and consent receipt."
      });
      return;
    }

    setActiveStage("execute");
    setNativeDockerBuildCacheExecution({ status: "running", result: null, error: "" });
    try {
      const result = await runNativeDockerBuildCacheExecutor({
        row: dockerTarget,
        planId: planSnapshot.id,
        scanFingerprint: scanSession.currentFingerprint,
        consentPlanId: consentReceipt.planId,
        expectedBytes: dockerTarget.bytes
      });
      setNativeDockerBuildCacheExecution({ status: "complete", result, error: "" });
      const executedAt = new Date().toISOString();
      commitExecutionLedger(buildNativeExecutionLedger(result, executedAt), { executedAt, source: "native-docker-build-cache-executor" });
    } catch (error) {
      setNativeDockerBuildCacheExecution({
        status: "error",
        result: null,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function executePnpmStoreCleanup() {
    if (nativePnpmStoreExecution.status === "running") return;
    if (blockExecutorForPendingProof(setNativePnpmStoreExecution)) return;
    if (blockExecutorForInactiveRoute("bounded-pnpm-store-delete", setNativePnpmStoreExecution)) return;
    const pnpmRows = executorPlan.rows.filter((row) => row.id === "pnpm-store" && row.route === "bounded-pnpm-store-delete");
    const finding = (nativeScan.result?.findings || [])
      .find((row) => row.recipeId === "pnpm-store" && (row.status === "measured" || row.status === "limited") && row.path);
    const pnpmTarget = finding
      ? {
          id: "pnpm-store",
          title: finding.title || "pnpm global store",
          path: finding.path,
          bytes: Number(finding.bytes || 0)
        }
      : null;

    if (!runtimeCapabilities.result.realRunEnabled || !runtimeCapabilities.result.executorFlags?.pnpmStoreExecutor) {
      setNativePnpmStoreExecution({
        status: "blocked",
        result: null,
        error: "pnpm store executor is not enabled. Set SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR=1 before launching the Tauri app."
      });
      return;
    }
    if (!planSnapshot.id || !scanSession.currentFingerprint || !consentReceipt.planId || !pnpmRows.length || !pnpmTarget) {
      setNativePnpmStoreExecution({
        status: "blocked",
        result: null,
        error: "pnpm store cleanup needs the pnpm-store action selected, native pnpm store evidence, current plan, scan fingerprint, and consent receipt."
      });
      return;
    }

    setActiveStage("execute");
    setNativePnpmStoreExecution({ status: "running", result: null, error: "" });
    try {
      const result = await runNativePnpmStoreExecutor({
        row: pnpmTarget,
        planId: planSnapshot.id,
        scanFingerprint: scanSession.currentFingerprint,
        consentPlanId: consentReceipt.planId,
        expectedBytes: pnpmTarget.bytes
      });
      setNativePnpmStoreExecution({ status: "complete", result, error: "" });
      const executedAt = new Date().toISOString();
      commitExecutionLedger(buildNativeExecutionLedger(result, executedAt), { executedAt, source: "native-pnpm-store-executor" });
    } catch (error) {
      setNativePnpmStoreExecution({
        status: "error",
        result: null,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function executeRecycleBinCleanup() {
    if (nativeRecycleBinExecution.status === "running") return;
    if (blockExecutorForPendingProof(setNativeRecycleBinExecution)) return;
    if (blockExecutorForInactiveRoute("shell-recycle-bin", setNativeRecycleBinExecution)) return;
    const recycleRows = executorPlan.rows.filter((row) => row.id === "recycle-bin" && row.route === "shell-recycle-bin");
    const finding = (nativeScan.result?.findings || [])
      .find((row) => row.recipeId === "recycle-bin" && (row.status === "measured" || row.status === "limited") && row.path);
    const recycleTarget = finding
      ? {
          id: "recycle-bin",
          title: finding.title || "Recycle Bin",
          path: finding.path,
          bytes: Number(finding.bytes || 0)
        }
      : null;

    if (!runtimeCapabilities.result.realRunEnabled || !runtimeCapabilities.result.executorFlags?.recycleBinExecutor) {
      setNativeRecycleBinExecution({
        status: "blocked",
        result: null,
        error: "Recycle Bin executor is not enabled. Set SPACEGUARD_ENABLE_RECYCLE_BIN_EXECUTOR=1 before launching the Tauri app."
      });
      return;
    }
    if (!approvals.permanentConfirm) {
      setNativeRecycleBinExecution({
        status: "blocked",
        result: null,
        error: "Recycle Bin cleanup needs explicit permanent-removal confirmation before the native request can run."
      });
      return;
    }
    if (!planSnapshot.id || !scanSession.currentFingerprint || !consentReceipt.planId || !recycleRows.length || !recycleTarget) {
      setNativeRecycleBinExecution({
        status: "blocked",
        result: null,
        error: "Recycle Bin cleanup needs the recycle-bin action selected, native Recycle Bin evidence, current plan, scan fingerprint, consent receipt, and permanent confirmation."
      });
      return;
    }

    setActiveStage("execute");
    setNativeRecycleBinExecution({ status: "running", result: null, error: "" });
    try {
      const result = await runNativeRecycleBinExecutor({
        row: recycleTarget,
        planId: planSnapshot.id,
        scanFingerprint: scanSession.currentFingerprint,
        consentPlanId: consentReceipt.planId,
        permanentRemovalConfirmed: approvals.permanentConfirm,
        expectedBytes: recycleTarget.bytes
      });
      setNativeRecycleBinExecution({ status: "complete", result, error: "" });
      const executedAt = new Date().toISOString();
      commitExecutionLedger(buildNativeExecutionLedger(result, executedAt), { executedAt, source: "native-recycle-bin-executor" });
    } catch (error) {
      setNativeRecycleBinExecution({
        status: "error",
        result: null,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function executeScopedExecutorRoute(route) {
    if (route === "known-temp-delete") return executeFirstSafeTempCleanup();
    if (route === "item-review-recycle-bin") return executeReviewedDownloadsCleanup();
    if (route === "item-review-large-files") return executeLargeFileArchive();
    if (route === "item-review-project-cache") return executeReviewedProjectDependencies();
    if (route === "browser-cache-only") return executeBrowserCacheCleanup();
    if (route === "bounded-cache-delete") return executeGradleCacheCleanup();
    if (route === "bounded-user-cache-delete") return executeUserCacheCleanup();
    if (route === "bounded-android-cache-delete") return executeAndroidCacheCleanup();
    if (route === "launcher-cache-cleanup") return executeShaderCacheCleanup();
    if (route === "bounded-pip-cache-delete") return executePipCacheCleanup();
    if (route === "tool-native-docker-build-cache-prune") return executeDockerBuildCacheCleanup();
    if (route === "bounded-npm-cache-delete") return executeNpmCacheCleanup();
    if (route === "bounded-pnpm-store-delete") return executePnpmStoreCleanup();
    if (route === "shell-recycle-bin") return executeRecycleBinCleanup();
    focusWorkflowPanel("executor-smoke-run-packet-panel");
    return undefined;
  }

  async function handleScopedExecutorCommand(action = scopedExecutorCommandFlow.nextAction) {
    if (!action || action.disabled) return;
    if (action.type === "run-real-scan") {
      await runRealReadonlyScan();
      return;
    }
    if (action.type === "arm-consent") {
      armExecutionConsent();
      focusWorkflowPanel("execution-consent-panel");
      return;
    }
    if (action.type === "run-post-run-rescan") {
      await runPostRunReadonlyScan();
      return;
    }
    if (action.type === "execute-route") {
      focusWorkflowPanel(action.targetPanel);
      await executeScopedExecutorRoute(action.route);
      return;
    }
    focusWorkflowPanel(action.targetPanel || "executor-smoke-run-packet-panel");
  }

  function setValidationCheckEvidence(checkId, checked) {
    setValidationEvidence((current) => {
      const next = { ...current };
      if (checked) {
        const currentRecord = coerceValidationEvidenceFormRecord(current[checkId]);
        const now = new Date().toISOString();
        next[checkId] = {
          ...currentRecord,
          status: "passed",
          recordedAt: currentRecord.recordedAt || now,
          updatedAt: now
        };
      }
      else delete next[checkId];
      return next;
    });
  }

  function updateValidationCheckEvidence(checkId, field, value) {
    setValidationEvidence((current) => {
      const currentRecord = coerceValidationEvidenceFormRecord(current[checkId]);
      const now = new Date().toISOString();
      return {
        ...current,
        [checkId]: {
          ...currentRecord,
          [field]: value,
          status: currentRecord.status === "passed" ? "passed" : "draft",
          updatedAt: now
        }
      };
    });
  }

  function resetValidationEvidence() {
    setValidationEvidence({});
    setValidationPackImportResult(null);
  }

  function updateValidationPackImportText(value) {
    setValidationPackImportText(value);
    setValidationPackImportResult(null);
  }

  function importValidationPackEvidence() {
    const result = buildValidationPackImport({
      evidenceText: validationPackImportText,
      currentEvidence: validationEvidence
    });
    setValidationPackImportResult(result);
    if (result.canApply) {
      setValidationEvidence(result.validationEvidence);
    }
  }

  function setNativeBetaEvidenceRow(rowId, checked) {
    setNativeBetaEvidence((current) => {
      const next = { ...current };
      if (checked) {
        const currentRecord = coerceNativeBetaEvidenceFormRecord(current[rowId]);
        const now = new Date().toISOString();
        next[rowId] = {
          ...currentRecord,
          status: "passed",
          recordedAt: currentRecord.recordedAt || now,
          updatedAt: now
        };
      } else {
        const currentRecord = coerceNativeBetaEvidenceFormRecord(current[rowId]);
        const hasDetail = Boolean(currentRecord.evidencePath || currentRecord.reviewer || currentRecord.notes);
        if (hasDetail) {
          next[rowId] = {
            ...currentRecord,
            status: "draft",
            updatedAt: new Date().toISOString()
          };
        } else {
          delete next[rowId];
        }
      }
      return next;
    });
  }

  function updateNativeBetaEvidence(rowId, field, value) {
    setNativeBetaEvidence((current) => {
      const currentRecord = coerceNativeBetaEvidenceFormRecord(current[rowId]);
      return {
        ...current,
        [rowId]: {
          ...currentRecord,
          [field]: value,
          status: currentRecord.status === "passed" ? "passed" : "draft",
          updatedAt: new Date().toISOString()
        }
      };
    });
  }

  function updateNativeBetaImportText(value) {
    setNativeBetaImportText(value);
    setNativeBetaImportResult(null);
  }

  function importNativeBetaEvidenceLedger() {
    const result = buildNativeBetaEvidenceImport({
      evidenceText: nativeBetaImportText,
      currentEvidence: nativeBetaEvidence
    });
    setNativeBetaImportResult(result);
    if (result.canApply) {
      setNativeBetaEvidence(result.nativeBetaEvidence);
    }
  }

  function resetNativeBetaEvidence() {
    setNativeBetaEvidence({});
    setNativeBetaImportResult(null);
  }

  function updateLocalEvidenceBackupImportText(value) {
    setLocalEvidenceBackupImportText(value);
    setLocalEvidenceBackupImportResult(null);
  }

  function importLocalEvidenceBackup() {
    const result = buildLocalEvidenceBackupImport({
      evidenceText: localEvidenceBackupImportText,
      currentEvidence: {
        validationEvidence,
        rollbackEvidence,
        manualStrategyEvidence,
        customRootTriageEvidence,
        nativeBetaEvidence
      },
      currentRunHistory: runHistory
    });
    setLocalEvidenceBackupImportResult(result);
    if (result.canApply) {
      setValidationEvidence(result.evidence.validationEvidence);
      setRollbackEvidence(result.evidence.rollbackEvidence);
      setManualStrategyEvidence(result.evidence.manualStrategyEvidence);
      setCustomRootTriageEvidence(result.evidence.customRootTriageEvidence);
      setNativeBetaEvidence(result.evidence.nativeBetaEvidence);
      setRunHistory(result.runHistory);
      setValidationPackImportResult(null);
      setNativeBetaImportResult(null);
    }
  }

  function importFixtureEvidence() {
    const result = buildFixtureEvidenceImport({
      evidenceText: fixtureImportText,
      reviewer: fixtureImportReviewer,
      artifactId: fixtureImportArtifact,
      currentEvidence: validationEvidence
    });
    setFixtureImportResult(result);
    if (result.canApply) {
      setValidationEvidence(result.validationEvidence);
    }
  }

  function setManualStrategyCheckEvidence(checkId, checked) {
    setManualStrategyEvidence((current) => {
      const next = { ...current };
      if (checked) next[checkId] = "done";
      else delete next[checkId];
      return next;
    });
  }

  function resetManualStrategyEvidence() {
    setManualStrategyEvidence({});
  }

  function setCustomRootDisposition(rowId, disposition) {
    setCustomRootTriageEvidence((current) => {
      const currentRecord = coerceCustomRootTriageFormRecord(current[rowId]);
      const now = new Date().toISOString();
      return {
        ...current,
        [rowId]: {
          ...currentRecord,
          disposition,
          updatedAt: now
        }
      };
    });
  }

  function updateCustomRootTriageRecord(rowId, field, value) {
    setCustomRootTriageEvidence((current) => {
      const currentRecord = coerceCustomRootTriageFormRecord(current[rowId]);
      return {
        ...current,
        [rowId]: {
          ...currentRecord,
          [field]: value,
          updatedAt: new Date().toISOString()
        }
      };
    });
  }

  function resetCustomRootTriage() {
    setCustomRootTriageEvidence({});
  }

  function setRollbackProofEvidence(rowId, checked) {
    setRollbackEvidence((current) => {
      const next = { ...current };
      if (checked) {
        const currentRecord = coerceRollbackEvidenceFormRecord(current[rowId]);
        const now = new Date().toISOString();
        next[rowId] = {
          ...currentRecord,
          status: "proved",
          recordedAt: currentRecord.recordedAt || now,
          updatedAt: now
        };
      } else {
        const currentRecord = coerceRollbackEvidenceFormRecord(current[rowId]);
        const hasDetail = Boolean(currentRecord.restoreLocation || currentRecord.evidencePath || currentRecord.reviewer || currentRecord.notes);
        if (hasDetail) {
          next[rowId] = {
            ...currentRecord,
            status: "draft",
            updatedAt: new Date().toISOString()
          };
        } else {
          delete next[rowId];
        }
      }
      return next;
    });
  }

  function updateRollbackProofEvidence(rowId, field, value) {
    setRollbackEvidence((current) => {
      const currentRecord = coerceRollbackEvidenceFormRecord(current[rowId]);
      return {
        ...current,
        [rowId]: {
          ...currentRecord,
          [field]: value,
          status: currentRecord.status === "proved" ? "proved" : "draft",
          updatedAt: new Date().toISOString()
        }
      };
    });
  }

  function resetRollbackEvidence() {
    setRollbackEvidence({});
  }

  function focusWorkflowPanel(panelId) {
    if (!panelId) return;
    globalThis.document?.getElementById(panelId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function changeScenario(nextScenarioId) {
    const nextActions = buildScenarioActions(nextScenarioId);
    setScenarioId(nextScenarioId);
    setScanned(false);
    setScanning(false);
    setScanProgress(0);
    setScanLabel("Ready for demo scan");
    setNativeScan({ status: "idle", result: null, error: "" });
    setFocusedReviewId("downloads-installers");
    setActiveStage("intake");
    clearExecutionState();
    setApprovals({ groupConfirm: false, permanentConfirm: false, reviewed: {}, reviewItems: {}, typed: {} });
    setSelectedIds(new Set(nextActions.filter((action) => selectedByDefault(action, protectedPaths, intakePolicy)).map((action) => action.id)));
  }

  function addProtectedPath(path) {
    const cleanPath = path.trim();
    if (!cleanPath) return;
    const nextPaths = Array.from(new Set([...protectedPaths, cleanPath]));
    setProtectedPaths(nextPaths);
    setProtectedInput("");
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const action of actionList) {
        if (isActionProtected(action, nextPaths)) next.delete(action.id);
      }
      return next;
    });
    clearExecutionState();
  }

  function removeProtectedPath(path) {
    setProtectedPaths((current) => current.filter((item) => item !== path));
    clearExecutionState();
  }

  function setReviewItemDecision(actionId, itemId, decision) {
    setApprovals((current) => {
      const currentActionItems = current.reviewItems?.[actionId] || {};
      const nextActionItems = { ...currentActionItems };
      if (decision === "remove" || decision === "keep" || decision === "move" || decision === "archive") nextActionItems[itemId] = decision;
      else delete nextActionItems[itemId];

      return {
        ...current,
        reviewed: { ...current.reviewed, [actionId]: false },
        reviewItems: {
          ...(current.reviewItems || {}),
          [actionId]: nextActionItems
        }
      };
    });
    clearExecutionState();
  }

  function applyReviewItemDecisions(actionId, decisions) {
    setApprovals((current) => ({
      ...current,
      reviewed: { ...current.reviewed, [actionId]: false },
      reviewItems: {
        ...(current.reviewItems || {}),
        [actionId]: decisions
      }
    }));
    clearExecutionState();
  }

  function selectReviewAction(actionId) {
    const action = actionList.find((item) => item.id === actionId);
    if (action && !selectableAction(action, protectedPaths, intakePolicy)) return;
    setSelectedIds((current) => new Set([...current, actionId]));
    setFocusedReviewId(actionId);
    clearExecutionState();
  }

  function exportReport() {
    const report = buildReport({
      scenario,
      profile,
      actionList,
      selectedIds,
      readiness,
      ledger: activeLedger,
      protectedPaths,
      goalBytes: goalGb * GB,
      scanMode: dataMode,
      scanSettings,
      scanSession,
      nativeScan: nativeScan.result,
      advisor: recoveryAdvisor,
      decisionLog,
      agentQuestionQueue,
      aiAgentIntegration,
      taskRunbook,
      restrictionPolicyMatrix,
      windowsSetupAssistant,
      demoRehearsalRunbook,
      productCompletionAudit,
      realDataLaunchRoadmap,
      workflowHandoff,
      betaHandoffManifest,
      itemReview,
      executorPlan,
      releaseGate,
      validationPack,
      runtimeCapabilities: runtimeCapabilities.result,
      safetyInterlock,
      dryRunLaunchGuard,
      operatingChecklist,
      itemReviewsByAction,
      planSnapshot,
      verificationSummary,
      postRunVerification,
      rescanComparison,
      runReadiness,
      consentReceipt,
      privilegeBoundary,
      privacyBoundary,
      rollbackPlan,
      publicBetaReadiness,
      nativeBetaDistributionReadiness,
      nativeBetaEvidenceLedger,
      releaseReviewPacket,
      executorManifest,
      candidateSafetyManifest,
      toolCommandInventory,
      writeReadiness,
      realExecutorCapsule,
      firstSafeExecutorContract,
      firstSafeValidationGate,
      firstSafeImplementationWorkOrder,
      tempExecutorActivationGate,
      tempExecutorActivationRehearsal,
      writeBoundaryProbe,
      ledgerHistorySummary,
      storageStrategy,
      manualStrategyChecklist,
      customRootTriage,
      storagePressureDiagnosis,
      nativeEvidenceQuality,
      scanCoverage,
      driveInventorySummary,
      intakePolicy,
      riskBudget,
      planLock,
      userDecisionReceipt,
      taskPowerCatalog,
      taskPowerBroker,
      taskCapabilityGrants,
      taskPowerLeaseAudit
    });
    downloadTextFile("spaceguard-dry-run-report.md", report, "text/markdown;charset=utf-8");
  }

  function exportRunHistory() {
    downloadTextFile("spaceguard-run-history.md", buildLedgerHistoryMarkdown(ledgerHistorySummary), "text/markdown;charset=utf-8");
  }

  function exportLocalEvidenceBackup() {
    const exportedBackup = { ...localEvidenceBackup, generatedAt: new Date().toISOString() };
    const body = [
      buildLocalEvidenceBackupMarkdown(exportedBackup),
      "",
      "---",
      "",
      "## Structured Local Evidence Backup JSON",
      "",
      "```json",
      JSON.stringify(exportedBackup, null, 2),
      "```"
    ].join("\n");
    downloadTextFile("spaceguard-local-evidence-backup.md", body, "text/markdown;charset=utf-8");
  }

  function exportPostRunVerification() {
    downloadTextFile("spaceguard-post-run-verification.md", buildPostRunVerificationMarkdown(postRunVerification), "text/markdown;charset=utf-8");
  }

  function exportRescanComparison() {
    downloadTextFile("spaceguard-rescan-comparison.md", buildRescanComparisonMarkdown(rescanComparison), "text/markdown;charset=utf-8");
  }

  function exportInstalledAppUninstallWorkOrder() {
    const exportedOrder = { ...installedAppUninstallWorkOrder, generatedAt: new Date().toISOString() };
    const markdown = buildInstalledAppUninstallWorkOrderMarkdown(exportedOrder);
    const body = [
      markdown,
      "",
      "---",
      "",
      "## Structured App Uninstall Work Order JSON",
      "",
      "```json",
      JSON.stringify(exportedOrder, null, 2),
      "```"
    ].join("\n");
    downloadTextFile("spaceguard-app-uninstall-work-order.md", body, "text/markdown;charset=utf-8");
  }

  function exportWslCompactionWorkOrder() {
    const exportedOrder = { ...wslCompactionWorkOrder, generatedAt: new Date().toISOString() };
    const markdown = buildWslCompactionWorkOrderMarkdown(exportedOrder);
    const body = [
      markdown,
      "",
      "---",
      "",
      "## Structured WSL Compaction Work Order JSON",
      "",
      "```json",
      JSON.stringify(exportedOrder, null, 2),
      "```"
    ].join("\n");
    downloadTextFile("spaceguard-wsl-compaction-work-order.md", body, "text/markdown;charset=utf-8");
  }

  function exportValidationPack() {
    const exportedPack = { ...validationPack, generatedAt: new Date().toISOString() };
    const markdown = buildValidationPackMarkdown(exportedPack);
    const body = [
      markdown,
      "",
      "---",
      "",
      "## Structured Evidence JSON",
      "",
      "```json",
      JSON.stringify(exportedPack, null, 2),
      "```"
    ].join("\n");
    downloadTextFile("spaceguard-validation-pack.md", body, "text/markdown;charset=utf-8");
  }

  function exportExecutorSmokeRunPacket() {
    const exportedPacket = { ...executorSmokeRunPacket, generatedAt: new Date().toISOString() };
    const markdown = buildExecutorSmokeRunPacketMarkdown(exportedPacket);
    const body = [
      markdown,
      "",
      "---",
      "",
      "## Structured Smoke-Run JSON",
      "",
      "```json",
      JSON.stringify(exportedPacket, null, 2),
      "```"
    ].join("\n");
    downloadTextFile("spaceguard-executor-smoke-run-packet.md", body, "text/markdown;charset=utf-8");
  }

  function exportSupportBundle() {
    const exportedBundle = { ...supportBundle, generatedAt: new Date().toISOString() };
    const markdown = buildSupportBundleMarkdown(exportedBundle);
    const body = [
      markdown,
      "",
      "---",
      "",
      "## Redacted Support JSON",
      "",
      "```json",
      JSON.stringify(exportedBundle, null, 2),
      "```"
    ].join("\n");
    downloadTextFile("spaceguard-support-bundle.md", body, "text/markdown;charset=utf-8");
  }

  function exportWorkflowHandoff() {
    const exportedPacket = { ...workflowHandoff, generatedAt: new Date().toISOString() };
    const markdown = buildWorkflowHandoffMarkdown(exportedPacket);
    const body = [
      markdown,
      "",
      "---",
      "",
      "## Redacted Handoff JSON",
      "",
      "```json",
      JSON.stringify(exportedPacket, null, 2),
      "```"
    ].join("\n");
    downloadTextFile("spaceguard-workflow-handoff.md", body, "text/markdown;charset=utf-8");
  }

  function exportBetaHandoffManifest() {
    const exportedManifest = { ...betaHandoffManifest, generatedAt: new Date().toISOString() };
    const markdown = buildBetaHandoffManifestMarkdown(exportedManifest);
    const body = [
      markdown,
      "",
      "---",
      "",
      "## Structured Beta Handoff JSON",
      "",
      "```json",
      JSON.stringify(exportedManifest, null, 2),
      "```"
    ].join("\n");
    downloadTextFile("spaceguard-beta-handoff-manifest.md", body, "text/markdown;charset=utf-8");
  }

  function exportReleaseReviewPacket() {
    const exportedPacket = { ...releaseReviewPacket, generatedAt: new Date().toISOString() };
    const markdown = buildReleaseReviewPacketMarkdown(exportedPacket);
    const body = [
      markdown,
      "",
      "---",
      "",
      "## Structured Packet JSON",
      "",
      "```json",
      JSON.stringify(exportedPacket, null, 2),
      "```"
    ].join("\n");
    downloadTextFile("spaceguard-release-review-packet.md", body, "text/markdown;charset=utf-8");
  }

  function exportNativeBetaEvidenceLedger() {
    const exportedLedger = { ...nativeBetaEvidenceLedger, generatedAt: new Date().toISOString() };
    const body = [
      buildNativeBetaEvidenceLedgerMarkdown(exportedLedger),
      "",
      "---",
      "",
      "## Structured Native Beta Evidence JSON",
      "",
      "```json",
      JSON.stringify(exportedLedger, null, 2),
      "```"
    ].join("\n");
    downloadTextFile("spaceguard-native-beta-evidence.md", body, "text/markdown;charset=utf-8");
  }

  async function exportNativeDryRunScopeEvidence() {
    if (!runtimeCapabilities.result.simulateCleanupPlan) {
      setNativeScopeEvidenceExport({
        status: "unavailable",
        result: null,
        error: "Native dry-run scope validation is unavailable in this runtime."
      });
      return;
    }

    setNativeScopeEvidenceExport({ status: "running", result: null, error: "" });
    try {
      const scopeResult = await runNativeDryRunScopeValidation(globalThis);
      const evidence = buildNativeDryRunScopeEvidence({
        nativeExecutorDryRun: { result: scopeResult },
        planSnapshot,
        scanSession,
        exportedAt: new Date().toISOString()
      });
      downloadTextFile("spaceguard-native-dry-run-scope.json", JSON.stringify(evidence, null, 2), "application/json;charset=utf-8");
      setNativeScopeEvidenceExport({ status: "complete", result: evidence, error: "" });
    } catch (error) {
      setNativeScopeEvidenceExport({
        status: "error",
        result: null,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  function downloadTextFile(fileName, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <Sidebar
        activeStage={activeStage}
        restrictedCount={actionList.filter((action) => action.gate === "blocked").length}
        protectedCount={protectedPaths.length}
        dataMode={dataMode}
      />

      <main className="px-4 py-4 sm:px-6 lg:px-8">
        <header className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-lg border bg-card/90 p-6 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              C: recovery workflow
            </div>
            <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Space recovery with visible gates before every risky action.
            </h1>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                {profile.drive} drive
              </CardTitle>
              <CardDescription>{dataMode === "native-readonly" ? "Read-only scan profile" : scenario.label} - {formatBytes(profile.freeBytes)} free</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span>{formatBytes(profile.usedBytes)} used</span>
                <span className="font-medium">{usedPercent}% full</span>
              </div>
              <Progress value={usedPercent} indicatorClassName="bg-red-500" />
            </CardContent>
          </Card>
        </header>

        <section className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={CircleGauge} label="Drive pressure" value={`${usedPercent}%`} caption={dataMode === "native-readonly" && profile.note.includes("Drive totals") ? "Actual volume usage" : "Demo profile usage"} tone="danger" />
          <MetricCard icon={Archive} label="Visible pool" value={formatBytes(totals.visibleBytes)} caption={dataMode === "native-readonly" ? "Measured known roots" : "Before policy gates"} />
          <MetricCard icon={Lock} label="Policy locked" value={formatBytes(totals.blockedBytes)} caption="Shown, never executed" tone="warning" />
          <MetricCard icon={ClipboardList} label="Pending gates" value={String(readiness.unresolved.length)} caption="Approvals required" />
        </section>

        <section className="mb-4 grid gap-3 xl:grid-cols-[1.05fr_0.9fr_1fr_0.85fr]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <ScanLine className="h-4 w-4" />
                Scan source
              </CardTitle>
              <CardDescription>
                {dataMode === "native-readonly"
                  ? `${formatBytes(nativeScan.result.totalBytes)} measured from known roots.`
                  : "Demo profile active. Real data needs the desktop shell."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span>{scanLabel}</span>
                <span className="font-medium">{scanProgress}%</span>
              </div>
              <Progress value={scanProgress} />
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <Button className="w-full" onClick={runScan} disabled={scanning}>
                  {scanning && nativeScan.status !== "scanning" ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                  {scanning && nativeScan.status !== "scanning" ? "Scanning" : scanned && dataMode === "demo" ? "Rescan demo" : "Run demo scan"}
                </Button>
                <Button className="w-full" variant="outline" onClick={runRealReadonlyScan} disabled={scanning || !nativeCapability.available || !nativeScanRequestGuard.canScan}>
                  {nativeScan.status === "scanning" ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                  {!nativeCapability.available ? "Native app required" : !nativeScanRequestGuard.canScan ? "Fix scan settings" : "Run real scan"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Demo scenario</CardTitle>
              <CardDescription>{scenario.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2">
                {scenarios.map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    variant={scenarioId === item.id ? "default" : "outline"}
                    size="sm"
                    className="justify-start"
                    onClick={() => changeScenario(item.id)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Recovery target</CardTitle>
              <CardDescription>{goalGb} GB target, {formatBytes(totals.selectedBytes)} currently planned</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                aria-label="Target free space"
                className="w-full accent-primary"
                type="range"
                min="10"
                max="90"
                step="5"
                value={goalGb}
                onChange={(event) => {
                  setGoalGb(Number(event.target.value));
                  clearExecutionState();
                }}
              />
              <div className="grid grid-cols-3 gap-2">
                {modes.map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    variant={mode === value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setModeAndPlan(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Selected recovery</CardTitle>
              <CardDescription>{preflight.ready ? "Ready for simulated execution" : "Waiting on preflight"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-4xl font-semibold tracking-tight">{formatBytes(totals.selectedBytes)}</div>
              <Progress value={selectedPercent} indicatorClassName="bg-blue-600" />
              <p className="text-sm text-muted-foreground">
                {preflight.ready ? "All selected actions are approved and scan state is valid." : `${preflight.items.filter((item) => !item.passed).length} preflight check(s) remain.`}
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="space-y-3">
            <NativeScannerPanel capability={nativeCapability} nativeScan={nativeScan} />

            <WindowsSetupAssistantPanel assistant={windowsSetupAssistant} />

            <RealDataLaunchRoadmapPanel roadmap={realDataLaunchRoadmap} />

            <ScopedExecutorCommandFlowPanel
              flow={scopedExecutorCommandFlow}
              agent={{
                configured: openAiConfig.configured || openAiAgentContext.runtime.openAiAdvisorConfigured,
                keySource: openAiAgentContext.runtime.openAiAdvisorConfigured ? openAiAgentContext.runtime.openAiKeySource : openAiConfig.keySource,
                model: openAiConfig.model,
                running: aiAdvice.status === "running",
                error: aiAdvice.error,
                result: aiAdvice.result?.advice || null,
                broker: openAiRecommendationBroker,
                runHistory: openAiAgentRunHistory
              }}
              onAction={handleScopedExecutorCommand}
              onSelectRoute={selectScopedExecutorRoute}
              onAskAgent={askOpenAIAgent}
              onAgentAction={handleOpenAIAgentRecommendation}
              onExportSmokePacket={exportExecutorSmokeRunPacket}
            />

            <NativeBetaDistributionPanel
              readiness={nativeBetaDistributionReadiness}
              evidence={nativeBetaEvidence}
              importText={nativeBetaImportText}
              importResult={nativeBetaImportResult}
              onToggleEvidence={setNativeBetaEvidenceRow}
              onUpdateEvidence={updateNativeBetaEvidence}
              onImportText={updateNativeBetaImportText}
              onImportEvidence={importNativeBetaEvidenceLedger}
              onResetEvidence={resetNativeBetaEvidence}
              onExportEvidence={exportNativeBetaEvidenceLedger}
            />

            <DemoRehearsalRunbookPanel runbook={demoRehearsalRunbook} onExport={exportReport} />

            <ProductCompletionAuditPanel audit={productCompletionAudit} />

            <SafetyInterlockPanel interlock={safetyInterlock} />

            <OperatingChecklistPanel
              checklist={operatingChecklist}
              onRunScan={runScan}
              onRunRealScan={runRealReadonlyScan}
              onSuggestPlan={suggestPlan}
              onApproveRebuildable={approveRebuildableCaches}
              onConfirmPermanentRemoval={confirmPermanentRemoval}
              onAllowAdminRoutes={() => setAdminAllowance(true)}
              onFocusReview={setFocusedReviewId}
              onFocusPanel={focusWorkflowPanel}
              onSelectAction={selectActionById}
              onArmConsent={armExecutionConsent}
              onSimulate={simulateCleanup}
              onProbeWriteBoundary={probeNativeWriteBoundary}
            />

            <WorkflowHandoffPanel handoff={workflowHandoff} onExport={exportWorkflowHandoff} />

            <BetaHandoffManifestPanel manifest={betaHandoffManifest} onExport={exportBetaHandoffManifest} />

            <LocalEvidenceBackupPanel
              backup={localEvidenceBackup}
              importText={localEvidenceBackupImportText}
              importResult={localEvidenceBackupImportResult}
              onImportText={updateLocalEvidenceBackupImportText}
              onImport={importLocalEvidenceBackup}
              onExport={exportLocalEvidenceBackup}
            />

            <ScanSessionPanel session={scanSession} />

            <PlanLockPanel planLock={planLock} />

            <IntakePolicyPanel
              policy={intakePolicy}
              adminAllowed={adminActionsAllowed}
              onAdminAllowed={setAdminAllowance}
            />

            <TaskPowerPanel catalog={taskPowerCatalog} />

            <TaskPowerBrokerPanel broker={taskPowerBroker} />

            <TaskPowerLeaseAuditPanel audit={taskPowerLeaseAudit} />

            <TaskCapabilityGrantPanel grants={taskCapabilityGrants} />

            <TaskRunbookPanel runbook={taskRunbook} />

            <RestrictionPolicyMatrixPanel matrix={restrictionPolicyMatrix} />

            <NativeScanSettingsPanel
              settings={scanSettings}
              customRootInput={customRootInput}
              onCustomRootInput={setCustomRootInput}
              onAddCustomRoot={addCustomScanRoot}
              onRemoveCustomRoot={removeCustomScanRoot}
              onChange={updateScanSetting}
              nativeScan={nativeScan}
              requestGuard={nativeScanRequestGuard}
            />

            <DriveInventoryPanel inventory={driveInventorySummary} />

            <StoragePressureDiagnosisPanel diagnosis={storagePressureDiagnosis} />

            <NativeEvidenceQualityPanel quality={nativeEvidenceQuality} />

            <ScanCoveragePanel coverage={scanCoverage} />

            <CustomRootTriagePanel
              triage={customRootTriage}
              onDisposition={setCustomRootDisposition}
              onUpdate={updateCustomRootTriageRecord}
              onReset={resetCustomRootTriage}
            />

            <RecoveryAdvisorPanel advisor={recoveryAdvisor} onSuggest={suggestPlan} />

            <AgentQuestionPanel
              queue={agentQuestionQueue}
              nativeCapability={nativeCapability}
              onRunScan={runScan}
              onRunRealScan={runRealReadonlyScan}
              onSuggestPlan={suggestPlan}
              onApproveRebuildable={approveRebuildableCaches}
              onConfirmPermanentRemoval={confirmPermanentRemoval}
              onAllowAdminRoutes={() => setAdminAllowance(true)}
              onFocusReview={setFocusedReviewId}
              onFocusPanel={focusWorkflowPanel}
              onSelectAction={selectActionById}
              onArmConsent={armExecutionConsent}
              onSimulate={simulateCleanup}
              onProbeWriteBoundary={probeNativeWriteBoundary}
            />

            <OpenAIAgentPanel
              integration={aiAgentIntegration}
              config={openAiConfig}
              prompt={aiPrompt}
              advice={aiAdvice}
              context={openAiAgentContext}
              recommendationBroker={openAiRecommendationBroker}
              runHistory={openAiAgentRunHistory}
              onPrompt={setAiPrompt}
              onAsk={askOpenAIAgent}
              onAction={handleOpenAIAgentRecommendation}
            />

            <StorageStrategyPanel strategy={storageStrategy} />

            <ManualStrategyChecklistPanel
              checklist={manualStrategyChecklist}
              onToggle={setManualStrategyCheckEvidence}
              onReset={resetManualStrategyEvidence}
            />

            <ProtectedPathsPanel
              protectedPaths={protectedPaths}
              protectedInput={protectedInput}
              setProtectedInput={setProtectedInput}
              addProtectedPath={addProtectedPath}
              removeProtectedPath={removeProtectedPath}
            />

            <Card id="cleanup-actions-panel">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>Scan surface</CardTitle>
                    <CardDescription>Grouped by source. Blue overlay means selected.</CardDescription>
                  </div>
                  <Button variant="secondary" size="sm" onClick={suggestPlan}>
                    <Sparkles className="h-4 w-4" />
                    Suggest plan
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <FamilyMap families={families} />
              </CardContent>
            </Card>

            <ReviewWorkbenchPanel workbench={reviewWorkbench} focusedId={focusedReviewId} onFocus={setFocusedReviewId} />

            <ItemReviewPanel
              itemReview={itemReview}
              selected={Boolean(itemReview.action && selectedIds.has(itemReview.action.id))}
              onSelectAction={selectReviewAction}
              onDecision={setReviewItemDecision}
              onApplyDecisions={applyReviewItemDecisions}
            />

            <InstalledAppReviewDossierPanel
              dossier={installedAppReviewDossier}
              onFocusReview={() => setFocusedReviewId("installed-app-footprints")}
            />

            <InstalledAppUninstallWorkOrderPanel
              workOrder={installedAppUninstallWorkOrder}
              onFocusReview={() => setFocusedReviewId("installed-app-footprints")}
              onExport={exportInstalledAppUninstallWorkOrder}
              onRescan={nativeCapability.available ? runRealReadonlyScan : runScan}
            />

            <WslCompactionWorkOrderPanel
              workOrder={wslCompactionWorkOrder}
              onFocusGate={() => focusWorkflowPanel("gate-panel")}
              onExport={exportWslCompactionWorkOrder}
              onRescan={nativeCapability.available ? runRealReadonlyScan : runScan}
            />

            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle>Cleanup actions</CardTitle>
                    <CardDescription>Every action shows risk, gate, consequence, and method.</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {filters.map((item) => (
                      <Button
                        key={item}
                        variant={filter === item ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilter(item)}
                        className="capitalize"
                      >
                        {item}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {filteredActions.map((action) => (
                  <ActionRow
                    key={action.id}
                    action={action}
                    scanned={scanned}
                    selected={selectedIds.has(action.id)}
                    protectedByUser={isActionProtected(action, protectedPaths)}
                    intakePolicy={intakePolicy}
                    onToggle={() => toggleAction(action)}
                    onProtect={() => addProtectedPath(action.path)}
                  />
                ))}
              </CardContent>
            </Card>
          </div>

          <aside className="console-scroll space-y-3 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-auto">
            <PlanReviewPanel review={planReview} />
            <DecisionLogPanel entries={decisionLog} />
            <UserDecisionReceiptPanel receipt={userDecisionReceipt} />
            <GatePanel
              actionList={actionList}
              selectedIds={selectedIds}
              approvals={approvals}
              setApprovals={setApprovals}
              scanned={scanned}
              readiness={readiness}
              protectedPaths={protectedPaths}
              itemReviewsByAction={itemReviewsByAction}
              intakePolicy={intakePolicy}
            />
            <RiskBudgetPanel riskBudget={riskBudget} />
            <TracePanel activeStage={activeStage} />
            <ExecutorPolicyPanel
              executorPlan={executorPlan}
              executorReadiness={executorReadiness}
              nativeExecutorDryRun={nativeExecutorDryRun}
              scopeEvidenceExport={nativeScopeEvidenceExport}
              canExportScopeEvidence={runtimeCapabilities.result.simulateCleanupPlan}
              onExportScopeEvidence={exportNativeDryRunScopeEvidence}
            />
            <CandidateSafetyManifestPanel manifest={candidateSafetyManifest} />
            <ExecutorManifestPanel manifest={executorManifest} />
            <ExecutorSmokeRunPacketPanel packet={executorSmokeRunPacket} onExport={exportExecutorSmokeRunPacket} />
            <ToolCommandInventoryPanel inventory={toolCommandInventory} />
            <VerificationPanel planSnapshot={planSnapshot} verificationSummary={verificationSummary} />
            <PostRunVerificationPanel verification={postRunVerification} scanning={scanning} nativeCapability={nativeCapability} onRescan={runPostRunReadonlyScan} onExport={exportPostRunVerification} />
            <RescanComparisonPanel comparison={rescanComparison} scanning={scanning} nativeCapability={nativeCapability} onRescan={runPostRunReadonlyScan} onExport={exportRescanComparison} />
            <RollbackPlanPanel
              plan={rollbackPlan}
              rollbackEvidence={rollbackEvidence}
              onToggleProof={setRollbackProofEvidence}
              onUpdateProof={updateRollbackProofEvidence}
              onResetProof={resetRollbackEvidence}
            />
            <PrivilegeBoundaryPanel boundary={privilegeBoundary} />
            <PrivacyBoundaryPanel boundary={privacyBoundary} />
            <PublicBetaReadinessPanel readiness={publicBetaReadiness} />
            <SupportBundlePanel bundle={supportBundle} onExport={exportSupportBundle} />
            <ReleaseReviewPacketPanel packet={releaseReviewPacket} onExport={exportReleaseReviewPacket} />
            <ReleaseGatePanel releaseGate={releaseGate} runtimeCapabilities={runtimeCapabilities} />
            <WriteReadinessPanel readiness={writeReadiness} />
            <RealExecutorCapsulePanel capsule={realExecutorCapsule} />
            <FirstSafeExecutorContractPanel contract={firstSafeExecutorContract} />
            <FirstSafeValidationGatePanel gate={firstSafeValidationGate} />
            <FirstSafeImplementationWorkOrderPanel workOrder={firstSafeImplementationWorkOrder} />
            <TempExecutorActivationGatePanel gate={tempExecutorActivationGate} />
            <TempExecutorActivationRehearsalPanel rehearsal={tempExecutorActivationRehearsal} />
            <WriteBoundaryProbePanel
              probe={writeBoundaryProbe}
              nativeWriteBoundary={nativeWriteBoundary}
              runtimeCapabilities={runtimeCapabilities}
              onProbe={probeNativeWriteBoundary}
            />
            <FirstSafeTempExecutorPanel
              runtimeCapabilities={runtimeCapabilities}
              execution={nativeRealExecution}
              contract={firstSafeExecutorContract}
              capsule={realExecutorCapsule}
              onExecute={executeFirstSafeTempCleanup}
            />
            <RecycleBinExecutorPanel
              runtimeCapabilities={runtimeCapabilities}
              execution={nativeRecycleBinExecution}
              executorPlan={executorPlan}
              nativeScan={nativeScan}
              scanSession={scanSession}
              consentReceipt={consentReceipt}
              permanentConfirmed={Boolean(approvals.permanentConfirm)}
              onExecute={executeRecycleBinCleanup}
            />
            <GradleCacheExecutorPanel
              runtimeCapabilities={runtimeCapabilities}
              execution={nativeGradleCacheExecution}
              executorPlan={executorPlan}
              nativeScan={nativeScan}
              scanSession={scanSession}
              consentReceipt={consentReceipt}
              onExecute={executeGradleCacheCleanup}
            />
            <UserCacheExecutorPanel
              runtimeCapabilities={runtimeCapabilities}
              execution={nativeUserCacheExecution}
              executorPlan={executorPlan}
              nativeScan={nativeScan}
              scanSession={scanSession}
              consentReceipt={consentReceipt}
              onExecute={executeUserCacheCleanup}
            />
            <AndroidCacheExecutorPanel
              runtimeCapabilities={runtimeCapabilities}
              execution={nativeAndroidCacheExecution}
              executorPlan={executorPlan}
              nativeScan={nativeScan}
              scanSession={scanSession}
              consentReceipt={consentReceipt}
              onExecute={executeAndroidCacheCleanup}
            />
            <ShaderCacheExecutorPanel
              runtimeCapabilities={runtimeCapabilities}
              execution={nativeShaderCacheExecution}
              executorPlan={executorPlan}
              nativeScan={nativeScan}
              scanSession={scanSession}
              consentReceipt={consentReceipt}
              onExecute={executeShaderCacheCleanup}
            />
            <PipCacheExecutorPanel
              runtimeCapabilities={runtimeCapabilities}
              execution={nativePipCacheExecution}
              executorPlan={executorPlan}
              nativeScan={nativeScan}
              scanSession={scanSession}
              consentReceipt={consentReceipt}
              onExecute={executePipCacheCleanup}
            />
            <DockerBuildCacheExecutorPanel
              runtimeCapabilities={runtimeCapabilities}
              execution={nativeDockerBuildCacheExecution}
              executorPlan={executorPlan}
              nativeScan={nativeScan}
              scanSession={scanSession}
              consentReceipt={consentReceipt}
              onExecute={executeDockerBuildCacheCleanup}
            />
            <NpmCacheExecutorPanel
              runtimeCapabilities={runtimeCapabilities}
              execution={nativeNpmCacheExecution}
              executorPlan={executorPlan}
              nativeScan={nativeScan}
              scanSession={scanSession}
              consentReceipt={consentReceipt}
              onExecute={executeNpmCacheCleanup}
            />
            <PnpmStoreExecutorPanel
              runtimeCapabilities={runtimeCapabilities}
              execution={nativePnpmStoreExecution}
              executorPlan={executorPlan}
              nativeScan={nativeScan}
              scanSession={scanSession}
              consentReceipt={consentReceipt}
              onExecute={executePnpmStoreCleanup}
            />
            <DownloadsCleanupExecutorPanel
              runtimeCapabilities={runtimeCapabilities}
              execution={nativeDownloadsExecution}
              executorPlan={executorPlan}
              scanSession={scanSession}
              consentReceipt={consentReceipt}
              onExecute={executeReviewedDownloadsCleanup}
            />
            <LargeFileArchiveExecutorPanel
              runtimeCapabilities={runtimeCapabilities}
              execution={nativeLargeFileArchiveExecution}
              executorPlan={executorPlan}
              scanSession={scanSession}
              consentReceipt={consentReceipt}
              archiveDestination={largeFileArchiveDestination}
              onArchiveDestination={setLargeFileArchiveDestination}
              onExecute={executeLargeFileArchive}
            />
            <ProjectDependencyExecutorPanel
              runtimeCapabilities={runtimeCapabilities}
              execution={nativeProjectDependencyExecution}
              executorPlan={executorPlan}
              scanSession={scanSession}
              consentReceipt={consentReceipt}
              onExecute={executeReviewedProjectDependencies}
            />
            <BrowserCacheExecutorPanel
              runtimeCapabilities={runtimeCapabilities}
              execution={nativeBrowserCacheExecution}
              executorPlan={executorPlan}
              nativeScan={nativeScan}
              scanSession={scanSession}
              consentReceipt={consentReceipt}
              onExecute={executeBrowserCacheCleanup}
            />
            <ExecutionProofHandoffPanel handoff={executionProofHandoff} onRescan={runPostRunReadonlyScan} />
            <ValidationEvidencePanel
              validationPack={validationPack}
              fixtureImportText={fixtureImportText}
              fixtureImportReviewer={fixtureImportReviewer}
              fixtureImportArtifact={fixtureImportArtifact}
              fixtureImportResult={fixtureImportResult}
              validationPackImportText={validationPackImportText}
              validationPackImportResult={validationPackImportResult}
              onFixtureImportText={setFixtureImportText}
              onFixtureImportReviewer={setFixtureImportReviewer}
              onFixtureImportArtifact={setFixtureImportArtifact}
              onImportFixtureEvidence={importFixtureEvidence}
              onValidationPackImportText={updateValidationPackImportText}
              onImportValidationPack={importValidationPackEvidence}
              onToggleEvidence={setValidationCheckEvidence}
              onUpdateEvidence={updateValidationCheckEvidence}
              onReset={resetValidationEvidence}
              onExport={exportValidationPack}
            />
            <ExecutionConsentPanel consentReceipt={consentReceipt} runReadiness={runReadiness} safetyInterlock={safetyInterlock} onArm={armExecutionConsent} />
            <LedgerPanel ledger={activeLedger} selectedBytes={totals.selectedBytes} preflight={preflight} runReadiness={runReadiness} consentReceipt={consentReceipt} dryRunLaunchGuard={dryRunLaunchGuard} onExecute={simulateCleanup} onExport={exportReport} />
            <RunHistoryPanel historySummary={ledgerHistorySummary} onExport={exportRunHistory} />
          </aside>
        </section>
      </main>
    </div>
  );
}

function Sidebar({ activeStage, restrictedCount, protectedCount, dataMode }) {
  return (
    <aside className="rail-scroll border-r bg-zinc-950 text-zinc-50 lg:sticky lg:top-0 lg:h-screen lg:overflow-auto">
      <div className="flex h-full flex-col gap-5 p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-zinc-50 text-sm font-bold text-zinc-950">SG</div>
          <div>
            <div className="font-semibold">SpaceGuard</div>
            <div className="text-sm text-zinc-400">Dry-run agent</div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 text-sm">
          <PolicyLine label="Data" value={dataMode === "native-readonly" ? "Real scan" : "Demo"} />
          <PolicyLine label="Writes" value="Blocked" />
          <PolicyLine label="Restricted" value={`${restrictedCount} zones`} />
          <PolicyLine label="Protected" value={`${protectedCount} paths`} />
        </div>

        <nav className="grid gap-1">
          {agentStages.map((stage, index) => {
            const active = stage.id === activeStage;
            return (
              <div
                key={stage.id}
                className={`grid grid-cols-[24px_1fr] items-center gap-2 rounded-md border px-2 py-2 text-sm ${
                  active ? "border-zinc-600 bg-zinc-800 text-white" : "border-transparent text-zinc-400"
                }`}
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-zinc-800 text-xs">{index + 1}</span>
                <span>{stage.label}</span>
              </div>
            );
          })}
        </nav>

        <div className="mt-auto flex items-center gap-2 text-sm text-zinc-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          {dataMode === "native-readonly" ? "Read-only native data" : "Demo data only"}
        </div>
      </div>
    </aside>
  );
}

function PolicyLine({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium text-zinc-100">{value}</span>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, caption, tone }) {
  const toneClass = tone === "danger" ? "text-red-600" : tone === "warning" ? "text-amber-700" : "text-blue-600";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${toneClass}`} />
        </div>
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
        <p className="mt-1 text-sm text-muted-foreground">{caption}</p>
      </CardContent>
    </Card>
  );
}

function FamilyMap({ families }) {
  const maxBytes = Math.max(...families.map((family) => family.bytes), 1);
  return (
    <div className="grid gap-3">
      {families.map((family) => {
        const totalWidth = Math.max(4, Math.round((family.bytes / maxBytes) * 100));
        const selectedWidth = family.bytes > 0 ? Math.round((family.selectedBytes / family.bytes) * 100) : 0;
        return (
          <div key={family.family} className="grid gap-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{family.family}</span>
              <span className="text-muted-foreground">{formatBytes(family.bytes)}</span>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
              <span className={`absolute inset-y-0 left-0 rounded-full ${riskAccent[family.risk]} opacity-30`} style={{ width: `${totalWidth}%` }} />
              <span className="absolute inset-y-0 left-0 rounded-full bg-blue-600" style={{ width: `${selectedWidth}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NativeScannerPanel({ capability, nativeScan }) {
  const result = nativeScan.result;
  const findings = result?.findings || [];
  const topFindings = findings
    .filter((finding) => finding.status === "measured" || finding.status === "limited")
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 5);
  const statusLabel =
    nativeScan.status === "complete"
      ? "Measured"
      : nativeScan.status === "scanning"
        ? "Scanning"
        : capability.available
          ? "Ready"
          : "Demo only";

  return (
    <Card id="real-data-readiness-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Real data readiness
            </CardTitle>
            <CardDescription>{capability.detail}</CardDescription>
          </div>
          <Badge variant={capability.available ? "safe" : "review"}>{statusLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-3">
          <ReadinessPill icon={Database} label="Native bridge" value={capability.available ? "detected" : "missing"} passed={capability.available} />
          <ReadinessPill icon={Eye} label="Scanner" value="read-only" passed />
          <ReadinessPill icon={Lock} label="Write commands" value="disabled" passed={!result?.writeCapability && !result?.destructiveCommands} />
        </div>

        {nativeScan.error ? (
          <div className="rounded-md border bg-amber-50 p-3 text-sm text-amber-900">{nativeScan.error}</div>
        ) : null}

        {result ? (
          <div className="space-y-2">
            {result.volume ? (
              <div className="rounded-md border bg-card p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{result.volume.drive} volume</span>
                  <Badge variant="safe">drive evidence</Badge>
                </div>
                <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                  <span>Total: {formatBytes(result.volume.totalBytes)}</span>
                  <span>Used: {formatBytes(result.volume.usedBytes)}</span>
                  <span>Free: {formatBytes(result.volume.freeBytes)}</span>
                </div>
              </div>
            ) : (
              <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">Drive volume totals are not available from this native scan yet.</div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Measured roots</span>
              <span className="text-muted-foreground">{formatBytes(result.totalBytes)}</span>
            </div>
            {topFindings.length ? (
              topFindings.map((finding) => (
                <div key={`${finding.recipeId}-${finding.path}`} className="grid gap-1 rounded-md border bg-muted/30 p-3 text-sm md:grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{finding.title}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground">{finding.path}</div>
                  </div>
                  <div className="font-medium">{formatBytes(finding.bytes)}</div>
                </div>
              ))
            ) : (
              <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">No known cleanup roots were measurable in this scan.</div>
            )}
            {result.warnings.length ? <div className="text-xs text-muted-foreground">{result.warnings.slice(0, 2).join(" ")}</div> : null}
          </div>
        ) : (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            The browser demo cannot inspect local folders. Start the desktop shell to populate this panel with real path sizes.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WindowsSetupAssistantPanel({ assistant }) {
  return (
    <Card id="windows-setup-assistant-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Windows setup assistant
            </CardTitle>
            <CardDescription>{assistant.primary}</CardDescription>
          </div>
          <Badge variant={assistant.tone}>{assistant.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Native" value={assistant.nativeAvailable ? "yes" : "no"} tone={assistant.nativeAvailable ? "safe" : "review"} />
          <QueueStat label="Scan" value={assistant.nativeScanCurrent ? "current" : "needed"} tone={assistant.nativeScanCurrent ? "safe" : "review"} />
          <QueueStat label="Privacy" value={assistant.privacyReady ? "ready" : "wait"} tone={assistant.privacyReady ? "safe" : "review"} />
          <QueueStat label="Writes" value={assistant.realCleanupEnabled ? "on" : "locked"} tone={assistant.realCleanupEnabled ? "restricted" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Setup boundary</span>
            <Badge variant={assistant.destructiveCommands ? "restricted" : "safe"}>
              {assistant.destructiveCommands ? "destructive visible" : "no destructive commands"}
            </Badge>
            <Badge variant={assistant.nativeBetaReady ? "safe" : "outline"}>
              {assistant.nativeBetaReady ? "native beta evidence" : "setup evidence waiting"}
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            {assistant.steps.slice(0, 3).map((step) => (
              <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {assistant.rows.map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3">
              <div className="flex items-center gap-2">
                <div className="mr-auto text-sm font-medium">{row.label}</div>
                <Badge variant={row.tone}>{row.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
              <p className="mt-2 text-xs text-muted-foreground">{row.action}</p>
            </div>
          ))}
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 text-sm font-medium">Safe setup commands</div>
          <div className="flex flex-col gap-2">
            {assistant.commands.map((command) => (
              <div key={command.id} className="grid gap-1 rounded-md border bg-card p-2 text-xs sm:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <div className="truncate font-mono">{command.command}</div>
                  <div className="text-muted-foreground">{command.detail}</div>
                </div>
                <Badge variant={command.destructive ? "restricted" : command.status === "available" || command.status === "detected" ? "safe" : "review"}>
                  {command.destructive ? "destructive" : command.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RealDataLaunchRoadmapPanel({ roadmap }) {
  const activeRows = roadmap.rows.filter((row) => row.status !== "ready").slice(0, 4);
  const phaseLabel = roadmap.currentMilestone.split(" ")[0] || "Open";
  const estimateLabel = roadmap.estimate
    .replace("ready now", "now")
    .replace("same day", "today")
    .replace(" weeks", "wk")
    .replace(" week", "wk")
    .replace(" days", "d")
    .split(" after ")[0];

  return (
    <Card id="real-data-launch-roadmap-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CircleGauge className="h-4 w-4" />
              Real data launch roadmap
            </CardTitle>
            <CardDescription>{roadmap.primary}</CardDescription>
          </div>
          <Badge variant={roadmap.tone}>{roadmap.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <QueueStat label="Phase" value={phaseLabel} tone={roadmap.tone} />
          <QueueStat label="Estimate" value={estimateLabel} tone={roadmap.confidence === "high" ? "safe" : "review"} />
          <QueueStat label="Progress" value={`${roadmap.progress}%`} tone={roadmap.progress >= 70 ? "safe" : "review"} />
          <QueueStat label="Real cleanup" value={roadmap.scopedRealCleanupAvailable ? "scoped" : roadmap.realCleanupLocked ? "locked" : "ready"} tone={roadmap.scopedRealCleanupAvailable || !roadmap.realCleanupLocked ? "safe" : "restricted"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 text-sm font-medium">{roadmap.currentMilestone}</div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium">Launch confidence</div>
            <div className="flex flex-wrap gap-1">
              <Badge variant={roadmap.nativeScanCurrent ? "safe" : "outline"}>
                {roadmap.nativeScanCurrent ? "native scan current" : "native scan needed"}
              </Badge>
              <Badge variant={roadmap.activationRehearsed ? "safe" : "outline"}>
                {roadmap.activationRehearsed ? "activation rehearsed" : "activation waiting"}
              </Badge>
              <Badge variant={roadmap.nativePreflightReady ? "safe" : "outline"}>
                {roadmap.nativePreflightReady ? "native preflight ready" : "native preflight missing"}
              </Badge>
            </div>
          </div>
          <Progress value={roadmap.progress} indicatorClassName={roadmap.realCleanupReady ? "bg-emerald-600" : "bg-blue-600"} />
          <div className="mt-2 text-xs text-muted-foreground">
            Confidence: {roadmap.confidence}. Estimates are planning ranges and do not unlock real cleanup.
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {roadmap.milestones.map((milestone) => (
            <div key={milestone.id} className="rounded-md border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 text-sm font-medium">{milestone.label}</div>
                <Badge variant={milestone.tone}>{milestone.status}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge variant="outline">{milestone.estimate}</Badge>
                <Badge variant="outline">{milestone.confidence}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{milestone.detail}</p>
            </div>
          ))}
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 text-sm font-medium">Next evidence rows</div>
          <div className="flex flex-col gap-2">
            {(activeRows.length ? activeRows : roadmap.rows.slice(0, 4)).map((row) => (
              <div key={row.id} className="rounded-md border bg-card p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 text-sm font-medium">{row.label}</div>
                  <Badge variant={row.tone}>{row.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{row.nextStep}</p>
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-[1fr_auto]">
                  <span>{row.evidence}</span>
                  <span>{row.estimate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScopedExecutorCommandFlowPanel({ flow, agent = {}, onAction, onSelectRoute, onAskAgent, onAgentAction, onExportSmokePacket }) {
  const next = flow.nextAction || {};
  const routeOptions = flow.routeOptions || [];
  const result = agent.result || null;
  const brokerRows = agent.broker?.rows || [];
  const brokerByKey = new Map(brokerRows.map((row) => [row.key, row]));
  const recommendedRows = (result?.recommendedActions || []).slice(0, 3);
  const hasAgentAdvice = Boolean(result);

  return (
    <Card id="scoped-executor-command-flow-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Real cleanup command flow
            </CardTitle>
            <CardDescription>{flow.primary}</CardDescription>
          </div>
          <Badge variant={flow.tone}>{flow.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <QueueStat label="Route" value={flow.route ? flow.route.split("-")[0] : "none"} tone={flow.route ? "review" : "restricted"} />
          <QueueStat label="Progress" value={`${flow.progress}%`} tone={flow.progress >= 60 ? "safe" : "review"} />
          <QueueStat label="Complete" value={`${flow.counts.complete}/${flow.counts.total}`} tone={flow.counts.complete === flow.counts.total ? "safe" : "review"} />
          <QueueStat label="Blocked" value={flow.counts.blocked} tone={flow.counts.blocked ? "restricted" : "safe"} />
          <QueueStat label="OpenAI" value={agent.configured ? "ready" : "set .env"} tone={agent.configured ? "safe" : "review"} />
          <QueueStat label="AI ready" value={agent.broker?.counts?.ready || 0} tone={agent.broker?.counts?.ready ? "safe" : "review"} />
          <QueueStat label="AI blocked" value={agent.broker?.counts?.blocked || 0} tone={agent.broker?.counts?.blocked ? "restricted" : "safe"} />
          <QueueStat label="AI runs" value={agent.runHistory?.length || 0} tone={agent.runHistory?.length ? "safe" : "review"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Choose scoped route</span>
            <Badge variant={routeOptions.length ? "review" : "restricted"}>{routeOptions.length} route(s)</Badge>
            <Badge variant="safe">one route at a time</Badge>
          </div>
          {routeOptions.length ? (
            <div className="grid gap-2 md:grid-cols-3">
              {routeOptions.map((row) => (
                <button
                  key={row.id || row.route}
                  type="button"
                  className={`rounded-md border p-3 text-left transition hover:bg-muted/40 ${row.selected ? "bg-primary text-primary-foreground" : "bg-card"}`}
                  onClick={() => onSelectRoute?.(row.route)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-auto text-sm font-medium">{row.title}</span>
                    <Badge variant={row.selected ? "secondary" : row.tone}>{row.status}</Badge>
                  </div>
                  <div className={`mt-2 flex flex-wrap gap-1 text-xs ${row.selected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {row.envVar ? <span>{row.envVar}</span> : null}
                    {row.requestMode ? <span>{row.requestMode}</span> : null}
                    <span>{row.flagEnabled ? "flag on" : "flag off"}</span>
                  </div>
                  {row.blockedReason ? <p className={`mt-2 text-xs ${row.selected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{row.blockedReason}</p> : null}
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-md border bg-card p-3 text-sm text-muted-foreground">Select cleanup actions to create scoped executor routes.</div>
          )}
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{flow.title}</span>
            {flow.primaryRow?.envVar ? <Badge variant={flow.primaryRow.flagEnabled ? "safe" : "review"}>{flow.primaryRow.envVar}</Badge> : null}
            {flow.primaryRow?.requestMode ? <Badge variant="outline">{flow.primaryRow.requestMode}</Badge> : null}
          </div>
          <Progress value={flow.progress} indicatorClassName={flow.status === "ready-to-execute" ? "bg-emerald-600" : "bg-blue-600"} />
          {flow.primaryRow?.blockedReason ? <p className="mt-2 text-xs text-muted-foreground">{flow.primaryRow.blockedReason}</p> : null}
        </div>

        <div className="grid gap-2 md:grid-cols-4">
          {flow.steps.map((step) => {
            const stepDisabled = step.id === "execute" && step.status !== "active";
            return (
              <button
                key={step.id}
                type="button"
                className={`rounded-md border bg-card p-3 text-left transition hover:bg-muted/40 ${stepDisabled ? "opacity-60" : ""}`}
                disabled={stepDisabled}
                onClick={() => onAction({ type: step.actionType, targetPanel: step.targetPanel, route: step.route })}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{step.label}</span>
                  <Badge variant={step.tone}>{step.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{step.detail}</p>
              </button>
            );
          })}
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">AI recommendation path</span>
            <Badge variant={agent.configured ? "safe" : "review"}>{agent.configured ? agent.model : "OPENAI_API_KEY missing"}</Badge>
            <Badge variant="safe">direct tools blocked</Badge>
            <Badge variant={agent.broker?.tone || "review"}>{agent.broker?.status || "broker-idle"}</Badge>
            {agent.keySource ? <Badge variant="outline">{agent.keySource}</Badge> : null}
          </div>
          {hasAgentAdvice ? (
            <div className="grid gap-2">
              <div className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto text-sm font-medium">{result.nextAction || "OpenAI next action"}</span>
                  <Badge variant="outline">{result.confidence || "medium"}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{result.summary}</p>
              </div>
              {recommendedRows.length ? (
                <div className="grid gap-2 md:grid-cols-3">
                  {recommendedRows.map((row) => {
                    const brokerRow = brokerByKey.get(getOpenAIAgentRecommendationKey(row));
                    const actionLabel = brokerRow?.canAct ? brokerRow.buttonLabel : brokerRow?.targetPanel ? "Open gate" : "Review";
                    return (
                      <div key={getOpenAIAgentRecommendationKey(row)} className="rounded-md border bg-card p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="mr-auto text-sm font-medium">{row.title}</span>
                          <Badge variant={brokerRow?.tone || "review"}>{brokerRow?.status || row.priority}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{row.reason}</p>
                        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => onAgentAction(row)} disabled={agent.running || (!brokerRow?.canAct && !brokerRow?.targetPanel)}>
                          <Play className="h-4 w-4" />
                          Follow AI recommendation: {actionLabel}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-md border bg-card p-3 text-sm text-muted-foreground">
              Ask OpenAI for the next cleanup step after a real scan. The model receives bounded scan and plan context, then any recommendation still routes through scan, consent, feature-flag, target, and proof checks.
            </div>
          )}
          {agent.error ? <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{agent.error}</div> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => onAction(next)} disabled={flow.scanning || next.disabled}>
            {flow.scanning ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {flow.scanning ? "Scanning" : next.label || "Open route"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onAskAgent} disabled={agent.running || !agent.configured}>
            {agent.running ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {agent.running ? "Asking OpenAI" : "Ask OpenAI for next cleanup step"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onExportSmokePacket}>
            <Download className="h-4 w-4" />
            Export smoke packet
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NativeBetaDistributionPanel({
  readiness,
  evidence,
  importText,
  importResult,
  onToggleEvidence,
  onUpdateEvidence,
  onImportText,
  onImportEvidence,
  onResetEvidence,
  onExportEvidence
}) {
  const visibleRows = readiness.waitingRows.length ? readiness.waitingRows : readiness.rows.slice(0, 4);
  const evidenceRows = nativeBetaEvidenceSpecs.map((spec) => ({
    ...spec,
    record: coerceNativeBetaEvidenceFormRecord(evidence?.[spec.id])
  }));
  const evidenceComplete = evidenceRows.filter((row) => isNativeBetaEvidenceRecordComplete(row.record)).length;

  return (
    <Card id="native-beta-distribution-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Native beta distribution
            </CardTitle>
            <CardDescription>{readiness.primary}</CardDescription>
          </div>
          <Badge variant={readiness.tone}>{readiness.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <QueueStat label="Rows" value={`${readiness.counts.ready}/${readiness.counts.total}`} tone={readiness.readyForNativeBeta ? "safe" : "review"} />
          <QueueStat label="Evidence" value={`${evidenceComplete}/${evidenceRows.length}`} tone={readiness.docsReady ? "safe" : "review"} />
          <QueueStat label="Signing" value={readiness.signingReady ? "ready" : "wait"} tone={readiness.signingReady ? "safe" : "review"} />
          <QueueStat label="Real cleanup" value={readiness.realRunEnabled ? "visible" : "locked"} tone={readiness.realRunEnabled ? "restricted" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Distribution boundary</span>
            <Badge variant={readiness.readyForWebDemo ? "safe" : "outline"}>
              {readiness.readyForWebDemo ? "web demo ok" : "web demo waiting"}
            </Badge>
            <Badge variant={readiness.readyForNativeBeta ? "safe" : "outline"}>
              {readiness.readyForNativeBeta ? "native beta ok" : "native beta waiting"}
            </Badge>
            <Badge variant={readiness.destructiveCommands ? "restricted" : "safe"}>
              {readiness.destructiveCommands ? "destructive visible" : "no destructive commands"}
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            {readiness.steps.slice(0, 3).map((step) => (
              <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {visibleRows.map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 text-sm font-medium">{row.label}</div>
                <Badge variant={row.tone}>{row.status}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge variant="outline">{row.lane}</Badge>
                <Badge variant={row.realRunAllowed ? "restricted" : "safe"}>
                  {row.realRunAllowed ? "real run" : "no real run"}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{row.detail}</p>
            </div>
          ))}
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-medium">Recorded beta evidence</div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onExportEvidence}>
                <Download className="h-4 w-4" />
                Export ledger
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onResetEvidence}>
                <RefreshCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
          <div className="mb-3 rounded-md border bg-card p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">Import exported ledger</span>
              <Badge variant={importResult?.canApply ? "safe" : importResult ? "review" : "outline"}>
                {importResult?.status || "waiting"}
              </Badge>
            </div>
            <Textarea
              className="min-h-20 font-mono"
              value={importText}
              placeholder='Paste spaceguard-native-beta-evidence/v1 JSON or the exported markdown file'
              aria-label="native beta evidence import"
              onChange={(event) => onImportText(event.target.value)}
            />
            <Button type="button" className="mt-2 w-full" variant="outline" onClick={onImportEvidence} disabled={!importText.trim()}>
              <ClipboardList className="h-4 w-4" />
              Import ledger
            </Button>
            {importResult ? (
              <div className="mt-2 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={importResult.canApply ? "safe" : "review"}>
                    {importResult.canApply ? "mapped" : "blocked"}
                  </Badge>
                  <span>{importResult.detail}</span>
                </div>
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  <span>Rows: {importResult.counts.importedRows}/{importResult.counts.sourceRows}</span>
                  <span>Complete: {importResult.counts.complete}</span>
                  <span>Needs detail: {importResult.counts.needsDetail}</span>
                  <span>Ignored: {importResult.counts.ignoredRows}</span>
                </div>
                {importResult.warnings.length ? (
                  <div className="mt-2 flex flex-col gap-1">
                    {importResult.warnings.map((warning) => (
                      <span key={warning}>{warning}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="grid gap-2">
            {evidenceRows.map((row) => {
              const complete = isNativeBetaEvidenceRecordComplete(row.record);
              const marked = row.record.status === "passed";
              return (
                <div key={row.id} className="rounded-md border bg-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Checkbox
                      checked={marked}
                      aria-label={`${row.label} evidence recorded`}
                      onClick={() => onToggleEvidence(row.id, !marked)}
                    />
                    <div className="mr-auto min-w-0 text-sm font-medium">{row.label}</div>
                    <Badge variant={complete ? "safe" : marked ? "review" : "outline"}>
                      {complete ? "complete" : marked ? "needs detail" : "draft"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{row.detail}</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <Input
                      value={row.record.evidencePath}
                      placeholder="Evidence path or artifact id"
                      aria-label={`${row.label} evidence path`}
                      onChange={(event) => onUpdateEvidence(row.id, "evidencePath", event.target.value)}
                    />
                    <Input
                      value={row.record.reviewer}
                      placeholder="Reviewer"
                      aria-label={`${row.label} reviewer`}
                      onChange={(event) => onUpdateEvidence(row.id, "reviewer", event.target.value)}
                    />
                  </div>
                  <Textarea
                    className="mt-2"
                    value={row.record.notes}
                    placeholder="Notes"
                    aria-label={`${row.label} notes`}
                    onChange={(event) => onUpdateEvidence(row.id, "notes", event.target.value)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DemoRehearsalRunbookPanel({ runbook, onExport }) {
  return (
    <Card id="demo-rehearsal-runbook-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Demo rehearsal runbook
            </CardTitle>
            <CardDescription>{runbook.primary}</CardDescription>
          </div>
          <Badge variant={runbook.tone}>{runbook.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Safe" value={runbook.safeForPublicDemo ? "yes" : "no"} tone={runbook.safeForPublicDemo ? "safe" : "restricted"} />
          <QueueStat label="Evidence" value={runbook.evidenceComplete ? "ready" : "open"} tone={runbook.evidenceComplete ? "safe" : "review"} />
          <QueueStat label="Native" value={runbook.requiresNativeData ? "needs" : "none"} tone={runbook.requiresNativeData ? "restricted" : "safe"} />
          <QueueStat label="Writes" value={runbook.realCleanupEnabled ? "on" : "locked"} tone={runbook.realCleanupEnabled ? "restricted" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Public demo boundary</span>
            <Badge variant={runbook.noLocalFileAccess ? "safe" : "review"}>
              {runbook.noLocalFileAccess ? "no local file access" : "not demo data"}
            </Badge>
            <Badge variant={runbook.destructiveCommands ? "restricted" : "safe"}>
              {runbook.destructiveCommands ? "destructive visible" : "no destructive commands"}
            </Badge>
            <Badge variant="outline">{runbook.counts.realRun} real-run routes</Badge>
          </div>
          <div className="flex flex-col gap-2">
            {runbook.steps.slice(0, 3).map((step) => (
              <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {runbook.rows.map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3">
              <div className="flex items-center gap-2">
                <div className="mr-auto text-sm font-medium">{row.label}</div>
                <Badge variant={row.tone}>{row.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
              <p className="mt-2 text-xs text-muted-foreground">{row.action}</p>
            </div>
          ))}
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-sm font-medium">In-app rehearsal actions</div>
            <Button type="button" size="sm" variant="outline" onClick={onExport}>
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {runbook.inAppActions.map((action) => (
              <div key={action.id} className="grid gap-1 rounded-md border bg-card p-2 text-xs sm:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <div className="font-medium">{action.label}</div>
                  <div className="text-muted-foreground">{action.detail}</div>
                </div>
                <Badge variant={action.destructive ? "restricted" : action.status === "ready" || action.status === "complete" ? "safe" : "review"}>
                  {action.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductCompletionAuditPanel({ audit }) {
  const progressValue = audit.counts.total ? Math.round((audit.counts.proven / audit.counts.total) * 100) : 0;
  const previewRows = audit.rows.slice(0, 8);

  return (
    <Card id="product-completion-audit-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Product completion audit
            </CardTitle>
            <CardDescription>{audit.primary}</CardDescription>
          </div>
          <Badge variant={audit.tone}>{audit.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Proven" value={audit.counts.proven} tone={audit.counts.proven ? "safe" : "review"} />
          <QueueStat label="Waiting" value={audit.counts.waiting + audit.counts.partial} tone={audit.counts.waiting || audit.counts.partial ? "review" : "safe"} />
          <QueueStat label="Locked" value={audit.counts.locked} tone={audit.counts.locked ? "restricted" : "safe"} />
          <QueueStat label="Real run" value={audit.scopedRealCleanupAvailable ? "scoped" : audit.realCleanupComplete ? "ready" : "locked"} tone={audit.scopedRealCleanupAvailable || audit.realCleanupComplete ? "safe" : "restricted"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Audited requirement coverage</span>
            <span className="text-muted-foreground">{progressValue}% proven</span>
          </div>
          <Progress value={progressValue} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant={audit.publicDemoReady ? "safe" : "review"}>
              {audit.publicDemoReady ? "public demo safe" : "public demo waiting"}
            </Badge>
            <Badge variant={audit.readOnlyRealDataReady ? "safe" : "outline"}>
              {audit.readOnlyRealDataReady ? "real scan current" : "real scan not proven"}
            </Badge>
            <Badge variant={audit.realCleanupLocked ? "restricted" : "safe"}>
              {audit.scopedRealCleanupAvailable ? "scoped real cleanup" : audit.realCleanupLocked ? "real cleanup locked" : "real cleanup ready"}
            </Badge>
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 text-sm font-medium">Next audit moves</div>
          <div className="flex flex-col gap-2">
            {audit.steps.slice(0, 4).map((step) => (
              <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {previewRows.map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-auto min-w-0 text-sm font-medium">{row.requirement}</div>
                <Badge variant={row.tone}>{row.status}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{row.detail}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">{row.proofLevel}</Badge>
                <Badge variant={row.canRealRun ? "restricted" : "safe"}>{row.canRealRun ? "real run" : "no real run"}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{row.nextStep}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SafetyInterlockPanel({ interlock }) {
  const visibleRows = interlock.unsafeRows.length || interlock.holdRows.length
    ? [...interlock.unsafeRows, ...interlock.holdRows].slice(0, 6)
    : interlock.rows.slice(0, 6);

  return (
    <Card id="safety-interlock-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Safety interlock
            </CardTitle>
            <CardDescription>{interlock.primary}</CardDescription>
          </div>
          <Badge variant={interlock.tone}>{interlock.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Passed" value={interlock.counts.passed} tone={interlock.counts.passed ? "safe" : "review"} />
          <QueueStat label="Hold" value={interlock.counts.hold} tone={interlock.counts.hold ? "restricted" : "safe"} />
          <QueueStat label="Unsafe" value={interlock.counts.unsafe} tone={interlock.counts.unsafe ? "restricted" : "safe"} />
          <QueueStat label="Dry-run" value={interlock.dryRunAllowed ? "open" : "held"} tone={interlock.dryRunAllowed ? "safe" : "restricted"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Execution envelope</span>
            <Badge variant={interlock.dryRunAllowed ? "safe" : "restricted"}>{interlock.dryRunAllowed ? "dry-run interlocked" : "dry-run held"}</Badge>
            <Badge variant={interlock.realRunAllowed ? "restricted" : "safe"}>{interlock.realRunAllowed ? "real run open" : "real run locked"}</Badge>
            <Badge variant={interlock.destructiveCommands ? "restricted" : "safe"}>{interlock.destructiveCommands ? "destructive visible" : "no destructive commands"}</Badge>
          </div>
          <div className="flex flex-col gap-2">
            {interlock.steps.slice(0, 3).map((step) => (
              <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {visibleRows.map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-auto min-w-0 text-sm font-medium">{row.label}</div>
                <Badge variant={row.tone}>{row.status}</Badge>
                <Badge variant="outline">{row.lane}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{row.detail}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant={row.blocksDryRun ? "review" : "outline"}>{row.blocksDryRun ? "dry-run gate" : "release evidence"}</Badge>
                <Badge variant="outline">{row.evidence}</Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function OperatingChecklistPanel({
  checklist,
  onRunScan,
  onRunRealScan,
  onSuggestPlan,
  onApproveRebuildable,
  onConfirmPermanentRemoval,
  onAllowAdminRoutes,
  onFocusReview,
  onFocusPanel,
  onSelectAction,
  onArmConsent,
  onSimulate,
  onProbeWriteBoundary
}) {
  const previewRows = checklist.rows.slice(0, 7);
  const action = checklist.safeActionNow;

  function runChecklistAction(row) {
    if (!row || !row.canAct) return;
    if (row.action === "run-scan") onRunScan();
    if (row.action === "run-real-scan") onRunRealScan();
    if (row.action === "suggest-plan") onSuggestPlan();
    if (row.action === "approve-rebuildable") onApproveRebuildable();
    if (row.action === "confirm-permanent-removal") onConfirmPermanentRemoval();
    if (row.action === "allow-admin-routes") onAllowAdminRoutes();
    if (row.action === "focus-review" && row.actionId) onFocusReview(row.actionId);
    if (row.action === "focus-panel" && row.targetPanel) onFocusPanel(row.targetPanel);
    if (row.action === "select-action" && row.actionId) onSelectAction(row.actionId);
    if (row.action === "arm-consent") onArmConsent();
    if (row.action === "simulate") onSimulate();
    if (row.action === "probe-write-boundary") onProbeWriteBoundary();
  }

  return (
    <Card id="operating-checklist-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Operating checklist
            </CardTitle>
            <CardDescription>{checklist.primary}</CardDescription>
          </div>
          <Badge variant={checklist.tone}>{checklist.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Ready" value={checklist.counts.ready + checklist.counts.passed} tone={checklist.counts.ready || checklist.counts.passed ? "safe" : "review"} />
          <QueueStat label="Waiting" value={checklist.counts.waiting} tone={checklist.counts.waiting ? "review" : "safe"} />
          <QueueStat label="Unsafe" value={checklist.counts.unsafe} tone={checklist.counts.unsafe ? "restricted" : "safe"} />
          <QueueStat label="Actions" value={checklist.counts.actionable} tone={checklist.counts.actionable ? "advanced" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Current operating mode</span>
            <Badge variant={checklist.dryRunAllowed ? "safe" : "review"}>{checklist.dryRunAllowed ? "dry-run allowed" : "dry-run held"}</Badge>
            <Badge variant={checklist.realRunAllowed ? "restricted" : "safe"}>{checklist.realRunAllowed ? "real run open" : "real run locked"}</Badge>
            <Badge variant={checklist.destructiveCommands ? "restricted" : "safe"}>{checklist.destructiveCommands ? "destructive visible" : "no destructive commands"}</Badge>
          </div>
          {action ? (
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <div className="min-w-0">
                <div className="text-sm font-medium">{action.label}</div>
                <div className="text-xs text-muted-foreground">{action.detail}</div>
              </div>
              <Button size="sm" onClick={() => runChecklistAction(action)}>
                <CheckCircle2 className="h-4 w-4" />
                {operatingActionLabel(action)}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No guarded action is ready from this checklist.</p>
          )}
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {previewRows.map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-auto min-w-0 text-sm font-medium">{row.label}</div>
                <Badge variant={row.tone}>{row.status}</Badge>
                <Badge variant="outline">{row.phase}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{row.detail}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant={row.realRunAllowed ? "restricted" : "safe"}>{row.realRunAllowed ? "real run" : "no real run"}</Badge>
                {row.canAct ? <Badge variant="review">{operatingActionLabel(row)}</Badge> : null}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function operatingActionLabel(row) {
  if (row.action === "run-scan") return "Run demo scan";
  if (row.action === "run-real-scan") return "Run real scan";
  return questionActionLabel(row);
}

function WorkflowHandoffPanel({ handoff, onExport }) {
  return (
    <Card id="workflow-handoff-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Workflow handoff
            </CardTitle>
            <CardDescription>{handoff.primary}</CardDescription>
          </div>
          <Badge variant={handoff.tone}>{handoff.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <QueueStat label="Questions" value={handoff.counts.questions} tone={handoff.counts.questions ? "review" : "safe"} />
          <QueueStat label="Actionable" value={handoff.counts.actionableQuestions} tone={handoff.counts.actionableQuestions ? "advanced" : "safe"} />
          <QueueStat label="Proven" value={handoff.counts.provenRequirements} tone={handoff.counts.provenRequirements ? "safe" : "review"} />
          <QueueStat label="Beta evidence" value={handoff.workflow.nativeBetaEvidenceComplete || "0/0"} tone={handoff.workflow.nativeBetaEvidenceStatus === "complete" ? "safe" : "review"} />
          <QueueStat label="Writes" value={handoff.scopedRealCleanupAvailable ? "scoped" : handoff.realCleanupLocked ? "locked" : "ready"} tone={handoff.scopedRealCleanupAvailable || !handoff.realCleanupLocked ? "safe" : "restricted"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Resume boundary</span>
            <Badge variant={handoff.redactedPaths ? "safe" : "restricted"}>{handoff.redactedPaths ? "paths redacted" : "paths visible"}</Badge>
            <Badge variant={handoff.scopedRealCleanupAvailable ? "safe" : handoff.realCleanupEnabled ? "restricted" : "safe"}>{handoff.scopedRealCleanupAvailable ? "scoped cleanup" : handoff.realCleanupEnabled ? "cleanup enabled" : "no cleanup authority"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {handoff.activeQuestion ? handoff.activeQuestion.detail : "No active question is blocking this handoff."}
          </p>
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 text-sm font-medium">Next resume actions</div>
          <div className="flex flex-col gap-2">
            {handoff.steps.slice(0, 4).map((step) => (
              <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <ClipboardList className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-md border bg-card p-3">
            <div className="text-sm font-medium">Active question</div>
            <p className="mt-1 text-xs text-muted-foreground">{handoff.activeQuestion?.prompt || "None"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={handoff.activeQuestion?.actionable ? "safe" : "outline"}>
                {handoff.activeQuestion?.action || "none"}
              </Badge>
              {handoff.activeQuestion?.targetPanel ? <Badge variant="outline">{handoff.activeQuestion.targetPanel}</Badge> : null}
            </div>
          </div>
          <div className="rounded-md border bg-card p-3">
            <div className="text-sm font-medium">Workflow state</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <span>Scan: {handoff.workflow.scanStatus}</span>
              <span>Audit: {handoff.workflow.auditStatus}</span>
              <span>Setup: {handoff.workflow.setupStatus}</span>
              <span>Beta evidence: {handoff.workflow.nativeBetaEvidenceStatus}</span>
              <span>Release: {handoff.workflow.releaseReviewStatus}</span>
            </div>
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={onExport}>
          <Download className="h-4 w-4" />
          Export handoff
        </Button>
      </CardContent>
    </Card>
  );
}

function BetaHandoffManifestPanel({ manifest, onExport }) {
  const previewRows = manifest.rows || [];

  return (
    <Card id="beta-handoff-manifest-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Beta handoff manifest
            </CardTitle>
            <CardDescription>{manifest.primary}</CardDescription>
          </div>
          <Badge variant={manifest.tone}>{manifest.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <QueueStat label="Public" value={manifest.counts.publicShareable} tone={manifest.readyForPublicHandoff ? "safe" : "review"} />
          <QueueStat label="Internal" value={manifest.counts.internalOnly} tone={manifest.counts.internalOnly ? "review" : "safe"} />
          <QueueStat label="Path-level" value={manifest.counts.pathLevel} tone={manifest.counts.pathLevel ? "restricted" : "safe"} />
          <QueueStat label="Waiting" value={manifest.counts.waiting + manifest.counts.missing} tone={manifest.counts.waiting || manifest.counts.missing ? "review" : "safe"} />
          <QueueStat label="Writes" value={manifest.realCleanupEnabled ? "visible" : "locked"} tone={manifest.realCleanupEnabled ? "restricted" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Share boundary</span>
            <Badge variant={manifest.redactedPublicArtifacts ? "safe" : "restricted"}>{manifest.redactedPublicArtifacts ? "public rows redacted" : "redaction missing"}</Badge>
            <Badge variant={manifest.readyForNativeBetaHandoff ? "safe" : "review"}>{manifest.readyForNativeBetaHandoff ? "native beta ready" : "native beta waiting"}</Badge>
            <Badge variant={manifest.destructiveCommands ? "restricted" : "safe"}>{manifest.destructiveCommands ? "destructive visible" : "no destructive commands"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Public-safe rows can be shared by default. Internal and path-level rows require explicit operator or user approval.
          </p>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {previewRows.map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-auto min-w-0 text-sm font-medium">{row.label}</div>
                <Badge variant={row.status === "ready" ? "safe" : row.status === "blocked" ? "restricted" : "review"}>{row.status}</Badge>
                <Badge variant={row.publicShareable ? "safe" : "outline"}>{row.shareScope}</Badge>
              </div>
              <p className="mt-2 truncate font-mono text-xs text-muted-foreground">{row.fileName}</p>
              <p className="mt-2 text-xs text-muted-foreground">{row.detail}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant={row.redactedPaths ? "safe" : "restricted"}>{row.redactedPaths ? "redacted" : "path-level"}</Badge>
                <Badge variant="outline">{row.requiredFor}</Badge>
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" className="w-full" onClick={onExport}>
          <Download className="h-4 w-4" />
          Export beta handoff manifest
        </Button>
      </CardContent>
    </Card>
  );
}

function LocalEvidenceBackupPanel({ backup, importText, importResult, onImportText, onImport, onExport }) {
  const evidenceRows = backup.rows || [];

  return (
    <Card id="local-evidence-backup-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Local evidence backup
            </CardTitle>
            <CardDescription>Export or restore local evidence ledgers without restoring scan, consent, selection, or execution state.</CardDescription>
          </div>
          <Badge variant={backup.counts.totalRows ? "review" : "outline"}>{backup.scope}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <QueueStat label="Evidence" value={backup.counts.evidenceRows} tone={backup.counts.evidenceRows ? "review" : "safe"} />
          <QueueStat label="History" value={backup.counts.runHistory} tone={backup.counts.runHistory ? "review" : "safe"} />
          <QueueStat label="Groups" value={backup.counts.evidenceGroups} tone="review" />
          <QueueStat label="Real run" value={backup.counts.realRun} tone="safe" />
          <QueueStat label="Scope" value="local" tone="review" />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Restore boundary</span>
            <Badge variant={backup.realCleanupEnabled ? "restricted" : "safe"}>{backup.realCleanupEnabled ? "cleanup visible" : "no cleanup authority"}</Badge>
            <Badge variant={backup.redactedPaths ? "safe" : "restricted"}>{backup.redactedPaths ? "redacted" : "may include paths"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Excluded state: {backup.excludedState.join(", ")}.
          </p>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {evidenceRows.map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-auto min-w-0 text-sm font-medium">{row.label}</span>
                <Badge variant={row.status === "ready" ? "safe" : "outline"}>{row.status}</Badge>
                <Badge variant="outline">{row.count}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{row.detail}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="mb-2 text-sm font-medium">Export backup</div>
            <p className="mb-3 text-xs text-muted-foreground">Use this before clearing local storage or moving evidence to another browser profile.</p>
            <Button variant="outline" className="w-full" onClick={onExport} disabled={!backup.counts.totalRows}>
              <Download className="h-4 w-4" />
              Export local evidence backup
            </Button>
          </div>

          <div className="rounded-md border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">Import backup</span>
              <Badge variant={importResult?.canApply ? "safe" : importResult ? "review" : "outline"}>
                {importResult?.status || "waiting"}
              </Badge>
            </div>
            <Textarea
              className="min-h-20 font-mono"
              value={importText}
              placeholder="Paste spaceguard-local-evidence-backup/v1 JSON or markdown"
              aria-label="local evidence backup import"
              onChange={(event) => onImportText(event.target.value)}
            />
            <Button variant="outline" className="mt-2 w-full" onClick={onImport} disabled={!importText.trim()}>
              <ClipboardList className="h-4 w-4" />
              Import evidence backup
            </Button>
            {importResult ? (
              <div className="mt-3 rounded-md border bg-card p-2 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={importResult.canApply ? "safe" : "review"}>{importResult.canApply ? "mapped" : "blocked"}</Badge>
                  <span>{importResult.detail}</span>
                </div>
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  <span>Evidence: {importResult.counts.importedEvidenceRows}</span>
                  <span>History: {importResult.counts.importedRunHistory}</span>
                  <span>Merged history: {importResult.counts.mergedRunHistory}</span>
                  <span>Ignored history: {importResult.counts.ignoredRunHistory}</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScanSessionPanel({ session }) {
  const changed = session.changedSettings || [];
  const steps = session.steps || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Scan session
            </CardTitle>
            <CardDescription>{session.primary}</CardDescription>
          </div>
          <Badge variant={session.tone}>{session.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-3">
          <QueueStat label="Drive" value={session.targetDrive} tone="review" />
          <QueueStat label="Current" value={session.current ? "yes" : "no"} tone={session.current ? "safe" : "restricted"} />
          <QueueStat label="Ready" value={session.readyForPlanning ? "yes" : "no"} tone={session.readyForPlanning ? "safe" : "review"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Evidence fingerprint</span>
            <Badge variant="outline">{session.currentFingerprint}</Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
            <span>Captured: {session.capturedFingerprint || "none"}</span>
            <span>Generated: {session.generatedAt || "not captured"}</span>
          </div>
        </div>

        <div className="grid gap-2">
          {session.items.map((item) => (
            <div key={item.id} className="grid grid-cols-[18px_1fr] gap-2 rounded-md border bg-card p-3 text-sm">
              <CheckCircle2 className={`mt-0.5 h-4 w-4 ${item.passed ? "text-emerald-600" : "text-muted-foreground"}`} />
              <div>
                <div className={item.passed ? "font-medium" : "font-medium text-muted-foreground"}>{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.detail}</div>
              </div>
            </div>
          ))}
        </div>

        {changed.length ? (
          <div className="rounded-md border bg-amber-50 p-3 text-sm text-amber-950">
            Changed since scan: {changed.join(", ")}. Run a fresh native read-only scan before simulation.
          </div>
        ) : null}

        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          {steps.slice(0, 3).map((step) => (
            <div key={step}>- {step}</div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PlanLockPanel({ planLock }) {
  return (
    <Card id="plan-lock-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Plan lock
            </CardTitle>
            <CardDescription>{planLock.primary}</CardDescription>
          </div>
          <Badge variant={planLock.tone}>{planLock.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-5">
          <QueueStat label="Preflight" value={planLock.readyForPreflight ? "ready" : "blocked"} tone={planLock.readyForPreflight ? "safe" : "restricted"} />
          <QueueStat label="Launch" value={planLock.readyForLaunch ? "ready" : "blocked"} tone={planLock.readyForLaunch ? "safe" : "review"} />
          <QueueStat label="Consent" value={planLock.consentCurrent ? "current" : "waiting"} tone={planLock.consentCurrent ? "safe" : "review"} />
          <QueueStat label="Real run" value="locked" tone="safe" />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Lock id</span>
            <Badge variant="outline">{planLock.lockId || "missing"}</Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
            <span>Plan: {planLock.planId || "missing"}</span>
            <span>Scan: {planLock.scanFingerprint || "missing"}</span>
            <span>Risk: {planLock.riskMode || "unknown"} / {planLock.riskStatus}</span>
            <span>Accepted lock: {planLock.acceptedLockId || "none"}</span>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {planLock.items.map((item) => (
            <div key={item.id} className="grid grid-cols-[18px_1fr] gap-2 rounded-md border bg-card p-3 text-sm">
              {item.passed ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />}
              <div>
                <div className={item.passed ? "font-medium" : "font-medium text-muted-foreground"}>{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.detail}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          {planLock.steps.slice(0, 3).map((step) => (
            <div key={step}>- {step}</div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function IntakePolicyPanel({ policy, adminAllowed, onAdminAllowed }) {
  const adminBlocked = policy.adminSensitiveBlocked;
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Intake constraints
            </CardTitle>
            <CardDescription>{formatBytes(policy.goalBytes)} target on {policy.targetDrive}, {policy.mode} tolerance</CardDescription>
          </div>
          <Badge variant={adminBlocked ? "review" : "safe"}>{adminBlocked ? "admin gated" : "admin allowed"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-md border bg-muted/30 p-3">
          <Checkbox checked={adminAllowed} onClick={() => onAdminAllowed(!adminAllowed)} className="mt-0.5" />
          <span className="grid gap-1 text-sm">
            <span className="font-medium">Admin/system actions in dry-run planning</span>
            <span className="text-muted-foreground">
              {adminBlocked
                ? "Windows.old, hibernation, and WSL compaction stay out of suggestions."
                : "Admin-sensitive routes can be selected, but real execution remains locked."}
            </span>
          </span>
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          {policy.items.map((item) => (
            <div key={item.id} className="flex items-start gap-2 rounded-md border bg-card p-3 text-sm">
              {item.passed ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />}
              <div className="min-w-0">
                <div className="font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TaskPowerPanel({ catalog }) {
  const previewRows = catalog.selectedRows.length
    ? catalog.selectedRows
    : catalog.rows.filter((row) => row.status !== "empty").slice(0, 7);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Task powers
            </CardTitle>
            <CardDescription>{catalog.primary}</CardDescription>
          </div>
          <Badge variant={catalog.tone}>{catalog.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Selected" value={catalog.counts.selected} tone={catalog.counts.selected ? "review" : "safe"} />
          <QueueStat label="Active" value={catalog.counts.active} tone={catalog.counts.active ? "safe" : "review"} />
          <QueueStat label="Locked" value={catalog.counts.locked + catalog.counts.needsApproval} tone={catalog.counts.locked || catalog.counts.needsApproval ? "restricted" : "safe"} />
          <QueueStat label="Dry-run" value={catalog.counts.dryRun} tone={catalog.counts.dryRun ? "safe" : "review"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Scoped powers</span>
            <Badge variant={catalog.realRunEnabled ? "restricted" : "safe"}>
              {catalog.realRunEnabled ? "real run visible" : "real run disabled"}
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            {catalog.steps.slice(0, 3).map((step) => (
              <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {previewRows.map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-auto min-w-0 text-sm font-medium">{row.label}</div>
                <Badge variant={row.tone}>{row.status}</Badge>
                <Badge variant="outline">{row.selectedCount}/{row.availableCount}</Badge>
                <Badge variant="outline">{formatBytes(row.selected ? row.plannedBytes : row.visibleBytes)}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{row.scope}</p>
              <p className="mt-1 text-xs text-muted-foreground">{row.nextStep}</p>
              {row.blockers.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {row.blockers.slice(0, 2).map((blocker) => (
                    <Badge key={`${row.id}-${blocker.id}`} variant="restricted">{blocker.label}</Badge>
                  ))}
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {row.guardrails.slice(0, 2).map((guardrail) => (
                    <Badge key={`${row.id}-${guardrail}`} variant="outline">{guardrail}</Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TaskPowerBrokerPanel({ broker }) {
  const previewRows = broker.requests.length ? broker.requests.slice(0, 4) : [];

  return (
    <Card id="task-power-broker-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Power broker
            </CardTitle>
            <CardDescription>{broker.primary}</CardDescription>
          </div>
          <Badge variant={broker.tone}>{broker.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Requests" value={broker.counts.requests} tone={broker.counts.requests ? "review" : "safe"} />
          <QueueStat label="Granted" value={broker.counts.granted} tone={broker.counts.granted ? "safe" : "review"} />
          <QueueStat label="Waiting" value={broker.counts.waiting} tone={broker.counts.waiting ? "review" : "safe"} />
          <QueueStat label="Denied" value={broker.counts.denied} tone={broker.counts.denied ? "restricted" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Broker envelope</span>
            <Badge variant={broker.standingPermission ? "restricted" : "safe"}>
              {broker.standingPermission ? "standing permission" : "no standing permission"}
            </Badge>
            <Badge variant={broker.realRunEnabled ? "restricted" : "safe"}>{broker.authority}</Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
            <div>{broker.activeQuestion?.prompt || "No active power question."}</div>
            <div>{broker.currentRequest ? `${broker.currentRequest.label}: ${broker.currentRequest.nextStep}` : broker.defaultDecision}</div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {previewRows.length ? (
            previewRows.map((request) => (
              <div key={request.id} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="mr-auto min-w-0 text-sm font-medium">{request.label}</div>
                  <Badge variant={request.tone}>{request.status}</Badge>
                  <Badge variant="outline">{formatBytes(request.plannedBytes)}</Badge>
                </div>
                <div className="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-[0.9fr_1fr]">
                  <div className="truncate">{request.selectedActions.join(", ") || "no selected actions"}</div>
                  <div>{request.nextStep}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {request.expiresWith.slice(0, 2).map((expiry) => (
                    <Badge key={`${request.id}-${expiry}`} variant="outline">{expiry}</Badge>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              No task-specific power has been requested for the current plan.
            </div>
          )}
        </div>

        <div className="rounded-md border bg-muted/20 p-3">
          <div className="mb-2 text-sm font-medium">Hard limits</div>
          <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
            {broker.hardLimits.slice(0, 4).map((limit) => (
              <div key={limit} className="flex items-start gap-2">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{limit}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskPowerLeaseAuditPanel({ audit }) {
  const previewRows = audit.rows.length ? audit.rows.slice(0, 5) : [];

  return (
    <Card id="task-power-lease-audit-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Power lease audit
            </CardTitle>
            <CardDescription>{audit.primary}</CardDescription>
          </div>
          <Badge variant={audit.tone}>{audit.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Current" value={audit.counts.current} tone={audit.counts.current ? "safe" : "review"} />
          <QueueStat label="Waiting" value={audit.counts.waiting} tone={audit.counts.waiting ? "review" : "safe"} />
          <QueueStat label="Stale" value={audit.counts.stale} tone={audit.counts.stale ? "restricted" : "safe"} />
          <QueueStat label="Blocked" value={audit.counts.blocked + audit.counts.unsafe} tone={audit.counts.blocked || audit.counts.unsafe ? "restricted" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Lease envelope</span>
            <Badge variant={audit.realRunEnabled ? "restricted" : "safe"}>{audit.authority}</Badge>
            <Badge variant={audit.standingPermission ? "restricted" : "safe"}>
              {audit.standingPermission ? "standing lease" : "no standing lease"}
            </Badge>
            <Badge variant={audit.consentCurrent ? "safe" : "outline"}>{audit.consentCurrent ? "consent matched" : "consent unmatched"}</Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
            <div className="truncate">Plan {audit.planId || "missing"}</div>
            <div className="truncate">Scan {audit.scanFingerprint || "missing"}</div>
            <div className="truncate">Consent {audit.consentPlanId || "missing"}</div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {previewRows.length ? (
            previewRows.map((row) => {
              const failedCheck = row.checks.find((check) => !check.passed);
              return (
                <div key={row.id} className="rounded-md border bg-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="mr-auto min-w-0 text-sm font-medium">{row.title}</div>
                    <Badge variant={row.tone}>{row.status}</Badge>
                    <Badge variant="outline">{row.powerLabel}</Badge>
                    <Badge variant={row.canRealRun ? "restricted" : "safe"}>{row.canRealRun ? "real run visible" : "real run locked"}</Badge>
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-[0.8fr_1fr]">
                    <div className="truncate">{row.route} | {row.target || "no target"}</div>
                    <div>{row.nextStep}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {row.checks.slice(0, 4).map((check) => (
                      <Badge key={`${row.id}-${check.id}`} variant={check.passed ? "safe" : "restricted"}>{check.label}</Badge>
                    ))}
                    {failedCheck ? <Badge variant="outline">{failedCheck.current}</Badge> : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              No dry-run lease exists for the current plan.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TaskCapabilityGrantPanel({ grants }) {
  const previewRows = grants.rows.length ? grants.rows.slice(0, 5) : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Task grants
            </CardTitle>
            <CardDescription>{grants.primary}</CardDescription>
          </div>
          <Badge variant={grants.tone}>{grants.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Selected" value={grants.counts.selected} tone={grants.counts.selected ? "review" : "safe"} />
          <QueueStat label="Issued" value={grants.counts.issued} tone={grants.counts.issued ? "safe" : "review"} />
          <QueueStat label="Waiting" value={grants.counts.waiting} tone={grants.counts.waiting ? "review" : "safe"} />
          <QueueStat label="Blocked" value={grants.counts.blocked} tone={grants.counts.blocked ? "restricted" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Grant envelope</span>
            <Badge variant={grants.realRunEnabled ? "restricted" : "safe"}>{grants.authority}</Badge>
            <Badge variant={grants.consentCurrent ? "safe" : "outline"}>{grants.consentCurrent ? "consent current" : "consent waiting"}</Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
            <div className="truncate">Plan {grants.planId || "missing"}</div>
            <div className="truncate">Scan {grants.scanFingerprint || "missing"}</div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {previewRows.length ? (
            previewRows.map((grant) => (
              <div key={grant.id} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="mr-auto min-w-0 text-sm font-medium">{grant.title}</div>
                  <Badge variant={grant.tone}>{grant.status}</Badge>
                  <Badge variant="outline">{grant.powerLabel}</Badge>
                  <Badge variant="outline">{formatBytes(grant.plannedBytes)}</Badge>
                </div>
                <div className="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-[0.8fr_1fr]">
                  <div className="truncate">{grant.route} | {grant.target || "no target"}</div>
                  <div>{grant.nextStep}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {grant.blockers.length ? (
                    grant.blockers.slice(0, 2).map((blocker) => (
                      <Badge key={`${grant.id}-${blocker.id}`} variant="restricted">{blocker.label}</Badge>
                    ))
                  ) : (
                    <>
                      <Badge variant="safe">dry-run only</Badge>
                      <Badge variant={grant.evidence.contractReady ? "safe" : "outline"}>
                        {grant.evidence.contractAttached ? "contract attached" : "no write contract"}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              No selected task has a grant receipt yet.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TaskRunbookPanel({ runbook }) {
  const previewRows = runbook.rows.slice(0, 5);

  return (
    <Card id="task-runbook-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Task runbook
            </CardTitle>
            <CardDescription>{runbook.primary}</CardDescription>
          </div>
          <Badge variant={runbook.tone}>{runbook.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Tasks" value={runbook.counts.selected} tone={runbook.counts.selected ? "review" : "safe"} />
          <QueueStat label="Ready" value={runbook.counts.ready} tone={runbook.counts.ready ? "safe" : "review"} />
          <QueueStat label="Waiting" value={runbook.counts.waiting} tone={runbook.counts.waiting ? "review" : "safe"} />
          <QueueStat label="Blocked" value={runbook.counts.blocked + runbook.counts.unsafe} tone={runbook.counts.blocked || runbook.counts.unsafe ? "restricted" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Work order boundary</span>
            <Badge variant={runbook.realRunEnabled ? "restricted" : "safe"}>{runbook.authority}</Badge>
            <Badge variant={runbook.noCrossTaskAuthority ? "safe" : "restricted"}>
              {runbook.noCrossTaskAuthority ? "no cross-task power" : "authority widened"}
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            {runbook.steps.slice(0, 3).map((step) => (
              <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {previewRows.length ? (
            previewRows.map((row) => (
              <div key={row.id} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="mr-auto min-w-0 text-sm font-medium">{row.title}</div>
                  <Badge variant={row.tone}>{row.status}</Badge>
                  <Badge variant="outline">{row.powerLabel}</Badge>
                  <Badge variant="outline">{formatBytes(row.plannedBytes)}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{row.agentStep}</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div className="rounded-md border bg-muted/20 p-2">
                    <div className="mb-1 flex items-center gap-2 text-xs font-medium">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                      Allowed now
                    </div>
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      {row.allowedOperations.slice(0, 3).map((operation) => (
                        <span key={operation}>{operation}</span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/20 p-2">
                    <div className="mb-1 flex items-center gap-2 text-xs font-medium">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      Forbidden
                    </div>
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      {row.forbiddenOperations.slice(0, 3).map((operation) => (
                        <span key={operation}>{operation}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant={row.canDryRun ? "safe" : "outline"}>{row.canDryRun ? "dry-run ready" : "ask first"}</Badge>
                  <Badge variant={row.canRealRun ? "restricted" : "safe"}>{row.canRealRun ? "real run visible" : "real run locked"}</Badge>
                  {row.questionId ? <Badge variant="outline">{row.questionId}</Badge> : null}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              No selected cleanup task has a runbook row yet.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RestrictionPolicyMatrixPanel({ matrix }) {
  const previewRows = matrix.rows.slice(0, 8);

  return (
    <Card id="restriction-policy-matrix-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Restriction matrix
            </CardTitle>
            <CardDescription>{matrix.primary}</CardDescription>
          </div>
          <Badge variant={matrix.tone}>{matrix.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Hard" value={matrix.counts.hardBlocked} tone="restricted" />
          <QueueStat label="Manual" value={matrix.counts.manualOnly} tone={matrix.counts.manualOnly ? "advisory" : "safe"} />
          <QueueStat label="Gated" value={matrix.counts.gated} tone={matrix.counts.gated ? "review" : "safe"} />
          <QueueStat label="Real" value={matrix.counts.realRun} tone={matrix.counts.realRun ? "restricted" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Global block</span>
            <Badge variant={matrix.realRunEnabled ? "restricted" : "safe"}>{matrix.realRunEnabled ? "real run visible" : "real run locked"}</Badge>
            <Badge variant={matrix.destructiveCommands ? "restricted" : "safe"}>{matrix.destructiveCommands ? "destructive command visible" : "no destructive commands"}</Badge>
          </div>
          <div className="flex flex-col gap-2">
            {matrix.steps.slice(0, 3).map((step) => (
              <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {previewRows.map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-auto min-w-0 text-sm font-medium">{row.title}</div>
                <Badge variant={row.tone}>{row.status}</Badge>
                <Badge variant="outline">{row.lane}</Badge>
                <Badge variant="outline">{formatBytes(row.visibleBytes)}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{row.reason}</p>
              <p className="mt-2 text-xs text-muted-foreground">{row.nextStep}</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div className="rounded-md border bg-muted/20 p-2">
                  <div className="mb-1 text-xs font-medium">Allowed</div>
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {row.allowedOperations.slice(0, 2).map((operation) => (
                      <span key={operation}>{operation}</span>
                    ))}
                  </div>
                </div>
                <div className="rounded-md border bg-muted/20 p-2">
                  <div className="mb-1 text-xs font-medium">Forbidden</div>
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {row.forbiddenOperations.slice(0, 2).map((operation) => (
                      <span key={operation}>{operation}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant={row.canCreateExecutor ? "review" : "safe"}>{row.canCreateExecutor ? "executor gated" : "no executor"}</Badge>
                <Badge variant={row.canRealRun ? "restricted" : "safe"}>{row.canRealRun ? "real run visible" : "real run locked"}</Badge>
                {row.selectedCount ? <Badge variant="outline">{row.selectedCount} selected</Badge> : null}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function NativeScanSettingsPanel({
  settings,
  customRootInput,
  onCustomRootInput,
  onAddCustomRoot,
  onRemoveCustomRoot,
  onChange,
  nativeScan,
  requestGuard
}) {
  const depthOptions = [4, 6, 8, 10];
  const entryOptions = [5000, 10000, 25000, 50000];
  const hasNativeEvidence = Boolean(nativeScan.result);
  const customRoots = settings.customRoots || [];
  const guardRows = requestGuard?.rows || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ScanLine className="h-4 w-4" />
              Real scan settings
            </CardTitle>
            <CardDescription>Read-only limits applied to the next native scan.</CardDescription>
          </div>
          <Badge variant={requestGuard?.tone || (hasNativeEvidence ? "review" : "safe")}>
            {requestGuard?.status || (hasNativeEvidence ? "current scan set" : "ready")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {requestGuard ? (
          <div className="rounded-md border bg-card p-3">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Native scan request guard</div>
                <p className="text-xs text-muted-foreground">{requestGuard.primary}</p>
              </div>
              {requestGuard.canScan ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {guardRows.map((row) => (
                <div key={row.id} className="rounded-md border bg-muted/30 p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{row.label}</span>
                    <Badge variant={row.status === "blocked" ? "restricted" : row.status === "review" ? "review" : "safe"}>{row.status}</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">{row.detail}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Target drive scope</div>
              <p className="text-xs text-muted-foreground">Volume totals and system roots use this drive. User-profile cache roots remain tied to the current Windows profile.</p>
            </div>
            <Badge variant="outline">{normalizeTargetDrive(settings.targetDrive)}</Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
            <Input
              value={settings.targetDrive}
              placeholder="C:"
              aria-label="target drive"
              onChange={(event) => onChange("targetDrive", event.target.value)}
              onBlur={() => onChange("targetDrive", normalizeTargetDrive(settings.targetDrive))}
            />
            <div className="rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground">
              System roots resolve to {normalizeTargetDrive(settings.targetDrive)}; arbitrary paths must be added as custom read-only roots.
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
          <Checkbox
            className="mt-0.5"
            checked={settings.includeProjectArtifacts}
            onClick={() => onChange("includeProjectArtifacts", !settings.includeProjectArtifacts)}
          />
          <div>
            <div className="text-sm font-medium">Project artifacts</div>
            <p className="text-xs text-muted-foreground">Include old `node_modules` roots under common project folders.</p>
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Custom read-only roots</div>
              <p className="text-xs text-muted-foreground">Measure extra folders for manual review. These never create executor routes.</p>
            </div>
            <Badge variant="outline">{customRoots.length}/8</Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Input
              value={customRootInput}
              placeholder="C:\\Users\\you\\Downloads\\archives"
              aria-label="custom read-only scan root"
              onChange={(event) => onCustomRootInput(event.target.value)}
            />
            <Button type="button" variant="outline" size="sm" onClick={onAddCustomRoot} disabled={!customRootInput.trim() || customRoots.length >= 8}>
              <Plus className="h-4 w-4" />
              Add root
            </Button>
          </div>
          {customRoots.length ? (
            <div className="mt-2 flex flex-col gap-2">
              {customRoots.map((root) => (
                <div key={root} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-xs">
                  <span className="min-w-0 truncate font-mono text-muted-foreground">{root}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => onRemoveCustomRoot(root)}>
                    <X className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Traversal depth</div>
            <div className="grid grid-cols-4 gap-2">
              {depthOptions.map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={settings.maxDepth === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => onChange("maxDepth", value)}
                >
                  {value}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entry cap</div>
            <div className="grid grid-cols-2 gap-2">
              {entryOptions.map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={settings.maxEntriesPerRoot === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => onChange("maxEntriesPerRoot", value)}
                >
                  {value >= 1000 ? `${value / 1000}k` : value}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-5">
          <QueueStat label="Drive" value={normalizeTargetDrive(settings.targetDrive)} tone="review" />
          <QueueStat label="Depth" value={settings.maxDepth} tone="review" />
          <QueueStat label="Cap" value={`${settings.maxEntriesPerRoot / 1000}k`} tone="review" />
          <QueueStat label="Projects" value={settings.includeProjectArtifacts ? "on" : "off"} tone={settings.includeProjectArtifacts ? "safe" : "advisory"} />
          <QueueStat label="Custom" value={customRoots.length} tone={customRoots.length ? "review" : "safe"} />
        </div>
      </CardContent>
    </Card>
  );
}

function DriveInventoryPanel({ inventory }) {
  const rows = inventory.topRows || [];

  return (
    <Card id="drive-inventory-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Drive inventory
            </CardTitle>
            <CardDescription>{inventory.primary}</CardDescription>
          </div>
          <Badge variant={inventory.tone}>{inventory.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <QueueStat label="Top entries" value={inventory.counts.total} tone={inventory.counts.total ? "review" : "restricted"} />
          <QueueStat label="Visible" value={formatBytes(inventory.visibleBytes)} tone={inventory.visibleBytes ? "review" : "safe"} />
          <QueueStat label="Manual" value={inventory.counts.review} tone={inventory.counts.review ? "review" : "safe"} />
          <QueueStat label="Executors" value={inventory.counts.executorRoutes} tone="safe" />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Discovery boundary</span>
            <Badge variant="safe">read-only</Badge>
            <Badge variant="safe">no executor routes</Badge>
            <Badge variant={inventory.counts.system ? "restricted" : "outline"}>{inventory.counts.system} system bucket(s)</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Top-level C-drive inventory explains space pressure only. Unknown or user-data buckets must go through custom root triage, item review, or manual strategy.
          </p>
        </div>

        {rows.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {rows.map((row) => (
              <div key={row.id} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto min-w-0 truncate text-sm font-medium">{row.name}</span>
                  <Badge variant={row.tone}>{row.classification}</Badge>
                  <Badge variant="outline">{formatBytes(row.bytes)}</Badge>
                </div>
                <div className="mt-2 truncate font-mono text-xs text-muted-foreground">{row.path || "path unavailable"}</div>
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                  <span>{row.status}</span>
                  <span>{row.files} file(s)</span>
                  <span>{row.dirs} folder(s)</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{row.nextStep}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Run a native read-only scan to capture top-level drive inventory. Browser demo mode cannot enumerate local folders.
          </div>
        )}

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 text-sm font-medium">Next inventory moves</div>
          <div className="flex flex-col gap-2">
            {inventory.steps.slice(0, 4).map((step) => (
              <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StoragePressureDiagnosisPanel({ diagnosis }) {
  const causes = diagnosis.topCauses || [];
  const recipeRows = diagnosis.topRecipeRows || [];

  return (
    <Card id="storage-pressure-diagnosis-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CircleGauge className="h-4 w-4" />
              Storage pressure diagnosis
            </CardTitle>
            <CardDescription>{diagnosis.primary}</CardDescription>
          </div>
          <Badge variant={diagnosis.tone}>{diagnosis.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <QueueStat label="Used" value={`${diagnosis.usedPercent}%`} tone={diagnosis.usedPercent >= 90 ? "restricted" : diagnosis.usedPercent >= 80 ? "review" : "safe"} />
          <QueueStat label="Selected" value={formatBytes(diagnosis.selectedBytes)} tone={diagnosis.selectedBytes ? "safe" : "review"} />
          <QueueStat label="Gap" value={formatBytes(diagnosis.selectedGapBytes)} tone={diagnosis.selectedGapBytes ? "review" : "safe"} />
          <QueueStat label="Real run" value={diagnosis.counts.realRun} tone="safe" />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Diagnosis boundary</span>
            <Badge variant="safe">manual advice</Badge>
            <Badge variant="safe">no cleanup authority</Badge>
            <Badge variant={diagnosis.destructiveCommands ? "restricted" : "safe"}>{diagnosis.destructiveCommands ? "destructive visible" : "destructive hidden"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Diagnosis explains why space is low and which branch to take next. It cannot bypass approval gates, protected paths, dry-run consent, validation, or write readiness.
          </p>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {causes.map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-auto min-w-0 text-sm font-medium">{row.label}</span>
                <Badge variant={row.tone}>{row.status}</Badge>
                <Badge variant="outline">{formatBytes(row.bytes)}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{row.detail}</p>
              <p className="mt-2 text-xs text-muted-foreground">{row.nextStep}</p>
            </div>
          ))}
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 text-sm font-medium">Largest recipe context</div>
          <div className="flex flex-col gap-2">
            {recipeRows.length ? (
              recipeRows.slice(0, 4).map((row) => (
                <div key={row.id} className="grid gap-2 rounded-md border bg-card p-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{row.label}</div>
                    <div className="text-xs text-muted-foreground">{row.status} / {row.gate}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{formatBytes(row.bytes)}</Badge>
                    <Badge variant={row.canCreateExecutor ? "review" : "safe"}>{row.canCreateExecutor ? "gated route" : "no route"}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">Run a scan to rank recipe context.</div>
            )}
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 text-sm font-medium">Next diagnosis moves</div>
          <div className="flex flex-col gap-2">
            {diagnosis.steps.slice(0, 4).map((step) => (
              <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NativeEvidenceQualityPanel({ quality }) {
  const visibleRows = quality.rows || [];

  return (
    <Card id="native-evidence-quality-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Native evidence quality
            </CardTitle>
            <CardDescription>{quality.primary}</CardDescription>
          </div>
          <Badge variant={quality.tone}>{quality.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <QueueStat label="Planning" value={quality.planningReady ? "ready" : "blocked"} tone={quality.planningReady ? "safe" : "review"} />
          <QueueStat label="Coverage" value={`${quality.coverageScore}%`} tone={quality.coverageComplete ? "safe" : quality.coverageScore ? "review" : "restricted"} />
          <QueueStat label="Measured roots" value={quality.measuredRoots} tone={quality.measuredRoots ? "safe" : "restricted"} />
          <QueueStat label="Real run" value={quality.counts.realRun} tone="safe" />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Evidence boundary</span>
            <Badge variant={quality.nativeAvailable ? "safe" : "review"}>{quality.nativeAvailable ? "native visible" : "native missing"}</Badge>
            <Badge variant={quality.mutationLocked ? "safe" : "restricted"}>{quality.mutationLocked ? "mutation locked" : "write signal"}</Badge>
            <Badge variant="safe">no executor authority</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            This gate grades read-only scan evidence for planning. It cannot create executor routes, count reclaimed bytes, or satisfy release/write readiness.
          </p>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {visibleRows.map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-auto min-w-0 text-sm font-medium">{row.label}</span>
                <Badge variant={row.tone}>{row.status}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{row.detail}</p>
              <p className="mt-2 text-xs text-muted-foreground">{row.nextStep}</p>
            </div>
          ))}
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 text-sm font-medium">Next evidence steps</div>
          <div className="flex flex-col gap-2">
            {quality.steps.slice(0, 4).map((step) => (
              <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScanCoveragePanel({ coverage }) {
  const previewRows = coverage.unverifiedRows.slice(0, 4);
  const customRows = coverage.customRootRows || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Scan coverage
            </CardTitle>
            <CardDescription>{coverage.primary}</CardDescription>
          </div>
          <Badge variant={coverage.tone}>{coverage.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-5">
          <QueueStat label="Confidence" value={`${coverage.confidenceScore}%`} tone={coverage.confidenceScore >= 80 ? "safe" : "review"} />
          <QueueStat label="Measured" value={formatBytes(coverage.measuredBytes)} tone="safe" />
          <QueueStat label="Estimates" value={formatBytes(coverage.estimatedBytes)} tone="review" />
          <QueueStat label="Unverified" value={coverage.counts.unverified} tone="restricted" />
          <QueueStat label="Custom" value={customRows.length} tone={customRows.length ? "review" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 text-sm font-medium">Coverage confidence</div>
          <Progress value={coverage.confidenceScore} indicatorClassName={coverage.confidenceScore >= 80 ? "bg-emerald-600" : "bg-amber-500"} />
          <p className="mt-2 text-xs text-muted-foreground">
            Confidence is the share of visible cleanup bytes backed by native measured or limited findings.
          </p>
        </div>

        {customRows.length ? (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">Custom root discovery</span>
              <Badge variant="outline">{formatBytes(coverage.customRootBytes || 0)}</Badge>
            </div>
            <div className="flex flex-col gap-2">
              {customRows.slice(0, 4).map((row) => (
                <div key={row.id} className="rounded-md border bg-card p-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="mr-auto min-w-0 truncate font-medium">{row.title}</span>
                    <Badge variant={row.evidence === "protected" ? "restricted" : row.verified ? "safe" : "review"}>{row.evidence}</Badge>
                    <Badge variant="outline">{formatBytes(row.bytes)}</Badge>
                  </div>
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{row.path}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{row.nextStep}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          {previewRows.length ? (
            previewRows.map((row) => (
              <div key={row.id} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="mr-auto min-w-0 text-sm font-medium">{row.title}</div>
                  <Badge variant={row.evidence === "unsupported" || row.evidence === "protected" ? "restricted" : "outline"}>
                    {row.evidence}
                  </Badge>
                  <Badge variant="outline">{formatBytes(row.bytes)}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{row.nextStep}</p>
              </div>
            ))
          ) : (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              Every visible cleanup recipe has native scan coverage.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CustomRootTriagePanel({ triage, onDisposition, onUpdate, onReset }) {
  const previewRows = triage.rows.slice(0, 5);

  return (
    <Card id="custom-root-triage-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Archive className="h-4 w-4" />
              Custom root triage
            </CardTitle>
            <CardDescription>{triage.primary}</CardDescription>
          </div>
          <Badge variant={triage.tone}>{triage.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Roots" value={triage.counts.rows} tone={triage.counts.rows ? "review" : "safe"} />
          <QueueStat label="Decided" value={triage.counts.decided} tone={triage.counts.waiting ? "review" : "safe"} />
          <QueueStat label="Manual" value={formatBytes(triage.manualDispositionBytes)} tone={triage.manualDispositionBytes ? "advisory" : "review"} />
          <QueueStat label="Exec" value={triage.counts.executorRoutes} tone={triage.counts.executorRoutes ? "restricted" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Manual-only boundary</span>
            <Badge variant="safe">no executor route</Badge>
            <Badge variant="outline">{formatBytes(triage.visibleBytes)}</Badge>
          </div>
          <div className="flex flex-col gap-2">
            {triage.steps.slice(0, 3).map((step) => (
              <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {previewRows.length ? (
            previewRows.map((row) => (
              <div key={row.id} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="mr-auto min-w-0 text-sm font-medium">{row.title}</div>
                  <Badge variant={row.tone}>{row.status}</Badge>
                  <Badge variant="outline">{formatBytes(row.bytes)}</Badge>
                </div>
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{row.path}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {customRootDispositionOptions.map((option) => (
                    <Button
                      key={`${row.id}-${option.id}`}
                      type="button"
                      size="sm"
                      variant={row.disposition === option.id ? "default" : "outline"}
                      onClick={() => onDisposition(row.id, option.id)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <Input
                    value={row.owner}
                    placeholder="Owner or app"
                    aria-label={`${row.title} owner`}
                    onChange={(event) => onUpdate(row.id, "owner", event.target.value)}
                  />
                  <Input
                    value={row.notes}
                    placeholder="Manual note"
                    aria-label={`${row.title} manual note`}
                    onChange={(event) => onUpdate(row.id, "notes", event.target.value)}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{row.nextStep}</p>
              </div>
            ))
          ) : (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              No custom read-only roots are present in the current scan.
            </div>
          )}
        </div>

        <Button variant="outline" className="w-full" onClick={onReset} disabled={triage.counts.decided === 0}>
          <RefreshCcw className="h-4 w-4" />
          Reset custom triage
        </Button>
      </CardContent>
    </Card>
  );
}

function RecoveryAdvisorPanel({ advisor, onSuggest }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Recovery advisor
            </CardTitle>
            <CardDescription>{advisor.primary}</CardDescription>
          </div>
          <Badge variant={advisor.tone}>{advisor.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[0.7fr_1fr]">
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Open gap</div>
            <div className="mt-1 text-3xl font-semibold tracking-tight">{formatBytes(advisor.gapBytes)}</div>
            <div className="mt-1 text-sm text-muted-foreground">{advisor.detail}</div>
          </div>
          <div className="grid gap-2">
            {advisor.steps.slice(0, 3).map((step) => (
              <div key={step} className="grid grid-cols-[18px_1fr] gap-2 rounded-md border bg-card p-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-blue-600" />
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <AdvisorBucket label="Safe" value={advisor.buckets.quickWins.length} />
          <AdvisorBucket label="Confirm" value={advisor.buckets.rebuildable.length} />
          <AdvisorBucket label="Review" value={advisor.buckets.reviewCandidates.length} />
          <AdvisorBucket label="Locked" value={advisor.buckets.blockedVisible.length} />
        </div>
        <Button variant="secondary" size="sm" onClick={onSuggest}>
          <Sparkles className="h-4 w-4" />
          Rebuild plan
        </Button>
      </CardContent>
    </Card>
  );
}

function AgentQuestionPanel({
  queue,
  nativeCapability,
  onRunScan,
  onRunRealScan,
  onSuggestPlan,
  onApproveRebuildable,
  onConfirmPermanentRemoval,
  onAllowAdminRoutes,
  onFocusReview,
  onFocusPanel,
  onSelectAction,
  onArmConsent,
  onSimulate,
  onProbeWriteBoundary
}) {
  const active = queue.activeQuestion;
  const preview = queue.questions.slice(0, 5);

  function runQuestionAction(question) {
    if (!question) return;
    if (question.action === "suggest-plan") onSuggestPlan();
    if (question.action === "approve-rebuildable") onApproveRebuildable();
    if (question.action === "confirm-permanent-removal") onConfirmPermanentRemoval();
    if (question.action === "allow-admin-routes") onAllowAdminRoutes();
    if (question.action === "focus-review" && question.actionId) onFocusReview(question.actionId);
    if (question.action === "focus-panel" && question.targetPanel) onFocusPanel(question.targetPanel);
    if (question.action === "select-action" && question.actionId) onSelectAction(question.actionId);
    if (question.action === "arm-consent") onArmConsent();
    if (question.action === "simulate") onSimulate();
    if (question.action === "run-real-scan") onRunRealScan();
    if (question.action === "probe-write-boundary") onProbeWriteBoundary();
  }

  return (
    <Card id="agent-question-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CircleGauge className="h-4 w-4" />
              Agent questions
            </CardTitle>
            <CardDescription>{queue.primary}</CardDescription>
          </div>
          <Badge variant={queue.tone}>{queue.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <QueueStat label="Total" value={queue.counts.total} tone={queue.counts.total ? "review" : "safe"} />
          <QueueStat label="Review" value={queue.counts.review} tone={queue.counts.review ? "review" : "safe"} />
          <QueueStat label="Action" value={queue.counts.actionable} tone={queue.counts.actionable ? "advanced" : "safe"} />
        </div>

        {active ? (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="mr-auto min-w-0 text-sm font-medium">{active.title}</span>
              <Badge variant={active.tone}>{active.lane}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{active.detail}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {active.action === "run-scan" ? (
                <>
                  {nativeCapability.available ? (
                    <Button size="sm" onClick={onRunRealScan}>
                      <ScanLine className="h-4 w-4" />
                      Run real scan
                    </Button>
                  ) : null}
                  <Button size="sm" variant={nativeCapability.available ? "outline" : "default"} onClick={onRunScan}>
                    <Play className="h-4 w-4" />
                    Run demo scan
                  </Button>
                </>
              ) : active.action && active.action !== "none" ? (
                <Button size="sm" onClick={() => runQuestionAction(active)}>
                  <CheckCircle2 className="h-4 w-4" />
                  {questionActionLabel(active)}
                </Button>
              ) : null}
              {active.options.slice(0, 2).map((option) => (
                <Badge key={option} variant="outline">{option}</Badge>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            No immediate question is blocking the current guarded workflow.
          </div>
        )}

        <div className="flex flex-col gap-2">
          {preview.length ? (
            preview.map((question) => (
              <div key={question.id} className="grid grid-cols-[18px_1fr_auto] items-start gap-2 rounded-md border bg-card p-3 text-sm">
                <ClipboardList className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="font-medium">{question.prompt}</div>
                  <div className="text-xs text-muted-foreground">{question.detail}</div>
                </div>
                <Badge variant={question.tone}>{question.lane}</Badge>
              </div>
            ))
          ) : (
            <div className="rounded-md border bg-card p-3 text-sm text-muted-foreground">Question queue is clear.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function OpenAIAgentPanel({ integration, config, prompt, advice, context, recommendationBroker, runHistory = [], onPrompt, onAsk, onAction }) {
  const running = advice.status === "running";
  const result = advice.result?.advice || null;
  const recommended = result?.recommendedActions || [];
  const blocked = result?.blockedActions || [];
  const brokerRows = recommendationBroker?.rows || [];
  const brokerByKey = new Map(brokerRows.map((row) => [row.key, row]));
  const lastRun = runHistory[runHistory.length - 1] || null;
  const nativeConfigured = Boolean(context.runtime.openAiAdvisorConfigured);
  const configured = Boolean(config.configured || nativeConfigured);
  const keySource = nativeConfigured ? context.runtime.openAiKeySource : config.keySource;
  const transport = context.runtime.openAiAgentAdvice ? "native-tauri" : "browser-fetch";
  const scopedRealFlag = Boolean(context.runtime.tempCleanupExecutor || context.runtime.downloadsCleanupExecutor || context.runtime.largeFileArchiveExecutor || context.runtime.projectDependencyExecutor || context.runtime.browserCacheExecutor || context.runtime.gradleCacheExecutor || context.runtime.userCacheExecutor || context.runtime.androidCacheExecutor || context.runtime.shaderCacheExecutor || context.runtime.pipCacheExecutor || context.runtime.toolNativePruneExecutors || context.runtime.npmCacheExecutor || context.runtime.pnpmStoreExecutor || context.runtime.recycleBinExecutor);
  const execution = context.execution || {};
  const proofLabel = execution.proofStatus === "waiting-for-execution" ? "waiting" : String(execution.proofStatus || "waiting").replace(/^proof-/, "");
  const rescanLabel = execution.rescanComparisonStatus === "not-run" ? "none" : execution.rescanComparisonStatus || "none";

  return (
    <Card id="openai-agent-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              OpenAI cleanup agent
            </CardTitle>
            <CardDescription>{integration.primary}</CardDescription>
          </div>
          <Badge variant={configured ? "safe" : "review"}>{configured ? "connected" : "set .env"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5 xl:grid-cols-10">
          <QueueStat label="Model" value={config.model} tone={configured ? "safe" : "review"} />
          <QueueStat label="Selected" value={context.selectedActions.length} tone={context.selectedActions.length ? "advanced" : "review"} />
          <QueueStat label="Direct tools" value="blocked" tone="safe" />
          <QueueStat label="Real exec" value={scopedRealFlag ? "scoped flag" : "off"} tone={scopedRealFlag ? "restricted" : "safe"} />
          <QueueStat label="Downloads" value={context.runtime.downloadsCleanupExecutor ? "on" : "off"} tone={context.runtime.downloadsCleanupExecutor ? "restricted" : "review"} />
          <QueueStat label="Archive" value={context.largeFileArchiveTargets?.length || 0} tone={context.largeFileArchiveTargets?.length ? "advanced" : "review"} />
          <QueueStat label="Manual" value={context.manualReviewTargets?.length || 0} tone={context.manualReviewTargets?.length ? "advanced" : "review"} />
          <QueueStat label="Project targets" value={context.reviewedProjectTargets?.length || 0} tone={context.reviewedProjectTargets?.length ? "advanced" : "review"} />
          <QueueStat label="Gradle root" value={context.gradleCacheTargets?.length || 0} tone={context.gradleCacheTargets?.length ? "advanced" : "review"} />
          <QueueStat label=".cache root" value={context.userCacheTargets?.length || 0} tone={context.userCacheTargets?.length ? "advanced" : "review"} />
          <QueueStat label="Android roots" value={context.androidCacheTargets?.length || 0} tone={context.androidCacheTargets?.length ? "advanced" : "review"} />
          <QueueStat label="Shader roots" value={context.shaderCacheTargets?.length || 0} tone={context.shaderCacheTargets?.length ? "advanced" : "review"} />
          <QueueStat label="pip root" value={context.pipCacheTargets?.length || 0} tone={context.pipCacheTargets?.length ? "advanced" : "review"} />
          <QueueStat label="Docker cache" value={context.dockerBuildCacheTargets?.length || 0} tone={context.dockerBuildCacheTargets?.length ? "advanced" : "review"} />
          <QueueStat label="npm root" value={context.npmCacheTargets?.length || 0} tone={context.npmCacheTargets?.length ? "advanced" : "review"} />
          <QueueStat label="pnpm root" value={context.pnpmStoreTargets?.length || 0} tone={context.pnpmStoreTargets?.length ? "advanced" : "review"} />
          <QueueStat label="Recycle" value={context.recycleBinTargets?.length || 0} tone={context.recycleBinTargets?.length ? "restricted" : "review"} />
          <QueueStat label="Cache roots" value={context.browserCacheTargets?.length || 0} tone={context.browserCacheTargets?.length ? "advanced" : "review"} />
          <QueueStat label="Consent" value={execution.consentMatchesPlan ? "current" : "missing"} tone={execution.consentMatchesPlan ? "safe" : "review"} />
          <QueueStat label="Proof" value={proofLabel} tone={execution.proofAllowsNextExecutor ? "safe" : "restricted"} />
          <QueueStat label="Rescan proof" value={rescanLabel} tone={execution.rescanComparisonStatus === "matched" ? "safe" : "review"} />
          <QueueStat label="AI ready" value={recommendationBroker?.counts?.ready || 0} tone={recommendationBroker?.counts?.ready ? "safe" : "review"} />
          <QueueStat label="AI blocked" value={recommendationBroker?.counts?.blocked || 0} tone={recommendationBroker?.counts?.blocked ? "restricted" : "safe"} />
          <QueueStat label="AI runs" value={runHistory.length} tone={runHistory.length ? "safe" : "review"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">AI authority boundary</span>
            <Badge variant="safe">advisory only</Badge>
            <Badge variant="safe">strict JSON</Badge>
            <Badge variant="safe">direct tools blocked</Badge>
            <Badge variant={recommendationBroker?.tone || "review"}>{recommendationBroker?.status || "broker-idle"}</Badge>
            <Badge variant={configured ? "outline" : "review"}>{keySource}</Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
            <span>Provider: OpenAI Responses API</span>
            <span>Transport: {transport}</span>
            <span>Endpoint: {config.endpoint.replace(/^https?:\/\//, "")}</span>
            <span>Reasoning: {config.reasoningEffort || "default"}</span>
            <span>Native scan: {context.runtime.nativeAvailable ? "available" : "not available"}</span>
            <span>Candidate samples: {context.candidateSamples.length}</span>
            <span>Drive inventory rows: {context.driveInventoryRows?.length || 0}</span>
            <span>Custom root rows: {context.customRootRows?.length || 0}</span>
            <span>Current plan: {context.plan?.id || "not locked"}</span>
            <span>Scan fingerprint: {execution.scanFingerprintPresent ? "current" : "missing"}</span>
            <span>Write readiness: {execution.writeReadinessStatus || "unknown"}</span>
            <span>Last advice: {lastRun ? `${lastRun.recommendedActions.length} recommendation(s)` : "none recorded"}</span>
          </div>
        </div>

        <Textarea
          value={prompt}
          onChange={(event) => onPrompt(event.target.value)}
          placeholder="Ask what to clean first, what is risky, or what blocks the real executor."
          rows={3}
        />

        <Button size="sm" onClick={onAsk} disabled={running || !configured}>
          {running ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {running ? "Asking OpenAI" : "Ask OpenAI"}
        </Button>

        {!configured ? (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Add `OPENAI_API_KEY` to `.env`, optionally set `OPENAI_MODEL` and `OPENAI_REASONING_EFFORT`, then restart the dev server.
          </div>
        ) : null}

        {advice.error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{advice.error}</div>
        ) : null}

        {result ? (
          <div className="grid gap-3">
            <div className="rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-auto text-sm font-medium">{result.nextAction}</span>
                <Badge variant="outline">{result.confidence}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{result.summary}</p>
              {advice.result?.requestId ? <p className="mt-2 font-mono text-xs text-muted-foreground">request {advice.result.requestId}</p> : null}
            </div>

            {recommended.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                {recommended.slice(0, 4).map((row) => (
                  <OpenAIRecommendationCard
                    key={getOpenAIAgentRecommendationKey(row)}
                    row={row}
                    brokerRow={brokerByKey.get(getOpenAIAgentRecommendationKey(row))}
                    running={running}
                    onAction={onAction}
                  />
                ))}
              </div>
            ) : null}

            {blocked.length || result.questions?.length || result.warnings?.length ? (
              <div className="grid gap-2 md:grid-cols-3">
                <AdviceList title="Blocked" rows={blocked.map((row) => row.title || row.reason)} />
                <AdviceList title="Questions" rows={result.questions} />
                <AdviceList title="Warnings" rows={result.warnings} />
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function OpenAIRecommendationCard({ row, brokerRow, running, onAction }) {
  const actionLabel = brokerRow?.canAct
    ? brokerRow.buttonLabel || aiRecommendationActionLabel(row)
    : brokerRow?.targetPanel
      ? "Open gate"
      : aiRecommendationActionLabel(row);
  const buttonDisabled = running || !actionLabel || (!brokerRow?.canAct && !brokerRow?.targetPanel);
  const visibleChecks = brokerRow?.checks?.slice(0, 3) || [];

  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto min-w-0 text-sm font-medium">{row.title}</span>
        <Badge variant="advanced">{row.priority}</Badge>
        <Badge variant="outline">{row.actionType}</Badge>
        {row.route ? <Badge variant="outline">{row.route}</Badge> : null}
        {brokerRow ? <Badge variant={brokerRow.tone}>{brokerRow.status}</Badge> : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{row.reason}</p>
      {row.targetId ? <p className="mt-2 font-mono text-xs text-muted-foreground">target {row.targetId}</p> : null}
      {brokerRow?.blockedReason ? <p className="mt-2 text-xs text-muted-foreground">{brokerRow.blockedReason}</p> : null}
      {visibleChecks.length ? (
        <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
          {visibleChecks.map((check) => (
            <span key={check.id}>
              {check.passed ? "ok" : "wait"} - {check.label}
            </span>
          ))}
        </div>
      ) : null}
      {actionLabel ? (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => onAction(row)} disabled={buttonDisabled}>
          <Play className="h-4 w-4" />
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

function aiRecommendationActionLabel(row = {}) {
  switch (row.actionType) {
    case "select-action":
      return "Select action";
    case "review-target":
      return "Open review";
    case "run-temp-executor":
      return "Run temp cleanup";
    case "run-downloads-cleanup-executor":
      return "Move Downloads items";
    case "run-large-file-archive-executor":
      return "Archive large files";
    case "run-project-deps-executor":
      return "Run project cleanup";
    case "run-browser-cache-executor":
      return "Run browser cleanup";
    case "run-gradle-cache-executor":
      return "Run Gradle cleanup";
    case "run-user-cache-executor":
      return "Run .cache cleanup";
    case "run-android-cache-executor":
      return "Run Android cache";
    case "run-shader-cache-executor":
      return "Run shader cache";
    case "run-pip-cache-executor":
      return "Run pip cleanup";
    case "run-docker-build-cache-executor":
      return "Run Docker prune";
    case "run-npm-cache-executor":
      return "Run npm cleanup";
    case "run-pnpm-store-executor":
      return "Run pnpm cleanup";
    case "run-recycle-bin-executor":
      return "Empty Recycle Bin";
    case "rescan":
      return "Run scan";
    case "ask-user":
      return "Open question";
    case "manual-only":
      return "Open manual review";
    default:
      return "";
  }
}

function AdviceList({ title, rows = [] }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="mb-2 text-sm font-medium">{title}</div>
      <div className="flex flex-col gap-2">
        {rows.length ? rows.slice(0, 4).map((row) => <span key={row} className="text-xs text-muted-foreground">{row}</span>) : <span className="text-xs text-muted-foreground">None</span>}
      </div>
    </div>
  );
}

function questionActionLabel(question) {
  if (question.action === "suggest-plan") return "Rebuild plan";
  if (question.action === "approve-rebuildable") return "Approve caches";
  if (question.action === "confirm-permanent-removal") return "Confirm removal";
  if (question.action === "allow-admin-routes") return "Allow admin routes";
  if (question.action === "focus-review") return "Open item review";
  if (question.action === "select-action") return "Select action";
  if (question.action === "focus-panel" && question.targetPanel === "gate-panel") return "Open approvals";
  if (question.action === "focus-panel" && question.targetPanel === "manual-strategy-checklist-panel") return "Open checklist";
  if (question.action === "focus-panel" && question.targetPanel === "rollback-plan-panel") return "Open rollback proof";
  if (question.action === "focus-panel" && question.targetPanel === "validation-evidence-panel") {
    return question.id === "import-fixture-evidence" ? "Open validation import" : "Open validation evidence";
  }
  if (question.action === "focus-panel" && question.targetPanel === "custom-root-triage-panel") return "Open custom triage";
  if (question.action === "focus-panel" && question.targetPanel === "temp-executor-activation-gate-panel") return "Open temp activation";
  if (question.action === "arm-consent") return "Arm dry-run";
  if (question.action === "simulate") return "Simulate";
  if (question.action === "run-real-scan") return "Run real scan";
  if (question.action === "probe-write-boundary") return "Probe boundary";
  return "Apply";
}

function AdvisorBucket({ label, value }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function StorageStrategyPanel({ strategy }) {
  const preview = strategy.options.slice(0, 4);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Storage strategy
            </CardTitle>
            <CardDescription>{strategy.primary}</CardDescription>
          </div>
          <Badge variant={strategy.tone}>{strategy.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <QueueStat label="Gap" value={formatBytes(strategy.gapBytes)} tone={strategy.gapBytes ? "review" : "safe"} />
          <QueueStat label="Options" value={strategy.options.length} tone="advisory" />
          <QueueStat label="Automation" value={strategy.manualOnly ? "locked" : "open"} tone={strategy.manualOnly ? "restricted" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <div className="font-medium">Manual storage strategy</div>
          <div className="mt-1 text-muted-foreground">{strategy.automationBlockedReason}</div>
        </div>

        <div className="space-y-2">
          {preview.map((option) => (
            <div key={option.id} className="rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-auto min-w-0 text-sm font-medium">{option.title}</div>
                <Badge variant="outline">{option.lane}</Badge>
                <Badge variant="restricted">{option.automation}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{option.detail}</p>
              <div className="mt-2 grid gap-2 md:grid-cols-[0.8fr_1fr]">
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Evidence:</span> {option.evidence}
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Guardrails:</span> {option.guardrails.slice(0, 2).join(", ")}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ManualStrategyChecklistPanel({ checklist, onToggle, onReset }) {
  const preview = checklist.checks.slice(0, 8);

  return (
    <Card id="manual-strategy-checklist-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Manual strategy checklist
            </CardTitle>
            <CardDescription>{checklist.primary}</CardDescription>
          </div>
          <Badge variant={checklist.tone}>{checklist.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <QueueStat label="Done" value={`${checklist.counts.done}/${checklist.counts.total}`} tone={checklist.counts.waiting ? "review" : "safe"} />
          <QueueStat label="Waiting" value={checklist.counts.waiting} tone={checklist.counts.waiting ? "advisory" : "safe"} />
          <QueueStat label="Options" value={checklist.optionCount} tone="review" />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Manual-only boundary</span>
            <Button variant="ghost" size="sm" onClick={onReset} disabled={checklist.counts.done === 0}>
              <X className="h-4 w-4" />
              Reset
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{checklist.automationBlockedReason}</p>
        </div>

        <div className="flex flex-col gap-2">
          {preview.length ? (
            preview.map((check) => (
              <div key={check.id} className="grid grid-cols-[24px_1fr_auto] items-start gap-2 rounded-md border bg-card p-3 text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={check.passed}
                  aria-label={`Mark ${check.title}`}
                  onClick={() => onToggle(check.id, !check.passed)}
                />
                <div className="min-w-0">
                  <div className={check.passed ? "font-medium" : "font-medium text-muted-foreground"}>{check.title}</div>
                  <div className="text-xs text-muted-foreground">{check.optionTitle} - {check.detail}</div>
                </div>
                <Badge variant={check.passed ? "safe" : check.required ? "review" : "outline"}>
                  {check.status}
                </Badge>
              </div>
            ))
          ) : (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              Run a scan and review the storage strategy before manual evidence tracking starts.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewWorkbenchPanel({ workbench, focusedId, onFocus }) {
  const rows = workbench.rows.filter((row) => row.status !== "available").slice(0, 7);

  return (
    <Card id="review-workbench-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Review workbench</CardTitle>
            <CardDescription>Evidence, gate, and next decision for non-trivial findings.</CardDescription>
          </div>
          <Badge variant={workbench.needsDecision.length ? "review" : "safe"}>
            {workbench.needsDecision.length ? `${workbench.needsDecision.length} waiting` : "clear"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Decision" value={workbench.needsDecision.length} tone="review" />
          <QueueStat label="Measured" value={workbench.measured.length} tone="safe" />
          <QueueStat label="Protected" value={workbench.protected.length} tone="restricted" />
          <QueueStat label="Unsupported" value={workbench.unsupported.length} tone="advisory" />
        </div>
        <div className="space-y-2">
          {rows.length ? (
            rows.map((row) => (
              <div key={row.id} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="mr-auto min-w-0 text-sm font-medium">{row.title}</div>
                  <Badge variant={row.status === "ready" ? "safe" : row.status === "needs-decision" ? "review" : row.status === "locked" ? "restricted" : "outline"}>
                    {row.status}
                  </Badge>
                  <Badge variant={row.evidence === "demo-estimate" ? "outline" : row.evidence === "unsupported" ? "advisory" : "safe"}>
                    {row.evidence}
                  </Badge>
                  <span className="text-sm font-medium text-muted-foreground">{formatBytes(row.bytes)}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{row.nextStep}</p>
                <div className="mt-2 flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{row.path}</p>
                  {row.gate === "review" || row.status === "needs-decision" ? (
                    <Button type="button" variant={focusedId === row.id ? "default" : "outline"} size="sm" onClick={() => onFocus(row.id)}>
                      <Eye className="h-4 w-4" />
                      Inspect
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">Run a scan or select a review-gated action to populate the workbench.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ItemReviewPanel({ itemReview, selected, onSelectAction, onDecision, onApplyDecisions }) {
  const action = itemReview.action;
  const actionId = action?.id;
  const manualUninstallReview = actionId === "installed-app-footprints";

  function recommendedDecision(item) {
    if (item.recommendation !== "review") return "keep";
    if (actionId === "large-user-files") return "archive";
    if (actionId === "downloads-installers" && /archive|disk image|zip|iso/i.test(item.kind)) return "archive";
    return "remove";
  }

  function useRecommendations() {
    if (!actionId) return;
    onApplyDecisions(
      actionId,
      Object.fromEntries(
        itemReview.items
          .filter((item) => !item.protected)
          .map((item) => [item.id, recommendedDecision(item)])
      )
    );
  }

  function keepAll() {
    if (!actionId) return;
    onApplyDecisions(
      actionId,
      Object.fromEntries(itemReview.items.filter((item) => !item.protected).map((item) => [item.id, "keep"]))
    );
  }

  return (
    <Card id="item-review-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Item review
            </CardTitle>
            <CardDescription>{action ? action.title : "No action selected"} - {itemReview.summary}</CardDescription>
          </div>
          <Badge variant={itemReview.source === "native-readonly" ? "safe" : itemReview.source === "demo-review" ? "review" : "outline"}>
            {itemReview.source}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 md:grid-cols-5">
          <ReviewStat label={manualUninstallReview ? "Manual uninstall" : "Remove"} value={formatBytes(itemReview.removeBytes)} />
          <ReviewStat label={manualUninstallReview ? "Executor bytes" : "Move/archive"} value={formatBytes(manualUninstallReview ? itemReview.selectedBytes : itemReview.manualDispositionBytes || 0)} />
          <ReviewStat label="Keep" value={String(itemReview.keepCount)} />
          <ReviewStat label="Undecided" value={String(itemReview.undecidedCount)} />
        </div>

        {action ? (
          <div className="flex flex-wrap gap-2 rounded-md border bg-muted/30 p-3">
            <div className="min-w-[160px] flex-1">
              <div className="text-sm font-medium">Item decisions</div>
              <p className="text-sm text-muted-foreground">
                {manualUninstallReview
                  ? "Mark uninstall candidates for manual follow-up only. SpaceGuard will not delete Program Files folders or run uninstallers."
                  : action.id === "large-user-files"
                    ? "Move and Archive can enter the reviewed large-file archive executor after the native flag, consent, destination, and path checks pass."
                  : "Only Remove enters executor preview. Move and Archive are manual follow-along decisions."}
              </p>
            </div>
            {!selected ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => onSelectAction(action.id)}>
                <Plus className="h-4 w-4" />
                Add action
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={useRecommendations} disabled={!itemReview.items.length}>
              Use recommendations
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={keepAll} disabled={!itemReview.items.length}>
              Keep all
            </Button>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          {itemReview.items.length ? (
            itemReview.items.map((item) => (
              <div key={item.id} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="mr-auto min-w-0 text-sm font-medium">{item.name}</div>
                  <Badge variant={item.protected ? "restricted" : item.recommendation === "review" ? "review" : "safe"}>
                    {item.protected ? "protected" : item.recommendation}
                  </Badge>
                  <Badge variant={item.decision === "remove" ? "restricted" : item.decision === "keep" ? "safe" : item.decision === "move" || item.decision === "archive" ? "review" : "outline"}>
                    {item.decision}
                  </Badge>
                  <Badge variant="outline">{item.ageDays}d</Badge>
                  <span className="text-sm font-medium text-muted-foreground">{formatBytes(item.bytes)}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{item.reason}</p>
                <ReviewSignalBadges signals={item.signals} />
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{item.path}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={item.decision === "remove" ? "destructive" : "outline"}
                    disabled={item.protected}
                    onClick={() => onDecision(action.id, item.id, "remove")}
                  >
                    {manualUninstallReview ? "Mark uninstall" : "Remove"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={item.decision === "keep" ? "secondary" : "outline"}
                    onClick={() => onDecision(action.id, item.id, "keep")}
                  >
                    Keep
                  </Button>
                  {!manualUninstallReview ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant={item.decision === "move" ? "secondary" : "outline"}
                        disabled={item.protected}
                        onClick={() => onDecision(action.id, item.id, "move")}
                      >
                        Move
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={item.decision === "archive" ? "secondary" : "outline"}
                        disabled={item.protected}
                        onClick={() => onDecision(action.id, item.id, "archive")}
                      >
                        Archive
                      </Button>
                    </>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={item.protected}
                    onClick={() => onDecision(action.id, item.id, "")}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              No item-level candidates are available for this root yet.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function InstalledAppReviewDossierPanel({ dossier, onFocusReview }) {
  const rows = dossier.rows || [];
  return (
    <Card id="installed-app-review-dossier">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              App uninstall review
            </CardTitle>
            <CardDescription>{dossier.nextStep}</CardDescription>
          </div>
          <Badge variant={dossier.status === "manual-uninstall-follow-up" ? "review" : dossier.status === "needs-user-review" ? "advanced" : "outline"}>
            {dossier.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-4">
          <ReviewStat label="Candidates" value={String(dossier.counts.total)} />
          <ReviewStat label="Review" value={String(dossier.counts.review)} />
          <ReviewStat label="Selected" value={formatBytes(dossier.manualSelectedBytes)} />
          <ReviewStat label="Uninstall entry" value={String(dossier.counts.uninstallEntry)} />
          <ReviewStat label="Strong" value={String(dossier.counts.strongReview || 0)} />
        </div>
        <div className="rounded-md border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="restricted">manual only</Badge>
            <Badge variant="outline">no direct deletion</Badge>
            <Badge variant="outline">usage proof not assumed</Badge>
            <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={onFocusReview}>
              <Eye className="h-4 w-4" />
              Review apps
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          {rows.length ? rows.slice(0, 6).map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-auto min-w-0 text-sm font-medium">{row.name}</div>
                <Badge variant={row.status === "manual-uninstall-selected" ? "review" : row.status === "needs-user-confirmation" ? "advanced" : "outline"}>
                  {row.status}
                </Badge>
                <Badge variant={row.uninstallEntry === "present" ? "safe" : "review"}>{row.uninstallEntry}</Badge>
                <Badge variant={row.unusedReviewTier === "strong-review" ? "advanced" : row.unusedReviewTier === "moderate-review" ? "review" : "outline"}>
                  {row.unusedReviewTier}
                </Badge>
                <Badge variant={row.confidence === "medium" ? "review" : "outline"}>{row.confidence}</Badge>
                <span className="text-sm font-medium text-muted-foreground">{formatBytes(row.bytes)}</span>
              </div>
              <div className="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                <div>Usage proof: {row.usageProof}</div>
                <div>Unused review score: {row.unusedReviewScore}</div>
                <div>Registry: {row.registryMatch}</div>
                <div>Age: {row.ageDays}d</div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{row.nextStep}</p>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{row.path}</p>
            </div>
          )) : (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              No installed app footprint candidates are available.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function InstalledAppUninstallWorkOrderPanel({ workOrder, onFocusReview, onExport, onRescan }) {
  const rows = workOrder.rows || [];
  const ready = workOrder.status === "ready-for-manual-uninstall";
  return (
    <Card id="app-uninstall-work-order-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              App uninstall work order
            </CardTitle>
            <CardDescription>{workOrder.nextStep}</CardDescription>
          </div>
          <Badge variant={ready ? "review" : workOrder.status === "needs-user-selection" ? "advanced" : "outline"}>
            {workOrder.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-4">
          <ReviewStat label="Selected apps" value={String(workOrder.counts.selected)} />
          <ReviewStat label="Footprint" value={formatBytes(workOrder.selectedBytes)} />
          <ReviewStat label="Uninstall entry" value={String(workOrder.counts.uninstallEntry)} />
          <ReviewStat label="Usage missing" value={String(workOrder.counts.usageProofMissing)} />
        </div>
        <div className="rounded-md border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="restricted">manual only</Badge>
            <Badge variant="outline">no uninstall strings</Badge>
            <Badge variant="outline">no folder deletion</Badge>
            <Badge variant="outline">rescan required</Badge>
            <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={onFocusReview}>
              <Eye className="h-4 w-4" />
              Review apps
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onExport} disabled={!rows.length}>
              <Download className="h-4 w-4" />
              Export work order
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onRescan}>
              <RefreshCcw className="h-4 w-4" />
              Run rescan
            </Button>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-5">
          {(workOrder.steps || []).map((step) => (
            <div key={step.id} className="rounded-md border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">{step.label}</div>
                <Badge variant={step.status === "complete" ? "safe" : step.status === "ready" ? "review" : step.status === "pending" ? "outline" : "restricted"}>
                  {step.status}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{step.detail}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {rows.length ? rows.map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-auto min-w-0 text-sm font-medium">{row.name}</div>
                <Badge variant={row.uninstallEntry === "present" ? "safe" : "review"}>{row.uninstallEntry}</Badge>
                <Badge variant={row.usageProof === "not proven" ? "restricted" : "safe"}>{row.usageProof}</Badge>
                <Badge variant={row.unusedReviewTier === "strong-review" ? "advanced" : row.unusedReviewTier === "moderate-review" ? "review" : "outline"}>
                  {row.unusedReviewScore}
                </Badge>
                <span className="text-sm font-medium text-muted-foreground">{formatBytes(row.bytes)}</span>
              </div>
              <div className="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                <div>Publisher: {row.publisher || "unknown"}</div>
                <div>Version: {row.version || "unknown"}</div>
                <div>Install date: {row.installDate || "unknown"}</div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{row.reason}</p>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{row.path}</p>
            </div>
          )) : (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              No app is selected for manual uninstall follow-up. Mark a recognized unused app in item review to create a work order.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function WslCompactionWorkOrderPanel({ workOrder, onFocusGate, onExport, onRescan }) {
  const rows = workOrder.rows || [];
  const ready = workOrder.status === "ready-for-manual-compaction";
  return (
    <Card id="wsl-compaction-work-order-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              WSL compaction work order
            </CardTitle>
            <CardDescription>{workOrder.nextStep}</CardDescription>
          </div>
          <Badge variant={ready ? "review" : workOrder.status === "needs-typed-ack" ? "advanced" : "outline"}>
            {workOrder.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-4">
          <ReviewStat label="VHDX targets" value={String(workOrder.counts.targets)} />
          <ReviewStat label="Measured size" value={formatBytes(workOrder.totalVhdxBytes)} />
          <ReviewStat label="Typed ack" value={workOrder.typedConfirmed ? "yes" : "no"} />
          <ReviewStat label="Can execute" value="no" />
        </div>
        <div className="rounded-md border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="restricted">manual only</Badge>
            <Badge variant="outline">no wsl.exe</Badge>
            <Badge variant="outline">no Optimize-VHD</Badge>
            <Badge variant="outline">backup first</Badge>
            <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={onFocusGate}>
              <Lock className="h-4 w-4" />
              Open approval
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onExport} disabled={!rows.length}>
              <Download className="h-4 w-4" />
              Export work order
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onRescan}>
              <RefreshCcw className="h-4 w-4" />
              Run rescan
            </Button>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-7">
          {(workOrder.steps || []).map((step) => (
            <div key={step.id} className="rounded-md border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">{step.label}</div>
                <Badge variant={step.status === "complete" ? "safe" : step.status === "ready" ? "review" : step.status === "pending" ? "outline" : "restricted"}>
                  {step.status}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{step.detail}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {rows.length ? rows.map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-auto min-w-0 text-sm font-medium">{row.title}</div>
                <Badge variant={row.status === "measured" ? "safe" : "review"}>{row.status}</Badge>
                <span className="text-sm font-medium text-muted-foreground">{formatBytes(row.bytes)}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{row.note}</p>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{row.path}</p>
            </div>
          )) : (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              No WSL virtual disk target is available. Run a native read-only scan to discover ext4.vhdx files.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewStat({ label, value }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function ReadinessPill({ icon: Icon, label, value, passed }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Icon className={passed ? "h-4 w-4 text-emerald-600" : "h-4 w-4 text-amber-600"} />
        {passed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
      </div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function ProtectedPathsPanel({ protectedPaths, protectedInput, setProtectedInput, addProtectedPath, removeProtectedPath }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Protected paths
        </CardTitle>
        <CardDescription>Anything matching these roots is removed from executable plans.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            addProtectedPath(protectedInput);
          }}
        >
          <input
            className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
            value={protectedInput}
            placeholder="C:\\Users\\demo\\Code\\client-work"
            onChange={(event) => setProtectedInput(event.target.value)}
          />
          <Button type="submit" size="icon" aria-label="Add protected path">
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        <div className="flex flex-wrap gap-2">
          {protectedPaths.length === 0 ? (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">No user-protected paths yet.</div>
          ) : (
            protectedPaths.map((path) => (
              <Badge key={path} variant="outline" className="gap-2 py-1">
                <span className="max-w-[260px] truncate font-mono">{path}</span>
                <button type="button" aria-label={`Remove ${path}`} onClick={() => removeProtectedPath(path)}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </Badge>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ActionRow({ action, selected, scanned, protectedByUser, intakePolicy, onToggle, onProtect }) {
  const intakeBlocked = actionRequiresAdminConsent(action) && intakePolicy?.adminSensitiveBlocked;
  const selectable = selectableAction(action, protectedByUser ? [action.path] : [], intakePolicy);
  const disabled = !scanned || !selectable;
  const power = getActionTaskPower(action);
  return (
    <div
      className={`grid gap-3 rounded-lg border bg-card p-4 shadow-sm transition-colors lg:grid-cols-[24px_minmax(0,1fr)_96px] ${
        selected ? "border-blue-300 bg-blue-50/40" : ""
      } ${!selectable ? "bg-muted/60" : ""}`}
    >
      <Checkbox checked={selected} disabled={disabled} onClick={onToggle} className="mt-1" />
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="mr-auto text-sm font-semibold">{action.title}</h3>
          <Badge variant={action.risk}>{action.risk}</Badge>
          <Badge variant={action.risk}>{gates[action.gate].label}</Badge>
          <Badge variant="outline">{power.label}</Badge>
          {action.scanSource ? <Badge variant={action.scanStatus === "missing" ? "outline" : "safe"}>{action.scanStatus}</Badge> : null}
          {protectedByUser ? <Badge variant="restricted">protected</Badge> : null}
          {intakeBlocked ? <Badge variant="review">intake gated</Badge> : null}
        </div>
        <p className="mb-3 truncate font-mono text-xs text-muted-foreground">{action.path}</p>
        <div className="grid gap-1 text-sm text-muted-foreground">
          <p><span className="font-medium text-foreground">Method:</span> {action.method}</p>
          <p><span className="font-medium text-foreground">Consequence:</span> {action.consequence}</p>
        </div>
      </div>
      <div className="text-left lg:text-right">
        <div className="text-xl font-semibold">{formatBytes(action.bytes)}</div>
        <div className="mb-2 text-xs text-muted-foreground">
          {protectedByUser ? "protected" : intakeBlocked ? "intake gated" : action.scanSource ? "real data" : selectable ? (selected ? "planned" : "available") : "locked"}
        </div>
        {!protectedByUser && action.gate !== "blocked" && action.gate !== "advisory" ? (
          <Button type="button" variant="outline" size="sm" onClick={onProtect}>
            Protect
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function GatePanel({ actionList, selectedIds, approvals, setApprovals, scanned, readiness, protectedPaths, itemReviewsByAction, intakePolicy }) {
  const selected = actionList.filter((action) => selectedIds.has(action.id));
  const selectedReview = selected.filter((action) => action.gate === "review");
  const selectedTyped = selected.filter((action) => action.gate === "typed");
  const hasGroupConfirm = selected.some((action) => action.gate === "groupConfirm");
  const hasPermanentConfirm = selected.some((action) => action.gate === "permanentConfirm");
  const blockedCount = actionList.filter((action) => action.gate === "blocked").length;
  const protectedCount = actionList.filter((action) => isActionProtected(action, protectedPaths)).length;
  const intakeBlockedCount = actionList.filter((action) => actionRequiresAdminConsent(action) && intakePolicy?.adminSensitiveBlocked).length;

  return (
    <Card id="gate-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          Agent gates
          <Badge variant={readiness.ready ? "safe" : "review"}>{readiness.ready ? "Ready" : "Gated"}</Badge>
        </CardTitle>
        <CardDescription>Approvals are visible and explicit before execution.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!scanned ? <GateNote title="Scan locked" detail="Run a scan before approvals are available." /> : null}

        {hasGroupConfirm ? (
          <GateCheck
            title="Approve rebuildable caches"
            detail="Gradle, npm, pnpm, Docker build cache, Windows.old, and launcher caches may be recreated later."
            checked={approvals.groupConfirm}
            onChange={(checked) => setApprovals((current) => ({ ...current, groupConfirm: checked }))}
          />
        ) : null}

        {hasPermanentConfirm ? (
          <GateCheck
            title="Confirm permanent removal"
            detail="Recycle Bin emptying permanently removes files already marked for deletion. It is not treated as cache cleanup."
            checked={Boolean(approvals.permanentConfirm)}
            onChange={(checked) => setApprovals((current) => ({ ...current, permanentConfirm: checked }))}
          />
        ) : null}

        {selectedReview.map((action) => {
          const review = itemReviewsByAction[action.id];
          const ready = review?.undecidedCount === 0;
          return (
            <div key={action.id} className="rounded-md border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">{action.title}</div>
                <Badge variant={ready ? "safe" : "review"}>{ready ? "items ready" : "item review"}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {ready
                  ? `${review.removeCount} Remove item(s), ${review.moveCount || 0} Move, ${review.archiveCount || 0} Archive; ${formatBytes(review.removeBytes)} enters executor preview.`
                  : "Mark each candidate as Remove, Move, Archive, or Keep in the Item review panel."}
              </p>
            </div>
          );
        })}

        {selectedTyped.map((action) => (
          <div key={action.id} className="rounded-md border bg-muted/40 p-3">
            <div className="text-sm font-medium">{action.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">Type {action.typedPhrase} to unlock this dry-run action.</p>
            <input
              className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={approvals.typed[action.id] || ""}
              placeholder={action.typedPhrase}
              onChange={(event) =>
                setApprovals((current) => ({ ...current, typed: { ...current.typed, [action.id]: event.target.value.trim() } }))
              }
            />
          </div>
        ))}

        {protectedCount > 0 ? <GateNote title="Protected by user" detail={`${protectedCount} action(s) match protected paths and have been removed from executable plans.`} /> : null}
        {intakeBlockedCount > 0 ? <GateNote title="Intake admin boundary" detail={`${intakeBlockedCount} admin/system route(s) stay out of selected plans until the user allows them.`} /> : null}
        <GateNote title="Locked by policy" detail={`${blockedCount} zones are visible but cannot execute: Docker volumes, browser identity data, pagefile changes, and destructive system areas.`} />
      </CardContent>
    </Card>
  );
}

function RiskBudgetPanel({ riskBudget }) {
  const previewRows = riskBudget.overrunRows.length || riskBudget.blockedRows.length
    ? [...riskBudget.overrunRows, ...riskBudget.blockedRows].slice(0, 5)
    : riskBudget.rows.slice(0, 5);

  return (
    <Card id="risk-budget-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Risk budget
            </CardTitle>
            <CardDescription>{riskBudget.primary}</CardDescription>
          </div>
          <Badge variant={riskBudget.tone}>{riskBudget.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Allowed" value={riskBudget.counts.allowed} tone={riskBudget.counts.allowed ? "safe" : "review"} />
          <QueueStat label="Over" value={riskBudget.counts.overrun} tone={riskBudget.counts.overrun ? "restricted" : "safe"} />
          <QueueStat label="Blocked" value={riskBudget.counts.blocked} tone={riskBudget.counts.blocked ? "restricted" : "safe"} />
          <QueueStat label="Real run" value={riskBudget.counts.realRun} tone={riskBudget.counts.realRun ? "restricted" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Mode ceiling</span>
            <Badge variant="outline">{riskBudget.mode}</Badge>
            <Badge variant={riskBudget.status === "within-risk-budget" ? "safe" : "review"}>{riskBudget.ceiling.label}</Badge>
            <Badge variant={riskBudget.realRunAllowed ? "restricted" : "safe"}>{riskBudget.realRunAllowed ? "real run open" : "dry-run only"}</Badge>
          </div>
          <div className="flex flex-col gap-2">
            {riskBudget.steps.slice(0, 3).map((step) => (
              <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {previewRows.length ? (
            previewRows.map((row) => (
              <div key={row.id} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="mr-auto min-w-0 text-sm font-medium">{row.title}</div>
                  <Badge variant={row.tone}>{row.status}</Badge>
                  <Badge variant="outline">{row.risk}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{row.detail}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant={row.canDryRun ? "safe" : "restricted"}>{row.canDryRun ? "dry-run allowed" : "dry-run blocked"}</Badge>
                  <Badge variant={row.canRealRun ? "restricted" : "safe"}>{row.canRealRun ? "real run" : "no real run"}</Badge>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">Select cleanup actions to evaluate risk tolerance.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PlanReviewPanel({ review }) {
  const previewRows = review.rows.filter((row) => row.status !== "available").slice(0, 8);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Plan review queue</CardTitle>
        <CardDescription>Decision state before any simulated execution.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Ready" value={review.approved.length} tone="safe" />
          <QueueStat label="Pending" value={review.pending.length} tone="review" />
          <QueueStat label="Protected" value={review.protected.length} tone="restricted" />
          <QueueStat label="Blocked" value={review.blocked.length} tone="restricted" />
        </div>

        <div className="space-y-2">
          {previewRows.length === 0 ? (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">Run a scan and select actions to populate the queue.</div>
          ) : (
            previewRows.map((row) => (
              <div key={row.id} className="rounded-md border bg-card p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{row.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{row.reason}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={row.status === "approved" ? "safe" : row.status === "pending" ? "review" : "restricted"}>
                      {row.status}
                    </Badge>
                    <span className="text-sm font-medium text-muted-foreground">{formatBytes(row.bytes)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DecisionLogPanel({ entries }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Decision log</CardTitle>
        <CardDescription>Current agent decisions that control plan execution.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-md border bg-card p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">{entry.title}</div>
              <Badge variant={entry.tone}>{entry.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{entry.detail}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function UserDecisionReceiptPanel({ receipt }) {
  const previewRows = receipt.unsafeRows.length
    ? receipt.unsafeRows
    : receipt.waitingRows.length
      ? receipt.waitingRows.slice(0, 6)
      : receipt.rows.slice(0, 6);

  return (
    <Card id="user-decision-receipt-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              User decision receipt
            </CardTitle>
            <CardDescription>{receipt.primary}</CardDescription>
          </div>
          <Badge variant={receipt.tone}>{receipt.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Accepted" value={receipt.counts.accepted} tone={receipt.counts.accepted ? "safe" : "review"} />
          <QueueStat label="Waiting" value={receipt.counts.waiting} tone={receipt.counts.waiting ? "review" : "safe"} />
          <QueueStat label="Unsafe" value={receipt.counts.unsafe} tone={receipt.counts.unsafe ? "restricted" : "safe"} />
          <QueueStat label="Real run" value={receipt.counts.realRun} tone={receipt.counts.realRun ? "restricted" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Decision boundary</span>
            <Badge variant={receipt.realRunAllowed ? "restricted" : "safe"}>{receipt.realRunAllowed ? "real run open" : "dry-run only"}</Badge>
            <Badge variant={receipt.destructiveCommands ? "restricted" : "safe"}>{receipt.destructiveCommands ? "destructive visible" : "no destructive commands"}</Badge>
            <Badge variant="outline">{receipt.planId || "no-plan"}</Badge>
          </div>
          <div className="flex flex-col gap-2">
            {receipt.steps.slice(0, 3).map((step) => (
              <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {previewRows.map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-auto min-w-0 text-sm font-medium">{row.label}</div>
                <Badge variant={row.tone}>{row.status}</Badge>
                <Badge variant="outline">{row.lane}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{row.detail}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant={row.canRealRun ? "restricted" : "safe"}>{row.canRealRun ? "real run" : "no real run"}</Badge>
                {row.count ? <Badge variant="outline">{row.count} recorded</Badge> : null}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function QueueStat({ label, value, tone }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2 text-center">
      <div className="text-lg font-semibold">{value}</div>
      <Badge variant={tone} className="mt-1 text-[10px]">
        {label}
      </Badge>
    </div>
  );
}

function GateCheck({ title, detail, checked, onChange }) {
  return (
    <div className="flex gap-3 rounded-md border bg-card p-3">
      <Checkbox checked={checked} onClick={() => onChange(!checked)} />
      <div>
        <div className="text-sm font-medium">{title}</div>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function GateNote({ title, detail }) {
  return (
    <div className="rounded-md border bg-muted/40 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        {title}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function TracePanel({ activeStage }) {
  const activeIndex = agentStages.findIndex((stage) => stage.id === activeStage);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Agent trace</CardTitle>
        <CardDescription>{agentStages[activeIndex]?.label || "Idle"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {agentStages.map((stage, index) => (
          <div key={stage.id} className="grid grid-cols-[22px_1fr] gap-3">
            <div className={`mt-0.5 grid h-5 w-5 place-items-center rounded-full ${index <= activeIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {index < activeIndex ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="text-[10px]">{index + 1}</span>}
            </div>
            <div>
              <div className="text-sm font-medium">{stage.label}</div>
              <p className="text-sm text-muted-foreground">{stage.rule}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ExecutorPolicyPanel({ executorPlan, executorReadiness, nativeExecutorDryRun, scopeEvidenceExport, canExportScopeEvidence, onExportScopeEvidence }) {
  const previewRows = executorPlan.rows.slice(0, 5);
  const nativeDryRunEntries = nativeExecutorDryRun.result?.entries || [];
  const scopeCounts = scopeEvidenceExport?.result?.counts || null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Executor policy
          <Badge variant={executorReadiness.ready ? "safe" : "review"}>{executorReadiness.ready ? "Dry-run ready" : "Not ready"}</Badge>
        </CardTitle>
        <CardDescription>Real deletion is disabled. Selected actions are classified before simulation.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <QueueStat label="Dry-run" value={executorPlan.dryRunCount} tone="safe" />
          <QueueStat label="Future" value={executorPlan.futureCount} tone="review" />
          <QueueStat label="Blocked" value={executorPlan.blockedCount} tone="restricted" />
        </div>

        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">Native dry-run</span>
            <Badge variant={nativeExecutorDryRun.status === "complete" ? "safe" : nativeExecutorDryRun.status === "error" ? "restricted" : "outline"}>
              {nativeExecutorDryRun.status}
            </Badge>
          </div>
          <p className="mt-1 text-muted-foreground">
            {nativeExecutorDryRun.result?.warnings?.[0] || nativeExecutorDryRun.error || "Browser simulation is used unless the Tauri bridge is available."}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            onClick={onExportScopeEvidence}
            disabled={!canExportScopeEvidence || scopeEvidenceExport?.status === "running"}
          >
            <Download className="h-4 w-4" />
            Export scope evidence
          </Button>
          <div className="mt-2 rounded-md border bg-card p-2 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">Scope evidence export</span>
              <Badge
                variant={
                  scopeEvidenceExport?.status === "complete" && scopeEvidenceExport?.result?.passed
                    ? "safe"
                    : scopeEvidenceExport?.status === "error" || scopeEvidenceExport?.status === "unavailable" || scopeEvidenceExport?.result?.passed === false
                      ? "restricted"
                      : "outline"
                }
              >
                {scopeEvidenceExport?.status || "idle"}
              </Badge>
              {scopeEvidenceExport?.result ? (
                <Badge variant={scopeEvidenceExport.result.passed ? "safe" : "restricted"}>
                  {scopeEvidenceExport.result.passed ? "passed" : "failed"}
                </Badge>
              ) : null}
            </div>
            {scopeEvidenceExport?.error ? <div className="mt-1">{scopeEvidenceExport.error}</div> : null}
            {scopeCounts ? (
              <div className="mt-2 grid gap-1 sm:grid-cols-3">
                <span>Allowed: {scopeCounts.allowed}</span>
                <span>Rejected: {scopeCounts.rejected}</span>
                <span>Rejected samples: {scopeCounts.rejectedWithSamples}</span>
              </div>
            ) : (
              <div className="mt-1">Runs a metadata-only scope probe for fixture validation.</div>
            )}
          </div>
        </div>

        {nativeDryRunEntries.length ? (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">Candidate manifest</span>
              <Badge variant="outline">metadata only</Badge>
            </div>
            <div className="flex flex-col gap-2">
              {nativeDryRunEntries.slice(0, 3).map((entry) => (
                <div key={`${entry.id}-${entry.route}`} className="rounded-md border bg-card p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-auto min-w-0 text-sm font-medium">{entry.title}</span>
                    <Badge variant={entry.rejectCode ? "restricted" : entry.targetScopeStatus === "target-allowed" ? "safe" : "outline"}>
                      {entry.targetScopeStatus || "scope unreported"}
                    </Badge>
                    <Badge variant="outline">{entry.candidateCount || 0} candidates</Badge>
                    <Badge variant={entry.skippedCount ? "review" : "safe"}>{entry.skippedCount || 0} skipped</Badge>
                  </div>
                  <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{entry.targetPath || "no target path"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {entry.rejectCode
                      ? `Target scope rejected before sampling: ${entry.rejectCode}.`
                      : `Sampled ${formatBytes(entry.candidateBytes || 0)}. ${entry.candidates?.[0]?.name || "No file samples returned."}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 text-sm font-medium">Executor readiness</div>
          <div className="space-y-2">
            {executorReadiness.items.map((item) => (
              <div key={item.id} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <CheckCircle2 className={`mt-0.5 h-4 w-4 ${item.passed ? "text-emerald-600" : "text-muted-foreground"}`} />
                <div>
                  <div className={item.passed ? "font-medium" : "font-medium text-muted-foreground"}>{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {previewRows.length ? (
            previewRows.map((row) => (
              <div key={row.id} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="mr-auto min-w-0 text-sm font-medium">{row.title}</div>
                  <Badge variant={row.status === "blocked" ? "restricted" : row.status === "dry-run-only" ? "review" : "safe"}>
                    {row.status}
                  </Badge>
                  <Badge variant="outline">{row.lane}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{row.label} via {row.route}.</p>
                <p className="mt-1 text-xs text-muted-foreground">{row.realBlockedReason || row.verification}</p>
              </div>
            ))
          ) : (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">Select actions to build an executor plan.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CandidateSafetyManifestPanel({ manifest }) {
  const previewRows = manifest.rows.slice(0, 4);

  return (
    <Card id="candidate-safety-manifest-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Candidate safety manifest
          <Badge variant={manifest.tone}>{manifest.status}</Badge>
        </CardTitle>
        <CardDescription>{manifest.primary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <QueueStat label="Samples" value={manifest.counts.candidates} tone={manifest.counts.candidates ? "safe" : "review"} />
          <QueueStat label="Skipped" value={manifest.counts.skipped} tone={manifest.counts.skipped ? "review" : "safe"} />
          <QueueStat label="Leaks" value={manifest.counts.leaks} tone={manifest.counts.leaks ? "restricted" : "safe"} />
          <QueueStat label="Real run" value={manifest.counts.realRun} tone="safe" />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Candidate boundary</span>
            <Badge variant={manifest.readyForImplementationEvidence ? "safe" : "review"}>
              {manifest.readyForImplementationEvidence ? "implementation evidence" : "evidence waiting"}
            </Badge>
            <Badge variant={manifest.pathLevelEvidence ? "review" : "safe"}>{manifest.pathLevelEvidence ? "path-level" : "redacted"}</Badge>
            <Badge variant="safe">no executor authority</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Candidate samples prove target filtering and skip behavior for future executor work. They do not count recovered space and cannot unlock mutation.
          </p>
        </div>

        {previewRows.length ? (
          <div className="flex flex-col gap-2">
            {previewRows.map((row) => (
              <div key={`${row.id}-${row.route}`} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto min-w-0 text-sm font-medium">{row.title}</span>
                  <Badge variant={row.tone}>{row.status}</Badge>
                  <Badge variant="outline">{row.candidateCount} candidates</Badge>
                  <Badge variant={row.skippedCount ? "review" : "safe"}>{row.skippedCount} skipped</Badge>
                </div>
                <div className="mt-2 truncate font-mono text-xs text-muted-foreground">{row.targetPath || "no target path"}</div>
                <p className="mt-2 text-xs text-muted-foreground">{row.detail}</p>
                {row.sampleNames.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {row.sampleNames.map((name) => (
                      <Badge key={name} variant="outline">{name}</Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">Run native dry-run simulation to capture candidate samples.</div>
        )}

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 text-sm font-medium">Next candidate steps</div>
          <div className="flex flex-col gap-2">
            {manifest.steps.slice(0, 4).map((step) => (
              <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ExecutorManifestPanel({ manifest }) {
  const previewRoutes = manifest.selectedRoutes.length ? manifest.selectedRoutes.slice(0, 5) : manifest.shippableRoutes.slice(0, 5);
  const statusVariant = (status) => {
    if (status === "blocked" || status === "no-dry-run") return "restricted";
    if (status === "validated-locked" || status === "real-enabled") return "safe";
    return "review";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Executor manifest
          <Badge variant={manifest.counts.realEnabled ? "safe" : "restricted"}>
            {manifest.counts.realEnabled ? "real enabled" : "real locked"}
          </Badge>
        </CardTitle>
        <CardDescription>Per-route requirements for turning dry-run lanes into validated Windows executors.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <QueueStat label="Routes" value={manifest.counts.routes} tone="review" />
          <QueueStat label="First safe" value={manifest.counts.firstSafeRoutes} tone="safe" />
          <QueueStat label="Waiting" value={manifest.counts.needsValidation} tone="review" />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 text-sm font-medium">Manifest next steps</div>
          <div className="flex flex-col gap-2">
            {manifest.nextSteps.slice(0, 3).map((step) => (
              <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <ClipboardList className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {previewRoutes.map((route) => (
            <div key={route.route} className="rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-auto min-w-0 text-sm font-medium">{route.title}</div>
                <Badge variant={statusVariant(route.status)}>{route.status}</Badge>
                <Badge variant="outline">{route.phase}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{route.implementation}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{route.requiredChecks.length} checks</span>
                <span>{route.fixtureIds.length} fixtures</span>
                <span>{route.selectedCount} selected</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ExecutorSmokeRunPacketPanel({ packet, onExport }) {
  const previewRows = packet.rows.length ? packet.rows.slice(0, 4) : [];

  return (
    <Card id="executor-smoke-run-packet-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Executor smoke-run packet
          <Badge variant={packet.tone}>{packet.status}</Badge>
        </CardTitle>
        <CardDescription>{packet.primary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-5">
          <QueueStat label="Routes" value={packet.counts.routes} tone={packet.counts.routes ? "review" : "restricted"} />
          <QueueStat label="Ready" value={packet.counts.ready} tone={packet.counts.ready ? "safe" : "review"} />
          <QueueStat label="Active" value={packet.activeRoute ? packet.activeRoute.split("-")[0] : "none"} tone={packet.activeRoute ? "safe" : "review"} />
          <QueueStat label="Queued" value={packet.counts.queuedReady || 0} tone={packet.counts.queuedReady ? "review" : "safe"} />
          <QueueStat label="Proof" value={packet.proofStatus === "waiting-for-execution" ? "clear" : packet.proofStatus.replace(/^proof-/, "")} tone={packet.proofAllowsNextExecutor ? "safe" : "restricted"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Run boundary</span>
            <Badge variant={packet.realRunEnabled ? "restricted" : "review"}>{packet.realRunEnabled ? "scoped write visible" : "write off"}</Badge>
            <Badge variant={packet.validationReady ? "safe" : "outline"}>{packet.validationReady ? "validation ready" : "smoke only"}</Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
            <span>Plan: {packet.planId || "missing"}</span>
            <span>Scan: {packet.scanFingerprint ? "current" : "missing"}</span>
            <span>Consent: {packet.consentPlanId || "missing"}</span>
            <span>Rescan comparison: {packet.rescanComparisonStatus}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {previewRows.length ? (
            previewRows.map((row) => (
              <div key={`${row.route}-${row.id}`} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="mr-auto min-w-0 text-sm font-medium">{row.title}</div>
                  <Badge variant={row.tone}>{row.status}</Badge>
                  <Badge variant="outline">{row.route}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{row.targetEvidence}</p>
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                  <span>Flag: {row.envVar} {row.flagEnabled ? "enabled" : "off"}</span>
                  <span>Request: {row.requestMode}</span>
                  {row.blockedReason ? <span>Blocker: {row.blockedReason}</span> : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {row.checks.slice(0, 5).map((check) => (
                    <Badge key={check.id} variant={check.passed ? "safe" : "review"}>{check.label}</Badge>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              Select a scoped executor route such as npm cache, Gradle cache, browser cache, temp cleanup, Downloads review, or Recycle Bin before exporting a smoke packet.
            </div>
          )}
        </div>

        <Button type="button" variant="outline" size="sm" onClick={onExport}>
          <Download className="h-4 w-4" />
          Export smoke packet
        </Button>
      </CardContent>
    </Card>
  );
}

function ReleaseGatePanel({ releaseGate, runtimeCapabilities }) {
  const previewRows = releaseGate.missingRows.slice(0, 5);
  const vmRows = releaseGate.vmRows.slice(0, 3);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Release gate
          <Badge variant={releaseGate.readyForRealRun ? "safe" : "restricted"}>
            {releaseGate.readyForRealRun ? "Real run ready" : "Real run locked"}
          </Badge>
        </CardTitle>
        <CardDescription>{releaseGate.blockedReason || "All release gates are satisfied."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <QueueStat label="Passed" value={releaseGate.passedCount} tone="safe" />
          <QueueStat label="Checks" value={releaseGate.totalCount} tone="review" />
          <QueueStat label="Routes" value={releaseGate.candidateRoutes.length} tone="review" />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Runtime capability</span>
            <Badge variant={runtimeCapabilities.result.realRunEnabled ? "safe" : "restricted"}>
              {runtimeCapabilities.result.realRunEnabled ? "enabled" : "disabled"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {runtimeCapabilities.error || runtimeCapabilities.result.reason}
          </p>
          <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <span>Platform: {runtimeCapabilities.result.platform}</span>
            <span>Native: {runtimeCapabilities.result.available ? "available" : "not available"}</span>
            <span>Elevated: {runtimeCapabilities.result.elevated ? "yes" : "no"}</span>
            <span>Scan command: {runtimeCapabilities.result.scanKnownRoots ? "yes" : "no"}</span>
            <span>Dry-run command: {runtimeCapabilities.result.simulateCleanupPlan ? "yes" : "no"}</span>
            <span>Write command: {runtimeCapabilities.result.executeCleanupPlan ? "rejecting stub" : "no"}</span>
          </div>
        </div>

        <div className="space-y-2">
          {previewRows.map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 text-sm font-medium">{row.label}</div>
                <Badge variant={row.status === "passed" ? "safe" : row.status === "blocked-by-flag" ? "restricted" : "review"}>
                  {row.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{row.evidence}</p>
            </div>
          ))}
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 text-sm font-medium">Disposable VM matrix</div>
          <div className="space-y-2">
            {vmRows.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{row.label}</span>
                <span className="shrink-0 text-muted-foreground">{row.passedCount}/{row.totalCount}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WriteReadinessPanel({ readiness }) {
  const previewRows = readiness.blockedItems.length ? readiness.blockedItems.slice(0, 5) : readiness.items.slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Write readiness
          <Badge variant={readiness.tone}>{readiness.readyForRealExecution ? "ready" : "locked"}</Badge>
        </CardTitle>
        <CardDescription>{readiness.primary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <QueueStat label="Passed" value={`${readiness.counts.passed}/${readiness.counts.total}`} tone={readiness.readyForRealExecution ? "safe" : "review"} />
          <QueueStat label="Real routes" value={readiness.counts.realRoutes} tone={readiness.counts.realRoutes ? "safe" : "restricted"} />
          <QueueStat label="Blocked" value={readiness.counts.blocked} tone={readiness.counts.blocked ? "restricted" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Final write gate</span>
            <Badge variant={readiness.realRunEnabled ? "review" : "safe"}>
              {readiness.realRunEnabled ? "write visible" : "write hidden"}
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            {readiness.steps.slice(0, 3).map((step) => (
              <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {previewRows.map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 text-sm font-medium">{row.label}</div>
                <Badge variant={row.passed ? "safe" : "restricted"}>{row.passed ? "passed" : "blocked"}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{row.detail}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RealExecutorCapsulePanel({ capsule }) {
  const previewBlockers = capsule.blockers.slice(0, 4);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Real executor capsule
          <Badge variant={capsule.tone}>{capsule.status}</Badge>
        </CardTitle>
        <CardDescription>{capsule.primary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <QueueStat label="Selected" value={capsule.counts.selectedRows} tone="review" />
          <QueueStat label="Missing" value={capsule.counts.missingChecks} tone={capsule.counts.missingChecks ? "restricted" : "safe"} />
          <QueueStat label="Blockers" value={capsule.counts.blockers} tone={capsule.counts.blockers ? "restricted" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">{capsule.route?.title || "No route selected"}</span>
            <Badge variant={capsule.destructiveActionAvailable ? "restricted" : "safe"}>
              {capsule.destructiveActionAvailable ? "destructive visible" : "destructive hidden"}
            </Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <span>Route: {capsule.route?.id || "none"}</span>
            <span>Phase: {capsule.route?.phase || "none"}</span>
            <span>Code path: {capsule.codePath.command} / {capsule.codePath.status}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {previewBlockers.length ? (
            previewBlockers.map((blocker) => (
              <div key={blocker.id} className="rounded-md border bg-card p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 text-sm font-medium">{blocker.label}</div>
                  <Badge variant="restricted">blocked</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{blocker.detail}</p>
              </div>
            ))
          ) : (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">No capsule blockers are listed, but destructive execution remains hidden until implementation is explicit.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FirstSafeExecutorContractPanel({ contract }) {
  const blocked = contract.blockedItems.slice(0, 4);
  const preview = contract.requestPreview;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          First-safe executor contract
          <Badge variant={contract.tone}>{contract.status}</Badge>
        </CardTitle>
        <CardDescription>{contract.primary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <QueueStat label="Actions" value={contract.counts.actions} tone="review" />
          <QueueStat label="Expected" value={formatBytes(contract.counts.expectedBytes)} tone="safe" />
          <QueueStat label="Blocked" value={contract.counts.blocked} tone={contract.counts.blocked ? "review" : "safe"} />
          <QueueStat label="Targets" value={contract.counts.targetBlocked ? `${contract.counts.targetBlocked} blocked` : contract.counts.targetRows} tone={contract.counts.targetBlocked ? "restricted" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">{contract.route?.title || "No first-safe route"}</span>
            <Badge variant={contract.destructiveActionAvailable ? "restricted" : "safe"}>
              {contract.destructiveActionAvailable ? "write visible" : "write disabled"}
            </Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <span>Command: {preview?.command || "none"}</span>
            <span>Mode: {preview?.mode || "none"}</span>
            <span>Feature flag: {contract.route?.featureFlag || "none"}</span>
            <span>Plan: {preview?.planId || "none"}</span>
            <span>Scan: {preview?.scanFingerprint || "none"}</span>
          </div>
        </div>

        {contract.route ? (
          <div className="grid gap-2">
            <div className="rounded-md border bg-card p-3">
              <div className="mb-2 text-sm font-medium">Allowed targets</div>
              <div className="flex flex-wrap gap-1">
                {contract.route.allowedTargets.map((target) => (
                  <Badge key={target} variant="outline">{target}</Badge>
                ))}
              </div>
            </div>
            <div className="rounded-md border bg-card p-3">
              <div className="mb-2 text-sm font-medium">Forbidden targets</div>
              <div className="flex flex-wrap gap-1">
                {contract.route.forbiddenTargets.slice(0, 5).map((target) => (
                  <Badge key={target} variant="outline">{target}</Badge>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Target scope audit</span>
            <Badge variant={contract.targetAudit.ready ? "safe" : "review"}>{contract.targetAudit.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{contract.targetAudit.summary}</p>
          <div className="mt-2 flex flex-col gap-2">
            {contract.targetAudit.rows.slice(0, 3).map((row) => (
              <div key={row.id} className="rounded-md border bg-card p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{row.title}</span>
                  <Badge variant={row.status === "allowed" ? "safe" : "restricted"}>{row.status}</Badge>
                </div>
                <div className="mt-1 truncate font-mono text-muted-foreground">{row.path || "no path"}</div>
                <div className="mt-1 text-muted-foreground">{row.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {(blocked.length ? blocked : contract.items.slice(0, 4)).map((item) => (
            <div key={item.id} className="rounded-md border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 text-sm font-medium">{item.label}</div>
                <Badge variant={item.passed ? "safe" : "review"}>{item.passed ? "passed" : "waiting"}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FirstSafeValidationGatePanel({ gate }) {
  const visibleRows = gate.rows.length ? gate.rows : gate.blockers;
  const fixtureRows = gate.fixtureRows.slice(0, 3);

  return (
    <Card id="first-safe-validation-gate-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          First-safe validation gate
          <Badge variant={gate.tone}>{gate.status}</Badge>
        </CardTitle>
        <CardDescription>{gate.primary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <QueueStat label="Checks" value={`${gate.counts.passedChecks}/${gate.counts.requiredChecks}`} tone={gate.counts.missingChecks ? "review" : "safe"} />
          <QueueStat label="Missing" value={gate.counts.missingChecks} tone={gate.counts.missingChecks ? "restricted" : "safe"} />
          <QueueStat label="Fixtures" value={`${gate.counts.passedFixtures}/${gate.counts.fixtures}`} tone={gate.counts.passedFixtures === gate.counts.fixtures ? "safe" : "review"} />
          <QueueStat label="Real run" value={gate.realRunAllowed ? "allowed" : "locked"} tone={gate.realRunAllowed ? "restricted" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">{gate.route?.title || "No first-safe route"}</span>
            <Badge variant={gate.implementationPlanningReady ? "safe" : "review"}>
              {gate.implementationPlanningReady ? "planning ready" : "waiting"}
            </Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <span>Route: {gate.route?.id || "none"}</span>
            <span>Contract: {gate.contract.ready ? "ready" : gate.contract.status}</span>
            <span>Boundary probe: {gate.boundary.status}</span>
            <span>Feature flag: {gate.contract.featureFlag || "none"}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {visibleRows.slice(0, 5).map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 text-sm font-medium">{row.label}</div>
                <Badge variant={row.passed ? "safe" : "review"}>{row.passed ? "passed" : row.status || "waiting"}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{row.detail}</p>
              {row.evidencePath ? <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{row.evidencePath}</p> : null}
            </div>
          ))}
        </div>

        {fixtureRows.length ? (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="mb-2 text-sm font-medium">Required fixtures</div>
            <div className="flex flex-wrap gap-1">
              {fixtureRows.map((fixture) => (
                <Badge key={fixture.id} variant={fixture.passed ? "safe" : "outline"}>{fixture.label}</Badge>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FirstSafeImplementationWorkOrderPanel({ workOrder }) {
  const visibleItems = workOrder.workItems.slice(0, 5);
  const visibleTests = workOrder.acceptanceTests.slice(0, 4);

  return (
    <Card id="first-safe-work-order-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          First-safe work order
          <Badge variant={workOrder.tone}>{workOrder.status}</Badge>
        </CardTitle>
        <CardDescription>{workOrder.primary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <QueueStat label="Items" value={workOrder.counts.workItems} tone="review" />
          <QueueStat label="Buildable" value={workOrder.counts.readyToBuild} tone={workOrder.implementationWorkAllowed ? "safe" : "review"} />
          <QueueStat label="Tests" value={workOrder.counts.acceptanceTests} tone="review" />
          <QueueStat label="Real run" value={workOrder.realRunAllowed ? "allowed" : "locked"} tone={workOrder.realRunAllowed ? "restricted" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">{workOrder.route?.title || "No first-safe route"}</span>
            <Badge variant={workOrder.implementationWorkAllowed ? "safe" : "review"}>
              {workOrder.implementationWorkAllowed ? "implementation allowed" : "blocked"}
            </Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <span>Command: {workOrder.contract.command || "none"}</span>
            <span>Feature flag: {workOrder.contract.featureFlag || "none"}</span>
            <span>Gate: {workOrder.gate.status}</span>
            <span>Boundary: {workOrder.boundary.status}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {visibleItems.map((item) => (
            <div key={item.id} className="rounded-md border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 text-sm font-medium">{item.label}</div>
                <Badge variant={item.status === "ready-to-build" ? "safe" : item.status === "blocked" ? "restricted" : "review"}>{item.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{item.evidence}</p>
            </div>
          ))}
        </div>

        {visibleTests.length ? (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="mb-2 text-sm font-medium">Acceptance tests</div>
            <div className="grid gap-2">
              {visibleTests.map((test) => (
                <div key={test.id} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{test.label}: {test.detail}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TempExecutorActivationGatePanel({ gate }) {
  const visibleRows = gate.blockedRows.length ? gate.blockedRows : gate.rows;

  return (
    <Card id="temp-executor-activation-gate-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Temp executor activation
          <Badge variant={gate.tone}>{gate.status}</Badge>
        </CardTitle>
        <CardDescription>{gate.primary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <QueueStat label="Checks" value={`${gate.counts.passed}/${gate.counts.checks}`} tone={gate.counts.blocked ? "review" : "safe"} />
          <QueueStat label="Flag" value={gate.featureFlag.enabled ? "on" : "off"} tone={gate.featureFlag.enabled ? "review" : "safe"} />
          <QueueStat label="Preflight" value={gate.preflight.blocked ? `${gate.preflight.blocked} blocked` : gate.preflight.checks.length} tone={gate.preflight.attached ? "review" : "restricted"} />
          <QueueStat label="Mutation" value={gate.mutationEnabled ? "enabled" : "locked"} tone={gate.mutationEnabled ? "restricted" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">{gate.route.title}</span>
            <Badge variant={gate.activationAllowed ? "restricted" : "safe"}>
              {gate.activationAllowed ? "activation allowed" : "activation locked"}
            </Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <span>Feature flag: {gate.featureFlag.id} / {gate.featureFlag.enabled ? "enabled" : "disabled"}</span>
            <span>Scaffold: {gate.scaffold.present ? `${gate.scaffold.status} / mutation ${gate.scaffold.mutationEnabled ? "enabled" : "disabled"}` : "missing"}</span>
            <span>Preflight: {gate.preflight.status}</span>
            <span>Validation: {gate.validation.status}</span>
            <span>Work order: {gate.workOrder.status}</span>
            <span>Write readiness: {gate.release.writeStatus}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {visibleRows.slice(0, 5).map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 text-sm font-medium">{row.label}</div>
                <Badge variant={row.passed ? "safe" : row.status === "blocked" ? "restricted" : "review"}>{row.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{row.detail}</p>
              {row.evidence ? <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{row.evidence}</p> : null}
            </div>
          ))}
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 text-sm font-medium">Activation boundary</div>
          <div className="flex flex-col gap-2">
            {gate.steps.slice(0, 3).map((step) => (
              <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TempExecutorActivationRehearsalPanel({ rehearsal }) {
  const visibleRows = rehearsal.rows.slice(0, 4);
  const activationStatus = rehearsal.activationGate?.status || "not-evaluated";

  return (
    <Card id="temp-activation-rehearsal-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Temp activation rehearsal
          <Badge variant={rehearsal.tone}>{rehearsal.status}</Badge>
        </CardTitle>
        <CardDescription>{rehearsal.primary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <QueueStat label="Entries" value={rehearsal.counts.entries} tone={rehearsal.counts.entries ? "review" : "restricted"} />
          <QueueStat label="Preflight" value={rehearsal.counts.preflightChecks} tone={rehearsal.counts.preflightChecks ? "review" : "restricted"} />
          <QueueStat label="Gate" value={activationStatus} tone={activationStatus === "feature-flag-disabled" ? "safe" : "review"} />
          <QueueStat label="Mutation" value={rehearsal.mutationEnabled ? "enabled" : "locked"} tone={rehearsal.mutationEnabled ? "restricted" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Demo-only evidence</span>
            <Badge variant={rehearsal.demoOnly ? "outline" : "restricted"}>
              {rehearsal.demoOnly ? "synthetic" : "native"}
            </Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <span>Route: {rehearsal.route.title}</span>
            <span>Feature flag: {rehearsal.route.featureFlag}</span>
            <span>Rejected entries: {rehearsal.syntheticWriteBoundaryProbe?.counts?.rejected || 0}</span>
            <span>Bytes reclaimed: {formatBytes(rehearsal.syntheticWriteBoundaryProbe?.counts?.bytes || 0)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {visibleRows.map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 text-sm font-medium">{row.label}</div>
                <Badge variant={row.passed ? "safe" : row.status === "blocked" ? "restricted" : "review"}>{row.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{row.detail}</p>
              {row.evidence ? <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{row.evidence}</p> : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WriteBoundaryProbePanel({ probe, nativeWriteBoundary, runtimeCapabilities, onProbe }) {
  const runtimeReady = Boolean(runtimeCapabilities.result.executeCleanupPlan);
  const hasRows = probe.counts.selectedRows > 0;
  const running = nativeWriteBoundary.status === "running";
  const disabled = running || !runtimeReady || !hasRows || (probe.contractRequired && !probe.contractReady);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Write boundary probe
          <Badge variant={probe.tone}>{probe.status}</Badge>
        </CardTitle>
        <CardDescription>{probe.primary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <QueueStat label="Entries" value={probe.counts.entries} tone={probe.rejectionEvidence ? "safe" : "review"} />
          <QueueStat label="Rejected" value={probe.counts.rejected} tone={probe.rejectionEvidence ? "safe" : "restricted"} />
          <QueueStat label="Bytes" value={formatBytes(probe.counts.bytes)} tone={probe.counts.bytes ? "restricted" : "safe"} />
          <QueueStat label="Contract" value={probe.contractRequired ? probe.contractMatch ? "match" : "wait" : "n/a"} tone={probe.contractMatch ? "safe" : "review"} />
          <QueueStat label="Preflight" value={probe.counts.preflightBlocked ? `${probe.counts.preflightBlocked} blocked` : probe.counts.preflightChecks} tone={probe.counts.preflightBlocked ? "review" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Rejection evidence</span>
            <Badge variant={probe.rejectionEvidence ? "safe" : "review"}>
              {probe.rejectionEvidence ? "zero bytes" : "not recorded"}
            </Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <span>Accepted: {probe.accepted ? "yes" : "no"}</span>
            <span>Real run enabled: {probe.realRunEnabled ? "yes" : "no"}</span>
            <span>Destructive commands: {probe.destructiveCommands ? "present" : "disabled"}</span>
            <span>Route: {probe.route?.id || "none"}</span>
            <span>Contract echo: {probe.contractEcho ? probe.contractEcho.requestMode || "present" : "missing"}</span>
            <span>Echo match: {probe.contractRequired ? probe.contractMatch ? "yes" : "no" : "not required"}</span>
            <span>Scaffold: {probe.executorScaffold ? `${probe.executorScaffold.featureFlag || probe.executorScaffold.route} / ${probe.executorScaffold.status}` : "none"}</span>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={onProbe} disabled={disabled}>
          <Play data-icon="inline-start" />
          {running ? "Probing boundary" : "Probe write boundary"}
        </Button>

        <p className="text-xs text-muted-foreground">
          This calls the native rejecting stub only. It records rejection evidence and zero bytes; it does not create ledger recovery.
        </p>

        <div className="flex flex-col gap-2">
          {probe.steps.slice(0, 3).map((step) => (
            <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{step}</span>
            </div>
          ))}
        </div>

        {probe.reason ? (
          <div className="rounded-md border bg-card p-3 text-sm text-muted-foreground">{probe.reason}</div>
        ) : null}

        {probe.entries.length ? (
          <div className="flex flex-col gap-2">
            {probe.entries.slice(0, 3).map((entry) => (
              <div key={`${entry.id}-${entry.rejectCode || entry.result}`} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto min-w-0 text-sm font-medium">{entry.title}</span>
                  <Badge variant="safe">{entry.result}</Badge>
                  <Badge variant="outline">{entry.rejectCode || "no code"}</Badge>
                  <Badge variant="outline">{formatBytes(entry.bytes)}</Badge>
                </div>
                {entry.preflightStatus ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge variant="outline">{entry.preflightStatus}</Badge>
                    {entry.preflightChecks.slice(0, 3).map((check) => (
                      <Badge key={`${entry.id}-${check.id}`} variant={check.status === "passed" ? "safe" : check.status === "blocked" ? "restricted" : "review"}>
                        {check.label}: {check.status}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">{entry.note}</p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FirstSafeTempExecutorPanel({ runtimeCapabilities, execution, contract, capsule, onExecute }) {
  const enabled = Boolean(runtimeCapabilities.result.realRunEnabled && runtimeCapabilities.result.executorFlags?.tempCleanupExecutor);
  const selectedRows = capsule?.selectedRows || [];
  const preview = contract?.requestPreview || {};
  const routeReady = preview.route === "known-temp-delete" && selectedRows.length > 0;
  const requestReady = Boolean(routeReady && preview.planId && preview.scanFingerprint && preview.consentPlanId);
  const running = execution.status === "running";
  const result = execution.result;
  const reclaimed = (result?.entries || []).reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
  const disabled = running || !enabled || !requestReady;

  return (
    <Card id="first-safe-temp-executor-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Real temp cleanup
          <Badge variant={enabled ? "restricted" : "review"}>{enabled ? "feature on" : "feature off"}</Badge>
        </CardTitle>
        <CardDescription>
          First real executor: selected temp targets only, file-only deletion, symlink skipping, native allowlist enforced.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Route" value={contract?.requestPreview?.route || "none"} tone={routeReady ? "safe" : "review"} />
          <QueueStat label="Actions" value={selectedRows.length} tone={selectedRows.length ? "advanced" : "review"} />
          <QueueStat label="Request" value={requestReady ? "ready" : "wait"} tone={requestReady ? "safe" : "review"} />
          <QueueStat label="Accepted" value={result?.accepted ? "yes" : "no"} tone={result?.accepted ? "restricted" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Executor boundary</span>
            <Badge variant={enabled ? "restricted" : "safe"}>{enabled ? "can delete temp files" : "cannot delete"}</Badge>
            <Badge variant="outline">known-temp-delete</Badge>
            <Badge variant="safe">no broad folders</Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <span>Enable with `SPACEGUARD_ENABLE_TEMP_EXECUTOR=1` before launching Tauri.</span>
            <span>Request evidence: plan {preview.planId ? "yes" : "no"}, scan {preview.scanFingerprint ? "yes" : "no"}, consent {preview.consentPlanId ? "yes" : "no"}.</span>
            <span>Allowed targets are `%TEMP%`, `%TMP%`, and `Windows\\Temp`; Downloads, Desktop, Documents, node_modules, and reparse-like targets are rejected.</span>
          </div>
        </div>

        <Button variant={enabled ? "default" : "outline"} size="sm" onClick={onExecute} disabled={disabled}>
          {running ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Cleaning temp files" : "Run real temp cleanup"}
        </Button>

        {execution.error ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{execution.error}</div> : null}

        {result?.warnings?.length ? (
          <div className="flex flex-col gap-2">
            {result.warnings.slice(0, 3).map((warning) => (
              <div key={warning} className="rounded-md border bg-card p-3 text-xs text-muted-foreground">{warning}</div>
            ))}
          </div>
        ) : null}

        {result?.entries?.length ? (
          <div className="flex flex-col gap-2">
            {result.entries.slice(0, 4).map((entry) => (
              <div key={`${entry.id}-${entry.result}-${entry.bytes}`} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto min-w-0 text-sm font-medium">{entry.title}</span>
                  <Badge variant={entry.result === "executed" ? "safe" : "review"}>{entry.result}</Badge>
                  <Badge variant="outline">{formatBytes(entry.bytes)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{entry.note}</p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function GradleCacheExecutorPanel({ runtimeCapabilities, execution, executorPlan, nativeScan, scanSession, consentReceipt, onExecute }) {
  const enabled = Boolean(runtimeCapabilities.result.realRunEnabled && runtimeCapabilities.result.executorFlags?.gradleCacheExecutor);
  const rows = executorPlan.rows.filter((row) => row.id === "gradle-cache" && row.route === "bounded-cache-delete");
  const finding = (nativeScan.result?.findings || [])
    .find((row) => row.recipeId === "gradle-cache" && (row.status === "measured" || row.status === "limited") && row.path);
  const target = finding
    ? {
        id: "gradle-cache",
        title: finding.title || "Gradle dependency and build cache",
        path: finding.path,
        bytes: Number(finding.bytes || 0),
        status: finding.status
      }
    : null;
  const requestReady = Boolean(rows.length && target && scanSession.currentFingerprint && consentReceipt.planId);
  const running = execution.status === "running";
  const result = execution.result;
  const reclaimed = (result?.entries || []).reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
  const disabled = running || !enabled || !requestReady;

  return (
    <Card id="gradle-cache-executor-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Gradle cache cleanup
          <Badge variant={enabled ? "restricted" : "review"}>{enabled ? "feature on" : "feature off"}</Badge>
        </CardTitle>
        <CardDescription>
          Deletes old files only under the current user's `.gradle\\caches` root. Project folders, daemon state, wrapper files, and init scripts are rejected.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Selected" value={rows.length} tone={rows.length ? "advanced" : "review"} />
          <QueueStat label="Root" value={target ? "scanned" : "missing"} tone={target ? "safe" : "review"} />
          <QueueStat label="Recovered" value={formatBytes(reclaimed)} tone={reclaimed ? "safe" : "review"} />
          <QueueStat label="Request" value={requestReady ? "ready" : "wait"} tone={requestReady ? "safe" : "review"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Gradle executor boundary</span>
            <Badge variant={enabled ? "restricted" : "safe"}>{enabled ? "can delete old cache" : "cannot delete"}</Badge>
            <Badge variant="outline">bounded-cache-delete</Badge>
            <Badge variant="safe">30+ day files</Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <span>Enable with `SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR=1` before launching Tauri.</span>
            <span>Request evidence: scan {scanSession.currentFingerprint ? "yes" : "no"}, consent {consentReceipt.planId ? "yes" : "no"}, selected Gradle route {rows.length ? "yes" : "no"}.</span>
            <span>Allowed target is the native-scanned current user `.gradle\\caches` directory; lock files and recent files are skipped.</span>
          </div>
        </div>

        {target ? (
          <div className="rounded-md border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-auto min-w-0 text-sm font-medium">{target.title}</span>
              <Badge variant="outline">{formatBytes(target.bytes)}</Badge>
              <Badge variant={target.status === "limited" ? "review" : "safe"}>{target.status}</Badge>
            </div>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{target.path}</p>
          </div>
        ) : (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Run a native read-only scan that measures `.gradle\\caches` before this executor has a concrete target.
          </div>
        )}

        <Button variant={enabled ? "default" : "outline"} size="sm" onClick={onExecute} disabled={disabled}>
          {running ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Cleaning Gradle cache" : "Run Gradle cache cleanup"}
        </Button>

        {execution.error ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{execution.error}</div> : null}

        {result?.warnings?.length ? (
          <div className="flex flex-col gap-2">
            {result.warnings.slice(0, 3).map((warning) => (
              <div key={warning} className="rounded-md border bg-card p-3 text-xs text-muted-foreground">{warning}</div>
            ))}
          </div>
        ) : null}

        {result?.entries?.length ? (
          <div className="flex flex-col gap-2">
            {result.entries.slice(0, 4).map((entry) => (
              <div key={`${entry.id}-${entry.result}-${entry.bytes}`} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto min-w-0 text-sm font-medium">{entry.title}</span>
                  <Badge variant={entry.result === "executed" ? "safe" : "review"}>{entry.result}</Badge>
                  <Badge variant="outline">{formatBytes(entry.bytes)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{entry.note}</p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function UserCacheExecutorPanel({ runtimeCapabilities, execution, executorPlan, nativeScan, scanSession, consentReceipt, onExecute }) {
  const enabled = Boolean(runtimeCapabilities.result.realRunEnabled && runtimeCapabilities.result.executorFlags?.userCacheExecutor);
  const rows = executorPlan.rows.filter((row) => row.id === "user-cache" && row.route === "bounded-user-cache-delete");
  const finding = (nativeScan.result?.findings || [])
    .find((row) => row.recipeId === "user-cache" && (row.status === "measured" || row.status === "limited") && row.path);
  const target = finding
    ? {
        id: "user-cache",
        title: finding.title || "User .cache folder",
        path: finding.path,
        bytes: Number(finding.bytes || 0),
        status: finding.status
      }
    : null;
  const requestReady = Boolean(rows.length && target && scanSession.currentFingerprint && consentReceipt.planId);
  const running = execution.status === "running";
  const result = execution.result;
  const reclaimed = (result?.entries || []).reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
  const disabled = running || !enabled || !requestReady;

  return (
    <Card id="user-cache-executor-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          User .cache cleanup
          <Badge variant={enabled ? "restricted" : "review"}>{enabled ? "feature on" : "feature off"}</Badge>
        </CardTitle>
        <CardDescription>
          Deletes old cache files only under the exact current-user `.cache` root. Config, databases, sessions, credentials, project folders, and identity-like files are rejected or skipped.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Selected" value={rows.length} tone={rows.length ? "advanced" : "review"} />
          <QueueStat label="Root" value={target ? "scanned" : "missing"} tone={target ? "safe" : "review"} />
          <QueueStat label="Recovered" value={formatBytes(reclaimed)} tone={reclaimed ? "safe" : "review"} />
          <QueueStat label="Request" value={requestReady ? "ready" : "wait"} tone={requestReady ? "safe" : "review"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">User .cache executor boundary</span>
            <Badge variant={enabled ? "restricted" : "safe"}>{enabled ? "can delete old cache" : "cannot delete"}</Badge>
            <Badge variant="outline">bounded-user-cache-delete</Badge>
            <Badge variant="safe">30+ day files</Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <span>Enable with `SPACEGUARD_ENABLE_USER_CACHE_EXECUTOR=1` before launching Tauri.</span>
            <span>Request evidence: scan {scanSession.currentFingerprint ? "yes" : "no"}, consent {consentReceipt.planId ? "yes" : "no"}, selected .cache route {rows.length ? "yes" : "no"}.</span>
            <span>Allowed target is the native-scanned current user `%UserProfile%\\.cache`; config, database, lock, log, session, credential, project, and identity-like files stay untouched.</span>
          </div>
        </div>

        {target ? (
          <div className="rounded-md border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-auto min-w-0 text-sm font-medium">{target.title}</span>
              <Badge variant="outline">{formatBytes(target.bytes)}</Badge>
              <Badge variant={target.status === "limited" ? "review" : "safe"}>{target.status}</Badge>
            </div>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{target.path}</p>
          </div>
        ) : (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Run a native read-only scan that measures `%UserProfile%\\.cache` before this executor has a concrete target.
          </div>
        )}

        <Button variant={enabled ? "default" : "outline"} size="sm" onClick={onExecute} disabled={disabled}>
          {running ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Cleaning .cache" : "Run user .cache cleanup"}
        </Button>

        {execution.error ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{execution.error}</div> : null}

        {result?.warnings?.length ? (
          <div className="flex flex-col gap-2">
            {result.warnings.slice(0, 3).map((warning) => (
              <div key={warning} className="rounded-md border bg-card p-3 text-xs text-muted-foreground">{warning}</div>
            ))}
          </div>
        ) : null}

        {result?.entries?.length ? (
          <div className="flex flex-col gap-2">
            {result.entries.slice(0, 4).map((entry) => (
              <div key={`${entry.id}-${entry.result}-${entry.bytes}`} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto min-w-0 text-sm font-medium">{entry.title}</span>
                  <Badge variant={entry.result === "executed" ? "safe" : "review"}>{entry.result}</Badge>
                  <Badge variant="outline">{formatBytes(entry.bytes)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{entry.note}</p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AndroidCacheExecutorPanel({ runtimeCapabilities, execution, executorPlan, nativeScan, scanSession, consentReceipt, onExecute }) {
  const enabled = Boolean(runtimeCapabilities.result.realRunEnabled && runtimeCapabilities.result.executorFlags?.androidCacheExecutor);
  const rows = executorPlan.rows.filter((row) => row.id === "android-cache" && row.route === "bounded-android-cache-delete");
  const targets = (nativeScan.result?.findings || [])
    .filter((row) => row.recipeId === "android-cache" && (row.status === "measured" || row.status === "limited") && row.path)
    .map((finding, index) => ({
      id: `android-cache-${index + 1}`,
      title: finding.title || "Android Studio cache folder",
      path: finding.path,
      bytes: Number(finding.bytes || 0),
      status: finding.status
    }));
  const requestReady = Boolean(rows.length && targets.length && scanSession.currentFingerprint && consentReceipt.planId);
  const running = execution.status === "running";
  const result = execution.result;
  const reclaimed = (result?.entries || []).reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
  const disabled = running || !enabled || !requestReady;

  return (
    <Card id="android-cache-executor-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Android cache cleanup
          <Badge variant={enabled ? "restricted" : "review"}>{enabled ? "feature on" : "feature off"}</Badge>
        </CardTitle>
        <CardDescription>
          Deletes old files only from scanned Android Studio cache folders and `.android\\build-cache`. AVDs, SDKs, emulators, Gradle data, and projects are rejected.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Selected" value={rows.length} tone={rows.length ? "advanced" : "review"} />
          <QueueStat label="Roots" value={targets.length} tone={targets.length ? "advanced" : "review"} />
          <QueueStat label="Recovered" value={formatBytes(reclaimed)} tone={reclaimed ? "safe" : "review"} />
          <QueueStat label="Request" value={requestReady ? "ready" : "wait"} tone={requestReady ? "safe" : "review"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Android executor boundary</span>
            <Badge variant={enabled ? "restricted" : "safe"}>{enabled ? "can delete old cache" : "cannot delete"}</Badge>
            <Badge variant="outline">bounded-android-cache-delete</Badge>
            <Badge variant="safe">30+ day files</Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <span>Enable with `SPACEGUARD_ENABLE_ANDROID_CACHE_EXECUTOR=1` before launching Tauri.</span>
            <span>Request evidence: scan {scanSession.currentFingerprint ? "yes" : "no"}, consent {consentReceipt.planId ? "yes" : "no"}, selected Android route {rows.length ? "yes" : "no"}.</span>
            <span>Allowed targets are native-scanned Android Studio `caches`, `system\\caches`, or `%UserProfile%\\.android\\build-cache`; `.android\\avd`, SDK, emulator, and project paths stay untouched.</span>
          </div>
        </div>

        {targets.length ? (
          <div className="grid gap-2">
            {targets.slice(0, 5).map((target) => (
              <div key={target.id} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto min-w-0 text-sm font-medium">{target.title}</span>
                  <Badge variant="outline">{formatBytes(target.bytes)}</Badge>
                  <Badge variant={target.status === "limited" ? "review" : "safe"}>{target.status}</Badge>
                </div>
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{target.path}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Run a native read-only scan that measures Android Studio cache folders before this executor has a concrete target.
          </div>
        )}

        <Button variant={enabled ? "default" : "outline"} size="sm" onClick={onExecute} disabled={disabled}>
          {running ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Cleaning Android cache" : "Run Android cache cleanup"}
        </Button>

        {execution.error ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{execution.error}</div> : null}

        {result?.warnings?.length ? (
          <div className="flex flex-col gap-2">
            {result.warnings.slice(0, 3).map((warning) => (
              <div key={warning} className="rounded-md border bg-card p-3 text-xs text-muted-foreground">{warning}</div>
            ))}
          </div>
        ) : null}

        {result?.entries?.length ? (
          <div className="flex flex-col gap-2">
            {result.entries.slice(0, 6).map((entry) => (
              <div key={`${entry.id}-${entry.result}-${entry.bytes}`} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto min-w-0 text-sm font-medium">{entry.title}</span>
                  <Badge variant={entry.result === "executed" ? "safe" : "review"}>{entry.result}</Badge>
                  <Badge variant="outline">{formatBytes(entry.bytes)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{entry.note}</p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ShaderCacheExecutorPanel({ runtimeCapabilities, execution, executorPlan, nativeScan, scanSession, consentReceipt, onExecute }) {
  const enabled = Boolean(runtimeCapabilities.result.realRunEnabled && runtimeCapabilities.result.executorFlags?.shaderCacheExecutor);
  const rows = executorPlan.rows.filter((row) => row.id === "steam-shader-cache" && row.route === "launcher-cache-cleanup");
  const targets = (nativeScan.result?.findings || [])
    .filter((row) => row.recipeId === "steam-shader-cache" && (row.status === "measured" || row.status === "limited") && row.path)
    .map((finding, index) => ({
      id: `shader-cache-${index + 1}`,
      title: finding.title || "Graphics shader cache folder",
      path: finding.path,
      bytes: Number(finding.bytes || 0),
      status: finding.status
    }));
  const requestReady = Boolean(rows.length && targets.length && scanSession.currentFingerprint && consentReceipt.planId);
  const running = execution.status === "running";
  const result = execution.result;
  const reclaimed = (result?.entries || []).reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
  const disabled = running || !enabled || !requestReady;

  return (
    <Card id="shader-cache-executor-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Shader cache cleanup
          <Badge variant={enabled ? "restricted" : "review"}>{enabled ? "feature on" : "feature off"}</Badge>
        </CardTitle>
        <CardDescription>
          Deletes old graphics shader cache files from scanned LocalAppData cache roots only. Game installs, saves, launchers, profiles, configs, and system paths are rejected.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Selected" value={rows.length} tone={rows.length ? "advanced" : "review"} />
          <QueueStat label="Roots" value={targets.length} tone={targets.length ? "advanced" : "review"} />
          <QueueStat label="Recovered" value={formatBytes(reclaimed)} tone={reclaimed ? "safe" : "review"} />
          <QueueStat label="Request" value={requestReady ? "ready" : "wait"} tone={requestReady ? "safe" : "review"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Shader executor boundary</span>
            <Badge variant={enabled ? "restricted" : "safe"}>{enabled ? "can delete old cache" : "cannot delete"}</Badge>
            <Badge variant="outline">launcher-cache-cleanup</Badge>
            <Badge variant="safe">14+ day files</Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <span>Enable with `SPACEGUARD_ENABLE_SHADER_CACHE_EXECUTOR=1` before launching Tauri.</span>
            <span>Request evidence: scan {scanSession.currentFingerprint ? "yes" : "no"}, consent {consentReceipt.planId ? "yes" : "no"}, selected shader route {rows.length ? "yes" : "no"}.</span>
            <span>Allowed roots are native-scanned `%LOCALAPPDATA%\\D3DSCache`, NVIDIA `DXCache`/`GLCache`/`NV_Cache`, AMD `DxCache`/`GLCache`/`VkCache`, and Intel `ShaderCache`.</span>
          </div>
        </div>

        {targets.length ? (
          <div className="grid gap-2">
            {targets.slice(0, 8).map((target) => (
              <div key={target.id} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto min-w-0 text-sm font-medium">{target.title}</span>
                  <Badge variant="outline">{formatBytes(target.bytes)}</Badge>
                  <Badge variant={target.status === "limited" ? "review" : "safe"}>{target.status}</Badge>
                </div>
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{target.path}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Run a native read-only scan that measures supported shader cache folders before this executor has a concrete target.
          </div>
        )}

        <Button variant={enabled ? "default" : "outline"} size="sm" onClick={onExecute} disabled={disabled}>
          {running ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Cleaning shader cache" : "Run shader cache cleanup"}
        </Button>

        {execution.error ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{execution.error}</div> : null}

        {result?.warnings?.length ? (
          <div className="flex flex-col gap-2">
            {result.warnings.slice(0, 3).map((warning) => (
              <div key={warning} className="rounded-md border bg-card p-3 text-xs text-muted-foreground">{warning}</div>
            ))}
          </div>
        ) : null}

        {result?.entries?.length ? (
          <div className="flex flex-col gap-2">
            {result.entries.slice(0, 8).map((entry) => (
              <div key={`${entry.id}-${entry.result}-${entry.bytes}`} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto min-w-0 text-sm font-medium">{entry.title}</span>
                  <Badge variant={entry.result === "executed" ? "safe" : "review"}>{entry.result}</Badge>
                  <Badge variant="outline">{formatBytes(entry.bytes)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{entry.note}</p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RecycleBinExecutorPanel({ runtimeCapabilities, execution, executorPlan, nativeScan, scanSession, consentReceipt, permanentConfirmed, onExecute }) {
  const enabled = Boolean(runtimeCapabilities.result.realRunEnabled && runtimeCapabilities.result.executorFlags?.recycleBinExecutor);
  const rows = executorPlan.rows.filter((row) => row.id === "recycle-bin" && row.route === "shell-recycle-bin");
  const finding = (nativeScan.result?.findings || [])
    .find((row) => row.recipeId === "recycle-bin" && (row.status === "measured" || row.status === "limited") && row.path);
  const target = finding
    ? {
        id: "recycle-bin",
        title: finding.title || "Recycle Bin",
        path: finding.path,
        bytes: Number(finding.bytes || 0),
        status: finding.status,
        files: Number(finding.files || 0)
      }
    : null;
  const requestReady = Boolean(rows.length && target && scanSession.currentFingerprint && consentReceipt.planId && permanentConfirmed);
  const running = execution.status === "running";
  const result = execution.result;
  const reclaimed = (result?.entries || []).reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
  const disabled = running || !enabled || !requestReady;

  return (
    <Card id="recycle-bin-executor-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Recycle Bin cleanup
          <Badge variant={enabled ? "restricted" : "review"}>{enabled ? "feature on" : "feature off"}</Badge>
        </CardTitle>
        <CardDescription>
          Permanently empties the selected drive's Shell Recycle Bin. This is not rebuildable cache cleanup and has no automated restore path.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Selected" value={rows.length} tone={rows.length ? "advanced" : "review"} />
          <QueueStat label="Confirm" value={permanentConfirmed ? "yes" : "no"} tone={permanentConfirmed ? "safe" : "restricted"} />
          <QueueStat label="Recovered" value={formatBytes(reclaimed)} tone={reclaimed ? "safe" : "review"} />
          <QueueStat label="Request" value={requestReady ? "ready" : "wait"} tone={requestReady ? "safe" : "review"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Recycle Bin executor boundary</span>
            <Badge variant={enabled ? "restricted" : "safe"}>{enabled ? "can permanently remove" : "cannot delete"}</Badge>
            <Badge variant="outline">shell-recycle-bin</Badge>
            <Badge variant="restricted">permanent</Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <span>Enable with `SPACEGUARD_ENABLE_RECYCLE_BIN_EXECUTOR=1` before launching Tauri.</span>
            <span>Request evidence: scan {scanSession.currentFingerprint ? "yes" : "no"}, consent {consentReceipt.planId ? "yes" : "no"}, selected Recycle Bin route {rows.length ? "yes" : "no"}, permanent confirmation {permanentConfirmed ? "yes" : "no"}.</span>
            <span>The native request sends `permanentRemovalConfirmed=true` and uses Windows Shell Recycle Bin APIs for the selected drive root only.</span>
          </div>
        </div>

        {target ? (
          <div className="rounded-md border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-auto min-w-0 text-sm font-medium">{target.title}</span>
              <Badge variant="outline">{formatBytes(target.bytes)}</Badge>
              <Badge variant="outline">{target.files} item(s)</Badge>
              <Badge variant={target.status === "limited" ? "review" : "safe"}>{target.status}</Badge>
            </div>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{target.path}</p>
          </div>
        ) : (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Run a native read-only scan that measures Recycle Bin inventory before this executor has a concrete target.
          </div>
        )}

        <Button variant={enabled ? "default" : "outline"} size="sm" onClick={onExecute} disabled={disabled}>
          {running ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Emptying Recycle Bin" : "Empty Recycle Bin"}
        </Button>

        {execution.error ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{execution.error}</div> : null}

        {result?.warnings?.length ? (
          <div className="flex flex-col gap-2">
            {result.warnings.slice(0, 3).map((warning) => (
              <div key={warning} className="rounded-md border bg-card p-3 text-xs text-muted-foreground">{warning}</div>
            ))}
          </div>
        ) : null}

        {result?.entries?.length ? (
          <div className="flex flex-col gap-2">
            {result.entries.slice(0, 4).map((entry) => (
              <div key={`${entry.id}-${entry.result}-${entry.bytes}`} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto min-w-0 text-sm font-medium">{entry.title}</span>
                  <Badge variant={entry.result === "executed" ? "safe" : "review"}>{entry.result}</Badge>
                  <Badge variant="outline">{formatBytes(entry.bytes)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{entry.note}</p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PipCacheExecutorPanel({ runtimeCapabilities, execution, executorPlan, nativeScan, scanSession, consentReceipt, onExecute }) {
  const enabled = Boolean(runtimeCapabilities.result.realRunEnabled && runtimeCapabilities.result.executorFlags?.pipCacheExecutor);
  const rows = executorPlan.rows.filter((row) => row.id === "pip-cache" && row.route === "bounded-pip-cache-delete");
  const finding = (nativeScan.result?.findings || [])
    .find((row) => row.recipeId === "pip-cache" && (row.status === "measured" || row.status === "limited") && row.path);
  const target = finding
    ? {
        id: "pip-cache",
        title: finding.title || "pip package cache",
        path: finding.path,
        bytes: Number(finding.bytes || 0),
        status: finding.status
      }
    : null;
  const requestReady = Boolean(rows.length && target && scanSession.currentFingerprint && consentReceipt.planId);
  const running = execution.status === "running";
  const result = execution.result;
  const reclaimed = (result?.entries || []).reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
  const disabled = running || !enabled || !requestReady;

  return (
    <Card id="pip-cache-executor-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          pip cache cleanup
          <Badge variant={enabled ? "restricted" : "review"}>{enabled ? "feature on" : "feature off"}</Badge>
        </CardTitle>
        <CardDescription>
          Deletes old files only under the current user's pip cache root. Python installs, virtualenvs, site-packages, pip config, and shell commands are rejected.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Selected" value={rows.length} tone={rows.length ? "advanced" : "review"} />
          <QueueStat label="Root" value={target ? "scanned" : "missing"} tone={target ? "safe" : "review"} />
          <QueueStat label="Recovered" value={formatBytes(reclaimed)} tone={reclaimed ? "safe" : "review"} />
          <QueueStat label="Request" value={requestReady ? "ready" : "wait"} tone={requestReady ? "safe" : "review"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">pip executor boundary</span>
            <Badge variant={enabled ? "restricted" : "safe"}>{enabled ? "can delete old cache" : "cannot delete"}</Badge>
            <Badge variant="outline">bounded-pip-cache-delete</Badge>
            <Badge variant="safe">14+ day files</Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <span>Enable with `SPACEGUARD_ENABLE_PIP_CACHE_EXECUTOR=1` before launching Tauri.</span>
            <span>Request evidence: scan {scanSession.currentFingerprint ? "yes" : "no"}, consent {consentReceipt.planId ? "yes" : "no"}, selected pip route {rows.length ? "yes" : "no"}.</span>
            <span>Allowed target is the native-scanned current user `%LocalAppData%\\pip\\Cache`; selfcheck, pip config, Python installs, virtualenvs, and site-packages stay untouched.</span>
          </div>
        </div>

        {target ? (
          <div className="rounded-md border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-auto min-w-0 text-sm font-medium">{target.title}</span>
              <Badge variant="outline">{formatBytes(target.bytes)}</Badge>
              <Badge variant={target.status === "limited" ? "review" : "safe"}>{target.status}</Badge>
            </div>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{target.path}</p>
          </div>
        ) : (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Run a native read-only scan that measures `%LocalAppData%\\pip\\Cache` before this executor has a concrete target.
          </div>
        )}

        <Button variant={enabled ? "default" : "outline"} size="sm" onClick={onExecute} disabled={disabled}>
          {running ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Cleaning pip cache" : "Run pip cache cleanup"}
        </Button>

        {execution.error ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{execution.error}</div> : null}

        {result?.warnings?.length ? (
          <div className="flex flex-col gap-2">
            {result.warnings.slice(0, 3).map((warning) => (
              <div key={warning} className="rounded-md border bg-card p-3 text-xs text-muted-foreground">{warning}</div>
            ))}
          </div>
        ) : null}

        {result?.entries?.length ? (
          <div className="flex flex-col gap-2">
            {result.entries.slice(0, 4).map((entry) => (
              <div key={`${entry.id}-${entry.result}-${entry.bytes}`} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto min-w-0 text-sm font-medium">{entry.title}</span>
                  <Badge variant={entry.result === "executed" ? "safe" : "review"}>{entry.result}</Badge>
                  <Badge variant="outline">{formatBytes(entry.bytes)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{entry.note}</p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DockerBuildCacheExecutorPanel({ runtimeCapabilities, execution, executorPlan, nativeScan, scanSession, consentReceipt, onExecute }) {
  const enabled = Boolean(runtimeCapabilities.result.realRunEnabled && runtimeCapabilities.result.executorFlags?.toolNativePruneExecutors);
  const rows = executorPlan.rows.filter((row) => row.id === "docker-build-cache" && row.route === "tool-native-docker-build-cache-prune");
  const finding = (nativeScan.result?.findings || [])
    .find((row) => row.recipeId === "docker-build-cache" && (row.status === "measured" || row.status === "limited") && row.path);
  const target = finding
    ? {
        id: "docker-build-cache",
        title: finding.title || "Docker build cache",
        path: finding.path,
        bytes: Number(finding.bytes || 0),
        status: finding.status
      }
    : null;
  const requestReady = Boolean(rows.length && target && scanSession.currentFingerprint && consentReceipt.planId);
  const running = execution.status === "running";
  const result = execution.result;
  const reclaimed = (result?.entries || []).reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
  const disabled = running || !enabled || !requestReady;

  return (
    <Card id="docker-build-cache-executor-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Docker build-cache cleanup
          <Badge variant={enabled ? "restricted" : "review"}>{enabled ? "feature on" : "feature off"}</Badge>
        </CardTitle>
        <CardDescription>
          Runs one allowlisted Docker CLI command for build cache only. Volumes, running containers, images, Docker data folders, and broad prune commands are rejected.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Selected" value={rows.length} tone={rows.length ? "advanced" : "review"} />
          <QueueStat label="Inventory" value={target ? "scanned" : "missing"} tone={target ? "safe" : "review"} />
          <QueueStat label="Recovered" value={formatBytes(reclaimed)} tone={reclaimed ? "safe" : "review"} />
          <QueueStat label="Request" value={requestReady ? "ready" : "wait"} tone={requestReady ? "safe" : "review"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Docker build-cache executor boundary</span>
            <Badge variant={enabled ? "restricted" : "safe"}>{enabled ? "can run Docker prune" : "cannot run"}</Badge>
            <Badge variant="outline">tool-native-docker-build-cache-prune</Badge>
            <Badge variant="safe">builder prune only</Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <span>Enable with `SPACEGUARD_ENABLE_TOOL_NATIVE_PRUNE_EXECUTORS=1` before launching Tauri.</span>
            <span>Request evidence: scan {scanSession.currentFingerprint ? "yes" : "no"}, consent {consentReceipt.planId ? "yes" : "no"}, selected Docker route {rows.length ? "yes" : "no"}.</span>
            <span>Allowed command is `docker builder prune --force`; Docker volumes, running containers, image deletion, data-root deletion, shell commands, and `docker system prune` stay blocked.</span>
          </div>
        </div>

        {target ? (
          <div className="rounded-md border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-auto min-w-0 text-sm font-medium">{target.title}</span>
              <Badge variant="outline">{formatBytes(target.bytes)}</Badge>
              <Badge variant={target.status === "limited" ? "review" : "safe"}>{target.status}</Badge>
            </div>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{target.path}</p>
          </div>
        ) : (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Run a native read-only scan that completes Docker CLI inventory before this executor has a concrete target.
          </div>
        )}

        <Button variant={enabled ? "default" : "outline"} size="sm" onClick={onExecute} disabled={disabled}>
          {running ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Running Docker prune" : "Run Docker prune"}
        </Button>

        {execution.error ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{execution.error}</div> : null}

        {result?.warnings?.length ? (
          <div className="flex flex-col gap-2">
            {result.warnings.slice(0, 3).map((warning) => (
              <div key={warning} className="rounded-md border bg-card p-3 text-xs text-muted-foreground">{warning}</div>
            ))}
          </div>
        ) : null}

        {result?.entries?.length ? (
          <div className="flex flex-col gap-2">
            {result.entries.slice(0, 4).map((entry) => (
              <div key={`${entry.id}-${entry.result}-${entry.bytes}`} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto min-w-0 text-sm font-medium">{entry.title}</span>
                  <Badge variant={entry.result === "executed" ? "safe" : "review"}>{entry.result}</Badge>
                  <Badge variant="outline">{formatBytes(entry.bytes)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{entry.note}</p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function NpmCacheExecutorPanel({ runtimeCapabilities, execution, executorPlan, nativeScan, scanSession, consentReceipt, onExecute }) {
  const enabled = Boolean(runtimeCapabilities.result.realRunEnabled && runtimeCapabilities.result.executorFlags?.npmCacheExecutor);
  const rows = executorPlan.rows.filter((row) => row.id === "npm-cache" && row.route === "bounded-npm-cache-delete");
  const finding = (nativeScan.result?.findings || [])
    .find((row) => row.recipeId === "npm-cache" && (row.status === "measured" || row.status === "limited") && row.path);
  const target = finding
    ? {
        id: "npm-cache",
        title: finding.title || "npm package cache",
        path: finding.path,
        bytes: Number(finding.bytes || 0),
        status: finding.status
      }
    : null;
  const requestReady = Boolean(rows.length && target && scanSession.currentFingerprint && consentReceipt.planId);
  const running = execution.status === "running";
  const result = execution.result;
  const reclaimed = (result?.entries || []).reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
  const disabled = running || !enabled || !requestReady;

  return (
    <Card id="npm-cache-executor-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          npm cache cleanup
          <Badge variant={enabled ? "restricted" : "review"}>{enabled ? "feature on" : "feature off"}</Badge>
        </CardTitle>
        <CardDescription>
          Deletes old content blobs and cache temp files only under the current user's npm `_cacache` root. Global packages and project folders are rejected.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Selected" value={rows.length} tone={rows.length ? "advanced" : "review"} />
          <QueueStat label="Root" value={target ? "scanned" : "missing"} tone={target ? "safe" : "review"} />
          <QueueStat label="Recovered" value={formatBytes(reclaimed)} tone={reclaimed ? "safe" : "review"} />
          <QueueStat label="Request" value={requestReady ? "ready" : "wait"} tone={requestReady ? "safe" : "review"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">npm executor boundary</span>
            <Badge variant={enabled ? "restricted" : "safe"}>{enabled ? "can delete old cache" : "cannot delete"}</Badge>
            <Badge variant="outline">bounded-npm-cache-delete</Badge>
            <Badge variant="safe">14+ day files</Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <span>Enable with `SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR=1` before launching Tauri.</span>
            <span>Request evidence: scan {scanSession.currentFingerprint ? "yes" : "no"}, consent {consentReceipt.planId ? "yes" : "no"}, selected npm route {rows.length ? "yes" : "no"}.</span>
            <span>Allowed target is the native-scanned current user `%LocalAppData%\\npm-cache\\_cacache`; index metadata, global packages, and project `node_modules` stay untouched.</span>
          </div>
        </div>

        {target ? (
          <div className="rounded-md border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-auto min-w-0 text-sm font-medium">{target.title}</span>
              <Badge variant="outline">{formatBytes(target.bytes)}</Badge>
              <Badge variant={target.status === "limited" ? "review" : "safe"}>{target.status}</Badge>
            </div>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{target.path}</p>
          </div>
        ) : (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Run a native read-only scan that measures `%LocalAppData%\\npm-cache\\_cacache` before this executor has a concrete target.
          </div>
        )}

        <Button variant={enabled ? "default" : "outline"} size="sm" onClick={onExecute} disabled={disabled}>
          {running ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Cleaning npm cache" : "Run npm cache cleanup"}
        </Button>

        {execution.error ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{execution.error}</div> : null}

        {result?.warnings?.length ? (
          <div className="flex flex-col gap-2">
            {result.warnings.slice(0, 3).map((warning) => (
              <div key={warning} className="rounded-md border bg-card p-3 text-xs text-muted-foreground">{warning}</div>
            ))}
          </div>
        ) : null}

        {result?.entries?.length ? (
          <div className="flex flex-col gap-2">
            {result.entries.slice(0, 4).map((entry) => (
              <div key={`${entry.id}-${entry.result}-${entry.bytes}`} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto min-w-0 text-sm font-medium">{entry.title}</span>
                  <Badge variant={entry.result === "executed" ? "safe" : "review"}>{entry.result}</Badge>
                  <Badge variant="outline">{formatBytes(entry.bytes)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{entry.note}</p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PnpmStoreExecutorPanel({ runtimeCapabilities, execution, executorPlan, nativeScan, scanSession, consentReceipt, onExecute }) {
  const enabled = Boolean(runtimeCapabilities.result.realRunEnabled && runtimeCapabilities.result.executorFlags?.pnpmStoreExecutor);
  const rows = executorPlan.rows.filter((row) => row.id === "pnpm-store" && row.route === "bounded-pnpm-store-delete");
  const finding = (nativeScan.result?.findings || [])
    .find((row) => row.recipeId === "pnpm-store" && (row.status === "measured" || row.status === "limited") && row.path);
  const target = finding
    ? {
        id: "pnpm-store",
        title: finding.title || "pnpm global store",
        path: finding.path,
        bytes: Number(finding.bytes || 0),
        status: finding.status
      }
    : null;
  const requestReady = Boolean(rows.length && target && scanSession.currentFingerprint && consentReceipt.planId);
  const running = execution.status === "running";
  const result = execution.result;
  const reclaimed = (result?.entries || []).reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
  const disabled = running || !enabled || !requestReady;

  return (
    <Card id="pnpm-store-executor-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          pnpm store cleanup
          <Badge variant={enabled ? "restricted" : "review"}>{enabled ? "feature on" : "feature off"}</Badge>
        </CardTitle>
        <CardDescription>
          Deletes old content and temp files only under the current user's pnpm store root. Global bins, project folders, metadata, and shell commands are rejected.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Selected" value={rows.length} tone={rows.length ? "advanced" : "review"} />
          <QueueStat label="Root" value={target ? "scanned" : "missing"} tone={target ? "safe" : "review"} />
          <QueueStat label="Recovered" value={formatBytes(reclaimed)} tone={reclaimed ? "safe" : "review"} />
          <QueueStat label="Request" value={requestReady ? "ready" : "wait"} tone={requestReady ? "safe" : "review"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">pnpm executor boundary</span>
            <Badge variant={enabled ? "restricted" : "safe"}>{enabled ? "can delete old store" : "cannot delete"}</Badge>
            <Badge variant="outline">bounded-pnpm-store-delete</Badge>
            <Badge variant="safe">30+ day files</Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <span>Enable with `SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR=1` before launching Tauri.</span>
            <span>Request evidence: scan {scanSession.currentFingerprint ? "yes" : "no"}, consent {consentReceipt.planId ? "yes" : "no"}, selected pnpm route {rows.length ? "yes" : "no"}.</span>
            <span>Allowed target is the native-scanned current user `%LocalAppData%\\pnpm\\store`; metadata, global bins, and project `node_modules` stay untouched.</span>
          </div>
        </div>

        {target ? (
          <div className="rounded-md border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-auto min-w-0 text-sm font-medium">{target.title}</span>
              <Badge variant="outline">{formatBytes(target.bytes)}</Badge>
              <Badge variant={target.status === "limited" ? "review" : "safe"}>{target.status}</Badge>
            </div>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{target.path}</p>
          </div>
        ) : (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Run a native read-only scan that measures `%LocalAppData%\\pnpm\\store` before this executor has a concrete target.
          </div>
        )}

        <Button variant={enabled ? "default" : "outline"} size="sm" onClick={onExecute} disabled={disabled}>
          {running ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Cleaning pnpm store" : "Run pnpm store cleanup"}
        </Button>

        {execution.error ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{execution.error}</div> : null}

        {result?.warnings?.length ? (
          <div className="flex flex-col gap-2">
            {result.warnings.slice(0, 3).map((warning) => (
              <div key={warning} className="rounded-md border bg-card p-3 text-xs text-muted-foreground">{warning}</div>
            ))}
          </div>
        ) : null}

        {result?.entries?.length ? (
          <div className="flex flex-col gap-2">
            {result.entries.slice(0, 4).map((entry) => (
              <div key={`${entry.id}-${entry.result}-${entry.bytes}`} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto min-w-0 text-sm font-medium">{entry.title}</span>
                  <Badge variant={entry.result === "executed" ? "safe" : "review"}>{entry.result}</Badge>
                  <Badge variant="outline">{formatBytes(entry.bytes)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{entry.note}</p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ProjectDependencyExecutorPanel({ runtimeCapabilities, execution, executorPlan, scanSession, consentReceipt, onExecute }) {
  const enabled = Boolean(runtimeCapabilities.result.realRunEnabled && runtimeCapabilities.result.executorFlags?.projectDependencyExecutor);
  const rows = executorPlan.rows.filter((row) => row.route === "item-review-project-cache" && row.reviewTargets?.length);
  const targets = rows.flatMap((row) => row.reviewTargets || []);
  const requestReady = Boolean(rows.length && scanSession.currentFingerprint && consentReceipt.planId);
  const running = execution.status === "running";
  const result = execution.result;
  const reclaimed = (result?.entries || []).reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
  const expoTargets = targets.filter((target) => /expo|react native/i.test(`${target.kind || ""} ${target.reason || ""}`)).length;
  const disabled = running || !enabled || !requestReady;

  return (
    <Card id="project-dependency-executor-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Reviewed project dependencies
          <Badge variant={enabled ? "restricted" : "review"}>{enabled ? "feature on" : "feature off"}</Badge>
        </CardTitle>
        <CardDescription>
          Deletes only reviewed `node_modules` targets with parent package.json evidence. Useful for stale Expo and React Native projects.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Targets" value={targets.length} tone={targets.length ? "advanced" : "review"} />
          <QueueStat label="Expo/RN" value={expoTargets} tone={expoTargets ? "advanced" : "review"} />
          <QueueStat label="Recovered" value={formatBytes(reclaimed)} tone={reclaimed ? "safe" : "review"} />
          <QueueStat label="Request" value={requestReady ? "ready" : "wait"} tone={requestReady ? "safe" : "review"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Project executor boundary</span>
            <Badge variant={enabled ? "restricted" : "safe"}>{enabled ? "can remove reviewed deps" : "cannot delete"}</Badge>
            <Badge variant="outline">item-review-project-cache</Badge>
            <Badge variant="safe">package.json required</Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <span>Enable with `SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR=1` before launching Tauri.</span>
            <span>Request evidence: scan {scanSession.currentFingerprint ? "yes" : "no"}, consent {consentReceipt.planId ? "yes" : "no"}, reviewed remove targets {targets.length}.</span>
            <span>Only item-review decisions marked Remove are sent to native execution; source folders are not sent as targets.</span>
          </div>
        </div>

        {targets.length ? (
          <div className="flex flex-col gap-2">
            {targets.slice(0, 4).map((target) => (
              <div key={target.id} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto min-w-0 text-sm font-medium">{target.name}</span>
                  <Badge variant="outline">{formatBytes(target.bytes)}</Badge>
                  <Badge variant={/expo|react native/i.test(`${target.kind || ""} ${target.reason || ""}`) ? "advanced" : "outline"}>
                    {target.kind || "project dependency"}
                  </Badge>
                </div>
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{target.path}</p>
                <p className="mt-2 text-xs text-muted-foreground">{target.reason}</p>
                <ReviewSignalBadges signals={target.signals} compact />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Mark reviewed node_modules items as Remove before this executor has a target.
          </div>
        )}

        <Button variant={enabled ? "default" : "outline"} size="sm" onClick={onExecute} disabled={disabled}>
          {running ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Cleaning dependencies" : "Run reviewed dependency cleanup"}
        </Button>

        {execution.error ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{execution.error}</div> : null}

        {result?.warnings?.length ? (
          <div className="flex flex-col gap-2">
            {result.warnings.slice(0, 3).map((warning) => (
              <div key={warning} className="rounded-md border bg-card p-3 text-xs text-muted-foreground">{warning}</div>
            ))}
          </div>
        ) : null}

        {result?.entries?.length ? (
          <div className="flex flex-col gap-2">
            {result.entries.slice(0, 4).map((entry) => (
              <div key={`${entry.id}-${entry.result}-${entry.bytes}`} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto min-w-0 text-sm font-medium">{entry.title}</span>
                  <Badge variant={entry.result === "executed" ? "safe" : "review"}>{entry.result}</Badge>
                  <Badge variant="outline">{formatBytes(entry.bytes)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{entry.note}</p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DownloadsCleanupExecutorPanel({ runtimeCapabilities, execution, executorPlan, scanSession, consentReceipt, onExecute }) {
  const enabled = Boolean(runtimeCapabilities.result.realRunEnabled && runtimeCapabilities.result.executorFlags?.downloadsCleanupExecutor);
  const rows = executorPlan.rows.filter((row) => row.route === "item-review-recycle-bin" && row.reviewTargets?.length);
  const targets = rows.flatMap((row) => row.reviewTargets || []);
  const requestReady = Boolean(rows.length && scanSession.currentFingerprint && consentReceipt.planId);
  const running = execution.status === "running";
  const result = execution.result;
  const reclaimed = (result?.entries || []).reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
  const disabled = running || !enabled || !requestReady;

  return (
    <Card id="downloads-cleanup-executor-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Reviewed Downloads cleanup
          <Badge variant={enabled ? "restricted" : "review"}>{enabled ? "feature on" : "feature off"}</Badge>
        </CardTitle>
        <CardDescription>
          Moves only reviewed old installer/archive files from Downloads through Recycle Bin semantics.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Targets" value={targets.length} tone={targets.length ? "advanced" : "review"} />
          <QueueStat label="Selected" value={formatBytes(targets.reduce((sum, target) => sum + Number(target.bytes || 0), 0))} tone={targets.length ? "advanced" : "review"} />
          <QueueStat label="Recovered" value={formatBytes(reclaimed)} tone={reclaimed ? "safe" : "review"} />
          <QueueStat label="Request" value={requestReady ? "ready" : "wait"} tone={requestReady ? "safe" : "review"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Downloads executor boundary</span>
            <Badge variant={enabled ? "restricted" : "safe"}>{enabled ? "can move reviewed files" : "cannot delete"}</Badge>
            <Badge variant="outline">item-review-recycle-bin</Badge>
            <Badge variant="safe">Recycle Bin semantics</Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <span>Enable with `SPACEGUARD_ENABLE_DOWNLOADS_EXECUTOR=1` before launching Tauri.</span>
            <span>Request evidence: scan {scanSession.currentFingerprint ? "yes" : "no"}, consent {consentReceipt.planId ? "yes" : "no"}, reviewed remove targets {targets.length}.</span>
            <span>Native validation accepts only old installer/archive files under the current user's Downloads folder. It rejects directories, protected paths, recent files, and arbitrary personal folders.</span>
          </div>
        </div>

        {targets.length ? (
          <div className="flex flex-col gap-2">
            {targets.slice(0, 4).map((target) => (
              <div key={target.id} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto min-w-0 text-sm font-medium">{target.name}</span>
                  <Badge variant="outline">{formatBytes(target.bytes)}</Badge>
                  <Badge variant="outline">{target.kind || "download file"}</Badge>
                </div>
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{target.path}</p>
                <p className="mt-2 text-xs text-muted-foreground">{target.reason}</p>
                <ReviewSignalBadges signals={target.signals} compact />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Mark old installer/archive items in Downloads as Remove before this executor has a target.
          </div>
        )}

        <Button variant={enabled ? "default" : "outline"} size="sm" onClick={onExecute} disabled={disabled}>
          {running ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Moving reviewed files" : "Move reviewed Downloads items"}
        </Button>

        {execution.error ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{execution.error}</div> : null}

        {result?.warnings?.length ? (
          <div className="flex flex-col gap-2">
            {result.warnings.slice(0, 3).map((warning) => (
              <div key={warning} className="rounded-md border bg-card p-3 text-xs text-muted-foreground">{warning}</div>
            ))}
          </div>
        ) : null}

        {result?.entries?.length ? (
          <div className="flex flex-col gap-2">
            {result.entries.slice(0, 4).map((entry) => (
              <div key={`${entry.id}-${entry.result}-${entry.bytes}`} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto min-w-0 text-sm font-medium">{entry.title}</span>
                  <Badge variant={entry.result === "executed" ? "safe" : "review"}>{entry.result}</Badge>
                  <Badge variant="outline">{formatBytes(entry.bytes)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{entry.note}</p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function LargeFileArchiveExecutorPanel({ runtimeCapabilities, execution, executorPlan, scanSession, consentReceipt, archiveDestination, onArchiveDestination, onExecute }) {
  const enabled = Boolean(runtimeCapabilities.result.realRunEnabled && runtimeCapabilities.result.executorFlags?.largeFileArchiveExecutor);
  const rows = executorPlan.rows.filter((row) => row.route === "item-review-large-files" && row.archiveTargets?.length);
  const targets = rows.flatMap((row) => row.archiveTargets || []);
  const requestReady = Boolean(rows.length && scanSession.currentFingerprint && consentReceipt.planId && archiveDestination.trim());
  const running = execution.status === "running";
  const result = execution.result;
  const reclaimed = (result?.entries || []).reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
  const disabled = running || !enabled || !requestReady;

  return (
    <Card id="large-file-archive-executor-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Reviewed large-file archive
          <Badge variant={enabled ? "restricted" : "review"}>{enabled ? "feature on" : "feature off"}</Badge>
        </CardTitle>
        <CardDescription>
          Moves reviewed large personal files to an explicit archive folder on another drive.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Targets" value={targets.length} tone={targets.length ? "advanced" : "review"} />
          <QueueStat label="Selected" value={formatBytes(targets.reduce((sum, target) => sum + Number(target.bytes || 0), 0))} tone={targets.length ? "advanced" : "review"} />
          <QueueStat label="Recovered" value={formatBytes(reclaimed)} tone={reclaimed ? "safe" : "review"} />
          <QueueStat label="Request" value={requestReady ? "ready" : "wait"} tone={requestReady ? "safe" : "review"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Large-file archive boundary</span>
            <Badge variant={enabled ? "restricted" : "safe"}>{enabled ? "can move reviewed files" : "cannot move"}</Badge>
            <Badge variant="outline">item-review-large-files</Badge>
            <Badge variant="safe">copy then remove source</Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <span>Enable with `SPACEGUARD_ENABLE_LARGE_FILE_ARCHIVE_EXECUTOR=1` before launching Tauri.</span>
            <span>Request evidence: scan {scanSession.currentFingerprint ? "yes" : "no"}, consent {consentReceipt.planId ? "yes" : "no"}, Move/Archive targets {targets.length}.</span>
            <span>Native validation accepts only old 1GB+ files under current-user review folders and requires an existing non-system destination on another drive.</span>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input
            value={archiveDestination}
            placeholder="D:\\SpaceGuardArchive"
            aria-label="large file archive destination"
            onChange={(event) => onArchiveDestination(event.target.value)}
          />
          <Badge variant={archiveDestination.trim() ? "safe" : "review"}>{archiveDestination.trim() ? "destination set" : "destination needed"}</Badge>
        </div>

        {targets.length ? (
          <div className="flex flex-col gap-2">
            {targets.slice(0, 4).map((target) => (
              <div key={target.id} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto min-w-0 text-sm font-medium">{target.name}</span>
                  <Badge variant={target.decision === "move" ? "review" : "advanced"}>{target.decision || "archive"}</Badge>
                  <Badge variant="outline">{formatBytes(target.bytes)}</Badge>
                  <Badge variant="outline">{target.kind || "large file"}</Badge>
                </div>
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{target.path}</p>
                <p className="mt-2 text-xs text-muted-foreground">{target.reason}</p>
                <ReviewSignalBadges signals={target.signals} compact />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Mark large personal files as Move or Archive before this executor has a target.
          </div>
        )}

        <Button variant={enabled ? "default" : "outline"} size="sm" onClick={onExecute} disabled={disabled}>
          {running ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Archiving reviewed files" : "Archive reviewed large files"}
        </Button>

        {execution.error ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{execution.error}</div> : null}

        {result?.warnings?.length ? (
          <div className="flex flex-col gap-2">
            {result.warnings.slice(0, 3).map((warning) => (
              <div key={warning} className="rounded-md border bg-card p-3 text-xs text-muted-foreground">{warning}</div>
            ))}
          </div>
        ) : null}

        {result?.entries?.length ? (
          <div className="flex flex-col gap-2">
            {result.entries.slice(0, 4).map((entry) => (
              <div key={`${entry.id}-${entry.result}-${entry.bytes}`} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto min-w-0 text-sm font-medium">{entry.title}</span>
                  <Badge variant={entry.result === "executed" ? "safe" : "review"}>{entry.result}</Badge>
                  <Badge variant="outline">{formatBytes(entry.bytes)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{entry.note}</p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReviewSignalBadges({ signals = [], compact = false }) {
  const rows = Array.isArray(signals) ? signals.filter((signal) => signal?.label || signal?.value).slice(0, compact ? 5 : 8) : [];
  if (!rows.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {rows.map((signal, index) => (
        <Badge key={`${signal.label || "signal"}-${signal.value || index}`} variant={reviewSignalBadgeVariant(signal.tone)}>
          {signal.label ? `${signal.label}: ` : ""}{signal.value || "present"}
        </Badge>
      ))}
    </div>
  );
}

function reviewSignalBadgeVariant(tone = "") {
  if (tone === "safe" || tone === "review" || tone === "restricted" || tone === "advanced" || tone === "advisory") return tone;
  return "outline";
}

function BrowserCacheExecutorPanel({ runtimeCapabilities, execution, executorPlan, nativeScan, scanSession, consentReceipt, onExecute }) {
  const enabled = Boolean(runtimeCapabilities.result.realRunEnabled && runtimeCapabilities.result.executorFlags?.browserCacheExecutor);
  const selectedRows = executorPlan.rows.filter((row) => row.route === "browser-cache-only");
  const cacheTargets = (nativeScan.result?.findings || [])
    .filter((finding) => finding.recipeId === "browser-cache")
    .filter((finding) => (finding.status === "measured" || finding.status === "limited") && finding.path)
    .map((finding, index) => ({
      id: `browser-cache-${index + 1}`,
      title: finding.title || "Browser cache root",
      path: finding.path,
      bytes: Number(finding.bytes || 0),
      status: finding.status
    }));
  const requestReady = Boolean(selectedRows.length && cacheTargets.length && scanSession.currentFingerprint && consentReceipt.planId);
  const running = execution.status === "running";
  const result = execution.result;
  const reclaimed = (result?.entries || []).reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
  const disabled = running || !enabled || !requestReady;

  return (
    <Card id="browser-cache-executor-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Browser cache cleanup
          <Badge variant={enabled ? "restricted" : "review"}>{enabled ? "feature on" : "feature off"}</Badge>
        </CardTitle>
        <CardDescription>
          Deletes only scanned browser cache roots. Cookies, sessions, saved logins, extensions, history, and profile stores are rejected.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Selected" value={selectedRows.length} tone={selectedRows.length ? "advanced" : "review"} />
          <QueueStat label="Roots" value={cacheTargets.length} tone={cacheTargets.length ? "advanced" : "review"} />
          <QueueStat label="Recovered" value={formatBytes(reclaimed)} tone={reclaimed ? "safe" : "review"} />
          <QueueStat label="Request" value={requestReady ? "ready" : "wait"} tone={requestReady ? "safe" : "review"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Browser cache executor boundary</span>
            <Badge variant={enabled ? "restricted" : "safe"}>{enabled ? "can delete cache" : "cannot delete"}</Badge>
            <Badge variant="outline">browser-cache-only</Badge>
            <Badge variant="safe">identity blocked</Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <span>Enable with `SPACEGUARD_ENABLE_BROWSER_CACHE_EXECUTOR=1` before launching Tauri.</span>
            <span>Request evidence: scan {scanSession.currentFingerprint ? "yes" : "no"}, consent {consentReceipt.planId ? "yes" : "no"}, cache roots {cacheTargets.length}.</span>
            <span>Targets come from read-only native browser cache findings; summary labels and profile stores are not sent to execution.</span>
          </div>
        </div>

        {cacheTargets.length ? (
          <div className="flex flex-col gap-2">
            {cacheTargets.slice(0, 4).map((target) => (
              <div key={target.id} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto min-w-0 text-sm font-medium">{target.title}</span>
                  <Badge variant="outline">{formatBytes(target.bytes)}</Badge>
                  <Badge variant={target.status === "limited" ? "review" : "safe"}>{target.status}</Badge>
                </div>
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{target.path}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Run a native read-only scan with browser cache findings before this executor has concrete targets.
          </div>
        )}

        <Button variant={enabled ? "default" : "outline"} size="sm" onClick={onExecute} disabled={disabled}>
          {running ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Cleaning browser cache" : "Run browser cache cleanup"}
        </Button>

        {execution.error ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{execution.error}</div> : null}

        {result?.warnings?.length ? (
          <div className="flex flex-col gap-2">
            {result.warnings.slice(0, 3).map((warning) => (
              <div key={warning} className="rounded-md border bg-card p-3 text-xs text-muted-foreground">{warning}</div>
            ))}
          </div>
        ) : null}

        {result?.entries?.length ? (
          <div className="flex flex-col gap-2">
            {result.entries.slice(0, 4).map((entry) => (
              <div key={`${entry.id}-${entry.result}-${entry.bytes}`} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto min-w-0 text-sm font-medium">{entry.title}</span>
                  <Badge variant={entry.result === "executed" ? "safe" : "review"}>{entry.result}</Badge>
                  <Badge variant="outline">{formatBytes(entry.bytes)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{entry.note}</p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ToolCommandInventoryPanel({ inventory }) {
  const previewRows = inventory.selectedRows.length ? inventory.selectedRows.slice(0, 5) : inventory.rows.slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Tool command inventory
          <Badge variant={inventory.commandExecutionEnabled ? "restricted" : "safe"}>
            {inventory.commandExecutionEnabled ? "shell enabled" : "no shell"}
          </Badge>
        </CardTitle>
        <CardDescription>{inventory.primary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <QueueStat label="Commands" value={inventory.counts.commands} tone="review" />
          <QueueStat label="Selected" value={inventory.counts.selected} tone="review" />
          <QueueStat label="Shell exec" value={inventory.counts.shellExecutors} tone={inventory.counts.shellExecutors ? "restricted" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 text-sm font-medium">Command boundary</div>
          <div className="flex flex-col gap-2">
            {inventory.steps.slice(0, 3).map((step) => (
              <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {previewRows.map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-auto min-w-0 text-sm font-medium">{row.title}</div>
                <Badge variant={row.selected ? "review" : "outline"}>{row.status}</Badge>
                <Badge variant="outline">{row.tool}</Badge>
              </div>
              <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                <div className="truncate font-mono">inspect: {row.inspectCommand}</div>
                <div className="truncate font-mono">future: {row.futureCommand}</div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{row.blockedReason}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ExecutionProofHandoffPanel({ handoff, onRescan }) {
  const complete = handoff.status === "proof-complete";
  const blocked = handoff.status === "proof-mismatch";
  const waiting = handoff.status === "waiting-for-execution";
  const buttonDisabled = !handoff.canRunRescan || complete || waiting;

  return (
    <Card id="execution-proof-handoff-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Execution proof handoff
          <Badge variant={handoff.tone}>{handoff.status}</Badge>
        </CardTitle>
        <CardDescription>{handoff.primary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Run" value={handoff.runLabel} tone={handoff.scopedNativeExecution ? "restricted" : "review"} />
          <QueueStat label="Reclaimed" value={formatBytes(handoff.reclaimedBytes)} tone={handoff.reclaimedBytes ? "safe" : "review"} />
          <QueueStat label="Checkpoints" value={handoff.checkpointCount} tone={handoff.checkpointCount ? "advanced" : "review"} />
          <QueueStat label="Post scan" value={handoff.postRunScanEvidence ? "yes" : "no"} tone={handoff.postRunScanEvidence ? "safe" : "review"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Proof state</span>
            <Badge variant={complete ? "safe" : blocked ? "restricted" : "review"}>
              {complete ? "parity matched" : blocked ? "parity blocked" : "needs rescan"}
            </Badge>
            <Badge variant="outline">{handoff.ledgerEntries} ledger row(s)</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <QueueStat label="Matched" value={handoff.matched} tone={handoff.matched ? "safe" : "review"} />
            <QueueStat label="Mismatch" value={handoff.mismatch} tone={handoff.mismatch ? "restricted" : "safe"} />
            <QueueStat label="Waiting" value={handoff.waiting} tone={handoff.waiting ? "review" : "safe"} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {handoff.steps.slice(0, 3).map((step) => (
            <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
              {complete ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
              ) : (
                <ShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-muted-foreground">{step}</span>
            </div>
          ))}
        </div>

        <Button type="button" variant={blocked ? "default" : "outline"} size="sm" onClick={onRescan} disabled={buttonDisabled}>
          <RefreshCcw className={`h-4 w-4 ${handoff.scanning ? "animate-spin" : ""}`} />
          {handoff.scanning ? "Rescanning" : handoff.actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

function VerificationPanel({ planSnapshot, verificationSummary }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Verification
          <Badge variant={verificationSummary.tone}>{verificationSummary.status}</Badge>
        </CardTitle>
        <CardDescription>{verificationSummary.detail}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <QueueStat label="Plan" value={planSnapshot.selectedCount} tone="review" />
          <QueueStat label="Expected" value={formatBytes(verificationSummary.expectedBytes)} tone="safe" />
          <QueueStat label="Delta" value={formatBytes(verificationSummary.deltaBytes)} tone={verificationSummary.current ? "safe" : "review"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Plan snapshot</span>
            <Badge variant="outline">{planSnapshot.id}</Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <span>Selected: {planSnapshot.selectedCount}</span>
            <span>Recovery: {formatBytes(planSnapshot.selectedBytes)}</span>
            <span>Mode: {planSnapshot.scanMode}</span>
            <span>Native evidence: {verificationSummary.nativeEvidence ? "yes" : "no"}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {verificationSummary.steps.map((step) => (
            <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
              <CheckCircle2 className={`mt-0.5 h-4 w-4 ${verificationSummary.current ? "text-emerald-600" : "text-muted-foreground"}`} />
              <span className="text-muted-foreground">{step}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PostRunVerificationPanel({ verification, scanning, nativeCapability, onRescan, onExport }) {
  const preview = verification.checkpoints.slice(0, 4);
  const canRescan = Boolean(nativeCapability.available && verification.checkpoints.length && !scanning);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Post-run verification
          <Badge variant={verification.tone}>{verification.status}</Badge>
        </CardTitle>
        <CardDescription>{verification.detail}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <QueueStat label="Checks" value={verification.checkpoints.length} tone="review" />
          <QueueStat label="Expected" value={formatBytes(verification.expectedBytes)} tone="safe" />
          <QueueStat label="Skipped" value={verification.skippedCount} tone="review" />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Rescan proof</span>
            <Badge variant={verification.nativeEvidence ? "safe" : "review"}>
              {verification.nativeEvidence ? "native evidence" : "waiting"}
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            {verification.steps.map((step) => (
              <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <RefreshCcw className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRescan} disabled={!canRescan}>
            <RefreshCcw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? "Rescanning" : "Run post-run rescan"}
          </Button>
          {!nativeCapability.available ? (
            <p className="mt-2 text-xs text-muted-foreground">Post-run proof requires the Tauri desktop shell.</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          {preview.length ? (
            preview.map((checkpoint) => (
              <div key={checkpoint.id} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="mr-auto min-w-0 text-sm font-medium">{checkpoint.title}</div>
                  <Badge variant={checkpoint.status === "ready-for-comparison" ? "safe" : checkpoint.status === "skipped" ? "outline" : "review"}>
                    {checkpoint.status}
                  </Badge>
                </div>
                <p className="mt-2 truncate font-mono text-xs text-muted-foreground">{checkpoint.path}</p>
                <p className="mt-1 text-sm text-muted-foreground">{checkpoint.evidenceRequired}</p>
              </div>
            ))
          ) : (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">Run a dry-run simulation or scoped executor to generate affected-root checkpoints.</div>
          )}
        </div>

        <Button variant="outline" className="w-full" onClick={onExport} disabled={!verification.checkpoints.length}>
          <Download className="h-4 w-4" />
          Export verification checklist
        </Button>
      </CardContent>
    </Card>
  );
}

function RescanComparisonPanel({ comparison, scanning, nativeCapability, onRescan, onExport }) {
  const preview = comparison.rows.slice(0, 4);
  const canRescan = Boolean(nativeCapability.available && comparison.rows.length && !scanning);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Rescan comparison
          <Badge variant={comparison.tone}>{comparison.status}</Badge>
        </CardTitle>
        <CardDescription>{comparison.detail}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <QueueStat label="Matched" value={comparison.counts.matched} tone={comparison.counts.matched ? "safe" : "review"} />
          <QueueStat label="Mismatch" value={comparison.counts.mismatch + comparison.counts.noFinding} tone={comparison.counts.mismatch + comparison.counts.noFinding ? "restricted" : "safe"} />
          <QueueStat label="Waiting" value={comparison.counts.waiting} tone={comparison.counts.waiting ? "review" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Post-run scan timing</span>
            <Badge variant={comparison.postRunScanEvidence ? "safe" : "review"}>
              {comparison.postRunScanEvidence ? "scan after ledger" : "needs later scan"}
            </Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <span className="truncate">Ledger: {comparison.latestExecutionAt || "missing timestamp"}</span>
            <span className="truncate">Scan: {comparison.scanGeneratedAt || "missing timestamp"}</span>
            <span>Tolerance: {formatBytes(comparison.toleranceBytes)}</span>
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRescan} disabled={!canRescan}>
            <RefreshCcw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? "Rescanning" : "Run post-run rescan"}
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {preview.length ? (
            preview.map((row) => (
              <div key={row.id} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="mr-auto min-w-0 text-sm font-medium">{row.title}</div>
                  <Badge variant={row.tone}>{row.state}</Badge>
                  <Badge variant="outline">{row.nativeStatus}</Badge>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <QueueStat label="Expected left" value={formatBytes(row.expectedRemainingBytes)} tone="review" />
                  <QueueStat label="Native left" value={formatBytes(row.actualBytes)} tone={row.state === "matched" ? "safe" : "review"} />
                  <QueueStat label="Delta" value={formatBytes(row.deltaBytes)} tone={row.state === "mismatch" ? "restricted" : "safe"} />
                </div>
                <p className="mt-2 truncate font-mono text-xs text-muted-foreground">{row.nativePath || row.path}</p>
                <p className="mt-1 text-sm text-muted-foreground">{row.evidence}</p>
              </div>
            ))
          ) : (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">Run a dry-run simulation or scoped executor, then run a native read-only scan to compare affected roots.</div>
          )}
        </div>

        <Button variant="outline" className="w-full" onClick={onExport} disabled={!comparison.rows.length}>
          <Download className="h-4 w-4" />
          Export rescan comparison
        </Button>
      </CardContent>
    </Card>
  );
}

function RollbackPlanPanel({ plan, rollbackEvidence, onToggleProof, onUpdateProof, onResetProof }) {
  const preview = plan.rows.slice(0, 4);

  return (
    <Card id="rollback-plan-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              Rollback plan
              <Badge variant={plan.tone}>{plan.status}</Badge>
            </CardTitle>
            <CardDescription>{plan.detail}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onResetProof} disabled={!Object.keys(rollbackEvidence).length}>
            <X className="h-4 w-4" />
            Reset proof
          </Button>
        </div>
        <div className="mt-2 text-sm font-medium">Rollback proof ledger</div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <QueueStat label="Proof needed" value={plan.counts.needsProof} tone={plan.counts.needsProof ? "review" : "safe"} />
          <QueueStat label="Proof complete" value={plan.counts.proofComplete} tone={plan.counts.proofComplete ? "safe" : "review"} />
          <QueueStat label="Drafts" value={plan.counts.proofDraft} tone={plan.counts.proofDraft ? "review" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Restore posture</span>
            <Badge variant={plan.realRunEnabled ? "restricted" : "safe"}>
              {plan.realRunEnabled ? "real run open" : "real run locked"}
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            {plan.steps.slice(0, 4).map((step) => (
              <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <RefreshCcw className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {preview.length ? (
            preview.map((row) => {
              const proofRecord = coerceRollbackEvidenceFormRecord(rollbackEvidence[row.id]);
              const proofMarked = proofRecord.status === "proved";
              return (
                <div key={row.id} className="rounded-md border bg-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="mr-auto min-w-0 text-sm font-medium">{row.title}</div>
                    <Badge variant={row.tone}>{row.status}</Badge>
                    <Badge variant="outline">{row.route}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{row.recovery}</p>
                  <div className="mt-2 grid gap-2 text-xs text-muted-foreground">
                    {row.requiredEvidence.slice(0, 2).map((item) => (
                      <div key={item} className="grid grid-cols-[16px_1fr] gap-2">
                        {row.tone === "restricted" ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-red-600" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />}
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>

                  {row.proofRequired ? (
                    <div className="mt-3 flex flex-col gap-2 rounded-md border bg-muted/20 p-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={proofMarked}
                          aria-label={`${row.title} proof recorded`}
                          onClick={() => onToggleProof(row.id, !proofMarked)}
                        />
                        <span className="text-sm font-medium">Proof recorded</span>
                        <Badge variant={row.proof.complete ? "safe" : "review"}>{row.proof.status}</Badge>
                      </div>
                      <Input
                        value={proofRecord.restoreLocation}
                        placeholder="Restore, backup, or acknowledgement reference"
                        aria-label={`${row.title} restore backup acknowledgement reference`}
                        onChange={(event) => onUpdateProof(row.id, "restoreLocation", event.target.value)}
                      />
                      <Input
                        value={proofRecord.evidencePath}
                        placeholder="Evidence path or artifact id"
                        aria-label={`${row.title} rollback evidence path`}
                        onChange={(event) => onUpdateProof(row.id, "evidencePath", event.target.value)}
                      />
                      <Input
                        value={proofRecord.reviewer}
                        placeholder="Reviewer"
                        aria-label={`${row.title} rollback reviewer`}
                        onChange={(event) => onUpdateProof(row.id, "reviewer", event.target.value)}
                      />
                      <Textarea
                        value={proofRecord.notes}
                        placeholder="Rollback proof notes"
                        aria-label={`${row.title} rollback proof notes`}
                        onChange={(event) => onUpdateProof(row.id, "notes", event.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">{row.proof.detail}</p>
                    </div>
                  ) : (
                    <p className="mt-2 rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
                      Rebuildable route uses ledger and rescan proof instead of rollback proof detail.
                    </p>
                  )}
                </div>
              );
            })
          ) : (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">Select and approve a cleanup route to generate rollback requirements.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PrivilegeBoundaryPanel({ boundary }) {
  const adminPreview = boundary.adminRows.slice(0, 4);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Privilege boundary
          <Badge variant={boundary.tone}>{boundary.status}</Badge>
        </CardTitle>
        <CardDescription>Admin-sensitive routes are visible, but the app never self-elevates or unlocks real execution.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <QueueStat label="Admin routes" value={boundary.adminCount} tone="review" />
          <QueueStat label="Elevated" value={boundary.elevated ? "yes" : "no"} tone={boundary.elevated ? "safe" : "review"} />
          <QueueStat label="Blocked" value={boundary.blockedCount} tone={boundary.blockedCount ? "restricted" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Runtime privilege</span>
            <Badge variant="outline">{boundary.elevationSource || "unknown"}</Badge>
          </div>
          <div className="flex flex-col gap-2">
            {boundary.items.map((item) => (
              <div key={item.id} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <ShieldCheck className={`mt-0.5 h-4 w-4 ${item.passed ? "text-emerald-600" : "text-muted-foreground"}`} />
                <div>
                  <div className={item.passed ? "font-medium" : "font-medium text-muted-foreground"}>{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {adminPreview.length ? (
            adminPreview.map((row) => (
              <div key={row.id} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="mr-auto min-w-0 text-sm font-medium">{row.title}</div>
                  <Badge variant="outline">{row.lane}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{row.route} requires explicit Windows validation before real execution.</p>
              </div>
            ))
          ) : (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">No selected route currently needs admin validation.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PrivacyBoundaryPanel({ boundary }) {
  const warningPreview = boundary.warnings.slice(0, 2);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Privacy boundary
          <Badge variant={boundary.tone}>{boundary.status}</Badge>
        </CardTitle>
        <CardDescription>Local paths, reports, and audit records stay on-device unless the user explicitly exports them.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <QueueStat label="Exports" value={boundary.exportOnly ? "manual" : "auto"} tone={boundary.exportOnly ? "safe" : "restricted"} />
          <QueueStat label="Cloud" value={boundary.cloudDisabled ? "off" : "on"} tone={boundary.cloudDisabled ? "safe" : "restricted"} />
          <QueueStat label="Local records" value={boundary.localRecordCount + boundary.validationRecordCount} tone="review" />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 text-sm font-medium">Data handling</div>
          <div className="space-y-2">
            {boundary.rows.slice(0, 5).map((row) => (
              <div key={row.id} className="grid grid-cols-[18px_1fr_auto] items-start gap-2 text-sm">
                <ShieldCheck className={`mt-0.5 h-4 w-4 ${row.status === "enabled" || row.status === "automatic" ? "text-amber-600" : "text-emerald-600"}`} />
                <div>
                  <div className="font-medium">{row.label}</div>
                  <div className="text-xs text-muted-foreground">{row.detail}</div>
                </div>
                <Badge variant={row.sensitive ? "review" : "outline"}>{row.status}</Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 text-sm font-medium">Never collected</div>
          <div className="flex flex-wrap gap-2">
            {boundary.blockedCollections.slice(0, 6).map((item) => (
              <Badge key={item} variant="restricted">{item}</Badge>
            ))}
          </div>
        </div>

        {warningPreview.length ? (
          <div className="rounded-md border bg-amber-50 p-3 text-sm text-amber-900">
            {warningPreview.join(" ")}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PublicBetaReadinessPanel({ readiness }) {
  const waitingPreview = readiness.waitingRows.slice(0, 4);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Public beta readiness
          <Badge variant={readiness.tone}>{readiness.status}</Badge>
        </CardTitle>
        <CardDescription>{readiness.primary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <QueueStat label="Ready" value={`${readiness.counts.ready}/${readiness.counts.total}`} tone={readiness.readyForNativeBeta ? "safe" : "review"} />
          <QueueStat label="Web demo" value={readiness.readyForWebDemo ? "ready" : "blocked"} tone={readiness.readyForWebDemo ? "safe" : "restricted"} />
          <QueueStat label="Native beta" value={readiness.readyForNativeBeta ? "ready" : "waiting"} tone={readiness.readyForNativeBeta ? "safe" : "review"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Distribution boundary</span>
            <Badge variant={readiness.realRunEnabled ? "restricted" : "safe"}>
              {readiness.realRunEnabled ? "real run visible" : "read-only claim"}
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            {readiness.steps.slice(0, 3).map((step) => (
              <div key={step} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {(waitingPreview.length ? waitingPreview : readiness.rows.slice(0, 4)).map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-auto min-w-0 text-sm font-medium">{row.label}</div>
                <Badge variant={row.passed ? "safe" : row.status === "blocked" ? "restricted" : "review"}>{row.status}</Badge>
                <Badge variant="outline">{row.lane}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{row.detail}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SupportBundlePanel({ bundle, onExport }) {
  const routePreview = bundle.routes.selectedRoutes.slice(0, 3);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Support bundle
          <Badge variant={bundle.redactedPaths ? "safe" : "restricted"}>
            {bundle.redactedPaths ? "redacted" : "path-visible"}
          </Badge>
        </CardTitle>
        <CardDescription>Support diagnostics without local paths or filenames by default.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <QueueStat label="Findings" value={bundle.scan.findingCount} tone="review" />
          <QueueStat label="Warnings" value={bundle.summary.warningCount} tone={bundle.summary.warningCount ? "review" : "safe"} />
          <QueueStat label="Routes" value={bundle.routes.selectedCount} tone="review" />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Redaction boundary</span>
            <Badge variant="safe">paths excluded</Badge>
          </div>
          <div className="flex flex-col gap-2">
            {bundle.supportNotes.slice(0, 3).map((note) => (
              <div key={note} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
                <span className="text-muted-foreground">{note}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {routePreview.length ? (
            routePreview.map((route) => (
              <div key={route.id} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="mr-auto min-w-0 text-sm font-medium">{route.title}</div>
                  <Badge variant={route.canRealRun ? "restricted" : route.canSimulate ? "safe" : "review"}>{route.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{route.route} - {formatBytes(route.bytes)}</p>
              </div>
            ))
          ) : (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">No selected routes are included yet.</div>
          )}
        </div>

        <Button variant="outline" className="w-full" onClick={onExport}>
          <Download className="h-4 w-4" />
          Export support bundle
        </Button>
      </CardContent>
    </Card>
  );
}

function ReleaseReviewPacketPanel({ packet, onExport }) {
  const reviewRows = packet.unsafeRows.length
    ? packet.unsafeRows
    : packet.blockedRows.length
      ? packet.blockedRows
      : packet.waitingRows.length
        ? packet.waitingRows
        : packet.rows.slice(0, 4);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Release review packet
          <Badge variant={packet.tone}>{packet.status}</Badge>
        </CardTitle>
        <CardDescription>{packet.primary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          <QueueStat label="Passed" value={`${packet.counts.passed}/${packet.counts.total}`} tone={packet.status === "review-packet-ready" ? "safe" : "review"} />
          <QueueStat label="Waiting" value={packet.counts.waiting} tone={packet.counts.waiting ? "review" : "safe"} />
          <QueueStat label="Blocked" value={packet.counts.blocked} tone={packet.counts.blocked ? "restricted" : "safe"} />
          <QueueStat label="Unsafe" value={packet.counts.unsafe} tone={packet.counts.unsafe ? "restricted" : "safe"} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Review envelope</span>
            <Badge variant={packet.writeSignalVisible ? "restricted" : "safe"}>
              {packet.writeSignalVisible ? "write visible" : "write locked"}
            </Badge>
            <Badge variant={packet.readyForRealExecution ? "restricted" : "outline"}>
              {packet.readyForRealExecution ? "real-ready" : "review only"}
            </Badge>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
            <div className="truncate">Plan {packet.planId || "missing"}</div>
            <div className="truncate">Scan {packet.scanFingerprint || "missing"}</div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {reviewRows.map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-auto min-w-0 text-sm font-medium">{row.label}</div>
                <Badge variant={row.status === "passed" ? "safe" : row.status === "unsafe" || row.status === "blocked" ? "restricted" : "review"}>
                  {row.status}
                </Badge>
                <Badge variant="outline">{row.lane}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{row.detail}</p>
            </div>
          ))}
        </div>

        <Button variant="outline" className="w-full" onClick={onExport}>
          <Download className="h-4 w-4" />
          Export review packet
        </Button>
      </CardContent>
    </Card>
  );
}

function ValidationEvidencePanel({
  validationPack,
  fixtureImportText,
  fixtureImportReviewer,
  fixtureImportArtifact,
  fixtureImportResult,
  validationPackImportText,
  validationPackImportResult,
  onFixtureImportText,
  onFixtureImportReviewer,
  onFixtureImportArtifact,
  onImportFixtureEvidence,
  onValidationPackImportText,
  onImportValidationPack,
  onToggleEvidence,
  onUpdateEvidence,
  onReset,
  onExport
}) {
  const waitingChecks = validationPack.validationChecks.filter((check) => !check.passed);
  const invariantFailures = validationPack.safetyInvariants.filter((item) => !item.passed);
  const fixturePreview = validationPack.fixtureRoots.slice(0, 3);
  const completeCount = validationPack.validationChecks.filter((check) => check.evidenceComplete).length;
  const draftCount = validationPack.validationChecks.filter((check) => check.evidenceValue && !check.evidenceComplete).length;

  return (
    <Card id="validation-evidence-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Validation evidence
          <Badge variant={validationPack.readyForRealRun ? "safe" : "restricted"}>
            {validationPack.readyForRealRun ? "complete" : "required"}
          </Badge>
        </CardTitle>
        <CardDescription>{validationPack.blockedReason}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <QueueStat label="Waiting" value={waitingChecks.length} tone="review" />
          <QueueStat label="Complete" value={completeCount} tone="safe" />
          <QueueStat label="VMs" value={validationPack.vmScenarios.length} tone="review" />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Fixture evidence import</span>
            <Badge variant={fixtureImportResult?.canApply ? "safe" : fixtureImportResult ? "review" : "outline"}>
              {fixtureImportResult?.status || "waiting"}
            </Badge>
          </div>
          <div className="grid gap-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                value={fixtureImportReviewer}
                placeholder="Reviewer"
                aria-label="fixture evidence reviewer"
                onChange={(event) => onFixtureImportReviewer(event.target.value)}
              />
              <Input
                value={fixtureImportArtifact}
                placeholder="Evidence path or artifact id"
                aria-label="fixture evidence artifact id"
                onChange={(event) => onFixtureImportArtifact(event.target.value)}
              />
            </div>
            <Textarea
              className="min-h-24 font-mono"
              value={fixtureImportText}
              placeholder='{"schemaVersion":"spaceguard-fixture-evidence/v1"}'
              aria-label="fixture evidence json"
              onChange={(event) => onFixtureImportText(event.target.value)}
            />
            <Button variant="outline" className="w-full" onClick={onImportFixtureEvidence} disabled={!fixtureImportText.trim()}>
              <ClipboardList className="h-4 w-4" />
              Import fixture evidence
            </Button>
          </div>

          {fixtureImportResult ? (
            <div className="mt-3 rounded-md border bg-card p-2 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={fixtureImportResult.canApply ? "safe" : "review"}>
                  {fixtureImportResult.canApply ? "mapped" : "blocked"}
                </Badge>
                <span>{fixtureImportResult.detail}</span>
              </div>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                <span>Records: {fixtureImportResult.counts.records}</span>
                <span>Mapped checks: {fixtureImportResult.counts.mappedChecks}</span>
                <span>Dry-run scope cases: {fixtureImportResult.counts.dryRunScopeCases || 0}</span>
                <span>Dry-run scope failures: {fixtureImportResult.counts.dryRunScopeFailures || 0}</span>
                <span>Purposes: {fixtureImportResult.purposes.join(", ") || "none"}</span>
                <span>Artifact: {fixtureImportResult.artifactId || "missing"}</span>
              </div>
              {fixtureImportResult.warnings.length ? (
                <div className="mt-2 flex flex-col gap-1">
                  {fixtureImportResult.warnings.map((warning) => (
                    <span key={warning}>{warning}</span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Validation pack import</span>
            <Badge variant={validationPackImportResult?.canApply ? "safe" : validationPackImportResult ? "review" : "outline"}>
              {validationPackImportResult?.status || "waiting"}
            </Badge>
          </div>
          <div className="grid gap-2">
            <Textarea
              className="min-h-20 font-mono"
              value={validationPackImportText}
              placeholder='Paste spaceguard-validation-pack/v1 JSON or the exported markdown file'
              aria-label="validation pack import"
              onChange={(event) => onValidationPackImportText(event.target.value)}
            />
            <Button variant="outline" className="w-full" onClick={onImportValidationPack} disabled={!validationPackImportText.trim()}>
              <ClipboardList className="h-4 w-4" />
              Import validation pack
            </Button>
          </div>

          {validationPackImportResult ? (
            <div className="mt-3 rounded-md border bg-card p-2 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={validationPackImportResult.canApply ? "safe" : "review"}>
                  {validationPackImportResult.canApply ? "mapped" : "blocked"}
                </Badge>
                <span>{validationPackImportResult.detail}</span>
              </div>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                <span>Rows: {validationPackImportResult.counts.importedRows}/{validationPackImportResult.counts.sourceRows}</span>
                <span>Complete: {validationPackImportResult.counts.complete}</span>
                <span>Needs detail: {validationPackImportResult.counts.needsDetail}</span>
                <span>Failed: {validationPackImportResult.counts.failed}</span>
                <span>Ignored: {validationPackImportResult.counts.ignoredRows}</span>
              </div>
              {validationPackImportResult.warnings.length ? (
                <div className="mt-2 flex flex-col gap-1">
                  {validationPackImportResult.warnings.map((warning) => (
                    <span key={warning}>{warning}</span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Safety invariants</span>
            <Badge variant={invariantFailures.length ? "restricted" : "safe"}>
              {invariantFailures.length ? `${invariantFailures.length} waiting` : "clear"}
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            {validationPack.safetyInvariants.map((item) => (
              <div key={item.id} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <CheckCircle2 className={`mt-0.5 h-4 w-4 ${item.passed ? "text-emerald-600" : "text-muted-foreground"}`} />
                <div>
                  <div className={item.passed ? "font-medium" : "font-medium text-muted-foreground"}>{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Validation evidence ledger</span>
            <Button variant="ghost" size="sm" onClick={onReset} disabled={!completeCount && !draftCount}>
              <X className="h-4 w-4" />
              Reset evidence
            </Button>
          </div>
          <div className="max-h-72 overflow-auto pr-1">
            <div className="flex flex-col gap-2">
              {validationPack.validationChecks.map((check) => {
                const markedPassed = check.evidenceValue === "passed" || check.evidenceValue === "legacy-passed" || check.status === "needs-evidence-detail" || check.status === "legacy-needs-detail";
                return (
                  <div key={check.id} className="rounded-md border bg-card p-3 text-sm">
                    <div className="grid grid-cols-[24px_1fr_auto] items-start gap-2">
                      <Checkbox
                        className="mt-0.5"
                        checked={markedPassed}
                        aria-label={`Record evidence for ${check.label}`}
                        onClick={() => onToggleEvidence(check.id, !markedPassed)}
                      />
                      <div className="min-w-0">
                        <div className={check.passed ? "font-medium" : "font-medium text-muted-foreground"}>{check.label}</div>
                        <div className="text-xs text-muted-foreground">{check.requiredEvidence}</div>
                      </div>
                      <Badge variant={check.passed ? "safe" : check.status === "blocked-by-flag" ? "outline" : check.status === "failed" ? "restricted" : "review"}>
                        {check.passed ? "complete" : check.status}
                      </Badge>
                    </div>

                    <div className="mt-3 grid gap-2">
                      <Input
                        value={check.evidencePath}
                        placeholder="Evidence path or artifact id"
                        aria-label={`${check.label} evidence path`}
                        onChange={(event) => onUpdateEvidence(check.id, "evidencePath", event.target.value)}
                      />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          value={check.reviewer}
                          placeholder="Reviewer"
                          aria-label={`${check.label} reviewer`}
                          onChange={(event) => onUpdateEvidence(check.id, "reviewer", event.target.value)}
                        />
                        <Input
                          value={check.recordedAt}
                          placeholder="Recorded timestamp"
                          aria-label={`${check.label} recorded timestamp`}
                          onChange={(event) => onUpdateEvidence(check.id, "recordedAt", event.target.value)}
                        />
                      </div>
                      <Textarea
                        value={check.notes}
                        placeholder="Notes from the Windows VM run"
                        aria-label={`${check.label} notes`}
                        onChange={(event) => onUpdateEvidence(check.id, "notes", event.target.value)}
                      />
                    </div>

                    {check.evidenceDetail ? (
                      <p className="mt-2 text-xs text-muted-foreground">{check.evidenceDetail}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Local evidence records need reviewer and artifact path before they feed the release gate. They still cannot unlock real execution without native Windows runtime and executor feature flags.
          </p>
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 text-sm font-medium">Fixture roots</div>
          <div className="flex flex-col gap-2">
            {fixturePreview.map((fixture) => (
              <div key={fixture.id} className="rounded-md border bg-card p-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-medium">{fixture.label}</span>
                  <Badge variant="outline">{fixture.lane}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{fixture.assertions[0]}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 text-sm font-medium">Evidence commands</div>
          <div className="flex flex-col gap-2">
            {validationPack.commands.slice(0, 3).map((command) => (
              <div key={command.id} className="grid grid-cols-[1fr_auto] gap-2 text-sm">
                <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{command.command}</span>
                <Badge variant="outline">{command.result}</Badge>
              </div>
            ))}
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={onExport}>
          <Download className="h-4 w-4" />
          Export validation pack
        </Button>
      </CardContent>
    </Card>
  );
}

function ExecutionConsentPanel({ consentReceipt, runReadiness, safetyInterlock, onArm }) {
  const warningPreview = consentReceipt.warnings.slice(0, 3);
  const unsafeStop = safetyInterlock?.status === "unsafe-stop";
  const canArm = runReadiness.ready && !unsafeStop;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Dry-run consent
          <Badge variant={consentReceipt.ready ? "safe" : "review"}>
            {consentReceipt.ready ? "armed" : "required"}
          </Badge>
        </CardTitle>
        <CardDescription>Final acknowledgement is tied to the current plan snapshot and resets when the plan changes.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <QueueStat label="Plan" value={consentReceipt.selectedCount} tone="review" />
          <QueueStat label="Routes" value={consentReceipt.routeCount} tone="review" />
          <QueueStat label="Expected" value={formatBytes(consentReceipt.expectedBytes)} tone="safe" />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Consent receipt</span>
            <Badge variant="outline">{consentReceipt.planId || "no-plan"}</Badge>
          </div>
          <div className="flex flex-col gap-2">
            {consentReceipt.items.map((item) => (
              <div key={item.id} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                <CheckCircle2 className={`mt-0.5 h-4 w-4 ${item.passed ? "text-emerald-600" : "text-muted-foreground"}`} />
                <div>
                  <div className={item.passed ? "font-medium" : "font-medium text-muted-foreground"}>{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {warningPreview.length ? (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="mb-2 text-sm font-medium">Visible consequences</div>
            <div className="flex flex-col gap-2">
              {warningPreview.map((warning) => (
                <div key={warning.id} className="text-sm">
                  <div className="font-medium">{warning.title}</div>
                  <div className="text-xs text-muted-foreground">{warning.consequence}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Consent arm gate</span>
            <Badge variant={canArm ? "safe" : unsafeStop ? "restricted" : "review"}>
              {canArm ? "armable" : unsafeStop ? "unsafe stop" : "waiting"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {unsafeStop ? safetyInterlock.primary : runReadiness.ready ? "Consent can be armed; final launch still requires the safety interlock after consent." : "Resolve run readiness before arming consent."}
          </p>
        </div>

        <Button className="w-full" variant={consentReceipt.ready ? "secondary" : "default"} onClick={onArm} disabled={!canArm}>
          <ShieldCheck className="h-4 w-4" />
          {consentReceipt.ready ? "Current plan armed" : "Arm current dry-run"}
        </Button>
      </CardContent>
    </Card>
  );
}

function LedgerPanel({ ledger, selectedBytes, preflight, runReadiness, consentReceipt, dryRunLaunchGuard, onExecute, onExport }) {
  const reclaimed = ledger.reduce((sum, entry) => sum + entry.bytes, 0);
  const runLabel = ledger.length ? getLedgerRunLabel(ledger[0]?.source) : "";
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Execution ledger
          </span>
          <span className="text-sm font-medium text-muted-foreground">{formatBytes(reclaimed)}</span>
        </CardTitle>
        <CardDescription>
          {ledger.length
            ? `${runLabel} completed.`
            : consentReceipt.ready
              ? `${formatBytes(selectedBytes)} ready for simulation.`
              : `${consentReceipt.blockedCount || runReadiness.blockedCount} consent/readiness check(s) remain.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="mb-2 text-sm font-medium">Execution preflight</div>
            <div className="space-y-2">
              {preflight.items.map((item) => (
                <div key={item.id} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                  <CheckCircle2 className={`mt-0.5 h-4 w-4 ${item.passed ? "text-emerald-600" : "text-muted-foreground"}`} />
                  <div>
                    <div className={item.passed ? "font-medium" : "font-medium text-muted-foreground"}>{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">Run readiness</span>
              <Badge variant={runReadiness.ready ? "safe" : "review"}>
                {runReadiness.ready ? "ready" : "blocked"}
              </Badge>
            </div>
            <div className="space-y-2">
              {runReadiness.items.map((item) => (
                <div key={item.id} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                  <CheckCircle2 className={`mt-0.5 h-4 w-4 ${item.passed ? "text-emerald-600" : "text-muted-foreground"}`} />
                  <div>
                    <div className={item.passed ? "font-medium" : "font-medium text-muted-foreground"}>{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">Dry-run launch guard</span>
              <Badge variant={dryRunLaunchGuard.ready ? "safe" : dryRunLaunchGuard.status === "unsafe-stop" ? "restricted" : "review"}>
                {dryRunLaunchGuard.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{dryRunLaunchGuard.primary}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={dryRunLaunchGuard.dryRunAllowed ? "safe" : "restricted"}>
                {dryRunLaunchGuard.dryRunAllowed ? "dry-run allowed" : "dry-run blocked"}
              </Badge>
              <Badge variant={dryRunLaunchGuard.realRunAllowed ? "restricted" : "safe"}>
                {dryRunLaunchGuard.realRunAllowed ? "real run open" : "real run locked"}
              </Badge>
              <Badge variant="outline">{dryRunLaunchGuard.counts.blocked} blocker(s)</Badge>
            </div>
          </div>

          {ledger.length === 0 ? (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">No actions run yet. The ledger records dry-runs and scoped native executor runs.</div>
          ) : (
            ledger.map((entry) => (
              <div key={entry.id} className="rounded-md border bg-card p-3">
                <div className="flex items-center justify-between gap-3 text-sm font-medium">
                  <span>{entry.time} {entry.title}</span>
                  <span>{formatBytes(entry.bytes)}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{entry.result.toUpperCase()} - {entry.method}</p>
              </div>
            ))
          )}
        </div>
        <Separator />
        <div className="grid gap-2 sm:grid-cols-2">
          <Button className="w-full" disabled={!dryRunLaunchGuard.ready} onClick={onExecute}>
            <Play className="h-4 w-4" />
            Simulate
          </Button>
          <Button className="w-full" variant="outline" onClick={onExport}>
            <Download className="h-4 w-4" />
            Export report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RunHistoryPanel({ historySummary, onExport }) {
  const latest = historySummary.latestRecord;
  const current = historySummary.currentRecord;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Run history
          <Badge variant={historySummary.hasCurrentPlanRecord ? "safe" : "outline"}>
            {historySummary.hasCurrentPlanRecord ? "current saved" : "local"}
          </Badge>
        </CardTitle>
        <CardDescription>Append-only local run evidence for audits, duplicate-run protection, and post-run review.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <QueueStat label="Persisted" value={historySummary.counts.records} tone="review" />
          <QueueStat label="Current" value={historySummary.counts.current} tone="safe" />
          <QueueStat label="Scoped" value={historySummary.counts.scopedNativeExecution || 0} tone="safe" />
          <QueueStat label="Stale" value={historySummary.counts.stale} tone="review" />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Persisted records</span>
            <span className="text-muted-foreground">{formatBytes(historySummary.totalReclaimedBytes)}</span>
          </div>
          {latest ? (
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">{latest.createdAt}</span>
                <Badge variant="outline">{latest.runLabel || latest.scanMode}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Latest recorded {formatBytes(latest.reclaimedBytes)} across {latest.entryCount} step(s).
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No run has been saved on this device yet.</div>
          )}
        </div>

        {current ? (
          <div className="rounded-md border bg-card p-3">
            <div className="flex items-center justify-between gap-3 text-sm font-medium">
              <span>Current plan record</span>
              <span>{formatBytes(current.reclaimedBytes)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Plan {current.planId} is already represented in local history.
            </p>
          </div>
        ) : null}

        <Button variant="outline" className="w-full" onClick={onExport} disabled={historySummary.counts.records === 0}>
          <Download className="h-4 w-4" />
          Export history
        </Button>
      </CardContent>
    </Card>
  );
}

function buildNativeBetaEvidenceLedger(evidence = {}) {
  const rows = nativeBetaEvidenceSpecs.map((spec) => {
    const record = coerceNativeBetaEvidenceFormRecord(evidence?.[spec.id]);
    const passed = isNativeBetaEvidenceRecordComplete(record);
    const hasDetail = Boolean(String(record.evidencePath || record.reviewer || record.notes || "").trim());
    return {
      id: spec.id,
      label: spec.label,
      detail: spec.detail,
      status: passed ? "complete" : record.status === "passed" ? "needs-detail" : hasDetail ? "draft" : "missing",
      passed,
      reviewer: String(record.reviewer || "").trim(),
      evidencePath: String(record.evidencePath || "").trim(),
      notes: String(record.notes || "").replace(/\s+/g, " ").trim(),
      recordedAt: record.recordedAt || "",
      updatedAt: record.updatedAt || record.recordedAt || ""
    };
  });
  const complete = rows.filter((row) => row.passed).length;
  const needsDetail = rows.filter((row) => row.status === "needs-detail").length;
  const draft = rows.filter((row) => row.status === "draft").length;
  const missing = rows.filter((row) => row.status === "missing").length;
  return {
    schemaVersion: "spaceguard-native-beta-evidence/v1",
    status: complete === rows.length ? "complete" : complete || needsDetail || draft ? "partial" : "empty",
    complete: complete === rows.length,
    rows,
    counts: {
      total: rows.length,
      complete,
      needsDetail,
      draft,
      missing
    }
  };
}

function buildNativeBetaEvidenceLedgerMarkdown(ledger) {
  const rows = Array.isArray(ledger?.rows) ? ledger.rows : [];
  return [
    "# SpaceGuard Native Beta Evidence Ledger",
    "",
    `Status: ${ledger?.status || "empty"}`,
    `Generated at: ${ledger?.generatedAt || "not recorded"}`,
    `Complete evidence: ${ledger?.counts?.complete || 0}/${ledger?.counts?.total || rows.length}`,
    `Needs detail: ${ledger?.counts?.needsDetail || 0}`,
    `Drafts: ${ledger?.counts?.draft || 0}`,
    `Missing: ${ledger?.counts?.missing || 0}`,
    "",
    "## Evidence Rows",
    rows.length
      ? rows
          .map((row) => [
            `### ${row.label || row.id}`,
            "",
            `- Status: ${row.status}`,
            `- Reviewer: ${row.reviewer || "missing"}`,
            `- Artifact: ${row.evidencePath || "missing"}`,
            `- Updated: ${row.updatedAt || row.recordedAt || "missing"}`,
            `- Notes: ${row.notes || "none"}`,
            `- Detail: ${row.detail || "none"}`
          ].join("\n"))
          .join("\n\n")
      : "- No evidence rows.",
    "",
    "This ledger is beta distribution evidence only. It does not enable real cleanup."
  ].join("\n");
}

function buildNativeBetaDocumentationEvidence(evidenceLedger = {}) {
  const ledgerRows = Array.isArray(evidenceLedger.rows) ? evidenceLedger.rows : buildNativeBetaEvidenceLedger(evidenceLedger).rows;
  return Object.fromEntries(
    nativeBetaEvidenceSpecs.map((spec) => [spec.id, Boolean(ledgerRows.find((row) => row.id === spec.id)?.passed)])
  );
}

function isNativeBetaEvidenceRecordComplete(record = {}) {
  return record.status === "passed" && Boolean(String(record.evidencePath || "").trim()) && Boolean(String(record.reviewer || "").trim());
}

function readStoredRunHistory() {
  try {
    const raw = globalThis.localStorage?.getItem(RUN_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return buildLedgerHistorySummary(parsed).records.slice(-RUN_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function writeStoredRunHistory(history) {
  try {
    globalThis.localStorage?.setItem(RUN_HISTORY_STORAGE_KEY, JSON.stringify(buildLedgerHistorySummary(history).records.slice(-RUN_HISTORY_LIMIT)));
  } catch {
    // Local storage can be unavailable in hardened browser contexts.
  }
}

function readStoredOpenAIAgentRunHistory() {
  try {
    const raw = globalThis.localStorage?.getItem(OPENAI_AGENT_RUN_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return normalizeOpenAIAgentRunHistory(parsed, { limit: OPENAI_AGENT_RUN_HISTORY_LIMIT });
  } catch {
    return [];
  }
}

function writeStoredOpenAIAgentRunHistory(history) {
  try {
    globalThis.localStorage?.setItem(
      OPENAI_AGENT_RUN_HISTORY_STORAGE_KEY,
      JSON.stringify(normalizeOpenAIAgentRunHistory(history, { limit: OPENAI_AGENT_RUN_HISTORY_LIMIT }))
    );
  } catch {
    // Local storage can be unavailable in hardened browser contexts.
  }
}

function readStoredValidationEvidence() {
  try {
    const raw = globalThis.localStorage?.getItem(VALIDATION_EVIDENCE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => value === true || value === "passed" || (value && typeof value === "object" && !Array.isArray(value)))
    );
  } catch {
    return {};
  }
}

function coerceValidationEvidenceFormRecord(value) {
  if (value === true || value === "passed") {
    return {
      status: "passed",
      evidencePath: "",
      reviewer: "",
      notes: "",
      recordedAt: "",
      updatedAt: ""
    };
  }
  if (!value || typeof value !== "object") {
    return {
      status: "draft",
      evidencePath: "",
      reviewer: "",
      notes: "",
      recordedAt: "",
      updatedAt: ""
    };
  }
  return {
    status: value.status === "passed" || value.status === "failed" || value.status === "draft" ? value.status : "draft",
    evidencePath: value.evidencePath || value.evidence_path || "",
    reviewer: value.reviewer || "",
    notes: value.notes || "",
    recordedAt: value.recordedAt || value.recorded_at || "",
    updatedAt: value.updatedAt || value.updated_at || ""
  };
}

function writeStoredValidationEvidence(evidence) {
  try {
    globalThis.localStorage?.setItem(VALIDATION_EVIDENCE_STORAGE_KEY, JSON.stringify(evidence || {}));
  } catch {
    // Local storage can be unavailable in hardened browser contexts.
  }
}

function readStoredManualStrategyEvidence() {
  try {
    const raw = globalThis.localStorage?.getItem(MANUAL_STRATEGY_EVIDENCE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => value === true || value === "done" || value === "passed")
    );
  } catch {
    return {};
  }
}

function writeStoredManualStrategyEvidence(evidence) {
  try {
    globalThis.localStorage?.setItem(MANUAL_STRATEGY_EVIDENCE_STORAGE_KEY, JSON.stringify(evidence || {}));
  } catch {
    // Local storage can be unavailable in hardened browser contexts.
  }
}

function readStoredCustomRootTriageEvidence() {
  try {
    const raw = globalThis.localStorage?.getItem(CUSTOM_ROOT_TRIAGE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => typeof value === "string" || (value && typeof value === "object" && !Array.isArray(value)))
    );
  } catch {
    return {};
  }
}

function coerceCustomRootTriageFormRecord(value) {
  const record = normalizeCustomRootTriageRecord(value);
  return {
    disposition: record.disposition === "undecided" ? "inspect" : record.disposition,
    owner: record.owner,
    notes: record.notes,
    updatedAt: record.updatedAt
  };
}

function writeStoredCustomRootTriageEvidence(evidence) {
  try {
    globalThis.localStorage?.setItem(CUSTOM_ROOT_TRIAGE_STORAGE_KEY, JSON.stringify(evidence || {}));
  } catch {
    // Local storage can be unavailable in hardened browser contexts.
  }
}

function readStoredNativeBetaEvidence() {
  try {
    const raw = globalThis.localStorage?.getItem(NATIVE_BETA_EVIDENCE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => value === true || value === "passed" || (value && typeof value === "object" && !Array.isArray(value)))
    );
  } catch {
    return {};
  }
}

function coerceNativeBetaEvidenceFormRecord(value) {
  if (value === true || value === "passed") {
    return {
      status: "passed",
      evidencePath: "",
      reviewer: "",
      notes: "",
      recordedAt: "",
      updatedAt: ""
    };
  }
  if (!value || typeof value !== "object") {
    return {
      status: "draft",
      evidencePath: "",
      reviewer: "",
      notes: "",
      recordedAt: "",
      updatedAt: ""
    };
  }
  return {
    status: value.status === "passed" || value.status === "failed" || value.status === "draft" ? value.status : "draft",
    evidencePath: value.evidencePath || value.evidence_path || value.artifactId || value.artifact_id || "",
    reviewer: value.reviewer || "",
    notes: value.notes || "",
    recordedAt: value.recordedAt || value.recorded_at || "",
    updatedAt: value.updatedAt || value.updated_at || ""
  };
}

function writeStoredNativeBetaEvidence(evidence) {
  try {
    globalThis.localStorage?.setItem(NATIVE_BETA_EVIDENCE_STORAGE_KEY, JSON.stringify(evidence || {}));
  } catch {
    // Local storage can be unavailable in hardened browser contexts.
  }
}

function readStoredRollbackEvidence() {
  try {
    const raw = globalThis.localStorage?.getItem(ROLLBACK_EVIDENCE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => value === true || value === "proved" || value === "complete" || (value && typeof value === "object" && !Array.isArray(value)))
    );
  } catch {
    return {};
  }
}

function coerceRollbackEvidenceFormRecord(value) {
  if (value === true || value === "proved" || value === "complete") {
    return {
      status: "proved",
      restoreLocation: "",
      evidencePath: "",
      reviewer: "",
      notes: "",
      recordedAt: "",
      updatedAt: ""
    };
  }
  if (!value || typeof value !== "object") {
    return {
      status: "draft",
      restoreLocation: "",
      evidencePath: "",
      reviewer: "",
      notes: "",
      recordedAt: "",
      updatedAt: ""
    };
  }
  return {
    status: value.status === "proved" || value.status === "complete" ? "proved" : value.status === "failed" ? "failed" : "draft",
    restoreLocation: value.restoreLocation || value.restore_location || value.backupReference || value.backup_reference || value.acknowledgementReference || value.acknowledgement_reference || "",
    evidencePath: value.evidencePath || value.evidence_path || value.artifactId || value.artifact_id || "",
    reviewer: value.reviewer || "",
    notes: value.notes || "",
    recordedAt: value.recordedAt || value.recorded_at || "",
    updatedAt: value.updatedAt || value.updated_at || ""
  };
}

function writeStoredRollbackEvidence(evidence) {
  try {
    globalThis.localStorage?.setItem(ROLLBACK_EVIDENCE_STORAGE_KEY, JSON.stringify(evidence || {}));
  } catch {
    // Local storage can be unavailable in hardened browser contexts.
  }
}
