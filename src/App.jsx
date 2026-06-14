import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  File as FileIcon,
  Folder,
  FolderSearch,
  HardDrive,
  KeyRound,
  PieChart,
  ListTree,
  Loader2,
  Lock,
  RefreshCcw,
  ScanLine,
  ShieldCheck,
  Trash2,
  X,
  Zap
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  runNativeExploreDir,
  runNativeExploreFast,
  runNativeScanVolume,
  onNativeMftProgress,
  runNativeRecycleDelete,
  runNativeReadonlyScan,
  runNativeRecycleBinExecutor,
  runNativeShaderCacheExecutor,
  runNativeTempCleanupExecutor,
  runNativeUserCacheExecutor
} from "./native-scanner.mjs";
import { buildOpenAIAgentRecommendationBroker, requestOpenAIAgentAdvice } from "./openai-agent.mjs";
import { computeTreemapLayout } from "./treemap.mjs";
import { buildAppAgentTaskQueue, buildExecutionGate, buildExecutionLedgerRows, buildExecutionPrerequisites, buildManualFindingGuidance, buildPostRunProof, buildRouteReadiness, buildWorkflowAgentTargetId, buildWorkflowLocks, formatBytes, resolveWorkflowAgentBrokerCandidate } from "./real-workflow.mjs";

const DEFAULT_SCAN_REQUEST = {
  targetDrive: "C:",
  protectedPaths: "",
  customRoots: "",
  includeProjectArtifacts: false,
  maxDepth: 6,
  maxEntriesPerRoot: 12000
};
const EXPLORE_VISUAL_COLORS = [
  { bar: "bg-emerald-500", dot: "bg-emerald-500" },
  { bar: "bg-sky-500", dot: "bg-sky-500" },
  { bar: "bg-amber-500", dot: "bg-amber-500" },
  { bar: "bg-rose-500", dot: "bg-rose-500" },
  { bar: "bg-violet-500", dot: "bg-violet-500" },
  { bar: "bg-cyan-500", dot: "bg-cyan-500" },
  { bar: "bg-lime-500", dot: "bg-lime-500" },
  { bar: "bg-zinc-500", dot: "bg-zinc-500" }
];
const DRIVE_ALLOCATION_LABELS = {
  "system-or-protected": "Windows/system",
  "user-data-review": "Users and app data",
  "advanced-system": "System file",
  "unknown-review": "Other C: item",
  cleanable: "Can delete",
  manual: "Review",
  unlisted: "Not yet explored"
};
const DRIVE_ALLOCATION_GROUPS = {
  cleanable: {
    label: "Can delete after confirmation",
    detail: "Exact cleanup targets found by SpaceGuard. These are the only rows that become Delete buttons.",
    status: "actionable"
  },
  "user-data-review": {
    label: "Users, downloads, and app data",
    detail: "Profiles, Downloads, Desktop data, and per-user app storage. Delete only from specific cleanable rows.",
    status: "inspect"
  },
  "system-or-protected": {
    label: "Windows, apps, and protected folders",
    detail: "Windows, Program Files, ProgramData, recovery folders, and other protected locations.",
    status: "system"
  },
  "advanced-system": {
    label: "Windows-managed files",
    detail: "Pagefile, hibernation, swap, or similar files. Reclaim through Windows settings when available.",
    status: "system"
  },
  manual: {
    label: "Needs review",
    detail: "Measured items that need user judgement before any cleanup path is created.",
    status: "inspect"
  },
  "unknown-review": {
    label: "Other measured C: entries",
    detail: "Top-level files or folders measured from C: that are not classified as a safe cleanup target.",
    status: "inspect"
  },
  unlisted: {
    label: "Not yet explored",
    detail: "Open Browse C: and drill into the big folders to see what is using this space.",
    status: "estimated"
  }
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
    label: "Project dependency cleanup",
    route: "item-review-project-cache",
    routeInput: "project-deps",
    flagKey: "projectDependencyExecutor",
    envVar: "SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR",
    executor: "projectDeps",
    actionType: "run-project-deps-executor",
    risk: "review",
    targetKind: "project dependency",
    consequence: "Only the selected node_modules target is removed."
  },
  "downloads-installers": {
    label: "Downloads cleanup",
    route: "item-review-recycle-bin",
    routeInput: "downloads",
    flagKey: "downloadsCleanupExecutor",
    envVar: "SPACEGUARD_ENABLE_DOWNLOADS_EXECUTOR",
    executor: "downloads",
    actionType: "run-downloads-cleanup-executor",
    risk: "review",
    targetKind: "file",
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
  targetKind: "file",
  consequence: "Only the selected large file is moved to the archive destination."
};

const MANUAL_RECIPE_LABELS = {
  "installed-app-footprints": "Installed apps",
  "large-user-files": "Large files",
  "android-studio": "Android Studio",
  "docker-volumes": "Docker volumes",
  "windows-old": "Previous Windows installation",
  hibernation: "Hibernation file",
  pagefile: "Pagefile",
  "wsl-vhdx": "WSL virtual disk"
};

function App() {
  const [activeView, setActiveView] = useState("clean");
  const [capability, setCapability] = useState(() => getNativeScannerCapability());
  const [runtime, setRuntime] = useState(null);
  const [runtimeStatus, setRuntimeStatus] = useState("loading");
  const [runtimeError, setRuntimeError] = useState("");
  const [scanStatus, setScanStatus] = useState("idle");
  const [scanError, setScanError] = useState("");
  const [scan, setScan] = useState(null);
  const [postRunScan, setPostRunScan] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [checkedIds, setCheckedIds] = useState([]);
  const [consentChecked, setConsentChecked] = useState(false);
  const [archiveDestination, setArchiveDestination] = useState("");
  const [executionStatus, setExecutionStatus] = useState("idle");
  const [executionError, setExecutionError] = useState("");
  const [executionResult, setExecutionResult] = useState(null);
  const [executionRecord, setExecutionRecord] = useState(null);
  const [exploreConfirmIds, setExploreConfirmIds] = useState([]);
  const [agentPrompt, setAgentPrompt] = useState("Find the safest next cleanup step from the current real scan.");
  const [agentStatus, setAgentStatus] = useState("idle");
  const [agentError, setAgentError] = useState("");
  const [agentAdvice, setAgentAdvice] = useState(null);

  useEffect(() => {
    refreshRuntime();
  }, []);

  const nativeConnected = Boolean(capability.available && runtime?.available);
  const aiAvailable = Boolean(runtime?.openAiAgentAdvice && runtime?.openAiAdvisorConfigured);
  const visibleView = activeView === "agent" && !aiAvailable ? "clean" : activeView;
  const candidates = useMemo(() => buildCleanupCandidates(scan, runtime), [scan, runtime]);
  const checkedCandidates = useMemo(
    () => checkedIds
      .map((id) => candidates.find((candidate) => candidate.id === id))
      .filter(isOneClickCleanupCandidate),
    [checkedIds, candidates]
  );
  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedId) || checkedCandidates[0] || null,
    [candidates, selectedId, checkedCandidates]
  );
  const exploreConfirmCandidates = useMemo(
    () => exploreConfirmIds
      .map((id) => candidates.find((candidate) => candidate.id === id))
      .filter(isOneClickCleanupCandidate),
    [candidates, exploreConfirmIds]
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

  async function runRealScan({ afterExecution = false, nextView = "clean" } = {}) {
    setScanStatus(afterExecution ? "rescanning" : "scanning");
    setScanError("");
    try {
      const result = await runNativeReadonlyScan(toNativeScanRequest(DEFAULT_SCAN_REQUEST));
      if (!result.available || !result.windows) {
        throw new Error("The native scanner is not available on this Windows desktop session.");
      }
      const latestRuntime = await refreshRuntime();
      if (afterExecution) {
        setScan(result);
        setPostRunScan(result);
        setSelectedId("");
        setCheckedIds([]);
        setConsentChecked(false);
        setArchiveDestination("");
      } else {
        const defaultSelection = selectDefaultCleanupCandidateId(buildCleanupCandidates(result, latestRuntime || runtime));
        setScan(result);
        setPostRunScan(null);
        setExecutionResult(null);
        setExecutionRecord(null);
        setSelectedId(defaultSelection);
        setCheckedIds([]);
        setConsentChecked(false);
      }
      setScanStatus("complete");
      setActiveView(nextView);
    } catch (error) {
      setScanStatus("error");
      setScanError(formatScanError(error));
    }
  }

  async function executeCheckedCleanups(targetOverride = null) {
    if (scanStatus === "scanning" || scanStatus === "rescanning") return;
    const targets = Array.isArray(targetOverride)
      ? targetOverride.filter(isOneClickCleanupCandidate)
      : checkedCandidates;
    if (!targets.length) return;
    if (targets.length === 1) {
      await executeCleanupCandidate(targets[0]);
      return;
    }
    await executeCleanupBatch(targets);
  }

  async function executeCleanupBatch(targets = [], { nextView = "clean" } = {}) {
    if (!targets.length) return;
    setExecutionStatus("running");
    setExecutionError("");
    setExecutionResult(null);
    const executedAt = new Date().toISOString();
    const batchPlanId = `batch-${Date.now()}-${targets.length}`;
    const allEntries = [];
    const allWarnings = [];
    let acceptedCount = 0;
    let rejectedCount = 0;
    try {
      for (const target of targets) {
        setSelectedId(target.id);
        try {
          const { result } = await executeCleanupCandidate(target, { updateUi: false, rescanAfter: false });
          allEntries.push(...(result.entries || []));
          allWarnings.push(...(result.warnings || []));
          if (result.accepted) acceptedCount += 1;
          else rejectedCount += 1;
        } catch (error) {
          const rejectedEntry = buildRejectedCheckedCleanupEntry(target, error);
          allEntries.push(rejectedEntry);
          allWarnings.push(rejectedEntry.note);
          rejectedCount += 1;
        }
      }
      const reclaimedBytes = allEntries.reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
      const accepted = acceptedCount > 0;
      const aggregateResult = {
        mode: "checked-cleanups",
        accepted,
        totalCount: targets.length,
        acceptedCount,
        rejectedCount,
        reason: rejectedCount ? `${rejectedCount} selected cleanup item(s) could not be cleaned.` : "",
        entries: allEntries,
        warnings: allWarnings
      };
      const aggregateRecord = {
        schemaVersion: "spaceguard-real-execution-record/v1",
        planId: batchPlanId,
        executedAt,
        source: "native-checked-cleanups",
        id: "checked-cleanups",
        title: `${targets.length} checked cleanups`,
        recipeId: "checked-cleanups",
        route: "checked-cleanups",
        routeInput: "checked-cleanups",
        envVar: "",
        targetPath: "",
        expectedBytes: targets.reduce((sum, target) => sum + Number(target.bytes || 0), 0),
        bytes: reclaimedBytes,
        accepted,
        resultMode: "checked-cleanups",
        reason: aggregateResult.reason,
        volumeProof: null,
        sourceFinding: null,
        reviewTarget: null,
        entries: allEntries
      };
      setExecutionResult(aggregateResult);
      setExecutionRecord(aggregateRecord);
      setPostRunScan(null);
      setExecutionStatus(accepted ? "complete" : "rejected");
      if (accepted) {
        await runRealScan({ afterExecution: true, nextView });
      }
    } catch (error) {
      setExecutionStatus("error");
      setExecutionError(formatCleanupStartError(error));
    }
  }

  async function executeExploreCleanupCandidates() {
    const targets = exploreConfirmCandidates;
    if (!targets.length || executionStatus === "running") return;
    setExploreConfirmIds([]);
    setActiveView("explore");
    if (targets.length === 1) {
      const { result } = await executeCleanupCandidate(targets[0], { rescanAfter: false });
      if (result?.accepted) {
        await runRealScan({ afterExecution: true, nextView: "explore" });
      }
      return;
    }
    await executeCleanupBatch(targets, { nextView: "explore" });
  }

  async function executeCleanupCandidate(candidateForExecution, { updateUi = true, rescanAfter = true } = {}) {
    const consentForExecution = true;
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
      const message = formatExecutionGateError(currentExecutionGate);
      if (updateUi) {
        setExecutionStatus("error");
        setExecutionError(message);
        return { result: { accepted: false, reason: message, entries: [], warnings: [message] }, record: null };
      }
      throw new Error(message);
    }
    if (updateUi) {
      setSelectedId(candidateForExecution.id);
      setCheckedIds([candidateForExecution.id]);
      setConsentChecked(true);
      setExecutionStatus("running");
      setExecutionError("");
      setExecutionResult(null);
    }
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
      if (updateUi) {
        setExecutionResult(result);
        setExecutionRecord(record);
        setPostRunScan(null);
        setExecutionStatus(result.accepted ? "complete" : "rejected");
      }
      if (rescanAfter && result.accepted) {
        await runRealScan({ afterExecution: true });
      }
      return { result, record };
    } catch (error) {
      if (updateUi) {
        setExecutionStatus("error");
        setExecutionError(formatCleanupStartError(error));
        return {
          result: {
            accepted: false,
            reason: error instanceof Error ? error.message : "Cleanup failed.",
            entries: [],
            warnings: [formatCleanupStartError(error)]
          },
          record: null
        };
      }
      throw error;
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
      setAgentError(formatAgentError(error));
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
    if (row.kind === "review" || row.kind === "manual") {
      setActiveView("explore");
      return;
    }

    focusAgentBrokerPanel(row);
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
    const checked = Boolean(options.checked && target?.canExecute);
    setCheckedIds(checked ? [id] : []);
    setConsentChecked(checked);
  }

  function toggleCleanupCandidate(candidate) {
    if (!candidate?.id) return;
    if (!candidate.canExecute) return;
    if (executionStatus === "running") return;
    const isChecked = checkedIds.includes(candidate.id);
    const nextCheckedIds = isChecked
      ? checkedIds.filter((id) => id !== candidate.id)
      : [...checkedIds, candidate.id];
    setCheckedIds(nextCheckedIds);
    setSelectedId(isChecked ? nextCheckedIds[0] || "" : candidate.id);
    setConsentChecked(nextCheckedIds.length > 0);
    setExecutionError("");
    setExecutionResult(null);
    setExecutionRecord(null);
    setPostRunScan(null);
    setExecutionStatus("idle");
    setArchiveDestination("");
  }

  function setCheckedCleanupCandidates(rows = []) {
    if (executionStatus === "running") return;
    const nextCheckedIds = rows
      .filter(isOneClickCleanupCandidate)
      .map((row) => row.id);
    setCheckedIds(nextCheckedIds);
    setSelectedId(nextCheckedIds[0] || "");
    setConsentChecked(nextCheckedIds.length > 0);
    setExecutionError("");
    setExecutionResult(null);
    setExecutionRecord(null);
    setPostRunScan(null);
    setExecutionStatus("idle");
    setArchiveDestination("");
  }

  if (!nativeConnected) {
    return (
      <AppFrame
        activeView={visibleView}
        setActiveView={setActiveView}
        showAgent={aiAvailable}
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
      activeView={visibleView}
      setActiveView={setActiveView}
      showAgent={aiAvailable}
    >
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-5 lg:px-7">
        <TopBar
          scan={scan}
        />
        {visibleView === "clean" ? (
          <section className="grid gap-4">
            {!scan ? (
              <ScanPanel
                scanStatus={scanStatus}
                scanError={scanError}
                onRunScan={() => runRealScan()}
              />
            ) : (
              <CleanPanel
                candidates={candidates}
                checkedIds={checkedIds}
                executionStatus={executionStatus}
                executionError={executionError}
                executionResult={executionResult}
                scanStatus={scanStatus}
                scan={scan}
                onToggleCandidate={toggleCleanupCandidate}
                onSetCheckedCandidates={setCheckedCleanupCandidates}
                onExecuteChecked={executeCheckedCleanups}
                onScanAgain={() => runRealScan()}
                onRescan={() => runRealScan({ afterExecution: true })}
                onOpenExplore={() => setActiveView("explore")}
              />
            )}
          </section>
        ) : null}
        {visibleView === "explore" ? (
          <ExplorePanel
            scan={scan}
            scanStatus={scanStatus}
            executionStatus={executionStatus}
            executionError={executionError}
            executionResult={executionResult}
            candidates={candidates}
            manualFindings={manualFindings}
            nativeConnected={nativeConnected}
            onRequestCleanup={(ids) => setExploreConfirmIds(Array.isArray(ids) ? ids : [ids])}
            onRunScan={() => runRealScan({ nextView: "explore" })}
            onRescan={() => runRealScan({ afterExecution: true, nextView: "explore" })}
          />
        ) : null}
        {visibleView === "agent" && aiAvailable ? (
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
      </main>
      <CleanupConfirmModal
        candidates={exploreConfirmCandidates}
        running={executionStatus === "running"}
        onCancel={() => setExploreConfirmIds([])}
        onConfirm={executeExploreCleanupCandidates}
      />
    </AppFrame>
  );
}

function AppFrame({ children, activeView = "clean", setActiveView = () => {}, showAgent = false }) {
  const navRows = [
    { id: "clean", label: "Clean", icon: Trash2 },
    { id: "explore", label: "Explore C:", icon: ListTree },
    ...(showAgent ? [{ id: "agent", label: "Ask AI", icon: Bot }] : [])
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
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted ${
                      activeView === row.id ? "bg-primary text-primary-foreground hover:bg-primary" : ""
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${activeView === row.id ? "text-primary-foreground" : "text-muted-foreground"}`} />
                    {row.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>
        <div className="min-w-0">
          <MobileTabNav rows={navRows} activeView={activeView} setActiveView={setActiveView} />
          {children}
        </div>
      </div>
    </div>
  );
}

function MobileTabNav({ rows = [], activeView = "clean", setActiveView = () => {} }) {
  return (
    <nav role="tablist" aria-label="SpaceGuard views" className={`sticky top-0 z-20 grid ${rows.length > 2 ? "grid-cols-3" : "grid-cols-2"} border-b bg-card/95 px-2 py-2 shadow-sm backdrop-blur lg:hidden`}>
      {rows.map((row) => {
        const Icon = row.icon;
        const active = activeView === row.id;
        return (
          <button
            key={row.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setActiveView(row.id)}
            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-md px-2 text-[11px] font-medium transition ${
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="truncate">{row.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ConnectionRequired({ runtime, runtimeStatus, runtimeError, onRefresh }) {
  const cleanupSteps = [
    ["Scan PC", "Find cleanable files and see where C: space is going."],
    ["Choose item", "Select what you want to remove."],
    ["Delete", "Clear the selected files from this PC."]
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
              Safe cleanup areas
            </CardTitle>
            <CardDescription>SpaceGuard maps C: space and deletes only from built-in cleanup areas after you select them.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            {["Windows temp files", "Browser caches", "Developer caches", "Recycle Bin", "Old downloads", "C: space map"].map((item) => (
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

function TopBar({ scan }) {
  const free = scan?.volume?.freeBytes || 0;
  const total = scan?.volume?.totalBytes || 0;
  const usedPercent = total ? Math.min(100, Math.max(0, ((total - free) / total) * 100)) : 0;
  return (
    <header className="flex flex-col gap-4 rounded-md border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">SpaceGuard Windows cleanup</h1>
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
      </div>
    </header>
  );
}

function ScanPanel({ scanStatus, scanError, onRunScan }) {
  const running = scanStatus === "scanning" || scanStatus === "rescanning";
  return (
    <Card className="rounded-md">
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FolderSearch className="h-4 w-4" />
              Scan for cleanup
            </CardTitle>
            <CardDescription>
              Fast scan first. Nothing is deleted until you choose an item.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-xs">
          <Button className="w-full" onClick={onRunScan} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
            Scan PC
          </Button>
        </div>
        {scanError ? <Notice tone="restricted" icon={AlertTriangle} text={scanError} /> : null}
      </CardContent>
    </Card>
  );
}

function CleanPanel({
  candidates,
  checkedIds = [],
  executionStatus,
  executionError,
  executionResult,
  scanStatus,
  scan,
  onToggleCandidate,
  onSetCheckedCandidates,
  onExecuteChecked,
  onScanAgain,
  onRescan,
  onOpenExplore
}) {
  const readyCandidates = candidates.filter(isOneClickCleanupCandidate);
  const hasReadyCandidates = readyCandidates.length > 0;
  const checkedCandidates = readyCandidates.filter((row) => checkedIds.includes(row.id));
  const checkedCount = checkedCandidates.length;
  const checkedBytes = checkedCandidates.reduce((sum, row) => sum + Number(row.bytes || 0), 0);
  const allReadyChecked = hasReadyCandidates && checkedCount === readyCandidates.length;
  const running = executionStatus === "running";
  const refreshing = scanStatus === "scanning" || scanStatus === "rescanning";
  const actionDisabled = running || refreshing;
  const deleteAllDisabled = !hasReadyCandidates || actionDisabled;
  function deleteAllReadyCandidates() {
    if (deleteAllDisabled) return;
    onSetCheckedCandidates(readyCandidates);
    onExecuteChecked(readyCandidates);
  }
  return (
    <Card id="cleanup-actions-panel" className="rounded-md">
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Select items to delete
            </CardTitle>
            <CardDescription>Check what you want to remove. SpaceGuard deletes only built-in cleanable items.</CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row md:justify-end">
            {hasReadyCandidates ? (
              <Button className="w-full sm:w-auto" variant="destructive" onClick={deleteAllReadyCandidates} disabled={deleteAllDisabled}>
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete all
              </Button>
            ) : null}
            <Button className="w-full sm:w-auto" variant="outline" onClick={onScanAgain} disabled={running || refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              {refreshing ? "Scanning" : "Scan again"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!scan ? (
          <EmptyState icon={ScanLine} title="Scan first" detail="Cleanable items appear here after the scan finishes." />
        ) : candidates.length ? (
          <>
            {hasReadyCandidates ? (
              <>
                <div className="sticky top-16 z-10 flex flex-col gap-3 rounded-md border bg-card p-3 shadow-sm md:flex-row md:items-center md:justify-between lg:top-4">
                  <div>
                    <p className="text-sm font-medium">
                      {checkedCount ? `${checkedCount} item${checkedCount === 1 ? "" : "s"} selected` : "Choose items to delete"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {checkedCount ? `${formatBytes(checkedBytes)} selected` : "Use checkboxes or delete everything cleanable."}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={actionDisabled}
                      onClick={() => onSetCheckedCandidates(allReadyChecked ? [] : readyCandidates)}
                    >
                      {allReadyChecked ? <X className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      {allReadyChecked ? "Clear" : "Select all"}
                    </Button>
                    <Button
                      className="w-full sm:w-auto"
                      variant="destructive"
                      disabled={!checkedCount || actionDisabled}
                      onClick={onExecuteChecked}
                    >
                      {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      {running ? "Deleting" : "Delete selected"}
                    </Button>
                  </div>
                </div>
                {executionError ? <Notice tone="restricted" icon={AlertTriangle} text={executionError} /> : null}
                {executionResult ? (
                  <CleanupResult
                    result={executionResult}
                    scanStatus={scanStatus}
                    onRescan={onRescan}
                  />
                ) : null}
                <div className="grid gap-3">
                  {readyCandidates.map((row) => {
                    const checked = checkedIds.includes(row.id);
                    return (
                      <div
                        key={row.id}
                        className={`rounded-md border bg-background transition hover:border-primary ${
                          checked ? "border-primary bg-primary/5" : ""
                        }`}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (!actionDisabled) onToggleCandidate(row);
                          }}
                          onKeyDown={(event) => {
                            if (!actionDisabled && (event.key === "Enter" || event.key === " ")) onToggleCandidate(row);
                          }}
                          className="flex cursor-pointer flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between"
                        >
                          <div className="flex min-w-0 gap-3">
                            <Checkbox
                              checked={checked}
                              disabled={actionDisabled}
                              aria-label={`Select ${row.title}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (!actionDisabled) onToggleCandidate(row);
                              }}
                            />
                            <div className="min-w-0">
                              <p className="font-medium">{row.title}</p>
                              <p className="mt-1 text-sm text-muted-foreground">{formatCleanRowSummary(row)}</p>
                            </div>
                          </div>
                          <div className="shrink-0 md:text-right">
                            <p className="text-lg font-semibold">{formatBytes(row.bytes)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <EmptyState
                icon={Lock}
                title="No items available to delete"
                detail="Open Explore to inspect what is using space."
                actionLabel="Open Explore"
                actionIcon={ListTree}
                onAction={onOpenExplore}
              />
            )}
          </>
        ) : (
          <EmptyState
            icon={Lock}
            title="No cleanable findings yet"
            detail="Open Explore to see the C: space map."
            actionLabel="Open Explore"
            actionIcon={ListTree}
            onAction={onOpenExplore}
          />
        )}
      </CardContent>
    </Card>
  );
}

function CleanupResult({ result, scanStatus, onRescan }) {
  const accepted = Boolean(result?.accepted);
  const reclaimedBytes = totalEntryBytes(result?.entries || []);
  const removedFiles = reclaimedBytes > 0;
  const checkedCleanup = result?.mode === "checked-cleanups";
  const rejectedCount = Number(result?.rejectedCount || 0);
  const acceptedCount = Number(result?.acceptedCount || 0);
  const acceptedTitle = checkedCleanup
    ? rejectedCount > 0
      ? "Some selected items cleaned"
      : removedFiles
        ? "Selected items cleaned"
        : "Nothing to remove"
    : removedFiles ? "Cleaned" : "Nothing to remove";
  const runningRescan = scanStatus === "rescanning";
  const acceptedText = checkedCleanup
    ? formatCheckedCleanupMessage({ reclaimedBytes, removedFiles, runningRescan, scanStatus, acceptedCount, rejectedCount })
    : formatAcceptedCleanupMessage({ reclaimedBytes, removedFiles, runningRescan, scanStatus });
  const rejectedText = formatCleanupRejectMessage(result);
  const showRefreshAction = !accepted || runningRescan || scanStatus === "error";
  return (
    <div className={`rounded-md border p-4 text-sm ${accepted ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-red-200 bg-red-50 text-red-950"}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-base font-semibold">{accepted ? acceptedTitle : checkedCleanup ? "Could not clean selected items" : "Could not clean this item"}</p>
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

function ExplorePanel({
  scan,
  scanStatus = "idle",
  executionStatus = "idle",
  executionError = "",
  executionResult = null,
  candidates = [],
  manualFindings = [],
  nativeConnected = false,
  onRequestCleanup,
  onRunScan,
  onRescan
}) {
  const [mode, setMode] = useState("visualize");
  const [selectedIds, setSelectedIds] = useState([]);
  const rows = buildExploreRows(scan, candidates, manualFindings);
  const readyRows = rows.filter((row) => row.ready && row.candidateId);
  const selectedRows = readyRows.filter((row) => selectedIds.includes(row.candidateId));
  const selectedBytes = selectedRows.reduce((sum, row) => sum + Number(row.bytes || 0), 0);
  const allSelected = readyRows.length > 0 && selectedRows.length === readyRows.length;
  const scanning = scanStatus === "scanning" || scanStatus === "rescanning";
  const deleting = executionStatus === "running";
  const deleteDisabled = scanning || deleting;
  function toggleSelectedId(id) {
    if (!id || deleteDisabled) return;
    setSelectedIds((current) => current.includes(id) ? current.filter((rowId) => rowId !== id) : [...current, id]);
  }
  function setAllSelected() {
    if (deleteDisabled) return;
    setSelectedIds(allSelected ? [] : readyRows.map((row) => row.candidateId));
  }
  function requestSelectedCleanup() {
    if (!selectedRows.length || deleteDisabled) return;
    onRequestCleanup(selectedRows.map((row) => row.candidateId));
    setSelectedIds([]);
  }
  return (
    <Card id="drive-explorer-panel" className="rounded-md">
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ListTree className="h-4 w-4" />
              Explore C:
            </CardTitle>
            <CardDescription>See what is using space and select cleanable items.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onRunScan} disabled={scanning}>
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
            {scanning ? "Scanning" : scan ? "Scan again" : "Scan PC"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!scan ? (
          <EmptyState icon={HardDrive} title="Run a scan to explore C:" detail="Large folders and cleanable items appear here after scanning." />
        ) : !rows.length ? (
          <EmptyState icon={HardDrive} title="No large areas found" detail="Run a fresh scan to refresh the allocation list." />
        ) : (
          <>
            <div className="flex rounded-md border bg-muted/30 p-1" role="tablist" aria-label="Explore views">
              {[
                ["visualize", "Visualize", PieChart],
                ["list", "List", ListTree],
                ["browse", "Browse C:", Folder]
              ].map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={mode === id}
                  onClick={() => setMode(id)}
                  className={`flex min-h-9 flex-1 items-center justify-center gap-2 rounded px-3 text-sm font-medium transition ${
                    mode === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
            {executionError ? <Notice tone="restricted" icon={AlertTriangle} text={executionError} /> : null}
            {executionResult ? (
              <CleanupResult
                result={executionResult}
                scanStatus={scanStatus}
                onRescan={onRescan}
              />
            ) : null}
            <div className="grid gap-3 md:grid-cols-4">
              <Metric label="Drive" value={scan.volume?.drive || scan.targetDrive || "C:"} />
              <Metric label="Used" value={formatBytes(scan.volume?.usedBytes || 0)} />
              <Metric label="Free" value={formatBytes(scan.volume?.freeBytes || 0)} />
              <Metric label="Items" value={String(rows.length)} />
            </div>
            {mode === "visualize" ? (
              <ExploreVisualization scan={scan} rows={rows} onShowList={() => setMode("list")} />
            ) : mode === "browse" ? (
              <ExploreBrowser
                rootPath={`${scan.volume?.drive || scan.targetDrive || "C:"}\\`}
                nativeConnected={nativeConnected}
                deleteDisabled={deleteDisabled}
                onAfterDelete={onRescan}
              />
            ) : (
              <ExploreList
                rows={rows}
                selectedIds={selectedIds}
                selectedBytes={selectedBytes}
                allSelected={allSelected}
                deleteDisabled={deleteDisabled}
                onToggleSelected={toggleSelectedId}
                onSetAllSelected={setAllSelected}
                onRequestSelectedCleanup={requestSelectedCleanup}
                onRequestCleanup={onRequestCleanup}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function splitExplorePath(path = "") {
  const clean = String(path || "").replace(/\//g, "\\").replace(/\\+$/, "");
  if (!clean) return [];
  const driveMatch = clean.match(/^([a-zA-Z]:)(\\(.*))?$/);
  if (!driveMatch) {
    return clean.split("\\").filter(Boolean).map((name, index, arr) => ({
      name,
      path: arr.slice(0, index + 1).join("\\")
    }));
  }
  const drive = driveMatch[1];
  const crumbs = [{ name: `${drive}\\`, path: `${drive}\\` }];
  const rest = driveMatch[3] ? driveMatch[3].split("\\").filter(Boolean) : [];
  rest.forEach((name, index) => {
    crumbs.push({ name, path: `${drive}\\${rest.slice(0, index + 1).join("\\")}` });
  });
  return crumbs;
}

const EXPLORE_GUARD_BADGES = {
  "hard-block": { label: "protected", variant: "outline" },
  confirm: { label: "confirm needed", variant: "review" },
  warn: { label: "app data", variant: "review" },
  allow: { label: "can delete", variant: "safe" }
};

const TREEMAP_TONES = {
  allow: "bg-emerald-500/85 hover:bg-emerald-500 border-emerald-700/40 text-white",
  confirm: "bg-amber-500/85 hover:bg-amber-500 border-amber-700/40 text-white",
  warn: "bg-amber-500/85 hover:bg-amber-500 border-amber-700/40 text-white",
  "hard-block": "bg-slate-400/70 hover:bg-slate-400 border-slate-500/40 text-slate-900"
};

function ExploreTreemap({ entries = [], selectedMap = {}, onDrill = () => {}, onToggle = () => {} }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);
  const height = 320;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const update = () => setWidth(el.clientWidth);
    update();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const tiles = useMemo(() => computeTreemapLayout(entries, width, height), [entries, width]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-md border bg-muted/20"
      style={{ height }}
    >
      {tiles.map((tile) => {
        const entry = tile.item;
        const tone = TREEMAP_TONES[entry.deleteGuard] || TREEMAP_TONES.allow;
        const selected = Boolean(selectedMap[entry.path]);
        const showLabel = tile.width > 54 && tile.height > 22;
        return (
          <button
            key={entry.id || entry.path}
            type="button"
            title={`${entry.name} · ${formatBytes(entry.bytes)}${entry.isDir ? " · click to open" : ""}`}
            onClick={() => (entry.isDir ? onDrill(entry) : onToggle(entry))}
            className={`absolute overflow-hidden border text-left transition ${tone} ${selected ? "z-10 ring-2 ring-sky-600 ring-offset-1" : ""}`}
            style={{
              left: tile.x + 1,
              top: tile.y + 1,
              width: Math.max(0, tile.width - 2),
              height: Math.max(0, tile.height - 2)
            }}
          >
            {showLabel ? (
              <span className="flex h-full flex-col justify-between p-1.5">
                <span className="flex items-center gap-1 truncate text-xs font-semibold drop-shadow-sm">
                  {entry.isDir ? <Folder className="h-3 w-3 shrink-0" /> : <FileIcon className="h-3 w-3 shrink-0" />}
                  <span className="truncate">{entry.name}</span>
                </span>
                <span className="text-[10px] font-medium opacity-90">{formatBytes(entry.bytes)}</span>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function ExploreTreemapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> safe to delete</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> review / confirm</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-400" /> protected</span>
      <span className="ml-auto">Click a folder tile to open it.</span>
    </div>
  );
}

function ExploreBrowser({ rootPath = "C:\\", nativeConnected = false, deleteDisabled = false, onAfterDelete = () => {} }) {
  const [path, setPath] = useState(rootPath);
  const [level, setLevel] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState({});
  const [confirmEntries, setConfirmEntries] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [resultNote, setResultNote] = useState(null);
  const [turbo, setTurbo] = useState(true);
  const [engine, setEngine] = useState("");
  // Turbo scan lifecycle: "idle" | "scanning" | "done" | "failed"
  const [scanState, setScanState] = useState("idle");
  const [scanProgress, setScanProgress] = useState(0);
  const [scanSummary, setScanSummary] = useState(null);

  const driveLetter = String(rootPath || "C").slice(0, 1).toUpperCase();

  useEffect(() => {
    setPath(rootPath);
  }, [rootPath]);

  // Stream live record counts during a Turbo scan so it never looks frozen.
  useEffect(() => {
    return onNativeMftProgress((count) => setScanProgress(count));
  }, []);

  // Build (or rebuild) the cached MFT tree when Turbo is on. One scan per drive;
  // navigation afterwards is served instantly from the cache. On re-mount we probe
  // the cache first — if it's already warm for this drive we skip the rescan.
  useEffect(() => {
    if (!nativeConnected) return undefined;
    if (!turbo) {
      setScanState("idle");
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        // Probe: if the cache is already warm, skip the full scan.
        const probe = await runNativeExploreFast(`${driveLetter}:\\`, { protectedPaths: [] });
        if (!cancelled && probe.available !== false) {
          setScanState("done");
          return;
        }
      } catch {
        // Probe error — fall through to full scan
      }
      if (cancelled) return;
      setScanState("scanning");
      setScanProgress(0);
      try {
        const summary = await runNativeScanVolume(driveLetter);
        if (cancelled) return;
        if (summary.available === false) {
          setScanState("failed");
        } else {
          setScanSummary(summary);
          setScanState("done");
        }
      } catch (err) {
        if (!cancelled) setScanState("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [turbo, driveLetter, nativeConnected]);

  async function fetchLevel(target) {
    if (turbo && scanState === "done") {
      const fast = await runNativeExploreFast(target, { protectedPaths: [] });
      if (fast.available !== false) return { result: fast, engine: "fast" };
    }
    const walk = await runNativeExploreDir(target, { protectedPaths: [] });
    return { result: walk, engine: "walk" };
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!nativeConnected) {
        setStatus("unavailable");
        return;
      }
      // Wait for an in-flight Turbo scan; this effect re-runs when scanState settles.
      if (turbo && scanState === "scanning") return;
      setStatus("loading");
      setError("");
      setSelected({});
      try {
        const { result, engine: usedEngine } = await fetchLevel(path);
        if (cancelled) return;
        setLevel(result);
        setEngine(usedEngine);
        setStatus("idle");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not open this folder.");
        setStatus("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nativeConnected, turbo, scanState]);

  async function reloadLevel(afterDelete = false) {
    if (!nativeConnected) return;
    setStatus("loading");
    try {
      // After deletion the MFT cache still holds the old entries; use the live
      // walk so the deleted items disappear from the list immediately.
      const { result, engine: usedEngine } = afterDelete
        ? { result: await runNativeExploreDir(path, { protectedPaths: [] }), engine: "walk" }
        : await fetchLevel(path);
      setLevel(result);
      setEngine(usedEngine);
      setStatus("idle");
      setSelected({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh this folder.");
      setStatus("error");
    }
  }

  const entries = level?.entries || [];
  const crumbs = splitExplorePath(path);
  const selectedEntries = entries.filter((entry) => selected[entry.path]);
  const selectedBytes = selectedEntries.reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
  const maxBytes = entries.reduce((max, entry) => Math.max(max, Number(entry.bytes || 0)), 0) || 1;
  const busy = deleting || deleteDisabled;

  function toggleSelected(entry) {
    if (entry.deleteGuard === "hard-block" || busy) return;
    setSelected((current) => {
      const next = { ...current };
      if (next[entry.path]) delete next[entry.path];
      else next[entry.path] = entry;
      return next;
    });
  }

  function drillInto(entry) {
    if (!entry.isDir || busy) return;
    setResultNote(null);
    setPath(entry.path);
  }

  function goUp() {
    if (busy || !level?.parent) return;
    setResultNote(null);
    setPath(level.parent);
  }

  function openDeleteDialog(list) {
    if (!list.length || busy) return;
    setConfirmEntries(list);
  }

  async function confirmDelete(confirmedPaths) {
    if (!confirmEntries?.length) return;
    setDeleting(true);
    setError("");
    try {
      const result = await runNativeRecycleDelete(
        confirmEntries.map((entry) => entry.path),
        { confirmedPaths }
      );
      setConfirmEntries(null);
      setResultNote(result);
      await reloadLevel(true);
      if (result.accepted) onAfterDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deletion failed.");
    } finally {
      setDeleting(false);
    }
  }

  if (!nativeConnected) {
    return (
      <div className="rounded-md border bg-background p-4">
        <EmptyState
          icon={Folder}
          title="Browse C: needs the desktop app"
          detail="Folder-by-folder exploring and deletion run only inside the SpaceGuard Windows app, not a browser tab."
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={goUp} disabled={!level?.parent || busy}>
          <ArrowLeft className="h-4 w-4" />
          Up
        </Button>
        <div className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
          {crumbs.map((crumb, index) => (
            <span key={crumb.path} className="flex items-center gap-1">
              {index > 0 ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /> : null}
              <button
                type="button"
                className={`max-w-[12rem] truncate rounded px-1.5 py-0.5 hover:bg-muted ${
                  index === crumbs.length - 1 ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
                onClick={() => !busy && setPath(crumb.path)}
                disabled={busy}
                title={crumb.path}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setTurbo((value) => !value)}
          disabled={busy}
          title="Turbo uses a direct NTFS scan (needs admin). Falls back to standard scan automatically."
          className={`ml-auto flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition ${
            turbo ? "border-sky-300 bg-sky-50 text-sky-700" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          Turbo {turbo ? "on" : "off"}
        </button>
      </div>
      {turbo && scanState === "failed" ? (
        <p className="text-xs text-amber-700">
          Turbo needs the app run as administrator — using the standard scan for now.
        </p>
      ) : null}
      {turbo && scanState === "done" && scanSummary ? (
        <p className="text-xs text-muted-foreground">
          Turbo scanned {scanSummary.files.toLocaleString()} files in{" "}
          {(scanSummary.elapsedMs / 1000).toFixed(1)}s.
        </p>
      ) : null}

      {selectedEntries.length ? (
        <div className="sticky top-16 z-10 flex flex-col gap-2 rounded-md border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between lg:top-4">
          <p className="text-sm font-medium">
            {selectedEntries.length} selected · {formatBytes(selectedBytes)}
          </p>
          <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => openDeleteDialog(selectedEntries)}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Move selected to Recycle Bin
          </Button>
        </div>
      ) : null}

      {error ? <Notice tone="restricted" icon={AlertTriangle} text={error} /> : null}
      {resultNote ? <ExploreDeleteResult result={resultNote} onDismiss={() => setResultNote(null)} /> : null}

      {turbo && scanState === "scanning" ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {scanProgress > 0
            ? `Scanning ${driveLetter}: drive… ${scanProgress.toLocaleString()} items`
            : `Scanning ${driveLetter}: drive…`}
        </div>
      ) : status === "loading" ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Measuring folder…
        </div>
      ) : status === "error" ? (
        <EmptyState icon={AlertTriangle} title="Could not open folder" detail={error || "Try going up a level."} />
      ) : !entries.length ? (
        <EmptyState icon={Folder} title="Empty or unreadable" detail="No readable items in this folder." />
      ) : (
        <div className="grid gap-3">
          <ExploreTreemap
            entries={entries}
            selectedMap={selected}
            onDrill={drillInto}
            onToggle={toggleSelected}
          />
          <ExploreTreemapLegend />
          {(level?.warnings || []).map((warning, index) => (
            <p key={index} className="px-1 text-xs text-amber-700">{warning}</p>
          ))}
          {entries.map((entry) => {
            const badge = EXPLORE_GUARD_BADGES[entry.deleteGuard] || EXPLORE_GUARD_BADGES.allow;
            const widthPercent = Math.max(2, (Number(entry.bytes || 0) / maxBytes) * 100);
            const selectable = entry.deleteGuard !== "hard-block";
            return (
              <div key={entry.id || entry.path} className="rounded-md border bg-card p-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={Boolean(selected[entry.path])}
                    disabled={!selectable || busy}
                    aria-label={`Select ${entry.name}`}
                    onClick={() => toggleSelected(entry)}
                  />
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => drillInto(entry)}
                    disabled={!entry.isDir || busy}
                    title={entry.isDir ? `Open ${entry.name}` : entry.path}
                  >
                    {entry.isDir ? <Folder className="h-4 w-4 shrink-0 text-sky-600" /> : <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{entry.name}</span>
                        {entry.isDir ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
                      </span>
                      {entry.status === "limited" ? (
                        <span className="block text-xs text-amber-700">Partially measured — open to itemize.</span>
                      ) : null}
                    </span>
                  </button>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  <span className="w-24 shrink-0 text-right text-sm font-semibold">{formatBytes(entry.bytes)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${entry.isDir ? "bg-sky-500" : "bg-muted-foreground/50"}`} style={{ width: `${widthPercent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmEntries ? (
        <ExploreDeleteDialog
          entries={confirmEntries}
          deleting={deleting}
          onCancel={() => setConfirmEntries(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}

function ExploreDeleteResult({ result, onDismiss = () => {} }) {
  const deleted = (result.entries || []).filter((entry) => entry.result === "deleted");
  const blocked = (result.entries || []).filter((entry) => entry.result === "blocked" || entry.result === "needs-confirm");
  const failed = (result.entries || []).filter((entry) => entry.result === "error");
  const tone = deleted.length ? "safe" : "restricted";
  return (
    <div className={`rounded-md border p-3 text-sm ${tone === "safe" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          {deleted.length ? (
            <p className="font-semibold">
              Moved {deleted.length} item{deleted.length === 1 ? "" : "s"} to Recycle Bin · {formatBytes(result.freedBytes)} freed
            </p>
          ) : (
            <p className="font-semibold">Nothing was deleted.</p>
          )}
          {blocked.length ? <p className="mt-1 text-xs">{blocked.length} item(s) were protected or still need confirmation.</p> : null}
          {failed.length ? <p className="mt-1 text-xs">{failed.length} item(s) could not be moved.</p> : null}
          <p className="mt-1 text-xs">Recoverable from the Windows Recycle Bin until you empty it.</p>
        </div>
        <button type="button" className="text-muted-foreground hover:text-foreground" onClick={onDismiss} aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ExploreDeleteDialog({ entries = [], deleting = false, onCancel = () => {}, onConfirm = () => {} }) {
  const confirmEntries = entries.filter((entry) => entry.deleteGuard === "confirm");
  const warnEntries = entries.filter((entry) => entry.deleteGuard === "warn");
  const totalBytes = entries.reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
  // Everything here goes to the Recycle Bin (recoverable), so the only real friction
  // is a single acknowledgement when something large/top-level or app-data is in the set.
  const needsAck = confirmEntries.length > 0 || warnEntries.length > 0;
  const [ack, setAck] = useState(false);
  const canConfirm = !deleting && (!needsAck || ack);

  function confirm() {
    if (!canConfirm) return;
    // Auto-confirm the gated paths server-side; the Recycle Bin is the safety net.
    onConfirm(confirmEntries.map((entry) => entry.path));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-lg border bg-background p-5 shadow-lg">
        <div className="flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-semibold">Move {entries.length} item{entries.length === 1 ? "" : "s"} to Recycle Bin</h2>
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <RefreshCcw className="h-4 w-4 shrink-0" />
          <span>Frees {formatBytes(totalBytes)}. Recoverable from the Recycle Bin until you empty it.</span>
        </div>

        <div className="mt-3 max-h-40 space-y-1 overflow-auto">
          {entries.map((entry) => (
            <div key={entry.path} className="flex items-center justify-between gap-2 rounded border bg-card px-2 py-1 text-sm">
              <span className="flex min-w-0 items-center gap-1.5">
                {entry.isDir ? <Folder className="h-3.5 w-3.5 shrink-0 text-sky-600" /> : <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                <span className="truncate" title={entry.path}>{entry.name}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold">{formatBytes(entry.bytes)}</span>
            </div>
          ))}
        </div>

        {warnEntries.length ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Heads up: {warnEntries.length} item{warnEntries.length === 1 ? " looks" : "s look"} like active app data — deleting may sign you out or reset settings.
          </p>
        ) : null}
        {confirmEntries.length ? (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {confirmEntries.length} large or top-level item{confirmEntries.length === 1 ? "" : "s"} included.
          </p>
        ) : null}

        {needsAck ? (
          <label className="mt-3 flex items-start gap-2 text-sm">
            <Checkbox checked={ack} onClick={() => setAck((value) => !value)} aria-label="Acknowledge" />
            <span>I understand these move to the Recycle Bin.</span>
          </label>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={deleting}>Cancel</Button>
          <Button type="button" variant="destructive" onClick={confirm} disabled={!canConfirm}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Move to Recycle Bin
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExploreList({
  rows = [],
  selectedIds = [],
  selectedBytes = 0,
  allSelected = false,
  deleteDisabled = false,
  onToggleSelected = () => {},
  onSetAllSelected = () => {},
  onRequestSelectedCleanup = () => {},
  onRequestCleanup = () => {}
}) {
  const readyRows = rows.filter((row) => row.ready && row.candidateId);
  const selectedCount = readyRows.filter((row) => selectedIds.includes(row.candidateId)).length;
  return (
    <div className="grid gap-3">
      {readyRows.length ? (
        <div className="sticky top-16 z-10 flex flex-col gap-3 rounded-md border bg-card p-3 shadow-sm md:flex-row md:items-center md:justify-between lg:top-4">
          <div>
            <p className="text-sm font-medium">
              {selectedCount ? `${selectedCount} item${selectedCount === 1 ? "" : "s"} selected` : "Choose items to delete"}
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedCount ? `${formatBytes(selectedBytes)} selected to delete` : "Use the checkboxes or delete one item at a time."}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={deleteDisabled} onClick={onSetAllSelected}>
              {allSelected ? <X className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {allSelected ? "Clear" : "Select all"}
            </Button>
            <Button type="button" className="w-full sm:w-auto" variant="destructive" disabled={!selectedCount || deleteDisabled} onClick={onRequestSelectedCleanup}>
              <Trash2 className="h-4 w-4" />
              Delete selected
            </Button>
          </div>
        </div>
      ) : null}
      {rows.map((row) => (
        <div key={row.id} className="rounded-md border bg-background p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-3">
              {row.ready && row.candidateId ? (
                <Checkbox
                  checked={selectedIds.includes(row.candidateId)}
                  disabled={deleteDisabled}
                  aria-label={`Select ${row.title}`}
                  onClick={() => onToggleSelected(row.candidateId)}
                />
              ) : null}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={row.ready ? "safe" : "outline"}>
                    {row.ready ? "can delete" : "inspect"}
                  </Badge>
                  <p className="font-medium">{row.title}</p>
                </div>
                <p className="mt-2 truncate text-sm text-muted-foreground">{row.path || row.source}</p>
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{row.detail}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
              <p className="text-lg font-semibold">{formatBytes(row.bytes)}</p>
              {row.ready && row.candidateId ? (
                <Button size="sm" variant="destructive" onClick={() => onRequestCleanup(row.candidateId)} disabled={deleteDisabled}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              ) : (
                <Badge variant="outline">inspect</Badge>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ExploreVisualization({ scan, rows = [], onShowList = () => {} }) {
  const allocation = buildExploreAllocationBreakdown(scan, rows);
  const visualRows = allocation.segmentRows;
  const cleanableRows = rows.filter((row) => row.ready && row.candidateId);
  const cleanableBytes = cleanableRows.reduce((sum, row) => sum + Number(row.bytes || 0), 0);
  const reviewRows = rows.filter((row) => !row.ready && row.source !== "drive-inventory" && Number(row.bytes || 0) > 0);
  const reviewBytes = reviewRows.reduce((sum, row) => sum + Number(row.bytes || 0), 0);
  const usedBytes = allocation.usedBytes;
  const freeBytes = allocation.freeBytes;
  const totalBytes = allocation.totalBytes;
  const usedPercent = totalBytes ? Math.min(100, Math.max(0, (usedBytes / totalBytes) * 100)) : 0;
  const segmentTotal = Math.max(1, visualRows.reduce((sum, row) => sum + Number(row.bytes || 0), 0));
  const otherRow = visualRows.find((row) => row.id === "visual-other-used-space");
  return (
    <div className="space-y-4 rounded-md border bg-background p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium">C: space map</p>
          <p className="text-xs text-muted-foreground">{formatBytes(usedBytes)} used{freeBytes ? `, ${formatBytes(freeBytes)} free` : ""}</p>
        </div>
        <p className="text-sm font-semibold">{formatPercent(usedPercent)} used</p>
      </div>
      <Progress value={usedPercent} />
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Explored" value={formatBytes(allocation.accountedBytes)} />
        <Metric label="Not yet explored" value={formatBytes(allocation.unlistedBytes)} />
        <Metric label="Can delete now" value={formatBytes(cleanableBytes)} />
        <Metric label="Needs review" value={formatBytes(reviewBytes)} />
      </div>
      {cleanableRows.length ? (
        <div className="flex flex-col gap-3 rounded-md border bg-emerald-50 p-3 text-emerald-950 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold">{formatBytes(cleanableBytes)} can be deleted</p>
            <p className="text-xs text-emerald-800">Open the list to choose items and confirm deletion.</p>
          </div>
          <Button type="button" size="sm" onClick={onShowList}>
            <ListTree className="h-4 w-4" />
            Show delete list
          </Button>
        </div>
      ) : null}
      {visualRows.length ? (
        <>
          <div className="flex h-4 overflow-hidden rounded-md bg-muted">
            {visualRows.map((row, index) => (
              <div
                key={row.id}
                className={EXPLORE_VISUAL_COLORS[index % EXPLORE_VISUAL_COLORS.length].bar}
                style={{ width: `${Math.max(2, (Number(row.bytes || 0) / segmentTotal) * 100)}%` }}
                title={`${row.title}: ${formatBytes(row.bytes)}`}
              />
            ))}
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {visualRows.map((row, index) => {
              const percent = segmentTotal ? (Number(row.bytes || 0) / segmentTotal) * 100 : 0;
              return (
                <div key={row.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm">
                  <span className={`h-3 w-3 rounded-sm ${EXPLORE_VISUAL_COLORS[index % EXPLORE_VISUAL_COLORS.length].dot}`} />
                  <div className="min-w-0">
                    <p className="truncate">{row.title}</p>
                    {row.detail ? <p className="truncate text-xs text-muted-foreground">{row.detail}</p> : null}
                  </div>
                  <span className="whitespace-nowrap text-muted-foreground">{formatBytes(row.bytes)} - {formatPercent(percent)}</span>
                </div>
              );
            })}
          </div>
          <ExploreSpaceDetails allocation={allocation} rows={rows} onShowList={onShowList} />
          <ExploreOtherSpaceBreakdown allocation={allocation} otherRow={otherRow} />
          <details className="rounded-md border bg-background">
            <summary className="flex cursor-pointer list-none flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <span>
                <span className="block text-sm font-semibold">Full C: breakdown</span>
                <span className="block text-xs text-muted-foreground">Open for every measured top-level entry and not-itemized space.</span>
              </span>
              <span className="text-xs font-medium text-muted-foreground">Show details</span>
            </summary>
            <div className="divide-y border-t">
              {allocation.detailRows.map((row) => (
                <div key={row.id} className="grid gap-3 px-3 py-3 text-sm lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={row.classification === "cleanable" ? "safe" : "outline"}>
                        {formatAllocationKindLabel(row)}
                      </Badge>
                      <p className="truncate font-medium">{row.title}</p>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{row.path || row.detail}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Progress value={row.percentOfUsed} />
                    <p className="text-xs text-muted-foreground">
                      {formatPercent(row.percentOfUsed)} of used C:{row.files || row.dirs ? ` - ${formatCount(row.files)} files, ${formatCount(row.dirs)} folders` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 lg:text-right">
                    <p className="text-base font-semibold">{formatBytes(row.bytes)}</p>
                    <p className="text-xs text-muted-foreground">{formatAllocationStatus(row)}</p>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </>
      ) : (
        <EmptyState icon={PieChart} title="No visual data yet" detail="Run a fresh scan to build the C: space map." />
      )}
    </div>
  );
}

function ExploreSpaceDetails({ allocation, rows = [], onShowList = () => {} }) {
  const hasCategoryRows = Boolean(allocation?.categoryRows?.length);
  const hasMeasuredRows = rows.some((row) => row.source !== "drive-inventory" && Number(row.bytes || 0) > 0);
  if (!hasCategoryRows && !hasMeasuredRows) return null;
  return (
    <details className="rounded-md border bg-background">
      <summary className="flex cursor-pointer list-none flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <span>
          <span className="block text-sm font-semibold">Breakdown details</span>
          <span className="block text-xs text-muted-foreground">Open for source totals and measured cleanup items.</span>
        </span>
        <span className="text-xs font-medium text-muted-foreground">Show details</span>
      </summary>
      <div className="space-y-3 border-t p-3">
        <ExploreCategorySummary allocation={allocation} />
        <ExploreMeasuredTargets rows={rows} onShowList={onShowList} />
      </div>
    </details>
  );
}

function ExploreCategorySummary({ allocation }) {
  const categoryRows = allocation?.categoryRows || [];
  if (!categoryRows.length) return null;
  return (
    <div className="rounded-md border bg-background">
      <div className="border-b px-3 py-2">
        <p className="text-sm font-semibold">Where C: space is coming from</p>
        <p className="text-xs text-muted-foreground">Exact measured totals by source. Cleanable findings are shown separately because they live inside these folders.</p>
      </div>
      <div className="divide-y">
        {categoryRows.map((row) => (
          <div key={row.key} className="grid gap-3 px-3 py-3 text-sm lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={row.key === "cleanable" ? "safe" : "outline"}>{formatAllocationGroupStatus(row)}</Badge>
                <p className="font-medium">{row.label}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
              {row.rows?.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {row.rows.slice(0, 4).map((item) => (
                    <span key={item.id} className="max-w-full truncate rounded border bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
                      {item.title}: {formatBytes(item.bytes)}
                    </span>
                  ))}
                  {row.count > 4 ? <span className="rounded border bg-muted/30 px-2 py-1 text-xs text-muted-foreground">+{row.count - 4} more</span> : null}
                </div>
              ) : null}
            </div>
            <div className="space-y-1">
              <Progress value={row.percentOfUsed} />
              <p className="text-xs text-muted-foreground">{formatPercent(row.percentOfUsed)} of used C: across {formatCount(row.count)} measured row{row.count === 1 ? "" : "s"}</p>
            </div>
            <div className="shrink-0 lg:text-right">
              <p className="text-base font-semibold">{formatBytes(row.bytes)}</p>
              <p className="text-xs text-muted-foreground">{row.files || row.dirs ? `${formatCount(row.files)} files, ${formatCount(row.dirs)} folders` : "measured total"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExploreMeasuredTargets({ rows = [], onShowList = () => {} }) {
  const measuredRows = rows
    .filter((row) => row.source !== "drive-inventory" && Number(row.bytes || 0) > 0)
    .sort((left, right) => Number(right.ready) - Number(left.ready) || Number(right.bytes || 0) - Number(left.bytes || 0));
  if (!measuredRows.length) return null;
  const readyRows = measuredRows.filter((row) => row.ready && row.candidateId);
  const readyBytes = readyRows.reduce((sum, row) => sum + Number(row.bytes || 0), 0);
  return (
    <div className="rounded-md border bg-background">
      <div className="flex flex-col gap-3 border-b px-3 py-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold">Exact measured items inside those folders</p>
          <p className="text-xs text-muted-foreground">These are subpaths inside the C: allocation above, so they explain space without being added twice.</p>
        </div>
        {readyRows.length ? (
          <Button type="button" variant="outline" size="sm" onClick={onShowList}>
            <Trash2 className="h-4 w-4" />
            Delete options
          </Button>
        ) : null}
      </div>
      <div className="divide-y">
        {measuredRows.slice(0, 12).map((row) => (
          <div key={row.id} className="grid gap-3 px-3 py-2 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={row.ready ? "safe" : "outline"}>{row.ready ? "can delete" : "inspect"}</Badge>
                <p className="truncate font-medium">{row.title}</p>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">{row.path || row.detail}</p>
            </div>
            <p className="shrink-0 font-semibold md:text-right">{formatBytes(row.bytes)}</p>
          </div>
        ))}
        {measuredRows.length > 12 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">
            {measuredRows.length - 12} more measured item{measuredRows.length - 12 === 1 ? "" : "s"} are available in the List tab.
          </div>
        ) : null}
      </div>
      {readyRows.length ? (
        <div className="border-t bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          {formatBytes(readyBytes)} is ready to delete after confirmation.
        </div>
      ) : null}
    </div>
  );
}

function ExploreOtherSpaceBreakdown({ allocation, otherRow }) {
  const otherMeasuredRows = allocation?.otherMeasuredRows || [];
  const unlistedRow = allocation?.unlistedRow || null;
  const reasonRows = allocation?.unlistedReasonRows || [];
  if (!otherRow && !otherMeasuredRows.length && !unlistedRow) return null;
  return (
    <details className="rounded-md border bg-muted/20 text-sm">
      <summary className="flex cursor-pointer list-none flex-col gap-1 p-3 md:flex-row md:items-end md:justify-between">
        <span>
          <span className="block font-medium">Other used space, expanded</span>
          <span className="block text-xs text-muted-foreground">Open to see smaller measured rows and Windows space that cannot be itemized.</span>
        </span>
        {otherRow ? <span className="shrink-0 font-semibold">{formatBytes(otherRow.bytes)}</span> : null}
      </summary>
      <div className="border-t p-3">
        <p className="text-xs text-muted-foreground">{otherRow?.detail || "No measured C: rows are hidden from the full breakdown."}</p>
      {otherMeasuredRows.length ? (
        <div className="mt-3 rounded-md border bg-background">
          <div className="border-b px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Smaller measured C: entries</p>
          </div>
          <div className="max-h-64 divide-y overflow-auto">
            {otherMeasuredRows.map((row) => (
              <div key={row.id} className="grid gap-2 px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{row.path || row.detail}</p>
                </div>
                <p className="shrink-0 font-semibold md:text-right">{formatBytes(row.bytes)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {unlistedRow ? (
        <div className="mt-3 rounded-md border bg-background p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">Not yet explored</p>
              <p className="mt-1 text-xs text-muted-foreground">{unlistedRow.detail}</p>
            </div>
            <p className="shrink-0 font-semibold">{formatBytes(unlistedRow.bytes)}</p>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {reasonRows.map((row) => (
              <div key={row.id} className="rounded border bg-muted/20 px-3 py-2">
                <p className="text-xs font-medium">{row.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      </div>
    </details>
  );
}

function CleanupConfirmModal({ candidates = [], running = false, onCancel, onConfirm }) {
  const selectedCandidates = candidates.filter(Boolean);
  if (!selectedCandidates.length) return null;
  const single = selectedCandidates.length === 1;
  const primaryCandidate = selectedCandidates[0];
  const totalBytes = selectedCandidates.reduce((sum, candidate) => sum + Number(candidate.bytes || 0), 0);
  const visibleCandidates = selectedCandidates.slice(0, 5);
  const hiddenCount = Math.max(0, selectedCandidates.length - visibleCandidates.length);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="cleanup-confirm-title" className="w-full max-w-lg rounded-md border bg-card p-5 text-card-foreground shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-700">
            <Trash2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p id="cleanup-confirm-title" className="text-base font-semibold">{single ? "Delete this item?" : `Delete ${selectedCandidates.length} items?`}</p>
            <p className="mt-1 text-sm text-muted-foreground">{single ? primaryCandidate.title : `${selectedCandidates.length} selected cleanable items`}</p>
          </div>
        </div>
        <div className="mt-4 space-y-3 rounded-md border bg-background p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Space</span>
            <span className="font-medium">{formatBytes(totalBytes)}</span>
          </div>
          {single ? (
            <div>
              <p className="text-muted-foreground">Location</p>
              <p className="mt-1 truncate font-medium">{primaryCandidate.targetPath || primaryCandidate.targetKind}</p>
            </div>
          ) : (
            <div>
              <p className="text-muted-foreground">Items</p>
              <div className="mt-2 max-h-44 space-y-2 overflow-auto pr-1">
                {visibleCandidates.map((candidate) => (
                  <div key={candidate.id} className="flex items-center justify-between gap-3 rounded border bg-muted/20 px-2 py-1.5">
                    <span className="min-w-0 truncate font-medium">{candidate.title}</span>
                    <span className="shrink-0 text-muted-foreground">{formatBytes(candidate.bytes)}</span>
                  </div>
                ))}
                {hiddenCount ? <p className="text-xs text-muted-foreground">And {hiddenCount} more selected item{hiddenCount === 1 ? "" : "s"}.</p> : null}
              </div>
            </div>
          )}
          <p className="text-muted-foreground">{single ? primaryCandidate.consequence : "Only the selected cleanable items are deleted."}</p>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={running}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {running ? "Deleting" : single ? "Delete" : `Delete ${selectedCandidates.length} items`}
          </Button>
        </div>
      </div>
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
              <span className="font-medium">{assistant.nextAction || "Recommended cleanup"}</span>
            </div>
            <p className="text-muted-foreground">{assistant.summary}</p>
            {suggestedAction ? (
              <div className="rounded-md border bg-muted/25 p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={suggestedAction.canAct ? "safe" : "outline"}>
                        {suggestedAction.canAct ? "can delete" : "inspect"}
                      </Badge>
                      <p className="font-medium">{formatAgentActionTitle(suggestedAction)}</p>
                    </div>
                    {!suggestedAction.canAct ? <p className="mt-2 text-xs text-muted-foreground">Open Explore to inspect this item.</p> : null}
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
  if (row.kind === "review" || row.kind === "manual" || row.kind === "review-target") return "Inspect in Explore";
  return row.actionType === "manual-only" ? "Inspect item" : "Use recommendation";
}

function formatAgentButtonLabel(row = {}) {
  if (row.kind === "scoped-executor") return "Select cleanup";
  if (row.kind === "scan") return "Run scan";
  if (row.kind === "review" || row.kind === "manual" || row.kind === "review-target") return "Open Explore";
  return row.buttonLabel || "Use recommendation";
}

function focusAgentBrokerPanel(row = {}) {
  const panelId = String(row.targetPanel || "").trim();
  if (!panelId || typeof document === "undefined") return;
  document.getElementById(panelId)?.scrollIntoView({ behavior: "smooth", block: "start" });
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

function EmptyState({ icon: Icon, title, detail, actionLabel = "", actionIcon: ActionIcon = ChevronRight, onAction = null }) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center rounded-md border border-dashed bg-muted/25 p-6 text-center">
      <Icon className="h-6 w-6 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{detail}</p>
      {actionLabel && onAction ? (
        <Button type="button" size="sm" className="mt-4" onClick={onAction}>
          <ActionIcon className="h-4 w-4" />
          {actionLabel}
        </Button>
      ) : null}
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

function formatPercent(value = 0) {
  if (!Number.isFinite(value)) return "0%";
  if (value >= 10) return `${Math.round(value)}%`;
  if (value > 0) return `${value.toFixed(1)}%`;
  return "0%";
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

function formatCheckedCleanupMessage({
  reclaimedBytes = 0,
  removedFiles = false,
  runningRescan = false,
  scanStatus = "",
  acceptedCount = 0,
  rejectedCount = 0
} = {}) {
  const retryText = rejectedCount > 0
    ? ` ${rejectedCount} item${rejectedCount === 1 ? "" : "s"} need another try.`
    : "";
  if (!removedFiles) {
    if (runningRescan) return `No eligible files were removed from selected items. Refreshing the list.${retryText}`;
    if (scanStatus === "error") return `No eligible files were removed from selected items. Refresh failed; click Refresh again.${retryText}`;
    return `No eligible files were removed from selected items.${retryText || " The list is up to date."}`;
  }
  const bytes = formatBytes(reclaimedBytes);
  const cleanedText = acceptedCount > 1
    ? `${bytes} removed from ${acceptedCount} selected items.`
    : `${bytes} removed from selected items.`;
  if (runningRescan) return `${cleanedText} Refreshing the list.${retryText}`;
  if (scanStatus === "error") return `${cleanedText} Refresh failed; click Refresh again.${retryText}`;
  return `${cleanedText}${retryText || " The list is up to date."}`;
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
    return "This item is outside the safe cleanup list. Choose another cleanable item or scan again.";
  }
  if (/executor-disabled|feature-flag|cleanup authority|not available|runtime/.test(text)) {
    return "Cleanup is not available for this item in this app session. Restart SpaceGuard, scan again, and try another cleanable item.";
  }
  if (/access denied|permission|locked|in use|using these files/.test(text)) {
    return "Windows blocked some files because they are in use. Close the related apps, scan again, and retry.";
  }
  return "Nothing was deleted. Close apps using these files, scan again, and try once more.";
}

function formatScanError(error) {
  const detail = error instanceof Error ? error.message : String(error || "");
  const text = detail.toLowerCase();
  if (/desktop|tauri|native scanner|bridge|runtime/.test(text)) {
    return "The Windows desktop connection is not ready. Restart SpaceGuard and scan again.";
  }
  if (/access denied|permission|unauthorized/.test(text)) {
    return "Windows blocked access to part of the scan. Close protected apps or restart SpaceGuard with the needed permissions, then scan again.";
  }
  if (/timeout|timed out|busy|locked|in use/.test(text)) {
    return "Windows was busy reading some files. Close active apps and scan again.";
  }
  return "Scan could not finish. Restart SpaceGuard and scan again.";
}

function formatAgentError(error) {
  const detail = error instanceof Error ? error.message : String(error || "");
  const text = detail.toLowerCase();
  if (/api key|openai|401|403|429|quota|rate limit/.test(text)) {
    return "AI recommendation is unavailable right now. You can still clean selected items from the scan.";
  }
  if (/network|fetch|timeout|timed out|request failed/.test(text)) {
    return "AI recommendation could not connect. You can still clean selected items from the scan.";
  }
  return "AI recommendation is unavailable right now. Use Clean or Explore to continue.";
}

function formatBlockedCleanupDetail(candidate = {}) {
  if (candidate?.requiresArchiveDestination) {
    return "Choose an archive folder before cleaning this item.";
  }
  const detail = String(candidate?.blockedReason || "").trim();
  const text = detail.toLowerCase();
  if (!detail) return "Inspect this item before deleting anything.";
  if (/access denied|permission|locked|in use|using these files/.test(text)) {
    return "Windows is using this item. Close related apps, scan again, and retry.";
  }
  if (/fingerprint|consent|plan|proof|workflow|route|executor|feature flag|allowlist|native|env|spaceguard_enable/.test(text)) {
    return "This item is not ready for one-click deletion. Scan again or choose another cleanable item.";
  }
  return detail;
}

function formatCleanRowSummary(candidate = {}) {
  if (candidate.recipeId === "downloads-installers") return "Moves only the selected file to Recycle Bin.";
  if (candidate.recipeId === "recycle-bin") return "Empties the Recycle Bin for this drive.";
  if (candidate.recipeId === "docker-build-cache") return "Clears Docker build cache only.";
  if (candidate.recipeId === "large-user-files") return "Archive required before removal.";
  if (/cache|store|temp/i.test(`${candidate.title} ${candidate.targetKind} ${candidate.routeInput}`)) return "Safe cleanable cache files.";
  return candidate.consequence || "Deletes only this cleanable item.";
}

function toNativeScanRequest(request) {
  return {
    targetDrive: request.targetDrive,
    protectedPaths: splitLines(request.protectedPaths),
    customRoots: splitLines(request.customRoots),
    includeProjectArtifacts: request.includeProjectArtifacts,
    maxDepth: Number(request.maxDepth || DEFAULT_SCAN_REQUEST.maxDepth),
    maxEntriesPerRoot: Number(request.maxEntriesPerRoot || DEFAULT_SCAN_REQUEST.maxEntriesPerRoot)
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
    return "Inspect this area before removing anything.";
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
      : formatBlockedCleanupDetail(candidate),
    cleanable: true,
    ready: isOneClickCleanupCandidate(candidate),
    candidateId: isOneClickCleanupCandidate(candidate) ? candidate.id : ""
  }));
  const manualRows = manualFindings.map((finding) => ({
    id: `manual-${finding.recipeId}-${finding.path || finding.title}`,
    title: finding.title || "Inspect item",
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
    detail: formatDriveInventoryDetail(row),
    cleanable: false,
    ready: false,
    candidateId: ""
  }));
  return [...cleanableRows, ...manualRows, ...inventoryRows]
    .filter((row) => row.bytes > 0 || row.cleanable)
    .sort((left, right) => Number(right.cleanable) - Number(left.cleanable) || right.bytes - left.bytes)
    .slice(0, 80);
}

function buildExploreVisualRows(scan, rows = []) {
  return buildExploreAllocationBreakdown(scan, rows).segmentRows;
}

function buildExploreAllocationBreakdown(scan, rows = []) {
  if (!scan) {
    return {
      usedBytes: 0,
      freeBytes: 0,
      totalBytes: 0,
      accountedBytes: 0,
      unlistedBytes: 0,
      detailRows: [],
      segmentRows: [],
      categoryRows: [],
      otherRows: [],
      otherMeasuredRows: [],
      unlistedRow: null,
      unlistedReasonRows: []
    };
  }
  const inventoryRows = (scan.driveInventory || [])
    .filter((row) => Number(row?.bytes || 0) > 0)
    .map((row) => ({
      id: `visual-inventory-${row.id || row.path || row.name}`,
      title: row.name || row.path || "Drive area",
      path: row.path || "",
      bytes: Number(row.bytes || 0),
      files: Number(row.files || 0),
      dirs: Number(row.dirs || 0),
      status: row.status || "measured",
      classification: row.classification || "unknown-review",
      detail: formatDriveInventoryDetail(row)
    }));
  const fallbackRows = rows
    .filter((row) => Number(row?.bytes || 0) > 0)
    .map((row) => ({
      id: `visual-row-${row.id}`,
      title: row.title || row.path || "Scanned area",
      path: row.path || "",
      bytes: Number(row.bytes || 0),
      files: 0,
      dirs: 0,
      status: row.ready ? "cleanable" : "review",
      classification: row.ready ? "cleanable" : "manual",
      detail: row.detail || row.path || ""
    }));
  const sourceRows = inventoryRows.length ? inventoryRows : fallbackRows;
  const usedBytes = Number(scan.volume?.usedBytes || 0) || sourceRows.reduce((sum, row) => sum + row.bytes, 0);
  const freeBytes = Number(scan.volume?.freeBytes || 0);
  const totalBytes = Number(scan.volume?.totalBytes || 0) || usedBytes + freeBytes;
  const accountedBytes = sourceRows.reduce((sum, row) => sum + Number(row.bytes || 0), 0);
  const unlistedBytes = Math.max(0, usedBytes - accountedBytes);
  const unlistedRow = unlistedBytes > 0
    ? {
        id: "visual-unlisted-used-space",
        title: "Not yet explored",
        path: "",
        bytes: unlistedBytes,
        files: 0,
        dirs: 0,
        status: "estimated",
        classification: "unlisted",
        detail: "Open Browse C: and drill into the big folders to see what is using this space."
      }
    : null;
  const detailRows = [...sourceRows, unlistedRow]
    .filter(Boolean)
    .sort((left, right) => right.bytes - left.bytes)
    .map((row) => ({
      ...row,
      percentOfUsed: usedBytes ? Math.min(100, Math.max(0, (Number(row.bytes || 0) / usedBytes) * 100)) : 0
    }));
  const topRows = detailRows.slice(0, 7);
  const hiddenRows = detailRows.slice(7);
  const hiddenBytes = hiddenRows.reduce((sum, row) => sum + Number(row.bytes || 0), 0);
  const otherMeasuredRows = hiddenRows.filter((row) => row.id !== "visual-unlisted-used-space");
  const finalUnlistedRow = detailRows.find((row) => row.id === "visual-unlisted-used-space") || null;
  const categoryRows = buildExploreCategoryRows(detailRows, usedBytes);
  const unlistedReasonRows = buildNotItemizedReasonRows(unlistedBytes);
  const segmentRows = hiddenBytes > 0
    ? [
        ...topRows,
        {
          id: "visual-other-used-space",
          title: "Other used space",
          path: "",
          bytes: hiddenBytes,
          files: hiddenRows.reduce((sum, row) => sum + Number(row.files || 0), 0),
          dirs: hiddenRows.reduce((sum, row) => sum + Number(row.dirs || 0), 0),
          status: "mixed",
          classification: "unlisted",
          percentOfUsed: usedBytes ? Math.min(100, Math.max(0, (hiddenBytes / usedBytes) * 100)) : 0,
          detail: formatOtherUsedSpaceDetail({ hiddenRows, unlistedBytes })
        }
      ]
    : topRows;
  return {
    usedBytes,
    freeBytes,
    totalBytes,
    accountedBytes,
    unlistedBytes,
    detailRows,
    segmentRows,
    categoryRows,
    otherRows: hiddenRows,
    otherMeasuredRows,
    unlistedRow: finalUnlistedRow,
    unlistedReasonRows
  };
}

function buildExploreCategoryRows(detailRows = [], usedBytes = 0) {
  const groups = new Map();
  for (const row of detailRows) {
    const key = DRIVE_ALLOCATION_GROUPS[row.classification] ? row.classification : "unknown-review";
    const group = groups.get(key) || {
      key,
      label: DRIVE_ALLOCATION_GROUPS[key]?.label || DRIVE_ALLOCATION_LABELS[key] || "Other measured C: entries",
      detail: DRIVE_ALLOCATION_GROUPS[key]?.detail || "Measured from C: filesystem metadata.",
      status: DRIVE_ALLOCATION_GROUPS[key]?.status || "inspect",
      bytes: 0,
      files: 0,
      dirs: 0,
      count: 0,
      rows: []
    };
    group.bytes += Number(row.bytes || 0);
    group.files += Number(row.files || 0);
    group.dirs += Number(row.dirs || 0);
    group.count += 1;
    group.rows.push(row);
    groups.set(key, group);
  }
  return Array.from(groups.values())
    .map((row) => ({
      ...row,
      rows: row.rows.sort((left, right) => Number(right.bytes || 0) - Number(left.bytes || 0)),
      percentOfUsed: usedBytes ? Math.min(100, Math.max(0, (Number(row.bytes || 0) / usedBytes) * 100)) : 0
    }))
    .sort((left, right) => Number(right.bytes || 0) - Number(left.bytes || 0));
}

function buildNotItemizedReasonRows(unlistedBytes = 0) {
  if (Number(unlistedBytes || 0) <= 0) return [];
  const total = formatBytes(unlistedBytes);
  return [
    {
      id: "ntfs-metadata",
      title: "NTFS metadata and file table",
      detail: `Part of the ${total} total can be filesystem metadata that Windows does not expose as normal files.`
    },
    {
      id: "restore-shadow-copies",
      title: "Restore points and shadow copies",
      detail: `Part of the ${total} total can be System Restore, VSS snapshots, or protected recovery data.`
    },
    {
      id: "reserved-update-storage",
      title: "Reserved storage and Windows Update staging",
      detail: `Part of the ${total} total can be reserved storage, update staging, servicing data, or component-store state.`
    },
    {
      id: "locked-or-capped-paths",
      title: "Locked folders and scan caps",
      detail: `Part of the ${total} total can be access-limited folders, in-use files, reparse points, or inventory caps.`
    }
  ];
}

function formatDriveInventoryDetail(row = {}) {
  const text = String(row.classification || row.kind || "").toLowerCase();
  const status = String(row.status || "").toLowerCase();
  const limited = status === "limited" || Number(row.errors || 0) > 0;
  if (/advanced-system/.test(text)) return "Windows-managed file. Reclaim only through Windows settings or a guarded cleanup item.";
  if (/system|protected/.test(text)) return limited ? "Windows or protected app area; some folders could not be fully measured." : "Windows, installed apps, or protected system data.";
  if (/user|profile/.test(text)) return limited ? "User profiles and app data; some nested folders were capped or locked." : "User profiles, Downloads, desktop data, and per-user app storage.";
  if (/cache|temp/.test(text)) return "Potential cleanup area when the scan marks it as can delete.";
  return limited ? "Top-level C: entry measured with scan caps or access limits." : "Top-level C: entry measured from filesystem metadata.";
}

function formatOtherUsedSpaceDetail({ hiddenRows = [], unlistedBytes = 0 } = {}) {
  const smallerRows = hiddenRows.filter((row) => row.id !== "visual-unlisted-used-space");
  const smallerBytes = smallerRows.reduce((sum, row) => sum + Number(row.bytes || 0), 0);
  const parts = [];
  if (smallerBytes > 0) {
    parts.push(`${formatBytes(smallerBytes)} from ${smallerRows.length} smaller measured C: entries`);
  }
  if (unlistedBytes > 0) {
    parts.push(`${formatBytes(unlistedBytes)} not yet explored`);
  }
  const prefix = parts.length ? `Includes ${parts.join(" plus ")}.` : "No extra used space is hidden from the detailed list.";
  return `${prefix} This is space inside folders you have not opened yet. Use Browse C: to drill in and see what is there.`;
}

function formatAllocationKindLabel(row = {}) {
  return DRIVE_ALLOCATION_LABELS[row.classification] || DRIVE_ALLOCATION_LABELS[row.kind] || "C: entry";
}

function formatAllocationStatus(row = {}) {
  if (row.status === "estimated") return "estimated";
  if (row.status === "limited") return "limited scan";
  if (row.status === "mixed") return "mixed";
  if (row.status === "cleanable") return "cleanable";
  if (row.status === "review") return "review";
  return "measured";
}

function formatAllocationGroupStatus(row = {}) {
  if (row.key === "cleanable") return "can delete";
  if (row.status === "system") return "system";
  if (row.status === "estimated") return "estimated";
  if (row.status === "actionable") return "can delete";
  return "inspect";
}

function formatCount(value = 0) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("en-US").format(number);
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
    title: MANUAL_RECIPE_LABELS[finding.recipeId] || finding.title || "Inspect item",
    manualGuidance: buildManualFindingGuidance(finding)
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
      title: finding.title || "Inspect item",
      route: finding.manualGuidance?.kind || "manual-review",
      actionType: "manual-only",
      targetId: agentTargetId,
      bytes: Number(finding.bytes || 0),
      status: finding.status || "unknown",
      confidence: finding.manualGuidance?.confidence || "manual-only",
      targetPath: redactPath(finding.path || ""),
      reason: redactAgentContextText(finding.manualGuidance?.primaryAction || finding.note || "Inspect this item."),
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
  if (!blocker) return "Cleanup is not available yet. Select one cleanable item and try again.";
  if (blocker.id === "selected-target") return "Select one cleanable item before deleting.";
  if (blocker.id === "route-readiness") return "This item is not available to delete. Choose another cleanable item or scan again.";
  if (blocker.id === "consent-checkbox") return "Select one cleanable item before deleting.";
  if (blocker.id === "scan-fingerprint") return "Refresh the scan, then try deleting again.";
  if (blocker.id === "execution-prerequisites") return "Finish the extra requirement shown for this item, then try again.";
  if (blocker.id === "executor-not-running") return "Cleanup is already running. Wait for it to finish.";
  return blocker.detail || "Cleanup is not available yet. Refresh the scan and try again.";
}

function formatCleanupStartError(error) {
  const detail = error instanceof Error ? error.message : "";
  const text = detail.toLowerCase();
  if (/native scanner|native bridge|desktop/i.test(detail)) {
    return "The Windows desktop connection is not ready. Restart the desktop app and try again.";
  }
  if (/permission|access denied|denied/i.test(detail)) {
    return "Windows blocked access to this item. Close related apps or run the desktop app with the needed permissions, then try again.";
  }
  if (/fingerprint|consent|plan|proof|workflow|request mode|route|executor|feature flag|allowlist|native|env|spaceguard_enable/.test(text)) {
    return "Cleanup did not start. Scan again, check the item, and delete it.";
  }
  return "Cleanup did not start. Refresh the scan and try again.";
}

function buildRejectedCheckedCleanupEntry(candidate = {}, error = null) {
  const note = formatCleanupStartError(error);
  return {
    id: candidate.id || "checked-cleanup",
    title: candidate.title || "Checked cleanup",
    route: candidate.route || candidate.routeInput || "checked-cleanup",
    result: "rejected",
    rejectCode: "app-dispatch-error",
    bytes: 0,
    preflightStatus: "rejected",
    note,
    preflightChecks: [
      {
        id: "app-dispatch",
        label: "Cleanup request",
        status: "rejected",
        detail: note
      }
    ]
  };
}

export default App;
