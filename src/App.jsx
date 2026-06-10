import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FolderSearch,
  HardDrive,
  History,
  KeyRound,
  ListTree,
  Loader2,
  Lock,
  RefreshCcw,
  ScanLine,
  ShieldCheck,
  Trash2
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
  getNativeScannerCapability,
  getNativeRuntimeCapabilities,
  runNativeAndroidCacheExecutor,
  runNativeBrowserCacheExecutor,
  runNativeDockerBuildCacheExecutor,
  runNativeDownloadsCleanupExecutor,
  runNativeGradleCacheExecutor,
  runNativeLargeFileArchiveExecutor,
  runNativeNpmCacheExecutor,
  runNativePipCacheExecutor,
  runNativePnpmStoreExecutor,
  runNativeProjectDependencyExecutor,
  runNativeReadonlyScan,
  runNativeRecycleBinExecutor,
  runNativeShaderCacheExecutor,
  runNativeTempCleanupExecutor,
  runNativeUserCacheExecutor
} from "./native-scanner.mjs";
import { buildOpenAIAgentRecommendationBroker, requestOpenAIAgentAdvice } from "./openai-agent.mjs";
import { buildAppAgentTaskQueue, buildExecutionGate, buildExecutionLedgerRows, buildExecutionPrerequisites, buildManualFindingGuidance, buildManualFindingReviewRows, buildPostRunProof, buildRouteReadiness, buildWorkflowAgentTargetId, buildWorkflowLocks, formatBytes, parseWorkflowTimestamp, resolveWorkflowAgentBrokerCandidate } from "./real-workflow.mjs";

const DEFAULT_SCAN_REQUEST = {
  targetDrive: "C:",
  protectedPaths: "",
  customRoots: "",
  includeProjectArtifacts: true,
  maxDepth: 8,
  maxEntriesPerRoot: 25000
};
const EXECUTOR_RECIPES = {
  "windows-temp": {
    label: "Windows temp cleanup",
    route: "known-temp-delete",
    routeInput: "known-temp-delete",
    flagKey: "tempCleanupExecutor",
    envVar: "SPACEGUARD_ENABLE_TEMP_EXECUTOR",
    executor: "temp",
    actionType: "run-temp-executor",
    risk: "safe",
    targetKind: "cache root",
    consequence: "Old Windows temp files are removed."
  },
  "browser-cache": {
    label: "Browser cache cleanup",
    route: "browser-cache-only",
    routeInput: "browser-cache",
    flagKey: "browserCacheExecutor",
    envVar: "SPACEGUARD_ENABLE_BROWSER_CACHE_EXECUTOR",
    executor: "browserCache",
    actionType: "run-browser-cache-executor",
    risk: "rebuildable",
    targetKind: "cache root",
    consequence: "Browser cache files are removed. Cookies and sign-in data are not touched."
  },
  "gradle-cache": {
    label: "Gradle cache cleanup",
    route: "bounded-cache-delete",
    routeInput: "gradle-cache",
    flagKey: "gradleCacheExecutor",
    envVar: "SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR",
    executor: "gradle",
    actionType: "run-gradle-cache-executor",
    risk: "rebuildable",
    targetKind: "cache root",
    consequence: "Gradle dependency/build cache files are removed and can be rebuilt."
  },
  "user-cache": {
    label: "User .cache cleanup",
    route: "bounded-user-cache-delete",
    routeInput: "user-cache",
    flagKey: "userCacheExecutor",
    envVar: "SPACEGUARD_ENABLE_USER_CACHE_EXECUTOR",
    executor: "userCache",
    actionType: "run-user-cache-executor",
    risk: "rebuildable",
    targetKind: "cache root",
    consequence: "Old files inside the current user's .cache root are removed."
  },
  "android-cache": {
    label: "Android cache cleanup",
    route: "bounded-android-cache-delete",
    routeInput: "android-cache",
    flagKey: "androidCacheExecutor",
    envVar: "SPACEGUARD_ENABLE_ANDROID_CACHE_EXECUTOR",
    executor: "android",
    actionType: "run-android-cache-executor",
    risk: "rebuildable",
    targetKind: "cache root",
    consequence: "Old Android Studio cache files are removed."
  },
  "steam-shader-cache": {
    label: "Graphics shader cache cleanup",
    route: "launcher-cache-cleanup",
    routeInput: "shader-cache",
    flagKey: "shaderCacheExecutor",
    envVar: "SPACEGUARD_ENABLE_SHADER_CACHE_EXECUTOR",
    executor: "shader",
    actionType: "run-shader-cache-executor",
    risk: "rebuildable",
    targetKind: "cache root",
    consequence: "Old shader cache files are removed; driver metadata is preserved."
  },
  "pip-cache": {
    label: "pip cache cleanup",
    route: "bounded-pip-cache-delete",
    routeInput: "pip-cache",
    flagKey: "pipCacheExecutor",
    envVar: "SPACEGUARD_ENABLE_PIP_CACHE_EXECUTOR",
    executor: "pip",
    actionType: "run-pip-cache-executor",
    risk: "rebuildable",
    targetKind: "cache root",
    consequence: "pip cache files are removed and can be downloaded again."
  },
  "docker-build-cache": {
    label: "Docker build cache prune",
    route: "tool-native-docker-build-cache-prune",
    routeInput: "docker-build-cache",
    flagKey: "toolNativePruneExecutors",
    envVar: "SPACEGUARD_ENABLE_TOOL_NATIVE_PRUNE_EXECUTORS",
    executor: "dockerBuildCache",
    actionType: "run-docker-build-cache-executor",
    risk: "advanced",
    targetKind: "tool inventory",
    consequence: "Only Docker build cache is cleared. Images, containers, and volumes are not touched."
  },
  "npm-cache": {
    label: "npm cache cleanup",
    route: "bounded-npm-cache-delete",
    routeInput: "npm-cache",
    flagKey: "npmCacheExecutor",
    envVar: "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR",
    executor: "npm",
    actionType: "run-npm-cache-executor",
    risk: "rebuildable",
    targetKind: "cache root",
    consequence: "Old npm cache files under the current user's _cacache root are removed."
  },
  "pnpm-store": {
    label: "pnpm store cleanup",
    route: "bounded-pnpm-store-delete",
    routeInput: "pnpm-store",
    flagKey: "pnpmStoreExecutor",
    envVar: "SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR",
    executor: "pnpm",
    actionType: "run-pnpm-store-executor",
    risk: "rebuildable",
    targetKind: "store root",
    consequence: "Old pnpm content/temp files and empty directories are removed."
  },
  "recycle-bin": {
    label: "Recycle Bin cleanup",
    route: "shell-recycle-bin",
    routeInput: "recycle-bin",
    flagKey: "recycleBinExecutor",
    envVar: "SPACEGUARD_ENABLE_RECYCLE_BIN_EXECUTOR",
    executor: "recycleBin",
    actionType: "run-recycle-bin-executor",
    risk: "restricted",
    targetKind: "shell target",
    consequence: "Recycle Bin contents for the selected drive are permanently emptied.",
    requiresPermanentConfirmation: true
  }
};

const ITEM_REVIEW_RECIPES = {
  "node-modules-old": {
    label: "Reviewed project dependency cleanup",
    route: "item-review-project-cache",
    routeInput: "project-deps",
    flagKey: "projectDependencyExecutor",
    envVar: "SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR",
    executor: "projectDeps",
    actionType: "run-project-deps-executor",
    risk: "review",
    targetKind: "reviewed project dependency",
    consequence: "Only the selected node_modules target is removed after review."
  },
  "downloads-installers": {
    label: "Reviewed Downloads cleanup",
    route: "item-review-recycle-bin",
    routeInput: "downloads",
    flagKey: "downloadsCleanupExecutor",
    envVar: "SPACEGUARD_ENABLE_DOWNLOADS_EXECUTOR",
    executor: "downloads",
    actionType: "run-downloads-cleanup-executor",
    risk: "review",
    targetKind: "reviewed file",
    consequence: "Only the selected Downloads file is moved to Recycle Bin."
  }
};

const ARCHIVE_RECIPE = {
  label: "Large-file archive",
  route: "item-review-large-files",
  routeInput: "large-files",
  flagKey: "largeFileArchiveExecutor",
  envVar: "SPACEGUARD_ENABLE_LARGE_FILE_ARCHIVE_EXECUTOR",
  executor: "largeFileArchive",
  actionType: "run-large-file-archive-executor",
  risk: "review",
  targetKind: "reviewed file",
  consequence: "Only the selected large file is moved to the archive destination."
};

const MANUAL_RECIPE_LABELS = {
  "installed-app-footprints": "Installed app review",
  "large-user-files": "Large file review",
  "android-studio": "Android Studio footprint review",
  "docker-volumes": "Docker volume review",
  "windows-old": "Previous Windows installation review",
  hibernation: "Hibernation file review",
  pagefile: "Pagefile review",
  "wsl-vhdx": "WSL virtual disk review"
};

function App() {
  const [activeView, setActiveView] = useState("clean");
  const [capability, setCapability] = useState(() => getNativeScannerCapability());
  const [runtime, setRuntime] = useState(null);
  const [runtimeStatus, setRuntimeStatus] = useState("loading");
  const [runtimeError, setRuntimeError] = useState("");
  const [scanRequest, setScanRequest] = useState(DEFAULT_SCAN_REQUEST);
  const [scanStatus, setScanStatus] = useState("idle");
  const [scanError, setScanError] = useState("");
  const [scan, setScan] = useState(null);
  const [postRunScan, setPostRunScan] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [archiveDestination, setArchiveDestination] = useState("");
  const [executionStatus, setExecutionStatus] = useState("idle");
  const [executionError, setExecutionError] = useState("");
  const [executionResult, setExecutionResult] = useState(null);
  const [executionRecord, setExecutionRecord] = useState(null);
  const [agentPrompt, setAgentPrompt] = useState("Find the safest next cleanup step from the current real scan.");
  const [agentStatus, setAgentStatus] = useState("idle");
  const [agentError, setAgentError] = useState("");
  const [agentAdvice, setAgentAdvice] = useState(null);

  useEffect(() => {
    refreshRuntime();
  }, []);

  const nativeConnected = Boolean(capability.available && runtime?.available);
  const candidates = useMemo(() => buildCleanupCandidates(scan, runtime), [scan, runtime]);
  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedId) || null,
    [candidates, selectedId]
  );
  const manualFindings = useMemo(() => buildManualFindings(scan), [scan]);
  const scanFingerprint = useMemo(() => buildScanFingerprint(scan), [scan]);
  const activePlanId = useMemo(
    () => buildCurrentPlanId({ candidate: selectedCandidate, scanFingerprint }),
    [selectedCandidate, scanFingerprint]
  );
  const proofCandidate = useMemo(
    () => selectedCandidate || buildProofCandidateFromExecutionRecord(executionRecord),
    [selectedCandidate, executionRecord]
  );
  const postRunProof = useMemo(
    () => buildPostRunProof({ candidate: proofCandidate, executionRecord, postRunScan }),
    [proofCandidate, executionRecord, postRunScan]
  );
  const effectivePermanentRemovalConfirmed = Boolean(selectedCandidate?.requiresPermanentConfirmation && consentChecked);
  const executionPrerequisites = useMemo(
    () => buildExecutionPrerequisites({
      candidate: selectedCandidate,
      archiveDestination,
      permanentRemovalConfirmed: effectivePermanentRemovalConfirmed
    }),
    [selectedCandidate, archiveDestination, effectivePermanentRemovalConfirmed]
  );
  const agentContextKey = useMemo(
    () => buildAgentContextKey({
      runtime,
      scanFingerprint,
      selectedCandidate,
      executionRecord,
      postRunProof,
      archiveDestination,
      permanentRemovalConfirmed: effectivePermanentRemovalConfirmed,
      agentPrompt
    }),
    [runtime, scanFingerprint, selectedCandidate, executionRecord, postRunProof, archiveDestination, effectivePermanentRemovalConfirmed, agentPrompt]
  );
  const agentContextKeyRef = useRef(agentContextKey);

  useEffect(() => {
    agentContextKeyRef.current = agentContextKey;
    setAgentAdvice(null);
    setAgentError("");
    setAgentStatus("idle");
  }, [agentContextKey]);

  const workflowLocks = useMemo(
    () => buildWorkflowLocks({ executionRecord }),
    [executionRecord]
  );
  const executionGate = useMemo(
    () => buildExecutionGate({
      candidate: selectedCandidate,
      consentChecked,
      executionPrerequisites,
      scanFingerprint,
      executionStatus,
      workflowLocks,
      executionRecord,
      activeScanGeneratedAt: scan?.generatedAt || ""
    }),
    [selectedCandidate, consentChecked, executionPrerequisites, scanFingerprint, executionStatus, workflowLocks, executionRecord, scan]
  );
  const canExecute = executionGate.ready;
  const agentContext = useMemo(
    () => buildAgentContext({
      runtime,
      scan,
      candidates,
      manualFindings,
      selectedCandidate,
      executionRecord,
      postRunProof,
      planId: activePlanId,
      scanFingerprint,
      consentPlanId: canExecute ? activePlanId : "",
      archiveDestination,
      permanentRemovalConfirmed: effectivePermanentRemovalConfirmed,
      workflowLocks
    }),
    [runtime, scan, candidates, manualFindings, selectedCandidate, executionRecord, postRunProof, activePlanId, scanFingerprint, canExecute, archiveDestination, effectivePermanentRemovalConfirmed, workflowLocks]
  );
  const currentAgentAdvice = agentAdvice?.contextKey === agentContextKey ? agentAdvice : null;
  const agentBroker = useMemo(
    () => {
      if (!currentAgentAdvice?.advice) return null;
      return buildOpenAIAgentRecommendationBroker({
        advice: currentAgentAdvice.advice,
        context: agentContext,
        executionState: {
          planId: activePlanId,
          scanFingerprint,
          consentPlanId: canExecute ? activePlanId : "",
          proofStatus: getAgentProofStatus(executionRecord, postRunProof),
          largeFileArchiveDestination: archiveDestination,
          permanentRemovalConfirmed: effectivePermanentRemovalConfirmed
        }
      });
    },
    [currentAgentAdvice, agentContext, activePlanId, scanFingerprint, canExecute, executionRecord, postRunProof, archiveDestination, effectivePermanentRemovalConfirmed]
  );

  async function refreshRuntime() {
    setRuntimeStatus("loading");
    setRuntimeError("");
    const nextCapability = getNativeScannerCapability();
    setCapability(nextCapability);
    try {
      const nextRuntime = await getNativeRuntimeCapabilities();
      setRuntime(nextRuntime);
      setRuntimeStatus("ready");
      return nextRuntime;
    } catch (error) {
      setRuntime(null);
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime capability check failed.");
      return null;
    }
  }

  async function runRealScan({ afterExecution = false } = {}) {
    setScanStatus(afterExecution ? "rescanning" : "scanning");
    setScanError("");
    try {
      const result = await runNativeReadonlyScan(toNativeScanRequest(scanRequest));
      if (!result.available || !result.windows) {
        throw new Error("The native scanner is not available on this Windows desktop session.");
      }
      const latestRuntime = await refreshRuntime();
      if (afterExecution) {
        setScan(result);
        setPostRunScan(result);
        setSelectedId("");
        setConsentChecked(false);
        setArchiveDestination("");
      } else {
        const defaultSelection = selectDefaultCleanupCandidateId(buildCleanupCandidates(result, latestRuntime || runtime));
        setScan(result);
        setPostRunScan(null);
        setExecutionResult(null);
        setExecutionRecord(null);
        setSelectedId(defaultSelection);
        setConsentChecked(false);
      }
      setScanStatus("complete");
      setActiveView("clean");
    } catch (error) {
      setScanStatus("error");
      setScanError(error instanceof Error ? error.message : "Native scan failed.");
    }
  }

  async function executeSelectedCleanup(candidateOverride = null) {
    const candidateForExecution = candidateOverride || selectedCandidate;
    const consentForExecution = candidateOverride ? true : consentChecked;
    const permanentRemovalForExecution = Boolean(candidateForExecution?.requiresPermanentConfirmation && consentForExecution);
    const prerequisitesForExecution = buildExecutionPrerequisites({
      candidate: candidateForExecution,
      archiveDestination,
      permanentRemovalConfirmed: permanentRemovalForExecution
    });
    if (!candidateForExecution) return;
    const currentExecutionGate = buildExecutionGate({
      candidate: candidateForExecution,
      consentChecked: consentForExecution,
      executionPrerequisites: prerequisitesForExecution,
      scanFingerprint,
      executionStatus,
      workflowLocks,
      executionRecord,
      activeScanGeneratedAt: scan?.generatedAt || ""
    });
    if (!currentExecutionGate.ready) {
      setExecutionStatus("error");
      setExecutionError(formatExecutionGateError(currentExecutionGate));
      return;
    }
    setSelectedId(candidateForExecution.id);
    setConsentChecked(true);
    setExecutionStatus("running");
    setExecutionError("");
    setExecutionResult(null);
    const planId = buildCurrentPlanId({ candidate: candidateForExecution, scanFingerprint }) || `plan-${Date.now()}-${candidateForExecution.id}`;
    const executedAt = new Date().toISOString();
    try {
      const result = await dispatchExecutor(candidateForExecution, {
        planId,
        scanFingerprint,
        archiveDestination,
        permanentRemovalConfirmed: permanentRemovalForExecution
      });
      const reclaimedBytes = result.entries.reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
      const record = {
        schemaVersion: "spaceguard-real-execution-record/v1",
        planId,
        executedAt,
        source: `native-${candidateForExecution.executor}-executor`,
        id: candidateForExecution.id,
        title: candidateForExecution.title,
        recipeId: candidateForExecution.recipeId,
        route: candidateForExecution.route,
        routeInput: candidateForExecution.routeInput,
        envVar: candidateForExecution.envVar,
        targetPath: candidateForExecution.targetPath,
        expectedBytes: candidateForExecution.bytes,
        bytes: reclaimedBytes,
        accepted: Boolean(result.accepted),
        resultMode: result.mode || "",
        reason: result.reason || "",
        volumeProof: result.volumeProof || null,
        sourceFinding: candidateForExecution.sourceFinding || null,
        reviewTarget: candidateForExecution.reviewTarget || null,
        entries: result.entries
      };
      setExecutionResult(result);
      setExecutionRecord(record);
      setPostRunScan(null);
      setExecutionStatus(result.accepted ? "complete" : "rejected");
      if (result.accepted) {
        await runRealScan({ afterExecution: true });
      }
    } catch (error) {
      setExecutionStatus("error");
      setExecutionError(formatCleanupStartError(error));
    }
  }

  async function askOpenAI() {
    const requestContextKey = agentContextKey;
    setAgentStatus("running");
    setAgentError("");
    setAgentAdvice(null);
    try {
      const result = await requestOpenAIAgentAdvice({
        context: agentContext,
        userPrompt: agentPrompt
      });
      if (agentContextKeyRef.current !== requestContextKey) return;
      setAgentAdvice({ ...result, contextKey: requestContextKey });
      setAgentStatus("complete");
    } catch (error) {
      if (agentContextKeyRef.current !== requestContextKey) return;
      setAgentStatus("error");
      setAgentError(error instanceof Error ? error.message : "OpenAI advisor failed.");
    }
  }

  async function runAgentBrokerAction(row) {
    if (!row?.canAct) return;
    if (row.kind === "scan") {
      const targetId = String(row.targetId || row.target_id || row.id || "").trim();
      const route = String(row.route || row.route_id || "").trim();
      const afterExecution = targetId === "post-run-rescan" || route === "post-run-proof" || row.targetPanel === "execution-proof-handoff-panel";
      await runRealScan({ afterExecution });
      return;
    }

    const brokerCandidate = resolveWorkflowAgentBrokerCandidate(row, candidates);
    if (brokerCandidate) {
      selectWorkflowCandidate(brokerCandidate.id, {
        checked: row.kind === "scoped-executor" && isOneClickCleanupCandidate(brokerCandidate)
      });
      return;
    }

    focusAgentBrokerPanel(row);
  }

  function resetWorkflowForRouteChange() {
    setSelectedId("");
    setConsentChecked(false);
    setArchiveDestination("");
    setExecutionStatus("idle");
    setExecutionError("");
    setExecutionResult(null);
    setExecutionRecord(null);
    setPostRunScan(null);
  }

  function selectWorkflowCandidate(id, options = {}) {
    if (!id) return;
    const target = candidates.find((candidate) => candidate.id === id);
    setSelectedId(id);
    setActiveView("clean");
    setExecutionResult(null);
    setExecutionRecord(null);
    setPostRunScan(null);
    setExecutionStatus("idle");
    setExecutionError("");
    setArchiveDestination("");
    setConsentChecked(Boolean(options.checked && target?.canExecute));
  }

  function toggleCleanupCandidate(candidate) {
    if (!candidate?.id) return;
    if (candidate.id === selectedId && consentChecked) {
      setSelectedId("");
      setConsentChecked(false);
      setExecutionError("");
      setArchiveDestination("");
      return;
    }
    selectWorkflowCandidate(candidate.id, { checked: candidate.canExecute });
  }

  if (!nativeConnected) {
    return (
      <AppFrame
        runtime={runtime}
        runtimeStatus={runtimeStatus}
        nativeConnected={nativeConnected}
        scan={scan}
        selectedCandidate={selectedCandidate}
        executionRecord={executionRecord}
        activeView={activeView}
        setActiveView={setActiveView}
      >
        <ConnectionRequired
          runtime={runtime}
          runtimeStatus={runtimeStatus}
          runtimeError={runtimeError}
          onRefresh={refreshRuntime}
        />
      </AppFrame>
    );
  }

  return (
    <AppFrame
      runtime={runtime}
      runtimeStatus={runtimeStatus}
      nativeConnected={nativeConnected}
      scan={scan}
      selectedCandidate={selectedCandidate}
      executionRecord={executionRecord}
      activeView={activeView}
      setActiveView={setActiveView}
    >
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-5 lg:px-7">
        <TopBar
          runtime={runtime}
          scan={scan}
          onRefreshRuntime={refreshRuntime}
        />
        {activeView === "clean" ? (
          <section className="grid gap-4">
            <ScanPanel
              request={scanRequest}
              setRequest={setScanRequest}
              candidates={candidates}
              scan={scan}
              scanStatus={scanStatus}
              scanError={scanError}
              onRunScan={() => runRealScan()}
            />
            {scan ? (
              <CleanPanel
                candidates={candidates}
                selectedId={selectedId}
                consentChecked={consentChecked}
                canExecute={canExecute}
                executionStatus={executionStatus}
                executionError={executionError}
                executionResult={executionResult}
                scanStatus={scanStatus}
                scan={scan}
                onToggleCandidate={toggleCleanupCandidate}
                onExecuteCandidate={executeSelectedCleanup}
                onRescan={() => runRealScan({ afterExecution: true })}
              />
            ) : null}
          </section>
        ) : null}
        {activeView === "explore" ? (
          <ExplorePanel
            scan={scan}
            candidates={candidates}
            manualFindings={manualFindings}
            onSelectCandidate={(id) => {
              const candidate = candidates.find((row) => row.id === id);
              selectWorkflowCandidate(id, { checked: isOneClickCleanupCandidate(candidate) });
              setActiveView("clean");
            }}
            onRunScan={() => runRealScan()}
          />
        ) : null}
        {activeView === "agent" ? (
          <OpenAIPanel
            runtime={runtime}
            scan={scan}
            candidates={candidates}
            manualFindings={manualFindings}
            selectedCandidate={selectedCandidate}
            prompt={agentPrompt}
            setPrompt={setAgentPrompt}
            status={agentStatus}
            error={agentError}
            advice={currentAgentAdvice}
            agentBroker={agentBroker}
            onAsk={askOpenAI}
            onBrokerAction={runAgentBrokerAction}
          />
        ) : null}
        {activeView === "history" ? (
          <HistoryPanel
            executionRecord={executionRecord}
            scanStatus={scanStatus}
            onRescan={() => runRealScan({ afterExecution: true })}
          />
        ) : null}
      </main>
    </AppFrame>
  );
}

function AppFrame({ children, runtime, runtimeStatus, nativeConnected, scan, selectedCandidate, executionRecord, activeView = "clean", setActiveView = () => {} }) {
  const navRows = [
    { id: "clean", label: "Clean", icon: Trash2, state: selectedCandidate ? "ready" : scan ? "waiting" : "idle" },
    { id: "explore", label: "Explore C:", icon: ListTree, state: scan ? "ready" : "waiting" },
    { id: "agent", label: "Ask AI", icon: Bot, state: scan ? "waiting" : "idle" },
    { id: "history", label: "Activity", icon: History, state: executionRecord ? "ready" : "waiting" }
  ];
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="sticky top-0 z-20 hidden h-screen border-r bg-card/95 px-4 py-5 shadow-sm backdrop-blur lg:block">
          <div className="flex h-full flex-col">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-background">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">SpaceGuard</p>
                  <p className="text-xs text-muted-foreground">Real Windows cleanup</p>
                </div>
              </div>
            </div>
            <Separator className="my-5" />
            <nav className="space-y-1">
              {navRows.map((row) => {
                const Icon = row.icon;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setActiveView(row.id)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted ${
                      activeView === row.id ? "bg-primary text-primary-foreground hover:bg-primary" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${activeView === row.id ? "text-primary-foreground" : "text-muted-foreground"}`} />
                      {row.label}
                    </span>
                    <StatusDot state={row.state} />
                  </button>
                );
              })}
            </nav>
            <div className="mt-auto rounded-md border bg-muted/35 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Cleanup status</p>
              <p className="mt-1 truncate">
                {scan ? selectedCandidate?.title || "Choose an item to delete" : "Scan your PC to begin"}
              </p>
              <p className="mt-3 font-medium text-foreground">{runtime?.realRunEnabled ? "Ready to clean" : "Desktop app needed"}</p>
            </div>
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

function ConnectionRequired({ runtime, runtimeStatus, runtimeError, onRefresh }) {
  const cleanupSteps = [
    ["Scan PC", "Find cleanable cache and temp files."],
    ["Check item", "Choose one safe cleanup row."],
    ["Delete", "Clear the selected files."]
  ];

  return (
    <main className="min-h-screen bg-background px-5 py-6 text-foreground lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <Card className="rounded-md">
          <CardHeader>
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <Badge variant="restricted">desktop app needed</Badge>
                <CardTitle className="mt-3 flex items-center gap-2 text-2xl">
                  <ShieldCheck className="h-5 w-5" />
                  Open SpaceGuard for Windows
                </CardTitle>
                <CardDescription className="mt-2 max-w-2xl">
                  This browser page cannot scan or delete files. Open the installed Windows app to clean space.
                </CardDescription>
              </div>
              <Button variant="outline" onClick={onRefresh} disabled={runtimeStatus === "loading"}>
                <RefreshCcw className="h-4 w-4" />
                {runtimeStatus === "loading" ? "Checking" : "Check again"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {runtimeError ? (
              <Notice tone="restricted" icon={AlertTriangle} text={runtimeError} />
            ) : (
              <Notice tone="review" icon={Lock} text="The cleanup tools are available only inside the Windows desktop app." />
            )}
            <div className="grid gap-3 md:grid-cols-3">
              {cleanupSteps.map(([label, detail], index) => (
                <div key={label} className="rounded-md border bg-background p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md border bg-muted text-xs font-semibold">{index + 1}</div>
                    <p className="font-medium">{label}</p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              What happens in the app
            </CardTitle>
            <CardDescription>SpaceGuard only deletes from built-in safe cleanup areas after you check a row.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            {["Windows temp files", "Browser caches", "Developer caches", "Recycle Bin", "Old downloads", "Activity summary"].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function TopBar({ runtime, scan, onRefreshRuntime }) {
  const free = scan?.volume?.freeBytes || 0;
  const total = scan?.volume?.totalBytes || 0;
  const usedPercent = total ? Math.min(100, Math.max(0, ((total - free) / total) * 100)) : 0;
  return (
    <header className="flex flex-col gap-4 rounded-md border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={runtime?.realRunEnabled ? "safe" : "review"}>
            {runtime?.realRunEnabled ? "cleanup available" : "desktop required"}
          </Badge>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal">SpaceGuard Windows cleanup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scan your PC, choose what to clean, then delete the selected files.
        </p>
      </div>
      <div className="min-w-[240px] space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{scan?.volume?.drive || "C:"} usage</span>
          <span className="font-medium">{total ? `${formatBytes(free)} free` : "scan pending"}</span>
        </div>
        <Progress value={usedPercent} />
        <Button variant="outline" size="sm" onClick={onRefreshRuntime}>
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      </div>
    </header>
  );
}

function ScanPanel({ request, setRequest, candidates = [], scan, scanStatus, scanError, onRunScan }) {
  const running = scanStatus === "scanning" || scanStatus === "rescanning";
  const hasScan = Boolean(scan);
  const readyCount = candidates.filter(isOneClickCleanupCandidate).length;
  const readyLabel = readyCount === 1 ? "1 item ready to delete" : `${readyCount} items ready to delete`;
  return (
    <Card className="rounded-md">
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FolderSearch className="h-4 w-4" />
              {hasScan ? "Ready to clean" : "Scan for cleanup"}
            </CardTitle>
            <CardDescription>
              {hasScan ? `${readyLabel}. Select a row below, then delete it.` : "Scan first. Nothing is deleted until you choose an item."}
            </CardDescription>
          </div>
          {hasScan ? (
            <Button className="w-full md:w-auto" onClick={onRunScan} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
              Scan again
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasScan ? (
          <div className="grid gap-3 md:grid-cols-[minmax(180px,260px)_minmax(180px,220px)]">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Target drive</span>
              <Input value={request.targetDrive} onChange={(event) => setRequest({ ...request, targetDrive: event.target.value })} />
            </label>
            <div className="flex items-end">
              <Button className="w-full" onClick={onRunScan} disabled={running}>
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                Scan PC
              </Button>
            </div>
          </div>
        ) : null}
        <details className="rounded-md border bg-muted/20">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">{hasScan ? "Scan details" : "Advanced scan options"}</summary>
          <div className="space-y-3 border-t p-3">
            {hasScan ? (
              <div className="grid gap-3 md:grid-cols-4">
                <Metric label="Generated" value={formatShortDate(scan.generatedAt)} />
                <Metric label="Findings" value={String(scan.findings.length)} />
                <Metric label="Measured bytes" value={formatBytes(scan.totalBytes)} />
                <Metric label="Drive free" value={formatBytes(scan.volume?.freeBytes || 0)} />
              </div>
            ) : null}
            {hasScan ? (
              <p className="text-xs font-medium text-muted-foreground">Advanced scan options</p>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              {hasScan ? (
                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="font-medium">Target drive</span>
                  <Input value={request.targetDrive} onChange={(event) => setRequest({ ...request, targetDrive: event.target.value })} />
                </label>
              ) : null}
              <label className="space-y-1 text-sm">
                <span className="font-medium">Depth</span>
                <Input type="number" value={request.maxDepth} onChange={(event) => setRequest({ ...request, maxDepth: Number(event.target.value || 8) })} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Entry cap</span>
                <Input type="number" value={request.maxEntriesPerRoot} onChange={(event) => setRequest({ ...request, maxEntriesPerRoot: Number(event.target.value || 25000) })} />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Protected paths</span>
                <Textarea
                  value={request.protectedPaths}
                  onChange={(event) => setRequest({ ...request, protectedPaths: event.target.value })}
                  placeholder="One path per line"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Extra folders to scan</span>
                <Textarea
                  value={request.customRoots}
                  onChange={(event) => setRequest({ ...request, customRoots: event.target.value })}
                  placeholder="Optional folders to measure manually"
                />
              </label>
            </div>
            <label className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={request.includeProjectArtifacts}
                onClick={() => setRequest({ ...request, includeProjectArtifacts: !request.includeProjectArtifacts })}
              />
              Include project artifact discovery such as node_modules.
            </label>
          </div>
        </details>
        {scanError ? <Notice tone="restricted" icon={AlertTriangle} text={scanError} /> : null}
      </CardContent>
    </Card>
  );
}

function CleanPanel({
  candidates,
  selectedId,
  consentChecked,
  canExecute,
  executionStatus,
  executionError,
  executionResult,
  scanStatus,
  scan,
  onToggleCandidate,
  onExecuteCandidate,
  onRescan
}) {
  const readyCandidates = candidates.filter(isOneClickCleanupCandidate);
  const hasReadyCandidates = readyCandidates.length > 0;
  const running = executionStatus === "running";
  return (
    <Card id="cleanup-actions-panel" className="rounded-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" />
          Clean space
        </CardTitle>
        <CardDescription>Check a row or press Delete to clean it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!scan ? (
          <EmptyState icon={ScanLine} title="Scan first" detail="Cleanable items appear here after the scan finishes." />
        ) : candidates.length ? (
          <>
            {hasReadyCandidates ? (
              <div className="grid gap-3">
                {readyCandidates.map((row) => {
                  const checked = row.id === selectedId && consentChecked;
                  const selected = row.id === selectedId;
                  return (
                    <div
                      key={row.id}
                      className={`rounded-md border bg-background transition hover:border-primary ${
                        selected ? "border-primary bg-primary/5" : ""
                      }`}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => onToggleCandidate(row)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") onToggleCandidate(row);
                        }}
                        className="flex cursor-pointer flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between"
                      >
                        <div className="flex min-w-0 gap-3">
                          <Checkbox
                            checked={checked}
                            onClick={(event) => {
                              event.stopPropagation();
                              onToggleCandidate(row);
                            }}
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="safe">ready</Badge>
                              <span className="font-medium">{row.title}</span>
                            </div>
                            <p className="mt-2 truncate text-sm text-muted-foreground">{row.targetPath || row.targetKind}</p>
                          </div>
                        </div>
                        <div className="shrink-0 md:text-right">
                          <p className="text-lg font-semibold">{formatBytes(row.bytes)}</p>
                          <Button
                            className="mt-2 w-full md:w-auto"
                            size="sm"
                            variant={selected ? "default" : "outline"}
                            disabled={running || (selected && !canExecute)}
                            onClick={(event) => {
                              event.stopPropagation();
                              onExecuteCandidate(row);
                            }}
                          >
                            {running && selected ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            {running && selected ? "Deleting" : row.requiresPermanentConfirmation ? "Empty" : "Delete"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={Lock} title="No items ready to delete" detail="Run another scan or open Explore to review what was found." />
            )}
            {executionError ? <Notice tone="restricted" icon={AlertTriangle} text={executionError} /> : null}
            {executionResult ? (
              <CleanupResult
                result={executionResult}
                scanStatus={scanStatus}
                onRescan={onRescan}
              />
            ) : null}
          </>
        ) : (
          <EmptyState icon={Lock} title="No cleanable findings yet" detail="Run a scan to find items SpaceGuard can delete safely." />
        )}
      </CardContent>
    </Card>
  );
}

function CleanupResult({ result, scanStatus, onRescan }) {
  const accepted = Boolean(result?.accepted);
  const reclaimedBytes = totalEntryBytes(result?.entries || []);
  const removedFiles = reclaimedBytes > 0;
  const acceptedTitle = removedFiles ? "Cleaned" : "Nothing to remove";
  const runningRescan = scanStatus === "rescanning";
  const acceptedText = formatAcceptedCleanupMessage({ reclaimedBytes, removedFiles, runningRescan, scanStatus });
  const rejectedText = formatCleanupRejectMessage(result);
  const showRefreshAction = !accepted || runningRescan || scanStatus === "error";
  return (
    <div className={`rounded-md border p-4 text-sm ${accepted ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-red-200 bg-red-50 text-red-950"}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-base font-semibold">{accepted ? acceptedTitle : "Could not clean this item"}</p>
          <p className="mt-1 text-sm">
            {accepted
              ? acceptedText
              : rejectedText}
          </p>
        </div>
        {showRefreshAction ? (
          <Button type="button" size="sm" variant="outline" onClick={onRescan} disabled={runningRescan}>
            {runningRescan ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            {accepted ? runningRescan ? "Refreshing" : "Refresh again" : "Scan again"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ExplorePanel({ scan, candidates = [], manualFindings = [], onSelectCandidate, onRunScan }) {
  const rows = buildExploreRows(scan, candidates, manualFindings);
  return (
    <Card id="drive-explorer-panel" className="rounded-md">
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ListTree className="h-4 w-4" />
              Explore C:
            </CardTitle>
            <CardDescription>See what is using space and jump to a cleanable item.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onRunScan} disabled={false}>
            <ScanLine className="h-4 w-4" />
            Scan again
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!scan ? (
          <EmptyState icon={HardDrive} title="Run a scan to explore C:" detail="Large folders and cleanable items appear here after scanning." />
        ) : !rows.length ? (
          <EmptyState icon={HardDrive} title="No large areas found" detail="Run a fresh scan or add an extra folder from Advanced scan options." />
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <Metric label="Drive" value={scan.volume?.drive || scan.targetDrive || "C:"} />
              <Metric label="Used" value={formatBytes(scan.volume?.usedBytes || 0)} />
              <Metric label="Free" value={formatBytes(scan.volume?.freeBytes || 0)} />
              <Metric label="Items" value={String(rows.length)} />
            </div>
            <div className="grid gap-3">
              {rows.map((row) => (
                <div key={row.id} className="rounded-md border bg-background p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={row.cleanable ? row.ready ? "safe" : "review" : "outline"}>
                          {row.cleanable ? row.ready ? "ready" : "review" : "manual"}
                        </Badge>
                        <p className="font-medium">{row.title}</p>
                      </div>
                      <p className="mt-2 truncate text-sm text-muted-foreground">{row.path || row.source}</p>
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{row.detail}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
                      <p className="text-lg font-semibold">{formatBytes(row.bytes)}</p>
                      {row.ready && row.candidateId ? (
                        <Button size="sm" onClick={() => onSelectCandidate(row.candidateId)}>
                          <Trash2 className="h-3.5 w-3.5" />
                          Clean
                        </Button>
                      ) : (
                        <Badge variant="outline">manual</Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryPanel({
  executionRecord,
  scanStatus,
  onRescan
}) {
  const accepted = Boolean(executionRecord?.accepted);
  const bytes = Number(executionRecord?.bytes || 0);
  return (
    <div className="grid gap-5">
      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Activity
          </CardTitle>
          <CardDescription>Last cleanup result.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!executionRecord ? (
            <EmptyState icon={History} title="No cleanup has run yet" detail="Run a cleanable item to see what happened." />
          ) : (
            <>
              <div className={`rounded-md border p-4 ${accepted ? "bg-emerald-50 text-emerald-950" : "bg-red-50 text-red-950"}`}>
                <div className="flex items-start gap-3">
                  {accepted ? <CheckCircle2 className="mt-0.5 h-5 w-5" /> : <AlertTriangle className="mt-0.5 h-5 w-5" />}
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {accepted ? bytes > 0 ? `${formatBytes(bytes)} cleaned` : "Nothing needed cleaning" : "Nothing was deleted"}
                    </p>
                    <p className="mt-1 text-sm">{formatHistorySummary(executionRecord)}</p>
                    <p className="mt-3 truncate text-xs opacity-80">
                      {(executionRecord.title || "Cleanup target")} - {formatShortDate(executionRecord.executedAt)}
                    </p>
                  </div>
                </div>
              </div>
              <Button variant="outline" onClick={onRescan} disabled={scanStatus === "rescanning"}>
                {scanStatus === "rescanning" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Scan again
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OpenAIPanel({ runtime, scan, candidates, manualFindings = [], selectedCandidate, prompt, setPrompt, status, error, advice, agentBroker, onAsk, onBrokerAction }) {
  const visibleTargets = Number(candidates?.length || 0) + Number(manualFindings?.length || 0);
  const canAsk = Boolean(runtime?.openAiAgentAdvice && runtime?.openAiAdvisorConfigured && scan && visibleTargets);
  const assistant = advice?.advice;
  const brokerRows = agentBroker?.rows || [];
  const suggestedAction = brokerRows.find((row) => row.canAct) || brokerRows[0] || null;
  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-4 w-4" />
          Ask AI
        </CardTitle>
        <CardDescription>Ask for a safe next cleanup choice from the current scan.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="What should I clean next?" />
        <Button className="w-full" disabled={!canAsk || status === "running"} onClick={onAsk}>
          {status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Get recommendation
        </Button>
        {!canAsk ? (
          <Notice
            tone="review"
            icon={AlertTriangle}
            text="Run a scan to ask for a cleanup recommendation."
          />
        ) : null}
        {error ? <Notice tone="restricted" icon={AlertTriangle} text={error} /> : null}
        {assistant ? (
          <div className="space-y-3 rounded-md border bg-background p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="safe">{assistant.confidence}</Badge>
              <span className="font-medium">{assistant.nextAction || "Recommended cleanup"}</span>
            </div>
            <p className="text-muted-foreground">{assistant.summary}</p>
            {suggestedAction ? (
              <div className="rounded-md border bg-muted/25 p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={suggestedAction.canAct ? "safe" : suggestedAction.status === "manual-only" ? "outline" : "review"}>
                        {suggestedAction.canAct ? "ready" : suggestedAction.status === "manual-only" ? "manual" : "needs review"}
                      </Badge>
                      <p className="font-medium">{formatAgentActionTitle(suggestedAction)}</p>
                    </div>
                    {!suggestedAction.canAct ? <p className="mt-2 text-xs text-muted-foreground">Open Clean or Explore to review this item.</p> : null}
                  </div>
                  {canRunAgentBrokerAction(suggestedAction) ? (
                    <Button size="sm" onClick={() => onBrokerAction(suggestedAction)}>
                      <ChevronRight className="h-3.5 w-3.5" />
                      {formatAgentButtonLabel(suggestedAction)}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {selectedCandidate ? (
              <p className="text-xs text-muted-foreground">Current selection: {selectedCandidate.title}</p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function canRunAgentBrokerAction(row = {}) {
  return Boolean(row.canAct && row.kind);
}

function formatAgentActionTitle(row = {}) {
  if (row.kind === "scoped-executor") return "Select this cleanup";
  if (row.kind === "scan") return "Refresh the scan";
  if (row.kind === "review-target") return "Open review";
  return row.actionType === "manual-only" ? "Review manually" : "Review recommendation";
}

function formatAgentButtonLabel(row = {}) {
  if (row.kind === "scoped-executor") return "Select cleanup";
  if (row.kind === "scan") return "Run scan";
  if (row.kind === "review-target") return "Open review";
  return row.buttonLabel || "Use recommendation";
}

function focusAgentBrokerPanel(row = {}) {
  const panelId = String(row.targetPanel || "").trim();
  if (!panelId || typeof document === "undefined") return;
  document.getElementById(panelId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function ManualReviewPanel({ findings }) {
  return (
    <Card id="item-review-panel" className="rounded-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-4 w-4" />
          Needs review
        </CardTitle>
        <CardDescription>These areas may be large. SpaceGuard will not delete them automatically.</CardDescription>
      </CardHeader>
      <CardContent>
        {findings.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {findings.map((finding) => (
              <div key={`${finding.recipeId}-${finding.path}`} className="rounded-md border bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium">{finding.title}</p>
                  <Badge variant="outline">manual</Badge>
                </div>
                <p className="mt-2 truncate text-xs text-muted-foreground">{finding.path || finding.recipeId}</p>
                <p className="mt-2 text-lg font-semibold">{formatBytes(finding.bytes)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatManualFindingNote(finding)}</p>
                <div className="mt-3 rounded-md border bg-muted/30 p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{finding.manualGuidance.confidence}</Badge>
                    <p className="text-xs font-medium">Suggested action</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{finding.manualGuidance.primaryAction}</p>
                </div>
                {finding.reviewRows.rows.length ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {finding.reviewRows.rows.length === 1 ? "1 item may need your review." : `${finding.reviewRows.rows.length} items may need your review.`}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={HardDrive} title="No manual review items" detail="Run a scan to show areas that need your review." />
        )}
      </CardContent>
    </Card>
  );
}

function Notice({ tone = "review", icon: Icon = AlertTriangle, text }) {
  const toneClass = tone === "safe"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : tone === "restricted"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${toneClass}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function EmptyState({ icon: Icon, title, detail }) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center rounded-md border border-dashed bg-muted/25 p-6 text-center">
      <Icon className="h-6 w-6 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function formatHistorySummary(executionRecord = {}) {
  if (executionRecord.accepted) {
    const bytes = formatBytes(executionRecord.bytes || 0);
    return Number(executionRecord.bytes || 0) > 0
      ? `${bytes} removed. The list is up to date.`
      : "No eligible files were removed. The list is up to date.";
  }
  return "Nothing was deleted. Refresh the scan, close apps that may be using these files, and try again.";
}

function formatAcceptedCleanupMessage({ reclaimedBytes = 0, removedFiles = false, runningRescan = false, scanStatus = "" } = {}) {
  if (!removedFiles) {
    if (runningRescan) return "No eligible files were removed. Refreshing the list.";
    if (scanStatus === "error") return "No eligible files were removed. Refresh failed; click Refresh again.";
    return "No eligible files were removed. The list is up to date.";
  }
  const bytes = formatBytes(reclaimedBytes);
  if (runningRescan) return `${bytes} removed. Refreshing the list.`;
  if (scanStatus === "error") return `${bytes} removed. Refresh failed; click Refresh again.`;
  return `${bytes} removed. The list is up to date.`;
}

function formatCleanupRejectMessage(result = {}) {
  const ledger = buildExecutionLedgerRows(result);
  const text = [
    result?.reason || "",
    ...ledger.warnings,
    ...ledger.rows.flatMap((row) => [row.rejectCode, row.note, ...row.checks.map((check) => check.detail)])
  ]
    .join(" ")
    .toLowerCase();

  if (/missing-(scan-fingerprint|consent-plan|plan-id)|no-actions|request-mode-invalid|route-not/i.test(text)) {
    return "Cleanup could not verify the current scan. Scan again, check the item, and delete it.";
  }
  if (/permanent-confirmation/.test(text)) {
    return "Check the Recycle Bin row, then try again.";
  }
  if (/target-(not-allowlisted|forbidden|blocked|missing)|outside|allowlist/.test(text)) {
    return "This item is outside the safe cleanup list. Choose another ready item or scan again.";
  }
  if (/executor-disabled|feature-flag|cleanup authority|not available|runtime/.test(text)) {
    return "Cleanup is not available for this item in this app session. Restart SpaceGuard, scan again, and try another ready item.";
  }
  if (/access denied|permission|locked|in use|using these files/.test(text)) {
    return "Windows blocked some files because they are in use. Close the related apps, scan again, and retry.";
  }
  return "Nothing was deleted. Close apps using these files, scan again, and try once more.";
}

function formatSignedBytes(value = 0) {
  const bytes = Number(value || 0);
  if (!bytes) return formatBytes(0);
  const sign = bytes > 0 ? "+" : "-";
  return `${sign}${formatBytes(Math.abs(bytes))}`;
}

function StatusDot({ state }) {
  const ready = state === "ready" || state === true;
  const waiting = state === "waiting" || state === "loading";
  return (
    <span
      className={`h-2.5 w-2.5 rounded-full ${
        ready ? "bg-emerald-500" : waiting ? "bg-amber-500" : "bg-red-500"
      }`}
    />
  );
}

function toNativeScanRequest(request) {
  return {
    targetDrive: request.targetDrive,
    protectedPaths: splitLines(request.protectedPaths),
    customRoots: splitLines(request.customRoots),
    includeProjectArtifacts: request.includeProjectArtifacts,
    maxDepth: Number(request.maxDepth || 8),
    maxEntriesPerRoot: Number(request.maxEntriesPerRoot || 25000)
  };
}

function splitLines(value = "") {
  return String(value || "")
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);
}

function isOneClickCleanupCandidate(candidate = {}) {
  return Boolean(candidate?.canExecute && !candidate?.requiresArchiveDestination);
}

function formatManualFindingNote(finding = {}) {
  const text = String(finding.note || "").trim();
  if (!text || /executor|allowlist|native|command/i.test(text)) {
    return "Review this area yourself before removing anything.";
  }
  return text;
}

function buildCleanupCandidates(scan, runtime) {
  if (!scan?.findings?.length) return [];
  const rows = [];
  for (const finding of scan.findings) {
    const rootRecipe = EXECUTOR_RECIPES[finding.recipeId];
    if (rootRecipe) {
      rows.push(buildCandidateFromFinding(finding, rootRecipe, runtime));
      continue;
    }
    const itemRecipe = ITEM_REVIEW_RECIPES[finding.recipeId];
    if (itemRecipe) {
      rows.push(...buildItemCandidates(finding, itemRecipe, runtime));
      continue;
    }
    if (finding.recipeId === "large-user-files") {
      rows.push(...buildItemCandidates(finding, ARCHIVE_RECIPE, runtime, { archive: true }));
    }
  }
  return rows
    .filter((row) => row.bytes > 0 || row.executor === "dockerBuildCache" || row.executor === "recycleBin")
    .sort((left, right) => Number(right.canExecute) - Number(left.canExecute) || right.bytes - left.bytes);
}

function selectDefaultCleanupCandidateId(candidates = []) {
  return "";
}

function buildExploreRows(scan, candidates = [], manualFindings = []) {
  if (!scan) return [];
  const cleanableRows = candidates.map((candidate) => ({
    id: `cleanable-${candidate.id}`,
    title: candidate.title,
    path: candidate.targetPath,
    bytes: Number(candidate.bytes || 0),
    kind: candidate.routeInput || "cleanup",
    source: "cleanup-candidate",
    detail: candidate.requiresArchiveDestination
      ? "Choose an archive folder before cleaning this item."
      : candidate.canExecute
      ? candidate.consequence
      : candidate.blockedReason || "This target needs review before cleanup.",
    cleanable: true,
    ready: isOneClickCleanupCandidate(candidate),
    candidateId: isOneClickCleanupCandidate(candidate) ? candidate.id : ""
  }));
  const manualRows = manualFindings.map((finding) => ({
    id: `manual-${finding.recipeId}-${finding.path || finding.title}`,
    title: finding.title || "Manual review",
    path: finding.path || "",
    bytes: Number(finding.bytes || 0),
    kind: finding.manualGuidance?.kind || "manual",
    source: "manual-review",
    detail: finding.manualGuidance?.primaryAction || formatManualFindingNote(finding),
    cleanable: false,
    ready: false,
    candidateId: ""
  }));
  const inventoryRows = (scan.driveInventory || []).map((row) => ({
    id: `inventory-${row.id || row.path || row.name}`,
    title: row.name || row.path || "Drive entry",
    path: row.path || "",
    bytes: Number(row.bytes || 0),
    kind: row.classification || row.kind || "drive inventory",
    source: "drive-inventory",
    detail: row.note || "Top-level C: allocation. Use cleanable rows or manual review guidance for action.",
    cleanable: false,
    ready: false,
    candidateId: ""
  }));
  return [...cleanableRows, ...manualRows, ...inventoryRows]
    .filter((row) => row.bytes > 0 || row.cleanable)
    .sort((left, right) => Number(right.cleanable) - Number(left.cleanable) || right.bytes - left.bytes)
    .slice(0, 80);
}

function buildCandidateFromFinding(finding, recipe, runtime) {
  const status = buildRouteReadiness({ recipe, finding, runtime });
  return {
    id: `${finding.recipeId}:${finding.path || recipe.route}`,
    title: finding.title || recipe.label,
    recipeId: finding.recipeId,
    route: recipe.route,
    routeInput: recipe.routeInput,
    flagKey: recipe.flagKey,
    envVar: recipe.envVar,
    executor: recipe.executor,
    actionType: recipe.actionType,
    risk: recipe.risk,
    targetKind: recipe.targetKind,
    targetPath: finding.path || recipe.label,
    bytes: Number(finding.bytes || 0),
    status: finding.status || "unknown",
    consequence: recipe.consequence,
    executable: status.executable,
    canExecute: status.canExecute,
    blockedReason: status.blockedReason,
    readinessRows: status.rows,
    requiresPermanentConfirmation: Boolean(recipe.requiresPermanentConfirmation),
    requiresArchiveDestination: Boolean(recipe.requiresArchiveDestination),
    sourceFinding: finding
  };
}

function buildItemCandidates(finding, recipe, runtime, options = {}) {
  const items = Array.isArray(finding.items) ? finding.items : [];
  return items
    .filter((item) => item.path && Number(item.bytes || 0) > 0)
    .map((item) => {
      const status = buildRouteReadiness({ recipe, finding, runtime });
      return {
        id: `${finding.recipeId}:${item.id || item.path}`,
        title: item.name || recipe.label,
        recipeId: finding.recipeId,
        route: recipe.route,
        routeInput: recipe.routeInput,
        flagKey: recipe.flagKey,
        envVar: recipe.envVar,
        executor: recipe.executor,
        actionType: recipe.actionType,
        risk: recipe.risk,
        targetKind: recipe.targetKind,
        targetPath: item.path,
        bytes: Number(item.bytes || 0),
        status: finding.status || "unknown",
        consequence: recipe.consequence,
        executable: status.executable,
        canExecute: status.canExecute,
        blockedReason: status.blockedReason,
        readinessRows: status.rows,
        requiresArchiveDestination: Boolean(options.archive),
        reviewTarget: {
          id: item.id || `${finding.recipeId}-${item.name || "item"}`,
          name: item.name || recipe.label,
          path: item.path,
          bytes: Number(item.bytes || 0),
          ageDays: Number(item.ageDays || 0),
          kind: item.kind || recipe.targetKind,
          reason: item.reason || ""
        },
        sourceFinding: finding
      };
    });
}

function buildManualFindings(scan) {
  if (!scan) return [];
  const findingRows = (scan.findings || [])
    .filter((finding) => {
      if (EXECUTOR_RECIPES[finding.recipeId] || ITEM_REVIEW_RECIPES[finding.recipeId]) return false;
      return Boolean(MANUAL_RECIPE_LABELS[finding.recipeId] || finding.recipeId.startsWith("custom-root-") || finding.recipeId.startsWith("drive-"));
    })
    .map((finding) => decorateManualFinding(finding));
  const driveRows = (scan.driveInventory || [])
    .filter((row) => row && (row.name || row.path) && Number(row.bytes || 0) > 0)
    .slice(0, 8)
    .map((row) => decorateManualFinding({
      recipeId: `drive-${slugifyId(row.id || row.name || row.path || "inventory")}`,
      title: `Drive inventory: ${row.name || row.path || "top-level entry"}`,
      path: row.path || row.name || "",
      bytes: Number(row.bytes || 0),
      status: row.status || "unknown",
      files: Number(row.files || 0),
      dirs: Number(row.dirs || 0),
      errors: Number(row.errors || 0),
      note: row.note || `Top-level drive inventory classification: ${row.classification || "manual review"}.`,
      items: []
    }));
  return [...findingRows, ...driveRows].sort((left, right) => right.bytes - left.bytes);
}

function decorateManualFinding(finding) {
  return {
    ...finding,
    title: MANUAL_RECIPE_LABELS[finding.recipeId] || finding.title || "Manual review",
    manualGuidance: buildManualFindingGuidance(finding),
    reviewRows: buildManualFindingReviewRows(finding)
  };
}

function slugifyId(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "entry";
}

async function dispatchExecutor(candidate, { planId, scanFingerprint, archiveDestination, permanentRemovalConfirmed }) {
  const base = {
    planId,
    scanFingerprint,
    consentPlanId: planId,
    expectedBytes: candidate.bytes,
    row: candidate,
    selectedRow: candidate,
    rows: [candidate],
    selectedRows: [candidate]
  };
  if (candidate.reviewTarget) {
    const row = {
      ...candidate,
      reviewTargets: [candidate.reviewTarget],
      archiveTargets: [candidate.reviewTarget]
    };
    base.rows = [row];
    base.selectedRows = [row];
  }
  switch (candidate.executor) {
    case "temp":
      return runNativeTempCleanupExecutor(base);
    case "projectDeps":
      return runNativeProjectDependencyExecutor(base);
    case "downloads":
      return runNativeDownloadsCleanupExecutor(base);
    case "largeFileArchive":
      return runNativeLargeFileArchiveExecutor({ ...base, archiveDestination });
    case "browserCache":
      return runNativeBrowserCacheExecutor(base);
    case "gradle":
      return runNativeGradleCacheExecutor(base);
    case "userCache":
      return runNativeUserCacheExecutor(base);
    case "android":
      return runNativeAndroidCacheExecutor(base);
    case "shader":
      return runNativeShaderCacheExecutor(base);
    case "pip":
      return runNativePipCacheExecutor(base);
    case "dockerBuildCache":
      return runNativeDockerBuildCacheExecutor(base);
    case "npm":
      return runNativeNpmCacheExecutor(base);
    case "pnpm":
      return runNativePnpmStoreExecutor(base);
    case "recycleBin":
      return runNativeRecycleBinExecutor({ ...base, permanentRemovalConfirmed });
    default:
      throw new Error(`No native executor is mapped for ${candidate.routeInput}.`);
  }
}

function buildAgentContext({
  runtime,
  scan,
  candidates,
  manualFindings = [],
  selectedCandidate,
  executionRecord,
  postRunProof,
  planId = "",
  scanFingerprint = "",
  consentPlanId = "",
  archiveDestination = "",
  permanentRemovalConfirmed = false,
  workflowLocks = buildWorkflowLocks({ executionRecord })
}) {
  const agentCandidateIds = new Map();
  const cleanupQueue = candidates.slice(0, 24).map((candidate, index) => {
    const agentTargetId = buildAgentCleanupTargetId(candidate, index);
    const canRunFromQueue = isOneClickCleanupCandidate(candidate);
    agentCandidateIds.set(candidate.id, agentTargetId);
    return {
      id: agentTargetId,
      title: candidate.title,
      route: candidate.route,
      routeInput: candidate.routeInput,
      actionType: candidate.actionType,
      targetId: agentTargetId,
      bytes: Number(candidate.bytes || 0),
      canExecute: canRunFromQueue,
      blockedReason: redactAgentContextText(candidate.requiresArchiveDestination ? "Archive destination required before this item can run." : candidate.blockedReason || ""),
      targetPath: redactPath(candidate.targetPath || "")
    };
  });
  const manualReviewTargets = manualFindings.slice(0, 24).map((finding, index) => {
    const agentTargetId = buildAgentManualTargetId(finding, index);
    return {
      id: agentTargetId,
      title: finding.title || "Manual review",
      route: finding.manualGuidance?.kind || "manual-review",
      actionType: "manual-only",
      targetId: agentTargetId,
      bytes: Number(finding.bytes || 0),
      status: finding.status || "unknown",
      confidence: finding.manualGuidance?.confidence || "manual-only",
      targetPath: redactPath(finding.path || ""),
      reason: redactAgentContextText(finding.manualGuidance?.primaryAction || finding.note || "Manual review needed."),
      blockedActions: Array.isArray(finding.manualGuidance?.blockedActions)
        ? finding.manualGuidance.blockedActions.slice(0, 4).map((row) => redactAgentContextText(row))
        : []
    };
  });
  const targetsForRoute = (route) => cleanupQueue.filter((candidate) => candidate.route === route);
  const execution = executionRecord ? {
    planId,
    scanFingerprint,
    scanFingerprintPresent: Boolean(scanFingerprint),
    consentPlanId,
    consentMatchesPlan: Boolean(planId && consentPlanId && consentPlanId === planId),
    route: executionRecord.route,
    accepted: executionRecord.accepted,
    reclaimedBytes: executionRecord.bytes,
    proofStatus: getAgentProofStatus(executionRecord, postRunProof),
    proofAllowsNextExecutor: workflowLocks.proofAllowsNextExecutor,
    proofHandoffRequired: Boolean(workflowLocks.proofHandoffRequired),
    noOpExecution: Boolean(workflowLocks.noOpExecution),
    canRunPostRunRescan: Boolean(executionRecord),
    rescanComparisonStatus: postRunProof.status,
    postRunScanEvidence: Boolean(postRunProof.scanGeneratedAt),
    largeFileArchiveDestination: redactPath(String(archiveDestination || "").trim()),
    archiveDestinationReady: Boolean(String(archiveDestination || "").trim()),
    permanentRemovalConfirmed: Boolean(permanentRemovalConfirmed)
  } : {
    planId,
    scanFingerprint,
    scanFingerprintPresent: Boolean(scanFingerprint),
    consentPlanId,
    consentMatchesPlan: Boolean(planId && consentPlanId && consentPlanId === planId),
    proofStatus: "waiting-for-execution",
    proofAllowsNextExecutor: true,
    canRunPostRunRescan: false,
    rescanComparisonStatus: "not-run",
    postRunScanEvidence: false,
    largeFileArchiveDestination: redactPath(String(archiveDestination || "").trim()),
    archiveDestinationReady: Boolean(String(archiveDestination || "").trim()),
    permanentRemovalConfirmed: Boolean(permanentRemovalConfirmed)
  };
  const agentTaskQueue = buildAppAgentTaskQueue({ cleanupQueue, manualReviewTargets, execution });
  return {
    schemaVersion: "spaceguard-openai-agent-context/v1",
    productSurface: "real-windows-desktop-app",
    runtime: {
      nativeAvailable: Boolean(runtime?.available),
      windows: Boolean(runtime?.windows),
      realRunEnabled: Boolean(runtime?.realRunEnabled),
      destructiveCommands: Boolean(runtime?.destructiveCommands),
      executorScopeStatus: runtime?.executorScopeStatus || "",
      enabledScopedExecutorFlagCount: Number(runtime?.enabledScopedExecutorFlagCount || 0),
      enabledScopedExecutorFlags: runtime?.enabledScopedExecutorFlags || [],
      ...(runtime?.executorFlags || {}),
      openAiAgentAdvice: Boolean(runtime?.openAiAgentAdvice),
      openAiAdvisorConfigured: Boolean(runtime?.openAiAdvisorConfigured)
    },
    scan: {
      generatedAt: scan?.generatedAt || "",
      targetDrive: scan?.targetDrive || "",
      volume: scan?.volume || null,
      findings: (scan?.findings || []).slice(0, 24).map((finding) => ({
        recipeId: finding.recipeId,
        title: finding.title,
        status: finding.status,
        bytes: Number(finding.bytes || 0),
        path: redactPath(finding.path || ""),
        itemCount: finding.items?.length || 0
      }))
    },
    cleanupQueue,
    executableRows: cleanupQueue,
    manualReviewTargets,
    reviewedDownloadsTargets: targetsForRoute("item-review-recycle-bin"),
    reviewedProjectTargets: targetsForRoute("item-review-project-cache"),
    largeFileArchiveTargets: targetsForRoute("item-review-large-files"),
    browserCacheTargets: targetsForRoute("browser-cache-only"),
    gradleCacheTargets: targetsForRoute("bounded-cache-delete"),
    userCacheTargets: targetsForRoute("bounded-user-cache-delete"),
    androidCacheTargets: targetsForRoute("bounded-android-cache-delete"),
    shaderCacheTargets: targetsForRoute("launcher-cache-cleanup"),
    pipCacheTargets: targetsForRoute("bounded-pip-cache-delete"),
    dockerBuildCacheTargets: targetsForRoute("tool-native-docker-build-cache-prune"),
    npmCacheTargets: targetsForRoute("bounded-npm-cache-delete"),
    pnpmStoreTargets: targetsForRoute("bounded-pnpm-store-delete"),
    recycleBinTargets: targetsForRoute("shell-recycle-bin"),
    agentTaskQueue,
    selected: selectedCandidate ? {
      id: agentCandidateIds.get(selectedCandidate.id) || buildAgentCleanupTargetId(selectedCandidate, 0),
      route: selectedCandidate.route,
      routeInput: selectedCandidate.routeInput,
      canExecute: isOneClickCleanupCandidate(selectedCandidate),
      bytes: selectedCandidate.bytes
    } : null,
    execution
  };
}

function buildAgentCleanupTargetId(candidate = {}, index = 0) {
  return buildWorkflowAgentTargetId(candidate, index);
}

function buildAgentManualTargetId(finding = {}, index = 0) {
  const base = finding.manualGuidance?.kind || finding.status || "manual-review";
  return `manual-${slugifyId(base)}-${index + 1}`;
}

function getAgentProofStatus(executionRecord, postRunProof) {
  if (!executionRecord) return "waiting-for-execution";
  if (postRunProof?.matched || (executionRecord.accepted && Number(executionRecord.bytes || 0) <= 0)) return "proof-complete";
  return postRunProof?.status || "proof-pending";
}

function redactPath(value = "") {
  return String(value || "")
    .replace(/[A-Za-z]:\\Users\\[^\\]+\\AppData\\LocalLow/gi, "%USERPROFILE%\\AppData\\LocalLow")
    .replace(/[A-Za-z]:\\Users\\[^\\]+\\AppData\\Local/gi, "%LOCALAPPDATA%")
    .replace(/[A-Za-z]:\\Users\\[^\\]+\\AppData\\Roaming/gi, "%APPDATA%")
    .replace(/[A-Za-z]:\\Users\\[^\\]+/gi, "%USERPROFILE%")
    .replace(/[A-Za-z]:\\Windows/gi, "%WINDIR%")
    .replace(/[A-Za-z]:\\Program Files \(x86\)/gi, "%PROGRAMFILES(X86)%")
    .replace(/[A-Za-z]:\\Program Files/gi, "%PROGRAMFILES%")
    .replace(/[A-Za-z]:\\ProgramData/gi, "%PROGRAMDATA%");
}

function redactAgentContextText(value = "") {
  return redactPath(value);
}

function buildScanFingerprint(scan) {
  if (!scan) return "";
  return [
    scan.targetDrive,
    scan.generatedAt,
    scan.findings?.length || 0,
    scan.totalBytes || 0,
    scan.volume?.freeBytes || 0
  ].join(":");
}

function buildAgentContextKey({
  runtime,
  scanFingerprint = "",
  selectedCandidate,
  executionRecord,
  postRunProof,
  archiveDestination = "",
  permanentRemovalConfirmed = false,
  agentPrompt = ""
}) {
  const selectedTargetHash = hashContextValue([
    selectedCandidate?.id || "",
    selectedCandidate?.targetPath || "",
    selectedCandidate?.reviewTarget?.path || ""
  ].join("|"));
  const executionHash = hashContextValue([
    executionRecord?.planId || "",
    executionRecord?.id || "",
    executionRecord?.targetPath || "",
    executionRecord?.executedAt || ""
  ].join("|"));
  const archiveHash = archiveDestination ? hashContextValue(redactPath(archiveDestination)) : "archive-missing";
  return [
    scanFingerprint || "scan-missing",
    runtime?.available ? "native-ready" : "native-missing",
    runtime?.windows ? "windows" : "not-windows",
    runtime?.realRunEnabled ? "real-run" : "real-run-blocked",
    runtime?.executorScopeStatus || "scope-unknown",
    runtime?.openAiAdvisorConfigured ? "openai-configured" : "openai-missing",
    selectedCandidate?.recipeId || "target-missing",
    selectedCandidate?.routeInput || "target-route-missing",
    selectedCandidate?.actionType || "target-action-missing",
    selectedCandidate?.canExecute ? "target-executable" : "target-blocked",
    Number(selectedCandidate?.bytes || 0),
    selectedTargetHash,
    executionRecord?.accepted ? "execution-accepted" : "execution-open",
    Number(executionRecord?.bytes || 0),
    executionHash,
    postRunProof?.status || "proof-not-run",
    postRunProof?.scanGeneratedAt || "proof-scan-missing",
    permanentRemovalConfirmed ? "permanent-confirmed" : "permanent-unconfirmed",
    archiveHash,
    hashContextValue(agentPrompt)
  ].join("|");
}

function hashContextValue(value = "") {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildProofCandidateFromExecutionRecord(executionRecord) {
  if (!executionRecord) return null;
  return {
    id: executionRecord.id,
    title: executionRecord.title,
    recipeId: executionRecord.recipeId,
    route: executionRecord.route,
    routeInput: executionRecord.routeInput,
    envVar: executionRecord.envVar,
    targetPath: executionRecord.targetPath,
    bytes: Number(executionRecord.expectedBytes || executionRecord.bytes || 0),
    sourceFinding: executionRecord.sourceFinding || null,
    reviewTarget: executionRecord.reviewTarget || null
  };
}

function buildCurrentPlanId({ candidate, scanFingerprint }) {
  if (!candidate || !scanFingerprint) return "";
  return [
    "plan",
    candidate.routeInput,
    candidate.id,
    scanFingerprint
  ]
    .join("-")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 140);
}

function totalEntryBytes(entries = []) {
  return entries.reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
}

function formatExecutionGateError(gate = {}) {
  const blocker = Array.isArray(gate.blockers) ? gate.blockers[0] : null;
  if (!blocker) return "Cleanup is not ready yet. Check one cleanable item and try again.";
  if (blocker.id === "selected-target") return "Select one ready item before deleting.";
  if (blocker.id === "route-readiness") return "This item is not ready to delete. Choose another ready item or scan again.";
  if (blocker.id === "consent-checkbox") return "Select one ready item before deleting.";
  if (blocker.id === "scan-fingerprint") return "Refresh the scan, then try deleting again.";
  if (blocker.id === "execution-prerequisites") return "Finish the extra requirement shown for this item, then try again.";
  if (blocker.id === "executor-not-running") return "Cleanup is already running. Wait for it to finish.";
  return blocker.detail || "Cleanup is not ready yet. Refresh the scan and try again.";
}

function formatCleanupStartError(error) {
  const detail = error instanceof Error ? error.message : "";
  if (/native scanner|native bridge|desktop/i.test(detail)) {
    return "The Windows desktop connection is not ready. Restart the desktop app and try again.";
  }
  if (/permission|access denied|denied/i.test(detail)) {
    return "Windows blocked access to this item. Close related apps or run the desktop app with the needed permissions, then try again.";
  }
  return detail ? `Cleanup did not start. ${detail}` : "Cleanup did not start. Refresh the scan and try again.";
}

function formatShortDate(value = "") {
  if (!value) return "not run";
  const timestamp = parseWorkflowTimestamp(value);
  if (!Number.isFinite(timestamp)) return value;
  const date = new Date(timestamp);
  return date.toLocaleString();
}

export default App;
