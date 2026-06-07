#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { buildFirstRoutePreflightCheck } from "./run-first-route-preflight-check.mjs";
import { buildWorkflowProofCheck } from "./run-workflow-proof-check.mjs";

const SCRIPT_ID = "spaceguard-first-route-completion-check";
const CHECK_SCHEMA = "spaceguard-first-route-completion-check/v1";
const FIXTURE_EVIDENCE_SCHEMA = "spaceguard-fixture-evidence/v1";
const NATIVE_DEV_EXIT_SCHEMA = "spaceguard-native-dev-exit/v1";
const TEMP_ROUTE = "known-temp-delete";
const REQUIRED_POST_APP_COMMANDS = [
  "native-dev-launch",
  "native-dev-exit",
  "finalize-after-app",
  "inspect-fixtures-after",
  "workflow-proof-check"
];

function parseArgs(argv = []) {
  const args = { preflight: "", afterFixture: "", workflowProof: "", nativeExit: "", allowIncomplete: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--preflight") args.preflight = argv[index + 1] || "";
    if (value.startsWith("--preflight=")) args.preflight = value.slice("--preflight=".length);
    if (value === "--after-fixture") args.afterFixture = argv[index + 1] || "";
    if (value.startsWith("--after-fixture=")) args.afterFixture = value.slice("--after-fixture=".length);
    if (value === "--workflow-proof") args.workflowProof = argv[index + 1] || "";
    if (value.startsWith("--workflow-proof=")) args.workflowProof = value.slice("--workflow-proof=".length);
    if (value === "--native-exit") args.nativeExit = argv[index + 1] || "";
    if (value.startsWith("--native-exit=")) args.nativeExit = value.slice("--native-exit=".length);
    if (value === "--allow-incomplete") args.allowIncomplete = true;
  }
  return args;
}

export function buildFirstRouteCompletionCheck({
  preflightPath = "",
  afterFixturePath = "",
  workflowProofPath = "",
  nativeExitPath = "",
  checkedAt = new Date().toISOString()
} = {}) {
  const blockers = [];
  const add = (id, label, detail) => {
    if (!blockers.some((blocker) => blocker.id === id)) blockers.push({ id, label, detail });
  };

  const resolvedPreflightPath = preflightPath ? path.resolve(preflightPath) : "";
  const preflight = buildFirstRoutePreflightCheck({ preflightPath: resolvedPreflightPath, checkedAt });
  if (!preflight.canLaunchApp) {
    add("preflight", "Preflight not accepted", preflight.primary || "First-route preflight check is not accepted.");
  }

  const preflightObject = readOptionalJsonArtifact("preflight", resolvedPreflightPath, add);
  const artifactAfterFixturePath = normalizeArtifactPath(
    afterFixturePath || preflightObject?.artifacts?.fixtureAfterCleanup || "",
    resolvedPreflightPath ? path.dirname(resolvedPreflightPath) : process.cwd()
  );
  const artifactCommandLogPath = normalizeArtifactPath(
    preflightObject?.artifacts?.commandLog || "",
    resolvedPreflightPath ? path.dirname(resolvedPreflightPath) : process.cwd()
  );
  const artifactNativeExitPath = normalizeArtifactPath(
    nativeExitPath || preflightObject?.artifacts?.nativeDevExit || "",
    resolvedPreflightPath ? path.dirname(resolvedPreflightPath) : process.cwd()
  );
  const resolvedWorkflowProofPath = workflowProofPath ? path.resolve(workflowProofPath) : path.resolve(process.cwd(), "spaceguard-real-workflow-proof.md");

  const commandRecords = readCommandRecords(artifactCommandLogPath, add);
  const commandSummary = validatePostAppCommandRecords(commandRecords, add);
  const afterFixture = readOptionalJsonArtifact("after-fixture", artifactAfterFixturePath, add);
  const nativeExit = readOptionalJsonArtifact("native-exit", artifactNativeExitPath, add);
  const workflowProofText = readOptionalTextArtifact("workflow-proof", resolvedWorkflowProofPath, add);
  const workflowProof = workflowProofText
    ? buildWorkflowProofCheck({ evidenceText: workflowProofText, checkedAt })
    : buildWorkflowProofCheck({ evidenceObject: { schemaVersion: "" }, checkedAt });

  validateAfterFixtureEvidence(afterFixture, add);
  validateNativeExitEvidence(nativeExit, add);
  validateWorkflowProof(workflowProof, add);

  const reclaimedBytes = Number(workflowProof.counts?.reclaimedBytes || 0);
  const nativeExitCode = Number.isFinite(Number(nativeExit?.exitCode)) ? Number(nativeExit.exitCode) : null;
  const canStartNextRoute = blockers.length === 0;
  return {
    schemaVersion: CHECK_SCHEMA,
    tool: SCRIPT_ID,
    checkedAt,
    status: canStartNextRoute ? "accepted" : "blocked",
    canStartNextRoute,
    route: TEMP_ROUTE,
    routeInput: preflight.routeInput || "temp-fixture",
    preflightPath: resolvedPreflightPath,
    commandLogPath: artifactCommandLogPath,
    afterFixturePath: artifactAfterFixturePath,
    nativeExitPath: artifactNativeExitPath,
    workflowProofPath: resolvedWorkflowProofPath,
    blockers,
    counts: {
      blockers: blockers.length,
      reclaimedBytes,
      nativeExitCode,
      commandRecords: commandRecords.length,
      requiredPostAppCommands: REQUIRED_POST_APP_COMMANDS.length,
      postAppCommandsPassed: commandSummary.requiredPassed,
      preflightBlockers: Number(preflight.counts?.blockers || 0),
      workflowProofBlockers: Number(workflowProof.counts?.blockers || 0),
      afterFixtureRecords: Array.isArray(afterFixture?.records) ? afterFixture.records.length : 0,
      expectedMissingAfterCleanup: Number(afterFixture?.counts?.expectedMissingAfterCleanup || 0),
      unexpectedPresentAfterCleanup: Number(afterFixture?.counts?.unexpectedPresentAfterCleanup || 0)
    },
    primary: canStartNextRoute
      ? "First real temp-fixture cleanup is proven and the next route may be considered."
      : `First-route completion is blocked by ${blockers.length} issue(s).`
  };
}

function normalizeArtifactPath(value = "", baseDir = process.cwd()) {
  const clean = String(value || "");
  if (!clean) return "";
  return path.isAbsolute(clean) ? clean : path.resolve(baseDir, clean);
}

function readOptionalJsonArtifact(id, filePath, add) {
  if (!filePath) {
    add(id, "Artifact missing", `${id} artifact path is missing.`);
    return null;
  }
  if (!fs.existsSync(filePath)) {
    add(id, "Artifact missing", `${id} artifact does not exist: ${filePath}`);
    return null;
  }
  try {
    return parseJsonObject(fs.readFileSync(filePath, "utf8"), filePath);
  } catch (error) {
    add(id, "Artifact parse failed", error instanceof Error ? error.message : `${id} artifact could not be parsed.`);
    return null;
  }
}

function readOptionalTextArtifact(id, filePath, add) {
  if (!filePath) {
    add(id, "Artifact missing", `${id} artifact path is missing.`);
    return "";
  }
  if (!fs.existsSync(filePath)) {
    add(id, "Artifact missing", `${id} artifact does not exist: ${filePath}`);
    return "";
  }
  return fs.readFileSync(filePath, "utf8");
}

function readCommandRecords(commandLogPath, add) {
  if (!commandLogPath) {
    add("artifact-command-log", "Command log missing", "Command log artifact path is missing.");
    return [];
  }
  if (!fs.existsSync(commandLogPath)) {
    add("artifact-command-log", "Command log missing", `Command log does not exist: ${commandLogPath}`);
    return [];
  }
  const records = [];
  for (const [index, line] of fs.readFileSync(commandLogPath, "utf8").split(/\r?\n/).entries()) {
    const clean = line.trim();
    if (!clean) continue;
    try {
      const parsed = JSON.parse(clean);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) records.push(parsed);
    } catch {
      add("command-log-parse", "Command log parse failed", `commands.ndjson line ${index + 1} is not JSON.`);
    }
  }
  return records;
}

function parseJsonObject(text = "", label = "artifact") {
  const clean = String(text || "").trim();
  if (!clean) throw new Error(`${label} is empty.`);
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (match?.[1]) return JSON.parse(match[1]);
    const objectText = extractFirstJsonObject(clean);
    if (objectText) return JSON.parse(objectText);
  }
  throw new Error(`${label} could not be parsed as JSON.`);
}

function extractFirstJsonObject(text = "") {
  const start = text.indexOf("{");
  if (start < 0) return "";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return "";
}

function validateAfterFixtureEvidence(evidence, add) {
  if (!evidence) return;
  if (evidence.schemaVersion !== FIXTURE_EVIDENCE_SCHEMA) {
    add("after-fixture", "After-cleanup fixture schema mismatch", `Expected ${FIXTURE_EVIDENCE_SCHEMA}.`);
  }
  if (evidence.passed !== true || evidence.destructiveCommands !== false || evidence.afterCleanupRoute !== TEMP_ROUTE) {
    add("after-fixture", "After-cleanup fixture evidence blocked", "After-cleanup fixture evidence must pass for known-temp-delete with no destructive commands.");
  }
  if (
    Number(evidence.counts?.expectedMissingAfterCleanup || 0) < 1 ||
    Number(evidence.counts?.unexpectedPresentAfterCleanup || 0) !== 0 ||
    Number(evidence.counts?.missing || 0) !== 0 ||
    Number(evidence.counts?.sizeMismatches || 0) !== 0 ||
    Number(evidence.counts?.ageMismatches || 0) !== 0
  ) {
    add("after-fixture", "After-cleanup fixture counts invalid", "After-cleanup evidence must show only the temp fixture expected-missing and no other fixture mismatch.");
  }

  const records = Array.isArray(evidence.records) ? evidence.records : [];
  const knownTemp = records.find((record) => record?.purpose === "known-temp-fixture");
  if (
    !knownTemp ||
    knownTemp.expectedMissingAfterCleanup !== true ||
    knownTemp.exists !== false ||
    Number(knownTemp.actualBytes || 0) !== 0 ||
    knownTemp.presenceMatches === false
  ) {
    add("after-fixture", "Temp fixture not deleted", "Known temp fixture must be expected-missing, absent, and zero bytes after cleanup.");
  }

  const retained = records.filter((record) => record?.purpose !== "known-temp-fixture");
  if (!retained.length || retained.some((record) => record.exists !== true || record.presenceMatches === false)) {
    add("after-fixture", "Non-temp fixture mismatch", "Non-temp seeded fixtures must remain present after temp cleanup.");
  }
}

function validatePostAppCommandRecords(records = [], add) {
  let requiredPassed = 0;
  for (const id of REQUIRED_POST_APP_COMMANDS) {
    const record = records.find((item) => item?.id === id);
    if (!record) {
      add(`command-${id}`, "Command missing", `${id} command record is missing.`);
      continue;
    }

    if (id === "native-dev-launch") {
      if (record.userGated !== true) {
        add(`command-${id}`, "Command not user-gated", "native-dev-launch must be recorded as userGated=true.");
        continue;
      }
      requiredPassed += 1;
      continue;
    }

    if (id === "finalize-after-app") {
      if (record.skipped === true) {
        add(`command-${id}`, "Command skipped", `finalize-after-app was skipped: ${record.reason || "missing reason"}.`);
        continue;
      }
      if (record.userGated !== true) {
        add(`command-${id}`, "Command not user-gated", "finalize-after-app must be recorded as userGated=true.");
        continue;
      }
      requiredPassed += 1;
      continue;
    }

    if (!isExitCodeZero(record.exitCode)) {
      add(`command-${id}`, "Command failed", `${id} exited with ${record.exitCode ?? "missing"}.`);
      continue;
    }
    requiredPassed += 1;
  }
  return { requiredPassed };
}

function isExitCodeZero(value) {
  return value === 0 || value === "0";
}

function validateNativeExitEvidence(evidence, add) {
  if (!evidence) return;
  if (evidence.schemaVersion !== NATIVE_DEV_EXIT_SCHEMA) {
    add("native-exit", "Native app exit schema mismatch", `Expected ${NATIVE_DEV_EXIT_SCHEMA}.`);
  }
  if (String(evidence.command || "") !== "npm run native:dev") {
    add("native-exit", "Native app command mismatch", "Native app exit evidence must come from npm run native:dev.");
  }

  const exitCode = Number(evidence.exitCode);
  if (evidence.success !== true || !Number.isFinite(exitCode) || exitCode !== 0) {
    add(
      "native-exit",
      "Native app exit blocked",
      `Native desktop workflow must exit successfully before completion; observed exit code ${Number.isFinite(exitCode) ? exitCode : "missing"}.`
    );
  }
}

function validateWorkflowProof(proofCheck, add) {
  if (!proofCheck?.canAccept) {
    add("workflow-proof", "Workflow proof not accepted", proofCheck?.primary || "Workflow proof verifier did not accept the proof.");
    return;
  }
  if (proofCheck.route !== TEMP_ROUTE) {
    add("workflow-proof", "Workflow route mismatch", "Workflow proof must be for known-temp-delete.");
  }
  if (Number(proofCheck.counts?.reclaimedBytes || 0) <= 0) {
    add("workflow-proof", "Recovered bytes missing", "Workflow proof must include positive reclaimed bytes.");
  }
  if (proofCheck.readyForNextRoute !== true) {
    add("workflow-proof", "Next route not cleared", "Workflow proof must explicitly clear next-route handoff.");
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  const args = parseArgs(process.argv.slice(2));
  const result = buildFirstRouteCompletionCheck({
    preflightPath: args.preflight,
    afterFixturePath: args.afterFixture,
    workflowProofPath: args.workflowProof,
    nativeExitPath: args.nativeExit
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.canStartNextRoute && !args.allowIncomplete) process.exitCode = 1;
}
