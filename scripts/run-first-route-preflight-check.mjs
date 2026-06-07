#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SCRIPT_ID = "spaceguard-first-route-preflight-check";
const PREFLIGHT_SCHEMA = "spaceguard-first-route-windows-operator/v1";
const CHECK_SCHEMA = "spaceguard-first-route-preflight-check/v1";
const FIRST_ROUTE_SCHEMA = "spaceguard-first-route-proof-run/v1";
const FIXTURE_EVIDENCE_SCHEMA = "spaceguard-fixture-evidence/v1";
const APP_CLOSE_CONTRACT_SCHEMA = "spaceguard-first-route-app-close-contract/v1";
const WORKFLOW_PROOF_SCHEMA = "spaceguard-real-workflow-proof/v1";
const TEMP_ROUTE = "known-temp-delete";
const TEMP_ROUTE_INPUT = "temp-fixture";
const TEMP_EXECUTOR_FLAG = "SPACEGUARD_ENABLE_TEMP_EXECUTOR";
const REQUIRED_APP_CLOSE_REQUIREMENTS = [
  "post-run-rescan-matched",
  "selected-route-proof-packet-exported",
  "selected-route-proof-import-complete",
  "spaceguard-real-workflow-proof-exported"
];
const REQUIRED_COMMANDS = [
  "first-route-proof-packet",
  "seed-fixtures",
  "inspect-fixtures-before",
  "setup-doctor",
  "openai-fixture-smoke",
  "setup-route",
  "validate-route"
];
const REQUIRED_OPERATOR_APP_HANDOFF_MARKERS = [
  "SpaceGuard First-Route App Handoff",
  "%TEMP%\\spaceguard-fixture",
  "spaceguard-selected-route-proof-packet.md",
  "Selected route proof import",
  "spaceguard-real-workflow-proof.md",
  "proof:first-route:windows:finalize"
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

export function buildFirstRoutePreflightCheck({
  preflightPath = "",
  preflightObject = null,
  checkedAt = new Date().toISOString()
} = {}) {
  let preflight = preflightObject;
  let resolvedPreflightPath = preflightPath;

  try {
    if (!preflight) {
      if (!preflightPath) {
        return buildRejectedCheck("file-required", "Pass --file path/to/operator-preflight.json.", checkedAt);
      }
      resolvedPreflightPath = path.resolve(preflightPath);
      preflight = readJsonObject(resolvedPreflightPath);
    }
  } catch (error) {
    return buildRejectedCheck(
      "read-error",
      error instanceof Error ? error.message : "Preflight file could not be read.",
      checkedAt
    );
  }

  const baseDir = resolvedPreflightPath ? path.dirname(path.resolve(resolvedPreflightPath)) : process.cwd();
  const artifacts = preflight?.artifacts || {};
  const artifactPaths = normalizeArtifactPaths(artifacts, baseDir);
  const blockers = [];
  const add = (id, label, detail) => {
    if (!blockers.some((blocker) => blocker.id === id)) blockers.push({ id, label, detail });
  };

  if (preflight?.schemaVersion !== PREFLIGHT_SCHEMA) {
    add("schema", "Schema mismatch", `Expected ${PREFLIGHT_SCHEMA}, received ${preflight?.schemaVersion || "missing"}.`);
  }
  if (preflight?.route !== TEMP_ROUTE || preflight?.routeInput !== TEMP_ROUTE_INPUT) {
    add("route", "Wrong first route", "First-route preflight must use temp-fixture / known-temp-delete.");
  }
  if (preflight?.destructiveCommands !== false || preflight?.directCleanupCommands !== false) {
    add("direct-cleanup", "Direct cleanup authority present", "Preflight may not contain direct cleanup or destructive command authority.");
  }
  const scoped = preflight?.scopedExecutor || {};
  if (scoped.enabledFlag !== TEMP_EXECUTOR_FLAG || String(scoped.enabledValue || "") !== "1") {
    add("scoped-flag", "Temp flag missing", "Preflight must enable only SPACEGUARD_ENABLE_TEMP_EXECUTOR=1.");
  }
  if (String(scoped.dotenvExecutorFlagsIgnored || "") !== "1" || scoped.siblingFlagsForcedOff !== true) {
    add("sibling-flags", "Sibling flags not locked", "Preflight must ignore dotenv executor flags and force sibling executor flags off.");
  }
  const appCloseContract = validateAppCloseContract(preflight?.appCloseContract, baseDir, add);

  const commandRecords = readCommandRecords(artifactPaths.commandLog, add);
  const commandSummary = validateCommandRecords(commandRecords, add);
  const firstRouteProof = readOptionalJsonArtifact("first-route-proof", artifactPaths.firstRouteProofPacket, add);
  const fixtureBefore = readOptionalJsonArtifact("fixture-before-cleanup", artifactPaths.fixtureBeforeCleanup, add);
  const setupDoctor = readOptionalJsonArtifact("setup-doctor", artifactPaths.setupDoctor, add);
  const setupRoute = readOptionalJsonArtifact("setup-route", artifactPaths.setupRoute, add);
  const validateRoute = readOptionalJsonArtifact("validate-route", artifactPaths.validateRoute, add);
  const openAiFixtureSmoke = readOptionalTextArtifact("openai-fixture-smoke", artifactPaths.openAiFixtureSmoke, add);
  const operatorAppHandoff = readOptionalTextArtifact("operator-app-handoff", artifactPaths.operatorAppHandoff, add);

  validateFirstRouteProof(firstRouteProof, add);
  validateFixtureBeforeCleanup(fixtureBefore, add);
  validateSetupDoctor(setupDoctor, add);
  validateSetupRoute(setupRoute, add);
  validateRoutePacket(validateRoute, add);
  validateOpenAiFixtureSmoke(openAiFixtureSmoke, add);
  validateOperatorAppHandoff(operatorAppHandoff, add);

  const requiredArtifactCount = [
    "commandLog",
    "firstRouteProofPacket",
    "fixtureManifest",
    "fixtureBeforeCleanup",
    "setupDoctor",
    "setupRoute",
    "validateRoute",
    "openAiFixtureSmoke",
    "operatorAppHandoff"
  ].filter((key) => artifactPaths[key] && fs.existsSync(artifactPaths[key])).length;
  const canLaunchApp = blockers.length === 0;

  return {
    schemaVersion: CHECK_SCHEMA,
    tool: SCRIPT_ID,
    checkedAt,
    status: canLaunchApp ? "accepted" : "blocked",
    canLaunchApp,
    route: String(preflight?.route || ""),
    routeInput: String(preflight?.routeInput || ""),
    evidenceRoot: String(preflight?.evidenceRoot || ""),
    preflightPath: resolvedPreflightPath || "",
    appCloseContract,
    blockers,
    counts: {
      blockers: blockers.length,
      requiredCommands: REQUIRED_COMMANDS.length,
      requiredCommandsPassed: commandSummary.requiredPassed,
      commandRecords: commandRecords.length,
      requiredArtifactsPresent: requiredArtifactCount,
      fixtureRecords: Array.isArray(fixtureBefore?.records) ? fixtureBefore.records.length : 0,
      appCloseRequirements: appCloseContract.requiredBeforeClosingApp.length
    },
    primary: canLaunchApp
      ? "First-route preflight is accepted for the user-gated desktop app launch."
      : `First-route preflight is blocked by ${blockers.length} issue(s).`
  };
}

function normalizeArtifactPaths(artifacts = {}, baseDir = process.cwd()) {
  const normalized = {};
  for (const [key, value] of Object.entries(artifacts || {})) {
    const clean = String(value || "");
    normalized[key] = clean && path.isAbsolute(clean) ? clean : clean ? path.resolve(baseDir, clean) : "";
  }
  return normalized;
}

function readJsonObject(filePath) {
  return parseJsonObject(fs.readFileSync(filePath, "utf8"), filePath);
}

function readOptionalJsonArtifact(id, filePath, add) {
  if (!filePath) {
    add(`artifact-${id}`, "Artifact missing", `${id} artifact path is missing.`);
    return null;
  }
  if (!fs.existsSync(filePath)) {
    add(`artifact-${id}`, "Artifact missing", `${id} artifact does not exist: ${filePath}`);
    return null;
  }
  try {
    return parseJsonObject(fs.readFileSync(filePath, "utf8"), filePath);
  } catch (error) {
    add(`artifact-${id}`, "Artifact parse failed", error instanceof Error ? error.message : `${id} artifact could not be parsed.`);
    return null;
  }
}

function readOptionalTextArtifact(id, filePath, add) {
  if (!filePath) {
    add(`artifact-${id}`, "Artifact missing", `${id} artifact path is missing.`);
    return "";
  }
  if (!fs.existsSync(filePath)) {
    add(`artifact-${id}`, "Artifact missing", `${id} artifact does not exist: ${filePath}`);
    return "";
  }
  return fs.readFileSync(filePath, "utf8");
}

function parseJsonObject(text = "", label = "artifact") {
  const clean = String(text || "").trim();
  if (!clean) throw new Error(`${label} is empty.`);
  const candidates = [clean, ...extractJsonObjectCandidates(clean)];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      // Continue through npm wrapper/header candidates.
    }
  }
  throw new Error(`${label} could not be parsed as JSON.`);
}

function extractJsonObjectCandidates(text = "") {
  const candidates = [];
  for (let start = text.indexOf("{"); start !== -1; start = text.indexOf("{", start + 1)) {
    const candidate = balancedJsonObjectCandidate(text, start);
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

function balancedJsonObjectCandidate(text, start) {
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

function validateCommandRecords(records = [], add) {
  let requiredPassed = 0;
  for (const id of REQUIRED_COMMANDS) {
    const record = records.find((item) => item?.id === id);
    if (!record) {
      add(`command-${id}`, "Command missing", `${id} command record is missing.`);
      continue;
    }
    if (!isExitCodeZero(record.exitCode)) {
      add(`command-${id}`, "Command failed", `${id} exited with ${record.exitCode ?? "missing"}.`);
      continue;
    }
    requiredPassed += 1;
  }

  const liveSmoke = records.find((item) => item?.id === "openai-live-smoke");
  if (liveSmoke && !isExitCodeZero(liveSmoke.exitCode) && liveSmoke.skipped !== true) {
    add("command-openai-live-smoke", "Live OpenAI smoke failed", "Live OpenAI smoke must pass or be explicitly skipped.");
  }

  const nativeLaunch = records.find((item) => item?.id === "native-dev-launch");
  if (nativeLaunch && nativeLaunch.userGated !== true) {
    add("native-launch", "Native launch not user-gated", "Native dev launch record must be marked userGated=true.");
  }

  return { requiredPassed };
}

function validateAppCloseContract(contract, baseDir, add) {
  const empty = {
    schemaVersion: "",
    workflowProofPath: "",
    expectedWorkflowProofSchema: "",
    minimumReclaimedBytes: 0,
    nextRouteBlockedUntil: "",
    requiredBeforeClosingApp: []
  };

  if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
    add("app-close-contract", "App-close contract missing", "Preflight must publish the app-close proof export contract before launching the desktop app.");
    return empty;
  }

  const requirements = Array.isArray(contract.requiredBeforeClosingApp)
    ? contract.requiredBeforeClosingApp.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const normalized = {
    schemaVersion: String(contract.schemaVersion || ""),
    workflowProofPath: normalizeArtifactPath(contract.workflowProofPath || "", baseDir),
    expectedWorkflowProofSchema: String(contract.expectedWorkflowProofSchema || ""),
    minimumReclaimedBytes: Number(contract.minimumReclaimedBytes || 0),
    nextRouteBlockedUntil: String(contract.nextRouteBlockedUntil || ""),
    requiredBeforeClosingApp: requirements
  };

  if (normalized.schemaVersion !== APP_CLOSE_CONTRACT_SCHEMA) {
    add("app-close-contract", "App-close contract schema mismatch", `Expected ${APP_CLOSE_CONTRACT_SCHEMA}.`);
  }
  if (!normalized.workflowProofPath || path.basename(normalized.workflowProofPath) !== "spaceguard-real-workflow-proof.md") {
    add("app-close-contract", "Workflow proof export path missing", "App-close contract must point to spaceguard-real-workflow-proof.md.");
  }
  if (normalized.expectedWorkflowProofSchema !== WORKFLOW_PROOF_SCHEMA) {
    add("app-close-contract", "Workflow proof schema missing", `App-close contract must require ${WORKFLOW_PROOF_SCHEMA}.`);
  }
  if (!Number.isFinite(normalized.minimumReclaimedBytes) || normalized.minimumReclaimedBytes < 1) {
    add("app-close-contract", "Positive recovered bytes not required", "App-close contract must require at least one reclaimed byte.");
  }
  if (normalized.nextRouteBlockedUntil !== "validate:first-route-completion accepted") {
    add("app-close-contract", "Next-route unblock condition missing", "App-close contract must block next-route work until validate:first-route-completion is accepted.");
  }

  const missing = REQUIRED_APP_CLOSE_REQUIREMENTS.filter((item) => !requirements.includes(item));
  if (missing.length) {
    add("app-close-contract", "App-close requirements incomplete", `Missing app-close requirement(s): ${missing.join(", ")}.`);
  }

  return normalized;
}

function normalizeArtifactPath(value = "", baseDir = process.cwd()) {
  const clean = String(value || "");
  if (!clean) return "";
  return path.isAbsolute(clean) ? clean : path.resolve(baseDir, clean);
}

function isExitCodeZero(value) {
  return value === 0 || value === "0";
}

function validateFirstRouteProof(packet, add) {
  if (!packet) return;
  if (packet.schemaVersion !== FIRST_ROUTE_SCHEMA) add("first-route-proof", "First-route packet invalid", `Expected ${FIRST_ROUTE_SCHEMA}.`);
  if (packet.status !== "ready-for-windows-proof") add("first-route-proof", "First-route packet blocked", `Expected ready-for-windows-proof, received ${packet.status || "missing"}.`);
  if (packet.route !== TEMP_ROUTE || packet.routeInput !== TEMP_ROUTE_INPUT) add("first-route-proof", "First-route packet route mismatch", "First-route packet must target temp-fixture / known-temp-delete.");
  if (packet.recommendedFirstRoute !== true) add("first-route-proof", "First-route packet not recommended", "Temp fixture must remain the recommended first route.");
  if (Number(packet.counts?.routeContractsFailed || 0) !== 0 || Number(packet.counts?.routeContractsPassed || 0) < 14) {
    add("first-route-contracts", "Route contracts incomplete", "First-route packet must include full passing route-contract coverage.");
  }
  if (Number(packet.counts?.validationReady || 0) < 1) add("first-route-validation", "Route validation not ready", "First-route packet must include ready route validation.");
}

function validateFixtureBeforeCleanup(evidence, add) {
  if (!evidence) return;
  if (evidence.schemaVersion !== FIXTURE_EVIDENCE_SCHEMA) add("fixture-before-cleanup", "Fixture evidence schema mismatch", `Expected ${FIXTURE_EVIDENCE_SCHEMA}.`);
  if (evidence.passed !== true || evidence.destructiveCommands !== false || String(evidence.afterCleanupRoute || "") !== "") {
    add("fixture-before-cleanup", "Fixture evidence blocked", "Before-cleanup fixture evidence must pass with no destructive commands and no after-cleanup route.");
  }
  if (Number(evidence.counts?.missing || 0) !== 0 || Number(evidence.counts?.sizeMismatches || 0) !== 0 || Number(evidence.counts?.ageMismatches || 0) !== 0) {
    add("fixture-before-cleanup", "Fixture evidence mismatch", "Before-cleanup fixture evidence must have no missing, size, or age mismatches.");
  }
  const knownTemp = Array.isArray(evidence.records)
    ? evidence.records.find((record) => record?.purpose === "known-temp-fixture")
    : null;
  if (!knownTemp?.exists || knownTemp.presenceMatches === false || Number(knownTemp.actualBytes || 0) <= 0) {
    add("fixture-before-cleanup", "Known temp fixture missing", "Known temp fixture must exist with positive bytes before app launch.");
  }
}

function validateSetupDoctor(report, add) {
  if (!report) return;
  if (report.schemaVersion !== "spaceguard-setup-doctor/v1") add("setup-doctor", "Setup doctor schema mismatch", "Setup doctor output must use spaceguard-setup-doctor/v1.");
  const scoped = report.scopedExecutors || {};
  if (report.status !== "one-route-ready" || scoped.safeToLaunchWriteMode !== true || scoped.enabledCount !== 1 || scoped.selectedFlag !== TEMP_EXECUTOR_FLAG) {
    add("setup-doctor", "Setup doctor not one-route ready", "Setup doctor must report one-route-ready for SPACEGUARD_ENABLE_TEMP_EXECUTOR only.");
  }
}

function validateSetupRoute(packet, add) {
  if (!packet) return;
  if (packet.schemaVersion !== "spaceguard-route-setup-packet/v1") add("setup-route", "Route setup schema mismatch", "Route setup output must use spaceguard-route-setup-packet/v1.");
  if (packet.status !== "ready" || packet.route !== TEMP_ROUTE || packet.selected?.enabled !== true || packet.selected?.envVar !== TEMP_EXECUTOR_FLAG) {
    add("setup-route", "Route setup not ready", "Route setup must be ready for known-temp-delete with temp executor enabled.");
  }
}

function validateRoutePacket(packet, add) {
  if (!packet) return;
  if (packet.schemaVersion !== "spaceguard-windows-validation-packet/v1") add("validate-route", "Validation packet schema mismatch", "Route validation output must use spaceguard-windows-validation-packet/v1.");
  if (packet.status !== "ready" || packet.route !== TEMP_ROUTE || !Array.isArray(packet.enabledFlags) || packet.enabledFlags.length !== 1 || packet.enabledFlags[0] !== TEMP_EXECUTOR_FLAG) {
    add("validate-route", "Route validation not ready", "Route validation must be ready with exactly the temp executor flag enabled.");
  }
  const runtime = packet.liveValidationManifest?.runtime || {};
  if (runtime.routeFlagReady !== true || runtime.canAttemptWindowsValidation !== true || runtime.canExecuteWithoutAppEvidence !== false) {
    add("validate-route", "Live validation runtime blocked", "Live route validation must be ready while still requiring app evidence.");
  }
}

function validateOpenAiFixtureSmoke(text, add) {
  if (!String(text || "").includes("validation=broker-ready") || !String(text || "").includes(`route=${TEMP_ROUTE}`)) {
    add("openai-fixture-smoke", "OpenAI fixture smoke not broker-ready", "Fixture smoke must report validation=broker-ready for known-temp-delete.");
  }
}

function validateOperatorAppHandoff(text, add) {
  const clean = String(text || "");
  if (!clean) {
    add("operator-app-handoff", "Operator app handoff missing", "operator-app-handoff.md must be written before app launch.");
    return;
  }
  const missing = REQUIRED_OPERATOR_APP_HANDOFF_MARKERS.filter((marker) => !clean.includes(marker));
  if (missing.length) {
    add(
      "operator-app-handoff",
      "Operator app handoff incomplete",
      `Handoff is missing required marker(s): ${missing.join(", ")}.`
    );
  }
}

function buildRejectedCheck(status, detail, checkedAt) {
  return {
    schemaVersion: CHECK_SCHEMA,
    tool: SCRIPT_ID,
    checkedAt,
    status,
    canLaunchApp: false,
    route: "",
    routeInput: "",
    evidenceRoot: "",
    preflightPath: "",
    blockers: [{ id: status, label: "Preflight rejected", detail }],
    counts: {
      blockers: 1,
      requiredCommands: REQUIRED_COMMANDS.length,
      requiredCommandsPassed: 0,
      commandRecords: 0,
      requiredArtifactsPresent: 0,
      fixtureRecords: 0
    },
    primary: detail
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  const args = parseArgs(process.argv.slice(2));
  const result = buildFirstRoutePreflightCheck({ preflightPath: args.file });
  console.log(JSON.stringify(result, null, 2));
  if (!result.canLaunchApp && !args.allowIncomplete) process.exitCode = 1;
}
