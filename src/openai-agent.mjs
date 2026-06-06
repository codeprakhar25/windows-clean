const DEFAULT_OPENAI_MODEL = "gpt-5.2";
const DEFAULT_OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
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
  const reasoningEffort = normalizeReasoningEffort(env.OPENAI_REASONING_EFFORT || env.VITE_OPENAI_REASONING_EFFORT || DEFAULT_OPENAI_REASONING_EFFORT);
  const keySource = apiKey ? (env.OPENAI_API_KEY ? "OPENAI_API_KEY" : "VITE_OPENAI_API_KEY") : "missing";

  return {
    provider: "openai",
    connected: Boolean(apiKey),
    configured: Boolean(apiKey),
    apiKey,
    model,
    endpoint,
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
  planSnapshot
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
  const manualReviewTargets = buildManualReviewTargets({ nativeScan, itemReviewsByAction });
  const installedAppReview = buildInstalledAppReviewContext(manualReviewTargets);
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
    runtime: {
      nativeAvailable: Boolean(runtimeCapabilities?.available),
      windows: Boolean(runtimeCapabilities?.windows),
      realRunEnabled: Boolean(runtimeCapabilities?.realRunEnabled),
      destructiveCommands: Boolean(runtimeCapabilities?.destructiveCommands),
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
      openAiAgentAdvice: Boolean(runtimeCapabilities?.openAiAgentAdvice),
      openAiAdvisorConfigured: Boolean(runtimeCapabilities?.openAiAdvisorConfigured),
      openAiKeySource: runtimeCapabilities?.openAiKeySource || "missing"
    },
    execution: {
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
    },
    selectedActions: selected,
    topFindings,
    executableRows,
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
    return buildBrokerRow({
      row,
      actionType,
      key,
      kind: "scan",
      status: "ready",
      tone: "safe",
      canAct: true,
      buttonLabel: context?.runtime?.nativeAvailable ? "Run real scan" : "Run demo scan",
      targetPanel: "real-data-readiness-panel",
      blockedReason: "",
      checks: [
        buildBrokerCheck("advisory-only", "Advisory boundary", true, "OpenAI can request a scan action, but the app owns the scanner call.")
      ]
    });
  }
  if (actionType === "review-target") {
    const targetId = String(row.targetId || row.target_id || row.id || "").trim();
    return buildBrokerRow({
      row,
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
        buildBrokerCheck("target", "Review target", Boolean(targetId), targetId || "missing target id")
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
    counts: {
      selectedActions: selectedActions.length,
      topFindings: Array.isArray(context?.topFindings) ? context.topFindings.length : 0,
      executableRows: Array.isArray(context?.executableRows) ? context.executableRows.length : 0,
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

  if (!config?.apiKey) {
    throw new Error("Set OPENAI_API_KEY in .env and restart the Vite/Tauri dev server.");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch is not available in this runtime.");
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

function buildInstalledAppReviewContext(manualReviewTargets = []) {
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
