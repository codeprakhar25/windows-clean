#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { buildPacket as buildRouteSetupPacket } from "./run-setup-route.mjs";
import { buildRouteNativeBoundary } from "../src/route-boundary-contracts.mjs";

const SCRIPT_ID = "spaceguard-windows-validation-packet";
const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), "..");

function readDotEnv(filePath) {
  if (process.env.SPACEGUARD_ROUTE_SETUP_IGNORE_DOTENV === "1") return {};
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean || clean.startsWith("#")) continue;
    const withoutExport = clean.startsWith("export ") ? clean.slice("export ".length) : clean;
    const index = withoutExport.indexOf("=");
    if (index === -1) continue;
    const key = withoutExport.slice(0, index).trim();
    const value = withoutExport.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key) env[key] = value;
  }
  return env;
}

function parseArgs(argv) {
  const args = { route: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--route") args.route = argv[index + 1] || "";
    if (value.startsWith("--route=")) args.route = value.slice("--route=".length);
  }
  return args;
}

export function buildWindowsValidationPacket({ routeInput = "", env = {} } = {}) {
  const routePacket = buildRouteSetupPacket({ routeInput, env });
  const selected = routePacket.selected;
  const basePacket = {
    schemaVersion: "spaceguard-windows-validation-packet/v1",
    tool: SCRIPT_ID,
    generatedAt: new Date().toISOString(),
    routeInput,
    route: routePacket.route || "",
    status: routePacket.status,
    selected,
    enabledFlags: routePacket.enabledFlags || [],
    conflictingFlags: routePacket.conflictingFlags || [],
    routeSetup: {
      schemaVersion: routePacket.schemaVersion,
      status: routePacket.status,
      usage: routePacket.usage || routePacket.commands?.setupRoute || "npm run setup:route -- --route npm-cache"
    }
  };

  if (!selected) {
    return {
      ...basePacket,
      commands: {
        setupRoute: "npm run setup:route -- --route npm-cache",
        validateRoute: "npm run validate:route -- --route npm-cache"
      },
      preRunChecklist: [],
      postRunProofChecklist: [],
      captureArtifacts: [],
      forbiddenActions: buildForbiddenActions(),
      operatorSteps: ["Choose one route alias, then rerun this packet."],
      nextSteps: routePacket.nextSteps || []
    };
  }

  return {
    ...basePacket,
    commands: buildCommands(selected),
    preRunChecklist: buildPreRunChecklist(routePacket),
    postRunProofChecklist: buildPostRunProofChecklist(routePacket),
    captureArtifacts: buildCaptureArtifacts(selected),
    forbiddenActions: buildForbiddenActions(),
    liveValidationManifest: buildLiveValidationManifest(selected, routePacket.status),
    operatorSteps: buildOperatorSteps(selected, routePacket.status),
    nextSteps: buildNextSteps(routePacket, selected)
  };
}

function buildCommands(selected) {
  const routeInput = selected.aliases?.[0] || selected.route;
  return {
    setupDoctor: "npm run setup:doctor",
    setupRoute: `npm run setup:route -- --route ${routeInput}`,
    validateRoute: `npm run validate:route -- --route ${routeInput}`,
    workflowProofValidation: "npm run validate:workflow-proof -- --file spaceguard-real-workflow-proof.md",
    enablePowerShell: `$env:${selected.envVar}="1"`,
    disablePowerShell: `$env:${selected.envVar}="0"`,
    openAiFixtureSmoke: `npm run openai:smoke:fixture -- --route ${routeInput}`,
    openAiSmoke: `npm run openai:smoke -- --route ${routeInput}`,
    nativeDev: "npm run native:dev"
  };
}

function buildPreRunChecklist(routePacket) {
  const ready = routePacket.status === "ready";
  const selected = routePacket.selected || {};
  return [
    {
      id: "setup-doctor",
      label: "Setup doctor",
      status: "pending",
      detail: "Run npm run setup:doctor and keep the JSON output for the validation record."
    },
    {
      id: "fixture-openai-smoke",
      label: "Fixture-only OpenAI broker smoke",
      status: "pending",
      detail: "Run npm run openai:smoke:fixture before any real disk workflow."
    },
    {
      id: "single-scoped-flag",
      label: "Exactly one scoped executor flag",
      status: ready ? "ready" : "blocked",
      detail: ready
        ? `${selected.envVar}=1 is the only enabled scoped executor flag.`
        : routePacket.status === "multiple-flags"
          ? `Turn off conflicting flag(s): ${(routePacket.conflictingFlags || []).join(", ")}.`
          : `Enable ${selected.envVar}=1 for this route only.`
    },
    {
      id: "native-readonly-scan",
      label: "Before native read-only scan",
      status: ready ? "pending" : "blocked",
      detail: "Launch npm run native:dev, run a real scan, and export the before-scan report before executing."
    },
    {
      id: "route-target-evidence",
      label: "Route target evidence",
      status: ready ? "pending" : "blocked",
      detail: `Use only route ${selected.route}, requestMode ${selected.requestMode}, and panel ${selected.panelId}.`
    },
    {
      id: "post-run-proof-slot",
      label: "Post-run proof slot",
      status: ready ? "pending" : "blocked",
      detail: "Do not start a second executor until execution ledger and post-run rescan comparison are captured."
    }
  ];
}

function buildPostRunProofChecklist(routePacket) {
  const ready = routePacket.status === "ready";
  const selected = routePacket.selected || {};
  const executedAction = actionNounPhrase(selected.actionLabel || "the scoped executor");
  return [
    {
      id: "execution-ledger-recorded",
      label: "Execution ledger recorded",
      status: ready ? "pending" : "blocked",
      detail: `After ${executedAction} runs, capture the execution ledger for route ${selected.route || "unknown"}.`
    },
    {
      id: "native-volume-proof",
      label: "Native volume proof",
      status: ready ? "pending" : "blocked",
      detail: "Accepted native writes should expose measured before/after drive free bytes; keep the volume proof with the ledger evidence."
    },
    {
      id: "selected-route-proof-packet",
      label: "Selected route proof packet",
      status: ready ? "pending" : "blocked",
      detail: "Export the selected-route proof packet after post-run rescan; it should include ledger rows, rescan parity, and volume proof delta."
    },
    {
      id: "selected-route-proof-import",
      label: "Selected route proof import",
      status: ready ? "pending" : "blocked",
      detail: "Paste the proof packet into Validation evidence > Selected route proof import with reviewer and artifact path; it must map only to ledger-rescan-parity."
    },
    {
      id: "real-workflow-proof-check",
      label: "Real workflow proof check",
      status: ready ? "pending" : "blocked",
      detail: "Export spaceguard-real-workflow-proof.md and run npm run validate:workflow-proof -- --file spaceguard-real-workflow-proof.md; acceptance requires positive recovered bytes before any next-route handoff."
    },
    {
      id: "post-run-rescan-parity",
      label: "Post-run rescan parity",
      status: ready ? "pending" : "blocked",
      detail: "Run the ledger-preserving post-run native rescan and require matched parity before validating another route."
    },
    {
      id: "flag-reset",
      label: "Route flag reset",
      status: ready ? "pending" : "blocked",
      detail: `Turn off ${selected.envVar || "the route flag"} after proof is captured, before enabling any other scoped executor.`
    }
  ];
}

function buildCaptureArtifacts(selected) {
  return [
    "setup-doctor-report",
    "route-setup-packet",
    "windows-validation-packet",
    "openai-fixture-smoke-output",
    "openai-smoke-output-if-key-configured",
    "before-native-scan-report",
    `${selected.panelId}-screenshot-or-export`,
    "consent-receipt",
    "executor-manifest",
    "execution-ledger",
    "native-write-volume-proof",
    "post-run-rescan-comparison",
    "selected-route-proof-packet",
    "selected-route-proof-import",
    "real-workflow-proof",
    "workflow-proof-check-output",
    "live-validation-manifest",
    "openai-handoff-if-used",
    "support-bundle-if-any-warning"
  ];
}

function buildLiveValidationManifest(selected, status) {
  const routeInput = selected.aliases?.[0] || selected.route;
  const routeFlagReady = status === "ready";
  return {
    schemaVersion: "spaceguard-live-route-validation/v1",
    route: selected.route,
    routeInput,
    title: selected.title,
    status,
    contract: {
      envVar: selected.envVar,
      requestMode: selected.requestMode,
      panelId: selected.panelId,
      actionLabel: selected.actionLabel,
      setupCommand: `npm run setup:route -- --route ${routeInput}`,
      validationCommand: `npm run validate:route -- --route ${routeInput}`,
      workflowProofCommand: "npm run validate:workflow-proof -- --file spaceguard-real-workflow-proof.md",
      nativeDevCommand: "npm run native:dev"
    },
    runtime: {
      routeFlagReady,
      canAttemptWindowsValidation: routeFlagReady,
      canExecuteWithoutAppEvidence: false,
      singleScopedFlagRequired: true,
      requiredEnabledFlag: selected.envVar,
      disabledReason: routeFlagReady
        ? ""
        : status === "multiple-flags"
          ? "Multiple scoped executor flags are enabled; Windows validation must narrow to one route."
          : `${selected.envVar}=1 must be enabled before Windows route validation.`
    },
    requiredAppEvidence: [
      "current-native-scan-fingerprint",
      "current-plan-consent-receipt",
      "native-scanned-target",
      "selected-action-row",
      "single-scoped-executor-flag"
    ],
    requiredPostRunProof: [
      "execution-ledger",
      "native-write-volume-proof",
      "post-run-rescan-comparison",
      "selected-route-proof-packet",
      "selected-route-proof-import",
      "real-workflow-proof",
      "workflow-proof-check-output"
    ],
    nativeBoundary: buildRouteNativeBoundary(selected)
  };
}

function buildForbiddenActions() {
  return [
    "enable-second-executor-flag",
    "run-direct-delete-command",
    "run-uninstall-string",
    "delete-program-files-folder",
    "edit-registry",
    "change-partitions",
    "clean-browser-identity-stores",
    "claim-recovered-space-before-rescan"
  ];
}

function buildOperatorSteps(selected, status) {
  const actionLabel = selected.actionLabel || "Run scoped executor";
  const steps = [
    "Run npm run setup:doctor and keep the JSON output.",
    `Run npm run setup:route -- --route ${selected.aliases?.[0] || selected.route}.`,
    `Enable only ${selected.envVar}=1 before launching the desktop shell.`,
    `Run npm run openai:smoke:fixture -- --route ${selected.aliases?.[0] || selected.route}; if OPENAI_API_KEY is configured, also run npm run openai:smoke -- --route ${selected.aliases?.[0] || selected.route}.`,
    "Launch npm run native:dev.",
    "Run real scan and export before-scan evidence.",
    `Open ${selected.panelId} and verify route ${selected.route} with requestMode ${selected.requestMode}.`,
    `${actionLabel} only if the app preflight is ready.`,
    "Capture execution ledger and native volume proof, then run post-run rescan.",
    "Export selected-route proof packet, import it into Validation evidence, export spaceguard-real-workflow-proof.md, and run npm run validate:workflow-proof -- --file spaceguard-real-workflow-proof.md before enabling another executor."
  ];
  if (status !== "ready") {
    return [`Fix validation status ${status} before Windows execution.`, ...steps.slice(0, 4)];
  }
  return steps;
}

function actionNounPhrase(actionLabel) {
  const clean = String(actionLabel || "").trim().replace(/^run\s+/i, "");
  return clean || "the scoped executor";
}

function buildNextSteps(routePacket, selected) {
  if (routePacket.status === "ready") {
    return [
      `Validate route ${selected.route} on Windows with exactly one scoped flag.`,
      "Capture before scan, consent, execution ledger, native volume proof, selected-route proof packet, selected route proof import, real workflow proof, workflow proof verifier output, and post-run rescan comparison.",
      "Run npm run validate:workflow-proof -- --file spaceguard-real-workflow-proof.md and keep the accepted output with the validation packet.",
      "Turn off the route flag before validating another executor."
    ];
  }
  return routePacket.nextSteps || [];
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const args = parseArgs(process.argv.slice(2));
  const env = {
    ...readDotEnv(path.join(root, ".env")),
    ...process.env
  };
  const packet = buildWindowsValidationPacket({ routeInput: args.route, env });
  console.log(JSON.stringify(packet, null, 2));
}
