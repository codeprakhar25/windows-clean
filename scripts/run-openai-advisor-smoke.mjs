#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { routeSpecs } from "./run-setup-route.mjs";
import {
  buildOpenAIAgentContext,
  buildOpenAIAgentRecommendationBroker,
  getOpenAIAgentRecommendationKey,
  getOpenAIAgentConfig,
  requestOpenAIAgentAdvice
} from "../src/openai-agent.mjs";

const SCRIPT_ID = "run-openai-advisor-smoke";
const GB = 1024 * 1024 * 1024;
const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), "..");
const defaultRouteInput = "npm-cache";

const routeContracts = {
  "known-temp-delete": {
    actionType: "run-temp-executor",
    targetId: "windows-temp",
    actionId: "windows-temp",
    actionTitle: "Known temp files",
    targetPath: "%TEMP%",
    bytesGb: 1.2,
    risk: "low",
    consequence: "Deletes old files from allowlisted temp roots only.",
    flag: "tempCleanupExecutor",
    expectedTaskStatus: "ready"
  },
  "item-review-recycle-bin": {
    actionType: "run-downloads-cleanup-executor",
    targetId: "downloads-installer-1",
    actionId: "downloads-installers",
    actionTitle: "Old installers in Downloads",
    targetPath: "%UserProfile%\\Downloads\\reviewed-installer.exe",
    bytesGb: 1.7,
    risk: "review",
    consequence: "Moves only reviewed Downloads items to Recycle Bin.",
    flag: "downloadsCleanupExecutor",
    reviewTarget: "downloads",
    expectedTaskStatus: "ready"
  },
  "item-review-large-files": {
    actionType: "run-large-file-archive-executor",
    targetId: "large-file-archive-1",
    actionId: "large-user-files",
    actionTitle: "Large user files",
    targetPath: "%UserProfile%\\Videos\\reviewed-archive.mov",
    bytesGb: 8.4,
    risk: "review",
    consequence: "Moves only reviewed large files to the configured archive destination.",
    flag: "largeFileArchiveExecutor",
    archiveTarget: true,
    expectedTaskStatus: "needs-user-review",
    executionState: {
      largeFileArchiveDestination: "D:\\SpaceGuardArchive"
    }
  },
  "item-review-project-cache": {
    actionType: "run-project-deps-executor",
    targetId: "project-deps-1",
    actionId: "node-modules-old",
    actionTitle: "Old project dependency folders",
    targetPath: "%UserProfile%\\Code\\reviewed-app\\node_modules",
    bytesGb: 3.6,
    risk: "review",
    consequence: "Deletes only reviewed rebuildable project dependency folders.",
    flag: "projectDependencyExecutor",
    reviewTarget: "project",
    expectedTaskStatus: "ready"
  },
  "browser-cache-only": {
    actionType: "run-browser-cache-executor",
    targetId: "browser-cache-1",
    actionId: "browser-cache-1",
    actionTitle: "Browser cache cleanup",
    recipeId: "browser-cache",
    targetPath: "%LocalAppData%\\Browser\\Profile\\Cache",
    bytesGb: 2.8,
    risk: "low",
    consequence: "Rebuildable browser cache; websites may reload assets.",
    flag: "browserCacheExecutor",
    expectedTaskStatus: "ready"
  },
  "bounded-cache-delete": {
    actionType: "run-gradle-cache-executor",
    targetId: "gradle-cache",
    actionId: "gradle-cache",
    actionTitle: "Gradle cache cleanup",
    recipeId: "gradle-cache",
    targetPath: "%UserProfile%\\.gradle\\caches",
    bytesGb: 4.1,
    risk: "low",
    consequence: "Gradle can rebuild or download cache contents later.",
    flag: "gradleCacheExecutor",
    expectedTaskStatus: "ready"
  },
  "bounded-user-cache-delete": {
    actionType: "run-user-cache-executor",
    targetId: "user-cache",
    actionId: "user-cache",
    actionTitle: "User .cache cleanup",
    recipeId: "user-cache",
    targetPath: "%UserProfile%\\.cache",
    bytesGb: 1.9,
    risk: "low",
    consequence: "Deletes old known cache contents under the user profile.",
    flag: "userCacheExecutor",
    expectedTaskStatus: "ready"
  },
  "bounded-android-cache-delete": {
    actionType: "run-android-cache-executor",
    targetId: "android-cache-1",
    actionId: "android-cache-1",
    actionTitle: "Android cache cleanup",
    recipeId: "android-cache",
    targetPath: "%LocalAppData%\\Google\\AndroidStudio\\caches",
    bytesGb: 2.2,
    risk: "low",
    consequence: "Android tooling can rebuild cache contents later.",
    flag: "androidCacheExecutor",
    expectedTaskStatus: "ready"
  },
  "launcher-cache-cleanup": {
    actionType: "run-shader-cache-executor",
    targetId: "shader-cache-1",
    actionId: "shader-cache-1",
    actionTitle: "Shader cache cleanup",
    recipeId: "steam-shader-cache",
    targetPath: "%LocalAppData%\\NVIDIA\\DXCache",
    bytesGb: 3.3,
    risk: "low",
    consequence: "Games or graphics apps may rebuild shader caches on next launch.",
    flag: "shaderCacheExecutor",
    expectedTaskStatus: "ready"
  },
  "bounded-pip-cache-delete": {
    actionType: "run-pip-cache-executor",
    targetId: "pip-cache",
    actionId: "pip-cache",
    actionTitle: "pip cache cleanup",
    recipeId: "pip-cache",
    targetPath: "%LocalAppData%\\pip\\Cache",
    bytesGb: 1.4,
    risk: "low",
    consequence: "pip can download packages again later.",
    flag: "pipCacheExecutor",
    expectedTaskStatus: "ready"
  },
  "tool-native-docker-build-cache-prune": {
    actionType: "run-docker-build-cache-executor",
    targetId: "docker-build-cache",
    actionId: "docker-build-cache",
    actionTitle: "Docker build-cache cleanup",
    recipeId: "docker-build-cache",
    targetPath: "docker-builder-cache://local",
    bytesGb: 5.2,
    risk: "tool",
    consequence: "Docker may rebuild image layers later.",
    flag: "toolNativePruneExecutors",
    expectedTaskStatus: "ready"
  },
  "bounded-npm-cache-delete": {
    actionType: "run-npm-cache-executor",
    targetId: "npm-cache",
    actionId: "npm-cache",
    actionTitle: "npm cache cleanup",
    recipeId: "npm-cache",
    targetPath: "%LocalAppData%\\npm-cache\\_cacache",
    bytesGb: 2.4,
    risk: "low",
    consequence: "npm can download package cache contents again later.",
    flag: "npmCacheExecutor",
    expectedTaskStatus: "ready"
  },
  "bounded-pnpm-store-delete": {
    actionType: "run-pnpm-store-executor",
    targetId: "pnpm-store",
    actionId: "pnpm-store",
    actionTitle: "pnpm store cleanup",
    recipeId: "pnpm-store",
    targetPath: "%LocalAppData%\\pnpm\\store",
    bytesGb: 2.1,
    risk: "low",
    consequence: "pnpm can recreate store content when packages are installed again.",
    flag: "pnpmStoreExecutor",
    expectedTaskStatus: "ready"
  },
  "shell-recycle-bin": {
    actionType: "run-recycle-bin-executor",
    targetId: "recycle-bin",
    actionId: "recycle-bin",
    actionTitle: "Recycle Bin cleanup",
    recipeId: "recycle-bin",
    targetPath: "shell:RecycleBinFolder",
    bytesGb: 6.8,
    risk: "permanent",
    consequence: "Permanently removes selected Recycle Bin contents.",
    flag: "recycleBinExecutor",
    expectedTaskStatus: "needs-user-review",
    executionState: {
      permanentRemovalConfirmed: true
    }
  }
};

function readDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const withoutExport = trimmed.startsWith("export ") ? trimmed.slice("export ".length) : trimmed;
    const separator = withoutExport.indexOf("=");
    if (separator <= 0) continue;
    const key = withoutExport.slice(0, separator).trim();
    const rawValue = withoutExport.slice(separator + 1).trim();
    env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
  return env;
}

function resolveRouteSpec(routeInput = defaultRouteInput) {
  const clean = String(routeInput || defaultRouteInput).trim().toLowerCase();
  return routeSpecs.find((spec) =>
    spec.route.toLowerCase() === clean ||
    spec.aliases.some((alias) => alias.toLowerCase() === clean)
  ) || null;
}

export function listSupportedSmokeRoutes() {
  return routeSpecs
    .filter((spec) => routeContracts[spec.route])
    .map((spec) => {
      const contract = routeContracts[spec.route];
      return {
        route: spec.route,
        aliases: spec.aliases,
        title: spec.title,
        envVar: spec.envVar,
        actionType: contract.actionType,
        targetId: contract.targetId,
        expectedTaskStatus: contract.expectedTaskStatus
      };
    });
}

export function resolveSmokeRoute(routeInput = defaultRouteInput) {
  const spec = resolveRouteSpec(routeInput);
  if (!spec || !routeContracts[spec.route]) {
    const supported = listSupportedSmokeRoutes().flatMap((route) => route.aliases).join(", ");
    throw new Error(`Unknown OpenAI smoke route "${routeInput || ""}". Supported route aliases: ${supported}.`);
  }
  const contract = routeContracts[spec.route];
  return {
    ...contract,
    spec,
    route: spec.route,
    routeInput: spec.aliases[0] || spec.route,
    requiredRecommendation: {
      actionType: contract.actionType,
      targetId: contract.targetId,
      route: spec.route,
      expectedTaskStatus: contract.expectedTaskStatus || "ready"
    }
  };
}

function buildReviewTarget(route) {
  const base = {
    id: route.targetId,
    name: route.spec.title,
    title: route.spec.title,
    route: route.route,
    path: route.targetPath,
    bytes: route.bytes,
    ageDays: 120,
    reason: "User-reviewed target selected in the desktop app.",
    signals: ["reviewed-target", "scoped-route"]
  };
  if (route.reviewTarget === "downloads") return { ...base, kind: "reviewed Downloads file" };
  if (route.reviewTarget === "project") return { ...base, kind: "project dependency folder" };
  return base;
}

function buildArchiveTarget(route) {
  return {
    id: route.targetId,
    name: route.spec.title,
    title: route.spec.title,
    route: route.route,
    path: route.targetPath,
    bytes: route.bytes,
    ageDays: 180,
    kind: "large user file",
    decision: "archive",
    reason: "User-reviewed archive target with a configured destination.",
    signals: ["reviewed-target", "archive-destination-present"]
  };
}

function buildExecutorRows(route) {
  const row = {
    id: route.actionId || route.targetId,
    title: route.actionTitle || route.spec.title,
    route: route.route,
    bytes: route.bytes,
    targetPath: route.targetPath,
    canExecute: true,
    canSimulate: true
  };
  if (route.reviewTarget) row.reviewTargets = [buildReviewTarget(route)];
  if (route.archiveTarget) row.archiveTargets = [buildArchiveTarget(route)];
  return [row];
}

function buildFindings(route) {
  if (!route.recipeId) return [];
  return [
    {
      recipeId: route.recipeId,
      title: route.spec.title,
      path: route.targetPath,
      bytes: route.bytes,
      status: "measured"
    }
  ];
}

function buildScopedExecutorCommandFlow(route) {
  const targetEvidence = route.recipeId ? "1 scanned native target(s)" : route.targetPath;
  return {
    schemaVersion: "spaceguard-scoped-executor-command-flow/v1",
    status: "ready-to-execute",
    route: route.route,
    selectedRoute: route.route,
    title: route.spec.title,
    panelId: route.spec.panelId,
    actionLabel: route.spec.actionLabel,
    nativeAvailable: true,
    setupCommands: {
      routeInput: route.routeInput,
      envVar: route.spec.envVar,
      enableEnv: `${route.spec.envVar}=1`,
      requestMode: route.spec.requestMode,
      panelId: route.spec.panelId
    },
    launchPacket: {
      schemaVersion: "spaceguard-selected-route-launch-packet/v1",
      status: "ready-to-run",
      ready: true,
      route: route.route,
      routeInput: route.routeInput,
      title: route.spec.title,
      panelId: route.spec.panelId,
      actionLabel: route.spec.actionLabel,
      proofStatus: "waiting-for-execution",
      proofAllowsExecution: true,
      targetEvidence,
      targetCount: 1,
      expectedBytes: Number(route.bytes || 0),
      setupCommands: {
        routeInput: route.routeInput,
        envVar: route.spec.envVar,
        requestMode: route.spec.requestMode,
        panelId: route.spec.panelId
      }
    },
    primaryRow: {
      id: route.actionId || route.targetId,
      title: route.spec.title,
      route: route.route,
      status: "ready",
      bytes: Number(route.bytes || 0),
      envVar: route.spec.envVar,
      flagEnabled: true,
      requestMode: route.spec.requestMode,
      panelId: route.spec.panelId,
      actionLabel: route.spec.actionLabel,
      targetCount: 1,
      targetEvidence
    }
  };
}

export function buildRouteContractContext({ routeInput = defaultRouteInput } = {}) {
  const route = resolveSmokeRoute(routeInput);
  const bytes = Math.round(Number(route.bytesGb || 1) * GB);
  const selectedRoute = { ...route, bytes };
  const selectedActionId = selectedRoute.actionId || selectedRoute.targetId;
  return buildOpenAIAgentContext({
    profile: {
      drive: "C:",
      usedBytes: 460 * GB,
      freeBytes: 18 * GB,
      totalBytes: 512 * GB
    },
    scanMode: `openai-route-contract:${selectedRoute.routeInput}`,
    scanSession: {
      status: "fresh",
      currentFingerprint: `route-contract-scan:${selectedRoute.route}`
    },
    actionList: [
      {
        id: selectedActionId,
        title: selectedRoute.actionTitle || selectedRoute.spec.title,
        route: selectedRoute.route,
        bytes,
        risk: selectedRoute.risk || "low",
        consequence: selectedRoute.consequence || "Scoped cleanup target."
      }
    ],
    selectedIds: new Set([selectedActionId]),
    readiness: { status: "ready" },
    runReadiness: { status: "ready" },
    dryRunLaunchGuard: { status: "armed" },
    safetyInterlock: { status: "clear" },
    candidateSafetyManifest: { status: "ready" },
    nativeEvidenceQuality: { status: "native-verified" },
    storagePressureDiagnosis: { status: "pressure-detected" },
    executorPlan: {
      rows: buildExecutorRows(selectedRoute)
    },
    nativeScan: {
      findings: buildFindings(selectedRoute)
    },
    runtimeCapabilities: {
      available: true,
      windows: true,
      realRunEnabled: true,
      destructiveCommands: true,
      openAiAgentAdvice: false,
      openAiAdvisorConfigured: true,
      openAiKeySource: ".env:OPENAI_API_KEY",
      executorFlags: {
        [selectedRoute.flag]: true
      }
    },
    itemReviewsByAction: {},
    approvals: {},
    driveInventorySummary: { rows: [] },
    customRootTriage: { rows: [] },
    writeReadiness: {
      status: "ready",
      readyForRealExecution: true
    },
    releaseGate: { readyForRealRun: true },
    validationPack: { readyForRealRun: true },
    consentReceipt: { planId: "plan-openai-smoke" },
    executionProofHandoff: {
      status: "waiting-for-execution",
      primary: "No executor has run in this smoke contract."
    },
    rescanComparison: { status: "not-run" },
    planSnapshot: {
      id: "plan-openai-smoke",
      scanMode: "openai-route-contract",
      selectedCount: 1,
      selectedBytes: bytes,
      goalBytes: 5 * GB,
      selectedIds: [selectedActionId]
    },
    scopedExecutorCommandFlow: buildScopedExecutorCommandFlow(selectedRoute)
  });
}

export function buildRouteContractExecutionState({ routeInput = defaultRouteInput, route = null } = {}) {
  const selectedRoute = route?.requiredRecommendation ? route : resolveSmokeRoute(routeInput);
  return {
    planId: "plan-openai-smoke",
    scanFingerprint: `route-contract-scan:${selectedRoute.route}`,
    consentPlanId: "plan-openai-smoke",
    proofStatus: "waiting-for-execution",
    ...(selectedRoute.executionState || {})
  };
}

export function buildRouteContractRecommendationBroker({ context, advice, route = null, routeInput = defaultRouteInput } = {}) {
  const selectedRoute = route?.requiredRecommendation ? route : resolveSmokeRoute(routeInput);
  return buildOpenAIAgentRecommendationBroker({
    advice,
    context,
    executionState: buildRouteContractExecutionState({ route: selectedRoute })
  });
}

function printAdvice(result, broker, validation, { requiredSmokeRecommendation, route }) {
  const advice = result.advice || {};
  console.log(`${SCRIPT_ID}: OpenAI advisor smoke complete`);
  console.log("No local filesystem scan was performed; this validated the selected real-route broker contract.");
  console.log(`provider=${result.provider} model=${result.model} transport=${result.transport}`);
  if (result.requestId) console.log(`requestId=${result.requestId}`);
  if (result.responseId) console.log(`responseId=${result.responseId}`);
  console.log(`routeInput=${route.routeInput} route=${route.route} title=${route.spec.title}`);
  console.log(`required=${requiredSmokeRecommendation.actionType} route=${requiredSmokeRecommendation.route} target=${requiredSmokeRecommendation.targetId}`);
  console.log(`taskStatus=${validation.task?.status || "missing"} expected=${requiredSmokeRecommendation.expectedTaskStatus || "ready"}`);
  console.log(`validation=${validation.passed ? "broker-ready" : "failed"}`);
  console.log(`summary=${advice.summary || ""}`);
  console.log(`nextAction=${advice.nextAction || ""}`);
  console.log(`confidence=${advice.confidence || "low"}`);
  for (const row of advice.recommendedActions || []) {
    const brokerRow = broker.rows.find((item) => item.key === getOpenAIAgentRecommendationKey(row));
    console.log(`recommendation=${row.actionType} route=${row.route || "none"} status=${brokerRow?.status || "unbrokered"} title=${row.title}`);
  }
  for (const row of advice.blockedActions || []) {
    console.log(`blocked=${row.actionType} route=${row.route || "none"} reason=${row.reason}`);
  }
  for (const question of advice.questions || []) console.log(`question=${question}`);
  for (const warning of advice.warnings || []) console.log(`warning=${warning}`);
  for (const failure of validation.failures || []) console.error(`failure=${failure}`);
}

export function validateSmokeAdvice({ context, advice, broker, requiredRecommendation = null } = {}) {
  const requiredSmokeRecommendation = requiredRecommendation || resolveSmokeRoute(defaultRouteInput).requiredRecommendation;
  const expectedTaskStatus = requiredSmokeRecommendation.expectedTaskStatus || "ready";
  const requiredRoute = resolveSmokeRoute(requiredSmokeRecommendation.route || defaultRouteInput);
  const failures = [];
  const liveRouteValidation = context?.liveRouteValidation || null;
  if (!liveRouteValidation || liveRouteValidation.schemaVersion !== "spaceguard-openai-live-route-validation/v1") {
    failures.push("live route contract is missing from route context");
  } else {
    if (liveRouteValidation.route !== requiredSmokeRecommendation.route) {
      failures.push(`live route contract route=${liveRouteValidation.route || "missing"}, expected ${requiredSmokeRecommendation.route}`);
    }
    if (liveRouteValidation.requestMode !== requiredRoute.spec.requestMode) {
      failures.push(`live route contract requestMode=${liveRouteValidation.requestMode || "missing"}, expected ${requiredRoute.spec.requestMode}`);
    }
    if (liveRouteValidation.panelId !== requiredRoute.spec.panelId) {
      failures.push(`live route contract panelId=${liveRouteValidation.panelId || "missing"}, expected ${requiredRoute.spec.panelId}`);
    }
    if (liveRouteValidation.canExecuteWithoutAppEvidence !== false) {
      failures.push("live route contract must require app evidence before execution");
    }
  }
  const task = (context.agentTaskQueue?.rows || []).find((row) =>
    row.actionType === requiredSmokeRecommendation.actionType &&
    row.targetId === requiredSmokeRecommendation.targetId &&
    row.route === requiredSmokeRecommendation.route
  );
  if (!task) {
    failures.push("required task queue row is missing from route context");
  } else if (task.status !== expectedTaskStatus) {
    failures.push(`required task queue row is ${task.status}, expected ${expectedTaskStatus}`);
  }

  const recommendation = (advice?.recommendedActions || []).find((row) =>
    row.actionType === requiredSmokeRecommendation.actionType &&
    row.targetId === requiredSmokeRecommendation.targetId &&
    row.route === requiredSmokeRecommendation.route
  );
  if (!recommendation) failures.push("required recommendation was not returned by OpenAI");

  const brokerRow = recommendation
    ? broker.rows.find((row) => row.key === getOpenAIAgentRecommendationKey(recommendation))
    : null;
  if (!brokerRow) {
    failures.push("required recommendation was not brokered");
  } else if (!brokerRow.canAct || brokerRow.status !== "ready") {
    failures.push(`required recommendation broker status=${brokerRow.status} canAct=${brokerRow.canAct}`);
  }

  return {
    passed: failures.length === 0,
    failures,
    task,
    recommendation,
    brokerRow
  };
}

export function buildRouteContractAdviceResult({ requiredRecommendation = null } = {}) {
  const requiredSmokeRecommendation = requiredRecommendation || resolveSmokeRoute(defaultRouteInput).requiredRecommendation;
  const route = resolveSmokeRoute(requiredSmokeRecommendation.route || defaultRouteInput);
  const advice = {
    summary: `Local route-contract advice selected the broker-ready ${route.spec.title} task.`,
    nextAction: `Run the ${route.spec.title} executor only after the same deterministic gates pass in the desktop app.`,
    confidence: "high",
    recommendedActions: [
      {
        id: requiredSmokeRecommendation.targetId,
        title: route.spec.title,
        reason: `The route contract exposes the selected ${route.spec.title} task.`,
        priority: "high",
        actionType: requiredSmokeRecommendation.actionType,
        targetId: requiredSmokeRecommendation.targetId,
        route: requiredSmokeRecommendation.route
      }
    ],
    blockedActions: [],
    questions: [],
    warnings: ["Local contract mode did not contact OpenAI."]
  };
  return {
    schemaVersion: "spaceguard-openai-agent-advice/v1",
    provider: "local-contract",
    model: "route-contract",
    transport: "local-contract",
    requestId: "",
    responseId: "",
    createdAt: new Date().toISOString(),
    rawText: JSON.stringify(advice),
    advice,
    warnings: ["No OpenAI request was sent."]
  };
}

export function parseArgs(argv = []) {
  const args = { routeInput: defaultRouteInput, listRoutes: false, localContract: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--local-contract") args.localContract = true;
    if (value === "--list-routes") args.listRoutes = true;
    if (value === "--route") args.routeInput = argv[index + 1] || "";
    if (value.startsWith("--route=")) args.routeInput = value.slice("--route=".length);
  }
  return args;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.listRoutes) {
    console.log(JSON.stringify({ tool: SCRIPT_ID, routes: listSupportedSmokeRoutes() }, null, 2));
    return;
  }

  const route = resolveSmokeRoute(args.routeInput);
  const requiredSmokeRecommendation = route.requiredRecommendation;
  const context = buildRouteContractContext({ routeInput: args.routeInput });
  let result = null;

  if (args.localContract) {
    result = buildRouteContractAdviceResult({ requiredRecommendation: requiredSmokeRecommendation });
  } else {
    const env = {
      ...readDotEnv(path.join(root, ".env")),
      ...process.env
    };
    const config = getOpenAIAgentConfig(env);
    if (!config.apiKey) {
      console.error(`${SCRIPT_ID}: OPENAI_API_KEY is missing. Add it to .env or the process environment.`);
      process.exitCode = 1;
      return;
    }
    result = await requestOpenAIAgentAdvice({
      context,
      userPrompt: `Validate this selected SpaceGuard real-route contract. Required first recommendation: actionType=${requiredSmokeRecommendation.actionType}, targetId=${requiredSmokeRecommendation.targetId}, route=${requiredSmokeRecommendation.route}, expectedTaskStatus=${requiredSmokeRecommendation.expectedTaskStatus || "ready"}. Return it only when the deterministic broker can route it, and explain blockers otherwise.`,
      config,
      host: {}
    });
  }

  const broker = buildRouteContractRecommendationBroker({ context, advice: result.advice, route });
  const validation = validateSmokeAdvice({ context, advice: result.advice, broker, requiredRecommendation: requiredSmokeRecommendation });
  printAdvice(result, broker, validation, { requiredSmokeRecommendation, route });
  if (!validation.passed) {
    console.error(`${SCRIPT_ID}: OpenAI smoke did not return the required broker-ready recommendation.`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    console.error(`${SCRIPT_ID}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
