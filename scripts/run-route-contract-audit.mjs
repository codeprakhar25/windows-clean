#!/usr/bin/env node
import process from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { routeSpecs } from "./run-setup-route.mjs";
import { buildWindowsValidationPacket } from "./run-windows-validation-packet.mjs";
import {
  buildFixtureContext,
  buildFixtureOnlyAdviceResult,
  buildFixtureRecommendationBroker,
  resolveSmokeRoute,
  validateSmokeAdvice
} from "./run-openai-advisor-smoke.mjs";
import { buildRouteNativeBoundary } from "../src/route-boundary-contracts.mjs";

const SCRIPT_ID = "spaceguard-route-contract-audit";
const scriptPath = fileURLToPath(import.meta.url);

function scopedRouteEnv(spec, env = {}) {
  const clean = { ...env, SPACEGUARD_ROUTE_SETUP_IGNORE_DOTENV: "1" };
  for (const routeSpec of routeSpecs) {
    clean[routeSpec.envVar] = "0";
  }
  clean[spec.envVar] = "1";
  return clean;
}

function buildRouteAuditRow(spec, { env = {} } = {}) {
  const boundary = buildRouteNativeBoundary(spec);
  const validationPacket = buildWindowsValidationPacket({
    routeInput: spec.aliases?.[0] || spec.route,
    env: scopedRouteEnv(spec, env)
  });
  const smokeRoute = resolveSmokeRoute(spec.aliases?.[0] || spec.route);
  const openAiContext = buildFixtureContext({ routeInput: spec.aliases?.[0] || spec.route });
  const fixtureAdvice = buildFixtureOnlyAdviceResult({ requiredRecommendation: smokeRoute.requiredRecommendation });
  const broker = buildFixtureRecommendationBroker({
    context: openAiContext,
    advice: fixtureAdvice.advice,
    route: smokeRoute
  });
  const smokeValidation = validateSmokeAdvice({
    context: openAiContext,
    advice: fixtureAdvice.advice,
    broker,
    requiredRecommendation: smokeRoute.requiredRecommendation
  });
  const task = smokeValidation.task || null;
  const canExecuteWithoutAppEvidence = validationPacket.liveValidationManifest?.runtime?.canExecuteWithoutAppEvidence;
  const checks = [
    buildCheck("setup-route", "Setup route present", Boolean(spec.route && spec.requestMode && spec.panelId), spec.route || "missing route"),
    buildCheck("native-boundary", "Native boundary present", Boolean(boundary.adapterFunction && boundary.rustFunction), `${boundary.adapterFunction || "missing adapter"} / ${boundary.rustFunction || "missing Rust branch"}`),
    buildCheck("validation-packet", "Validation packet ready", validationPacket.status === "ready" && validationPacket.route === spec.route && validationPacket.selected?.requestMode === spec.requestMode, `${validationPacket.status || "missing"} ${validationPacket.route || "missing"} ${validationPacket.selected?.requestMode || "missing"}`),
    buildCheck("openai-fixture", "OpenAI fixture brokered", Boolean(smokeValidation.passed), smokeValidation.failures.join("; ") || "broker-ready"),
    buildCheck("app-evidence-required", "App evidence required", openAiContext.liveRouteValidation?.canExecuteWithoutAppEvidence === false && canExecuteWithoutAppEvidence === false, "canExecuteWithoutAppEvidence=false")
  ];
  const status = checks.every((check) => check.passed) ? "passed" : "failed";

  return {
    id: spec.aliases?.[0] || spec.route,
    route: spec.route,
    routeInput: spec.aliases?.[0] || spec.route,
    title: spec.title,
    status,
    envVar: spec.envVar,
    requestMode: spec.requestMode,
    panelId: spec.panelId,
    actionLabel: spec.actionLabel,
    adapterFunction: boundary.adapterFunction,
    rustFunction: boundary.rustFunction,
    validationStatus: validationPacket.status,
    validationRoute: validationPacket.route,
    validationRequestMode: validationPacket.selected?.requestMode || "",
    openAiActionType: smokeRoute.requiredRecommendation.actionType,
    openAiTargetId: smokeRoute.requiredRecommendation.targetId,
    openAiTaskStatus: task?.status || "missing",
    canExecuteWithoutAppEvidence,
    boundarySummary: {
      targetAllowlist: boundary.targetAllowlist.slice(0, 4),
      targetRejects: boundary.targetRejects.slice(0, 6),
      deletePolicy: boundary.deletePolicy.slice(0, 4),
      postRunProof: boundary.postRunProof.slice(0, 4)
    },
    checks
  };
}

function buildCheck(id, label, passed, detail = "") {
  return {
    id,
    label,
    passed: Boolean(passed),
    detail: String(detail || "")
  };
}

export function buildRouteContractAuditReport({
  env = process.env,
  generatedAt = new Date().toISOString()
} = {}) {
  const rows = routeSpecs.map((spec) => buildRouteAuditRow(spec, { env }));
  const failed = rows.filter((row) => row.status !== "passed");
  return {
    schemaVersion: "spaceguard-route-contract-audit/v1",
    tool: SCRIPT_ID,
    generatedAt,
    status: failed.length ? "failed" : "passed",
    counts: {
      routes: rows.length,
      passed: rows.length - failed.length,
      failed: failed.length
    },
    rows,
    captureArtifacts: [
      "route-contract-audit-report",
      "setup-route-packets",
      "windows-validation-packets",
      "openai-fixture-smoke-output",
      "live-validation-manifests"
    ],
    nextSteps: failed.length
      ? failed.slice(0, 3).map((row) => `${row.route}: fix ${row.checks.filter((check) => !check.passed).map((check) => check.id).join(", ")}`)
      : [
          "Run the selected route on Windows with exactly one scoped executor flag.",
          "Capture before scan, consent, execution ledger, native volume proof, post-run rescan, selected-route proof import, and workflow proof verifier output."
        ]
  };
}

export function main() {
  const report = buildRouteContractAuditReport();
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "passed") process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main();
}
