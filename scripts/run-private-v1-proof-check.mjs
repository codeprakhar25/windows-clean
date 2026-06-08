#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const SCRIPT_ID = "spaceguard-private-v1-proof-check";
const CHECK_SCHEMA = "spaceguard-private-v1-proof-check/v1";
const PRIVATE_V1_SCHEMA = "spaceguard-private-v1-windows-proof/v1";
const ROUTE_SETUP_SCHEMA = "spaceguard-route-setup-packet/v1";
const PRIVATE_PREFLIGHT_SCHEMA = "spaceguard-private-demo-windows-preflight/v1";
const FIRST_ROUTE_COMPLETION_SCHEMA = "spaceguard-first-route-completion-check/v1";
const SELECTED_ROUTE_COMPLETION_SCHEMA = "spaceguard-selected-route-completion-check/v1";
const REQUIRED_COMMANDS = [
  "selected-route-setup",
  "private-windows-preflight",
  "first-route-proof",
  "bind-first-route-completion",
  "archive-first-route-root-exports",
  "selected-route-proof"
];
const REQUIRED_STDERR_COMMANDS = new Set([
  "private-windows-preflight",
  "first-route-proof",
  "selected-route-proof"
]);

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
  const resolvedSelectedRouteSetupPath = normalizeArtifactPath(artifacts.selectedRouteSetup || "", baseDir);
  const resolvedPreflightPath = normalizeArtifactPath(artifacts.privateWindowsPreflight || "", baseDir);
  const resolvedFirstRouteCompletionPath = normalizeArtifactPath(artifacts.firstRouteCompletionCheck || proof?.firstRouteCompletion?.path || "", baseDir);
  const resolvedSelectedRouteCompletionPath = normalizeArtifactPath(artifacts.selectedRouteCompletionCheck || proof?.selectedRouteCompletion?.path || "", baseDir);
  const resolvedPrivateV1ProofCheckPath = normalizeArtifactPath(artifacts.privateV1ProofCheck || "", baseDir);

  validatePrivateV1Proof(proof, resolvedProofPath, add);
  const commandRecords = readCommandRecords(resolvedCommandLogPath, add);
  const commandSummary = validateCommandRecords(commandRecords, add, path.dirname(resolvedCommandLogPath || baseDir));
  const selectedRouteSetup = readJsonArtifact("selected-route-setup", resolvedSelectedRouteSetupPath, add);
  const preflight = readJsonArtifact("private-windows-preflight", resolvedPreflightPath, add);
  const firstRouteCompletion = readJsonArtifact("first-route-completion", resolvedFirstRouteCompletionPath, add);
  const selectedRouteCompletion = readJsonArtifact("selected-route-completion", resolvedSelectedRouteCompletionPath, add);

  validateSelectedRouteSetup(selectedRouteSetup, proof, selectedRouteCompletion, add);
  validatePreflight(preflight, add);
  const nativeBundleArtifactCount = validateNativeBundleArtifacts(preflight, add);
  const firstRouteProofCounts = validateFirstRouteCompletion(firstRouteCompletion, proof, resolvedFirstRouteCompletionPath, add);
  const selectedRouteProofCounts = validateSelectedRouteCompletion(selectedRouteCompletion, proof, resolvedSelectedRouteCompletionPath, add);
  const openAiSmokeArtifactCount =
    validateChildOpenAiSmokeEvidence(firstRouteCompletion, "first-route", "First-route", resolvedFirstRouteCompletionPath, add) +
    validateChildOpenAiSmokeEvidence(selectedRouteCompletion, "selected-route", "Selected-route", resolvedSelectedRouteCompletionPath, add);
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
    selectedRouteSetupPath: resolvedSelectedRouteSetupPath,
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
      nativeBundleArtifacts: nativeBundleArtifactCount,
      openAiSmokeArtifacts: openAiSmokeArtifactCount,
      firstRouteReclaimedBytes,
      firstRouteLedgerReclaimedBytes: firstRouteProofCounts.ledgerReclaimedBytes,
      firstRouteRescanExpectedBytes: firstRouteProofCounts.rescanExpectedBytes,
      firstRouteRescanActualRemainingBytes: firstRouteProofCounts.rescanActualRemainingBytes,
      selectedRouteReclaimedBytes,
      selectedRouteLedgerReclaimedBytes: selectedRouteProofCounts.ledgerReclaimedBytes,
      selectedRouteRescanExpectedBytes: selectedRouteProofCounts.rescanExpectedBytes,
      selectedRouteRescanActualRemainingBytes: selectedRouteProofCounts.rescanActualRemainingBytes,
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

function validateCommandRecords(commandRecords, add, baseDir = process.cwd()) {
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
    if (REQUIRED_STDERR_COMMANDS.has(id)) {
      validateCommandStderrArtifact(record, id, baseDir, add);
    }
    requiredPassed += 1;
  }

  const directCommand = commandRecords.find((row) => hasDirectCleanupCommand(row.command));
  if (directCommand) {
    add("command-direct-cleanup", "Direct cleanup command found", `Command ledger contains direct cleanup command: ${directCommand.command}`);
  }

  return { requiredPassed };
}

function validateCommandStderrArtifact(record, id, baseDir, add) {
  const stderrPath = normalizeArtifactPath(record?.stderrPath || "", baseDir);
  if (!stderrPath) {
    add(`command-stderr-${id}`, "Required command stderr missing", `${id} must record a stderrPath artifact for auditability.`);
    return;
  }
  if (!fs.existsSync(stderrPath)) {
    add(`command-stderr-${id}`, "Required command stderr missing", `${id} stderr artifact does not exist: ${stderrPath}`);
    return;
  }
  const stat = fs.statSync(stderrPath);
  if (!stat.isFile()) {
    add(`command-stderr-${id}`, "Required command stderr invalid", `${id} stderr artifact must be a file: ${stderrPath}`);
  }
}

function validateChildOpenAiSmokeEvidence(completion, idPrefix, label, completionPath, add) {
  if (!completion) return 0;
  const baseDir = completionPath ? path.dirname(completionPath) : process.cwd();
  const commandLogPath = normalizeArtifactPath(completion.commandLogPath || "", baseDir);
  const commandRecords = readChildCommandRecords(`${idPrefix}-command-log`, commandLogPath, add);
  if (!commandRecords.length) return 0;
  validateChildCommandRecords(commandRecords, idPrefix, label, add);

  const commandLogDir = path.dirname(commandLogPath);
  const expectedRoute = String(completion.route || "");
  return validateOpenAiSmokeCommand(commandRecords, {
    idPrefix,
    label,
    commandId: "openai-fixture-smoke",
    expectedRoute,
    commandLogDir,
    requireLive: false,
    add
  }) + validateOpenAiSmokeCommand(commandRecords, {
    idPrefix,
    label,
    commandId: "openai-live-smoke",
    expectedRoute,
    commandLogDir,
    requireLive: true,
    add
  });
}

function readChildCommandRecords(id, commandLogPath, add) {
  if (!commandLogPath) {
    add(id, "Child command log missing", `${id} path is missing.`);
    return [];
  }
  if (!fs.existsSync(commandLogPath)) {
    add(id, "Child command log missing", `${id} does not exist: ${commandLogPath}`);
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
      add(`${id}-parse`, "Child command log parse failed", `${path.basename(commandLogPath)} line ${index + 1} is not JSON.`);
    }
  }
  return records;
}

function validateOpenAiSmokeCommand(commandRecords, {
  idPrefix,
  label,
  commandId,
  expectedRoute,
  commandLogDir,
  requireLive,
  add
}) {
  const blockerId = `${idPrefix}-${commandId}`;
  const record = findLatestCommandRecord(commandRecords, commandId);
  const smokeLabel = requireLive ? "Live OpenAI smoke" : "OpenAI fixture smoke";
  if (!record) {
    add(blockerId, `${smokeLabel} missing`, `${label} command log must include ${commandId}.`);
    return 0;
  }
  if (record.skipped === true) {
    add(blockerId, `${smokeLabel} skipped`, `${label} ${smokeLabel.toLowerCase()} must run for private V1 proof acceptance.`);
    return 0;
  }
  if (!isExitCodeZero(record.exitCode)) {
    add(blockerId, `${smokeLabel} failed`, `${label} ${commandId} exited with ${record.exitCode ?? "missing"}.`);
    return 0;
  }

  const outputPath = normalizeArtifactPath(record.outputPath || "", commandLogDir);
  if (!outputPath) {
    add(blockerId, `${smokeLabel} artifact missing`, `${label} ${commandId} must record an outputPath artifact.`);
    return 0;
  }
  if (!fs.existsSync(outputPath)) {
    add(blockerId, `${smokeLabel} artifact missing`, `${label} ${commandId} output artifact does not exist: ${outputPath}`);
    return 0;
  }
  const output = fs.readFileSync(outputPath, "utf8");
  if (!/validation=broker-ready/.test(output)) {
    add(blockerId, `${smokeLabel} not broker-ready`, `${label} ${commandId} output must include validation=broker-ready.`);
    return 0;
  }
  if (expectedRoute && !new RegExp(`\\broute=${escapeRegExp(expectedRoute)}\\b`).test(output)) {
    add(blockerId, `${smokeLabel} route mismatch`, `${label} ${commandId} output must bind to route=${expectedRoute}.`);
    return 0;
  }
  return 1;
}

function validateChildCommandRecords(commandRecords, idPrefix, label, add) {
  const directCommand = commandRecords.find((row) => hasDirectCleanupCommand(row.command));
  if (directCommand) {
    add(`${idPrefix}-command-direct-cleanup`, "Direct cleanup command found", `${label} child command ledger contains direct cleanup command: ${directCommand.command}`);
  }
}

function findLatestCommandRecord(records = [], id = "") {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (records[index]?.id === id) return records[index];
  }
  return null;
}

function isExitCodeZero(value) {
  return value === 0 || value === "0";
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function validateSelectedRouteSetup(routeSetup, proof, selectedRouteCompletion, add) {
  if (!routeSetup) return;
  if (routeSetup.schemaVersion !== ROUTE_SETUP_SCHEMA) {
    add("selected-route-setup", "Selected-route setup schema mismatch", `Expected ${ROUTE_SETUP_SCHEMA}.`);
  }
  if (routeSetup.status === "unknown-route" || routeSetup.status === "route-required" || !routeSetup.selected) {
    add("selected-route-setup", "Selected route setup not resolved", "Selected-route setup must resolve to a known scoped cleanup route.");
  }
  if (routeSetup.route === "known-temp-delete") {
    add("selected-route-setup", "Selected route is bootstrap route", "Private V1 already runs temp-fixture first; selected route must be a real-data route.");
  }
  if (proof?.selectedRoute && routeSetup.routeInput && proof.selectedRoute !== routeSetup.routeInput) {
    add("selected-route-setup-mismatch", "Selected route setup input mismatch", "Private V1 selectedRoute must match selected-route setup routeInput.");
  }
  if (selectedRouteCompletion?.route && routeSetup.route && selectedRouteCompletion.route !== routeSetup.route) {
    add("selected-route-setup-mismatch", "Selected route setup canonical mismatch", "Selected-route setup canonical route must match selected-route completion route.");
  }
  if (proof?.routes?.selectedRouteCanonical && routeSetup.route && proof.routes.selectedRouteCanonical !== routeSetup.route) {
    add("selected-route-setup-mismatch", "Selected route summary canonical mismatch", "Private V1 routes.selectedRouteCanonical must match selected-route setup route.");
  }
  if (proof?.routes?.selectedRouteSetupStatus && routeSetup.status && proof.routes.selectedRouteSetupStatus !== routeSetup.status) {
    add("selected-route-setup-mismatch", "Selected route setup status mismatch", "Private V1 routes.selectedRouteSetupStatus must match selected-route setup status.");
  }
}

function validateNativeBundleArtifacts(preflight, add) {
  const artifacts = Array.isArray(preflight?.nativeBundleArtifacts) ? preflight.nativeBundleArtifacts : [];
  if (artifacts.length < 1) {
    add("native-bundle-artifacts", "Native bundle artifacts missing", "Private Windows preflight must capture at least one native bundle artifact after npm run native:build.");
    return 0;
  }

  const supportedExtensions = new Set([".exe", ".msi", ".msix", ".zip"]);
  let validCount = 0;
  for (const [index, artifact] of artifacts.entries()) {
    const artifactPath = String(artifact?.path || "");
    const evidencePath = String(artifact?.evidencePath || "");
    const extension = String(artifact?.extension || path.extname(artifactPath)).toLowerCase();
    const bytes = Number(artifact?.bytes || 0);
    const sha256 = String(artifact?.sha256 || "").toLowerCase();
    if (!artifactPath) {
      add("native-bundle-artifact-path", "Native bundle artifact path missing", `Native bundle artifact ${index + 1} has no path.`);
      continue;
    }
    if (!evidencePath) {
      add("native-bundle-artifact-evidence", "Copied native bundle artifact missing", `Native bundle artifact ${index + 1} has no copied evidencePath.`);
      continue;
    }
    if (!supportedExtensions.has(extension)) {
      add("native-bundle-artifact-extension", "Native bundle artifact extension unsupported", `Native bundle artifact ${index + 1} has unsupported extension: ${extension || "missing"}.`);
      continue;
    }
    if (bytes <= 0) {
      add("native-bundle-artifact-bytes", "Native bundle artifact byte count missing", `Native bundle artifact ${index + 1} must report positive bytes.`);
      continue;
    }
    if (!/^[a-f0-9]{64}$/.test(sha256)) {
      add("native-bundle-artifact-sha256", "Native bundle artifact hash missing", `Native bundle artifact ${index + 1} must report a SHA-256 hash.`);
      continue;
    }
    if (!fs.existsSync(evidencePath)) {
      add("native-bundle-artifact-evidence", "Copied native bundle artifact missing", `Copied native bundle artifact does not exist: ${evidencePath}`);
      continue;
    }
    const evidenceStat = fs.statSync(evidencePath);
    if (!evidenceStat.isFile()) {
      add("native-bundle-artifact-evidence", "Copied native bundle artifact is not a file", `Copied native bundle artifact is not a file: ${evidencePath}`);
      continue;
    }
    if (evidenceStat.size !== bytes) {
      add("native-bundle-artifact-bytes", "Copied native bundle artifact byte count mismatch", `Copied native bundle artifact size does not match metadata: ${evidencePath}`);
      continue;
    }
    const actualHash = crypto.createHash("sha256").update(fs.readFileSync(evidencePath)).digest("hex");
    if (actualHash !== sha256) {
      add("native-bundle-artifact-sha256", "Copied native bundle artifact hash mismatch", `Copied native bundle artifact hash does not match metadata: ${evidencePath}`);
      continue;
    }
    validCount += 1;
  }

  return validCount;
}

function validateFirstRouteCompletion(completion, proof, resolvedPath, add) {
  const proofCounts = validateCompletionProofCounts(completion, "first-route", "First-route", add);
  if (!completion) return proofCounts;
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
  validateCompletionSummaryCounts(summary, proofCounts, "first-route", "First-route", add);
  return proofCounts;
}

function validateSelectedRouteCompletion(completion, proof, resolvedPath, add) {
  const proofCounts = validateCompletionProofCounts(completion, "selected-route", "Selected-route", add);
  if (!completion) return proofCounts;
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
  validateCompletionSummaryCounts(summary, proofCounts, "selected-route", "Selected-route", add);
  return proofCounts;
}

function validateCompletionProofCounts(completion, idPrefix, label, add) {
  const counts = completion?.counts || {};
  const proofCounts = {
    reclaimedBytes: Number(counts.reclaimedBytes || 0),
    selectedRouteProofPacketReclaimedBytes: Number(counts.selectedRouteProofPacketReclaimedBytes || 0),
    ledgerReclaimedBytes: Number(counts.ledgerReclaimedBytes || 0),
    rescanExpectedBytes: Number(counts.rescanExpectedBytes || 0),
    rescanActualRemainingBytes: Number(counts.rescanActualRemainingBytes || 0)
  };
  if (!completion) return proofCounts;

  const requiredCountKeys = [
    "reclaimedBytes",
    "selectedRouteProofPacketReclaimedBytes",
    "ledgerReclaimedBytes",
    "rescanExpectedBytes",
    "rescanActualRemainingBytes"
  ];
  for (const key of requiredCountKeys) {
    if (!Object.prototype.hasOwnProperty.call(counts, key)) {
      add(`${idPrefix}-completion-parity`, `${label} completion parity count missing`, `${label} completion must include counts.${key}.`);
    }
  }

  if (proofCounts.reclaimedBytes <= 0) return proofCounts;
  const comparableFields = [
    ["selectedRouteProofPacketReclaimedBytes", proofCounts.selectedRouteProofPacketReclaimedBytes],
    ["ledgerReclaimedBytes", proofCounts.ledgerReclaimedBytes],
    ["rescanExpectedBytes", proofCounts.rescanExpectedBytes]
  ];
  for (const [key, value] of comparableFields) {
    if (value !== proofCounts.reclaimedBytes) {
      add(
        `${idPrefix}-completion-parity`,
        `${label} completion byte parity mismatch`,
        `${label} completion counts.${key} must equal reclaimedBytes.`
      );
    }
  }
  if (proofCounts.rescanActualRemainingBytes < 0) {
    add(`${idPrefix}-completion-parity`, `${label} completion rescan remaining bytes invalid`, `${label} completion counts.rescanActualRemainingBytes must be non-negative.`);
  }
  return proofCounts;
}

function validateCompletionSummaryCounts(summary, proofCounts, idPrefix, label, add) {
  if (!summary || typeof summary !== "object") return;
  const fields = [
    "reclaimedBytes",
    "ledgerReclaimedBytes",
    "rescanExpectedBytes",
    "rescanActualRemainingBytes"
  ];
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(summary, field)) {
      add(`${idPrefix}-completion-summary`, `${label} completion summary missing proof count`, `Private V1 summary must include ${field} for ${label.toLowerCase()} completion.`);
      continue;
    }
    if (Number(summary[field] || 0) !== Number(proofCounts[field] || 0)) {
      add(`${idPrefix}-completion-summary`, `${label} completion summary mismatch`, `Private V1 summary ${field} must match ${label.toLowerCase()} completion.`);
    }
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
