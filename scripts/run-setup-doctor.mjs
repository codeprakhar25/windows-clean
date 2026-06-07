import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { routeSpecs } from "./run-setup-route.mjs";

const SCRIPT_ID = "spaceguard-setup-doctor";
export const EXECUTOR_FLAGS = [
  "SPACEGUARD_ENABLE_TEMP_EXECUTOR",
  "SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR",
  "SPACEGUARD_ENABLE_DOWNLOADS_EXECUTOR",
  "SPACEGUARD_ENABLE_LARGE_FILE_ARCHIVE_EXECUTOR",
  "SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR",
  "SPACEGUARD_ENABLE_USER_CACHE_EXECUTOR",
  "SPACEGUARD_ENABLE_ANDROID_CACHE_EXECUTOR",
  "SPACEGUARD_ENABLE_SHADER_CACHE_EXECUTOR",
  "SPACEGUARD_ENABLE_PIP_CACHE_EXECUTOR",
  "SPACEGUARD_ENABLE_TOOL_NATIVE_PRUNE_EXECUTORS",
  "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR",
  "SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR",
  "SPACEGUARD_ENABLE_RECYCLE_BIN_EXECUTOR",
  "SPACEGUARD_ENABLE_BROWSER_CACHE_EXECUTOR"
];

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), "..");
const dotenvPath = path.join(root, ".env");

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
    const value = unquoteEnvValue(withoutExport.slice(index + 1).trim());
    if (key) rows[key] = value;
  }
  return rows;
}

function unquoteEnvValue(value) {
  if (
    value.length >= 2 &&
    ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function configValue(names, fallback = "", { env = process.env, dotenv = {} } = {}) {
  for (const name of names) {
    const processValue = String(env[name] || "").trim();
    if (processValue) return { value: processValue, source: `process:${name}` };
    const dotenvValue = String(dotenv[name] || "").trim();
    if (dotenvValue) return { value: dotenvValue, source: `.env:${name}` };
  }
  return { value: fallback, source: fallback ? "default" : "missing" };
}

function flagEnabled(name, options = {}) {
  const { value } = configValue([name], "", options);
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

export function buildSetupDoctorReport({
  env = process.env,
  dotenv = readDotEnv(dotenvPath),
  envFilePresent = fs.existsSync(dotenvPath),
  generatedAt = new Date().toISOString()
} = {}) {
  const valueOptions = { env, dotenv };
  const openAiKey = configValue(["OPENAI_API_KEY", "VITE_OPENAI_API_KEY"], "", valueOptions);
  const model = configValue(["OPENAI_MODEL", "VITE_OPENAI_MODEL"], "gpt-5.2", valueOptions);
  const reasoningEffort = configValue(["OPENAI_REASONING_EFFORT", "VITE_OPENAI_REASONING_EFFORT"], "low", valueOptions);
  const enabledFlags = EXECUTOR_FLAGS.filter((name) => flagEnabled(name, valueOptions));
  const validationStatus = getScopedExecutorValidationStatus(enabledFlags);
  const selectedRoute = enabledFlags.length === 1 ? getRouteForExecutorFlag(enabledFlags[0]) : null;
  const routeInput = selectedRoute?.routeInput || "npm-cache";
  const routeSetupCommand = `npm run setup:route -- --route ${routeInput}`;
  const routeValidationCommand = `npm run validate:route -- --route ${routeInput}`;
  const workflowProofValidationCommand = "npm run validate:workflow-proof -- --file spaceguard-real-workflow-proof.md";
  const openAiFixtureSmokeCommand = `npm run openai:smoke:fixture -- --route ${routeInput}`;
  const openAiSmokeCommand = `npm run openai:smoke -- --route ${routeInput}`;

  return {
    schemaVersion: "spaceguard-setup-doctor/v1",
    tool: SCRIPT_ID,
    generatedAt,
    status: validationStatus,
    platform: {
      os: process.platform,
      arch: process.arch,
      node: process.version
    },
    env: {
      envFilePresent,
      envFilePath: ".env"
    },
    openAi: {
      configured: openAiKey.source !== "missing",
      keySource: openAiKey.source,
      model: model.value,
      modelSource: model.source,
      reasoningEffort: reasoningEffort.value,
      reasoningEffortSource: reasoningEffort.source,
      fixtureSmokeCommand: openAiFixtureSmokeCommand,
      smokeCommand: openAiSmokeCommand
    },
    scopedExecutors: {
      enabledCount: enabledFlags.length,
      enabledFlags,
      selectedFlag: enabledFlags.length === 1 ? enabledFlags[0] : "",
      conflictingFlags: enabledFlags.length > 1 ? enabledFlags : [],
      selectedRoute,
      validationStatus,
      safeToLaunchWriteMode: enabledFlags.length === 1,
      warning: getScopedExecutorWarning(enabledFlags)
    },
    realWorkflow: buildRealWorkflow({
      routeInput,
      selectedRoute,
      enabledFlags,
      openAiConfigured: openAiKey.source !== "missing",
      workflowProofValidationCommand
    }),
    commands: {
      install: "npm install",
      test: "npm test",
      build: "npm run build",
      openAiFixtureSmoke: openAiFixtureSmokeCommand,
      openAiSmoke: openAiSmokeCommand,
      routeSetup: routeSetupCommand,
      routeValidation: routeValidationCommand,
      workflowProofValidation: workflowProofValidationCommand,
      nativeDev: "npm run native:dev"
    },
    nextSteps: buildNextSteps({ openAiConfigured: openAiKey.source !== "missing", enabledFlags, routeInput })
  };
}

function getRouteForExecutorFlag(envVar) {
  const spec = routeSpecs.find((route) => route.envVar === envVar) || null;
  if (!spec) return null;
  return {
    route: spec.route,
    routeInput: spec.aliases?.[0] || spec.route,
    title: spec.title,
    envVar: spec.envVar,
    requestMode: spec.requestMode,
    panelId: spec.panelId,
    actionLabel: spec.actionLabel
  };
}

function getScopedExecutorValidationStatus(enabledFlags) {
  if (enabledFlags.length > 1) return "multi-flag-blocked";
  if (enabledFlags.length === 1) return "one-route-ready";
  return "readonly-ready";
}

function getScopedExecutorWarning(enabledFlags) {
  if (enabledFlags.length > 1) return "Multiple scoped executor flags are enabled. Validate and run one selected route at a time.";
  if (enabledFlags.length === 1) return "One scoped executor flag is enabled.";
  return "No scoped executor flags are enabled; native mode remains read-only.";
}

function buildRealWorkflow({
  routeInput = "npm-cache",
  selectedRoute = null,
  enabledFlags = [],
  openAiConfigured = false,
  workflowProofValidationCommand = "npm run validate:workflow-proof -- --file spaceguard-real-workflow-proof.md"
} = {}) {
  const ready = Boolean(selectedRoute && enabledFlags.length === 1);
  const route = selectedRoute?.route || "";
  const title = selectedRoute?.title || "selected route";
  const envVar = selectedRoute?.envVar || "";
  const panelId = selectedRoute?.panelId || "real-cleanup-command-flow-panel";
  const actionLabel = selectedRoute?.actionLabel || "Run scoped executor";

  return {
    schemaVersion: "spaceguard-real-workflow/v1",
    ready,
    status: ready ? "one-route-ready" : enabledFlags.length > 1 ? "multi-flag-blocked" : "readonly-ready",
    route,
    routeInput,
    title,
    envVar,
    panelId,
    openAiConfigured,
    steps: [
      {
        id: "fixture-openai-smoke",
        command: `npm run openai:smoke:fixture -- --route ${routeInput}`,
        detail: "Validate the deterministic task queue and broker locally before any real disk workflow."
      },
      {
        id: "openai-smoke",
        command: `npm run openai:smoke -- --route ${routeInput}`,
        detail: openAiConfigured
          ? "Validate the .env OpenAI advisor path against fixture context."
          : "Set OPENAI_API_KEY first, then validate the OpenAI advisor path against fixture context."
      },
      {
        id: "route-setup",
        command: `npm run setup:route -- --route ${routeInput}`,
        detail: "Print the selected route flag, request mode, panel, conflicts, and next commands."
      },
      {
        id: "route-validation",
        command: `npm run validate:route -- --route ${routeInput}`,
        detail: "Print the Windows validation packet and evidence checklist for exactly one route."
      },
      {
        id: "native-scan",
        command: "npm run native:dev",
        panel: "real-data-readiness-panel",
        detail: "Launch the desktop shell, run a native read-only scan, and confirm scan fingerprint and target evidence."
      },
      {
        id: "arm-consent",
        command: "Use the app",
        panel: "execution-consent-panel",
        detail: "Arm consent for the current plan id and current native scan fingerprint."
      },
      {
        id: "execute-route",
        command: actionLabel,
        panel: panelId,
        detail: ready
          ? `Run only ${title} (${route}) with ${envVar}=1 and no other scoped executor flag enabled.`
          : "Enable exactly one scoped executor flag before any real cleanup validation."
      },
      {
        id: "post-run-rescan",
        command: "Run post-run native rescan",
        panel: "execution-proof-handoff-panel",
        detail: "Capture the execution ledger, native volume proof, and matched post-run rescan comparison."
      },
      {
        id: "proof-import",
        command: "Selected route proof import",
        panel: "validation-evidence-panel",
        detail: "Export Selected route proof packet, then paste it into Selected route proof import with reviewer and artifact path."
      },
      {
        id: "workflow-proof-check",
        command: workflowProofValidationCommand,
        panel: "real-cleanup-command-flow-panel",
        detail: "Export spaceguard-real-workflow-proof.md and accept it with the workflow proof verifier before another route is considered."
      },
      {
        id: "next-route",
        command: "Return to setup:doctor",
        detail: "Only after proof import and workflow proof verification are complete should another scoped executor flag or route be considered."
      }
    ]
  };
}

function buildNextSteps({ openAiConfigured, enabledFlags, routeInput = "npm-cache" }) {
  const steps = [];
  if (!fs.existsSync(dotenvPath)) {
    steps.push("Copy .env.example to .env before desktop setup.");
  }
  steps.push(`Run npm run openai:smoke:fixture -- --route ${routeInput} to validate the local task queue and broker without an API key.`);
  if (!openAiConfigured) {
    steps.push(`Set OPENAI_API_KEY in .env or the process environment before running npm run openai:smoke -- --route ${routeInput}.`);
  } else {
    steps.push(`Run npm run openai:smoke -- --route ${routeInput} to validate the fixture-only OpenAI advisor path.`);
  }
  steps.push(`Run npm run setup:route -- --route ${routeInput} with the route you plan to validate before enabling a scoped executor.`);
  steps.push(`Run npm run validate:route -- --route ${routeInput} to capture the one-route Windows validation packet and proof checklist.`);
  if (!enabledFlags.length) {
    steps.push("Run npm run native:dev for read-only scanning, or enable exactly one scoped executor flag for Windows fixture validation.");
  } else if (enabledFlags.length === 1) {
    steps.push(`Launch npm run native:dev with ${enabledFlags[0]} enabled, export spaceguard-real-workflow-proof.md, then run npm run validate:workflow-proof -- --file spaceguard-real-workflow-proof.md before enabling another route.`);
  } else {
    steps.push("Turn off all but one scoped executor flag before real cleanup validation.");
  }
  return steps;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  console.log(JSON.stringify(buildSetupDoctorReport(), null, 2));
}
