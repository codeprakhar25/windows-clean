import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileJson,
  FolderSearch,
  HardDrive,
  KeyRound,
  Loader2,
  Lock,
  Play,
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
import { buildAppAgentTaskQueue, buildBaselinePromotion, buildExecutionGate, buildExecutionPrerequisites, buildInAppSupportBundleReport, buildManualFindingGuidance, buildManualFindingReviewRows, buildPostRunProof, buildRouteReadiness, buildRouteSetupChecklist, buildWorkflowLocks, formatBytes, parseWorkflowTimestamp, renderInAppSupportBundleMarkdown } from "./real-workflow.mjs";
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
const CONFIRM_PREFIX = "RUN";

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
  const routeSetupOptions = useMemo(() => buildRouteSetupOptions(), []);
  const [setupRouteInput, setSetupRouteInput] = useState("npm-cache");
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
  const [confirmationText, setConfirmationText] = useState("");
  const [permanentRemovalConfirmed, setPermanentRemovalConfirmed] = useState(false);
  const [archiveDestination, setArchiveDestination] = useState("");
  const [executionStatus, setExecutionStatus] = useState("idle");
  const [executionError, setExecutionError] = useState("");
  const [executionResult, setExecutionResult] = useState(null);
  const [executionRecord, setExecutionRecord] = useState(null);
  const [proofReviewed, setProofReviewed] = useState(false);
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
  const candidates = useMemo(() => buildCleanupCandidates(scan, runtime, setupRouteInput), [scan, runtime, setupRouteInput]);
  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedId) || null,
    [candidates, selectedId]
  );
  const manualFindings = useMemo(() => buildManualFindings(scan), [scan]);
  const setupRoute = useMemo(
    () => routeSetupOptions.find((route) => route.routeInput === setupRouteInput) || routeSetupOptions[0],
    [routeSetupOptions, setupRouteInput]
  );
  const setupChecklist = useMemo(
    () => buildRouteSetupChecklist({ route: setupRoute, runtime }),
    [setupRoute, runtime]
  );
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
  const expectedConfirmation = selectedCandidate
    ? `${CONFIRM_PREFIX} ${selectedCandidate.routeInput}`
    : `${CONFIRM_PREFIX} route`;
  const executionPrerequisites = useMemo(
    () => buildExecutionPrerequisites({
      candidate: selectedCandidate,
      archiveDestination,
      permanentRemovalConfirmed
    }),
    [selectedCandidate, archiveDestination, permanentRemovalConfirmed]
  );
  const canExportProof = Boolean(postRunProof.status === "matched" && proofReviewed && executionRecord?.accepted);
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
      setupRouteInput,
      archiveDestination,
      permanentRemovalConfirmed,
      agentPrompt
    }),
    [runtime, scanFingerprint, selectedCandidate, executionRecord, postRunProof, workflowProofAccepted, workflowProofCheck, supportBundleWritten, setupRouteInput, archiveDestination, permanentRemovalConfirmed, agentPrompt]
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
      confirmationText,
      expectedConfirmation,
      executionPrerequisites,
      scanFingerprint,
      executionStatus,
      workflowLocks,
      executionRecord,
      activeScanGeneratedAt: scan?.generatedAt || ""
    }),
    [selectedCandidate, consentChecked, confirmationText, expectedConfirmation, executionPrerequisites, scanFingerprint, executionStatus, workflowLocks, executionRecord, scan]
  );
  const canExecute = executionGate.ready;
  const targetSwitchLocked = workflowLocks.targetSwitchLocked;
  const routeSetupLocked = workflowLocks.routeSetupLocked;
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
    } catch (error) {
      setRuntime(null);
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime capability check failed.");
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
      if (afterExecution) {
        setPostRunScan(result);
        setProofReviewed(false);
        setWorkflowProofAccepted(false);
        setWorkflowProofCheck(null);
        setSupportBundleWrite(null);
        setProofExportStatus("idle");
        setProofExportMessage("");
      } else {
        setScan(result);
        setPostRunScan(null);
        setExecutionResult(null);
        setExecutionRecord(null);
        setSelectedId("");
        setConsentChecked(false);
        setConfirmationText("");
        setPermanentRemovalConfirmed(false);
        setProofReviewed(false);
        setWorkflowProofAccepted(false);
        setWorkflowProofCheck(null);
        setSupportBundleWrite(null);
        setProofExportStatus("idle");
        setProofExportMessage("");
      }
      setScanStatus("complete");
      await refreshRuntime();
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
      confirmationText,
      expectedConfirmation,
      executionPrerequisites,
      scanFingerprint,
      executionStatus,
      workflowLocks,
      executionRecord,
      activeScanGeneratedAt: scan?.generatedAt || ""
    });
    if (!currentExecutionGate.ready) {
      setExecutionStatus("error");
      setExecutionError(currentExecutionGate.primary);
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
      setProofReviewed(false);
      setExecutionStatus(result.accepted ? "complete" : "rejected");
    } catch (error) {
      setExecutionStatus("error");
      setExecutionError(error instanceof Error ? error.message : "Cleanup execution failed.");
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
        setConfirmationText("");
        setPermanentRemovalConfirmed(false);
        setArchiveDestination("");
      }
      setProofExportStatus("complete");
      setProofExportMessage(
        acceptedCheck.canAccept
          ? `Wrote ${selectedWrite.fileName || PROOF_PACKET_FILE}, ${workflowWrite.fileName || WORKFLOW_PROOF_FILE}, ${proofCheckWrite.fileName || WORKFLOW_PROOF_CHECK_FILE}, and ${supportWrite.fileName || SUPPORT_BUNDLE_FILE} into the runner working directory. Workflow proof accepted by in-app verifier. Support bundle captured.${baselinePromotion.canPromote ? " Post-run scan promoted as the active cleanup baseline." : ""}`
          : `Wrote ${selectedWrite.fileName || PROOF_PACKET_FILE}, ${workflowWrite.fileName || WORKFLOW_PROOF_FILE}, ${proofCheckWrite.fileName || WORKFLOW_PROOF_CHECK_FILE}, and ${supportWrite.fileName || SUPPORT_BUNDLE_FILE} into the runner working directory. Workflow proof blocked by in-app verifier: ${acceptedCheck.blockers.length} blocker(s).`
      );
    } catch (error) {
      setProofExportStatus("error");
      setProofExportMessage(error instanceof Error ? error.message : "Proof export failed.");
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
      >
        <ConnectionRequired
          runtime={runtime}
          runtimeStatus={runtimeStatus}
          runtimeError={runtimeError}
          onRefresh={refreshRuntime}
          routes={routeSetupOptions}
          selectedRouteInput={setupRouteInput}
          setSelectedRouteInput={setSetupRouteInput}
          checklist={setupChecklist}
          routeSetupLocked={routeSetupLocked}
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
    >
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-5 lg:px-7">
        <TopBar
          runtime={runtime}
          scan={scan}
          onRefreshRuntime={refreshRuntime}
        />
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <ScanPanel
            request={scanRequest}
            setRequest={setScanRequest}
            scan={scan}
            scanStatus={scanStatus}
            scanError={scanError}
            onRunScan={() => runRealScan()}
          />
          <div className="grid gap-5">
            <RuntimePanel runtime={runtime} />
            <RouteSetupPanel
              routes={routeSetupOptions}
              selectedRouteInput={setupRouteInput}
              setSelectedRouteInput={setSetupRouteInput}
              checklist={setupChecklist}
              routeSetupLocked={routeSetupLocked}
            />
          </div>
        </section>
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <CleanupQueue
            candidates={candidates}
            selectedId={selectedId}
            targetSwitchLocked={targetSwitchLocked}
            setSelectedId={(id) => {
              if (targetSwitchLocked && id !== selectedId) return;
              setSelectedId(id);
              setExecutionResult(null);
              setExecutionRecord(null);
              setPostRunScan(null);
              setExecutionStatus("idle");
              setExecutionError("");
              setArchiveDestination("");
              setConsentChecked(false);
              setConfirmationText("");
              setPermanentRemovalConfirmed(false);
              setProofReviewed(false);
              setWorkflowProofAccepted(false);
              setWorkflowProofCheck(null);
              setSupportBundleWrite(null);
              setProofExportStatus("idle");
              setProofExportMessage("");
            }}
            scan={scan}
          />
          <DecisionPanel
            candidate={selectedCandidate}
            consentChecked={consentChecked}
            setConsentChecked={setConsentChecked}
            confirmationText={confirmationText}
            setConfirmationText={setConfirmationText}
            expectedConfirmation={expectedConfirmation}
            permanentRemovalConfirmed={permanentRemovalConfirmed}
            setPermanentRemovalConfirmed={setPermanentRemovalConfirmed}
            archiveDestination={archiveDestination}
            setArchiveDestination={setArchiveDestination}
            executionPrerequisites={executionPrerequisites}
            canExecute={canExecute}
            executionStatus={executionStatus}
            executionError={executionError}
            executionResult={executionResult}
            onExecute={executeSelectedCleanup}
          />
        </section>
        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(380px,1.1fr)]">
          <ProofPanel
            selectedCandidate={selectedCandidate}
            executionRecord={executionRecord}
            postRunScan={postRunScan}
            postRunProof={postRunProof}
            scanStatus={scanStatus}
            proofReviewed={proofReviewed}
            setProofReviewed={setProofReviewed}
            workflowProofAccepted={workflowProofAccepted}
            workflowProofCheck={workflowProofCheck}
            workflowLocks={workflowLocks}
            canExportProof={canExportProof}
            proofExportStatus={proofExportStatus}
            proofExportMessage={proofExportMessage}
            onRescan={() => runRealScan({ afterExecution: true })}
            onExportProof={exportProofPacket}
          />
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
          />
        </section>
        <ManualReviewPanel findings={manualFindings} />
      </main>
    </AppFrame>
  );
}

function AppFrame({ children, runtime, runtimeStatus, nativeConnected, scan, selectedCandidate, executionRecord }) {
  const navRows = [
    { id: "connect", label: "Connection", icon: HardDrive, state: nativeConnected ? "ready" : runtimeStatus },
    { id: "scan", label: "Real scan", icon: ScanLine, state: scan ? "ready" : "waiting" },
    { id: "queue", label: "Queue", icon: ClipboardCheck, state: selectedCandidate ? "ready" : "waiting" },
    { id: "proof", label: "Proof", icon: FileJson, state: executionRecord ? "ready" : "waiting" }
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
                  <div key={row.id} className="flex items-center justify-between rounded-md px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {row.label}
                    </span>
                    <StatusDot state={row.state} />
                  </div>
                );
              })}
            </nav>
            <div className="mt-auto rounded-md border bg-muted/35 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Current route</p>
              <p className="mt-1 truncate">{selectedCandidate?.routeInput || "No route selected"}</p>
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

function ConnectionRequired({ runtime, runtimeStatus, runtimeError, onRefresh, routes, selectedRouteInput, setSelectedRouteInput, checklist, routeSetupLocked = false }) {
  const routeInput = selectedRouteInput || "npm-cache";
  const setupSteps = [
    {
      label: "Install project dependencies",
      command: "npm install",
      detail: "Run this from the SpaceGuard project folder on the Windows PC you want to clean."
    },
    {
      label: "Create the local .env file",
      command: "Copy-Item .env.example .env",
      detail: "Open .env in Notepad after copying it. This file is ignored by git."
    },
    {
      label: "Add your OpenAI key",
      command: "OPENAI_API_KEY=sk-...",
      detail: "The key powers advisory reasoning only. It cannot approve or execute cleanup."
    },
    {
      label: "Enable exactly one route",
      command: `npm run route:arm -- --route ${routeInput}`,
      detail: "This updates .env so one cleanup type is enabled and every other cleanup flag is off."
    },
    {
      label: "Check Windows readiness",
      command: `npm run windows:ready -- --route ${routeInput}`,
      detail: "This blocks early if npm dependencies, the Windows toolchain, route flag, or local route contract is not ready."
    },
    {
      label: "Launch the desktop app",
      command: `npm run windows:dev -- --route ${routeInput}`,
      detail: "This arms one route, checks readiness, and opens the Tauri desktop shell."
    },
    {
      label: "Run the real workflow",
      command: "Scan -> select -> consent -> execute -> rescan -> export proof",
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
    "Measured cleanup queue",
    "Explicit user consent",
    "Scoped native executor",
    "Post-run rescan",
    "Proof and support export"
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
              user consent, native cleanup, post-run rescan, and proof export.
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
            <RouteSetupPanel
              routes={routes}
              selectedRouteInput={selectedRouteInput}
              setSelectedRouteInput={setSelectedRouteInput}
              checklist={checklist}
              routeSetupLocked={routeSetupLocked}
            />
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
            {runtime?.realRunEnabled ? "single route armed" : "cleanup locked"}
          </Badge>
          <Badge variant={runtime?.openAiAdvisorConfigured ? "safe" : "outline"}>
            {runtime?.openAiAdvisorConfigured ? "OpenAI key detected" : "OpenAI key missing"}
          </Badge>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal">Real Windows cleanup workflow</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scan C: with the native bridge, select one measured target, consent, run the guarded executor, rescan, and export proof.
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
          Refresh runtime
        </Button>
      </div>
    </header>
  );
}

function RuntimePanel({ runtime }) {
  const flagRows = Object.entries(runtime?.executorFlags || {})
    .filter(([, enabled]) => enabled)
    .map(([flag]) => flag);
  const checks = [
    ["Windows", runtime?.windows],
    ["Native scan command", runtime?.scanKnownRoots],
    ["Executor command", runtime?.executeCleanupPlan],
    ["Single route scope", runtime?.executorScopeStatus === "single-scoped-flag"],
    ["OpenAI advisor", runtime?.openAiAgentAdvice && runtime?.openAiAdvisorConfigured]
  ];
  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Native runtime
        </CardTitle>
        <CardDescription>Current desktop bridge and route state.</CardDescription>
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
          <p className="text-sm font-medium">Enabled route flags</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {flagRows.length ? (
              flagRows.map((flag) => <Badge key={flag} variant="safe">{flag}</Badge>)
            ) : (
              <Badge variant="restricted">no route flag</Badge>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Real cleanup requires exactly one route flag, native scan evidence, explicit consent, and post-run proof.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function RouteSetupPanel({ routes, selectedRouteInput, setSelectedRouteInput, checklist, routeSetupLocked = false }) {
  const [copyStatus, setCopyStatus] = useState("idle");
  const [copyRunbookStatus, setCopyRunbookStatus] = useState("idle");
  const runbook = checklist.runbook || { commands: [], appSteps: [], guardrails: [], content: "" };
  const selectedRoute = routes.find((route) => route.routeInput === selectedRouteInput) || routes[0] || {};
  const blockerRows = checklist.blockers?.length ? checklist.blockers : checklist.steps.filter((step) => step.status === "blocked");

  useEffect(() => {
    setCopyStatus("idle");
    setCopyRunbookStatus("idle");
  }, [selectedRouteInput]);

  async function copyEnvBlock() {
    try {
      await navigator.clipboard.writeText(checklist.envBlock.content);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  async function copyRunbook() {
    try {
      await navigator.clipboard.writeText(checklist.runbook.content);
      setCopyRunbookStatus("copied");
    } catch {
      setCopyRunbookStatus("failed");
    }
  }

  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Terminal className="h-4 w-4" />
          Cleanup workflow setup
        </CardTitle>
        <CardDescription>Every cleanup type follows the same scan, review, consent, execute, rescan, and proof workflow.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {routeSetupLocked ? (
          <Notice
            tone="review"
            icon={Lock}
            text="Current route is locked until proof export and support bundle capture finish."
          />
        ) : null}
        <div className="rounded-md border bg-background p-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">Selected cleanup type</p>
              <p className="mt-1 truncate text-lg font-semibold">{selectedRoute.label || selectedRouteInput}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{selectedRoute.routeInput || selectedRouteInput}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={checklist.ready ? "safe" : "review"}>{checklist.ready ? "ready" : "needs setup"}</Badge>
              <Badge variant="outline">one workflow</Badge>
              <Badge variant="outline">one route flag</Badge>
            </div>
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Choose cleanup type</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {routes.map((route) => (
              <button
                key={route.routeInput}
                type="button"
                disabled={routeSetupLocked && route.routeInput !== selectedRouteInput}
                onClick={() => {
                  if (routeSetupLocked && route.routeInput !== selectedRouteInput) return;
                  setSelectedRouteInput(route.routeInput);
                }}
                className={`rounded-md border px-3 py-2 text-left text-sm transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-50 ${
                  selectedRouteInput === route.routeInput ? "border-primary bg-primary/5" : "bg-background"
                }`}
              >
                <span className="block truncate font-medium">{route.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{route.routeInput}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-md border bg-background">
          <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">Selected .env block</p>
              <p className="truncate text-xs text-muted-foreground">{checklist.envBlock.selectedEnvVar}=1</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={copyEnvBlock}>
              <ClipboardCheck className="h-4 w-4" />
              {copyStatus === "copied" ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className="max-h-72 overflow-auto p-3 text-xs leading-5">
            <code>{checklist.envBlock.content}</code>
          </pre>
          {copyStatus === "failed" ? (
            <p className="border-t px-3 py-2 text-xs text-red-600">Copy failed. Select the block manually.</p>
          ) : null}
        </div>
        <div className="rounded-md border bg-background p-3">
          <p className="text-sm font-medium">App workflow</p>
          <div className="mt-3 grid gap-2">
            {runbook.appSteps.map((row, index) => (
              <div key={row.id} className="flex gap-3 rounded-md border bg-muted/25 p-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border bg-background text-xs font-medium">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium">{row.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{row.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        {blockerRows.length ? (
          <div className="grid gap-2">
            {blockerRows.map((step) => (
              <div key={step.id} className="rounded-md border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{step.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{step.detail}</p>
                  </div>
                  <Badge variant="restricted">{step.status}</Badge>
                </div>
                <code className="mt-2 block overflow-hidden text-ellipsis rounded border bg-muted/50 px-2 py-1 text-xs">
                  {step.command}
                </code>
              </div>
            ))}
          </div>
        ) : null}
        <details className="rounded-md border bg-background">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Windows test runbook</summary>
          <div className="border-t">
            <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">Command checklist</p>
                <p className="truncate text-xs text-muted-foreground">
                  Includes npm run openai:smoke -- --local-contract --route before desktop launch.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={copyRunbook}>
                <ClipboardCheck className="h-4 w-4" />
                {copyRunbookStatus === "copied" ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="max-h-[24rem] overflow-auto p-3">
              <div className="grid gap-2">
                {runbook.commands.map((row, index) => (
                  <div key={row.id} className="rounded-md border bg-muted/25 p-2">
                    <div className="flex items-start gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border bg-background text-xs font-medium">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">{row.label}</p>
                        <code className="mt-1 block overflow-hidden text-ellipsis rounded border bg-background px-2 py-1 text-xs">
                          {row.command}
                        </code>
                        <p className="mt-1 text-xs text-muted-foreground">{row.expected}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-md border bg-muted/20 p-3">
                <p className="text-xs font-medium">Guardrails</p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {runbook.guardrails.map((row) => (
                    <li key={row.id}>{row.detail}</li>
                  ))}
                </ul>
              </div>
              {copyRunbookStatus === "failed" ? (
                <p className="mt-3 text-xs text-red-600">Copy failed. Select the runbook manually.</p>
              ) : null}
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function ScanPanel({ request, setRequest, scan, scanStatus, scanError, onRunScan }) {
  const running = scanStatus === "scanning" || scanStatus === "rescanning";
  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderSearch className="h-4 w-4" />
          Real scan
        </CardTitle>
        <CardDescription>Read-only Windows scan settings. No cleanup runs from this panel.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Target drive</span>
            <Input value={request.targetDrive} onChange={(event) => setRequest({ ...request, targetDrive: event.target.value })} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Depth</span>
            <Input type="number" value={request.maxDepth} onChange={(event) => setRequest({ ...request, maxDepth: Number(event.target.value || 8) })} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Entry cap</span>
            <Input type="number" value={request.maxEntriesPerRoot} onChange={(event) => setRequest({ ...request, maxEntriesPerRoot: Number(event.target.value || 25000) })} />
          </label>
          <div className="flex items-end">
            <Button className="w-full" onClick={onRunScan} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
              Run real scan
            </Button>
          </div>
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

function CleanupQueue({ candidates, selectedId, setSelectedId, scan, targetSwitchLocked = false }) {
  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-4 w-4" />
          Real cleanup queue
        </CardTitle>
        <CardDescription>Only measured native findings can become cleanup targets.</CardDescription>
      </CardHeader>
      <CardContent>
        {!scan ? (
          <EmptyState icon={ScanLine} title="Run real scan first" detail="The queue is built only from native scan findings." />
        ) : candidates.length ? (
          <div className="grid gap-3">
            {targetSwitchLocked ? (
              <Notice tone="review" icon={Lock} text="Export proof, let the in-app verifier accept it, and capture the support bundle before selecting another cleanup target." />
            ) : null}
            {candidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                disabled={targetSwitchLocked && candidate.id !== selectedId}
                onClick={() => setSelectedId(candidate.id)}
                className={`w-full rounded-md border p-4 text-left transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-50 ${
                  selectedId === candidate.id ? "border-primary bg-primary/5" : "bg-background"
                }`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={candidate.risk}>{candidate.risk}</Badge>
                      <Badge variant={candidate.canExecute ? "safe" : candidate.executable ? "review" : "outline"}>
                        {candidate.canExecute ? "ready" : candidate.executable ? "blocked" : "manual"}
                      </Badge>
                      <span className="font-medium">{candidate.title}</span>
                    </div>
                    <p className="mt-2 truncate text-sm text-muted-foreground">{candidate.targetPath || candidate.targetKind}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{candidate.consequence}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-semibold">{formatBytes(candidate.bytes)}</p>
                    <p className="text-xs text-muted-foreground">{candidate.routeInput}</p>
                  </div>
                </div>
                {!candidate.canExecute ? (
                  <div className="mt-3 space-y-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <p>{candidate.blockedReason}</p>
                    <RouteReadinessList rows={candidate.readinessRows} compact />
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        ) : (
          <EmptyState icon={Lock} title="No executable findings yet" detail="Measured findings were not found or their route flags are not enabled." />
        )}
      </CardContent>
    </Card>
  );
}

function DecisionPanel({
  candidate,
  consentChecked,
  setConsentChecked,
  confirmationText,
  setConfirmationText,
  expectedConfirmation,
  permanentRemovalConfirmed,
  setPermanentRemovalConfirmed,
  archiveDestination,
  setArchiveDestination,
  executionPrerequisites,
  canExecute,
  executionStatus,
  executionError,
  executionResult,
  onExecute
}) {
  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" />
          User gate
        </CardTitle>
        <CardDescription>Every real cleanup requires explicit current-plan consent.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!candidate ? (
          <EmptyState icon={ChevronRight} title="Select a cleanup target" detail="Pick one measured row from the queue to continue." />
        ) : (
          <>
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-sm font-medium">{candidate.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{candidate.targetPath}</p>
              <p className="mt-2 text-sm">{candidate.consequence}</p>
            </div>
            <RouteReadinessList rows={candidate.readinessRows} />
            {executionPrerequisites?.rows?.length ? (
              <RouteReadinessList rows={executionPrerequisites.rows} title="Execution prerequisites" />
            ) : null}
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={consentChecked} onClick={() => setConsentChecked(!consentChecked)} />
              <span>I reviewed the target, expected bytes, route flag, and consequence for this cleanup.</span>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Type the confirmation phrase</span>
              <Input
                value={confirmationText}
                onChange={(event) => setConfirmationText(event.target.value)}
                placeholder={expectedConfirmation}
              />
            </label>
            {candidate.requiresPermanentConfirmation ? (
              <label className="flex items-start gap-3 text-sm">
                <Checkbox checked={permanentRemovalConfirmed} onClick={() => setPermanentRemovalConfirmed(!permanentRemovalConfirmed)} />
                <span>I understand this permanently empties Recycle Bin contents for the selected drive.</span>
              </label>
            ) : null}
            {candidate.requiresArchiveDestination ? (
              <label className="space-y-1 text-sm">
                <span className="font-medium">Archive destination</span>
                <Input value={archiveDestination} onChange={(event) => setArchiveDestination(event.target.value)} placeholder="D:\\Archives" />
              </label>
            ) : null}
            <Button className="w-full" disabled={!canExecute} onClick={onExecute}>
              {executionStatus === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Execute selected cleanup
            </Button>
            {executionError ? <Notice tone="restricted" icon={AlertTriangle} text={executionError} /> : null}
            {executionResult ? (
              <div className="space-y-3 rounded-md border bg-background p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{executionResult.accepted ? "Native executor accepted" : "Native executor rejected"}</span>
                  <Badge variant={executionResult.accepted ? "safe" : "restricted"}>{executionResult.mode}</Badge>
                </div>
                <p className="text-muted-foreground">{executionResult.reason}</p>
                <div className="grid gap-2 md:grid-cols-3">
                  <Metric label="Recovered" value={formatBytes(totalEntryBytes(executionResult.entries))} />
                  <Metric label="Volume proof" value={formatVolumeProofStatus(executionResult.volumeProof)} />
                  <Metric label="Free-space delta" value={formatSignedBytes(executionResult.volumeProof?.freeBytesDelta || 0)} />
                </div>
                {executionResult.accepted && !volumeProofMeasured(executionResult.volumeProof) ? (
                  <Notice tone="restricted" icon={AlertTriangle} text="Native volume proof missing. Export can capture the blocker, but the workflow verifier will not clear the next route until measured volume proof exists." />
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RouteReadinessList({ rows = [], compact = false, title = "Route readiness" }) {
  const visibleRows = compact ? rows.filter((row) => !row.passed).slice(0, 3) : rows;
  if (!visibleRows.length) return null;
  return (
    <div className="space-y-2 rounded-md border bg-background p-3">
      {!compact ? <p className="text-sm font-medium">{title}</p> : null}
      <div className={compact ? "flex flex-wrap gap-2" : "grid gap-2"}>
        {visibleRows.map((row) => (
          <div key={row.id} className={compact ? "flex items-center gap-1 rounded border px-2 py-1" : "flex items-start justify-between gap-3 rounded border px-3 py-2"}>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{row.label}</p>
              {!compact ? <p className="mt-0.5 text-xs text-muted-foreground">{row.detail}</p> : null}
            </div>
            <Badge variant={row.passed ? "safe" : row.status === "not-required" ? "outline" : "restricted"}>{row.status}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProofPanel({
  selectedCandidate,
  executionRecord,
  postRunScan,
  postRunProof,
  scanStatus,
  proofReviewed,
  setProofReviewed,
  workflowProofAccepted,
  workflowProofCheck,
  workflowLocks,
  canExportProof,
  proofExportStatus,
  proofExportMessage,
  onRescan,
  onExportProof
}) {
  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileJson className="h-4 w-4" />
          Post-run proof
        </CardTitle>
        <CardDescription>Run a newer native scan before another route is trusted.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!executionRecord ? (
          <EmptyState icon={Lock} title="Execution required" detail="Proof export stays locked until a native executor returns a ledger." />
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <Metric label="Route" value={selectedCandidate?.routeInput || executionRecord.routeInput} />
              <Metric label="Recovered" value={formatBytes(executionRecord.bytes)} />
              <Metric label="Volume proof" value={formatVolumeProofStatus(executionRecord.volumeProof)} />
              <Metric label="Rescan state" value={postRunProof.status} />
            </div>
            {executionRecord.accepted && !volumeProofMeasured(executionRecord.volumeProof) ? (
              <Notice tone="restricted" icon={AlertTriangle} text="Native volume proof is missing. Run post-run rescan and export proof to capture the blocker; do not enable another route until the verifier accepts the workflow proof." />
            ) : null}
            {workflowLocks?.noOpExecution ? (
              <Notice tone="review" icon={AlertTriangle} text={workflowLocks.primary} />
            ) : null}
            <Button variant="outline" className="w-full" onClick={onRescan} disabled={scanStatus === "rescanning"}>
              {scanStatus === "rescanning" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Run post-run rescan
            </Button>
            {postRunScan ? (
              <div className="space-y-3 rounded-md border bg-background p-3 text-sm">
                <div>
                  <p className="font-medium">{postRunProof.status === "matched" ? "Rescan matched the ledger" : "Rescan still needs review"}</p>
                  <p className="mt-1 text-muted-foreground">{postRunProof.detail}</p>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <Metric label="Proof target" value={postRunProof.targetEvidence?.kind === "item" ? "selected item" : "scanned finding"} />
                  <Metric label="Observed bytes" value={formatBytes(postRunProof.actualBytes)} />
                  <Metric label="Expected remaining" value={formatBytes(postRunProof.expectedRemaining)} />
                </div>
              </div>
            ) : null}
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={proofReviewed} onClick={() => setProofReviewed(!proofReviewed)} />
              <span>I reviewed the post-run scan, native ledger, and proof packet before export.</span>
            </label>
            <Button className="w-full" disabled={!canExportProof || proofExportStatus === "running"} onClick={onExportProof}>
              {proofExportStatus === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export proof packet
            </Button>
            {proofExportMessage ? (
              <Notice
                tone={proofExportStatus === "error" || (workflowProofCheck && !workflowProofCheck.canAccept) ? "restricted" : "safe"}
                icon={proofExportStatus === "error" || (workflowProofCheck && !workflowProofCheck.canAccept) ? AlertTriangle : CheckCircle2}
                text={proofExportMessage}
              />
            ) : null}
            {workflowProofCheck ? (
              <div className="space-y-2 rounded-md border bg-background p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">Workflow proof verifier</span>
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
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function OpenAIPanel({ runtime, scan, candidates, manualFindings = [], selectedCandidate, prompt, setPrompt, status, error, advice, agentBroker, onAsk }) {
  const visibleTargets = Number(candidates?.length || 0) + Number(manualFindings?.length || 0);
  const canAsk = Boolean(runtime?.openAiAgentAdvice && runtime?.openAiAdvisorConfigured && scan && visibleTargets);
  const assistant = advice?.advice;
  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-4 w-4" />
          OpenAI cleanup agent
        </CardTitle>
        <CardDescription>Advisory only. The model cannot approve, execute, or change files.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        <Button className="w-full" disabled={!canAsk || status === "running"} onClick={onAsk}>
          {status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Ask OpenAI for next cleanup step
        </Button>
        {!canAsk ? (
          <Notice
            tone="review"
            icon={AlertTriangle}
            text="Set OPENAI_API_KEY in .env, start the desktop shell, and run a real scan with cleanup or manual review findings before asking the advisor."
          />
        ) : null}
        {error ? <Notice tone="restricted" icon={AlertTriangle} text={error} /> : null}
        {assistant ? (
          <div className="space-y-3 rounded-md border bg-background p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="safe">{assistant.confidence}</Badge>
              <span className="font-medium">{assistant.nextAction}</span>
            </div>
            <p className="text-muted-foreground">{assistant.summary}</p>
            <div className="grid gap-2">
              {assistant.recommendedActions.slice(0, 3).map((row) => (
                <div key={row.id} className="rounded-md border bg-muted/25 p-2">
                  <p className="font-medium">{row.title}</p>
                  <p className="text-xs text-muted-foreground">{row.reason}</p>
                </div>
              ))}
            </div>
            {selectedCandidate ? (
              <p className="text-xs text-muted-foreground">Selected UI target remains {selectedCandidate.title}; model advice cannot change consent.</p>
            ) : null}
          </div>
        ) : null}
        {agentBroker ? (
          <div className="space-y-3 rounded-md border bg-background p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">Recommendation broker</p>
              <Badge variant={agentBroker.status === "broker-ready" ? "safe" : "review"}>{agentBroker.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{agentBroker.primary}</p>
            <div className="grid gap-2">
              {agentBroker.rows.slice(0, 4).map((row) => (
                <div key={row.key} className="rounded-md border bg-muted/25 p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={row.canAct ? "safe" : row.status === "manual-only" ? "outline" : "restricted"}>
                      {row.status}
                    </Badge>
                    <p className="text-xs font-medium">{row.actionType}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.targetPanel} · {row.route || "manual"}
                  </p>
                  {row.blockedReason ? (
                    <p className="mt-1 text-xs text-red-600">{row.blockedReason}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ManualReviewPanel({ findings }) {
  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-4 w-4" />
          Manual review findings
        </CardTitle>
        <CardDescription>These scan rows are visible for decisions, but no executor is created from them.</CardDescription>
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
                    <p className="text-xs font-medium">Recommended safe action</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{finding.manualGuidance.primaryAction}</p>
                  <code className="mt-2 block overflow-hidden text-ellipsis rounded border bg-background px-2 py-1 text-xs">
                    {finding.manualGuidance.command}
                  </code>
                </div>
                <div className="mt-3">
                  <p className="text-xs font-medium">Blocked actions</p>
                  <ul className="mt-1 space-y-1">
                    {finding.manualGuidance.blockedActions.slice(0, 3).map((action) => (
                      <li key={action} className="flex gap-2 text-xs text-muted-foreground">
                        <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {finding.reviewRows.rows.length ? (
                  <div className="mt-3 rounded-md border bg-background">
                    <div className="border-b px-2 py-2">
                      <p className="text-xs font-medium">Review candidates</p>
                    </div>
                    <div className="divide-y">
                      {finding.reviewRows.rows.slice(0, 3).map((row) => (
                        <div key={row.id || row.path} className="p-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium">{row.name}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">{formatBytes(row.bytes)}</p>
                            </div>
                            <Badge variant={row.action === "keep-installed" ? "safe" : "review"}>{row.actionLabel}</Badge>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.reason}</p>
                          <p className="mt-2 text-xs font-medium">Usage evidence</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {row.signals.slice(0, 4).map((signal) => (
                              <Badge key={`${row.id}-${signal.label}-${signal.value}`} variant={signal.tone === "safe" ? "safe" : signal.tone === "restricted" ? "restricted" : "outline"}>
                                {signal.label}: {signal.value}
                              </Badge>
                            ))}
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">{row.blockedAction}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={HardDrive} title="No manual findings loaded" detail="Run a scan to show installed-app, broad inventory, and custom-root review rows." />
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

function buildCleanupCandidates(scan, runtime, selectedRouteInput = "") {
  if (!scan?.findings?.length) return [];
  const rows = [];
  for (const finding of scan.findings) {
    const rootRecipe = EXECUTOR_RECIPES[finding.recipeId];
    if (rootRecipe) {
      rows.push(buildCandidateFromFinding(finding, rootRecipe, runtime, selectedRouteInput));
      continue;
    }
    const itemRecipe = ITEM_REVIEW_RECIPES[finding.recipeId];
    if (itemRecipe) {
      rows.push(...buildItemCandidates(finding, itemRecipe, runtime, { selectedRouteInput }));
      continue;
    }
    if (finding.recipeId === "large-user-files") {
      rows.push(...buildItemCandidates(finding, ARCHIVE_RECIPE, runtime, { archive: true, selectedRouteInput }));
    }
  }
  return rows
    .filter((row) => row.bytes > 0 || row.executor === "dockerBuildCache" || row.executor === "recycleBin")
    .sort((left, right) => Number(right.canExecute) - Number(left.canExecute) || right.bytes - left.bytes);
}

function buildRouteSetupOptions() {
  const routeMap = new Map();
  for (const recipe of [
    ...Object.values(EXECUTOR_RECIPES),
    ...Object.values(ITEM_REVIEW_RECIPES),
    ARCHIVE_RECIPE
  ]) {
    if (!recipe.routeInput || routeMap.has(recipe.routeInput)) continue;
    routeMap.set(recipe.routeInput, {
      label: recipe.label,
      route: recipe.route,
      routeInput: recipe.routeInput,
      flagKey: recipe.flagKey,
      envVar: recipe.envVar
    });
  }
  return Array.from(routeMap.values()).sort((left, right) => left.label.localeCompare(right.label));
}

function buildCandidateFromFinding(finding, recipe, runtime, selectedRouteInput = "") {
  const status = buildRouteReadiness({ recipe, finding, runtime, selectedRouteInput });
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
      const status = buildRouteReadiness({ recipe, finding, runtime, selectedRouteInput: options.selectedRouteInput || "" });
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
  const base = candidate.routeInput || candidate.actionType || candidate.route || candidate.recipeId || "cleanup-target";
  return `${slugifyId(base)}-${index + 1}`;
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
  setupRouteInput = "",
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
    setupRouteInput || "route-missing",
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

function formatShortDate(value = "") {
  if (!value) return "not run";
  const timestamp = parseWorkflowTimestamp(value);
  if (!Number.isFinite(timestamp)) return value;
  const date = new Date(timestamp);
  return date.toLocaleString();
}

export default App;
