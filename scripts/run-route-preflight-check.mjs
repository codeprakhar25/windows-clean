#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { routeSpecs } from "./run-setup-route.mjs";

const SCRIPT_ID = "spaceguard-selected-route-preflight-check";
const PREFLIGHT_SCHEMA = "spaceguard-selected-route-windows-operator/v1";
const CHECK_SCHEMA = "spaceguard-selected-route-preflight-check/v1";
const FIRST_ROUTE_COMPLETION_SCHEMA = "spaceguard-first-route-completion-check/v1";
const APP_CLOSE_CONTRACT_SCHEMA = "spaceguard-selected-route-app-close-contract/v1";
const WORKFLOW_PROOF_SCHEMA = "spaceguard-real-workflow-proof/v1";
const FIRST_ROUTE = "known-temp-delete";
const REQUIRED_COMMANDS = [
  "resolve-selected-route",
  "setup-doctor",
  "openai-fixture-smoke",
  "setup-route",
  "validate-route"
];
const REQUIRED_APP_CLOSE_REQUIREMENTS = [
  "native-volume-proof-captured",
  "post-run-rescan-matched",
  "selected-route-proof-packet-exported",
  "selected-route-proof-import-complete",
  "spaceguard-real-workflow-proof-exported"
];
const REQUIRED_OPERATOR_APP_HANDOFF_MARKERS = [
  "SpaceGuard Selected-Route App Handoff",
  "spaceguard-selected-route-proof-packet.md",
  "Selected route proof import",
  "spaceguard-real-workflow-proof.md",
  "proof:route:windows:finalize"
];
const scriptPath = fileURLToPath(import.meta.url);

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

export function buildSelectedRoutePreflightCheck({
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
      error instanceof Error ? error.message : "Selected-route preflight file could not be read.",
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

  const routeSpec = resolveRouteSpec(preflight);

  if (preflight?.schemaVersion !== PREFLIGHT_SCHEMA) {
    add("schema", "Schema mismatch", `Expected ${PREFLIGHT_SCHEMA}, received ${preflight?.schemaVersion || "missing"}.`);
  }
  if (!routeSpec) {
    add("route", "Unsupported selected route", "Selected-route preflight must use a known non-temp route from setup:route.");
  } else if (routeSpec.route === FIRST_ROUTE) {
    add("route", "Temp route is not a selected-route proof", "Use proof:first-route:windows for known-temp-delete.");
  }
  if (preflight?.destructiveCommands !== false || preflight?.directCleanupCommands !== false) {
    add("direct-cleanup", "Direct cleanup authority present", "Preflight may not contain direct cleanup or destructive command authority.");
  }

  const firstRouteCompletion = validateFirstRouteCompletion(preflight?.firstRouteCompletionCheck, baseDir, add);
  validateScopedExecutor(preflight?.scopedExecutor, routeSpec, add);
  const commandRecords = readCommandRecords(artifactPaths.commandLog, add);
  const commandSummary = validateCommandRecords(commandRecords, preflight?.openAi, add);
  const selectedRouteSetup = readOptionalJsonArtifact("selected-route-setup", artifactPaths.selectedRouteSetup, add);
  const setupDoctor = readOptionalJsonArtifact("setup-doctor", artifactPaths.setupDoctor, add);
  const setupRoute = readOptionalJsonArtifact("setup-route", artifactPaths.setupRoute, add);
  const validateRoute = readOptionalJsonArtifact("validate-route", artifactPaths.validateRoute, add);
  const openAiFixtureSmoke = readOptionalTextArtifact("openai-fixture-smoke", artifactPaths.openAiFixtureSmoke, add);
  const operatorAppHandoff = readOptionalTextArtifact("operator-app-handoff", artifactPaths.operatorAppHandoff, add);
  const appCloseContract = validateAppCloseContract(preflight?.appCloseContract, baseDir, add);

  validateSelectedRouteSetup(selectedRouteSetup, routeSpec, preflight, add);
  validateSetupDoctor(setupDoctor, routeSpec, add);
  validateSetupRoute(setupRoute, routeSpec, add);
  validateRoutePacket(validateRoute, routeSpec, add);
  validateOpenAiFixtureSmoke(openAiFixtureSmoke, routeSpec, add);
  validateOperatorAppHandoff(operatorAppHandoff, routeSpec, add);

  const requiredArtifactCount = [
    "commandLog",
    "selectedRouteSetup",
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
    firstRouteCompletion,
    appCloseContract,
    blockers,
    counts: {
      blockers: blockers.length,
      requiredCommands: REQUIRED_COMMANDS.length,
      requiredCommandsPassed: commandSummary.requiredPassed,
      commandRecords: commandRecords.length,
      requiredArtifactsPresent: requiredArtifactCount,
      appCloseRequirements: appCloseContract.requiredBeforeClosingApp.length
    },
    primary: canLaunchApp
      ? "Selected-route preflight is accepted for the user-gated desktop app launch."
      : `Selected-route preflight is blocked by ${blockers.length} issue(s).`
  };
}

function resolveRouteSpec(preflight = {}) {
  const candidates = [
    preflight?.route,
    preflight?.routeInput,
    preflight?.routeAlias
  ].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);
  return routeSpecs.find((spec) =>
    spec.route !== FIRST_ROUTE &&
    candidates.some((candidate) =>
      spec.route.toLowerCase() === candidate ||
      spec.aliases.some((alias) => alias.toLowerCase() === candidate)
    )
  ) || null;
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

function normalizeArtifactPath(value = "", baseDir = process.cwd()) {
  const clean = String(value || "");
  if (!clean) return "";
  return path.isAbsolute(clean) ? clean : path.resolve(baseDir, clean);
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

function validateCommandRecords(records = [], openAi = {}, add) {
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
  const liveSmokeConfigured = openAi?.liveSmokeConfigured === true;
  const liveSmokeSkipped = openAi?.liveSmokeSkipped === true || liveSmoke?.skipped === true;
  if (liveSmokeConfigured) {
    if (!liveSmoke) {
      add("command-openai-live-smoke", "Live OpenAI smoke missing", "Preflight recorded OPENAI_API_KEY as configured, so the live OpenAI smoke command record is required.");
    } else if (liveSmokeSkipped) {
      add("command-openai-live-smoke", "Live OpenAI smoke skipped", "Preflight recorded OPENAI_API_KEY as configured, so live OpenAI smoke must run before app launch.");
    } else if (!isExitCodeZero(liveSmoke.exitCode)) {
      add("command-openai-live-smoke", "Live OpenAI smoke failed", `Live OpenAI smoke exited with ${liveSmoke.exitCode ?? "missing"}.`);
    }
  } else if (liveSmoke && !isExitCodeZero(liveSmoke.exitCode) && liveSmoke.skipped !== true) {
    add("command-openai-live-smoke", "Live OpenAI smoke failed", "Live OpenAI smoke must pass or be explicitly skipped.");
  }

  return { requiredPassed };
}

function isExitCodeZero(value) {
  return value === 0 || value === "0";
}

function validateFirstRouteCompletion(proofPathValue, baseDir, add) {
  const proofPath = normalizeArtifactPath(proofPathValue || "", baseDir);
  const empty = {
    path: proofPath,
    status: "missing",
    accepted: false,
    route: "",
    reclaimedBytes: 0
  };
  if (!proofPath) {
    add("first-route-completion", "First-route proof missing", "Selected-route preflight must point to the accepted first-route completion check.");
    return empty;
  }
  if (!fs.existsSync(proofPath)) {
    add("first-route-completion", "First-route proof missing", `First-route completion check does not exist: ${proofPath}`);
    return empty;
  }
  let proof = null;
  try {
    proof = readJsonObject(proofPath);
  } catch (error) {
    add("first-route-completion", "First-route proof parse failed", error instanceof Error ? error.message : "First-route completion check could not be parsed.");
    return empty;
  }
  const reclaimedBytes = Number(proof?.counts?.reclaimedBytes || 0);
  const accepted = proof?.schemaVersion === FIRST_ROUTE_COMPLETION_SCHEMA &&
    proof?.status === "accepted" &&
    proof?.canStartNextRoute === true &&
    proof?.route === FIRST_ROUTE &&
    reclaimedBytes > 0;
  if (!accepted) {
    add("first-route-completion", "First-route proof not accepted", "Selected-route preflight requires accepted known-temp-delete completion proof with positive reclaimed bytes.");
  }
  return {
    path: proofPath,
    status: String(proof?.status || "missing"),
    accepted,
    route: String(proof?.route || ""),
    reclaimedBytes
  };
}

function validateScopedExecutor(scoped = {}, routeSpec, add) {
  if (!routeSpec) return;
  if (!scoped || typeof scoped !== "object" || Array.isArray(scoped)) {
    add("scoped-flag", "Scoped executor missing", "Preflight must identify the selected route executor flag.");
    return;
  }
  if (scoped.enabledFlag !== routeSpec.envVar || String(scoped.enabledValue || "") !== "1") {
    add("scoped-flag", "Selected route flag missing", `Preflight must enable only ${routeSpec.envVar}=1.`);
  }
  if (String(scoped.dotenvExecutorFlagsIgnored || "") !== "1" || scoped.siblingFlagsForcedOff !== true) {
    add("sibling-flags", "Sibling flags not locked", "Preflight must ignore dotenv executor flags and force sibling executor flags off.");
  }
}

function validateSelectedRouteSetup(packet, routeSpec, preflight, add) {
  if (!packet || !routeSpec) return;
  if (packet.schemaVersion !== "spaceguard-route-setup-packet/v1") {
    add("selected-route-setup", "Selected-route setup schema mismatch", "Selected-route setup output must use spaceguard-route-setup-packet/v1.");
  }
  if (packet.status === "unknown-route" || packet.status === "route-required" || !packet.selected) {
    add("selected-route-setup", "Selected-route setup unresolved", "Selected-route setup must resolve the operator route before any executor flags are enabled.");
  }
  if (packet.route === FIRST_ROUTE) {
    add("selected-route-setup", "Selected-route setup is bootstrap route", "Selected-route setup must resolve a real-data route, not known-temp-delete.");
  }
  if (packet.route !== routeSpec.route || packet.selected?.envVar !== routeSpec.envVar) {
    add("selected-route-setup", "Selected-route setup mismatch", `Selected-route setup must resolve ${routeSpec.route} with ${routeSpec.envVar}.`);
  }
  if (packet.selected?.requestMode !== routeSpec.requestMode || packet.selected?.panelId !== routeSpec.panelId) {
    add("selected-route-setup", "Selected-route setup boundary mismatch", "Selected-route setup request mode and panel id must match the selected native route boundary.");
  }
  if (preflight?.routeInput && packet.routeInput && preflight.routeInput !== packet.routeInput) {
    add("selected-route-setup", "Selected-route setup input mismatch", "Preflight routeInput must match selected-route setup routeInput.");
  }
}

function validateSetupDoctor(report, routeSpec, add) {
  if (!report || !routeSpec) return;
  if (report.schemaVersion !== "spaceguard-setup-doctor/v1") add("setup-doctor", "Setup doctor schema mismatch", "Setup doctor output must use spaceguard-setup-doctor/v1.");
  const scoped = report.scopedExecutors || {};
  if (report.status !== "one-route-ready" || scoped.safeToLaunchWriteMode !== true || scoped.enabledCount !== 1 || scoped.selectedFlag !== routeSpec.envVar) {
    add("setup-doctor", "Setup doctor not one-route ready", `Setup doctor must report one-route-ready for ${routeSpec.envVar} only.`);
  }
  if (scoped.firstRouteProof?.accepted !== true || scoped.firstRouteProof?.status !== "accepted") {
    add("setup-doctor", "Setup doctor first proof blocked", "Setup doctor must expose accepted first-route proof before selected-route launch.");
  }
}

function validateSetupRoute(packet, routeSpec, add) {
  if (!packet || !routeSpec) return;
  if (packet.schemaVersion !== "spaceguard-route-setup-packet/v1") add("setup-route", "Route setup schema mismatch", "Route setup output must use spaceguard-route-setup-packet/v1.");
  if (packet.status !== "ready" || packet.route !== routeSpec.route || packet.selected?.enabled !== true || packet.selected?.envVar !== routeSpec.envVar) {
    add("setup-route", "Route setup not ready", `Route setup must be ready for ${routeSpec.route} with ${routeSpec.envVar} enabled.`);
  }
  if (packet.firstRouteProof?.accepted !== true || packet.firstRouteProof?.status !== "accepted") {
    add("setup-route", "Route setup first proof blocked", "Route setup must include accepted first-route proof.");
  }
}

function validateRoutePacket(packet, routeSpec, add) {
  if (!packet || !routeSpec) return;
  if (packet.schemaVersion !== "spaceguard-windows-validation-packet/v1") add("validate-route", "Validation packet schema mismatch", "Route validation output must use spaceguard-windows-validation-packet/v1.");
  const enabledFlags = Array.isArray(packet.enabledFlags) ? packet.enabledFlags : [];
  if (packet.status !== "ready" || packet.route !== routeSpec.route || enabledFlags.length !== 1 || enabledFlags[0] !== routeSpec.envVar) {
    add("validate-route", "Route validation not ready", `Route validation must be ready with exactly ${routeSpec.envVar}.`);
  }
  if (packet.firstRouteProof?.accepted !== true || packet.firstRouteProof?.status !== "accepted") {
    add("validate-route", "Route validation first proof blocked", "Route validation must include accepted first-route proof.");
  }
  const runtime = packet.liveValidationManifest?.runtime || {};
  if (runtime.routeFlagReady !== true || runtime.canAttemptWindowsValidation !== true || runtime.canExecuteWithoutAppEvidence !== false) {
    add("validate-route", "Live validation runtime blocked", "Live route validation must be ready while still requiring app evidence.");
  }
}

function validateOpenAiFixtureSmoke(text, routeSpec, add) {
  if (!routeSpec) return;
  const clean = String(text || "");
  if (!clean.includes("validation=broker-ready") || !clean.includes(`route=${routeSpec.route}`)) {
    add("openai-fixture-smoke", "OpenAI fixture smoke not broker-ready", `Fixture smoke must report validation=broker-ready for ${routeSpec.route}.`);
  }
}

function validateOperatorAppHandoff(text, routeSpec, add) {
  const clean = String(text || "");
  if (!clean) {
    add("operator-app-handoff", "Operator app handoff missing", "operator-app-handoff.md must be written before app launch.");
    return;
  }
  const requiredMarkers = routeSpec
    ? [...REQUIRED_OPERATOR_APP_HANDOFF_MARKERS, routeSpec.envVar]
    : REQUIRED_OPERATOR_APP_HANDOFF_MARKERS;
  const missing = requiredMarkers.filter((marker) => !clean.includes(marker));
  if (missing.length) {
    add("operator-app-handoff", "Operator app handoff incomplete", `Handoff is missing required marker(s): ${missing.join(", ")}.`);
  }
}

function validateAppCloseContract(contract, baseDir, add) {
  const empty = {
    schemaVersion: "",
    workflowProofPath: "",
    selectedRouteProofPacketPath: "",
    expectedWorkflowProofSchema: "",
    minimumReclaimedBytes: 0,
    nextRouteBlockedUntil: "",
    requiredBeforeClosingApp: []
  };
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
    add("app-close-contract", "App-close contract missing", "Preflight must publish the selected-route app-close proof export contract.");
    return empty;
  }
  const requirements = Array.isArray(contract.requiredBeforeClosingApp)
    ? contract.requiredBeforeClosingApp.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const normalized = {
    schemaVersion: String(contract.schemaVersion || ""),
    workflowProofPath: normalizeArtifactPath(contract.workflowProofPath || "", baseDir),
    selectedRouteProofPacketPath: normalizeArtifactPath(contract.selectedRouteProofPacketPath || "", baseDir),
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
  if (!normalized.selectedRouteProofPacketPath || path.basename(normalized.selectedRouteProofPacketPath) !== "spaceguard-selected-route-proof-packet.md") {
    add("app-close-contract", "Selected-route proof export path missing", "App-close contract must point to spaceguard-selected-route-proof-packet.md.");
  }
  if (normalized.expectedWorkflowProofSchema !== WORKFLOW_PROOF_SCHEMA) {
    add("app-close-contract", "Workflow proof schema missing", `App-close contract must require ${WORKFLOW_PROOF_SCHEMA}.`);
  }
  if (!Number.isFinite(normalized.minimumReclaimedBytes) || normalized.minimumReclaimedBytes < 1) {
    add("app-close-contract", "Positive recovered bytes not required", "App-close contract must require at least one reclaimed byte.");
  }
  if (normalized.nextRouteBlockedUntil !== "validate:workflow-proof accepted") {
    add("app-close-contract", "Next-route unblock condition missing", "App-close contract must block next-route work until validate:workflow-proof is accepted.");
  }
  const missing = REQUIRED_APP_CLOSE_REQUIREMENTS.filter((item) => !requirements.includes(item));
  if (missing.length) {
    add("app-close-contract", "App-close requirements incomplete", `Missing app-close requirement(s): ${missing.join(", ")}.`);
  }
  return normalized;
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
      requiredArtifactsPresent: 0
    },
    primary: detail
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const args = parseArgs(process.argv.slice(2));
  const result = buildSelectedRoutePreflightCheck({ preflightPath: args.file });
  console.log(JSON.stringify(result, null, 2));
  if (!result.canLaunchApp && !args.allowIncomplete) process.exitCode = 1;
}
