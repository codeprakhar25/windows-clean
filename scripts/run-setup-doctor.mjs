import fs from "node:fs";
import path from "node:path";

const SCRIPT_ID = "spaceguard-setup-doctor";
const EXECUTOR_FLAGS = [
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

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dotenvPath = path.join(root, ".env");
const dotenv = readDotEnv(dotenvPath);

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

function configValue(names, fallback = "") {
  for (const name of names) {
    const processValue = String(process.env[name] || "").trim();
    if (processValue) return { value: processValue, source: `process:${name}` };
    const dotenvValue = String(dotenv[name] || "").trim();
    if (dotenvValue) return { value: dotenvValue, source: `.env:${name}` };
  }
  return { value: fallback, source: fallback ? "default" : "missing" };
}

function flagEnabled(name) {
  const { value } = configValue([name]);
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

const openAiKey = configValue(["OPENAI_API_KEY", "VITE_OPENAI_API_KEY"]);
const model = configValue(["OPENAI_MODEL", "VITE_OPENAI_MODEL"], "gpt-5.2");
const reasoningEffort = configValue(["OPENAI_REASONING_EFFORT", "VITE_OPENAI_REASONING_EFFORT"], "low");
const enabledFlags = EXECUTOR_FLAGS.filter(flagEnabled);
const report = {
  schemaVersion: "spaceguard-setup-doctor/v1",
  tool: SCRIPT_ID,
  generatedAt: new Date().toISOString(),
  platform: {
    os: process.platform,
    arch: process.arch,
    node: process.version
  },
  env: {
    envFilePresent: fs.existsSync(dotenvPath),
    envFilePath: ".env"
  },
  openAi: {
    configured: openAiKey.source !== "missing",
    keySource: openAiKey.source,
    model: model.value,
    modelSource: model.source,
    reasoningEffort: reasoningEffort.value,
    reasoningEffortSource: reasoningEffort.source,
    fixtureSmokeCommand: "npm run openai:smoke:fixture",
    smokeCommand: "npm run openai:smoke"
  },
  scopedExecutors: {
    enabledCount: enabledFlags.length,
    enabledFlags,
    warning: enabledFlags.length > 1
      ? "Multiple scoped executor flags are enabled. Validate and run one selected route at a time."
      : enabledFlags.length === 1
        ? "One scoped executor flag is enabled."
        : "No scoped executor flags are enabled; native mode remains read-only."
  },
  commands: {
    install: "npm install",
    test: "npm test",
    build: "npm run build",
    openAiFixtureSmoke: "npm run openai:smoke:fixture",
    openAiSmoke: "npm run openai:smoke",
    nativeDev: "npm run native:dev"
  },
  nextSteps: buildNextSteps({ openAiConfigured: openAiKey.source !== "missing", enabledFlags })
};

console.log(JSON.stringify(report, null, 2));

function buildNextSteps({ openAiConfigured, enabledFlags }) {
  const steps = [];
  if (!fs.existsSync(dotenvPath)) {
    steps.push("Copy .env.example to .env before desktop setup.");
  }
  steps.push("Run npm run openai:smoke:fixture to validate the local task queue and broker without an API key.");
  if (!openAiConfigured) {
    steps.push("Set OPENAI_API_KEY in .env or the process environment before running npm run openai:smoke.");
  } else {
    steps.push("Run npm run openai:smoke to validate the fixture-only OpenAI advisor path.");
  }
  if (!enabledFlags.length) {
    steps.push("Run npm run native:dev for read-only scanning, or enable exactly one scoped executor flag for Windows fixture validation.");
  } else if (enabledFlags.length === 1) {
    steps.push(`Launch npm run native:dev with ${enabledFlags[0]} enabled, then complete post-run rescan proof before enabling another route.`);
  } else {
    steps.push("Turn off all but one scoped executor flag before real cleanup validation.");
  }
  return steps;
}
