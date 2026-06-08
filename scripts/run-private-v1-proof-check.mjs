#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const SCRIPT_ID = "spaceguard-private-v1-proof-check";
const CHECK_SCHEMA = "spaceguard-private-v1-proof-check/v1";
const PRIVATE_V1_SCHEMA = "spaceguard-private-v1-windows-proof/v1";
const PRIVATE_PREFLIGHT_SCHEMA = "spaceguard-private-demo-windows-preflight/v1";
const FIRST_ROUTE_COMPLETION_SCHEMA = "spaceguard-first-route-completion-check/v1";
const SELECTED_ROUTE_COMPLETION_SCHEMA = "spaceguard-selected-route-completion-check/v1";
const REQUIRED_COMMANDS = [
  "private-windows-preflight",
  "first-route-proof",
  "bind-first-route-completion",
  "archive-first-route-root-exports",
  "selected-route-proof"
];

function parseArgs(argv = []) {
  const args = { file: "", allowIncomplete: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--file") args.file = argv[index + 1] || "";
    if (value.startsWith("--file=")) args.file = value.slice("--file=".length);
    if (value === "--allow-incomplete") args.allowIncomplete = true;
  }
  return args;
}

export function buildPrivateV1ProofCheck({
  proofPath = "",
  checkedAt = new Date().toISOString()
} = {}) {
  const blockers = [];
  const add = (id, label, detail) => {
    if (!blockers.some((blocker) => blocker.id === id)) blockers.push({ id, label, detail });
  };

  const resolvedProofPath = proofPath ? path.resolve(proofPath) : "";
  const proof = readJsonArtifact("private-v1-proof", resolvedProofPath, add);
  const baseDir = resolvedProofPath ? path.dirname(resolvedProofPath) : process.cwd();
  const artifacts = proof?.artifacts || {};
  const resolvedCommandLogPath = normalizeArtifactPath(proof?.commandLogPath || "", baseDir);
  const resolvedPreflightPath = normalizeArtifactPath(artifacts.privateWindowsPreflight || "", baseDir);
  const resolvedFirstRouteCompletionPath = normalizeArtifactPath(artifacts.firstRouteCompletionCheck || proof?.firstRouteCompletion?.path || "", baseDir);
  const resolvedSelectedRouteCompletionPath = normalizeArtifactPath(artifacts.selectedRouteCompletionCheck || proof?.selectedRouteCompletion?.path || "", baseDir);
  const resolvedPrivateV1ProofCheckPath = normalizeArtifactPath(artifacts.privateV1ProofCheck || "", baseDir);

  validatePrivateV1Proof(proof, resolvedProofPath, add);
  const commandRecords = readCommandRecords(resolvedCommandLogPath, add);
  const commandSummary = validateCommandRecords(commandRecords, add);
  const preflight = readJsonArtifact("private-windows-preflight", resolvedPreflightPath, add);
  const firstRouteCompletion = readJsonArtifact("first-route-completion", resolvedFirstRouteCompletionPath, add);
  const selectedRouteCompletion = readJsonArtifact("selected-route-completion", resolvedSelectedRouteCompletionPath, add);

  validatePreflight(preflight, add);
  validateFirstRouteCompletion(firstRouteCompletion, proof, resolvedFirstRouteCompletionPath, add);
  validateSelectedRouteCompletion(selectedRouteCompletion, proof, resolvedSelectedRouteCompletionPath, add);
  validateArchivedRootExports(proof, add);

  const selectedRoute = String(proof?.selectedRoute || selectedRouteCompletion?.routeInput || "");
  const firstRouteReclaimedBytes = Number(firstRouteCompletion?.counts?.reclaimedBytes || 0);
  const selectedRouteReclaimedBytes = Number(selectedRouteCompletion?.counts?.reclaimedBytes || 0);
  const canAcceptPrivateV1Proof = blockers.length === 0;

  return {
    schemaVersion: CHECK_SCHEMA,
    tool: SCRIPT_ID,
    checkedAt,
    status: canAcceptPrivateV1Proof ? "accepted" : "blocked",
    canAcceptPrivateV1Proof,
    selectedRoute,
    proofPath: resolvedProofPath,
    commandLogPath: resolvedCommandLogPath,
    privateWindowsPreflightPath: resolvedPreflightPath,
    firstRouteCompletionCheckPath: resolvedFirstRouteCompletionPath,
    selectedRouteCompletionCheckPath: resolvedSelectedRouteCompletionPath,
    privateV1ProofCheckPath: resolvedPrivateV1ProofCheckPath,
    blockers,
    counts: {
      blockers: blockers.length,
      commandRecords: commandRecords.length,
      requiredCommands: REQUIRED_COMMANDS.length,
      requiredCommandsPassed: commandSummary.requiredPassed,
      firstRouteReclaimedBytes,
      selectedRouteReclaimedBytes,
      reclaimedBytes: selectedRouteReclaimedBytes
    },
    primary: canAcceptPrivateV1Proof
      ? `Private V1 Windows proof is accepted for ${selectedRoute || "selected route"}.`
      : `Private V1 Windows proof is blocked by ${blockers.length} issue(s).`
  };
}

function normalizeArtifactPath(value = "", baseDir = process.cwd()) {
  const clean = String(value || "");
  if (!clean) return "";
  return path.isAbsolute(clean) ? clean : path.resolve(baseDir, clean);
}

function normalizeComparablePath(filePath = "") {
  const normalized = path.normalize(path.resolve(String(filePath || "")));
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function samePath(left = "", right = "") {
  if (!left || !right) return false;
  return normalizeComparablePath(left) === normalizeComparablePath(right);
}

function readJsonArtifact(id, filePath, add) {
  if (!filePath) {
    add(id, "Artifact missing", `${id} artifact path is missing.`);
    return null;
  }
  if (!fs.existsSync(filePath)) {
    add(id, "Artifact missing", `${id} artifact does not exist: ${filePath}`);
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${id} must be a JSON object.`);
    return parsed;
  } catch (error) {
    add(id, "Artifact parse failed", error instanceof Error ? error.message : `${id} artifact could not be parsed.`);
    return null;
  }
}

function readCommandRecords(commandLogPath, add) {
  if (!commandLogPath) {
    add("command-log", "Command log missing", "Private V1 proof command log path is missing.");
    return [];
  }
  if (!fs.existsSync(commandLogPath)) {
    add("command-log", "Command log missing", `Private V1 command log does not exist: ${commandLogPath}`);
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

function validatePrivateV1Proof(proof, resolvedProofPath, add) {
  if (!proof) return;
  if (proof.schemaVersion !== PRIVATE_V1_SCHEMA) {
    add("schema", "Private V1 proof schema mismatch", `Expected ${PRIVATE_V1_SCHEMA}.`);
  }
  if (proof.status !== "accepted") {
    add("status", "Private V1 proof not accepted", "Private V1 proof status must be accepted.");
  }
  if (proof.destructiveCommands !== false) {
    add("destructive-commands", "Destructive command authority present", "Private V1 proof must keep destructiveCommands=false.");
  }
  if (proof.directCleanupCommands !== false) {
    add("direct-cleanup-commands", "Direct cleanup command authority present", "Private V1 proof must keep directCleanupCommands=false.");
  }
  if (!proof.selectedRoute) {
    add("selected-route", "Selected route missing", "Private V1 proof must name the selected real-data route.");
  }
  if (proof.artifacts?.privateV1Proof && !samePath(proof.artifacts.privateV1Proof, resolvedProofPath)) {
    add("private-v1-proof-path", "Private V1 proof path mismatch", "Private V1 proof artifact path must match the checked file.");
  }
}

function validateCommandRecords(commandRecords, add) {
  let requiredPassed = 0;
  for (const id of REQUIRED_COMMANDS) {
    const record = commandRecords.find((row) => row.id === id);
    if (!record) {
      add(`command-${id}`, "Required command missing", `commands.ndjson must include ${id}.`);
      continue;
    }
    if (record.skipped) {
      add(`command-${id}`, "Required command skipped", `${id} must run for private V1 proof acceptance.`);
      continue;
    }
    if (record.exitCode !== 0) {
      add(`command-${id}`, "Required command failed", `${id} must exit 0 for private V1 proof acceptance.`);
      continue;
    }
    requiredPassed += 1;
  }

  const directCommand = commandRecords.find((row) => hasDirectCleanupCommand(row.command));
  if (directCommand) {
    add("command-direct-cleanup", "Direct cleanup command found", `Command ledger contains direct cleanup command: ${directCommand.command}`);
  }

  return { requiredPassed };
}

function hasDirectCleanupCommand(command = "") {
  return /\bRemove-Item\b/i.test(command) ||
    /\bClear-RecycleBin\b/i.test(command) ||
    /\bdel\s+/i.test(command) ||
    /\brmdir\s+/i.test(command);
}

function validatePreflight(preflight, add) {
  if (!preflight) return;
  if (preflight.schemaVersion !== PRIVATE_PREFLIGHT_SCHEMA) {
    add("private-windows-preflight", "Private Windows preflight schema mismatch", `Expected ${PRIVATE_PREFLIGHT_SCHEMA}.`);
  }
  if (preflight.status !== "passed") {
    add("private-windows-preflight", "Private Windows preflight not passed", "Private Windows preflight must pass before private V1 proof acceptance.");
  }
}

function validateFirstRouteCompletion(completion, proof, resolvedPath, add) {
  if (!completion) return;
  if (completion.schemaVersion !== FIRST_ROUTE_COMPLETION_SCHEMA) {
    add("first-route-completion", "First-route completion schema mismatch", `Expected ${FIRST_ROUTE_COMPLETION_SCHEMA}.`);
  }
  if (completion.status !== "accepted" || completion.canStartNextRoute !== true || completion.route !== "known-temp-delete") {
    add("first-route-completion", "First-route completion not accepted", "First route must be accepted for known-temp-delete before selected-route proof.");
  }
  if (Number(completion.counts?.reclaimedBytes || 0) <= 0) {
    add("first-route-reclaimed-bytes", "First-route reclaimed bytes missing", "First-route completion must prove positive reclaimed bytes.");
  }
  const summary = proof?.firstRouteCompletion || {};
  if (summary.path && !samePath(summary.path, resolvedPath)) {
    add("first-route-completion-path", "First-route completion path mismatch", "Private V1 summary must point at the checked first-route completion artifact.");
  }
  if (summary.status && summary.status !== completion.status) {
    add("first-route-completion-summary", "First-route completion summary mismatch", "Private V1 summary status must match first-route completion.");
  }
}

function validateSelectedRouteCompletion(completion, proof, resolvedPath, add) {
  if (!completion) return;
  if (completion.schemaVersion !== SELECTED_ROUTE_COMPLETION_SCHEMA) {
    add("selected-route-completion", "Selected-route completion schema mismatch", `Expected ${SELECTED_ROUTE_COMPLETION_SCHEMA}.`);
  }
  if (completion.status !== "accepted" || completion.canStartNextRoute !== true) {
    add("selected-route-completion", "Selected-route completion not accepted", "Selected route must be accepted before private V1 proof acceptance.");
  }
  if (Number(completion.counts?.reclaimedBytes || 0) <= 0) {
    add("selected-route-reclaimed-bytes", "Selected-route reclaimed bytes missing", "Selected-route completion must prove positive reclaimed bytes.");
  }
  if (proof?.selectedRoute && completion.routeInput && proof.selectedRoute !== completion.routeInput) {
    add("selected-route-mismatch", "Selected route mismatch", "Private V1 selectedRoute must match selected-route completion routeInput.");
  }
  const summary = proof?.selectedRouteCompletion || {};
  if (summary.path && !samePath(summary.path, resolvedPath)) {
    add("selected-route-completion-path", "Selected-route completion path mismatch", "Private V1 summary must point at the checked selected-route completion artifact.");
  }
  if (summary.status && summary.status !== completion.status) {
    add("selected-route-completion-summary", "Selected-route completion summary mismatch", "Private V1 summary status must match selected-route completion.");
  }
}

function validateArchivedRootExports(proof, add) {
  const archived = Array.isArray(proof?.archivedRootExports) ? proof.archivedRootExports : [];
  for (const [index, row] of archived.entries()) {
    const destination = String(row?.destination || "");
    if (!destination) {
      add("archived-root-export", "Archived root export destination missing", `Archived root export ${index + 1} has no destination.`);
      continue;
    }
    if (!fs.existsSync(destination)) {
      add("archived-root-export", "Archived root export missing", `Archived root export does not exist: ${destination}`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const result = buildPrivateV1ProofCheck({ proofPath: args.file });
  console.log(JSON.stringify(result, null, 2));
  if (!result.canAcceptPrivateV1Proof && !args.allowIncomplete) process.exitCode = 1;
}
