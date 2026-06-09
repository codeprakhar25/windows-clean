#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { buildSetupDoctorReport } from "./run-setup-doctor.mjs";
import { buildPacket } from "./run-setup-route.mjs";
import {
  buildRouteContractAdviceResult,
  buildRouteContractContext,
  buildRouteContractRecommendationBroker,
  resolveSmokeRoute,
  validateSmokeAdvice
} from "./run-openai-advisor-smoke.mjs";

const SCRIPT_ID = "spaceguard-windows-readiness";
const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), "..");
const dotenvPath = path.join(root, ".env");

function parseArgs(argv = []) {
  const args = { route: "npm-cache" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--route") args.route = argv[index + 1] || "";
    if (value.startsWith("--route=")) args.route = value.slice("--route=".length);
  }
  return args;
}

function readDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const rows = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean || clean.startsWith("#")) continue;
    const withoutExport = clean.startsWith("export ") ? clean.slice("export ".length) : clean;
    const index = withoutExport.indexOf("=");
    if (index === -1) continue;
    const key = withoutExport.slice(0, index).trim();
    const value = withoutExport.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key) rows[key] = value;
  }
  return rows;
}

function buildLocalContractCheck(routeInput) {
  const route = resolveSmokeRoute(routeInput);
  const requiredRecommendation = route.requiredRecommendation;
  const context = buildRouteContractContext({ routeInput });
  const result = buildRouteContractAdviceResult({ requiredRecommendation });
  const broker = buildRouteContractRecommendationBroker({ context, advice: result.advice, route });
  const validation = validateSmokeAdvice({
    context,
    advice: result.advice,
    broker,
    requiredRecommendation
  });
  return {
    passed: validation.passed,
    route: route.spec.route,
    routeInput,
    expectedActionType: requiredRecommendation.actionType,
    expectedTargetId: requiredRecommendation.targetId,
    brokerStatus: broker.status,
    blockers: validation.blockers || []
  };
}

export function buildWindowsReadinessReport({
  routeInput = "npm-cache",
  env = process.env,
  dotenv = readDotEnv(dotenvPath),
  envFilePresent = fs.existsSync(dotenvPath),
  generatedAt = new Date().toISOString()
} = {}) {
  const routePacket = buildPacket({
    routeInput,
    env: {
      ...dotenv,
      ...env
    }
  });
  const doctor = buildSetupDoctorReport({
    env,
    dotenv,
    envFilePresent,
    generatedAt
  });
  const contract = buildLocalContractCheck(routeInput);
  const windowsHost = process.platform === "win32";
  const routeArmed = routePacket.status === "ready";
  const singleRouteReady = doctor.scopedExecutors.validationStatus === "one-route-ready";
  const readyForNativeDev = Boolean(windowsHost && routeArmed && singleRouteReady && contract.passed);
  const status = readyForNativeDev
    ? "ready-for-native-dev"
    : !windowsHost
      ? "host-not-windows"
      : routePacket.status === "multiple-flags" || doctor.scopedExecutors.validationStatus === "multi-flag-blocked"
        ? "multi-route-blocked"
        : !routeArmed
          ? "route-arm-required"
          : contract.passed
            ? "setup-review-required"
            : "local-contract-blocked";

  return {
    schemaVersion: "spaceguard-windows-readiness/v1",
    tool: SCRIPT_ID,
    generatedAt,
    status,
    readyForNativeDev,
    routeInput,
    platform: {
      os: process.platform,
      windowsHost
    },
    env: {
      envFilePresent,
      envFilePath: ".env"
    },
    route: {
      status: routePacket.status,
      route: routePacket.route,
      selectedEnvVar: routePacket.selected?.envVar || "",
      enabledFlags: routePacket.enabledFlags || [],
      conflictingFlags: routePacket.conflictingFlags || [],
      armCommand: routePacket.commands?.armRoute || `npm run route:arm -- --route ${routeInput}`,
      setupCommand: routePacket.commands?.setupRoute || `npm run setup:route -- --route ${routeInput}`
    },
    doctor: {
      status: doctor.status,
      openAiConfigured: doctor.openAi.configured,
      selectedFlag: doctor.scopedExecutors.selectedFlag,
      safeToLaunchWriteMode: doctor.scopedExecutors.safeToLaunchWriteMode
    },
    localContract: contract,
    nextSteps: buildReadinessNextSteps({
      status,
      routeInput,
      routePacket,
      doctor,
      windowsHost,
      contract
    })
  };
}

function buildReadinessNextSteps({ status, routeInput, routePacket, doctor, windowsHost, contract }) {
  const armCommand = routePacket.commands?.armRoute || `npm run route:arm -- --route ${routeInput}`;
  const steps = [];
  if (!windowsHost) {
    steps.push("Run this readiness command again on the Windows PC before launching the desktop app.");
  }
  if (!routePacket.selected) {
    steps.push("Choose a supported route with npm run setup:route -- --list.");
    return steps;
  }
  if (routePacket.status !== "ready") {
    steps.push(`Run ${armCommand}.`);
    steps.push(`Run npm run setup:route -- --route ${routeInput}.`);
  }
  if (!doctor.openAi.configured) {
    steps.push("Set OPENAI_API_KEY in .env if you want the OpenAI advisor during the app run.");
  }
  if (!contract.passed) {
    steps.push(`Run npm run openai:smoke -- --local-contract --route ${routeInput} and fix the reported local contract blocker.`);
  }
  if (status === "ready-for-native-dev") {
    steps.push(`Run npm run windows:dev -- --route ${routeInput}.`);
    steps.push("In the app: scan, select one ready row, consent, execute, post-run rescan, export proof.");
  } else if (windowsHost && routePacket.status === "ready" && contract.passed) {
    steps.push(`Run npm run windows:dev -- --route ${routeInput} after resolving any setup warnings above.`);
  }
  return steps;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = buildWindowsReadinessReport({ routeInput: args.route || "npm-cache" });
  console.log(JSON.stringify(report, null, 2));
  if (report.status === "local-contract-blocked" || report.status === "multi-route-blocked") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main();
}
