import { buildRouteNativeBoundary } from "./route-boundary-contracts.mjs";

const DEFAULT_OPENAI_MODEL = "gpt-5.2";
const DEFAULT_OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_PROXY_ENDPOINT = "/api/openai-agent/advice";
const DEFAULT_OPENAI_REASONING_EFFORT = "low";
const NATIVE_OPENAI_AGENT_COMMAND = "openai_agent_advice";
const OPENAI_AGENT_RESPONSE_FORMAT = {
  type: "json_schema",
  name: "spaceguard_cleanup_agent_advice",
  description: "A bounded cleanup advisor response for SpaceGuard. It recommends UI-mediated cleanup actions without tool authority.",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "nextAction", "confidence", "recommendedActions", "blockedActions", "questions", "warnings"],
    properties: {
      summary: { type: "string" },
      nextAction: { type: "string" },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      recommendedActions: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "title", "reason", "priority", "actionType", "targetId", "route"],
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            reason: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
            actionType: {
              type: "string",
              enum: ["select-action", "review-target", "run-temp-executor", "run-downloads-cleanup-executor", "run-large-file-archive-executor", "run-project-deps-executor", "run-browser-cache-executor", "run-gradle-cache-executor", "run-user-cache-executor", "run-android-cache-executor", "run-shader-cache-executor", "run-pip-cache-executor", "run-docker-build-cache-executor", "run-npm-cache-executor", "run-pnpm-store-executor", "run-recycle-bin-executor", "rescan", "ask-user", "manual-only"]
            },
            targetId: { type: "string" },
            route: { type: "string" }
          }
        }
      },
      blockedActions: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "title", "reason", "priority", "actionType", "targetId", "route"],
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            reason: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
            actionType: {
              type: "string",
              enum: ["select-action", "review-target", "run-temp-executor", "run-downloads-cleanup-executor", "run-large-file-archive-executor", "run-project-deps-executor", "run-browser-cache-executor", "run-gradle-cache-executor", "run-user-cache-executor", "run-android-cache-executor", "run-shader-cache-executor", "run-pip-cache-executor", "run-docker-build-cache-executor", "run-npm-cache-executor", "run-pnpm-store-executor", "run-recycle-bin-executor", "rescan", "ask-user", "manual-only"]
            },
            targetId: { type: "string" },
            route: { type: "string" }
          }
        }
      },
      questions: { type: "array", maxItems: 6, items: { type: "string" } },
      warnings: { type: "array", maxItems: 6, items: { type: "string" } }
    }
  }
};

export function getOpenAIAgentConfig(env = import.meta.env || {}) {
  const apiKey = String(env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY || "").trim();
  const model = String(env.OPENAI_MODEL || env.VITE_OPENAI_MODEL || DEFAULT_OPENAI_MODEL).trim() || DEFAULT_OPENAI_MODEL;
  const endpoint = String(env.OPENAI_BASE_URL || env.VITE_OPENAI_BASE_URL || DEFAULT_OPENAI_ENDPOINT).trim() || DEFAULT_OPENAI_ENDPOINT;
  const localProxyEndpoint = String(env.OPENAI_AGENT_PROXY_URL || env.VITE_OPENAI_AGENT_PROXY_URL || DEFAULT_OPENAI_PROXY_ENDPOINT).trim() || DEFAULT_OPENAI_PROXY_ENDPOINT;
  const localProxyConfigured = !apiKey && Boolean(env.DEV || env.SPACEGUARD_OPENAI_PROXY === "1" || env.VITE_SPACEGUARD_OPENAI_PROXY === "1");
  const reasoningEffort = normalizeReasoningEffort(env.OPENAI_REASONING_EFFORT || env.VITE_OPENAI_REASONING_EFFORT || DEFAULT_OPENAI_REASONING_EFFORT);
  const keySource = apiKey ? (env.OPENAI_API_KEY ? "OPENAI_API_KEY" : "VITE_OPENAI_API_KEY") : localProxyConfigured ? "server:.env" : "missing";

  return {
    provider: "openai",
    connected: Boolean(apiKey || localProxyConfigured),
    configured: Boolean(apiKey || localProxyConfigured),
    apiKey,
    model,
    endpoint,
    localProxyEndpoint,
    localProxyConfigured,
    keySource,
    reasoningEffort,
    advisoryOnly: true,
    directToolAccess: false
  };
}

export function getNativeOpenAIAgentCapability(host = globalThis) {
  const invoke = host?.__TAURI__?.core?.invoke;
  return {
    available: typeof invoke === "function",
    command: NATIVE_OPENAI_AGENT_COMMAND,
    transport: typeof invoke === "function" ? "native-tauri" : "browser-fetch"
  };
}

export function buildOpenAIAgentContext({
  profile,
  scanMode,
  scanSession,
  actionList = [],
  selectedIds = new Set(),
  readiness,
  runReadiness,
  dryRunLaunchGuard,
  safetyInterlock,
  candidateSafetyManifest,
  nativeEvidenceQuality,
  storagePressureDiagnosis,
  executorPlan,
  nativeScan,
  runtimeCapabilities,
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
  planSnapshot,
  liveValidationManifest,
  scopedExecutorCommandFlow
} = {}) {
  const selected = actionList
    .filter((action) => selectedIds.has(action.id))
    .map(toAgentAction)
    .slice(0, 16);
  const topFindings = [...actionList]
    .sort((left, right) => Number(right.bytes || 0) - Number(left.bytes || 0))
    .slice(0, 16)
    .map(toAgentAction);
  const executableRows = (executorPlan?.rows || [])
    .filter((row) => row.canSimulate || row.canExecute)
    .slice(0, 12)
    .map((row) => ({
      id: row.id,
      title: row.title,
      route: row.route,
      bytes: Number(row.bytes || 0),
      targetPath: row.targetPath || row.target || row.path || "",
      canExecute: Boolean(row.canExecute),
      canSimulate: Boolean(row.canSimulate)
    }));
  const reviewedProjectTargets = (executorPlan?.rows || [])
    .filter((row) => row.route === "item-review-project-cache" && Array.isArray(row.reviewTargets))
    .flatMap((row) =>
      row.reviewTargets.map((target) => ({
        id: target.id || row.id,
        name: target.name || row.title,
        route: row.route,
        path: target.path || "",
        bytes: Number(target.bytes || 0),
        ageDays: Number(target.ageDays || 0),
        kind: target.kind || "project dependency folder",
        reason: target.reason || "",
        signals: normalizeAgentReviewSignals(target.signals)
      }))
    )
    .slice(0, 16);
  const reviewedDownloadsTargets = (executorPlan?.rows || [])
    .filter((row) => row.route === "item-review-recycle-bin" && Array.isArray(row.reviewTargets))
    .flatMap((row) =>
      row.reviewTargets.map((target) => ({
        id: target.id || row.id,
        name: target.name || row.title,
        route: row.route,
        path: target.path || "",
        bytes: Number(target.bytes || 0),
        ageDays: Number(target.ageDays || 0),
        kind: target.kind || "reviewed Downloads file",
        reason: target.reason || "",
        signals: normalizeAgentReviewSignals(target.signals)
      }))
    )
    .slice(0, 16);
  const largeFileArchiveTargets = (executorPlan?.rows || [])
    .filter((row) => row.route === "item-review-large-files" && Array.isArray(row.archiveTargets))
    .flatMap((row) =>
      row.archiveTargets.map((target) => ({
        id: target.id || row.id,
        name: target.name || row.title,
        route: row.route,
        path: target.path || "",
        bytes: Number(target.bytes || 0),
        ageDays: Number(target.ageDays || 0),
        kind: target.kind || "large user file",
        decision: target.decision || "archive",
        reason: target.reason || "",
        signals: normalizeAgentReviewSignals(target.signals)
      }))
    )
    .slice(0, 16);
  const browserCacheTargets = (nativeScan?.findings || [])
    .filter((finding) => finding.recipeId === "browser-cache")
    .filter((finding) => (finding.status === "measured" || finding.status === "limited") && finding.path)
    .map((finding, index) => ({
      id: `browser-cache-${index + 1}`,
      title: finding.title || "Browser cache root",
      route: "browser-cache-only",
      path: finding.path,
      bytes: Number(finding.bytes || 0),
      status: finding.status || "unknown"
    }))
    .slice(0, 16);
  const gradleCacheTargets = (nativeScan?.findings || [])
    .filter((finding) => finding.recipeId === "gradle-cache")
    .filter((finding) => (finding.status === "measured" || finding.status === "limited") && finding.path)
    .map((finding) => ({
      id: "gradle-cache",
      title: finding.title || "Gradle dependency and build cache",
      route: "bounded-cache-delete",
      path: finding.path,
      bytes: Number(finding.bytes || 0),
      status: finding.status || "unknown"
    }))
    .slice(0, 1);
  const npmCacheTargets = (nativeScan?.findings || [])
    .filter((finding) => finding.recipeId === "npm-cache")
    .filter((finding) => (finding.status === "measured" || finding.status === "limited") && finding.path)
    .map((finding) => ({
      id: "npm-cache",
      title: finding.title || "npm package cache",
      route: "bounded-npm-cache-delete",
      path: finding.path,
      bytes: Number(finding.bytes || 0),
      status: finding.status || "unknown"
    }))
    .slice(0, 1);
  const userCacheTargets = (nativeScan?.findings || [])
    .filter((finding) => finding.recipeId === "user-cache")
    .filter((finding) => (finding.status === "measured" || finding.status === "limited") && finding.path)
    .map((finding) => ({
      id: "user-cache",
      title: finding.title || "User .cache folder",
      route: "bounded-user-cache-delete",
      path: finding.path,
      bytes: Number(finding.bytes || 0),
      status: finding.status || "unknown"
    }))
    .slice(0, 1);
  const androidCacheTargets = (nativeScan?.findings || [])
    .filter((finding) => finding.recipeId === "android-cache")
    .filter((finding) => (finding.status === "measured" || finding.status === "limited") && finding.path)
    .map((finding, index) => ({
      id: `android-cache-${index + 1}`,
      title: finding.title || "Android Studio cache folder",
      route: "bounded-android-cache-delete",
      path: finding.path,
      bytes: Number(finding.bytes || 0),
      status: finding.status || "unknown"
    }))
    .slice(0, 8);
  const shaderCacheTargets = (nativeScan?.findings || [])
    .filter((finding) => finding.recipeId === "steam-shader-cache")
    .filter((finding) => (finding.status === "measured" || finding.status === "limited") && finding.path)
    .map((finding, index) => ({
      id: `shader-cache-${index + 1}`,
      title: finding.title || "Graphics shader cache folder",
      route: "launcher-cache-cleanup",
      path: finding.path,
      bytes: Number(finding.bytes || 0),
      status: finding.status || "unknown"
    }))
    .slice(0, 8);
  const pipCacheTargets = (nativeScan?.findings || [])
    .filter((finding) => finding.recipeId === "pip-cache")
    .filter((finding) => (finding.status === "measured" || finding.status === "limited") && finding.path)
    .map((finding) => ({
      id: "pip-cache",
      title: finding.title || "pip package cache",
      route: "bounded-pip-cache-delete",
      path: finding.path,
      bytes: Number(finding.bytes || 0),
      status: finding.status || "unknown"
    }))
    .slice(0, 1);
  const dockerBuildCacheTargets = (nativeScan?.findings || [])
    .filter((finding) => finding.recipeId === "docker-build-cache")
    .filter((finding) => (finding.status === "measured" || finding.status === "limited") && finding.path)
    .map((finding) => ({
      id: "docker-build-cache",
      title: finding.title || "Docker build cache",
      route: "tool-native-docker-build-cache-prune",
      path: finding.path,
      bytes: Number(finding.bytes || 0),
      status: finding.status || "unknown"
    }))
    .slice(0, 1);
  const pnpmStoreTargets = (nativeScan?.findings || [])
    .filter((finding) => finding.recipeId === "pnpm-store")
    .filter((finding) => (finding.status === "measured" || finding.status === "limited") && finding.path)
    .map((finding) => ({
      id: "pnpm-store",
      title: finding.title || "pnpm global store",
      route: "bounded-pnpm-store-delete",
      path: finding.path,
      bytes: Number(finding.bytes || 0),
      status: finding.status || "unknown"
    }))
    .slice(0, 1);
  const recycleBinTargets = (nativeScan?.findings || [])
    .filter((finding) => finding.recipeId === "recycle-bin")
    .filter((finding) => (finding.status === "measured" || finding.status === "limited") && finding.path)
    .map((finding) => ({
      id: "recycle-bin",
      title: finding.title || "Recycle Bin",
      route: "shell-recycle-bin",
      path: finding.path,
      bytes: Number(finding.bytes || 0),
      status: finding.status || "unknown",
      consequence: "permanent removal"
    }))
    .slice(0, 1);
  const wslVhdxTargets = (nativeScan?.findings || [])
    .filter((finding) => finding.recipeId === "wsl-vhdx")
    .filter((finding) => (finding.status === "measured" || finding.status === "limited") && finding.path)
    .map((finding, index) => ({
      id: `wsl-vhdx-${index + 1}`,
      title: finding.title || "WSL virtual disk",
      route: "advanced-checklist",
      path: finding.path,
      bytes: Number(finding.bytes || 0),
      status: finding.status || "unknown",
      manualOnly: true,
      canCreateExecutor: false
    }))
    .slice(0, 12);
  const projectDependencyReviewTargets = buildProjectDependencyReviewTargets({ nativeScan, itemReviewsByAction });
  const manualReviewTargets = buildManualReviewTargets({ nativeScan, itemReviewsByAction });
  const installedAppEvidenceSummary = buildInstalledAppEvidenceSummaryContext({
    nativeScan,
    itemReviewsByAction,
    manualReviewTargets
  });
  const installedAppReview = buildInstalledAppReviewContext(manualReviewTargets, installedAppEvidenceSummary);
  const installedAppUninstallWorkOrder = buildInstalledAppUninstallWorkOrderContext(installedAppReview, {
    planId: planSnapshot?.id || "",
    scanFingerprint: scanSession?.currentFingerprint || "",
    rescanComparisonStatus: rescanComparison?.status || "not-run"
  });
  const wslCompactionWorkOrder = buildWslCompactionWorkOrderContext(wslVhdxTargets, {
    selected: selectedIds?.has?.("wsl-vhdx") || false,
    typedConfirmed: approvals?.typed?.["wsl-vhdx"] === "COMPACT WSL",
    planId: planSnapshot?.id || "",
    scanFingerprint: scanSession?.currentFingerprint || "",
    rescanComparisonStatus: rescanComparison?.status || "not-run"
  });
  const driveInventoryRows = (driveInventorySummary?.topRows || driveInventorySummary?.rows || [])
    .slice(0, 8)
    .map((row) => ({
      id: row.id || "",
      name: row.name || "",
      path: row.path || "",
      bytes: Number(row.bytes || 0),
      status: row.status || "unknown",
      classification: row.classification || "unknown-review",
      canCreateExecutor: false,
      manualOnly: true,
      nextStep: row.nextStep || "Review this drive bucket manually before acting."
    }));
  const customRootRows = (customRootTriage?.rows || [])
    .slice(0, 8)
    .map((row) => ({
      id: row.id || "",
      title: row.title || "",
      path: row.path || "",
      bytes: Number(row.bytes || 0),
      status: row.status || "unknown",
      disposition: row.disposition || "undecided",
      canCreateExecutor: false,
      manualOnly: true,
      nextStep: row.nextStep || "Choose a manual disposition; no executor route is available."
    }));
  const nativeEnabledScopedExecutorFlags = Array.isArray(runtimeCapabilities?.enabledScopedExecutorFlags)
    ? runtimeCapabilities.enabledScopedExecutorFlags.filter(Boolean)
    : null;
  const enabledScopedExecutorFlags = nativeEnabledScopedExecutorFlags || getOpenAIEnabledScopedExecutorFlags(runtimeCapabilities?.executorFlags || {});
  const enabledScopedExecutorFlagCount = Number(runtimeCapabilities?.enabledScopedExecutorFlagCount ?? enabledScopedExecutorFlags.length);
  const runtimeSummary = {
    nativeAvailable: Boolean(runtimeCapabilities?.available),
    windows: Boolean(runtimeCapabilities?.windows),
    realRunEnabled: Boolean(runtimeCapabilities?.realRunEnabled),
    destructiveCommands: Boolean(runtimeCapabilities?.destructiveCommands),
    executorScopeStatus:
      runtimeCapabilities?.executorScopeStatus ||
      (enabledScopedExecutorFlagCount > 1 ? "multiple-scoped-flags" : enabledScopedExecutorFlagCount === 1 ? "single-scoped-flag" : "no-scoped-flags"),
    tempCleanupExecutor: Boolean(runtimeCapabilities?.executorFlags?.tempCleanupExecutor),
    downloadsCleanupExecutor: Boolean(runtimeCapabilities?.executorFlags?.downloadsCleanupExecutor),
    largeFileArchiveExecutor: Boolean(runtimeCapabilities?.executorFlags?.largeFileArchiveExecutor),
    projectDependencyExecutor: Boolean(runtimeCapabilities?.executorFlags?.projectDependencyExecutor),
    browserCacheExecutor: Boolean(runtimeCapabilities?.executorFlags?.browserCacheExecutor),
    gradleCacheExecutor: Boolean(runtimeCapabilities?.executorFlags?.gradleCacheExecutor),
    userCacheExecutor: Boolean(runtimeCapabilities?.executorFlags?.userCacheExecutor),
    androidCacheExecutor: Boolean(runtimeCapabilities?.executorFlags?.androidCacheExecutor),
    shaderCacheExecutor: Boolean(runtimeCapabilities?.executorFlags?.shaderCacheExecutor),
    pipCacheExecutor: Boolean(runtimeCapabilities?.executorFlags?.pipCacheExecutor),
    toolNativePruneExecutors: Boolean(runtimeCapabilities?.executorFlags?.toolNativePruneExecutors),
    npmCacheExecutor: Boolean(runtimeCapabilities?.executorFlags?.npmCacheExecutor),
    pnpmStoreExecutor: Boolean(runtimeCapabilities?.executorFlags?.pnpmStoreExecutor),
    recycleBinExecutor: Boolean(runtimeCapabilities?.executorFlags?.recycleBinExecutor),
    enabledScopedExecutorFlags,
    enabledScopedExecutorFlagCount,
    openAiAgentAdvice: Boolean(runtimeCapabilities?.openAiAgentAdvice),
    openAiAdvisorConfigured: Boolean(runtimeCapabilities?.openAiAdvisorConfigured),
    openAiKeySource: runtimeCapabilities?.openAiKeySource || "missing"
  };
  const executionSummary = {
    planId: planSnapshot?.id || "",
    scanFingerprint: scanSession?.currentFingerprint || "",
    scanFingerprintPresent: Boolean(scanSession?.currentFingerprint),
    consentPlanId: consentReceipt?.planId || "",
    consentMatchesPlan: Boolean(planSnapshot?.id && consentReceipt?.planId && consentReceipt.planId === planSnapshot.id),
    writeReadinessStatus: writeReadiness?.status || "unknown",
    readyForRealExecution: Boolean(writeReadiness?.readyForRealExecution),
    releaseReadyForRealRun: Boolean(releaseGate?.readyForRealRun),
    validationReadyForRealRun: Boolean(validationPack?.readyForRealRun),
    proofStatus: executionProofHandoff?.status || "waiting-for-execution",
    proofAllowsNextExecutor: ["waiting-for-execution", "proof-complete"].includes(executionProofHandoff?.status || "waiting-for-execution"),
    proofPrimary: executionProofHandoff?.primary || "",
    canRunPostRunRescan: Boolean(executionProofHandoff?.canRunRescan),
    rescanComparisonStatus: rescanComparison?.status || "not-run",
    postRunScanEvidence: Boolean(rescanComparison?.postRunScanEvidence),
    selectedExecutorRoutes: executableRows.map((row) => ({
      id: row.id,
      route: row.route,
      title: row.title,
      canExecute: Boolean(row.canExecute),
      canSimulate: Boolean(row.canSimulate),
      bytes: Number(row.bytes || 0)
    }))
  };
  const agentTaskQueue = buildOpenAIAgentTaskQueue({
    runtime: runtimeSummary,
    execution: executionSummary,
    executableRows,
    projectDependencyReviewTargets,
    reviewedDownloadsTargets,
    reviewedProjectTargets,
    largeFileArchiveTargets,
    gradleCacheTargets,
    userCacheTargets,
    androidCacheTargets,
    shaderCacheTargets,
    pipCacheTargets,
    dockerBuildCacheTargets,
    npmCacheTargets,
    pnpmStoreTargets,
    recycleBinTargets,
    browserCacheTargets,
    manualReviewTargets,
    installedAppUninstallWorkOrder,
    wslCompactionWorkOrder,
    driveInventoryRows,
    customRootRows
  });
  const liveRouteValidation = buildOpenAILiveRouteValidationContext({
    liveValidationManifest,
    scopedExecutorCommandFlow
  });

  return {
    schemaVersion: "spaceguard-openai-agent-context/v1",
    generatedAt: new Date().toISOString(),
    appBoundary: {
      aiRole: "advisory planner",
      directFilesystemAccess: false,
      directDeleteAuthority: false,
      userApprovalRequired: true,
      executorAuthority: "native code only after explicit user action",
      allowedActions: ["rank-reviewed-targets", "explain-blockers", "ask-user", "recommend-rescan", "recommend-plan-selection", "recommend-scoped-executor-button", "recommend-manual-review"],
      forbiddenActions: ["delete-files", "approve-gates", "scan-folders", "run-shell", "edit-registry", "change-partitions"]
    },
    machine: {
      scanMode: scanMode || "unknown",
      drive: profile?.drive || "unknown",
      usedBytes: Number(profile?.usedBytes || 0),
      freeBytes: Number(profile?.freeBytes || 0),
      totalBytes: Number(profile?.totalBytes || 0)
    },
    plan: {
      id: planSnapshot?.id || "",
      scanMode: planSnapshot?.scanMode || scanMode || "unknown",
      selectedCount: Number(planSnapshot?.selectedCount ?? selected.length),
      selectedBytes: Number(planSnapshot?.selectedBytes ?? selected.reduce((sum, action) => sum + Number(action.bytes || 0), 0)),
      goalBytes: Number(planSnapshot?.goalBytes || planSnapshot?.payload?.goalBytes || 0),
      selectedIds: Array.isArray(planSnapshot?.selectedIds) ? planSnapshot.selectedIds.slice(0, 24) : selected.map((action) => action.id).slice(0, 24)
    },
    readiness: {
      scan: scanSession?.status || "unknown",
      plan: readiness?.status || "unknown",
      run: runReadiness?.status || "unknown",
      dryRun: dryRunLaunchGuard?.status || "unknown",
      interlock: safetyInterlock?.status || "unknown",
      nativeEvidence: nativeEvidenceQuality?.status || "unknown",
      candidateManifest: candidateSafetyManifest?.status || "unknown",
      storagePressure: storagePressureDiagnosis?.status || "unknown"
    },
    runtime: runtimeSummary,
    execution: executionSummary,
    selectedActions: selected,
    topFindings,
    executableRows,
    liveRouteValidation,
    agentTaskQueue,
    projectDependencyReviewTargets,
    reviewedDownloadsTargets,
    reviewedProjectTargets,
    largeFileArchiveTargets,
    gradleCacheTargets,
    userCacheTargets,
    androidCacheTargets,
    shaderCacheTargets,
    pipCacheTargets,
    dockerBuildCacheTargets,
    npmCacheTargets,
    pnpmStoreTargets,
    recycleBinTargets,
    wslVhdxTargets,
    browserCacheTargets,
    manualReviewTargets,
    installedAppReview,
    installedAppUninstallWorkOrder,
    wslCompactionWorkOrder,
    driveInventoryRows,
    customRootRows,
    candidateSamples: (candidateSafetyManifest?.rows || []).slice(0, 12).map((row) => ({
      id: row.id,
      title: row.title,
      route: row.route,
      status: row.status,
      targetPath: row.targetPath,
      candidateBytes: Number(row.candidateBytes || 0),
      candidateCount: Number(row.candidateCount || 0),
      skippedCount: Number(row.skippedCount || 0),
      sampleNames: row.sampleNames || []
    }))
  };
}

function buildOpenAILiveRouteValidationContext({
  liveValidationManifest = null,
  scopedExecutorCommandFlow = null
} = {}) {
  const source =
    liveValidationManifest?.schemaVersion === "spaceguard-live-route-validation/v1"
      ? liveValidationManifest
      : buildOpenAILiveRouteValidationManifestFromFlow(scopedExecutorCommandFlow);
  if (!source) return null;

  const contract = source.contract || {};
  const runtime = source.runtime || {};
  const boundary = source.nativeBoundary || {};
  const route = String(source.route || "").trim();
  const mappedBoundary = buildRouteNativeBoundary({
    route,
    requestMode: source.contract?.requestMode || ""
  });
  const nativeBoundary = {
    tauriCommand: String(boundary.tauriCommand || mappedBoundary.tauriCommand || "execute_cleanup_plan"),
    adapterFunction: String(boundary.adapterFunction || mappedBoundary.adapterFunction || ""),
    rustFunction: String(boundary.rustFunction || mappedBoundary.rustFunction || ""),
    requestShape: normalizeStringList(boundary.requestShape || mappedBoundary.requestShape),
    targetAllowlist: normalizeStringList(boundary.targetAllowlist || mappedBoundary.targetAllowlist),
    targetRejects: normalizeStringList(boundary.targetRejects || mappedBoundary.targetRejects),
    deletePolicy: normalizeStringList(boundary.deletePolicy || mappedBoundary.deletePolicy),
    postRunProof: normalizeStringList(boundary.postRunProof || mappedBoundary.postRunProof)
  };

  return {
    schemaVersion: "spaceguard-openai-live-route-validation/v1",
    route,
    routeInput: String(source.routeInput || "").trim(),
    title: String(source.title || "").trim(),
    status: String(source.status || "unknown").trim(),
    envVar: String(contract.envVar || runtime.requiredEnabledFlag || "").trim(),
    requestMode: String(contract.requestMode || "").trim(),
    panelId: String(contract.panelId || "").trim(),
    actionLabel: String(contract.actionLabel || "").trim(),
    routeFlagReady: Boolean(runtime.routeFlagReady),
    canAttemptWindowsValidation: Boolean(runtime.canAttemptWindowsValidation ?? source.status === "ready"),
    canExecuteWithoutAppEvidence: false,
    singleScopedFlagRequired: Boolean(runtime.singleScopedFlagRequired ?? true),
    requiredEnabledFlag: String(runtime.requiredEnabledFlag || contract.envVar || "").trim(),
    disabledReason: String(runtime.disabledReason || "").trim(),
    requiredAppEvidence: normalizeStringList(source.requiredAppEvidence),
    requiredPostRunProof: normalizeStringList(source.requiredPostRunProof),
    nativeBoundary,
    targetAllowlist: nativeBoundary.targetAllowlist,
    targetRejects: nativeBoundary.targetRejects,
    deletePolicy: nativeBoundary.deletePolicy,
    postRunProof: nativeBoundary.postRunProof
  };
}

function buildOpenAILiveRouteValidationManifestFromFlow(flow = null) {
  if (!flow || flow.schemaVersion !== "spaceguard-scoped-executor-command-flow/v1") return null;
  const row = flow.primaryRow || {};
  const launchPacket = flow.launchPacket || {};
  const setupCommands = flow.setupCommands || launchPacket.setupCommands || {};
  const route = String(row.route || flow.route || launchPacket.route || "").trim();
  if (!route) return null;
  const envVar = row.envVar || setupCommands.envVar || "";
  const requestMode = row.requestMode || setupCommands.requestMode || "";
  const panelId = row.panelId || flow.panelId || launchPacket.panelId || "";
  const nativeBoundary = buildRouteNativeBoundary({ route, requestMode });

  return {
    schemaVersion: "spaceguard-live-route-validation/v1",
    route,
    routeInput: launchPacket.routeInput || setupCommands.routeInput || "",
    title: row.title || flow.title || launchPacket.title || "",
    status: row.status || flow.status || launchPacket.status || "unknown",
    contract: {
      envVar,
      requestMode,
      panelId,
      actionLabel: row.actionLabel || flow.actionLabel || launchPacket.actionLabel || ""
    },
    runtime: {
      routeFlagReady: Boolean(row.flagEnabled),
      canAttemptWindowsValidation: Boolean(row.flagEnabled && flow.nativeAvailable),
      canExecuteWithoutAppEvidence: false,
      singleScopedFlagRequired: true,
      requiredEnabledFlag: envVar,
      disabledReason: row.blockedReason || launchPacket.blockedReason || ""
    },
    requiredAppEvidence: [
      "current-native-scan-fingerprint",
      "current-plan-consent-receipt",
      "native-scanned-target",
      "selected-action-row",
      "single-scoped-executor-flag"
    ],
    requiredPostRunProof: [
      "execution-ledger",
      "native-write-volume-proof",
      "post-run-rescan-comparison",
      "selected-route-proof-packet",
      "selected-route-proof-import",
      "real-workflow-proof",
      "workflow-proof-check-output"
    ],
    nativeBoundary: {
      ...nativeBoundary,
      targetAllowlist: nativeBoundary.targetAllowlist.length ? nativeBoundary.targetAllowlist : [
        row.targetEvidence || launchPacket.targetEvidence || "Use only the native-scanned target for the selected route."
      ],
      targetRejects: nativeBoundary.targetRejects.length ? nativeBoundary.targetRejects : ["custom roots", "system folders", "personal folders outside the selected route"],
      deletePolicy: nativeBoundary.deletePolicy.length ? nativeBoundary.deletePolicy : ["Mutation is scoped to the selected route-specific native executor only."],
      postRunProof: nativeBoundary.postRunProof.length ? nativeBoundary.postRunProof : ["execution ledger", "native volume proof", "post-run native rescan"]
    }
  };
}

export function buildOpenAIAgentRunRecord({
  result = null,
  context = null,
  userPrompt = "",
  planSnapshot = null,
  recommendationBroker = null,
  createdAt = null
} = {}) {
  const advice = result?.advice && typeof result.advice === "object"
    ? normalizeAgentAdviceObject(result.advice, {
        summary: "",
        nextAction: "",
        confidence: "medium",
        recommendedActions: [],
        blockedActions: [],
        questions: [],
        warnings: []
      })
    : parseAgentAdvice(result?.rawText || "");
  const recordedAt = createdAt || result?.createdAt || new Date().toISOString();
  const planId = planSnapshot?.id || context?.plan?.id || "";
  const payload = {
    schemaVersion: "spaceguard-openai-agent-run/v1",
    provider: result?.provider || "openai",
    model: result?.model || DEFAULT_OPENAI_MODEL,
    transport: result?.transport || "",
    keySource: result?.keySource || context?.runtime?.openAiKeySource || "",
    requestId: result?.requestId || "",
    responseId: result?.responseId || "",
    createdAt: recordedAt,
    planId,
    scanMode: context?.machine?.scanMode || context?.plan?.scanMode || "unknown",
    prompt: String(userPrompt || "").slice(0, 600),
    summary: advice.summary,
    nextAction: advice.nextAction,
    confidence: advice.confidence,
    recommendedActions: advice.recommendedActions,
    blockedActions: advice.blockedActions,
    questions: advice.questions,
    warnings: advice.warnings,
    recommendationBroker: compactOpenAIAgentRecommendationBroker(recommendationBroker),
    context: compactOpenAIAgentRunContext(context, planSnapshot)
  };
  return {
    ...payload,
    id: buildOpenAIAgentRunId(payload)
  };
}

export function appendOpenAIAgentRunRecord(history = [], record = null, { limit = 20 } = {}) {
  const existing = normalizeOpenAIAgentRunHistory(history, { limit });
  if (!isOpenAIAgentRunRecord(record)) return existing;
  if (existing.some((item) => item.id === record.id)) return existing;
  return [...existing, record].slice(-limit);
}

const OPENAI_RECOMMENDATION_EXECUTOR_POLICIES = {
  "run-temp-executor": {
    flag: "tempCleanupExecutor",
    targetLabel: "temp executor route",
    route: "known-temp-delete",
    targetList: "executableRows"
  },
  "run-downloads-cleanup-executor": {
    flag: "downloadsCleanupExecutor",
    targetLabel: "reviewed Downloads Remove targets",
    route: "item-review-recycle-bin",
    targetList: "reviewedDownloadsTargets"
  },
  "run-large-file-archive-executor": {
    flag: "largeFileArchiveExecutor",
    targetLabel: "reviewed large-file Archive/Move targets",
    route: "item-review-large-files",
    targetList: "largeFileArchiveTargets",
    requiresArchiveDestination: true
  },
  "run-project-deps-executor": {
    flag: "projectDependencyExecutor",
    targetLabel: "reviewed project dependency targets",
    route: "item-review-project-cache",
    targetList: "reviewedProjectTargets"
  },
  "run-browser-cache-executor": {
    flag: "browserCacheExecutor",
    targetLabel: "scanned browser cache roots",
    route: "browser-cache-only",
    targetList: "browserCacheTargets"
  },
  "run-gradle-cache-executor": {
    flag: "gradleCacheExecutor",
    targetLabel: "scanned Gradle cache root",
    route: "bounded-cache-delete",
    targetList: "gradleCacheTargets"
  },
  "run-user-cache-executor": {
    flag: "userCacheExecutor",
    targetLabel: "scanned user .cache root",
    route: "bounded-user-cache-delete",
    targetList: "userCacheTargets"
  },
  "run-android-cache-executor": {
    flag: "androidCacheExecutor",
    targetLabel: "scanned Android cache roots",
    route: "bounded-android-cache-delete",
    targetList: "androidCacheTargets",
    allowTargetPrefix: true
  },
  "run-shader-cache-executor": {
    flag: "shaderCacheExecutor",
    targetLabel: "scanned shader cache roots",
    route: "launcher-cache-cleanup",
    targetList: "shaderCacheTargets"
  },
  "run-pip-cache-executor": {
    flag: "pipCacheExecutor",
    targetLabel: "scanned pip cache root",
    route: "bounded-pip-cache-delete",
    targetList: "pipCacheTargets"
  },
  "run-docker-build-cache-executor": {
    flag: "toolNativePruneExecutors",
    targetLabel: "scanned Docker build-cache inventory",
    route: "tool-native-docker-build-cache-prune",
    targetList: "dockerBuildCacheTargets"
  },
  "run-npm-cache-executor": {
    flag: "npmCacheExecutor",
    targetLabel: "scanned npm cache root",
    route: "bounded-npm-cache-delete",
    targetList: "npmCacheTargets"
  },
  "run-pnpm-store-executor": {
    flag: "pnpmStoreExecutor",
    targetLabel: "scanned pnpm store root",
    route: "bounded-pnpm-store-delete",
    targetList: "pnpmStoreTargets"
  },
  "run-recycle-bin-executor": {
    flag: "recycleBinExecutor",
    targetLabel: "scanned Recycle Bin root",
    route: "shell-recycle-bin",
    targetList: "recycleBinTargets",
    requiresPermanentConfirmation: true
  }
};

function getOpenAIEnabledScopedExecutorFlags(runtimeOrFlags = {}) {
  const rawFlags = runtimeOrFlags?.executorFlags || runtimeOrFlags?.executor_flags || runtimeOrFlags || {};
  const seen = new Set();
  return Object.values(OPENAI_RECOMMENDATION_EXECUTOR_POLICIES)
    .filter((policy) => {
      if (!policy?.flag || seen.has(policy.flag) || !rawFlags[policy.flag]) return false;
      seen.add(policy.flag);
      return true;
    })
    .map((policy) => policy.flag);
}

function buildOpenAIAgentTaskQueue({
  runtime = {},
  execution = {},
  executableRows = [],
  projectDependencyReviewTargets = [],
  reviewedDownloadsTargets = [],
  reviewedProjectTargets = [],
  largeFileArchiveTargets = [],
  gradleCacheTargets = [],
  userCacheTargets = [],
  androidCacheTargets = [],
  shaderCacheTargets = [],
  pipCacheTargets = [],
  dockerBuildCacheTargets = [],
  npmCacheTargets = [],
  pnpmStoreTargets = [],
  recycleBinTargets = [],
  browserCacheTargets = [],
  manualReviewTargets = [],
  installedAppUninstallWorkOrder = null,
  wslCompactionWorkOrder = null,
  driveInventoryRows = [],
  customRootRows = []
} = {}) {
  const rows = [
    ...buildOpenAIProofRescanTaskRows(execution),
    ...buildOpenAIProofImportTaskRows(execution),
    ...buildOpenAIExecutorTaskRows("run-temp-executor", executableRows.filter((row) => row.route === "known-temp-delete"), runtime, execution),
    ...buildOpenAIExecutorTaskRows("run-downloads-cleanup-executor", reviewedDownloadsTargets, runtime, execution),
    ...buildOpenAIExecutorTaskRows("run-large-file-archive-executor", largeFileArchiveTargets, runtime, execution),
    ...buildOpenAIExecutorTaskRows("run-project-deps-executor", reviewedProjectTargets, runtime, execution),
    ...buildOpenAIExecutorTaskRows("run-browser-cache-executor", browserCacheTargets, runtime, execution),
    ...buildOpenAIExecutorTaskRows("run-gradle-cache-executor", gradleCacheTargets, runtime, execution),
    ...buildOpenAIExecutorTaskRows("run-user-cache-executor", userCacheTargets, runtime, execution),
    ...buildOpenAIExecutorTaskRows("run-android-cache-executor", androidCacheTargets, runtime, execution),
    ...buildOpenAIExecutorTaskRows("run-shader-cache-executor", shaderCacheTargets, runtime, execution),
    ...buildOpenAIExecutorTaskRows("run-pip-cache-executor", pipCacheTargets, runtime, execution),
    ...buildOpenAIExecutorTaskRows("run-docker-build-cache-executor", dockerBuildCacheTargets, runtime, execution),
    ...buildOpenAIExecutorTaskRows("run-npm-cache-executor", npmCacheTargets, runtime, execution),
    ...buildOpenAIExecutorTaskRows("run-pnpm-store-executor", pnpmStoreTargets, runtime, execution),
    ...buildOpenAIExecutorTaskRows("run-recycle-bin-executor", recycleBinTargets, runtime, execution),
    ...buildOpenAIReviewTaskRows(projectDependencyReviewTargets, {
      source: "project-dependency-review",
      route: "item-review-project-cache",
      focusActionId: "node-modules-old",
      reason: "Ask the user to mark exact rebuildable dependency folders Remove before any project cleanup executor can run."
    }),
    ...buildOpenAIReviewTaskRows(manualReviewTargets, {
      source: "installed-app-review",
      actionType: "manual-only",
      route: "manual-app-uninstall",
      manualOnly: true,
      reason: "Installed apps stay manual-only through Windows Settings or the vendor uninstaller."
    }),
    ...buildOpenAIReviewTaskRows(installedAppUninstallWorkOrder?.rows || [], {
      source: "app-uninstall-work-order",
      actionType: "manual-only",
      route: "manual-app-uninstall",
      manualOnly: true,
      reason: "The user selected this app for manual uninstall follow-up; SpaceGuard must not run uninstallers."
    }),
    ...buildOpenAIReviewTaskRows(wslCompactionWorkOrder?.rows || [], {
      source: "wsl-compaction-work-order",
      actionType: "manual-only",
      route: "advanced-checklist",
      manualOnly: true,
      reason: "WSL compaction is an advanced manual checklist outside SpaceGuard execution."
    }),
    ...buildOpenAIReviewTaskRows(driveInventoryRows, {
      source: "drive-inventory",
      actionType: "manual-only",
      route: "drive-inventory-review",
      manualOnly: true,
      reason: "Top-level drive inventory is context for user inspection, not cleanup authority."
    }),
    ...buildOpenAIReviewTaskRows(customRootRows, {
      source: "custom-root-triage",
      actionType: "manual-only",
      route: "custom-root-review",
      manualOnly: true,
      reason: "Custom roots require user disposition and never create an executor route."
    })
  ];
  const dedupedRows = dedupeOpenAITaskRows(rows)
    .sort(compareOpenAITaskRows)
    .slice(0, 12);

  return {
    schemaVersion: "spaceguard-openai-agent-task-queue/v1",
    advisoryOnly: true,
    directToolAccess: false,
    primary: dedupedRows.length
      ? `${dedupedRows.length} deterministic task(s) are available for OpenAI to rank.`
      : "Run a native scan or choose review targets before asking OpenAI for a cleanup plan.",
    counts: {
      total: dedupedRows.length,
      ready: dedupedRows.filter((row) => row.status === "ready").length,
      review: dedupedRows.filter((row) => row.status === "needs-user-review").length,
      manual: dedupedRows.filter((row) => row.manualOnly).length,
      blocked: dedupedRows.filter((row) => row.status === "blocked").length
    },
    rows: dedupedRows
  };
}

function buildOpenAIProofRescanTaskRows(execution = {}) {
  const proofStatus = execution.proofStatus || "waiting-for-execution";
  const proofPending = proofStatus !== "waiting-for-execution" && proofStatus !== "proof-complete";
  if (!proofPending) return [];
  const canRunPostRunRescan = Boolean(execution.canRunPostRunRescan);
  return [
    {
      id: "task-post-run-rescan",
      source: "post-run-proof",
      actionType: "rescan",
      targetId: "post-run-rescan",
      route: "post-run-proof",
      title: "Run post-run rescan before another executor",
      bytes: 0,
      priority: "high",
      status: canRunPostRunRescan ? "ready" : "blocked",
      canExecuteNow: canRunPostRunRescan,
      manualOnly: false,
      executorFlag: "",
      buttonLabel: "Run post-run rescan",
      reason: "A scoped executor has ledger evidence, but another executor is blocked until post-run native rescan proof is captured.",
      blocker: canRunPostRunRescan ? "" : "post-run-rescan-unavailable",
      checks: [
        buildBrokerCheck("proof-pending", "Proof pending", true, `proof=${proofStatus}`),
        buildBrokerCheck("post-run-rescan", "Post-run rescan available", canRunPostRunRescan, canRunPostRunRescan ? "ledger-preserving rescan can run" : "desktop native rescan is not available")
      ]
    }
  ];
}

function buildOpenAIProofImportTaskRows(execution = {}) {
  const proofComplete = execution.proofStatus === "proof-complete";
  const rescanMatched = execution.rescanComparisonStatus === "matched";
  const postRunScanEvidence = Boolean(execution.postRunScanEvidence);
  if (!proofComplete || !rescanMatched || !postRunScanEvidence) return [];
  return [
    {
      id: "task-selected-route-proof-import",
      source: "selected-route-proof-import",
      actionType: "manual-only",
      targetId: "selected-route-proof-import",
      route: "validation-evidence",
      title: "Import selected route proof into validation evidence",
      bytes: 0,
      priority: "high",
      status: "needs-user-review",
      canExecuteNow: false,
      manualOnly: true,
      executorFlag: "",
      buttonLabel: "Open validation evidence",
      reason: "Post-run proof is complete; attach the selected-route proof packet to ledger-rescan-parity with reviewer and artifact detail.",
      blocker: "reviewer-artifact-required",
      checks: [
        buildBrokerCheck("proof-complete", "Proof complete", proofComplete, `proof=${execution.proofStatus || "unknown"}`),
        buildBrokerCheck("rescan-matched", "Rescan matched", rescanMatched, `rescan=${execution.rescanComparisonStatus || "unknown"}`),
        buildBrokerCheck("post-run-scan", "Post-run scan evidence", postRunScanEvidence, postRunScanEvidence ? "post-run native scan captured" : "missing post-run native scan")
      ]
    }
  ];
}

function buildOpenAIExecutorTaskRows(actionType, targets = [], runtime = {}, execution = {}) {
  const policy = OPENAI_RECOMMENDATION_EXECUTOR_POLICIES[actionType];
  if (!policy) return [];
  return (Array.isArray(targets) ? targets : []).slice(0, 12).map((target, index) => {
    const status = getOpenAIExecutorTaskStatus({ policy, runtime, execution });
    const targetId = String(target.id || `${policy.route}-${index + 1}`).trim();
    const title = target.title || target.name || policy.targetLabel;
    const bytes = Number(target.bytes || 0);
    return {
      id: `task-${actionType}-${targetId || index + 1}`,
      source: "scoped-executor",
      actionType,
      targetId,
      route: policy.route,
      title,
      bytes,
      priority: getOpenAITaskPriority(bytes, status.status),
      status: status.status,
      canExecuteNow: status.status === "ready",
      manualOnly: false,
      executorFlag: policy.flag,
      buttonLabel: getExecutorRecommendationButtonLabel(actionType),
      reason: status.reason,
      blocker: status.blocker,
      checks: status.checks
    };
  });
}

function getOpenAIExecutorTaskStatus({ policy, runtime = {}, execution = {} }) {
  const enabledScopedFlags = Array.isArray(runtime.enabledScopedExecutorFlags)
    ? runtime.enabledScopedExecutorFlags
    : getOpenAIEnabledScopedExecutorFlags(runtime);
  const checks = [
    buildBrokerCheck("native-runtime", "Native runtime", Boolean(runtime.nativeAvailable), runtime.nativeAvailable ? "native runtime available" : "desktop shell required"),
    buildBrokerCheck("real-run-flag", "Scoped real-run flag", Boolean(runtime.realRunEnabled), runtime.realRunEnabled ? "real scoped execution exposed" : "real scoped execution disabled"),
    buildBrokerCheck("feature-flag", "Route feature flag", Boolean(runtime[policy.flag]), runtime[policy.flag] ? `${policy.flag} enabled` : `${policy.flag} disabled`),
    buildBrokerCheck("single-scoped-flag", "Single scoped flag", enabledScopedFlags.length <= 1, enabledScopedFlags.length <= 1 ? `${enabledScopedFlags.length} scoped executor flag(s) enabled` : `Turn off all but one scoped executor flag: ${enabledScopedFlags.join(", ")}`),
    buildBrokerCheck("scan-fingerprint", "Scan fingerprint", Boolean(execution.scanFingerprintPresent), execution.scanFingerprintPresent ? "current scan fingerprint present" : "scan fingerprint missing"),
    buildBrokerCheck("consent", "Consent receipt", Boolean(execution.consentMatchesPlan), execution.consentMatchesPlan ? "consent matches current plan" : "current plan consent missing"),
    buildBrokerCheck("post-run-proof", "Post-run proof", Boolean(execution.proofAllowsNextExecutor), execution.proofAllowsNextExecutor ? `proof=${execution.proofStatus || "waiting-for-execution"}` : `proof=${execution.proofStatus || "blocked"}`)
  ];
  const failed = checks.find((check) => !check.passed);
  if (failed) {
    return {
      status: "blocked",
      blocker: failed.id,
      reason: failed.detail,
      checks
    };
  }
  if (policy.requiresArchiveDestination) {
    return {
      status: "needs-user-review",
      blocker: "archive-destination",
      reason: "Choose an archive destination before recommending the large-file archive executor.",
      checks
    };
  }
  if (policy.requiresPermanentConfirmation) {
    return {
      status: "needs-user-review",
      blocker: "permanent-confirmation",
      reason: "Require explicit permanent-removal confirmation before recommending Recycle Bin emptying.",
      checks
    };
  }
  return {
    status: "ready",
    blocker: "",
    reason: "All deterministic executor preconditions visible to the agent context are satisfied.",
    checks
  };
}

function buildOpenAIReviewTaskRows(targets = [], {
  source,
  actionType = "review-target",
  route = "",
  focusActionId = "",
  manualOnly = false,
  reason = ""
} = {}) {
  return (Array.isArray(targets) ? targets : []).slice(0, 12).map((target, index) => {
    const targetId = String(target.id || `${source || "review"}-${index + 1}`).trim();
    const bytes = Number(target.bytes || 0);
    const signals = normalizeAgentReviewSignals(target.signals);
    const usageProof = target.usageProof || getAgentSignalValue(signals, "usage proof") || "";
    const uninstallEntry = target.uninstallEntry || getAgentSignalValue(signals, "uninstall entry") || "";
    const registryMatch = target.registryMatch || getAgentSignalValue(signals, "registry match") || "";
    const unusedReview = manualOnly && (target.route || route) === "manual-app-uninstall"
      ? buildAgentUnusedReviewScore({
          usageProof: usageProof || "not proven",
          uninstallEntry,
          registryMatch,
          recommendation: target.recommendation,
          decision: target.decision,
          ageDays: target.ageDays,
          bytes
        })
      : { score: Number(target.unusedReviewScore || 0), tier: target.unusedReviewTier || "", factors: target.scoreFactors || [] };
    return {
      id: `task-${source || actionType}-${targetId}`,
      source: source || "review",
      actionType,
      targetId,
      route: target.route || route,
      focusActionId,
      title: target.title || target.name || target.id || "Review target",
      bytes,
      path: target.path || "",
      ageDays: Number(target.ageDays || 0),
      kind: target.kind || "",
      recommendation: target.recommendation || "review",
      decision: target.decision || "undecided",
      signals,
      usageProof,
      uninstallEntry,
      registryMatch,
      unusedReviewTier: target.unusedReviewTier || unusedReview.tier || "",
      unusedReviewScore: Number(target.unusedReviewScore || unusedReview.score || 0),
      scoreFactors: Array.isArray(target.scoreFactors) ? target.scoreFactors.slice(0, 6) : Array.isArray(unusedReview.factors) ? unusedReview.factors.slice(0, 6) : [],
      officialAction: target.officialAction || "",
      canCreateExecutor: Boolean(target.canCreateExecutor),
      executorRequiresUserRemoveDecision: Boolean(target.executorRequiresUserRemoveDecision),
      forbiddenActions: Array.isArray(target.forbiddenActions) ? target.forbiddenActions.slice(0, 8) : manualOnly ? ["automated-uninstall", "delete-program-files", "run-uninstall-string"] : [],
      priority: getOpenAITaskPriority(bytes, manualOnly ? "manual-only" : "needs-user-review"),
      status: manualOnly ? "manual-only" : "needs-user-review",
      canExecuteNow: false,
      manualOnly: Boolean(manualOnly),
      executorFlag: "",
      buttonLabel: manualOnly ? "Open manual review" : "Open review",
      reason: target.reason || reason,
      blocker: manualOnly ? "manual-only" : "user-review-required",
      checks: [
        buildBrokerCheck("advisory-only", "Advisory boundary", true, "OpenAI can route this task to UI review only."),
        buildBrokerCheck("target-id", "Known target", Boolean(targetId), targetId || "missing target id")
      ]
    };
  });
}

function dedupeOpenAITaskRows(rows = []) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const key = `${row.actionType || ""}::${row.targetId || ""}::${row.route || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(row.targetId || row.title);
  });
}

function compareOpenAITaskRows(left, right) {
  const leftCritical = getOpenAITaskCriticality(left);
  const rightCritical = getOpenAITaskCriticality(right);
  if (leftCritical !== rightCritical) return rightCritical - leftCritical;
  const statusScore = {
    ready: 4,
    "needs-user-review": 3,
    "manual-only": 2,
    blocked: 1
  };
  const leftStatus = statusScore[left.status] || 0;
  const rightStatus = statusScore[right.status] || 0;
  if (leftStatus !== rightStatus) return rightStatus - leftStatus;
  const leftBytes = Number(left.bytes || 0);
  const rightBytes = Number(right.bytes || 0);
  if (leftBytes !== rightBytes) return rightBytes - leftBytes;
  return String(left.title || "").localeCompare(String(right.title || ""));
}

function getOpenAITaskCriticality(row = {}) {
  if (row.source === "post-run-proof" || row.targetId === "post-run-rescan") return 3;
  if (row.source === "selected-route-proof-import" || row.targetId === "selected-route-proof-import") return 2;
  if (row.source === "scoped-executor") return 1;
  return 0;
}

function getOpenAITaskPriority(bytes = 0, status = "") {
  const size = Number(bytes || 0);
  if (status === "ready") return "high";
  if (size >= 5 * 1024 ** 3) return "high";
  if (size >= 1024 ** 3) return "medium";
  return "low";
}

export function getOpenAIAgentRecommendationKey(row = {}) {
  return [
    row.actionType || row.action_type || "manual-only",
    row.targetId || row.target_id || "",
    row.route || "",
    row.id || "",
    row.title || ""
  ].map((part) => String(part || "").trim()).join("::");
}

export function buildOpenAIAgentRecommendationBroker({
  advice = null,
  context = null,
  executionState = {}
} = {}) {
  const recommendationRows = normalizeAdviceRows(advice?.recommendedActions || advice?.recommended_actions || advice?.advice?.recommendedActions || []);
  const rows = recommendationRows.map((row) => buildOpenAIAgentRecommendationBrokerRow(row, context, executionState));
  const readyRows = rows.filter((row) => row.canAct);
  const blockedRows = rows.filter((row) => !row.canAct && row.status === "blocked");
  const executorRows = rows.filter((row) => row.kind === "scoped-executor");

  return {
    schemaVersion: "spaceguard-openai-recommendation-broker/v1",
    advisoryOnly: true,
    directToolAccess: false,
    rows,
    counts: {
      recommendations: rows.length,
      ready: readyRows.length,
      blocked: blockedRows.length,
      scopedExecutors: executorRows.length
    },
    status: blockedRows.length ? "broker-has-blocked-actions" : rows.length ? "broker-ready" : "broker-idle",
    tone: blockedRows.length ? "review" : rows.length ? "safe" : "review",
    primary: blockedRows.length
      ? `${blockedRows.length} OpenAI recommendation(s) need deterministic app gates before action.`
      : rows.length
        ? `${readyRows.length} OpenAI recommendation(s) can be routed through UI controls.`
        : "No OpenAI recommendations have been brokered yet."
  };
}

function buildOpenAIAgentRecommendationBrokerRow(row = {}, context = null, executionState = {}) {
  const actionType = normalizeActionType(row.actionType || row.action_type);
  const policy = OPENAI_RECOMMENDATION_EXECUTOR_POLICIES[actionType] || null;
  const key = getOpenAIAgentRecommendationKey({ ...row, actionType });
  if (policy) return buildExecutorRecommendationBrokerRow({ row, actionType, key, policy, context, executionState });
  if (actionType === "select-action") {
    return buildSelectionRecommendationBrokerRow({ row, actionType, key, context });
  }
  if (actionType === "rescan") {
    const targetId = String(row.targetId || row.target_id || row.id || "").trim();
    const route = String(row.route || row.route_id || "").trim();
    const postRunRescan = targetId === "post-run-rescan" || route === "post-run-proof" || Boolean(context?.execution?.canRunPostRunRescan && !context?.execution?.proofAllowsNextExecutor);
    const canRunPostRunRescan = Boolean(context?.execution?.canRunPostRunRescan);
    const canAct = !postRunRescan || canRunPostRunRescan;
    return buildBrokerRow({
      row: {
        ...row,
        targetId,
        route
      },
      actionType,
      key,
      kind: "scan",
      status: canAct ? "ready" : "blocked",
      tone: canAct ? "safe" : "restricted",
      canAct,
      buttonLabel: postRunRescan ? "Run post-run rescan" : context?.runtime?.nativeAvailable ? "Run real scan" : "Run demo scan",
      targetPanel: postRunRescan ? "execution-proof-handoff-panel" : "real-data-readiness-panel",
      blockedReason: canAct ? "" : "Post-run rescan is not available in the current runtime.",
      checks: [
        buildBrokerCheck("advisory-only", "Advisory boundary", true, "OpenAI can request a scan action, but the app owns the scanner call."),
        ...(postRunRescan
          ? [buildBrokerCheck("post-run-rescan", "Post-run rescan available", canRunPostRunRescan, canRunPostRunRescan ? "ledger-preserving rescan can run" : "desktop native rescan is not available")]
          : [])
      ]
    });
  }
  if (actionType === "review-target") {
    const targetId = String(row.targetId || row.target_id || row.id || "").trim();
    const recommendedRoute = String(row.route || row.route_id || "").trim();
    const reviewTarget = getReviewRecommendationTarget(context, targetId, recommendedRoute);
    const focusActionId = reviewTarget?.focusActionId || targetId;
    return buildBrokerRow({
      row: {
        ...row,
        targetId,
        recommendedRoute,
        focusActionId
      },
      actionType,
      key,
      kind: "review",
      status: targetId ? "ready" : "needs-target",
      tone: targetId ? "safe" : "review",
      canAct: true,
      buttonLabel: "Open review",
      targetPanel: "item-review-panel",
      blockedReason: targetId ? "" : "OpenAI did not name a review target; opening item review instead.",
      checks: [
        buildBrokerCheck("target", "Review target", Boolean(targetId), targetId || "missing target id"),
        buildBrokerCheck("focus-action", "Review action focus", Boolean(focusActionId), focusActionId || "open generic item review")
      ]
    });
  }
  if (actionType === "ask-user") {
    return buildBrokerRow({
      row,
      actionType,
      key,
      kind: "question",
      status: "ready",
      tone: "safe",
      canAct: true,
      buttonLabel: "Open question",
      targetPanel: "agent-question-panel",
      blockedReason: "",
      checks: [buildBrokerCheck("question-panel", "Question panel", true, "Routes through the deterministic question queue.")]
    });
  }
  return buildBrokerRow({
    row,
    actionType,
    key,
    kind: "manual",
    status: "manual-only",
    tone: "advisory",
    canAct: true,
    buttonLabel: "Open manual review",
    targetPanel: getManualRecommendationPanel(row),
    blockedReason: "Manual-only recommendations never create executor authority.",
    checks: [buildBrokerCheck("manual-only", "Manual-only boundary", true, "Routes to review panels, not filesystem mutation.")]
  });
}

function buildSelectionRecommendationBrokerRow({ row = {}, actionType, key, context = null }) {
  const targetId = String(row.targetId || row.target_id || row.id || "").trim();
  const targets = getSelectionRecommendationTargets(context);
  const target = targetId
    ? targets.find((candidate) => targetMatchesRecommendationId(candidate, targetId))
    : null;
  const targetSelectable = isOpenAISelectableActionTarget(target);
  const recommendedRoute = String(row.route || row.route_id || "").trim();
  const targetRoute = String(target?.route || "").trim();
  const routeMatches = !recommendedRoute || !targetRoute || recommendedRoute === targetRoute;
  const selectedIds = new Set(Array.isArray(context?.plan?.selectedIds) ? context.plan.selectedIds : []);
  const alreadySelected = Boolean(target?.id && selectedIds.has(target.id));
  const checks = [
    buildBrokerCheck("advisory-only", "Advisory boundary", true, "OpenAI can request UI selection only; it cannot approve gates or execute cleanup."),
    buildBrokerCheck("target-known", "Known action target", Boolean(target), targetId ? `target=${targetId}` : "missing target id"),
    buildBrokerCheck(
      "target-selectable",
      "Selectable cleanup action",
      targetSelectable,
      target
        ? `${target.id}: risk=${target.risk || "unknown"} gate=${target.gate || "unknown"}`
        : "missing target"
    ),
    buildBrokerCheck("route-match", "Target route match", routeMatches, routeMatches ? (recommendedRoute || targetRoute || "route optional for selection") : `OpenAI route ${recommendedRoute}; target route ${targetRoute}.`),
    buildBrokerCheck("already-selected", "Current plan selection", true, alreadySelected ? `${target?.id} is already selected.` : `${target?.id || targetId || "target"} can be added to the plan.`)
  ];
  const blocked = checks.filter((check) => !check.passed);

  return buildBrokerRow({
    row: {
      ...row,
      targetId: target?.id || targetId,
      recommendedRoute,
      executorRoute: targetRoute
    },
    actionType,
    key,
    kind: "selection",
    status: blocked.length ? "blocked" : "ready",
    tone: blocked.length ? "restricted" : "safe",
    canAct: blocked.length === 0,
    buttonLabel: "Select action",
    targetPanel: "cleanup-actions-panel",
    blockedReason: blocked[0]?.detail || "",
    checks
  });
}

function buildExecutorRecommendationBrokerRow({ row, actionType, key, policy, context, executionState }) {
  const runtime = context?.runtime || {};
  const execution = context?.execution || {};
  const enabledScopedFlags = Array.isArray(runtime.enabledScopedExecutorFlags)
    ? runtime.enabledScopedExecutorFlags
    : getOpenAIEnabledScopedExecutorFlags(runtime);
  const planId = executionState.planId || execution.planId || context?.plan?.id || "";
  const consentPlanId = executionState.consentPlanId || execution.consentPlanId || "";
  const scanFingerprint = executionState.scanFingerprint || execution.scanFingerprint || "";
  const proofStatus = String(executionState.proofStatus || execution.proofStatus || "waiting-for-execution");
  const proofAllowsExecution = proofStatus === "waiting-for-execution" || proofStatus === "proof-complete";
  const recommendedRoute = String(row.route || row.route_id || "").trim();
  const routeMatches = recommendedRoute === policy.route;
  const targets = getExecutorRecommendationTargets(policy, context);
  const targetCount = targets.length;
  const targetId = String(row.targetId || row.target_id || "").trim();
  const targetIdMatches = Boolean(targetId) && targets.some((target) =>
    targetMatchesRecommendationId(target, targetId, { allowPrefix: Boolean(policy.allowTargetPrefix) })
  );
  const checks = [
    buildBrokerCheck("native-runtime", "Native runtime", Boolean(runtime.nativeAvailable), runtime.nativeAvailable ? "Tauri native runtime is available." : "Use the desktop shell before running scoped executors."),
    buildBrokerCheck("real-run-flag", "Scoped real-run flag", Boolean(runtime.realRunEnabled), runtime.realRunEnabled ? "Runtime exposes scoped real execution." : "Scoped real execution is disabled."),
    buildBrokerCheck("feature-flag", "Route feature flag", Boolean(runtime[policy.flag]), runtime[policy.flag] ? `${policy.flag} is enabled.` : `${policy.flag} is disabled.`),
    buildBrokerCheck("single-scoped-flag", "Single scoped flag", enabledScopedFlags.length <= 1, enabledScopedFlags.length <= 1 ? `${enabledScopedFlags.length} scoped executor flag(s) enabled.` : `Turn off all but one scoped executor flag: ${enabledScopedFlags.join(", ")}`),
    buildBrokerCheck("route-match", "Action-route match", routeMatches, routeMatches ? `${actionType} maps to ${policy.route}.` : `OpenAI returned route ${recommendedRoute || "missing"} for ${actionType}; expected ${policy.route}.`),
    buildBrokerCheck("target-id-match", "Selected target", targetIdMatches, targetId ? `target=${targetId}; available=${targets.map((target) => target.id).filter(Boolean).join(",") || "none"}` : "OpenAI did not name a specific target id."),
    buildBrokerCheck("post-run-proof", "Post-run proof", proofAllowsExecution, proofAllowsExecution ? `proof=${proofStatus}` : `Finish post-run proof before another scoped executor. proof=${proofStatus}`),
    buildBrokerCheck("plan-id", "Current plan", Boolean(planId), planId || "missing plan id"),
    buildBrokerCheck("scan-fingerprint", "Scan fingerprint", Boolean(scanFingerprint), scanFingerprint || "missing scan fingerprint"),
    buildBrokerCheck("consent", "Consent receipt", Boolean(planId && consentPlanId && consentPlanId === planId), consentPlanId ? `consent=${consentPlanId}` : "missing consent receipt"),
    buildBrokerCheck("targets", policy.targetLabel, targetCount > 0, `${targetCount} target(s) available`)
  ];
  if (policy.requiresArchiveDestination) {
    checks.push(buildBrokerCheck(
      "archive-destination",
      "Archive destination",
      Boolean(String(executionState.largeFileArchiveDestination || "").trim()),
      String(executionState.largeFileArchiveDestination || "").trim() || "missing archive destination"
    ));
  }
  if (policy.requiresPermanentConfirmation) {
    checks.push(buildBrokerCheck(
      "permanent-confirmation",
      "Permanent-removal confirmation",
      Boolean(executionState.permanentRemovalConfirmed),
      executionState.permanentRemovalConfirmed ? "Recycle Bin removal was explicitly confirmed." : "Permanent-removal confirmation is missing."
    ));
  }
  const blocked = checks.filter((check) => !check.passed);
  return buildBrokerRow({
    row: {
      ...row,
      recommendedRoute,
      executorRoute: policy.route
    },
    actionType,
    key,
    kind: "scoped-executor",
    status: blocked.length ? "blocked" : "ready",
    tone: blocked.length ? "restricted" : "safe",
    canAct: blocked.length === 0,
    buttonLabel: getExecutorRecommendationButtonLabel(actionType),
    targetPanel: getExecutorRecommendationPanel(actionType),
    blockedReason: blocked[0]?.detail || "",
    checks
  });
}

function buildBrokerRow({ row, actionType, key, kind, status, tone, canAct, buttonLabel, targetPanel, blockedReason, checks }) {
  return {
    ...row,
    key,
    actionType,
    kind,
    status,
    tone,
    canAct: Boolean(canAct),
    buttonLabel,
    targetPanel,
    blockedReason,
    advisoryOnly: true,
    directToolAccess: false,
    checks
  };
}

function buildBrokerCheck(id, label, passed, detail) {
  return {
    id,
    label,
    passed: Boolean(passed),
    detail
  };
}

function getExecutorRecommendationTargets(policy, context = null) {
  if (policy.targetList === "executableRows") {
    return (context?.executableRows || []).filter((row) => row.route === policy.route);
  }
  return Array.isArray(context?.[policy.targetList]) ? context[policy.targetList] : [];
}

function targetMatchesRecommendationId(target = {}, targetId = "", { allowPrefix = false } = {}) {
  const availableId = String(target.id || "").trim();
  if (!targetId) return true;
  return availableId === targetId || (allowPrefix && availableId.startsWith(`${targetId}-`));
}

function getExecutorRecommendationTargetCount(policy, context = null) {
  return getExecutorRecommendationTargets(policy, context).length;
}

function getSelectionRecommendationTargets(context = null) {
  const rows = [
    ...(Array.isArray(context?.topFindings) ? context.topFindings : []),
    ...(Array.isArray(context?.selectedActions) ? context.selectedActions : [])
  ];
  const seen = new Set();
  return rows.filter((row) => {
    const id = String(row?.id || "").trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function isOpenAISelectableActionTarget(target = null) {
  if (!target?.id) return false;
  const gate = String(target.gate || "").toLowerCase();
  const risk = String(target.risk || "").toLowerCase();
  if (gate === "blocked" || gate === "advisory") return false;
  if (risk === "restricted" || risk === "advisory" || risk === "advanced") return false;
  return true;
}

function getReviewRecommendationTarget(context = null, targetId = "", route = "") {
  const cleanRoute = String(route || "").trim();
  const groups = [
    { actionId: "node-modules-old", route: "item-review-project-cache", rows: context?.projectDependencyReviewTargets },
    { actionId: "node-modules-old", route: "item-review-project-cache", rows: context?.reviewedProjectTargets },
    { actionId: "downloads-installers", route: "item-review-recycle-bin", rows: context?.reviewedDownloadsTargets },
    { actionId: "large-user-files", route: "item-review-large-files", rows: context?.largeFileArchiveTargets },
    { actionId: "installed-app-footprints", route: "manual-app-uninstall", rows: context?.manualReviewTargets }
  ];
  for (const group of groups) {
    if (cleanRoute && group.route !== cleanRoute) continue;
    const match = (Array.isArray(group.rows) ? group.rows : []).find((target) => targetMatchesRecommendationId(target, targetId));
    if (match) return { ...match, focusActionId: group.actionId };
  }
  return null;
}

function getExecutorRecommendationButtonLabel(actionType) {
  switch (actionType) {
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
    default:
      return "Open recommendation";
  }
}

function getExecutorRecommendationPanel(actionType) {
  switch (actionType) {
    case "run-temp-executor":
      return "first-safe-temp-executor-panel";
    case "run-downloads-cleanup-executor":
      return "downloads-cleanup-executor-panel";
    case "run-large-file-archive-executor":
      return "large-file-archive-executor-panel";
    case "run-project-deps-executor":
      return "project-dependency-executor-panel";
    case "run-browser-cache-executor":
      return "browser-cache-executor-panel";
    case "run-gradle-cache-executor":
      return "gradle-cache-executor-panel";
    case "run-user-cache-executor":
      return "user-cache-executor-panel";
    case "run-android-cache-executor":
      return "android-cache-executor-panel";
    case "run-shader-cache-executor":
      return "shader-cache-executor-panel";
    case "run-pip-cache-executor":
      return "pip-cache-executor-panel";
    case "run-docker-build-cache-executor":
      return "docker-build-cache-executor-panel";
    case "run-npm-cache-executor":
      return "npm-cache-executor-panel";
    case "run-pnpm-store-executor":
      return "pnpm-store-executor-panel";
    case "run-recycle-bin-executor":
      return "recycle-bin-executor-panel";
    default:
      return "openai-agent-panel";
  }
}

function getManualRecommendationPanel(row = {}) {
  const targetId = String(row.targetId || row.target_id || row.id || "").toLowerCase();
  const route = String(row.route || "").toLowerCase();
  if (targetId.startsWith("custom-root") || route.includes("custom-root")) return "custom-root-triage-panel";
  if (targetId.startsWith("drive-") || route.includes("drive-inventory")) return "drive-inventory-panel";
  if (targetId.includes("selected-route-proof") || route.includes("validation-evidence")) return "validation-evidence-panel";
  if (targetId.includes("installed-app") || route.includes("manual-app-uninstall")) return "app-uninstall-work-order-panel";
  if (targetId.includes("wsl") || route.includes("advanced-checklist")) return "wsl-compaction-work-order-panel";
  return "item-review-panel";
}

function compactOpenAIAgentRecommendationBroker(broker = null) {
  if (!broker || typeof broker !== "object") {
    return {
      schemaVersion: "spaceguard-openai-recommendation-broker-summary/v1",
      status: "not-recorded",
      advisoryOnly: true,
      directToolAccess: false,
      counts: { recommendations: 0, ready: 0, blocked: 0, scopedExecutors: 0 },
      rows: []
    };
  }
  return {
    schemaVersion: "spaceguard-openai-recommendation-broker-summary/v1",
    sourceSchemaVersion: broker.schemaVersion || "",
    status: broker.status || "unknown",
    advisoryOnly: true,
    directToolAccess: false,
    counts: {
      recommendations: Number(broker.counts?.recommendations || 0),
      ready: Number(broker.counts?.ready || 0),
      blocked: Number(broker.counts?.blocked || 0),
      scopedExecutors: Number(broker.counts?.scopedExecutors || 0)
    },
    rows: (broker.rows || []).slice(0, 8).map((row) => ({
      key: row.key || getOpenAIAgentRecommendationKey(row),
      actionType: row.actionType || "manual-only",
      targetId: row.targetId || "",
      route: row.route || "",
      recommendedRoute: row.recommendedRoute || "",
      executorRoute: row.executorRoute || "",
      kind: row.kind || "",
      status: row.status || "unknown",
      canAct: Boolean(row.canAct),
      targetPanel: row.targetPanel || "",
      blockedCheckIds: (row.checks || []).filter((check) => !check.passed).map((check) => check.id).slice(0, 8),
      checkIds: (row.checks || []).map((check) => check.id).slice(0, 12)
    }))
  };
}

export function normalizeOpenAIAgentRunHistory(history = [], { limit = 20 } = {}) {
  return (Array.isArray(history) ? history : [])
    .filter(isOpenAIAgentRunRecord)
    .slice(-limit);
}

function compactOpenAIAgentRunContext(context = null, planSnapshot = null) {
  const plan = context?.plan || {};
  const selectedActions = Array.isArray(context?.selectedActions) ? context.selectedActions : [];
  return {
    schemaVersion: "spaceguard-openai-agent-context-summary/v1",
    generatedAt: context?.generatedAt || "",
    plan: {
      id: planSnapshot?.id || plan.id || "",
      scanMode: planSnapshot?.scanMode || plan.scanMode || context?.machine?.scanMode || "unknown",
      selectedCount: Number(planSnapshot?.selectedCount ?? plan.selectedCount ?? selectedActions.length),
      selectedBytes: Number(planSnapshot?.selectedBytes ?? plan.selectedBytes ?? 0),
      goalBytes: Number(planSnapshot?.goalBytes || planSnapshot?.payload?.goalBytes || plan.goalBytes || 0),
      selectedIds: Array.isArray(planSnapshot?.selectedIds) ? planSnapshot.selectedIds.slice(0, 24) : (plan.selectedIds || selectedActions.map((action) => action.id)).slice(0, 24)
    },
    readiness: { ...(context?.readiness || {}) },
    runtime: {
      nativeAvailable: Boolean(context?.runtime?.nativeAvailable),
      windows: Boolean(context?.runtime?.windows),
      realRunEnabled: Boolean(context?.runtime?.realRunEnabled),
      destructiveCommands: Boolean(context?.runtime?.destructiveCommands),
      enabledScopedExecutorFlags: Array.isArray(context?.runtime?.enabledScopedExecutorFlags)
        ? context.runtime.enabledScopedExecutorFlags.slice(0, 14)
        : getOpenAIEnabledScopedExecutorFlags(context?.runtime || {}),
      enabledScopedExecutorFlagCount: Number(context?.runtime?.enabledScopedExecutorFlagCount || getOpenAIEnabledScopedExecutorFlags(context?.runtime || {}).length),
      executorScopeStatus: context?.runtime?.executorScopeStatus || "unknown",
      toolNativePruneExecutors: Boolean(context?.runtime?.toolNativePruneExecutors),
      openAiAgentAdvice: Boolean(context?.runtime?.openAiAgentAdvice),
      openAiAdvisorConfigured: Boolean(context?.runtime?.openAiAdvisorConfigured)
    },
    execution: {
      planId: context?.execution?.planId || planSnapshot?.id || plan.id || "",
      scanFingerprintPresent: Boolean(context?.execution?.scanFingerprintPresent || context?.execution?.scanFingerprint),
      consentMatchesPlan: Boolean(context?.execution?.consentMatchesPlan),
      writeReadinessStatus: context?.execution?.writeReadinessStatus || "unknown",
      readyForRealExecution: Boolean(context?.execution?.readyForRealExecution),
      releaseReadyForRealRun: Boolean(context?.execution?.releaseReadyForRealRun),
      validationReadyForRealRun: Boolean(context?.execution?.validationReadyForRealRun),
      proofStatus: context?.execution?.proofStatus || "waiting-for-execution",
      proofAllowsNextExecutor: Boolean(context?.execution?.proofAllowsNextExecutor),
      canRunPostRunRescan: Boolean(context?.execution?.canRunPostRunRescan),
      rescanComparisonStatus: context?.execution?.rescanComparisonStatus || "not-run",
      postRunScanEvidence: Boolean(context?.execution?.postRunScanEvidence),
      selectedExecutorRoutes: (context?.execution?.selectedExecutorRoutes || []).slice(0, 12).map((row) => ({
        id: row.id || "",
        route: row.route || "",
        canExecute: Boolean(row.canExecute),
        canSimulate: Boolean(row.canSimulate),
        bytes: Number(row.bytes || 0)
      }))
    },
    liveRouteValidation: compactOpenAILiveRouteValidationContext(context?.liveRouteValidation),
    counts: {
      selectedActions: selectedActions.length,
      topFindings: Array.isArray(context?.topFindings) ? context.topFindings.length : 0,
      executableRows: Array.isArray(context?.executableRows) ? context.executableRows.length : 0,
      projectDependencyReviewTargets: Array.isArray(context?.projectDependencyReviewTargets) ? context.projectDependencyReviewTargets.length : 0,
      reviewedDownloadsTargets: Array.isArray(context?.reviewedDownloadsTargets) ? context.reviewedDownloadsTargets.length : 0,
      reviewedProjectTargets: Array.isArray(context?.reviewedProjectTargets) ? context.reviewedProjectTargets.length : 0,
      largeFileArchiveTargets: Array.isArray(context?.largeFileArchiveTargets) ? context.largeFileArchiveTargets.length : 0,
      gradleCacheTargets: Array.isArray(context?.gradleCacheTargets) ? context.gradleCacheTargets.length : 0,
      userCacheTargets: Array.isArray(context?.userCacheTargets) ? context.userCacheTargets.length : 0,
      androidCacheTargets: Array.isArray(context?.androidCacheTargets) ? context.androidCacheTargets.length : 0,
      shaderCacheTargets: Array.isArray(context?.shaderCacheTargets) ? context.shaderCacheTargets.length : 0,
      pipCacheTargets: Array.isArray(context?.pipCacheTargets) ? context.pipCacheTargets.length : 0,
      dockerBuildCacheTargets: Array.isArray(context?.dockerBuildCacheTargets) ? context.dockerBuildCacheTargets.length : 0,
      npmCacheTargets: Array.isArray(context?.npmCacheTargets) ? context.npmCacheTargets.length : 0,
      pnpmStoreTargets: Array.isArray(context?.pnpmStoreTargets) ? context.pnpmStoreTargets.length : 0,
      recycleBinTargets: Array.isArray(context?.recycleBinTargets) ? context.recycleBinTargets.length : 0,
      wslVhdxTargets: Array.isArray(context?.wslVhdxTargets) ? context.wslVhdxTargets.length : 0,
      browserCacheTargets: Array.isArray(context?.browserCacheTargets) ? context.browserCacheTargets.length : 0,
      manualReviewTargets: Array.isArray(context?.manualReviewTargets) ? context.manualReviewTargets.length : 0,
      installedAppReviewRows: Array.isArray(context?.installedAppReview?.rows) ? context.installedAppReview.rows.length : 0,
      installedAppWorkOrderRows: Array.isArray(context?.installedAppUninstallWorkOrder?.rows) ? context.installedAppUninstallWorkOrder.rows.length : 0,
      wslCompactionRows: Array.isArray(context?.wslCompactionWorkOrder?.rows) ? context.wslCompactionWorkOrder.rows.length : 0,
      driveInventoryRows: Array.isArray(context?.driveInventoryRows) ? context.driveInventoryRows.length : 0,
      customRootRows: Array.isArray(context?.customRootRows) ? context.customRootRows.length : 0,
      agentTaskQueueRows: Array.isArray(context?.agentTaskQueue?.rows) ? context.agentTaskQueue.rows.length : 0,
      candidateSamples: Array.isArray(context?.candidateSamples) ? context.candidateSamples.length : 0
    },
    selectedActionIds: selectedActions.map((action) => action.id).filter(Boolean).slice(0, 24),
    actionTypes: Array.from(new Set(selectedActions.map((action) => action.route || action.gate || action.risk).filter(Boolean))).slice(0, 12),
    privacy: {
      directFilesystemAccess: Boolean(context?.appBoundary?.directFilesystemAccess),
      directDeleteAuthority: Boolean(context?.appBoundary?.directDeleteAuthority),
      storesRawModelText: false,
      storesFullContext: false
    }
  };
}

function compactOpenAILiveRouteValidationContext(value = null) {
  if (!value || value.schemaVersion !== "spaceguard-openai-live-route-validation/v1") return null;
  return {
    schemaVersion: value.schemaVersion,
    route: String(value.route || ""),
    routeInput: String(value.routeInput || ""),
    title: String(value.title || ""),
    status: String(value.status || ""),
    envVar: String(value.envVar || ""),
    requestMode: String(value.requestMode || ""),
    panelId: String(value.panelId || ""),
    actionLabel: String(value.actionLabel || ""),
    routeFlagReady: Boolean(value.routeFlagReady),
    canAttemptWindowsValidation: Boolean(value.canAttemptWindowsValidation),
    canExecuteWithoutAppEvidence: false,
    singleScopedFlagRequired: Boolean(value.singleScopedFlagRequired),
    requiredEnabledFlag: String(value.requiredEnabledFlag || value.envVar || ""),
    disabledReason: String(value.disabledReason || ""),
    requiredAppEvidence: normalizeStringList(value.requiredAppEvidence),
    requiredPostRunProof: normalizeStringList(value.requiredPostRunProof),
    nativeBoundary: {
      tauriCommand: String(value.nativeBoundary?.tauriCommand || ""),
      adapterFunction: String(value.nativeBoundary?.adapterFunction || ""),
      rustFunction: String(value.nativeBoundary?.rustFunction || ""),
      targetAllowlist: normalizeStringList(value.nativeBoundary?.targetAllowlist || value.targetAllowlist),
      targetRejects: normalizeStringList(value.nativeBoundary?.targetRejects || value.targetRejects),
      deletePolicy: normalizeStringList(value.nativeBoundary?.deletePolicy || value.deletePolicy)
    },
    deletePolicy: normalizeStringList(value.deletePolicy || value.nativeBoundary?.deletePolicy)
  };
}

function isOpenAIAgentRunRecord(record) {
  return Boolean(
    record &&
      typeof record === "object" &&
      record.schemaVersion === "spaceguard-openai-agent-run/v1" &&
      typeof record.id === "string" &&
      typeof record.createdAt === "string" &&
      Array.isArray(record.recommendedActions) &&
      Array.isArray(record.blockedActions)
  );
}

function buildOpenAIAgentRunId(record = {}) {
  const suffix = record.responseId || record.requestId || `${record.createdAt}-${record.planId}-${record.nextAction}`;
  return `openai-run-${String(suffix || "unknown").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 96)}`;
}

export async function requestOpenAIAgentAdvice({
  context,
  userPrompt,
  config = getOpenAIAgentConfig(),
  fetchImpl = globalThis.fetch,
  host = globalThis
} = {}) {
  const nativeCapability = getNativeOpenAIAgentCapability(host);
  if (nativeCapability.available) {
    const result = await host.__TAURI__.core.invoke(NATIVE_OPENAI_AGENT_COMMAND, {
      request: {
        userPrompt: String(userPrompt || "Find the fastest safe path to recover space from this scan."),
        context,
        model: config.model || DEFAULT_OPENAI_MODEL,
        reasoningEffort: config.reasoningEffort || DEFAULT_OPENAI_REASONING_EFFORT
      }
    });
    return normalizeOpenAIAgentResult(result, {
      fallbackModel: config.model || DEFAULT_OPENAI_MODEL,
      transport: nativeCapability.transport
    });
  }

  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch is not available in this runtime.");
  }
  if (!config?.apiKey && config?.localProxyConfigured) {
    const response = await fetchImpl(config.localProxyEndpoint || DEFAULT_OPENAI_PROXY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userPrompt: String(userPrompt || "Find the fastest safe path to recover space from this scan."),
        context,
        model: config.model || DEFAULT_OPENAI_MODEL,
        reasoningEffort: config.reasoningEffort || DEFAULT_OPENAI_REASONING_EFFORT
      })
    });
    const requestId = response.headers?.get?.("x-request-id") || "";
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || `OpenAI proxy request failed with HTTP ${response.status}.`;
      throw new Error(requestId ? `${message} Request id: ${requestId}` : message);
    }
    return normalizeOpenAIAgentResult(payload, {
      fallbackModel: config.model || DEFAULT_OPENAI_MODEL,
      transport: "vite-dev-proxy"
    });
  }
  if (!config?.apiKey) {
    throw new Error("Set OPENAI_API_KEY in .env and restart the Vite/Tauri dev server.");
  }

  const body = {
    model: config.model || DEFAULT_OPENAI_MODEL,
    store: false,
    text: {
      format: OPENAI_AGENT_RESPONSE_FORMAT
    },
    instructions: [
      "You are the SpaceGuard local Windows cleanup advisor.",
      "You never claim you scanned the computer yourself; you only interpret the provided app context.",
      "You cannot approve gates, modify files, run shell commands, or delete data.",
      "Manual review targets such as installed app footprints, custom roots, and broad drive inventory rows are advisory only; never recommend direct folder deletion or automated uninstall.",
      "Use context.agentTaskQueue.rows as the primary task list. When recommending one of those tasks, copy its actionType, targetId, and route exactly.",
      "When context.liveRouteValidation is present, treat it as the selected live route contract and do not recommend a different executor route until its proof is complete.",
      "When a scoped executor is visible, recommend the exact UI button only after the context says current consent and route-specific targets exist.",
      "If execution.proofAllowsNextExecutor is false, recommend post-run rescan or proof review instead of another executor.",
      "Use execution.consentMatchesPlan, execution.scanFingerprintPresent, and execution.proofStatus when explaining blockers.",
      "Use actionType values from the schema. Keep targetId empty unless you are referring to a provided target id.",
      "Prioritize concrete next steps that move toward real safe cleanup.",
      "Return structured JSON that matches the provided response schema."
    ].join(" "),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(
              {
                userPrompt: String(userPrompt || "Find the fastest safe path to recover space from this scan."),
                context
              },
              null,
              2
            )
          }
        ]
      }
    ],
    max_output_tokens: 1200
  };
  if (config.reasoningEffort && config.reasoningEffort !== "default") {
    body.reasoning = { effort: config.reasoningEffort };
  }

  const response = await fetchImpl(config.endpoint || DEFAULT_OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(body)
  });

  const requestId = response.headers?.get?.("x-request-id") || "";
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `OpenAI request failed with HTTP ${response.status}.`;
    throw new Error(requestId ? `${message} Request id: ${requestId}` : message);
  }

  const text = extractOpenAIResponseText(payload);
  return normalizeOpenAIAgentResult({
    schemaVersion: "spaceguard-openai-agent-advice/v1",
    provider: "openai",
    model: payload?.model || config.model,
    requestId,
    createdAt: new Date().toISOString(),
    rawText: text,
    advice: parseAgentAdvice(text),
    responseId: payload?.id || ""
  }, { fallbackModel: config.model, transport: "browser-fetch" });
}

function buildManualReviewTargets({ nativeScan = null, itemReviewsByAction = null } = {}) {
  const appReview = itemReviewsByAction?.["installed-app-footprints"];
  const sourceItems = appReview?.items?.length
    ? appReview.items
    : (nativeScan?.findings || [])
        .filter((finding) => finding.recipeId === "installed-app-footprints")
        .flatMap((finding) => finding.items || []);

  return sourceItems
    .slice()
    .sort((left, right) => Number(right.bytes || 0) - Number(left.bytes || 0))
    .slice(0, 12)
    .map((item) => ({
      id: item.id || "",
      name: item.name || "",
      route: "manual-app-uninstall",
      path: item.path || "",
      bytes: Number(item.bytes || 0),
      ageDays: Number(item.ageDays || 0),
      kind: item.kind || "installed app footprint",
      recommendation: item.recommendation || "review",
      decision: item.decision || "undecided",
      selectedForRemoval: false,
      canCreateExecutor: false,
      manualOnly: true,
      officialAction: "Use Windows Settings or the vendor uninstaller only.",
      reason: item.reason || "Installed app footprint is manual review evidence, not an automated cleanup target.",
      signals: normalizeAgentReviewSignals(item.signals)
    }));
}

function buildInstalledAppEvidenceSummaryContext({
  nativeScan = null,
  itemReviewsByAction = null,
  manualReviewTargets = []
} = {}) {
  const appReview = itemReviewsByAction?.["installed-app-footprints"];
  const nativeFinding = (nativeScan?.findings || []).find((finding) => finding.recipeId === "installed-app-footprints") || null;
  return normalizeAgentInstalledAppEvidenceSummary(
    appReview?.evidenceSummary || nativeFinding?.evidenceSummary,
    manualReviewTargets,
    appReview?.evidenceSummary?.metadataSources || nativeFinding?.metadataSources
  );
}

function normalizeAgentInstalledAppEvidenceSummary(source = null, rows = [], metadataSources = null) {
  const rowList = Array.isArray(rows) ? rows : [];
  const summary = source && typeof source === "object" ? source : {};
  const sourceMetadata = summary.metadataSources || metadataSources || {};
  return {
    metadataSources: {
      uninstallRegistry: sourceMetadata.uninstallRegistry || sourceMetadata.uninstall_registry || "unknown",
      userAssist: sourceMetadata.userAssist || sourceMetadata.user_assist || "unknown",
      uninstallRegistryRows: Number(sourceMetadata.uninstallRegistryRows || sourceMetadata.uninstall_registry_rows || 0),
      userAssistRows: Number(sourceMetadata.userAssistRows || sourceMetadata.user_assist_rows || 0)
    },
    candidateCount: Number(summary.candidateCount || summary.candidate_count || rowList.length || 0),
    registryMatched: Number(
      summary.registryMatched ??
      summary.registry_matched ??
      rowList.filter((row) => getAgentSignalValue(row.signals, "registry match") === "Windows uninstall metadata").length
    ),
    userAssistMatched: Number(
      summary.userAssistMatched ??
      summary.user_assist_matched ??
      rowList.filter((row) => String(getAgentSignalValue(row.signals, "usage proof") || "").includes("UserAssist")).length
    ),
    usageProofMissing: Number(
      summary.usageProofMissing ??
      summary.usage_proof_missing ??
      rowList.filter((row) => (getAgentSignalValue(row.signals, "usage proof") || "not proven") === "not proven").length
    ),
    manualOnly: summary.manualOnly ?? summary.manual_only ?? true,
    canCreateExecutor: summary.canCreateExecutor ?? summary.can_create_executor ?? false
  };
}

function buildProjectDependencyReviewTargets({ nativeScan = null, itemReviewsByAction = null } = {}) {
  const projectReview = itemReviewsByAction?.["node-modules-old"];
  const sourceItems = projectReview?.items?.length
    ? projectReview.items
    : (nativeScan?.findings || [])
        .filter((finding) => finding.recipeId === "node-modules-old")
        .flatMap((finding) => finding.items || []);

  return sourceItems
    .slice()
    .sort((left, right) => Number(right.bytes || 0) - Number(left.bytes || 0))
    .slice(0, 16)
    .map((item) => ({
      id: item.id || "",
      name: item.name || "",
      route: "item-review-project-cache",
      path: item.path || "",
      bytes: Number(item.bytes || 0),
      ageDays: Number(item.ageDays || 0),
      kind: item.kind || "project dependency folder",
      recommendation: item.recommendation || "review",
      decision: item.decision || "undecided",
      canCreateExecutor: false,
      manualOnly: false,
      executorRequiresUserRemoveDecision: true,
      reason: item.reason || "Project dependency folder needs user review before it can become a reviewed Remove target.",
      signals: normalizeAgentReviewSignals(item.signals)
    }));
}

function buildInstalledAppReviewContext(manualReviewTargets = [], evidenceSummary = null) {
  const rows = manualReviewTargets
    .map((target) => {
      const usageProof = getAgentSignalValue(target.signals, "usage proof") || "not proven";
      const uninstallEntry = getAgentSignalValue(target.signals, "uninstall entry") || "unknown";
      const registryMatch = getAgentSignalValue(target.signals, "registry match") || "none";
      const status = target.decision === "remove"
        ? "manual-uninstall-selected"
        : target.recommendation === "review"
          ? "needs-user-confirmation"
          : "keep-or-low-confidence";
      const unusedReview = buildAgentUnusedReviewScore({
        usageProof,
        uninstallEntry,
        registryMatch,
        recommendation: target.recommendation,
        decision: target.decision,
        ageDays: target.ageDays,
        bytes: target.bytes
      });
      return {
        id: target.id,
        name: target.name,
        route: target.route,
        path: target.path,
        bytes: Number(target.bytes || 0),
        ageDays: Number(target.ageDays || 0),
        kind: target.kind,
        status,
        decision: target.decision || "undecided",
        usageProof,
        uninstallEntry,
        registryMatch,
        unusedReviewScore: unusedReview.score,
        unusedReviewTier: unusedReview.tier,
        scoreFactors: unusedReview.factors,
        manualOnly: true,
        canCreateExecutor: false,
        officialAction: target.officialAction || "Use Windows Settings or the vendor uninstaller only.",
        reason: target.reason || ""
      };
    })
    .slice(0, 12);
  return {
    schemaVersion: "spaceguard-installed-app-review-context/v1",
    manualOnly: true,
    canCreateExecutor: false,
    evidenceSummary,
    rows,
    counts: {
      total: rows.length,
      review: rows.filter((row) => row.status === "needs-user-confirmation").length,
      selected: rows.filter((row) => row.status === "manual-uninstall-selected").length,
      uninstallEntry: rows.filter((row) => row.uninstallEntry === "present").length,
      usageProofMissing: rows.filter((row) => row.usageProof === "not proven").length
    },
    forbiddenActions: ["automated-uninstall", "delete-program-files", "run-uninstall-string", "edit-registry"]
  };
}

function buildInstalledAppUninstallWorkOrderContext(installedAppReview = null, {
  planId = "",
  scanFingerprint = "",
  rescanComparisonStatus = "not-run"
} = {}) {
  const rows = (installedAppReview?.rows || [])
    .filter((row) => row.status === "manual-uninstall-selected")
    .map((row) => ({
      id: row.id,
      name: row.name,
      route: "manual-app-uninstall",
      path: row.path,
      bytes: Number(row.bytes || 0),
      ageDays: Number(row.ageDays || 0),
      usageProof: row.usageProof || "not proven",
      uninstallEntry: row.uninstallEntry || "unknown",
      registryMatch: row.registryMatch || "none",
      unusedReviewScore: Number(row.unusedReviewScore || 0),
      unusedReviewTier: row.unusedReviewTier || "weak-review",
      scoreFactors: Array.isArray(row.scoreFactors) ? row.scoreFactors.slice(0, 6) : [],
      officialAction: row.officialAction || "Use Windows Settings or the vendor uninstaller only.",
      manualOnly: true,
      canCreateExecutor: false
    }))
    .slice(0, 12);
  const status = rows.length
    ? "ready-for-manual-uninstall"
    : installedAppReview?.counts?.review
      ? "needs-user-selection"
      : "no-selected-apps";
  return {
    schemaVersion: "spaceguard-app-uninstall-work-order-context/v1",
    status,
    manualOnly: true,
    canCreateExecutor: false,
    directDeleteAuthority: false,
    canRunUninstaller: false,
    planId,
    scanFingerprintPresent: Boolean(scanFingerprint),
    rescanComparisonStatus,
    selectedBytes: rows.reduce((sum, row) => sum + Number(row.bytes || 0), 0),
    rows,
    counts: {
      selected: rows.length,
      uninstallEntry: rows.filter((row) => row.uninstallEntry === "present").length,
      usageProofMissing: rows.filter((row) => row.usageProof === "not proven").length
    },
    requiredUserSteps: [
      "Confirm the selected app is recognized and unused.",
      "Use Windows Settings or the vendor uninstaller.",
      "Do not delete Program Files folders.",
      "Run a native rescan after uninstall."
    ],
    forbiddenActions: ["automated-uninstall", "delete-program-files", "run-uninstall-string", "edit-registry"]
  };
}

function buildAgentUnusedReviewScore({
  usageProof = "not proven",
  uninstallEntry = "unknown",
  registryMatch = "none",
  recommendation = "review",
  decision = "undecided",
  ageDays = 0,
  bytes = 0
} = {}) {
  let score = 0;
  const factors = [];
  const usage = String(usageProof || "not proven").toLowerCase();
  if (usage.includes("userassist")) {
    score -= 35;
    factors.push("UserAssist launch evidence lowers uninstall confidence");
  } else if (usage === "not proven" || usage.includes("not proven")) {
    score += 30;
    factors.push("missing UserAssist usage proof");
  } else {
    factors.push("usage evidence is ambiguous");
  }

  const age = Number(ageDays || 0);
  if (age >= 180) {
    score += 20;
    factors.push("older than 180 days");
  } else if (age >= 90) {
    score += 12;
    factors.push("older than 90 days");
  } else if (age >= 45) {
    score += 6;
    factors.push("older than 45 days");
  } else {
    factors.push("recent or unknown modification age");
  }

  const size = Number(bytes || 0);
  if (size >= 5 * 1024 ** 3) {
    score += 15;
    factors.push("large 5GB+ footprint");
  } else if (size >= 1024 ** 3) {
    score += 8;
    factors.push("large 1GB+ footprint");
  }

  if (uninstallEntry === "present") {
    score += 8;
    factors.push("Windows uninstall entry present");
  } else if (uninstallEntry === "missing") {
    score -= 8;
    factors.push("uninstall entry missing");
  }

  if (registryMatch && registryMatch !== "none") {
    score += 5;
    factors.push("Windows uninstall metadata matched");
  }

  if (recommendation === "review") {
    score += 10;
    factors.push("scanner marked for user review");
  } else if (recommendation === "keep") {
    score -= 10;
    factors.push("scanner recommended keeping without user confirmation");
  }

  if (decision === "remove") {
    factors.push("user marked for manual uninstall follow-up");
  }

  const bounded = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: bounded,
    tier: bounded >= 70 ? "strong-review" : bounded >= 45 ? "moderate-review" : "weak-review",
    factors
  };
}

function buildWslCompactionWorkOrderContext(wslVhdxTargets = [], {
  selected = false,
  typedConfirmed = false,
  planId = "",
  scanFingerprint = "",
  rescanComparisonStatus = "not-run"
} = {}) {
  const rows = (Array.isArray(wslVhdxTargets) ? wslVhdxTargets : []).slice(0, 12);
  const status = !rows.length
    ? "no-wsl-vhdx"
    : !selected
      ? "not-selected"
      : !typedConfirmed
        ? "needs-typed-ack"
        : "ready-for-manual-compaction";
  return {
    schemaVersion: "spaceguard-wsl-compaction-work-order-context/v1",
    status,
    manualOnly: true,
    canCreateExecutor: false,
    directDeleteAuthority: false,
    canRunShell: false,
    canCompactVhdx: false,
    planId,
    scanFingerprintPresent: Boolean(scanFingerprint),
    typedPhrase: "COMPACT WSL",
    typedConfirmed: Boolean(typedConfirmed),
    rescanComparisonStatus,
    totalVhdxBytes: rows.reduce((sum, row) => sum + Number(row.bytes || 0), 0),
    rows: rows.map((row) => ({
      id: row.id,
      title: row.title,
      route: "advanced-checklist",
      path: row.path,
      bytes: Number(row.bytes || 0),
      status: row.status || "unknown",
      manualOnly: true,
      canCreateExecutor: false
    })),
    requiredUserSteps: [
      "Back up or export the distro.",
      "Shut down WSL outside SpaceGuard.",
      "Compact the VHDX outside SpaceGuard.",
      "Boot the distro and verify files.",
      "Run a native rescan after compaction."
    ],
    forbiddenActions: ["run-wsl-exe", "run-powershell", "run-optimize-vhd", "delete-vhdx", "change-partitions"]
  };
}

function getAgentSignalValue(signals = [], label = "") {
  const match = (Array.isArray(signals) ? signals : []).find((signal) => signal.label.toLowerCase() === label.toLowerCase());
  return match?.value || "";
}

function normalizeAgentReviewSignals(value = []) {
  return Array.isArray(value)
    ? value
        .map((signal) => ({
          label: String(signal?.label || signal?.name || "").trim(),
          value: String(signal?.value || signal?.detail || "").trim(),
          tone: normalizeAgentSignalTone(signal?.tone || signal?.status || "")
        }))
        .filter((signal) => signal.label || signal.value)
        .slice(0, 8)
    : [];
}

function normalizeAgentSignalTone(value = "") {
  const clean = String(value || "").trim().toLowerCase();
  if (clean === "safe" || clean === "review" || clean === "restricted" || clean === "advanced") return clean;
  return "outline";
}

function toAgentAction(action = {}) {
  return {
    id: action.id,
    title: action.title,
    risk: action.risk,
    gate: action.gate,
    route: action.route || "",
    method: action.method || "",
    path: action.path || "",
    bytes: Number(action.bytes || 0),
    scanStatus: action.scanStatus || "unknown",
    consequence: action.consequence || ""
  };
}

function extractOpenAIResponseText(payload = {}) {
  if (typeof payload.output_text === "string") return payload.output_text.trim();
  const parts = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") parts.push(content.text);
      if (typeof content.output_text === "string") parts.push(content.output_text);
    }
  }
  return parts.join("\n").trim();
}

function normalizeOpenAIAgentResult(result = {}, { fallbackModel = DEFAULT_OPENAI_MODEL, transport = "browser-fetch" } = {}) {
  const rawText = String(result.rawText || result.raw_text || "");
  const fallback = {
    summary: rawText || "OpenAI returned no text.",
    nextAction: "Review the raw response.",
    confidence: "low",
    recommendedActions: [],
    blockedActions: [],
    questions: [],
    warnings: []
  };
  const advice = result.advice && typeof result.advice === "object"
    ? normalizeAgentAdviceObject(result.advice, fallback)
    : parseAgentAdvice(rawText);
  return {
    schemaVersion: result.schemaVersion || result.schema_version || "spaceguard-openai-agent-advice/v1",
    provider: result.provider || "openai",
    model: result.model || fallbackModel || DEFAULT_OPENAI_MODEL,
    requestId: result.requestId || result.request_id || "",
    createdAt: result.createdAt || result.created_at || new Date().toISOString(),
    rawText,
    advice,
    responseId: result.responseId || result.response_id || "",
    keySource: result.keySource || result.key_source || "",
    transport: result.transport || transport,
    warnings: Array.isArray(result.warnings) ? result.warnings.map((warning) => String(warning || "")).filter(Boolean) : []
  };
}

function parseAgentAdvice(text) {
  const fallback = {
    summary: text || "OpenAI returned no text.",
    nextAction: "Review the raw response.",
    confidence: "low",
    recommendedActions: [],
    blockedActions: [],
    questions: [],
    warnings: []
  };
  if (!text) return fallback;

  try {
    const parsed = JSON.parse(stripJsonFence(text));
    return normalizeAgentAdviceObject(parsed, fallback);
  } catch {
    return fallback;
  }
}

function normalizeAgentAdviceObject(parsed = {}, fallback) {
  return {
    summary: String(parsed.summary || fallback.summary),
    nextAction: String(parsed.nextAction || parsed.next_action || fallback.nextAction),
    confidence: normalizeConfidence(parsed.confidence),
    recommendedActions: normalizeAdviceRows(parsed.recommendedActions || parsed.recommended_actions),
    blockedActions: normalizeAdviceRows(parsed.blockedActions || parsed.blocked_actions),
    questions: normalizeStringList(parsed.questions),
    warnings: normalizeStringList(parsed.warnings)
  };
}

function stripJsonFence(text) {
  return String(text || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function normalizeConfidence(value) {
  const clean = String(value || "").toLowerCase();
  if (clean === "high" || clean === "medium" || clean === "low") return clean;
  return "medium";
}

function normalizeAdviceRows(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).map((row, index) => {
    if (typeof row === "string") {
      return { id: `row-${index + 1}`, title: row, reason: "", priority: "medium" };
    }
    return {
      id: String(row?.id || `row-${index + 1}`),
      title: String(row?.title || row?.action || row?.name || "Recommendation"),
      reason: String(row?.reason || row?.why || row?.detail || ""),
      priority: normalizePriority(row?.priority),
      actionType: normalizeActionType(row?.actionType || row?.action_type),
      targetId: String(row?.targetId || row?.target_id || ""),
      route: String(row?.route || "")
    };
  });
}

function normalizePriority(value) {
  const clean = String(value || "").toLowerCase();
  if (clean === "high" || clean === "medium" || clean === "low") return clean;
  return "medium";
}

function normalizeActionType(value) {
  const clean = String(value || "").toLowerCase();
  if (
    clean === "select-action" ||
    clean === "review-target" ||
    clean === "run-temp-executor" ||
    clean === "run-downloads-cleanup-executor" ||
    clean === "run-large-file-archive-executor" ||
    clean === "run-project-deps-executor" ||
    clean === "run-browser-cache-executor" ||
    clean === "run-gradle-cache-executor" ||
    clean === "run-user-cache-executor" ||
    clean === "run-android-cache-executor" ||
    clean === "run-shader-cache-executor" ||
    clean === "run-pip-cache-executor" ||
    clean === "run-docker-build-cache-executor" ||
    clean === "run-npm-cache-executor" ||
    clean === "run-pnpm-store-executor" ||
    clean === "run-recycle-bin-executor" ||
    clean === "rescan" ||
    clean === "ask-user" ||
    clean === "manual-only"
  ) {
    return clean;
  }
  return "manual-only";
}

function normalizeReasoningEffort(value) {
  const clean = String(value || "").toLowerCase().trim();
  if (clean === "default" || clean === "none" || clean === "minimal" || clean === "low" || clean === "medium" || clean === "high" || clean === "xhigh") {
    return clean;
  }
  return DEFAULT_OPENAI_REASONING_EFFORT;
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).map((item) => String(item || "").trim()).filter(Boolean);
}
