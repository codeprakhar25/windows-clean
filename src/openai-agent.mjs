const DEFAULT_OPENAI_MODEL = "gpt-5.5";
const DEFAULT_OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
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
              enum: ["review-target", "run-temp-executor", "run-project-deps-executor", "run-browser-cache-executor", "run-gradle-cache-executor", "rescan", "ask-user", "manual-only"]
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
              enum: ["review-target", "run-temp-executor", "run-project-deps-executor", "run-browser-cache-executor", "run-gradle-cache-executor", "rescan", "ask-user", "manual-only"]
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
  const apiKey = String(env.VITE_OPENAI_API_KEY || "").trim();
  const model = String(env.VITE_OPENAI_MODEL || DEFAULT_OPENAI_MODEL).trim() || DEFAULT_OPENAI_MODEL;
  const endpoint = String(env.VITE_OPENAI_BASE_URL || DEFAULT_OPENAI_ENDPOINT).trim() || DEFAULT_OPENAI_ENDPOINT;

  return {
    provider: "openai",
    connected: Boolean(apiKey),
    configured: Boolean(apiKey),
    apiKey,
    model,
    endpoint,
    keySource: apiKey ? "VITE_OPENAI_API_KEY" : "missing",
    advisoryOnly: true,
    directToolAccess: false
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
  runtimeCapabilities
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

  return {
    schemaVersion: "spaceguard-openai-agent-context/v1",
    generatedAt: new Date().toISOString(),
    appBoundary: {
      aiRole: "advisory planner",
      directFilesystemAccess: false,
      directDeleteAuthority: false,
      userApprovalRequired: true,
      executorAuthority: "native code only after explicit user action",
      allowedActions: ["rank-reviewed-targets", "explain-blockers", "ask-user", "recommend-rescan", "recommend-scoped-executor-button"],
      forbiddenActions: ["delete-files", "approve-gates", "scan-folders", "run-shell", "edit-registry", "change-partitions"]
    },
    machine: {
      scanMode: scanMode || "unknown",
      drive: profile?.drive || "unknown",
      usedBytes: Number(profile?.usedBytes || 0),
      freeBytes: Number(profile?.freeBytes || 0),
      totalBytes: Number(profile?.totalBytes || 0)
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
      projectDependencyExecutor: Boolean(runtimeCapabilities?.executorFlags?.projectDependencyExecutor),
      browserCacheExecutor: Boolean(runtimeCapabilities?.executorFlags?.browserCacheExecutor),
      gradleCacheExecutor: Boolean(runtimeCapabilities?.executorFlags?.gradleCacheExecutor)
    },
    selectedActions: selected,
    topFindings,
    executableRows,
    reviewedProjectTargets,
    gradleCacheTargets,
    browserCacheTargets,
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

export async function requestOpenAIAgentAdvice({
  context,
  userPrompt,
  config = getOpenAIAgentConfig(),
  fetchImpl = globalThis.fetch
} = {}) {
  if (!config?.apiKey) {
    throw new Error("Set VITE_OPENAI_API_KEY in .env and restart the Vite/Tauri dev server.");
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
  return {
    schemaVersion: "spaceguard-openai-agent-advice/v1",
    provider: "openai",
    model: payload?.model || config.model,
    requestId,
    createdAt: new Date().toISOString(),
    rawText: text,
    advice: parseAgentAdvice(text),
    responseId: payload?.id || ""
  };
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
    return {
      summary: String(parsed.summary || fallback.summary),
      nextAction: String(parsed.nextAction || parsed.next_action || fallback.nextAction),
      confidence: normalizeConfidence(parsed.confidence),
      recommendedActions: normalizeAdviceRows(parsed.recommendedActions || parsed.recommended_actions),
      blockedActions: normalizeAdviceRows(parsed.blockedActions || parsed.blocked_actions),
      questions: normalizeStringList(parsed.questions),
      warnings: normalizeStringList(parsed.warnings)
    };
  } catch {
    return fallback;
  }
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
    clean === "run-project-deps-executor" ||
    clean === "run-browser-cache-executor" ||
    clean === "run-gradle-cache-executor" ||
    clean === "rescan" ||
    clean === "ask-user" ||
    clean === "manual-only"
  ) {
    return clean;
  }
  return "manual-only";
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).map((item) => String(item || "").trim()).filter(Boolean);
}
