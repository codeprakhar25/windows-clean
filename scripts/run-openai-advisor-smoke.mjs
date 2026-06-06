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

const smokeRouteFixtures = {
  "known-temp-delete": {
    actionType: "run-temp-executor",
    targetId: "temp-cleanup",
    actionId: "temp-cleanup",
    title: "Known temp cleanup",
    actionTitle: "Known temp files",
    targetPath: "%TEMP%\\SpaceGuardFixture",
    bytesGb: 1.2,
    risk: "low",
    consequence: "Deletes old files from known temp roots only.",
    flag: "tempCleanupExecutor",
    expectedTaskStatus: "ready"
  },
  "item-review-recycle-bin": {
    actionType: "run-downloads-cleanup-executor",
    targetId: "downloads-installer-1",
    actionId: "downloads-installers",
    title: "Reviewed Downloads installer",
    actionTitle: "Old installers in Downloads",
    targetPath: "%UserProfile%\\Downloads\\old-installer.exe",
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
    title: "Reviewed large media archive",
    actionTitle: "Large user files",
    targetPath: "%UserProfile%\\Videos\\capture-old.mov",
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
    title: "Reviewed old node_modules folder",
    actionTitle: "Old project dependency folders",
    targetPath: "%UserProfile%\\Code\\old-app\\node_modules",
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
    title: "Browser cache root",
    actionTitle: "Browser cache cleanup",
    recipeId: "browser-cache",
    targetPath: "%LocalAppData%\\Google\\Chrome\\User Data\\Default\\Cache",
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
    title: "Gradle dependency and build cache",
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
    title: "User .cache folder",
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
    title: "Android Studio cache folder",
    actionTitle: "Android cache cleanup",
    recipeId: "android-cache",
    targetPath: "%UserProfile%\\.android\\cache",
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
    title: "Graphics shader cache folder",
    actionTitle: "Shader cache cleanup",
    recipeId: "steam-shader-cache",
    targetPath: "%ProgramFiles(x86)%\\Steam\\steamapps\\shadercache",
    bytesGb: 3.3,
    risk: "low",
    consequence: "Games may rebuild shader caches on next launch.",
    flag: "shaderCacheExecutor",
    expectedTaskStatus: "ready"
  },
  "bounded-pip-cache-delete": {
    actionType: "run-pip-cache-executor",
    targetId: "pip-cache",
    actionId: "pip-cache",
    title: "pip package cache",
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
    title: "Docker build cache",
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
    title: "npm package cache",
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
    title: "pnpm global store",
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
    title: "Recycle Bin",
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
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
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
    .filter((spec) => smokeRouteFixtures[spec.route])
    .map((spec) => ({
      route: spec.route,
      aliases: spec.aliases,
      title: spec.title,
      envVar: spec.envVar,
      actionType: smokeRouteFixtures[spec.route].actionType,
      targetId: smokeRouteFixtures[spec.route].targetId,
      expectedTaskStatus: smokeRouteFixtures[spec.route].expectedTaskStatus
    }));
}

export function resolveSmokeRoute(routeInput = defaultRouteInput) {
  const spec = resolveRouteSpec(routeInput);
  if (!spec) {
    const supported = listSupportedSmokeRoutes().flatMap((route) => route.aliases).join(", ");
    throw new Error(`Unknown OpenAI smoke route "${routeInput || ""}". Supported route aliases: ${supported}.`);
  }
  const fixture = smokeRouteFixtures[spec.route];
  if (!fixture) {
    const supported = listSupportedSmokeRoutes().flatMap((route) => route.aliases).join(", ");
    throw new Error(`OpenAI smoke route "${spec.route}" has no fixture. Supported route aliases: ${supported}.`);
  }
  const targetId = fixture.targetId;
  return {
    ...fixture,
    spec,
    route: spec.route,
    routeInput: spec.aliases[0] || spec.route,
    requiredRecommendation: {
      actionType: fixture.actionType,
      targetId,
      route: spec.route,
      expectedTaskStatus: fixture.expectedTaskStatus || "ready"
    }
  };
}

function buildReviewTarget(route) {
  const base = {
    id: route.targetId,
    name: route.title,
    title: route.title,
    route: route.route,
    path: route.targetPath,
    bytes: route.bytes,
    ageDays: 120,
    reason: "Fixture target already passed deterministic user review.",
    signals: ["fixture-reviewed", "scoped-route"]
  };
  if (route.reviewTarget === "downloads") {
    return {
      ...base,
      kind: "reviewed Downloads file"
    };
  }
  if (route.reviewTarget === "project") {
    return {
      ...base,
      kind: "project dependency folder"
    };
  }
  return base;
}

function buildArchiveTarget(route) {
  return {
    id: route.targetId,
    name: route.title,
    title: route.title,
    route: route.route,
    path: route.targetPath,
    bytes: route.bytes,
    ageDays: 180,
    kind: "large user file",
    decision: "archive",
    reason: "Fixture target has a configured archive destination.",
    signals: ["fixture-reviewed", "archive-destination-present"]
  };
}

function buildFixtureExecutorRows(route) {
  const row = {
    id: route.actionId || route.targetId,
    title: route.actionTitle || route.title,
    route: route.route,
    bytes: route.bytes,
    targetPath: route.targetPath,
    canExecute: true,
    canSimulate: true
  };
  if (route.reviewTarget) {
    row.reviewTargets = [buildReviewTarget(route)];
  }
  if (route.archiveTarget) {
    row.archiveTargets = [buildArchiveTarget(route)];
  }
  return [row];
}

function buildFixtureFindings(route) {
  if (!route.recipeId) return [];
  return [
    {
      recipeId: route.recipeId,
      title: route.title,
      path: route.targetPath,
      bytes: route.bytes,
      status: "measured"
    }
  ];
}

export function buildFixtureContext({ routeInput = defaultRouteInput } = {}) {
  const route = resolveSmokeRoute(routeInput);
  const bytes = Math.round(Number(route.bytesGb || 1) * GB);
  const fixtureRoute = { ...route, bytes };
  const selectedActionId = fixtureRoute.actionId || fixtureRoute.targetId;
  const actionList = [
    {
      id: selectedActionId,
      title: fixtureRoute.actionTitle || fixtureRoute.title,
      route: fixtureRoute.route,
      bytes,
      risk: fixtureRoute.risk || "low",
      consequence: fixtureRoute.consequence || "Scoped fixture cleanup target."
    },
    {
      id: "installed-app-footprints",
      title: "Installed app review candidates",
      route: "manual-app-uninstall",
      bytes: Math.round(6.5 * GB),
      risk: "manual",
      consequence: "Manual uninstall guidance only; no direct folder deletion."
    }
  ];

  return buildOpenAIAgentContext({
    profile: {
      drive: "C:",
      usedBytes: 460 * GB,
      freeBytes: 18 * GB,
      totalBytes: 512 * GB
    },
    scanMode: `openai-fixture-smoke:${fixtureRoute.routeInput}`,
    scanSession: {
      status: "fresh",
      currentFingerprint: `fixture-openai-smoke-scan:${fixtureRoute.route}`
    },
    actionList,
    selectedIds: new Set([selectedActionId]),
    readiness: { status: "ready" },
    runReadiness: { status: "ready" },
    dryRunLaunchGuard: { status: "armed" },
    safetyInterlock: { status: "clear" },
    candidateSafetyManifest: { status: "ready" },
    nativeEvidenceQuality: { status: "native-verified" },
    storagePressureDiagnosis: { status: "pressure-detected" },
    executorPlan: {
      rows: buildFixtureExecutorRows(fixtureRoute)
    },
    nativeScan: {
      findings: buildFixtureFindings(fixtureRoute)
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
        [fixtureRoute.flag]: true
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
      primary: "No executor has run in this fixture."
    },
    rescanComparison: { status: "not-run" },
    planSnapshot: {
      id: "plan-openai-smoke",
      scanMode: "openai-fixture-smoke",
      selectedCount: 1,
      selectedBytes: bytes,
      goalBytes: 5 * GB,
      selectedIds: [selectedActionId]
    }
  });
}

export function buildFixtureExecutionState({ routeInput = defaultRouteInput, route = null } = {}) {
  const selectedRoute = route?.requiredRecommendation ? route : resolveSmokeRoute(routeInput);
  return {
    planId: "plan-openai-smoke",
    scanFingerprint: `fixture-openai-smoke-scan:${selectedRoute.route}`,
    consentPlanId: "plan-openai-smoke",
    proofStatus: "waiting-for-execution",
    ...(selectedRoute.executionState || {})
  };
}

export function buildFixtureRecommendationBroker({ context, advice, route = null, routeInput = defaultRouteInput } = {}) {
  const selectedRoute = route?.requiredRecommendation ? route : resolveSmokeRoute(routeInput);
  return buildOpenAIAgentRecommendationBroker({
    advice,
    context,
    executionState: buildFixtureExecutionState({ route: selectedRoute })
  });
}

function printAdvice(result, broker, validation, { requiredSmokeRecommendation, route }) {
  const advice = result.advice || {};
  console.log(`${SCRIPT_ID}: OpenAI advisor smoke complete`);
  console.log("No local filesystem scan was performed; this used fixture data only.");
  if (result.transport === "fixture-only") console.log("No OpenAI request was sent; fixture-only mode validated the local task queue and broker.");
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
  for (const question of advice.questions || []) {
    console.log(`question=${question}`);
  }
  for (const warning of advice.warnings || []) {
    console.log(`warning=${warning}`);
  }
  for (const failure of validation.failures || []) {
    console.error(`failure=${failure}`);
  }
}

export function validateSmokeAdvice({ context, advice, broker, requiredRecommendation = null } = {}) {
  const requiredSmokeRecommendation = requiredRecommendation || resolveSmokeRoute(defaultRouteInput).requiredRecommendation;
  const expectedTaskStatus = requiredSmokeRecommendation.expectedTaskStatus || "ready";
  const failures = [];
  const task = (context.agentTaskQueue?.rows || []).find((row) =>
    row.actionType === requiredSmokeRecommendation.actionType &&
    row.targetId === requiredSmokeRecommendation.targetId &&
    row.route === requiredSmokeRecommendation.route
  );
  if (!task) {
    failures.push("required task queue row is missing from fixture context");
  } else if (task.status !== expectedTaskStatus) {
    failures.push(`required task queue row is ${task.status}, expected ${expectedTaskStatus}`);
  }

  const recommendation = (advice?.recommendedActions || []).find((row) =>
    row.actionType === requiredSmokeRecommendation.actionType &&
    row.targetId === requiredSmokeRecommendation.targetId &&
    row.route === requiredSmokeRecommendation.route
  );
  if (!recommendation) {
    failures.push("required recommendation was not returned by OpenAI");
  }

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

export function buildFixtureOnlyAdviceResult({ requiredRecommendation = null } = {}) {
  const requiredSmokeRecommendation = requiredRecommendation || resolveSmokeRoute(defaultRouteInput).requiredRecommendation;
  const route = resolveSmokeRoute(requiredSmokeRecommendation.route || defaultRouteInput);
  const advice = {
    summary: `Local fixture advice selected the broker-ready ${route.spec.title} task.`,
    nextAction: `Run the ${route.spec.title} executor only after the same deterministic gates pass in the desktop app.`,
    confidence: "high",
    recommendedActions: [
      {
        id: requiredSmokeRecommendation.targetId,
        title: route.title,
        reason: `The fixture task queue exposes the selected ${route.spec.title} route.`,
        priority: "high",
        actionType: requiredSmokeRecommendation.actionType,
        targetId: requiredSmokeRecommendation.targetId,
        route: requiredSmokeRecommendation.route
      }
    ],
    blockedActions: [],
    questions: [],
    warnings: ["Fixture-only mode did not contact OpenAI."]
  };
  return {
    schemaVersion: "spaceguard-openai-agent-advice/v1",
    provider: "local-fixture",
    model: "fixture-only",
    transport: "fixture-only",
    requestId: "",
    responseId: "",
    createdAt: new Date().toISOString(),
    rawText: JSON.stringify(advice),
    advice,
    warnings: ["No OpenAI request was sent."]
  };
}

export function parseArgs(argv = []) {
  const args = { fixtureOnly: false, routeInput: defaultRouteInput, listRoutes: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--fixture-only") args.fixtureOnly = true;
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
  const context = buildFixtureContext({ routeInput: args.routeInput });
  let result = null;

  if (args.fixtureOnly) {
    result = buildFixtureOnlyAdviceResult({ requiredRecommendation: requiredSmokeRecommendation });
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
      userPrompt: `Use this fixture only. The required smoke task queue row is actionType=${requiredSmokeRecommendation.actionType}, targetId=${requiredSmokeRecommendation.targetId}, route=${requiredSmokeRecommendation.route}, expectedTaskStatus=${requiredSmokeRecommendation.expectedTaskStatus || "ready"}. Return it as the first recommendedAction exactly when the deterministic broker can route it, and explain any blockers.`,
      config,
      host: {}
    });
  }

  const broker = buildFixtureRecommendationBroker({ context, advice: result.advice, route });
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
