import { useEffect, useMemo, useState } from "react";
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
  buildFixtureEvidenceImport,
  buildPlanReview,
  buildAgentQuestionQueue,
  buildDecisionLog,
  appendLedgerRunRecord,
  buildExecutorManifest,
  buildExecutorPlan,
  buildExecutorReadiness,
  buildLedgerHistoryMarkdown,
  buildLedgerHistorySummary,
  buildLedgerRunRecord,
  buildPostRunVerificationMarkdown,
  buildPostRunVerificationPlan,
  buildPrivilegeBoundary,
  buildPrivacyBoundary,
  buildPublicBetaReadiness,
  buildRescanComparison,
  buildRescanComparisonMarkdown,
  buildManualStrategyChecklist,
  buildReleaseGate,
  buildRecoveryAdvisor,
  buildRealExecutorCapsule,
  buildRollbackPlan,
  buildItemReview,
  buildReport,
  buildPlanSnapshot,
  buildReviewItemsByAction,
  buildReviewWorkbench,
  buildScenarioActions,
  buildSuggestedPlan,
  buildRunReadiness,
  buildScanCoverageSummary,
  buildStorageStrategyPlan,
  buildSupportBundle,
  buildSupportBundleMarkdown,
  buildToolCommandInventory,
  buildValidationEvidencePack,
  buildValidationPackMarkdown,
  buildVerificationSummary,
  buildWriteBoundaryProbe,
  buildWriteReadiness,
  computeTotals,
  formatBytes,
  gates,
  getExecutionReadinessForActions,
  getScenario,
  isActionProtected,
  makeExecutionLedgerForActions,
  scenarios,
  selectableAction,
  selectedByDefault
} from "./spaceguard-model.mjs";
import {
  getNativeScannerCapability,
  getNativeRuntimeCapabilities,
  mergeNativeScanIntoActions,
  runNativeExecutorDryRun,
  runNativeReadonlyScan,
  runNativeWriteBoundary
} from "./native-scanner.mjs";

const RUN_HISTORY_STORAGE_KEY = "spaceguard.ledgerHistory.v1";
const VALIDATION_EVIDENCE_STORAGE_KEY = "spaceguard.validationEvidence.v1";
const MANUAL_STRATEGY_EVIDENCE_STORAGE_KEY = "spaceguard.manualStrategyEvidence.v1";
const ROLLBACK_EVIDENCE_STORAGE_KEY = "spaceguard.rollbackEvidence.v1";
const RUN_HISTORY_LIMIT = 25;
const filters = ["all", "safe", "rebuildable", "review", "advanced", "restricted"];
const modes = [
  ["safe", "Safe"],
  ["balanced", "Balanced"],
  ["emergency", "Emergency"]
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
  const [filter, setFilter] = useState("all");
  const [protectedPaths, setProtectedPaths] = useState([]);
  const [protectedInput, setProtectedInput] = useState("");
  const [focusedReviewId, setFocusedReviewId] = useState("downloads-installers");
  const [nativeScan, setNativeScan] = useState({ status: "idle", result: null, error: "" });
  const [scanSettings, setScanSettings] = useState({
    includeProjectArtifacts: true,
    maxDepth: 8,
    maxEntriesPerRoot: 25000,
    customRoots: []
  });
  const [customRootInput, setCustomRootInput] = useState("");
  const [nativeExecutorDryRun, setNativeExecutorDryRun] = useState({ status: "idle", result: null, error: "" });
  const [nativeWriteBoundary, setNativeWriteBoundary] = useState({ status: "idle", result: null, error: "" });
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
      safeExecutorsEnabled: false,
      reason: "Runtime capability check has not completed."
    },
    error: ""
  });
  const [selectedIds, setSelectedIds] = useState(() => {
    const initialActions = buildScenarioActions("developer");
    return new Set(initialActions.filter(selectedByDefault).map((action) => action.id));
  });
  const [approvals, setApprovals] = useState({ groupConfirm: false, reviewed: {}, reviewItems: {}, typed: {} });
  const [ledger, setLedger] = useState([]);
  const [runHistory, setRunHistory] = useState(() => readStoredRunHistory());
  const [validationEvidence, setValidationEvidence] = useState(() => readStoredValidationEvidence());
  const [manualStrategyEvidence, setManualStrategyEvidence] = useState(() => readStoredManualStrategyEvidence());
  const [rollbackEvidence, setRollbackEvidence] = useState(() => readStoredRollbackEvidence());
  const [fixtureImportText, setFixtureImportText] = useState("");
  const [fixtureImportReviewer, setFixtureImportReviewer] = useState("");
  const [fixtureImportArtifact, setFixtureImportArtifact] = useState("");
  const [fixtureImportResult, setFixtureImportResult] = useState(null);
  const [executionConsent, setExecutionConsent] = useState({ accepted: false, planId: "", acceptedAt: "" });

  const scenario = useMemo(() => getScenario(scenarioId), [scenarioId]);
  const nativeCapability = useMemo(() => getNativeScannerCapability(globalThis), []);

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
    writeStoredValidationEvidence(validationEvidence);
  }, [validationEvidence]);

  useEffect(() => {
    writeStoredManualStrategyEvidence(manualStrategyEvidence);
  }, [manualStrategyEvidence]);

  useEffect(() => {
    writeStoredRollbackEvidence(rollbackEvidence);
  }, [rollbackEvidence]);

  const dataMode = nativeScan.result?.available ? "native-readonly" : "demo";
  const profile = useMemo(
    () => {
      if (!nativeScan.result?.available) return scenario.profile;
      const volume = nativeScan.result.volume;
      return {
        ...scenario.profile,
        machine: "Real read-only scanner",
        drive: volume?.drive || scenario.profile.drive,
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
    [scenario, nativeScan.result]
  );
  const baseActions = useMemo(() => buildScenarioActions(scenarioId), [scenarioId]);
  const actionList = useMemo(() => mergeNativeScanIntoActions(baseActions, nativeScan.result), [baseActions, nativeScan.result]);
  const scanCoverage = useMemo(
    () => buildScanCoverageSummary({ actionList, scanMode: dataMode, nativeScan: nativeScan.result }),
    [actionList, dataMode, nativeScan.result]
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
  const planSnapshot = useMemo(
    () =>
      buildPlanSnapshot({
        selectedIds,
        actionList,
        approvals,
        protectedPaths,
        itemReviewsByAction,
        scanMode: dataMode,
        goalBytes: goalGb * GB
      }),
    [selectedIds, actionList, approvals, protectedPaths, itemReviewsByAction, dataMode, goalGb]
  );
  const ledgerHistorySummary = useMemo(
    () => buildLedgerHistorySummary(runHistory, planSnapshot),
    [runHistory, planSnapshot]
  );
  const activeLedger = ledger.length ? ledger : ledgerHistorySummary.currentLedger;
  const totals = useMemo(() => computeTotals(selectedIds, actionList, { approvals, itemReviewsByAction }), [selectedIds, actionList, approvals, itemReviewsByAction]);
  const readiness = useMemo(
    () => getExecutionReadinessForActions(selectedIds, approvals, actionList, protectedPaths, itemReviewsByAction),
    [selectedIds, approvals, actionList, protectedPaths, itemReviewsByAction]
  );
  const planReview = useMemo(
    () => buildPlanReview(actionList, selectedIds, approvals, protectedPaths, itemReviewsByAction),
    [actionList, selectedIds, approvals, protectedPaths, itemReviewsByAction]
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
        planSnapshot
      }),
    [scanned, dataMode, goalGb, actionList, selectedIds, approvals, protectedPaths, activeLedger, itemReviewsByAction, planSnapshot]
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
        itemReviewsByAction
      }),
    [scanned, scanning, dataMode, actionList, selectedIds, approvals, readiness, protectedPaths, activeLedger, goalGb, itemReviewsByAction]
  );
  const reviewWorkbench = useMemo(
    () => buildReviewWorkbench(actionList, selectedIds, approvals, protectedPaths, itemReviewsByAction),
    [actionList, selectedIds, approvals, protectedPaths, itemReviewsByAction]
  );
  const itemReview = useMemo(
    () => itemReviewsByAction[focusedReviewId] || buildItemReview(focusedReviewId, actionList, nativeScan.result, protectedPaths, approvals),
    [focusedReviewId, itemReviewsByAction, actionList, nativeScan.result, protectedPaths, approvals]
  );
  const preflight = useMemo(
    () => buildExecutionPreflight({ scanned, scanning, selectedIds, actionList, readiness, protectedPaths, ledger: activeLedger, planSnapshot }),
    [scanned, scanning, selectedIds, actionList, readiness, protectedPaths, activeLedger, planSnapshot]
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
        itemReviewsByAction
      }),
    [selectedIds, actionList, approvals, protectedPaths, dataMode, preflight, itemReviewsByAction]
  );
  const executorReadiness = useMemo(
    () => buildExecutorReadiness(executorPlan, preflight),
    [executorPlan, preflight]
  );
  const runReadiness = useMemo(
    () => buildRunReadiness(preflight, executorReadiness),
    [preflight, executorReadiness]
  );
  const consentReceipt = useMemo(
    () => buildExecutionConsentReceipt({ planSnapshot, executorPlan, runReadiness, consent: executionConsent }),
    [planSnapshot, executorPlan, runReadiness, executionConsent]
  );
  const verificationSummary = useMemo(
    () =>
      buildVerificationSummary({
        planSnapshot,
        ledger: activeLedger,
        executorPlan,
        scanMode: dataMode,
        nativeScan: nativeScan.result
      }),
    [planSnapshot, activeLedger, executorPlan, dataMode, nativeScan.result]
  );
  const postRunVerification = useMemo(
    () =>
      buildPostRunVerificationPlan({
        planSnapshot,
        ledger: activeLedger,
        executorPlan,
        scanMode: dataMode,
        nativeScan: nativeScan.result
      }),
    [planSnapshot, activeLedger, executorPlan, dataMode, nativeScan.result]
  );
  const rescanComparison = useMemo(
    () =>
      buildRescanComparison({
        postRunVerification,
        nativeScan: nativeScan.result,
        scanMode: dataMode,
        ledger: activeLedger,
        planSnapshot
      }),
    [postRunVerification, nativeScan.result, dataMode, activeLedger, planSnapshot]
  );
  const rollbackPlan = useMemo(
    () =>
      buildRollbackPlan({
        planSnapshot,
        executorPlan,
        itemReviewsByAction,
        postRunVerification,
        rollbackEvidence,
        scanMode: dataMode
      }),
    [planSnapshot, executorPlan, itemReviewsByAction, postRunVerification, rollbackEvidence, dataMode]
  );
  const releaseGate = useMemo(
    () =>
      buildReleaseGate({
        scanMode: dataMode,
        nativeCapability,
        executorPlan,
        validationEvidence,
        featureFlags: {
          realExecutors: Boolean(runtimeCapabilities.result.realRunEnabled),
          tempCleanupExecutor: Boolean(runtimeCapabilities.result.safeExecutorsEnabled),
          recycleBinExecutor: Boolean(runtimeCapabilities.result.safeExecutorsEnabled),
          browserCacheExecutor: Boolean(runtimeCapabilities.result.safeExecutorsEnabled),
          toolNativePruneExecutors: Boolean(runtimeCapabilities.result.safeExecutorsEnabled)
        }
      }),
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
  const writeBoundaryProbe = useMemo(
    () =>
      buildWriteBoundaryProbe({
        nativeWriteBoundary,
        realExecutorCapsule,
        runtimeCapabilities: runtimeCapabilities.result
      }),
    [nativeWriteBoundary, realExecutorCapsule, runtimeCapabilities.result]
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
  const agentQuestionQueue = useMemo(
    () =>
      buildAgentQuestionQueue({
        scanned,
        scanning,
        scanMode: dataMode,
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
        validationPack,
        fixtureImportResult,
        writeBoundaryProbe
      }),
    [
      scanned,
      scanning,
      dataMode,
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
      validationPack,
      fixtureImportResult,
      writeBoundaryProbe
    ]
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
        documentationEvidence: {
          publicReleaseResearch: true,
          windowsRealDataSetup: true
        }
      }),
    [dataMode, nativeCapability, runtimeCapabilities.result, releaseGate, privacyBoundary, validationEvidence]
  );
  const supportBundle = useMemo(
    () =>
      buildSupportBundle({
        profile,
        scanMode: dataMode,
        scanSettings,
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
    [profile, dataMode, scanSettings, nativeScan.result, scanCoverage, privacyBoundary, publicBetaReadiness, releaseGate, runtimeCapabilities.result, executorPlan, rollbackPlan, ledgerHistorySummary]
  );
  const families = useMemo(() => buildFamilyGroups(selectedIds, actionList, { approvals, itemReviewsByAction }), [selectedIds, actionList, approvals, itemReviewsByAction]);
  const usedPercent = Math.round((profile.usedBytes / profile.totalBytes) * 100);
  const selectedPercent = Math.min(100, Math.round((totals.selectedBytes / (goalGb * GB)) * 100));

  const filteredActions = useMemo(() => {
    return actionList.filter((action) => filter === "all" || action.risk === filter);
  }, [filter, actionList]);

  function clearExecutionState() {
    setLedger([]);
    setNativeExecutorDryRun({ status: "idle", result: null, error: "" });
    setNativeWriteBoundary({ status: "idle", result: null, error: "" });
    setExecutionConsent({ accepted: false, planId: "", acceptedAt: "" });
  }

  function updateScanSetting(key, value) {
    setScanSettings((current) => ({ ...current, [key]: value }));
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
    setApprovals({ groupConfirm: false, reviewed: {}, reviewItems: {}, typed: {} });
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

    setNativeScan({ status: "scanning", result: null, error: "" });
    setApprovals({ groupConfirm: false, reviewed: {}, reviewItems: {}, typed: {} });
    setScanning(true);
    setScanned(false);
    setScanProgress(0);
    setScanLabel("Starting native read-only scan");
    clearExecutionState();
    setActiveStage("discover");

    try {
      const result = await runNativeReadonlyScan({
        protectedPaths,
        ...scanSettings
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

  function applyModeDefaults(nextMode, force = false, planActions = actionList) {
    if (!scanned && !force) return;

    if (nextMode === "safe") {
      setSelectedIds(
        new Set(
          planActions
            .filter((action) => action.gate === "auto" || (action.selectedByDefault && action.risk === "rebuildable"))
            .filter((action) => selectableAction(action, protectedPaths))
            .map((action) => action.id)
        )
      );
    }

    if (nextMode === "balanced") {
      setSelectedIds(buildSuggestedPlan(goalGb * GB, new Set(planActions.filter((action) => selectedByDefault(action, protectedPaths)).map((action) => action.id)), planActions, protectedPaths));
    }

    if (nextMode === "emergency") {
      setSelectedIds(new Set(planActions.filter((action) => selectableAction(action, protectedPaths) && action.risk !== "advisory").map((action) => action.id)));
    }

    clearExecutionState();
    setActiveStage("gate");
  }

  function setModeAndPlan(nextMode) {
    setMode(nextMode);
    applyModeDefaults(nextMode);
  }

  function approveRebuildableCaches() {
    setApprovals((current) => ({ ...current, groupConfirm: true }));
    clearExecutionState();
    setActiveStage("gate");
  }

  function suggestPlan() {
    if (!scanned) {
      runScan();
      return;
    }
    setSelectedIds(buildSuggestedPlan(goalGb * GB, new Set(), actionList, protectedPaths));
    clearExecutionState();
    setActiveStage("gate");
  }

  function toggleAction(action) {
    if (!scanned || !selectableAction(action, protectedPaths)) return;
    const willSelect = !selectedIds.has(action.id);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return next;
    });
    if (willSelect && action.gate === "review") setFocusedReviewId(action.id);
    clearExecutionState();
  }

  async function simulateCleanup() {
    if (!consentReceipt.ready) return;
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

    setLedger(nextLedger);
    recordLedgerRun(nextLedger);
    window.setTimeout(() => setActiveStage("verify"), 240);
  }

  function recordLedgerRun(nextLedger) {
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
      createdAt: new Date().toISOString()
    });
    setRunHistory((current) => appendLedgerRunRecord(current, record, { limit: RUN_HISTORY_LIMIT }));
  }

  function armExecutionConsent() {
    if (!runReadiness.ready) return;
    setExecutionConsent({
      accepted: true,
      planId: planSnapshot.id,
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
      const result = await runNativeWriteBoundary({ ...realExecutorCapsule, planId: planSnapshot.id });
      setNativeWriteBoundary({ status: "complete", result, error: "" });
    } catch (error) {
      setNativeWriteBoundary({
        status: "error",
        result: null,
        error: error instanceof Error ? error.message : String(error)
      });
    }
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
    setApprovals({ groupConfirm: false, reviewed: {}, reviewItems: {}, typed: {} });
    setSelectedIds(new Set(nextActions.filter((action) => selectedByDefault(action, protectedPaths)).map((action) => action.id)));
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
      nativeScan: nativeScan.result,
      advisor: recoveryAdvisor,
      decisionLog,
      agentQuestionQueue,
      itemReview,
      executorPlan,
      releaseGate,
      validationPack,
      runtimeCapabilities: runtimeCapabilities.result,
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
      executorManifest,
      toolCommandInventory,
      writeReadiness,
      realExecutorCapsule,
      writeBoundaryProbe,
      ledgerHistorySummary,
      storageStrategy,
      manualStrategyChecklist,
      scanCoverage
    });
    downloadTextFile("spaceguard-dry-run-report.md", report, "text/markdown;charset=utf-8");
  }

  function exportRunHistory() {
    downloadTextFile("spaceguard-run-history.md", buildLedgerHistoryMarkdown(ledgerHistorySummary), "text/markdown;charset=utf-8");
  }

  function exportPostRunVerification() {
    downloadTextFile("spaceguard-post-run-verification.md", buildPostRunVerificationMarkdown(postRunVerification), "text/markdown;charset=utf-8");
  }

  function exportRescanComparison() {
    downloadTextFile("spaceguard-rescan-comparison.md", buildRescanComparisonMarkdown(rescanComparison), "text/markdown;charset=utf-8");
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
                <Button className="w-full" variant="outline" onClick={runRealReadonlyScan} disabled={scanning || !nativeCapability.available}>
                  {nativeScan.status === "scanning" ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                  {nativeCapability.available ? "Run real scan" : "Native app required"}
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

            <NativeScanSettingsPanel
              settings={scanSettings}
              customRootInput={customRootInput}
              onCustomRootInput={setCustomRootInput}
              onAddCustomRoot={addCustomScanRoot}
              onRemoveCustomRoot={removeCustomScanRoot}
              onChange={updateScanSetting}
              nativeScan={nativeScan}
            />

            <ScanCoveragePanel coverage={scanCoverage} />

            <RecoveryAdvisorPanel advisor={recoveryAdvisor} onSuggest={suggestPlan} />

            <AgentQuestionPanel
              queue={agentQuestionQueue}
              nativeCapability={nativeCapability}
              onRunScan={runScan}
              onRunRealScan={runRealReadonlyScan}
              onSuggestPlan={suggestPlan}
              onApproveRebuildable={approveRebuildableCaches}
              onFocusReview={setFocusedReviewId}
              onFocusPanel={focusWorkflowPanel}
              onArmConsent={armExecutionConsent}
              onSimulate={simulateCleanup}
              onProbeWriteBoundary={probeNativeWriteBoundary}
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

            <Card>
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
            <GatePanel
              actionList={actionList}
              selectedIds={selectedIds}
              approvals={approvals}
              setApprovals={setApprovals}
              scanned={scanned}
              readiness={readiness}
              protectedPaths={protectedPaths}
              itemReviewsByAction={itemReviewsByAction}
            />
            <TracePanel activeStage={activeStage} />
            <ExecutorPolicyPanel executorPlan={executorPlan} executorReadiness={executorReadiness} nativeExecutorDryRun={nativeExecutorDryRun} />
            <ExecutorManifestPanel manifest={executorManifest} />
            <ToolCommandInventoryPanel inventory={toolCommandInventory} />
            <VerificationPanel planSnapshot={planSnapshot} verificationSummary={verificationSummary} />
            <PostRunVerificationPanel verification={postRunVerification} onExport={exportPostRunVerification} />
            <RescanComparisonPanel comparison={rescanComparison} onExport={exportRescanComparison} />
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
            <ReleaseGatePanel releaseGate={releaseGate} runtimeCapabilities={runtimeCapabilities} />
            <WriteReadinessPanel readiness={writeReadiness} />
            <RealExecutorCapsulePanel capsule={realExecutorCapsule} />
            <WriteBoundaryProbePanel
              probe={writeBoundaryProbe}
              nativeWriteBoundary={nativeWriteBoundary}
              runtimeCapabilities={runtimeCapabilities}
              onProbe={probeNativeWriteBoundary}
            />
            <ValidationEvidencePanel
              validationPack={validationPack}
              fixtureImportText={fixtureImportText}
              fixtureImportReviewer={fixtureImportReviewer}
              fixtureImportArtifact={fixtureImportArtifact}
              fixtureImportResult={fixtureImportResult}
              onFixtureImportText={setFixtureImportText}
              onFixtureImportReviewer={setFixtureImportReviewer}
              onFixtureImportArtifact={setFixtureImportArtifact}
              onImportFixtureEvidence={importFixtureEvidence}
              onToggleEvidence={setValidationCheckEvidence}
              onUpdateEvidence={updateValidationCheckEvidence}
              onReset={resetValidationEvidence}
              onExport={exportValidationPack}
            />
            <ExecutionConsentPanel consentReceipt={consentReceipt} runReadiness={runReadiness} onArm={armExecutionConsent} />
            <LedgerPanel ledger={activeLedger} selectedBytes={totals.selectedBytes} preflight={preflight} runReadiness={runReadiness} consentReceipt={consentReceipt} onExecute={simulateCleanup} onExport={exportReport} />
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
    <Card>
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

function NativeScanSettingsPanel({
  settings,
  customRootInput,
  onCustomRootInput,
  onAddCustomRoot,
  onRemoveCustomRoot,
  onChange,
  nativeScan
}) {
  const depthOptions = [4, 6, 8, 10];
  const entryOptions = [5000, 10000, 25000, 50000];
  const hasNativeEvidence = Boolean(nativeScan.result);
  const customRoots = settings.customRoots || [];

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
          <Badge variant={hasNativeEvidence ? "review" : "safe"}>
            {hasNativeEvidence ? "current scan set" : "ready"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
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

        <div className="grid gap-2 sm:grid-cols-4">
          <QueueStat label="Depth" value={settings.maxDepth} tone="review" />
          <QueueStat label="Cap" value={`${settings.maxEntriesPerRoot / 1000}k`} tone="review" />
          <QueueStat label="Projects" value={settings.includeProjectArtifacts ? "on" : "off"} tone={settings.includeProjectArtifacts ? "safe" : "advisory"} />
          <QueueStat label="Custom" value={customRoots.length} tone={customRoots.length ? "review" : "safe"} />
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
  onFocusReview,
  onFocusPanel,
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
    if (question.action === "focus-review" && question.actionId) onFocusReview(question.actionId);
    if (question.action === "focus-panel" && question.targetPanel) onFocusPanel(question.targetPanel);
    if (question.action === "arm-consent") onArmConsent();
    if (question.action === "simulate") onSimulate();
    if (question.action === "run-real-scan") onRunRealScan();
    if (question.action === "probe-write-boundary") onProbeWriteBoundary();
  }

  return (
    <Card>
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

function questionActionLabel(question) {
  if (question.action === "suggest-plan") return "Rebuild plan";
  if (question.action === "approve-rebuildable") return "Approve caches";
  if (question.action === "focus-review") return "Open item review";
  if (question.action === "focus-panel" && question.targetPanel === "rollback-plan-panel") return "Open rollback proof";
  if (question.action === "focus-panel" && question.targetPanel === "validation-evidence-panel") return "Open validation import";
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
    <Card>
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
    <Card>
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
    <Card>
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
        <div className="grid gap-2 md:grid-cols-4">
          <ReviewStat label="Remove" value={formatBytes(itemReview.removeBytes)} />
          <ReviewStat label="Move/archive" value={formatBytes(itemReview.manualDispositionBytes || 0)} />
          <ReviewStat label="Keep" value={String(itemReview.keepCount)} />
          <ReviewStat label="Undecided" value={String(itemReview.undecidedCount)} />
        </div>

        {action ? (
          <div className="flex flex-wrap gap-2 rounded-md border bg-muted/30 p-3">
            <div className="min-w-[160px] flex-1">
              <div className="text-sm font-medium">Item decisions</div>
              <p className="text-sm text-muted-foreground">Only Remove enters executor preview. Move and Archive are manual follow-along decisions.</p>
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
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{item.path}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={item.decision === "remove" ? "destructive" : "outline"}
                    disabled={item.protected}
                    onClick={() => onDecision(action.id, item.id, "remove")}
                  >
                    Remove
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={item.decision === "keep" ? "secondary" : "outline"}
                    onClick={() => onDecision(action.id, item.id, "keep")}
                  >
                    Keep
                  </Button>
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

function ActionRow({ action, selected, scanned, protectedByUser, onToggle, onProtect }) {
  const selectable = selectableAction(action, protectedByUser ? [action.path] : []);
  const disabled = !scanned || !selectable;
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
          {action.scanSource ? <Badge variant={action.scanStatus === "missing" ? "outline" : "safe"}>{action.scanStatus}</Badge> : null}
          {protectedByUser ? <Badge variant="restricted">protected</Badge> : null}
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
          {protectedByUser ? "protected" : action.scanSource ? "real data" : selectable ? (selected ? "planned" : "available") : "locked"}
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

function GatePanel({ actionList, selectedIds, approvals, setApprovals, scanned, readiness, protectedPaths, itemReviewsByAction }) {
  const selected = actionList.filter((action) => selectedIds.has(action.id));
  const selectedReview = selected.filter((action) => action.gate === "review");
  const selectedTyped = selected.filter((action) => action.gate === "typed");
  const hasGroupConfirm = selected.some((action) => action.gate === "groupConfirm");
  const blockedCount = actionList.filter((action) => action.gate === "blocked").length;
  const protectedCount = actionList.filter((action) => isActionProtected(action, protectedPaths)).length;

  return (
    <Card>
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
        <GateNote title="Locked by policy" detail={`${blockedCount} zones are visible but cannot execute: Docker volumes, browser identity data, pagefile changes, and destructive system areas.`} />
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

function ExecutorPolicyPanel({ executorPlan, executorReadiness, nativeExecutorDryRun }) {
  const previewRows = executorPlan.rows.slice(0, 5);

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
        </div>

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

function WriteBoundaryProbePanel({ probe, nativeWriteBoundary, runtimeCapabilities, onProbe }) {
  const runtimeReady = Boolean(runtimeCapabilities.result.executeCleanupPlan);
  const hasRows = probe.counts.selectedRows > 0;
  const running = nativeWriteBoundary.status === "running";
  const disabled = running || !runtimeReady || !hasRows;

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
        <div className="grid grid-cols-3 gap-2">
          <QueueStat label="Entries" value={probe.counts.entries} tone={probe.rejectionEvidence ? "safe" : "review"} />
          <QueueStat label="Rejected" value={probe.counts.rejected} tone={probe.rejectionEvidence ? "safe" : "restricted"} />
          <QueueStat label="Bytes" value={formatBytes(probe.counts.bytes)} tone={probe.counts.bytes ? "restricted" : "safe"} />
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

function PostRunVerificationPanel({ verification, onExport }) {
  const preview = verification.checkpoints.slice(0, 4);

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
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">Run simulation to generate affected-root checkpoints.</div>
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

function RescanComparisonPanel({ comparison, onExport }) {
  const preview = comparison.rows.slice(0, 4);

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
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">Run simulation and then a native read-only scan to compare affected roots.</div>
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

function ValidationEvidencePanel({
  validationPack,
  fixtureImportText,
  fixtureImportReviewer,
  fixtureImportArtifact,
  fixtureImportResult,
  onFixtureImportText,
  onFixtureImportReviewer,
  onFixtureImportArtifact,
  onImportFixtureEvidence,
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

function ExecutionConsentPanel({ consentReceipt, runReadiness, onArm }) {
  const warningPreview = consentReceipt.warnings.slice(0, 3);

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

        <Button className="w-full" variant={consentReceipt.ready ? "secondary" : "default"} onClick={onArm} disabled={!runReadiness.ready}>
          <ShieldCheck className="h-4 w-4" />
          {consentReceipt.ready ? "Current plan armed" : "Arm current dry-run"}
        </Button>
      </CardContent>
    </Card>
  );
}

function LedgerPanel({ ledger, selectedBytes, preflight, runReadiness, consentReceipt, onExecute, onExport }) {
  const reclaimed = ledger.reduce((sum, entry) => sum + entry.bytes, 0);
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
            ? "Dry-run execution completed."
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

          {ledger.length === 0 ? (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">No actions run yet. The ledger records every simulated step.</div>
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
          <Button className="w-full" disabled={!consentReceipt.ready} onClick={onExecute}>
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
        <CardDescription>Append-only local dry-run evidence for audits and duplicate-run protection.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <QueueStat label="Persisted" value={historySummary.counts.records} tone="review" />
          <QueueStat label="Current" value={historySummary.counts.current} tone="safe" />
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
                <Badge variant="outline">{latest.scanMode}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Latest simulated {formatBytes(latest.reclaimedBytes)} across {latest.entryCount} step(s).
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No dry-run has been saved on this device yet.</div>
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
