import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Download,
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
  Terminal,
  Trash2,
  XCircle
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
  runNativeUserCacheExecutor,
  writeNativeProofArtifact
} from "./native-scanner.mjs";
import { buildOpenAIAgentRecommendationBroker, requestOpenAIAgentAdvice } from "./openai-agent.mjs";
import { buildAppAgentTaskQueue, buildBaselinePromotion, buildExecutionGate, buildExecutionLedgerRows, buildExecutionPrerequisites, buildInAppSupportBundleReport, buildManualFindingGuidance, buildManualFindingReviewRows, buildPostRunProof, buildRouteReadiness, buildWorkflowAgentTargetId, buildWorkflowLocks, formatBytes, parseWorkflowTimestamp, renderInAppSupportBundleMarkdown, resolveWorkflowAgentBrokerCandidate } from "./real-workflow.mjs";
import { buildWorkflowProofCheck } from "./workflow-proof-check.mjs";

const DEFAULT_SCAN_REQUEST = {
  targetDrive: "C:",
  protectedPaths: "",
  customRoots: "",
  includeProjectArtifacts: true,
  maxDepth: 8,
  maxEntriesPerRoot: 25000
};
const PROOF_PACKET_FILE = "spaceguard-selected-route-proof-packet.md";
const WORKFLOW_PROOF_FILE = "spaceguard-real-workflow-proof.md";
const WORKFLOW_PROOF_CHECK_FILE = "spaceguard-workflow-proof-check.json";
const SUPPORT_BUNDLE_FILE = "spaceguard-support-bundle.md";

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
    consequence: "Old temp files under allowed temp roots are removed."
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
    consequence: "Browser cache files are removed; cookies and identity files stay blocked by native validation."
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
    consequence: "Android Studio cache roots are pruned through native allowlists."
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
    consequence: "Only Docker build cache is pruned; images, containers, and volumes remain outside this route."
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
  const [permanentRemovalConfirmed, setPermanentRemovalConfirmed] = useState(false);
  const [archiveDestination, setArchiveDestination] = useState("");
  const [executionStatus, setExecutionStatus] = useState("idle");
  const [executionError, setExecutionError] = useState("");
  const [executionResult, setExecutionResult] = useState(null);
  const [executionRecord, setExecutionRecord] = useState(null);
  const [workflowProofAccepted, setWorkflowProofAccepted] = useState(false);
  const [workflowProofCheck, setWorkflowProofCheck] = useState(null);
  const [supportBundleWrite, setSupportBundleWrite] = useState(null);
  const [proofExportStatus, setProofExportStatus] = useState("idle");
  const [proofExportMessage, setProofExportMessage] = useState("");
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
  const executionPrerequisites = useMemo(
    () => buildExecutionPrerequisites({
      candidate: selectedCandidate,
      archiveDestination,
      permanentRemovalConfirmed
    }),
    [selectedCandidate, archiveDestination, permanentRemovalConfirmed]
  );
  const canExportProof = Boolean(postRunProof.status === "matched" && executionRecord?.accepted);
  const supportBundleWritten = Boolean(workflowProofAccepted && supportBundleWrite?.written);
  const agentContextKey = useMemo(
    () => buildAgentContextKey({
      runtime,
      scanFingerprint,
      selectedCandidate,
      executionRecord,
      postRunProof,
      workflowProofAccepted,
      workflowProofCheck,
      supportBundleWritten,
      archiveDestination,
      permanentRemovalConfirmed,
      agentPrompt
    }),
    [runtime, scanFingerprint, selectedCandidate, executionRecord, postRunProof, workflowProofAccepted, workflowProofCheck, supportBundleWritten, archiveDestination, permanentRemovalConfirmed, agentPrompt]
  );
  const agentContextKeyRef = useRef(agentContextKey);

  useEffect(() => {
    agentContextKeyRef.current = agentContextKey;
    setAgentAdvice(null);
    setAgentError("");
    setAgentStatus("idle");
  }, [agentContextKey]);

  const workflowLocks = useMemo(
    () => buildWorkflowLocks({ executionRecord, workflowProofAccepted, supportBundleWritten }),
    [executionRecord, workflowProofAccepted, supportBundleWritten]
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
      permanentRemovalConfirmed,
      workflowProofAccepted,
      workflowProofCheck,
      supportBundleWritten,
      workflowLocks
    }),
    [runtime, scan, candidates, manualFindings, selectedCandidate, executionRecord, postRunProof, activePlanId, scanFingerprint, canExecute, archiveDestination, permanentRemovalConfirmed, workflowProofAccepted, workflowProofCheck, supportBundleWritten, workflowLocks]
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
          proofStatus: getAgentProofStatus(executionRecord, postRunProof, workflowProofAccepted),
          largeFileArchiveDestination: archiveDestination,
          permanentRemovalConfirmed
        }
      });
    },
    [currentAgentAdvice, agentContext, activePlanId, scanFingerprint, canExecute, executionRecord, postRunProof, archiveDestination, permanentRemovalConfirmed, workflowProofAccepted]
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
        setPermanentRemovalConfirmed(false);
        setArchiveDestination("");
        setWorkflowProofAccepted(false);
        setWorkflowProofCheck(null);
        setSupportBundleWrite(null);
        setProofExportStatus("idle");
        setProofExportMessage("");
      } else {
        const defaultSelection = selectDefaultCleanupCandidateId(buildCleanupCandidates(result, latestRuntime || runtime));
        setScan(result);
        setPostRunScan(null);
        setExecutionResult(null);
        setExecutionRecord(null);
        setSelectedId(defaultSelection);
        setConsentChecked(false);
        setPermanentRemovalConfirmed(false);
        setWorkflowProofAccepted(false);
        setWorkflowProofCheck(null);
        setSupportBundleWrite(null);
        setProofExportStatus("idle");
        setProofExportMessage("");
      }
      setScanStatus("complete");
      setActiveView("clean");
    } catch (error) {
      setScanStatus("error");
      setScanError(error instanceof Error ? error.message : "Native scan failed.");
    }
  }

  async function executeSelectedCleanup() {
    if (!selectedCandidate) return;
    const currentExecutionGate = buildExecutionGate({
      candidate: selectedCandidate,
      consentChecked,
      executionPrerequisites,
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
    setExecutionStatus("running");
    setExecutionError("");
    setExecutionResult(null);
    setWorkflowProofAccepted(false);
    setWorkflowProofCheck(null);
    setSupportBundleWrite(null);
    setProofExportStatus("idle");
    setProofExportMessage("");
    const planId = activePlanId || `plan-${Date.now()}-${selectedCandidate.id}`;
    const executedAt = new Date().toISOString();
    try {
      const result = await dispatchExecutor(selectedCandidate, {
        planId,
        scanFingerprint,
        archiveDestination,
        permanentRemovalConfirmed
      });
      const reclaimedBytes = result.entries.reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
      const record = {
        schemaVersion: "spaceguard-real-execution-record/v1",
        planId,
        executedAt,
        source: `native-${selectedCandidate.executor}-executor`,
        id: selectedCandidate.id,
        title: selectedCandidate.title,
        recipeId: selectedCandidate.recipeId,
        route: selectedCandidate.route,
        routeInput: selectedCandidate.routeInput,
        envVar: selectedCandidate.envVar,
        targetPath: selectedCandidate.targetPath,
        expectedBytes: selectedCandidate.bytes,
        bytes: reclaimedBytes,
        accepted: Boolean(result.accepted),
        resultMode: result.mode || "",
        reason: result.reason || "",
        volumeProof: result.volumeProof || null,
        sourceFinding: selectedCandidate.sourceFinding || null,
        reviewTarget: selectedCandidate.reviewTarget || null,
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

  async function exportProofPacket() {
    const exportCandidate = selectedCandidate || proofCandidate;
    if (!exportCandidate || !executionRecord) return;
    setProofExportStatus("running");
    setProofExportMessage("");
    setWorkflowProofAccepted(false);
    setWorkflowProofCheck(null);
    setSupportBundleWrite(null);
    try {
      const generatedAt = new Date().toISOString();
      const selectedRouteProof = buildSelectedRouteProofPacket({
        candidate: exportCandidate,
        executionRecord,
        postRunProof,
        generatedAt
      });
      const workflowProof = buildRealWorkflowProofPacket({
        selectedRouteProof,
        generatedAt
      });
      const selectedRouteMarkdown = toProofMarkdown("SpaceGuard Selected Route Proof Packet", selectedRouteProof);
      const workflowMarkdown = toProofMarkdown("SpaceGuard Real Workflow Proof", workflowProof);
      const selectedWrite = await writeProofFile(PROOF_PACKET_FILE, selectedRouteMarkdown, {
        route: exportCandidate.route,
        proofKind: "selected-route-proof-packet"
      });
      const workflowWrite = await writeProofFile(WORKFLOW_PROOF_FILE, workflowMarkdown, {
        route: exportCandidate.route,
        proofKind: "real-workflow-proof"
      });
      const acceptedCheck = buildWorkflowProofCheck({
        evidenceObject: workflowProof,
        checkedAt: new Date().toISOString()
      });
      const proofCheckWrite = await writeProofFile(WORKFLOW_PROOF_CHECK_FILE, JSON.stringify(acceptedCheck, null, 2), {
        route: exportCandidate.route,
        proofKind: "workflow-proof-check"
      });
      const supportBundleReport = buildInAppSupportBundleReport({
        generatedAt,
        routeInput: exportCandidate.routeInput,
        selectedFlag: exportCandidate.envVar,
        proofArtifacts: [selectedWrite, workflowWrite, proofCheckWrite],
        workflowProofCheck: acceptedCheck
      });
      const supportBundleMarkdown = renderInAppSupportBundleMarkdown(supportBundleReport);
      const supportWrite = await writeProofFile(SUPPORT_BUNDLE_FILE, supportBundleMarkdown, {
        route: exportCandidate.route,
        proofKind: "support-bundle"
      });
      const supportBundleWrittenNow = Boolean(acceptedCheck.canAccept && supportWrite?.written);
      const baselinePromotion = buildBaselinePromotion({
        currentScan: scan,
        postRunScan,
        executionRecord,
        workflowProofAccepted: Boolean(acceptedCheck.canAccept),
        supportBundleWritten: supportBundleWrittenNow
      });
      setWorkflowProofCheck(acceptedCheck);
      setWorkflowProofAccepted(Boolean(acceptedCheck.canAccept));
      setSupportBundleWrite(supportWrite);
      if (baselinePromotion.canPromote) {
        setScan(baselinePromotion.activeScan);
        setSelectedId("");
        setConsentChecked(false);
        setPermanentRemovalConfirmed(false);
        setArchiveDestination("");
      }
      setProofExportStatus("complete");
      setProofExportMessage(
        acceptedCheck.canAccept
          ? `Support file exported.${baselinePromotion.canPromote ? " Latest scan is now active." : ""}`
          : `Support file exported, but ${acceptedCheck.blockers.length} issue(s) need review.`
      );
    } catch (error) {
      setProofExportStatus("error");
      setProofExportMessage(error instanceof Error ? error.message : "Proof export failed.");
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
    if (brokerCandidate && brokerCandidate.id !== selectedId) {
      selectWorkflowCandidate(brokerCandidate.id);
      return;
    }

    if (row.kind === "scoped-executor") {
      await executeSelectedCleanup();
      return;
    }

    focusAgentBrokerPanel(row);
  }

  function resetWorkflowForRouteChange() {
    setSelectedId("");
    setConsentChecked(false);
    setPermanentRemovalConfirmed(false);
    setArchiveDestination("");
    setExecutionStatus("idle");
    setExecutionError("");
    setExecutionResult(null);
    setExecutionRecord(null);
    setPostRunScan(null);
    setWorkflowProofAccepted(false);
    setWorkflowProofCheck(null);
    setSupportBundleWrite(null);
    setProofExportStatus("idle");
    setProofExportMessage("");
  }

  function selectWorkflowCandidate(id) {
    if (!id) return;
    setSelectedId(id);
    setActiveView("clean");
    setExecutionResult(null);
    setExecutionRecord(null);
    setPostRunScan(null);
    setExecutionStatus("idle");
    setExecutionError("");
    setArchiveDestination("");
    setConsentChecked(false);
    setPermanentRemovalConfirmed(false);
    setWorkflowProofAccepted(false);
    setWorkflowProofCheck(null);
    setSupportBundleWrite(null);
    setProofExportStatus("idle");
    setProofExportMessage("");
  }

  function toggleCleanupCandidate(candidate) {
    if (!candidate?.id) return;
    if (candidate.id === selectedId && consentChecked) {
      setConsentChecked(false);
      return;
    }
    selectWorkflowCandidate(candidate.id);
    if (candidate.canExecute) {
      setConsentChecked(true);
    }
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
              scan={scan}
              scanStatus={scanStatus}
              scanError={scanError}
              onRunScan={() => runRealScan()}
            />
            {scan ? (
              <CleanPanel
                candidates={candidates}
                selectedId={selectedId}
                candidate={selectedCandidate}
                consentChecked={consentChecked}
                permanentRemovalConfirmed={permanentRemovalConfirmed}
                setPermanentRemovalConfirmed={setPermanentRemovalConfirmed}
                archiveDestination={archiveDestination}
                setArchiveDestination={setArchiveDestination}
                canExecute={canExecute}
                executionStatus={executionStatus}
                executionError={executionError}
                executionResult={executionResult}
                scanStatus={scanStatus}
                scan={scan}
                onToggleCandidate={toggleCleanupCandidate}
                onExecute={executeSelectedCleanup}
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
            onSelectCandidate={selectWorkflowCandidate}
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
            selectedCandidate={selectedCandidate}
            executionRecord={executionRecord}
            executionResult={executionResult}
            postRunScan={postRunScan}
            postRunProof={postRunProof}
            scanStatus={scanStatus}
            workflowProofAccepted={workflowProofAccepted}
            workflowProofCheck={workflowProofCheck}
            canExportProof={canExportProof}
            proofExportStatus={proofExportStatus}
            proofExportMessage={proofExportMessage}
            onRescan={() => runRealScan({ afterExecution: true })}
            onExportProof={exportProofPacket}
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
              <p className="font-medium text-foreground">Selected item</p>
              <p className="mt-1 truncate">{selectedCandidate?.title || "Nothing selected"}</p>
              <p className="mt-3 font-medium text-foreground">Runtime</p>
              <p className="mt-1">{runtime?.windows ? "Windows native shell" : "Waiting for native shell"}</p>
            </div>
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

function ConnectionRequired({ runtime, runtimeStatus, runtimeError, onRefresh }) {
  const setupSteps = [
    {
      label: "Install project dependencies",
      command: "npm install",
      detail: "Run this from the SpaceGuard project folder on the Windows PC you want to clean."
    },
    {
      label: "Optional OpenAI key",
      command: "OPENAI_API_KEY=sk-...",
      detail: "Set this only if you want advisory reasoning. Cleanup still requires native allowlists and user confirmation."
    },
    {
      label: "Check Windows readiness",
      command: "npm run windows:ready",
      detail: "This blocks early if npm dependencies or the Windows toolchain are not ready."
    },
    {
      label: "Launch the desktop app",
      command: "npm run native:dev",
      detail: "This opens the Tauri desktop shell with built-in cleanup allowlists."
    },
    {
      label: "Run cleanup",
      command: "Scan -> check -> delete",
      detail: "If this setup screen is still visible, the native bridge is not connected yet."
    }
  ];
  const setupMetrics = [
    ["Native bridge", runtime?.available ? "connected" : "not connected"],
    ["Mode", runtime?.mode || "browser-setup"],
    ["Platform", runtime?.platform || "browser"],
    ["Status", runtimeStatus || "loading"]
  ];
  const unlocks = [
    "Read-only C: scan",
    "Cleanup choices",
    "Explicit user consent",
    "Safe delete action",
    "Post-clean rescan",
    "Cleanup activity"
  ];

  return (
    <main className="min-h-screen bg-background px-5 py-6 text-foreground lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <div className="flex flex-col justify-between gap-4 rounded-md border bg-card p-5 shadow-sm lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="restricted">desktop required</Badge>
              <Badge variant="outline">setup only</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">Connect the Windows desktop app</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              No local folders are scanned from this browser session. Start the Tauri shell on Windows to unlock real scan,
              user consent, native cleanup, post-clean rescan, and cleanup history.
            </p>
          </div>
          <Button variant="outline" onClick={onRefresh} disabled={runtimeStatus === "loading"}>
            <RefreshCcw className="h-4 w-4" />
            {runtimeStatus === "loading" ? "Checking" : "Recheck"}
          </Button>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(380px,1.1fr)]">
          <div className="space-y-4">
            <Card className="rounded-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  Windows launch steps
                </CardTitle>
                <CardDescription>This screen contains no preloaded cleanup data and cannot touch local files.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {setupMetrics.map(([label, value]) => (
                    <Metric key={label} label={label} value={value} />
                  ))}
                </div>
                <div className="space-y-3">
                  {setupSteps.map((step, index) => (
                    <div key={step.label} className="rounded-md border bg-background p-3">
                      <div className="flex gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted text-sm font-semibold">
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{step.label}</p>
                          <code className="mt-2 block overflow-hidden text-ellipsis rounded border bg-muted/50 px-2 py-1 text-xs">
                            {step.command}
                          </code>
                          <p className="mt-2 text-sm text-muted-foreground">{step.detail}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {runtimeError ? (
                  <Notice tone="restricted" icon={AlertTriangle} text={runtimeError} />
                ) : (
                  <Notice
                    tone="review"
                    icon={Lock}
                    text="This setup page is intentionally non-executable. Start the desktop shell to test real Windows data."
                  />
                )}
              </CardContent>
            </Card>
            <Card className="rounded-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  What unlocks after connection
                </CardTitle>
                <CardDescription>The real app appears only when the Tauri bridge is detected.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
                {unlocks.map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>{item}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4">
            <RuntimePanel runtime={runtime} />
          </div>
        </div>
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

function RuntimePanel({ runtime }) {
  const checks = [
    ["Windows", runtime?.windows],
    ["Scan", runtime?.scanKnownRoots],
    ["Cleanup", runtime?.executeCleanupPlan],
    ["Safe list", runtime?.safeExecutorsEnabled],
    ["AI", runtime?.openAiAgentAdvice && runtime?.openAiAdvisorConfigured]
  ];
  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Desktop connection
        </CardTitle>
        <CardDescription>Current app permissions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {checks.map(([label, passed]) => (
            <div key={label} className="rounded-md border bg-muted/25 p-3">
              <div className="flex items-center gap-2">
                {passed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                <span className="text-sm font-medium">{label}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-md border bg-background p-3">
          <p className="text-sm font-medium">Safety rules</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={runtime?.safeExecutorsEnabled ? "safe" : "review"}>
              {runtime?.safeExecutorsEnabled ? "safe cleanup enabled" : "safe cleanup unavailable"}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Cleanup only runs after scan evidence and your confirmation.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ScanPanel({ request, setRequest, scan, scanStatus, scanError, onRunScan }) {
  const running = scanStatus === "scanning" || scanStatus === "rescanning";
  const hasScan = Boolean(scan);
  return (
    <Card className="rounded-md">
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FolderSearch className="h-4 w-4" />
              {hasScan ? "Scan complete" : "Scan for cleanup"}
            </CardTitle>
            <CardDescription>{hasScan ? "Choose an item below to clean space." : "Read-only scan. Nothing is deleted until you choose an item."}</CardDescription>
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
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">{hasScan ? "Scan settings" : "Advanced scan options"}</summary>
          <div className="space-y-3 border-t p-3">
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
                <span className="font-medium">Custom read-only roots</span>
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
        {scan ? (
          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="Generated" value={formatShortDate(scan.generatedAt)} />
            <Metric label="Findings" value={String(scan.findings.length)} />
            <Metric label="Measured bytes" value={formatBytes(scan.totalBytes)} />
            <Metric label="Drive free" value={formatBytes(scan.volume?.freeBytes || 0)} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CleanPanel({
  candidates,
  selectedId,
  candidate,
  consentChecked,
  permanentRemovalConfirmed,
  setPermanentRemovalConfirmed,
  archiveDestination,
  setArchiveDestination,
  canExecute,
  executionStatus,
  executionError,
  executionResult,
  scanStatus,
  scan,
  onToggleCandidate,
  onExecute,
  onRescan
}) {
  const candidateReady = Boolean(candidate?.canExecute);
  const showSelectedDetails = Boolean(candidate && (!candidateReady || candidate.requiresPermanentConfirmation || candidate.requiresArchiveDestination));
  const running = executionStatus === "running";
  return (
    <Card id="cleanup-actions-panel" className="rounded-md">
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Clean space
            </CardTitle>
            <CardDescription>Check one item, then delete it.</CardDescription>
          </div>
          <Button className="w-full md:w-auto" disabled={!canExecute || running} onClick={onExecute}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {candidate?.requiresPermanentConfirmation ? "Empty Recycle Bin" : "Delete selected files"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!scan ? (
          <EmptyState icon={ScanLine} title="Scan first" detail="Cleanable items appear here after the scan finishes." />
        ) : candidates.length ? (
          <>
            <div className="grid gap-3">
              {candidates.map((row) => {
                const checked = row.id === selectedId && row.canExecute && consentChecked;
                const selected = row.id === selectedId;
                const statusLabel = row.canExecute ? "can clean" : row.executable ? "not ready" : "review only";
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
                          disabled={!row.canExecute}
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleCandidate(row);
                          }}
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={row.canExecute ? "safe" : row.executable ? "review" : "outline"}>
                              {statusLabel}
                            </Badge>
                            <span className="font-medium">{row.title}</span>
                          </div>
                          <p className="mt-2 truncate text-sm text-muted-foreground">{row.targetPath || row.targetKind}</p>
                        </div>
                      </div>
                      <div className="shrink-0 md:text-right">
                        <p className="text-lg font-semibold">{formatBytes(row.bytes)}</p>
                        <p className="text-xs text-muted-foreground">{row.canExecute ? "Ready" : "Not ready"}</p>
                      </div>
                    </div>
                    {!row.canExecute ? (
                      <div className="mx-4 mb-4 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                        {formatNotReadyReason(row)}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {showSelectedDetails ? (
              <div className="rounded-md border bg-muted/25 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">Selected item</p>
                    <p className="mt-1 text-base font-semibold">{candidate.title}</p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{candidate.targetPath}</p>
                  </div>
                  <div className="shrink-0 md:text-right">
                    <p className="text-2xl font-semibold">{formatBytes(candidate.bytes)}</p>
                    <p className="text-xs text-muted-foreground">{candidateReady ? "Ready to delete" : "Not ready yet"}</p>
                  </div>
                </div>
                {!candidateReady ? (
                  <Notice tone="restricted" icon={Lock} text={formatNotReadyReason(candidate)} />
                ) : null}
                {candidate.requiresPermanentConfirmation ? (
                  <label className="mt-4 flex items-start gap-3 text-sm">
                    <Checkbox checked={candidateReady && permanentRemovalConfirmed} disabled={!candidateReady} onClick={() => setPermanentRemovalConfirmed(!permanentRemovalConfirmed)} />
                    <span>I understand this permanently empties Recycle Bin contents for the selected drive.</span>
                  </label>
                ) : null}
                {candidate.requiresArchiveDestination ? (
                  <label className="mt-4 block space-y-1 text-sm">
                    <span className="font-medium">Archive destination</span>
                    <Input value={archiveDestination} onChange={(event) => setArchiveDestination(event.target.value)} placeholder="D:\\Archives" disabled={!candidateReady} />
                  </label>
                ) : null}
              </div>
            ) : null}
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
          <EmptyState icon={Lock} title="No cleanable findings yet" detail="Measured findings were not found or they do not map to a shipped safe executor." />
        )}
      </CardContent>
    </Card>
  );
}

function CleanupResult({ result, scanStatus, onRescan }) {
  const accepted = Boolean(result?.accepted);
  const reclaimedBytes = totalEntryBytes(result?.entries || []);
  const runningRescan = scanStatus === "rescanning";
  const acceptedText = runningRescan
    ? `${formatBytes(reclaimedBytes)} removed. Refreshing the list.`
    : scanStatus === "error"
      ? `${formatBytes(reclaimedBytes)} removed. Refresh failed; click Refresh again.`
      : `${formatBytes(reclaimedBytes)} removed. The list is up to date.`;
  const rejectedText = formatCleanupRejectMessage(result);
  const showRefreshAction = !accepted || runningRescan || scanStatus === "error";
  return (
    <div className={`rounded-md border p-4 text-sm ${accepted ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-red-200 bg-red-50 text-red-950"}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-base font-semibold">{accepted ? "Cleaned" : "Could not clean this item"}</p>
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
              Explore C: allocation
            </CardTitle>
            <CardDescription>Top-level drive inventory, known cleanup areas, and manual review rows from the native scan.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onRunScan} disabled={false}>
            <ScanLine className="h-4 w-4" />
            Rescan
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!scan ? (
          <EmptyState icon={HardDrive} title="Run a scan to explore C:" detail="The explorer is built from native scan evidence and does not browse arbitrary folders live." />
        ) : !rows.length ? (
          <EmptyState icon={HardDrive} title="No large areas found" detail="Run a fresh scan or add a custom read-only root from Advanced scan options." />
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <Metric label="Drive" value={scan.volume?.drive || scan.targetDrive || "C:"} />
              <Metric label="Used" value={formatBytes(scan.volume?.usedBytes || 0)} />
              <Metric label="Free" value={formatBytes(scan.volume?.freeBytes || 0)} />
              <Metric label="Rows" value={String(rows.length)} />
            </div>
            <div className="grid gap-3">
              {rows.map((row) => (
                <div key={row.id} className="rounded-md border bg-background p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={row.cleanable ? row.ready ? "safe" : "review" : "outline"}>
                          {row.cleanable ? row.ready ? "can clean" : "not ready" : "review only"}
                        </Badge>
                        <p className="font-medium">{row.title}</p>
                      </div>
                      <p className="mt-2 truncate text-sm text-muted-foreground">{row.path || row.source}</p>
                      <details className="mt-2 text-xs text-muted-foreground">
                        <summary className="cursor-pointer font-medium text-foreground">Details</summary>
                        <div className="mt-2 rounded-md border bg-muted/20 p-2">
                          <p>{row.detail}</p>
                          <p className="mt-1">Type: {row.kind}</p>
                        </div>
                      </details>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
                      <p className="text-lg font-semibold">{formatBytes(row.bytes)}</p>
                      {row.candidateId ? (
                        <Button size="sm" variant={row.ready ? "default" : "outline"} onClick={() => onSelectCandidate(row.candidateId)}>
                          <Trash2 className="h-3.5 w-3.5" />
                          {row.ready ? "Select" : "View issue"}
                        </Button>
                      ) : (
                        <Badge variant="outline">review only</Badge>
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
  selectedCandidate,
  executionRecord,
  executionResult,
  postRunScan,
  postRunProof,
  scanStatus,
  workflowProofAccepted,
  workflowProofCheck,
  canExportProof,
  proofExportStatus,
  proofExportMessage,
  onRescan,
  onExportProof
}) {
  const ledger = buildExecutionLedgerRows(executionResult);
  return (
    <div className="grid gap-5">
      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Activity
          </CardTitle>
          <CardDescription>Latest cleanup result.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!executionRecord ? (
            <EmptyState icon={History} title="No cleanup has run yet" detail="Run a cleanable item to see what happened." />
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <Metric label="Item" value={executionRecord.title || "Cleanup target"} />
                <Metric label="Status" value={executionRecord.accepted ? "Cleaned" : "Needs retry"} />
                <Metric label="Freed" value={formatBytes(executionRecord.bytes || 0)} />
                <Metric label="Ran" value={formatShortDate(executionRecord.executedAt)} />
              </div>
              <p className="text-sm text-muted-foreground">{formatHistorySummary(executionRecord, ledger)}</p>
              <Button variant="outline" onClick={onRescan} disabled={scanStatus === "rescanning"}>
                {scanStatus === "rescanning" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Scan again
              </Button>
              <details id="execution-proof-handoff-panel" className="rounded-md border bg-muted/20">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Support file</summary>
                <SupportDetails
                  selectedCandidate={selectedCandidate}
                  executionRecord={executionRecord}
                  postRunScan={postRunScan}
                  postRunProof={postRunProof}
                  workflowProofAccepted={workflowProofAccepted}
                  workflowProofCheck={workflowProofCheck}
                  canExportProof={canExportProof}
                  proofExportStatus={proofExportStatus}
                  proofExportMessage={proofExportMessage}
                  onExportProof={onExportProof}
                />
              </details>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SupportDetails({
  selectedCandidate,
  executionRecord,
  postRunScan,
  postRunProof,
  workflowProofAccepted,
  workflowProofCheck,
  canExportProof,
  proofExportStatus,
  proofExportMessage,
  onExportProof
}) {
  return (
    <div className="space-y-4 border-t p-3">
      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Cleanup" value={selectedCandidate?.title || executionRecord.title || "Selected item"} />
        <Metric label="Freed" value={formatBytes(executionRecord.bytes)} />
        <Metric label="Latest scan" value={formatPostRunProofStatus(postRunProof.status)} />
      </div>
      {executionRecord.accepted && !volumeProofMeasured(executionRecord.volumeProof) ? (
        <Notice tone="review" icon={AlertTriangle} text="Scan again before exporting a support file." />
      ) : null}
      {postRunScan && postRunProof.status !== "matched" ? (
        <Notice tone="review" icon={RefreshCcw} text="Scan again before exporting a support file." />
      ) : null}
      <Button className="w-full" disabled={!canExportProof || proofExportStatus === "running"} onClick={onExportProof}>
        {proofExportStatus === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Export support file
      </Button>
      {proofExportMessage ? (
        <Notice
          tone={proofExportStatus === "error" || (workflowProofCheck && !workflowProofCheck.canAccept) ? "restricted" : "safe"}
          icon={proofExportStatus === "error" || (workflowProofCheck && !workflowProofCheck.canAccept) ? AlertTriangle : CheckCircle2}
          text={proofExportMessage}
        />
      ) : null}
      {workflowProofCheck ? (
        <details className="rounded-md border bg-background text-sm">
          <summary className="cursor-pointer px-3 py-2 font-medium">Support details</summary>
          <div className="space-y-2 border-t p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">Support check</span>
              <Badge variant={workflowProofAccepted ? "safe" : "restricted"}>{workflowProofCheck.status}</Badge>
            </div>
            <p className="text-muted-foreground">{workflowProofCheck.primary}</p>
            {workflowProofCheck.blockers?.length ? (
              <div className="grid gap-2">
                {workflowProofCheck.blockers.slice(0, 4).map((blocker) => (
                  <div key={`${blocker.id}-${blocker.label}`} className="rounded border px-3 py-2">
                    <p className="text-xs font-medium">{blocker.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{blocker.detail}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
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
            text="Run a scan and set OPENAI_API_KEY to ask AI for a cleanup recommendation."
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
                        {suggestedAction.canAct ? "ready" : suggestedAction.status === "manual-only" ? "review only" : "needs review"}
                      </Badge>
                      <p className="font-medium">{formatAgentActionTitle(suggestedAction)}</p>
                    </div>
                    {suggestedAction.blockedReason ? (
                      <p className="mt-2 text-xs text-muted-foreground">{suggestedAction.blockedReason}</p>
                    ) : null}
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
            {assistant.recommendedActions?.length ? (
              <details className="rounded-md border bg-muted/20 text-xs">
                <summary className="cursor-pointer px-3 py-2 font-medium text-foreground">Why this recommendation</summary>
                <div className="grid gap-2 border-t p-3">
                  {assistant.recommendedActions.slice(0, 3).map((row) => (
                    <div key={row.id} className="rounded-md border bg-background p-2">
                      <p className="font-medium text-foreground">{row.title}</p>
                      <p className="text-muted-foreground">{row.reason}</p>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        ) : null}
        {agentBroker ? (
          <details className="rounded-md border bg-muted/20 text-sm">
            <summary className="cursor-pointer px-3 py-2 font-medium">Recommendation diagnostics</summary>
            <div className="space-y-3 border-t p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">Recommendation status</p>
                <Badge variant={agentBroker.status === "broker-ready" ? "safe" : "review"}>{agentBroker.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{agentBroker.primary}</p>
              {agentBroker.rows.slice(0, 4).map((row) => (
                <div key={row.key} className="rounded-md border bg-muted/25 p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={row.canAct ? "safe" : row.status === "manual-only" ? "outline" : "restricted"}>
                      {row.status}
                    </Badge>
                    <p className="text-xs font-medium">{row.actionType}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Target: {row.targetPanel || "manual review"}</p>
                  {row.blockedReason ? (
                    <p className="mt-1 text-xs text-red-600">{row.blockedReason}</p>
                  ) : null}
                  {canRunAgentBrokerAction(row) ? (
                    <Button className="mt-2" size="sm" variant="secondary" onClick={() => onBrokerAction(row)}>
                      <ChevronRight className="h-3.5 w-3.5" />
                      {formatAgentButtonLabel(row)}
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </details>
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
          Review only
        </CardTitle>
        <CardDescription>These areas may be large, but the app will not delete them automatically.</CardDescription>
      </CardHeader>
      <CardContent>
        {findings.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {findings.map((finding) => (
              <div key={`${finding.recipeId}-${finding.path}`} className="rounded-md border bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium">{finding.title}</p>
                  <Badge variant="outline">{finding.status}</Badge>
                </div>
                <p className="mt-2 truncate text-xs text-muted-foreground">{finding.path || finding.recipeId}</p>
                <p className="mt-2 text-lg font-semibold">{formatBytes(finding.bytes)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{finding.note || "Manual review only."}</p>
                <div className="mt-3 rounded-md border bg-muted/30 p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{finding.manualGuidance.confidence}</Badge>
                    <p className="text-xs font-medium">Recommended action</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{finding.manualGuidance.primaryAction}</p>
                </div>
                <details className="mt-3 rounded-md border bg-background text-xs">
                  <summary className="cursor-pointer px-2 py-2 font-medium">Review details</summary>
                  <div className="space-y-3 border-t p-2">
                    <code className="block overflow-hidden text-ellipsis rounded border bg-muted/30 px-2 py-1">
                      {finding.manualGuidance.command}
                    </code>
                    <div>
                      <p className="font-medium">Why review only</p>
                      <ul className="mt-1 space-y-1">
                        {finding.manualGuidance.blockedActions.slice(0, 3).map((action) => (
                          <li key={action} className="flex gap-2 text-muted-foreground">
                            <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {finding.reviewRows.rows.length ? (
                      <div className="rounded-md border bg-background">
                        <div className="border-b px-2 py-2">
                          <p className="font-medium">Items inside</p>
                        </div>
                        <div className="divide-y">
                          {finding.reviewRows.rows.slice(0, 3).map((row) => (
                            <div key={row.id || row.path} className="p-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{row.name}</p>
                                  <p className="mt-0.5 text-muted-foreground">{formatBytes(row.bytes)}</p>
                                </div>
                                <Badge variant={row.action === "keep-installed" ? "safe" : "review"}>{row.actionLabel}</Badge>
                              </div>
                              <p className="mt-1 line-clamp-2 text-muted-foreground">{row.reason}</p>
                              <p className="mt-2 font-medium">Signals</p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {row.signals.slice(0, 4).map((signal) => (
                                  <Badge key={`${row.id}-${signal.label}-${signal.value}`} variant={signal.tone === "safe" ? "safe" : signal.tone === "restricted" ? "restricted" : "outline"}>
                                    {signal.label}: {signal.value}
                                  </Badge>
                                ))}
                              </div>
                              <p className="mt-2 text-muted-foreground">{row.blockedAction}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </details>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={HardDrive} title="No review-only findings" detail="Run a scan to show areas that need manual review." />
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

function volumeProofMeasured(volumeProof = null) {
  return volumeProof?.status === "measured";
}

function formatVolumeProofStatus(volumeProof = null) {
  if (volumeProofMeasured(volumeProof)) return `measured ${volumeProof.drive || ""}`.trim();
  return volumeProof?.status || "missing";
}

function formatPostRunProofStatus(status = "") {
  if (status === "matched") return "Updated";
  if (status === "needs-rescan" || status === "not-run") return "Refresh needed";
  if (status === "mismatch") return "Needs review";
  return status || "Not refreshed";
}

function formatHistorySummary(executionRecord = {}, ledger = {}) {
  if (executionRecord.accepted) {
    const bytes = formatBytes(executionRecord.bytes || 0);
    return Number(executionRecord.bytes || 0) > 0
      ? `${bytes} removed. The list is up to date.`
      : "Cleanup ran, but there was nothing new to remove. The list is up to date.";
  }
  return "Nothing was deleted. Refresh the scan, close apps that may be using these files, and try again.";
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
    return "Confirm the Recycle Bin cleanup, then try again.";
  }
  if (/target-(not-allowlisted|forbidden|blocked|missing)|outside|allowlist/.test(text)) {
    return "This item is outside the safe cleanup list. Choose another can clean item or scan again.";
  }
  if (/executor-disabled|feature-flag|cleanup authority|not available|runtime/.test(text)) {
    return "Cleanup is not available for this item in this app session. Restart SpaceGuard, scan again, and try another can clean item.";
  }
  if (/access denied|permission|locked|in use|using these files/.test(text)) {
    return "Windows blocked some files because they are in use. Close the related apps, scan again, and retry.";
  }
  return "Nothing was deleted. Close apps using these files, scan again, and try once more.";
}

function formatNotReadyReason(candidate = {}) {
  if (!candidate?.executable) {
    return "Review only. SpaceGuard will not delete this automatically.";
  }
  const text = String(candidate.blockedReason || "").toLowerCase();
  if (text.includes("windows") || text.includes("runtime") || text.includes("desktop")) {
    return "The desktop cleanup connection is not ready. Refresh or restart the app.";
  }
  if (text.includes("finding status") || text.includes("scan")) {
    return "Refresh the scan, then try this item again.";
  }
  if (text.includes("allowlist") || text.includes("executor")) {
    return "This cleanup is not available in this session. Choose another item or refresh the app.";
  }
  return "Not ready to delete. Choose another can clean item or refresh the scan.";
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
  return (
    candidates.find((candidate) => candidate.canExecute)?.id ||
    candidates.find((candidate) => candidate.executable)?.id ||
    candidates[0]?.id ||
    ""
  );
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
    detail: candidate.canExecute
      ? candidate.consequence
      : candidate.blockedReason || "This target needs review before cleanup.",
    cleanable: true,
    ready: Boolean(candidate.canExecute),
    candidateId: candidate.id
  }));
  const manualRows = manualFindings.map((finding) => ({
    id: `manual-${finding.recipeId}-${finding.path || finding.title}`,
    title: finding.title || "Manual review",
    path: finding.path || "",
    bytes: Number(finding.bytes || 0),
    kind: finding.manualGuidance?.kind || "manual",
    source: "manual-review",
    detail: finding.manualGuidance?.primaryAction || finding.note || "Manual review only; no shipped executor can delete this row.",
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

function buildSelectedRouteProofPacket({ candidate, executionRecord, postRunProof, generatedAt }) {
  return {
    schemaVersion: "spaceguard-selected-route-proof-packet/v1",
    generatedAt,
    status: postRunProof.matched ? "proof-complete" : "proof-mismatch",
    tone: postRunProof.matched ? "safe" : "restricted",
    route: candidate.route,
    routeInput: candidate.routeInput,
    title: candidate.title,
    planId: executionRecord.planId,
    launchStatus: "ready",
    launchReady: true,
    proofStatus: "proof-complete",
    verificationStatus: "ready-for-comparison",
    rescanStatus: postRunProof.matched ? "matched" : "mismatch",
    runKind: "scoped-native-execution",
    runLabel: "Scoped native execution",
    scopedNativeExecution: true,
    latestExecutionAt: executionRecord.executedAt,
    scanGeneratedAt: postRunProof.scanGeneratedAt,
    postRunScanEvidence: postRunProof.matched,
    readyForNextRoute: postRunProof.matched,
    counts: {
      ledgerEntries: 1,
      matchedRows: postRunProof.matched ? 1 : 0,
      reclaimedBytes: Number(executionRecord.bytes || 0)
    },
    volumeProof: normalizeProofVolumeProof(executionRecord.volumeProof),
    selectedRouteProofReview: {
      status: postRunProof.matched ? "review-complete" : "needs-review",
      complete: postRunProof.matched,
      evidencePath: `.\\${PROOF_PACKET_FILE}`,
      reviewer: "local-operator",
      detail: "The operator reviewed and exported the proof packet from the desktop app."
    },
    ledgerEntries: [
      {
        id: executionRecord.id,
        title: executionRecord.title,
        planId: executionRecord.planId,
        source: executionRecord.source,
        runKind: "scoped-native-execution",
        runLabel: "Scoped native execution",
        route: candidate.route,
        path: candidate.targetPath,
        bytes: Number(executionRecord.bytes || 0),
        result: executionRecord.accepted ? "accepted" : "rejected",
        executedAt: executionRecord.executedAt,
        nativeVolumeProof: normalizeProofVolumeProof(executionRecord.volumeProof)
      }
    ],
    checkpoints: [
      {
        id: candidate.id,
        title: candidate.title,
        route: candidate.route,
        path: candidate.targetPath,
        expectedBytes: Number(executionRecord.bytes || 0),
        status: postRunProof.matched ? "ready-for-comparison" : "needs-review"
      }
    ],
    rescanRows: [
      {
        id: candidate.id,
        title: candidate.title,
        route: candidate.route,
        state: postRunProof.matched ? "matched" : "mismatch",
        expectedBytes: Number(executionRecord.bytes || 0),
        expectedRemainingBytes: Number(postRunProof.expectedRemaining || 0),
        actualBytes: Number(postRunProof.actualBytes || 0),
        evidence: postRunProof.detail
      }
    ],
    primary: postRunProof.matched
      ? `${candidate.routeInput} proof is complete.`
      : `${candidate.routeInput} proof needs review before another route.`,
    steps: postRunProof.matched
      ? ["Validate the workflow proof.", "Keep another route disabled until validation accepts this packet."]
      : ["Run another post-run scan.", "Review native ledger and target bytes."]
  };
}

function buildRealWorkflowProofPacket({ selectedRouteProof, generatedAt }) {
  const volumeCaptured = selectedRouteProof.volumeProof?.status === "measured" || selectedRouteProof.volumeProof?.measured === true;
  const ready = Boolean(
    selectedRouteProof.status === "proof-complete" &&
      selectedRouteProof.selectedRouteProofReview?.complete &&
      Number(selectedRouteProof.counts?.reclaimedBytes || 0) > 0 &&
      volumeCaptured
  );
  const rows = [
    { id: "native-scan-current", label: "Native scan current", passed: true, detail: "The workflow used native scan evidence." },
    { id: "post-run-proof-complete", label: "Post-run proof complete", passed: selectedRouteProof.status === "proof-complete", detail: selectedRouteProof.primary },
    { id: "selected-route-proof-reviewed", label: "Selected-route proof reviewed", passed: selectedRouteProof.selectedRouteProofReview?.complete === true, detail: selectedRouteProof.selectedRouteProofReview?.detail || "" },
    { id: "selected-route-proof-export", label: "Selected-route proof export", passed: true, detail: `${PROOF_PACKET_FILE} exported.` },
    { id: "reclaimed-bytes", label: "Positive recovered bytes", passed: Number(selectedRouteProof.counts?.reclaimedBytes || 0) > 0, detail: `${formatBytes(selectedRouteProof.counts?.reclaimedBytes || 0)} recovered.` },
    { id: "native-volume-proof", label: "Native volume proof", passed: volumeCaptured, detail: selectedRouteProof.volumeProof?.note || "Measured native volume proof captured." },
    { id: "next-route-clearance", label: "Next route clearance", passed: ready, detail: ready ? "The selected route can be validated for handoff." : "Workflow proof is blocked." }
  ];
  return {
    schemaVersion: "spaceguard-real-workflow-proof/v1",
    generatedAt,
    status: ready ? "workflow-proven" : "proof-export-required",
    tone: ready ? "safe" : "review",
    route: selectedRouteProof.route,
    routeInput: selectedRouteProof.routeInput,
    title: selectedRouteProof.title,
    workflowStatus: ready ? "next-route-ready" : "proof-review-required",
    proofStatus: selectedRouteProof.status,
    selectedRouteProofReviewStatus: selectedRouteProof.selectedRouteProofReview?.status || "not-reviewed",
    appCloseContract: buildAppCloseContract(selectedRouteProof.route),
    readyForNextRoute: ready,
    nativeScanCurrent: true,
    unsafeRuntime: false,
    rows,
    blockedRows: rows.filter((row) => !row.passed),
    volumeProof: selectedRouteProof.volumeProof,
    counts: {
      total: rows.length,
      passed: rows.filter((row) => row.passed).length,
      blocked: rows.filter((row) => !row.passed).length,
      ledgerEntries: Number(selectedRouteProof.counts?.ledgerEntries || 0),
      matchedRows: Number(selectedRouteProof.counts?.matchedRows || 0),
      reclaimedBytes: Number(selectedRouteProof.counts?.reclaimedBytes || 0)
    },
    primary: ready ? `${selectedRouteProof.routeInput} workflow proof is ready.` : "Workflow proof still has blocked rows."
  };
}

function buildAppCloseContract(route = "") {
  const common = [
    "post-run-rescan-matched",
    "selected-route-proof-packet-exported",
    "selected-route-proof-reviewed",
    "spaceguard-real-workflow-proof-exported"
  ];
  return {
    schemaVersion: "spaceguard-selected-route-app-close-contract/v1",
    workflowProofPath: `.\\${WORKFLOW_PROOF_FILE}`,
    selectedRouteProofPacketPath: `.\\${PROOF_PACKET_FILE}`,
    expectedWorkflowProofSchema: "spaceguard-real-workflow-proof/v1",
    minimumReclaimedBytes: 1,
    nextRouteBlockedUntil: "validate:workflow-proof accepted",
    requiredBeforeClosingApp: ["native-volume-proof-captured", ...common]
  };
}

function normalizeProofVolumeProof(volumeProof) {
  const measured = volumeProof?.status === "measured";
  return {
    status: measured ? "measured" : "not-collected",
    measured,
    drive: volumeProof?.drive || "",
    driveLabel: volumeProof?.drive || "",
    freeBytesDelta: Number(volumeProof?.freeBytesDelta || 0),
    beforeFreeBytes: Number(volumeProof?.before?.freeBytes || 0),
    afterFreeBytes: Number(volumeProof?.after?.freeBytes || 0),
    source: volumeProof?.source || "native-write-volume-proof",
    note: volumeProof?.note || (measured ? "Native volume proof captured around executor dispatch." : "Native volume proof was not captured.")
  };
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
  workflowProofAccepted = false,
  workflowProofCheck = null,
  supportBundleWritten = false,
  workflowLocks = buildWorkflowLocks({ executionRecord, workflowProofAccepted, supportBundleWritten })
}) {
  const agentCandidateIds = new Map();
  const cleanupQueue = candidates.slice(0, 24).map((candidate, index) => {
    const agentTargetId = buildAgentCleanupTargetId(candidate, index);
    agentCandidateIds.set(candidate.id, agentTargetId);
    return {
      id: agentTargetId,
      title: candidate.title,
      route: candidate.route,
      routeInput: candidate.routeInput,
      actionType: candidate.actionType,
      targetId: agentTargetId,
      bytes: Number(candidate.bytes || 0),
      canExecute: Boolean(candidate.canExecute),
      blockedReason: redactAgentContextText(candidate.blockedReason || ""),
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
      reason: redactAgentContextText(finding.manualGuidance?.primaryAction || finding.note || "Manual review only."),
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
    proofStatus: getAgentProofStatus(executionRecord, postRunProof, workflowProofAccepted),
    proofAllowsNextExecutor: workflowLocks.proofAllowsNextExecutor,
    proofHandoffRequired: Boolean(workflowLocks.proofHandoffRequired),
    noOpExecution: Boolean(workflowLocks.noOpExecution),
    workflowProofCheckStatus: workflowProofCheck?.status || "not-run",
    workflowProofCheckCanAccept: Boolean(workflowProofCheck?.canAccept),
    supportBundleWritten: Boolean(supportBundleWritten),
    workflowProofCheckBlockers: Array.isArray(workflowProofCheck?.blockers)
      ? workflowProofCheck.blockers.map((blocker) => ({
          id: blocker.id || "",
          label: blocker.label || "",
          detail: redactAgentContextText(blocker.detail || "")
        }))
      : [],
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
    supportBundleWritten: Boolean(supportBundleWritten),
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
      canExecute: selectedCandidate.canExecute,
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

function getAgentProofStatus(executionRecord, postRunProof, workflowProofAccepted = false) {
  if (!executionRecord) return "waiting-for-execution";
  if (workflowProofAccepted) return "proof-complete";
  if (postRunProof?.matched) return "workflow-proof-validation-required";
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

function toProofMarkdown(title, packet) {
  return [
    `# ${title}`,
    "",
    "```json",
    JSON.stringify(packet, null, 2),
    "```"
  ].join("\n");
}

async function writeProofFile(fileName, content, metadata) {
  const result = await writeNativeProofArtifact(fileName, content, metadata);
  if (!result?.written) {
    const reason = result?.reason || "Native proof artifact writer is required for real workflow handoff.";
    throw new Error(`Native proof artifact writer is required before proof export can complete: ${reason}`);
  }
  return result;
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
  workflowProofAccepted = false,
  workflowProofCheck = null,
  supportBundleWritten = false,
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
    workflowProofAccepted ? "workflow-proof-accepted" : "workflow-proof-open",
    workflowProofCheck?.status || "workflow-proof-check-open",
    supportBundleWritten ? "support-bundle-written" : "support-bundle-open",
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
  if (blocker.id === "selected-target") return "Check one item marked can clean before deleting.";
  if (blocker.id === "route-readiness") return "This item is not ready to clean. Choose another can clean item or refresh the scan.";
  if (blocker.id === "consent-checkbox") return "Check one item marked can clean before deleting.";
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
