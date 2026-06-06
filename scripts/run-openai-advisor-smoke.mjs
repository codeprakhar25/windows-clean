#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  buildOpenAIAgentContext,
  buildOpenAIAgentRecommendationBroker,
  getOpenAIAgentRecommendationKey,
  getOpenAIAgentConfig,
  requestOpenAIAgentAdvice
} from "../src/openai-agent.mjs";

const SCRIPT_ID = "run-openai-advisor-smoke";
const GB = 1024 * 1024 * 1024;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredSmokeRecommendation = {
  actionType: "run-npm-cache-executor",
  targetId: "npm-cache",
  route: "bounded-npm-cache-delete"
};

function readDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
  return env;
}

function buildFixtureContext() {
  return buildOpenAIAgentContext({
    profile: {
      drive: "C:",
      usedBytes: 460 * GB,
      freeBytes: 18 * GB,
      totalBytes: 512 * GB
    },
    scanMode: "openai-fixture-smoke",
    scanSession: {
      status: "fresh",
      currentFingerprint: "fixture-openai-smoke-scan"
    },
    actionList: [
      {
        id: "npm-cache",
        title: "npm package cache",
        route: "bounded-npm-cache-delete",
        bytes: Math.round(2.4 * GB),
        risk: "low",
        consequence: "Rebuildable package cache; package installs may download again."
      },
      {
        id: "downloads-installers",
        title: "Old installers in Downloads",
        route: "item-review-recycle-bin",
        bytes: Math.round(1.7 * GB),
        risk: "review",
        consequence: "Requires per-file review before moving to Recycle Bin."
      },
      {
        id: "installed-app-footprints",
        title: "Installed app review candidates",
        route: "manual-app-uninstall",
        bytes: Math.round(6.5 * GB),
        risk: "manual",
        consequence: "Manual uninstall guidance only; no direct folder deletion."
      }
    ],
    selectedIds: new Set(["npm-cache"]),
    readiness: { status: "ready" },
    runReadiness: { status: "ready" },
    dryRunLaunchGuard: { status: "armed" },
    safetyInterlock: { status: "clear" },
    candidateSafetyManifest: { status: "ready" },
    nativeEvidenceQuality: { status: "native-verified" },
    storagePressureDiagnosis: { status: "pressure-detected" },
    executorPlan: {
      rows: [
        {
          id: "npm-cache",
          title: "npm package cache",
          route: "bounded-npm-cache-delete",
          bytes: Math.round(2.4 * GB),
          targetPath: "%LocalAppData%\\npm-cache\\_cacache",
          canExecute: true,
          canSimulate: true
        }
      ]
    },
    nativeScan: {
      findings: [
        {
          recipeId: "npm-cache",
          title: "npm package cache",
          path: "%LocalAppData%\\npm-cache\\_cacache",
          bytes: Math.round(2.4 * GB),
          status: "measured"
        }
      ]
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
        npmCacheExecutor: true
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
      selectedBytes: Math.round(2.4 * GB),
      goalBytes: 5 * GB,
      selectedIds: ["npm-cache"]
    }
  });
}

function printAdvice(result, broker, validation) {
  const advice = result.advice || {};
  console.log(`${SCRIPT_ID}: OpenAI advisor smoke complete`);
  console.log("No local filesystem scan was performed; this used fixture data only.");
  console.log(`provider=${result.provider} model=${result.model} transport=${result.transport}`);
  if (result.requestId) console.log(`requestId=${result.requestId}`);
  if (result.responseId) console.log(`responseId=${result.responseId}`);
  console.log(`required=${requiredSmokeRecommendation.actionType} route=${requiredSmokeRecommendation.route} target=${requiredSmokeRecommendation.targetId}`);
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

function validateSmokeAdvice({ context, advice, broker }) {
  const failures = [];
  const task = (context.agentTaskQueue?.rows || []).find((row) =>
    row.actionType === requiredSmokeRecommendation.actionType &&
    row.targetId === requiredSmokeRecommendation.targetId &&
    row.route === requiredSmokeRecommendation.route
  );
  if (!task) {
    failures.push("required task queue row is missing from fixture context");
  } else if (task.status !== "ready") {
    failures.push(`required task queue row is ${task.status}, expected ready`);
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

async function main() {
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
  const context = buildFixtureContext();
  const result = await requestOpenAIAgentAdvice({
    context,
    userPrompt: `Use this fixture only. The required smoke task queue row is actionType=${requiredSmokeRecommendation.actionType}, targetId=${requiredSmokeRecommendation.targetId}, route=${requiredSmokeRecommendation.route}. If that row is ready, return it as the first recommendedAction exactly and explain any blockers.`,
    config,
    host: {}
  });
  const broker = buildOpenAIAgentRecommendationBroker({
    advice: result.advice,
    context,
    executionState: {
      planId: "plan-openai-smoke",
      scanFingerprint: "fixture-openai-smoke-scan",
      consentPlanId: "plan-openai-smoke",
      proofStatus: "waiting-for-execution"
    }
  });
  const validation = validateSmokeAdvice({ context, advice: result.advice, broker });
  printAdvice(result, broker, validation);
  if (!validation.passed) {
    console.error(`${SCRIPT_ID}: OpenAI smoke did not return the required broker-ready recommendation.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`${SCRIPT_ID}: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
