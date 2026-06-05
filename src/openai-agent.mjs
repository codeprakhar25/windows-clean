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
              enum: ["review-target", "run-temp-executor", "run-downloads-cleanup-executor", "run-project-deps-executor", "run-browser-cache-executor", "run-gradle-cache-executor", "run-npm-cache-executor", "run-recycle-bin-executor", "rescan", "ask-user", "manual-only"]
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
              enum: ["review-target", "run-temp-executor", "run-downloads-cleanup-executor", "run-project-deps-executor", "run-browser-cache-executor", "run-gradle-cache-executor", "run-npm-cache-executor", "run-recycle-bin-executor", "rescan", "ask-user", "manual-only"]
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
  driveInventorySummary,
  customRootTriage,
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
        reason: target.reason || ""
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
  const manualReviewTargets = buildManualReviewTargets({ nativeScan, itemReviewsByAction });
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
      allowedActions: ["rank-reviewed-targets", "explain-blockers", "ask-user", "recommend-rescan", "recommend-scoped-executor-button", "recommend-manual-review"],
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
      projectDependencyExecutor: Boolean(runtimeCapabilities?.executorFlags?.projectDependencyExecutor),
      browserCacheExecutor: Boolean(runtimeCapabilities?.executorFlags?.browserCacheExecutor),
      gradleCacheExecutor: Boolean(runtimeCapabilities?.executorFlags?.gradleCacheExecutor),
      npmCacheExecutor: Boolean(runtimeCapabilities?.executorFlags?.npmCacheExecutor),
      recycleBinExecutor: Boolean(runtimeCapabilities?.executorFlags?.recycleBinExecutor),
      openAiAgentAdvice: Boolean(runtimeCapabilities?.openAiAgentAdvice),
      openAiAdvisorConfigured: Boolean(runtimeCapabilities?.openAiAdvisorConfigured),
      openAiKeySource: runtimeCapabilities?.openAiKeySource || "missing"
    },
    selectedActions: selected,
    topFindings,
    executableRows,
    reviewedProjectTargets,
    gradleCacheTargets,
    npmCacheTargets,
    recycleBinTargets,
    browserCacheTargets,
    manualReviewTargets,
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
      openAiAgentAdvice: Boolean(context?.runtime?.openAiAgentAdvice),
      openAiAdvisorConfigured: Boolean(context?.runtime?.openAiAdvisorConfigured)
    },
    counts: {
      selectedActions: selectedActions.length,
      topFindings: Array.isArray(context?.topFindings) ? context.topFindings.length : 0,
      executableRows: Array.isArray(context?.executableRows) ? context.executableRows.length : 0,
      reviewedProjectTargets: Array.isArray(context?.reviewedProjectTargets) ? context.reviewedProjectTargets.length : 0,
      gradleCacheTargets: Array.isArray(context?.gradleCacheTargets) ? context.gradleCacheTargets.length : 0,
      npmCacheTargets: Array.isArray(context?.npmCacheTargets) ? context.npmCacheTargets.length : 0,
      recycleBinTargets: Array.isArray(context?.recycleBinTargets) ? context.recycleBinTargets.length : 0,
      browserCacheTargets: Array.isArray(context?.browserCacheTargets) ? context.browserCacheTargets.length : 0,
      manualReviewTargets: Array.isArray(context?.manualReviewTargets) ? context.manualReviewTargets.length : 0,
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
      reason: item.reason || "Installed app footprint is manual review evidence, not an automated cleanup target."
    }));
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
    clean === "review-target" ||
    clean === "run-temp-executor" ||
    clean === "run-downloads-cleanup-executor" ||
    clean === "run-project-deps-executor" ||
    clean === "run-browser-cache-executor" ||
    clean === "run-gradle-cache-executor" ||
    clean === "run-npm-cache-executor" ||
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
