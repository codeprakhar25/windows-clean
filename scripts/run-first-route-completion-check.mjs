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
  const preflightBaseDir = resolvedPreflightPath ? path.dirname(resolvedPreflightPath) : process.cwd();
  const preflight = buildFirstRoutePreflightCheck({ preflightPath: resolvedPreflightPath, checkedAt });
  if (!preflight.canLaunchApp) {
    add("preflight", "Preflight not accepted", preflight.primary || "First-route preflight check is not accepted.");
  }

  const preflightObject = readOptionalJsonArtifact("preflight", resolvedPreflightPath, add);
  const artifactAfterFixturePath = normalizeArtifactPath(
    afterFixturePath || preflightObject?.artifacts?.fixtureAfterCleanup || "",
    preflightBaseDir
  );
  const artifactCommandLogPath = normalizeArtifactPath(
    preflightObject?.artifacts?.commandLog || "",
    preflightBaseDir
  );
  const artifactNativeExitPath = normalizeArtifactPath(
    nativeExitPath || preflightObject?.artifacts?.nativeDevExit || "",
    preflightBaseDir
  );
  const artifactPostAppFinalizationPath = normalizeArtifactPath(
    preflightObject?.artifacts?.postAppFinalization || "",
    preflightBaseDir
  );
  const contractSelectedRouteProofPacketPath = normalizeArtifactPath(
    preflightObject?.appCloseContract?.selectedRouteProofPacketPath || "",
    preflightBaseDir
  );
  const artifactSelectedRouteProofPacketPath = normalizeArtifactPath(
    preflightObject?.artifacts?.selectedRouteProofPacket || "",
    preflightBaseDir
  );
  const resolvedSelectedRouteProofPacketPath =
    artifactSelectedRouteProofPacketPath ||
    contractSelectedRouteProofPacketPath ||
    normalizeArtifactPath(
      "spaceguard-selected-route-proof-packet.md",
      preflightBaseDir
    );
  const contractWorkflowProofPath = normalizeArtifactPath(
    preflightObject?.appCloseContract?.workflowProofPath || "",
    preflightBaseDir
  );
  const resolvedWorkflowProofPath = workflowProofPath
    ? path.resolve(workflowProofPath)
    : contractWorkflowProofPath || path.resolve(process.cwd(), "spaceguard-real-workflow-proof.md");
  validateWorkflowProofPath(resolvedWorkflowProofPath, contractWorkflowProofPath, add);

  const commandRecords = readCommandRecords(artifactCommandLogPath, add);
  const commandSummary = validatePostAppCommandRecords(commandRecords, add);
  const afterFixture = readOptionalJsonArtifact("after-fixture", artifactAfterFixturePath, add);
  const nativeExit = readOptionalJsonArtifact("native-exit", artifactNativeExitPath, add);
  const selectedRouteProofPacket = readOptionalJsonArtifact("selected-route-proof-packet", resolvedSelectedRouteProofPacketPath, add);
  const workflowProofText = readOptionalTextArtifact("workflow-proof", resolvedWorkflowProofPath, add);
  const workflowProofObject = workflowProofText ? parseWorkflowProofObject(workflowProofText, add) : null;
  const workflowProof = workflowProofText
    ? buildWorkflowProofCheck({ evidenceText: workflowProofText, checkedAt })
    : buildWorkflowProofCheck({ evidenceObject: { schemaVersion: "" }, checkedAt });

  validateAfterFixtureEvidence(afterFixture, add);
  validateNativeExitEvidence(nativeExit, {
    expectedEvidenceRoot: normalizeArtifactPath(preflightObject?.evidenceRoot || preflightBaseDir, preflightBaseDir),
    expectedPostAppFinalizationPath: artifactPostAppFinalizationPath
  }, add);
  const selectedRouteProofSummary = validateSelectedRouteProofPacket(selectedRouteProofPacket, resolvedSelectedRouteProofPacketPath, add);
  validateWorkflowProof(workflowProof, add);
  validateSelectedRouteProofParity(selectedRouteProofPacket, workflowProofObject, workflowProof, add);
  validateProofFreshness({
    afterFixture,
    selectedRouteProofPacket,
    workflowProofObject,
    nativeLaunchStartedAt: commandSummary.nativeLaunchStartedAt
  }, add);

  const reclaimedBytes = Number(workflowProof.counts?.reclaimedBytes || 0);
  const selectedRouteProofPacketReclaimedBytes = Number(selectedRouteProofPacket?.counts?.reclaimedBytes || 0);
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
    selectedRouteProofPacketPath: resolvedSelectedRouteProofPacketPath,
    workflowProofPath: resolvedWorkflowProofPath,
    blockers,
    counts: {
      blockers: blockers.length,
      reclaimedBytes,
      selectedRouteProofPacketReclaimedBytes,
      nativeExitCode,
      commandRecords: commandRecords.length,
      requiredPostAppCommands: REQUIRED_POST_APP_COMMANDS.length,
      postAppCommandsPassed: commandSummary.requiredPassed,
      rescanExpectedBytes: selectedRouteProofSummary.rescanExpectedBytes,
      rescanActualRemainingBytes: selectedRouteProofSummary.rescanActualRemainingBytes,
      ledgerReclaimedBytes: selectedRouteProofSummary.ledgerReclaimedBytes,
      nativeLaunchStartedAt: commandSummary.nativeLaunchStartedAt,
      afterFixtureGeneratedAt: String(afterFixture?.generatedAt || ""),
      selectedRouteProofPacketGeneratedAt: String(selectedRouteProofPacket?.generatedAt || ""),
      workflowProofGeneratedAt: String(workflowProofObject?.generatedAt || ""),
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

function validateWorkflowProofPath(actualPath, contractPath, add) {
  if (!contractPath) return;
  if (normalizeComparablePath(actualPath) !== normalizeComparablePath(contractPath)) {
    add(
      "workflow-proof-path",
      "Workflow proof path mismatch",
      `Workflow proof must match the app-close contract path: ${contractPath}`
    );
  }
}

function normalizeComparablePath(filePath = "") {
  const normalized = path.normalize(path.resolve(String(filePath || "")));
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
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

function parseWorkflowProofObject(text = "", add) {
  try {
    return parseJsonObject(text, "workflow-proof");
  } catch (error) {
    add("workflow-proof", "Workflow proof parse failed", error instanceof Error ? error.message : "Workflow proof could not be parsed.");
    return null;
  }
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
  let nativeLaunchStartedAt = "";
  for (const id of REQUIRED_POST_APP_COMMANDS) {
    const record = findLatestCommandRecord(records, id);
    if (!record) {
      add(`command-${id}`, "Command missing", `${id} command record is missing.`);
      continue;
    }

    if (id === "native-dev-launch") {
      if (record.userGated !== true) {
        add(`command-${id}`, "Command not user-gated", "native-dev-launch must be recorded as userGated=true.");
        continue;
      }
      nativeLaunchStartedAt = String(record.startedAt || "");
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
  return { requiredPassed, nativeLaunchStartedAt };
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

function validateNativeExitEvidence(evidence, { expectedEvidenceRoot = "", expectedPostAppFinalizationPath = "" } = {}, add) {
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
  if (!sameOptionalPath(evidence.evidenceRoot, expectedEvidenceRoot)) {
    add(
      "native-exit-root",
      "Native app exit evidence root mismatch",
      `Native app exit evidence must bind to first-route evidence root ${expectedEvidenceRoot || "missing"}.`
    );
  }
  if (!sameOptionalPath(evidence.postAppFinalizationPath, expectedPostAppFinalizationPath)) {
    add(
      "native-exit-finalization",
      "Native app exit finalization path mismatch",
      `Native app exit evidence must point at first-route post-app finalization artifact ${expectedPostAppFinalizationPath || "missing"}.`
    );
  }
}

function sameOptionalPath(left = "", right = "") {
  if (!left || !right) return false;
  return normalizeComparablePath(left) === normalizeComparablePath(right);
}

function validateSelectedRouteProofPacket(packet, expectedProofPacketPath, add) {
  const summary = {
    ledgerReclaimedBytes: 0,
    rescanExpectedBytes: 0,
    rescanActualRemainingBytes: 0,
    matchedRescanRows: 0
  };
  if (!packet) return summary;
  if (packet.schemaVersion !== "spaceguard-selected-route-proof-packet/v1") {
    add("selected-route-proof-packet", "Selected-route proof schema mismatch", "Expected spaceguard-selected-route-proof-packet/v1.");
  }
  if (packet.route !== TEMP_ROUTE) {
    add("selected-route-proof-packet", "Selected-route proof route mismatch", "Selected-route proof packet must bind to known-temp-delete.");
  }
  if (packet.status !== "proof-complete") {
    add("selected-route-proof-packet", "Selected-route proof incomplete", `Expected proof-complete, received ${packet.status || "missing"}.`);
  }
  if (packet.rescanStatus !== "matched" || packet.postRunScanEvidence !== true) {
    add("selected-route-proof-packet", "Selected-route rescan proof missing", "Selected-route proof packet must include matched post-run native rescan evidence.");
  }
  if (packet.scopedNativeExecution !== true) {
    add("selected-route-proof-packet", "Scoped native execution missing", "Selected-route proof packet must prove the scoped native executor produced the ledger row.");
  }
  if (packet.readyForNextRoute !== true || packet.validationImport?.status !== "import-complete" || packet.validationImport?.complete !== true) {
    add("selected-route-proof-packet", "Selected-route proof import incomplete", "Selected-route proof packet must be re-exported after validation import is complete.");
  }
  validateSelectedRouteProofImportPath(packet.validationImport?.evidencePath, expectedProofPacketPath, add);
  if (
    Number(packet.counts?.ledgerEntries || 0) < 1 ||
    Number(packet.counts?.matchedRows || 0) < 1 ||
    Number(packet.counts?.reclaimedBytes || 0) <= 0
  ) {
    add("selected-route-proof-packet", "Selected-route proof counts invalid", "Selected-route proof packet must include ledger, matched rescan, and positive recovered bytes.");
  }
  if (packet.volumeProof?.status !== "measured") {
    add("selected-route-proof-packet", "Selected-route volume proof missing", "Selected-route proof packet must include measured native volume proof.");
  }
  validateSelectedRouteLedgerRows(packet, summary, add);
  validateSelectedRouteRescanRows(packet, summary, add);
  return summary;
}

function validateSelectedRouteLedgerRows(packet, summary, add) {
  const rows = Array.isArray(packet?.ledgerEntries) ? packet.ledgerEntries : [];
  const declaredReclaimedBytes = Number(packet?.counts?.reclaimedBytes || 0);
  if (!rows.length) {
    add("selected-route-ledger-rows", "Selected-route ledger rows missing", "Selected-route proof packet must include the scoped native execution ledger row.");
    return;
  }

  for (const [index, row] of rows.entries()) {
    if (String(row?.route || "") !== TEMP_ROUTE) {
      add("selected-route-ledger-rows", "Selected-route ledger route mismatch", `Ledger row ${index + 1} must bind to ${TEMP_ROUTE}.`);
    }
    if (Number(row?.bytes || 0) < 0) {
      add("selected-route-ledger-rows", "Selected-route ledger bytes invalid", `Ledger row ${index + 1} reports negative bytes.`);
    }
  }

  summary.ledgerReclaimedBytes = rows.reduce((sum, row) => sum + Number(row?.bytes || 0), 0);
  if (declaredReclaimedBytes > 0 && summary.ledgerReclaimedBytes !== declaredReclaimedBytes) {
    add(
      "selected-route-ledger-bytes",
      "Selected-route ledger byte count mismatch",
      `Ledger rows sum to ${summary.ledgerReclaimedBytes} byte(s), but the proof packet claims ${declaredReclaimedBytes}.`
    );
  }
}

function validateSelectedRouteRescanRows(packet, summary, add) {
  const rows = Array.isArray(packet?.rescanRows) ? packet.rescanRows : [];
  const declaredReclaimedBytes = Number(packet?.counts?.reclaimedBytes || 0);
  const declaredMatchedRows = Number(packet?.counts?.matchedRows || 0);
  if (!rows.length) {
    add("selected-route-rescan-rows", "Selected-route rescan rows missing", "Selected-route proof packet must include selected-route post-run rescan rows.");
    return;
  }

  for (const [index, row] of rows.entries()) {
    const state = String(row?.state || "");
    if (String(row?.route || "") !== TEMP_ROUTE) {
      add("selected-route-rescan-rows", "Selected-route rescan route mismatch", `Rescan row ${index + 1} must bind to ${TEMP_ROUTE}.`);
    }
    if (state !== "matched" && state !== "skipped") {
      add("selected-route-rescan-rows", "Selected-route rescan state invalid", `Rescan row ${index + 1} is ${state || "missing"}; first-route completion accepts only matched or skipped rows.`);
    }
    if (Number(row?.expectedBytes || 0) < 0 || Number(row?.actualBytes || 0) < 0) {
      add("selected-route-rescan-rows", "Selected-route rescan bytes invalid", `Rescan row ${index + 1} reports negative bytes.`);
    }
  }

  summary.rescanExpectedBytes = rows.reduce((sum, row) => sum + Number(row?.expectedBytes || 0), 0);
  summary.rescanActualRemainingBytes = rows.reduce((sum, row) => sum + Number(row?.actualBytes || 0), 0);
  summary.matchedRescanRows = rows.filter((row) => row?.state === "matched").length;

  if (declaredMatchedRows > 0 && summary.matchedRescanRows !== declaredMatchedRows) {
    add(
      "selected-route-rescan-rows",
      "Selected-route matched row count mismatch",
      `Rescan rows include ${summary.matchedRescanRows} matched row(s), but the proof packet claims ${declaredMatchedRows}.`
    );
  }
  if (declaredReclaimedBytes > 0 && summary.rescanExpectedBytes !== declaredReclaimedBytes) {
    add(
      "selected-route-rescan-bytes",
      "Selected-route rescan byte count mismatch",
      `Rescan rows expect ${summary.rescanExpectedBytes} reclaimed byte(s), but the proof packet claims ${declaredReclaimedBytes}.`
    );
  }
}

function validateSelectedRouteProofParity(packet, workflowProofObject, workflowProofCheck, add) {
  if (!packet || !workflowProofObject) return;
  const packetBytes = Number(packet?.counts?.reclaimedBytes || 0);
  const workflowBytes = Number(workflowProofObject?.counts?.reclaimedBytes ?? workflowProofCheck?.counts?.reclaimedBytes ?? 0);
  if (packetBytes !== workflowBytes) {
    add(
      "selected-route-proof-parity",
      "Selected-route proof byte parity mismatch",
      `Selected-route proof packet claims ${packetBytes} reclaimed byte(s), but workflow proof claims ${workflowBytes}.`
    );
  }

  const packetMatchedRows = Number(packet?.counts?.matchedRows || 0);
  const workflowMatchedRows = Number(workflowProofObject?.counts?.matchedRows ?? workflowProofCheck?.counts?.matchedRows ?? 0);
  if (packetMatchedRows !== workflowMatchedRows) {
    add(
      "selected-route-proof-parity",
      "Selected-route proof matched-row parity mismatch",
      `Selected-route proof packet claims ${packetMatchedRows} matched row(s), but workflow proof claims ${workflowMatchedRows}.`
    );
  }
}

function validateSelectedRouteProofImportPath(evidencePath, expectedProofPacketPath, add) {
  const normalizedEvidencePath = normalizeProofArtifactPath(evidencePath, path.dirname(expectedProofPacketPath || process.cwd()));
  const normalizedExpectedPath = normalizeProofArtifactPath(expectedProofPacketPath);
  if (!normalizedEvidencePath || !normalizedExpectedPath) {
    add("selected-route-proof-packet", "Selected-route proof import path missing", "Selected-route proof import must reference the exported selected-route proof packet path.");
    return;
  }
  if (normalizeComparablePath(normalizedEvidencePath) !== normalizeComparablePath(normalizedExpectedPath)) {
    add(
      "selected-route-proof-packet",
      "Selected-route proof import path mismatch",
      `Selected-route proof import must reference ${expectedProofPacketPath}.`
    );
  }
}

function normalizeProofArtifactPath(value = "", baseDir = process.cwd()) {
  const clean = String(value || "").trim();
  if (!clean) return "";
  const platformPath = clean.replace(/\\/g, path.sep);
  return path.isAbsolute(platformPath) ? path.normalize(platformPath) : path.normalize(path.resolve(baseDir, platformPath));
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

function validateProofFreshness({ afterFixture = null, selectedRouteProofPacket = null, workflowProofObject = null, nativeLaunchStartedAt = "" } = {}, add) {
  const launchTime = parseTimestamp(nativeLaunchStartedAt);
  if (!launchTime) {
    add("proof-freshness", "Native launch timestamp missing", "commands.ndjson must record native-dev-launch.startedAt before first-route completion can prove fresh exports.");
    return;
  }

  const checks = [
    ["after-fixture generatedAt", afterFixture?.generatedAt],
    ["selected-route proof generatedAt", selectedRouteProofPacket?.generatedAt],
    ["selected-route proof latestExecutionAt", selectedRouteProofPacket?.latestExecutionAt],
    ["selected-route proof scanGeneratedAt", selectedRouteProofPacket?.scanGeneratedAt],
    ["workflow proof generatedAt", workflowProofObject?.generatedAt]
  ];
  for (const [label, value] of checks) {
    const timestamp = parseTimestamp(value);
    if (!timestamp) {
      add("proof-freshness", "Proof timestamp missing", `${label} must be present and parseable for the current native app run.`);
      continue;
    }
    if (timestamp < launchTime) {
      add("proof-freshness", "Stale proof export", `${label} (${value}) is older than native-dev-launch.startedAt (${nativeLaunchStartedAt}).`);
    }
  }
}

function parseTimestamp(value) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  const timestamp = Date.parse(clean);
  return Number.isFinite(timestamp) ? timestamp : null;
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
