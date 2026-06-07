#!/usr/bin/env node
import process from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { routeSpecs } from "./run-setup-route.mjs";
import { buildWindowsValidationPacket } from "./run-windows-validation-packet.mjs";
import { buildRouteContractAuditReport } from "./run-route-contract-audit.mjs";

const SCRIPT_ID = "spaceguard-first-route-proof-run";
const scriptPath = fileURLToPath(import.meta.url);
const DEFAULT_ROUTE_INPUT = "temp-fixture";
const FIRST_FIXTURE_ROUTE = "known-temp-delete";

function parseArgs(argv = []) {
  const args = { route: DEFAULT_ROUTE_INPUT };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--route") args.route = argv[index + 1] || "";
    if (value.startsWith("--route=")) args.route = value.slice("--route=".length);
  }
  return args;
}

function resolveSpec(routeInput = DEFAULT_ROUTE_INPUT) {
  const clean = String(routeInput || DEFAULT_ROUTE_INPUT).trim().toLowerCase();
  return routeSpecs.find((spec) =>
    spec.route.toLowerCase() === clean ||
    spec.aliases.some((alias) => alias.toLowerCase() === clean)
  ) || null;
}

function scopedRouteEnv(spec, env = {}) {
  const clean = { ...env, SPACEGUARD_ROUTE_SETUP_IGNORE_DOTENV: "1" };
  for (const routeSpec of routeSpecs) {
    clean[routeSpec.envVar] = "0";
  }
  if (spec?.envVar) clean[spec.envVar] = "1";
  return clean;
}

function buildCommands(spec, routeInput, fixtureRoute = false) {
  return {
    seedFixtures: fixtureRoute ? "powershell -ExecutionPolicy Bypass -File .\\scripts\\seed-spaceguard-fixtures.ps1" : "",
    inspectFixtures: fixtureRoute ? "powershell -ExecutionPolicy Bypass -File .\\scripts\\inspect-spaceguard-fixtures.ps1 -EvidencePath .\\evidence\\fixture-before-cleanup.json" : "",
    inspectAfterCleanup: fixtureRoute ? "powershell -ExecutionPolicy Bypass -File .\\scripts\\inspect-spaceguard-fixtures.ps1 -AfterCleanupRoute known-temp-delete -EvidencePath .\\evidence\\fixture-after-cleanup.json" : "",
    enablePowerShell: `$env:${spec.envVar}="1"`,
    disablePowerShell: `$env:${spec.envVar}="0"`,
    setupDoctor: "npm run setup:doctor",
    openAiFixtureSmoke: `npm run openai:smoke:fixture -- --route ${routeInput}`,
    openAiSmoke: `npm run openai:smoke -- --route ${routeInput}`,
    setupRoute: `npm run setup:route -- --route ${routeInput}`,
    validateRoute: `npm run validate:route -- --route ${routeInput}`,
    nativeDev: "npm run native:dev",
    validateWorkflowProof: "npm run validate:workflow-proof -- --file .\\spaceguard-real-workflow-proof.md"
  };
}

function buildAppSteps(spec, routeInput, fixtureRoute) {
  if (!fixtureRoute) {
    return [
      `Run a current native scan for route ${spec.route}.`,
      `Use the app's ${spec.panelId} panel only after current scan, consent, and target evidence are ready.`,
      "Execute exactly one selected route, then run post-run rescan.",
      "Export Selected route proof packet, complete Selected route proof import, export real workflow proof, and run the workflow verifier."
    ];
  }
  return [
    "Run real scan in the Tauri desktop app after seeding fixtures.",
    "Select only Seeded temp fixture; do not select broad Windows temporary files for this proof.",
    "Arm consent for the current plan and scan fingerprint.",
    "Run Real temp cleanup from the first-safe temp executor panel.",
    "Run post-run rescan before claiming recovered space.",
    "Export Selected route proof packet after matched post-run rescan.",
    "Paste the proof into Selected route proof import with reviewer and artifact path.",
    "Export spaceguard-real-workflow-proof.md and run the workflow proof verifier."
  ];
}

function buildForbiddenActions(fixtureRoute) {
  const rows = [
    "enable-second-executor-flag",
    "run-direct-delete-command",
    "skip-post-run-rescan",
    "accept-zero-byte-proof",
    "validate-another-route-before-proof",
    "edit-registry",
    "change-partitions"
  ];
  if (fixtureRoute) rows.unshift("select-broad-temp-cleanup-for-fixture-proof");
  return rows;
}

function buildAcceptanceCriteria(fixtureRoute) {
  const rows = [
    "Execution ledger contains one selected-route native executor entry.",
    "Native write volume proof records before/after drive free bytes.",
    "The selected route proof packet records positive recovered bytes.",
    "Post-run native rescan comparison is matched for the selected route.",
    "Selected route proof import maps only to ledger-rescan-parity with reviewer and artifact path.",
    "npm run validate:workflow-proof accepts spaceguard-real-workflow-proof.md before another route is considered."
  ];
  if (fixtureRoute) {
    rows.unshift("Seeded temp fixture is present before scan and only %TEMP%\\spaceguard-fixture is selected for the first proof.");
  }
  return rows;
}

export function buildFirstRouteProofRunPacket({
  routeInput = DEFAULT_ROUTE_INPUT,
  env = process.env,
  generatedAt = new Date().toISOString()
} = {}) {
  const selected = resolveSpec(routeInput);
  const audit = buildRouteContractAuditReport({ env, generatedAt });
  const base = {
    schemaVersion: "spaceguard-first-route-proof-run/v1",
    tool: SCRIPT_ID,
    generatedAt,
    routeInput: String(routeInput || DEFAULT_ROUTE_INPUT),
    route: selected?.route || "",
    title: selected?.title || "Unknown route",
    status: "unknown-route",
    recommendedFirstRoute: false,
    counts: {
      routeContracts: audit.counts?.routes || 0,
      routeContractsPassed: audit.counts?.passed || 0,
      routeContractsFailed: audit.counts?.failed || 0
    },
    checks: [
      buildCheck("route-selected", "Route selected", Boolean(selected), selected?.route || "Unknown route")
    ],
    commands: {},
    appSteps: [],
    forbiddenActions: buildForbiddenActions(false),
    acceptanceCriteria: buildAcceptanceCriteria(false),
    nextSteps: ["Choose a supported route alias such as temp-fixture."]
  };

  if (!selected) return base;

  const routeEnv = scopedRouteEnv(selected, env);
  const validation = buildWindowsValidationPacket({ routeInput, env: routeEnv });
  const routeAuditRow = audit.rows.find((row) => row.route === selected.route) || null;
  const fixtureRoute = selected.route === FIRST_FIXTURE_ROUTE;
  const routeReady = validation.status === "ready" && routeAuditRow?.status === "passed";
  const status = fixtureRoute && routeReady
    ? "ready-for-windows-proof"
    : routeReady
      ? "manual-route-selected"
      : "blocked";

  return {
    ...base,
    status,
    recommendedFirstRoute: fixtureRoute,
    route: selected.route,
    routeInput: String(routeInput || selected.aliases?.[0] || selected.route),
    title: selected.title,
    panelId: selected.panelId,
    requestMode: selected.requestMode,
    envVar: selected.envVar,
    counts: {
      ...base.counts,
      validationReady: validation.status === "ready" ? 1 : 0
    },
    checks: [
      buildCheck("route-selected", "Route selected", true, selected.route),
      buildCheck("route-contract-audit", "Route contracts passed", audit.status === "passed" && routeAuditRow?.status === "passed", `${audit.counts?.passed || 0}/${audit.counts?.routes || 0} route contracts passed`),
      buildCheck("single-scoped-flag", "Single scoped flag synthesized", validation.status === "ready" && validation.enabledFlags?.length === 1, `${selected.envVar}=1; sibling flags disabled`),
      buildCheck("fixture-seed", "Disposable fixture support", fixtureRoute, fixtureRoute ? "Use seed-spaceguard-fixtures.ps1 before the desktop scan." : "This route needs real local target evidence, not the temp fixture seed."),
      buildCheck("positive-recovered-bytes-invariant", "Positive recovered bytes required", true, "Workflow proof verifier rejects zero-byte recovered-space proof.")
    ],
    commands: buildCommands(selected, routeInput || selected.aliases?.[0] || selected.route, fixtureRoute),
    appSteps: buildAppSteps(selected, routeInput, fixtureRoute),
    forbiddenActions: buildForbiddenActions(fixtureRoute),
    acceptanceCriteria: buildAcceptanceCriteria(fixtureRoute),
    routeValidation: {
      status: validation.status,
      command: validation.commands?.validateRoute || "",
      requiredAppEvidence: validation.liveValidationManifest?.requiredAppEvidence || [],
      requiredPostRunProof: validation.liveValidationManifest?.requiredPostRunProof || []
    },
    nextSteps: fixtureRoute
      ? [
          "Run the seed command on a disposable Windows VM.",
          "Enable only the temp executor flag in the same PowerShell session.",
          "Run the smoke/setup/validation commands, launch native dev, then follow appSteps exactly."
        ]
      : [
          `Enable only ${selected.envVar}=1 and collect real target evidence for ${selected.route}.`,
          "Use this packet as an operator spine, but do not treat the temp fixture as proof for this route."
        ]
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

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const packet = buildFirstRouteProofRunPacket({ routeInput: args.route || DEFAULT_ROUTE_INPUT });
  console.log(JSON.stringify(packet, null, 2));
  if (packet.status === "unknown-route" || packet.status === "blocked") process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main();
}
