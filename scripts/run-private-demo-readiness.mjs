#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_ID = "spaceguard-private-demo-readiness";
const SCHEMA_VERSION = "spaceguard-private-demo-readiness/v1";
const EXACT_PROOF_IMPORT_INSTRUCTION = "Import artifact path must be spaceguard-selected-route-proof-packet.md";

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(scriptPath), "..");

export function buildPrivateDemoReadinessSummary({
  rootDir = defaultRoot,
  generatedAt = new Date().toISOString(),
  hostPlatform = process.platform,
  commandAvailability = null
} = {}) {
  const root = path.resolve(rootDir);
  const packageJson = readJson(path.join(root, "package.json"));
  const tauriConfig = readJson(path.join(root, "src-tauri", "tauri.conf.json"));
  const firstRouteRunnerPath = path.join(root, "scripts", "run-first-route-proof-windows.ps1");
  const selectedRouteRunnerPath = path.join(root, "scripts", "run-route-proof-windows.ps1");
  const privateV1RunnerPath = path.join(root, "scripts", "run-private-v1-windows-proof.ps1");
  const firstRouteRunner = readText(firstRouteRunnerPath);
  const selectedRouteRunner = readText(selectedRouteRunnerPath);
  const privateV1Runner = readText(privateV1RunnerPath);
  const workflowProofCheck = readText(path.join(root, "scripts", "run-workflow-proof-check.mjs"));
  const privateV1ProofCheck = readText(path.join(root, "scripts", "run-private-v1-proof-check.mjs"));
  const firstRouteCompletionCheck = readText(path.join(root, "scripts", "run-first-route-completion-check.mjs"));
  const selectedRoutePreflightCheck = readText(path.join(root, "scripts", "run-route-preflight-check.mjs"));
  const selectedRouteCompletionCheck = readText(path.join(root, "scripts", "run-route-completion-check.mjs"));
  const openAiSmokeRunner = readText(path.join(root, "scripts", "run-openai-advisor-smoke.mjs"));
  const openAiAgent = readText(path.join(root, "src", "openai-agent.mjs"));
  const nativeOpenAiAgent = readText(path.join(root, "src-tauri", "src", "main.rs"));
  const privateWindowsPreflightRunner = readText(path.join(root, "scripts", "run-private-demo-windows-preflight.ps1"));
  const envExample = readText(path.join(root, ".env.example"));
  const readme = readText(path.join(root, "README.md"));
  const windowsSetup = readText(path.join(root, "WINDOWS_REAL_DATA_SETUP.md"));
  const agentDesign = readText(path.join(root, "AGENT_DESIGN.md"));

  const checks = [
    buildCheck({
      id: "vite-build-script",
      label: "Web build script",
      passed: scriptIncludes(packageJson, "build", "vite build"),
      detail: "package.json must expose npm run build for the Tauri beforeBuild step."
    }),
    buildCheck({
      id: "tauri-native-build-script",
      label: "Native build script",
      passed: scriptIncludes(packageJson, "native:build", "tauri build"),
      detail: "package.json must expose npm run native:build for the compiled private demo."
    }),
    buildCheck({
      id: "tauri-bundle-active",
      label: "Tauri bundle active",
      passed: tauriConfig.bundle?.active === true && String(tauriConfig.bundle?.targets || "") === "all",
      detail: "src-tauri/tauri.conf.json must keep bundling active for all targets."
    }),
    buildCheck({
      id: "tauri-before-build",
      label: "Tauri build handoff",
      passed: tauriConfig.productName === "SpaceGuard" &&
        tauriConfig.build?.beforeBuildCommand === "npm run build" &&
        tauriConfig.build?.frontendDist === "../dist",
      detail: "Tauri must build the Vite frontend and bundle ../dist as SpaceGuard."
    }),
    buildCheck({
      id: "first-route-windows-runner",
      label: "First-route Windows runner",
      passed: fileReady(firstRouteRunner) &&
        scriptIncludes(packageJson, "proof:first-route:windows", "run-first-route-proof-windows.ps1") &&
        scriptIncludes(packageJson, "proof:first-route:windows:finalize", "-FinalizeOnly") &&
        firstRouteRunner.includes("spaceguard-first-route-windows-operator/v1"),
      detail: "The seeded temp-fixture proof runner and finalize command must exist."
    }),
    buildCheck({
      id: "selected-route-windows-runner",
      label: "Selected-route Windows runner",
      passed: fileReady(selectedRouteRunner) &&
        scriptIncludes(packageJson, "proof:route:windows", "run-route-proof-windows.ps1") &&
        scriptIncludes(packageJson, "proof:route:windows:finalize", "-FinalizeOnly") &&
        selectedRouteRunner.includes("spaceguard-selected-route-windows-operator/v1") &&
        selectedRouteRunner.includes("Resolve-SelectedRouteSpecFromSetup") &&
        selectedRouteRunner.includes("selected-route-setup.json") &&
        selectedRouteRunner.includes("spaceguard-route-setup-packet/v1") &&
        selectedRouteRunner.includes("selected-route-unknown") &&
        selectedRouteRunner.includes("npm-cache"),
      detail: "The selected-route proof runner, finalize command, and setup:route-backed route resolution must exist."
    }),
    buildCheck({
      id: "exact-proof-import-artifact",
      label: "Exact proof import artifact",
      passed: firstRouteRunner.includes(EXACT_PROOF_IMPORT_INSTRUCTION) &&
        selectedRouteRunner.includes(EXACT_PROOF_IMPORT_INSTRUCTION) &&
        firstRouteCompletionCheck.includes("validateSelectedRouteProofImportPath") &&
        selectedRouteCompletionCheck.includes("validateSelectedRouteProofImportPath"),
      detail: "The operator handoff and completion verifiers must bind import evidence to spaceguard-selected-route-proof-packet.md."
    }),
    buildCheck({
      id: "openai-fixture-smoke",
      label: "OpenAI fixture smoke",
      passed: scriptIncludes(packageJson, "openai:smoke:fixture", "--fixture-only") &&
        fileExists(root, "scripts", "run-openai-advisor-smoke.mjs") &&
        openAiSmokeRunner.includes("liveRouteValidation"),
      detail: "The deterministic OpenAI broker smoke must validate the selected live route contract."
    }),
    buildCheck({
      id: "openai-live-smoke",
      label: "OpenAI live smoke",
      passed: scriptIncludes(packageJson, "openai:smoke", "run-openai-advisor-smoke.mjs") &&
        !scriptIncludes(packageJson, "openai:smoke", "--fixture-only") &&
        openAiSmokeRunner.includes("OPENAI_API_KEY is missing") &&
        openAiSmokeRunner.includes("getOpenAIAgentConfig(env)") &&
        openAiSmokeRunner.includes("requestOpenAIAgentAdvice") &&
        envExample.includes("OPENAI_API_KEY=") &&
        envExample.includes("OPENAI_MODEL=") &&
        envExample.includes("OPENAI_REASONING_EFFORT=") &&
        readme.includes("npm run openai:smoke -- --route npm-cache") &&
        windowsSetup.includes("npm run openai:smoke -- --route npm-cache") &&
        agentDesign.includes("The OpenAI integration is advisory, not an executor."),
      detail: "The live OpenAI smoke must use .env/API-key mode, keep fixture-only separate, and document advisory-only authority before the private demo."
    }),
    buildCheck({
      id: "openai-native-advisor-contract",
      label: "OpenAI native advisor contract",
      passed: openAiAgent.includes("NATIVE_OPENAI_AGENT_COMMAND") &&
        openAiAgent.includes("openai_agent_advice") &&
        openAiAgent.includes("When context.liveRouteValidation is present") &&
        nativeOpenAiAgent.includes("openai_agent_advice") &&
        nativeOpenAiAgent.includes("OPENAI_API_KEY") &&
        nativeOpenAiAgent.includes("dotenv_candidate_paths") &&
        nativeOpenAiAgent.includes("openai_response_format") &&
        nativeOpenAiAgent.includes("spaceguard_cleanup_agent_advice") &&
        nativeOpenAiAgent.includes("When context.liveRouteValidation is present") &&
        nativeOpenAiAgent.includes("OpenAI advice is advisory only"),
      detail: "The Tauri desktop advisor must read .env, use strict structured advice, preserve advisory-only authority, and honor the selected live route contract."
    }),
    buildCheck({
      id: "setup-doctor",
      label: "Setup doctor",
      passed: scriptIncludes(packageJson, "setup:doctor", "run-setup-doctor.mjs") &&
        readText(path.join(root, "scripts", "run-setup-doctor.mjs")).includes("SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK"),
      detail: "Setup doctor must expose the first-route proof gate before selected real-data routes."
    }),
    buildCheck({
      id: "route-setup-validation",
      label: "Route setup validation",
      passed: scriptIncludes(packageJson, "setup:route", "run-setup-route.mjs") &&
        scriptIncludes(packageJson, "validate:route", "run-windows-validation-packet.mjs") &&
        fileExists(root, "scripts", "run-setup-route.mjs") &&
        fileExists(root, "scripts", "run-windows-validation-packet.mjs"),
      detail: "Route setup and Windows validation packets must exist before selected-route launch."
    }),
    buildCheck({
      id: "native-executor-coverage",
      label: "Native executor coverage",
      passed: scriptIncludes(packageJson, "native:executor-coverage", "run-native-executor-coverage.mjs") &&
        fileExists(root, "scripts", "run-native-executor-coverage.mjs"),
      detail: "Private demo readiness must expose native route boundary and Rust unit-test coverage for real cleanup executors."
    }),
    buildCheck({
      id: "windows-private-preflight-runner",
      label: "Windows private preflight runner",
      passed: scriptIncludes(packageJson, "demo:private-windows-preflight", "run-private-demo-windows-preflight.ps1") &&
        fileReady(privateWindowsPreflightRunner) &&
        privateWindowsPreflightRunner.includes("Get-NativeBundleArtifacts") &&
        privateWindowsPreflightRunner.includes("Copy-NativeBundleArtifacts") &&
        privateWindowsPreflightRunner.includes("evidencePath") &&
        privateWindowsPreflightRunner.includes("sha256") &&
        privateWindowsPreflightRunner.includes("nativeBundleArtifacts"),
      detail: "Private demo readiness must provide one Windows host preflight command that captures native bundle artifacts before fixture and npm-cache proof runs."
    }),
    buildCheck({
      id: "windows-private-v1-proof-runner",
      label: "Windows private V1 proof runner",
      passed: scriptIncludes(packageJson, "demo:private-v1-windows", "run-private-v1-windows-proof.ps1") &&
        fileReady(privateV1Runner) &&
        privateV1Runner.includes("spaceguard-private-v1-windows-proof/v1") &&
        privateV1Runner.includes("SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK") &&
        privateV1Runner.includes("[System.Diagnostics.ProcessStartInfo]::new()") &&
        privateV1Runner.includes("stderrPath") &&
        privateV1Runner.includes("private-v1-openai-live-required") &&
        privateV1Runner.includes("private-v1-openai-key-required") &&
        privateV1Runner.includes("Import-SpaceGuardDotEnv") &&
        privateV1Runner.includes("Assert-KnownSelectedRoute") &&
        privateV1Runner.includes("selected-route-setup.json") &&
        privateV1Runner.includes("selected-route-unknown") &&
        privateV1Runner.includes("Assert-CompletionProofCounts") &&
        privateV1Runner.includes("Assert-ExistingPrivateWindowsPreflight") &&
        privateV1Runner.includes("private-windows-preflight-skipped-missing") &&
        privateV1Runner.includes("SkipPreflightExistingEvidence") &&
        privateV1Runner.includes("npm run proof:first-route:windows -- -Route temp-fixture") &&
        privateV1Runner.includes("npm run proof:route:windows -- -Route $SelectedRoute") &&
        privateV1Runner.includes("ledgerReclaimedBytes") &&
        privateV1Runner.includes("rescanExpectedBytes") &&
        privateV1Runner.includes("rescanActualRemainingBytes") &&
        privateV1Runner.includes("run-private-v1-proof-check.mjs --file") &&
        directDeleteFree(privateV1Runner),
      detail: "Private demo readiness must expose a single Windows V1 proof command that binds first-route completion and route/rescan parity before selected real-data cleanup."
    }),
    buildCheck({
      id: "private-v1-proof-validation",
      label: "Private V1 proof validation",
      passed: scriptIncludes(packageJson, "validate:private-v1-proof", "run-private-v1-proof-check.mjs") &&
        fileReady(privateV1ProofCheck) &&
        privateV1ProofCheck.includes("spaceguard-private-v1-proof-check/v1") &&
        privateV1ProofCheck.includes("spaceguard-private-v1-windows-proof/v1") &&
        privateV1ProofCheck.includes("selected-route-setup") &&
        privateV1ProofCheck.includes("spaceguard-route-setup-packet/v1") &&
        privateV1ProofCheck.includes("bind-first-route-completion") &&
        privateV1ProofCheck.includes("validateReusedPrivateWindowsPreflightCommand") &&
        privateV1ProofCheck.includes("SkipPreflightExistingEvidence") &&
        privateV1ProofCheck.includes("private-windows-preflight-route") &&
        privateV1ProofCheck.includes("command-stderr") &&
        privateV1ProofCheck.includes("stderrPath") &&
        privateV1ProofCheck.includes("openAiSmokeArtifacts") &&
        privateV1ProofCheck.includes("openai-fixture-smoke") &&
        privateV1ProofCheck.includes("openai-live-smoke") &&
        privateV1ProofCheck.includes("validation=broker-ready") &&
        privateV1ProofCheck.includes("validateChildCommandRecords") &&
        privateV1ProofCheck.includes("validatePrivatePreflightCommandRecords") &&
        privateV1ProofCheck.includes("REQUIRED_PRIVATE_PREFLIGHT_COMMANDS") &&
        privateV1ProofCheck.includes("rust-tests") &&
        privateV1ProofCheck.includes("native-build") &&
        privateV1ProofCheck.includes("private-preflight-command-direct-cleanup") &&
        privateV1ProofCheck.includes("command-direct-cleanup") &&
        privateV1ProofCheck.includes("completion-parity"),
      detail: "Private demo readiness must include an independent verifier for final V1 proof, child stderr artifacts, child command ledgers, OpenAI smoke evidence, and route/rescan parity counts."
    }),
    buildCheck({
      id: "workflow-proof-validation",
      label: "Workflow proof validation",
      passed: scriptIncludes(packageJson, "validate:workflow-proof", "run-workflow-proof-check.mjs") &&
        workflowProofCheck.includes("selected-route-proof-export") &&
        workflowProofCheck.includes("selected-route-proof-import"),
      detail: "Workflow proof validation must require proof import and final proof export before next-route handoff."
    }),
    buildCheck({
      id: "completion-verifiers",
      label: "Completion verifiers",
      passed: scriptIncludes(packageJson, "validate:first-route-completion", "run-first-route-completion-check.mjs") &&
        scriptIncludes(packageJson, "validate:route-preflight", "run-route-preflight-check.mjs") &&
        scriptIncludes(packageJson, "validate:route-completion", "run-route-completion-check.mjs") &&
        firstRouteCompletionCheck.includes("spaceguard-first-route-completion-check/v1") &&
        selectedRoutePreflightCheck.includes("spaceguard-selected-route-preflight-check/v1") &&
        selectedRoutePreflightCheck.includes("selected-route-setup") &&
        selectedRoutePreflightCheck.includes("resolve-selected-route") &&
        selectedRouteCompletionCheck.includes("spaceguard-selected-route-completion-check/v1"),
      detail: "First-route, selected-route preflight, and selected-route completion verifiers must be present."
    }),
    buildCheck({
      id: "runner-direct-delete-free",
      label: "Runner direct delete free",
      passed: directDeleteFree(firstRouteRunner) && directDeleteFree(selectedRouteRunner),
      detail: "PowerShell proof runners must not delete files directly; all cleanup stays inside the guarded app executor."
    }),
    buildCheck({
      id: "docs-private-runbooks",
      label: "Private demo runbooks",
      passed: fileExists(root, "WINDOWS_REAL_DATA_SETUP.md") &&
        fileExists(root, "NATIVE_BETA_DISTRIBUTION.md") &&
        fileExists(root, "AGENT_DESIGN.md"),
      detail: "Private demo setup, beta distribution, and agent authority docs must be present."
    })
  ];

  const blockers = checks
    .filter((check) => !check.passed)
    .map((check) => ({ id: check.id, label: check.label, detail: check.detail }));
  const ready = blockers.length === 0;
  const host = buildHostPrerequisiteSummary({ hostPlatform, commandAvailability });

  return {
    schemaVersion: SCHEMA_VERSION,
    tool: SCRIPT_ID,
    generatedAt,
    target: "private-windows-demo",
    status: ready ? "ready" : "blocked",
    canAttemptPrivateWindowsDemo: ready,
    build: {
      platformRequired: "windows",
      tauriProductName: String(tauriConfig.productName || ""),
      nativeBuildCommand: "npm run native:build",
      webBuildCommand: "npm run build"
    },
    host,
    routes: {
      firstRoute: "temp-fixture",
      selectedRoute: "npm-cache",
      selectedRouteRequiresFirstRouteProof: true
    },
    checks,
    blockers,
    counts: {
      requiredChecks: checks.length,
      passed: checks.filter((check) => check.passed).length,
      blockers: blockers.length
    },
    nextCommands: [
      "npm test",
      "npm run build",
      "npm run demo:private-readiness",
      "npm run demo:private-v1-windows -- -SelectedRoute npm-cache",
      "npm run validate:private-v1-proof -- --file evidence/private-v1-proof-npm-cache-YYYYMMDD-HHMMSS/private-v1-proof.json",
      "npm run openai:smoke:fixture -- --route npm-cache",
      "npm run openai:smoke -- --route npm-cache",
      "npm run demo:private-windows-preflight",
      "npm run native:build",
      "npm run proof:first-route:windows -- -Route temp-fixture",
      "npm run proof:route:windows -- -Route npm-cache"
    ],
    primary: ready
      ? "Private Windows demo readiness is proven; run the V1 Windows coordinator on a prepared Windows host for seeded first-route proof and npm-cache proof."
      : `Private Windows demo readiness is blocked by ${blockers.length} issue(s).`
  };
}

function buildCheck({ id, label, passed, detail }) {
  return {
    id,
    label,
    passed: Boolean(passed),
    detail
  };
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function fileExists(root, ...segments) {
  return fs.existsSync(path.join(root, ...segments));
}

function fileReady(text) {
  return String(text || "").trim().length > 0;
}

function scriptIncludes(packageJson, scriptName, needle) {
  return String(packageJson.scripts?.[scriptName] || "").includes(needle);
}

function directDeleteFree(text) {
  const value = String(text || "");
  return !/\bRemove-Item\b/i.test(value) &&
    !/\bClear-RecycleBin\b/i.test(value) &&
    !/\bdel\s+/i.test(value) &&
    !/\brmdir\s+/i.test(value);
}

function buildHostPrerequisiteSummary({ hostPlatform = process.platform, commandAvailability = null } = {}) {
  const currentPlatform = String(hostPlatform || process.platform);
  const warnings = [];

  if (currentPlatform === "win32") {
    return {
      currentPlatform,
      nativeBuildStatus: "windows-target-host",
      warnings
    };
  }

  if (currentPlatform === "linux") {
    const pkgConfigAvailable = commandAvailable("pkg-config", commandAvailability);
    if (!pkgConfigAvailable) {
      warnings.push("pkg-config is missing; Linux native builds need pkg-config and libdbus-1-dev before Tauri can compile libdbus-sys.");
      warnings.push("The private proof workflow still targets Windows; run npm run native:build on a prepared Windows host for the Windows demo bundle.");
      return {
        currentPlatform,
        nativeBuildStatus: "host-prereqs-missing",
        warnings
      };
    }

    warnings.push("Linux host prerequisites look present, but the private proof workflow and runner commands still require Windows.");
    return {
      currentPlatform,
      nativeBuildStatus: "host-prereqs-present",
      warnings
    };
  }

  warnings.push("The private proof workflow is Windows-targeted; use a Windows host for the compiled demo and proof runners.");
  return {
    currentPlatform,
    nativeBuildStatus: "non-windows-host",
    warnings
  };
}

function commandAvailable(command, commandAvailability = null) {
  if (commandAvailability && Object.prototype.hasOwnProperty.call(commandAvailability, command)) {
    return Boolean(commandAvailability[command]);
  }
  const pathValue = process.env.PATH || "";
  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT || ".EXE;.CMD;.BAT").split(";")
    : [""];
  for (const dir of pathValue.split(path.delimiter)) {
    if (!dir) continue;
    for (const extension of extensions) {
      const candidate = path.join(dir, `${command}${extension}`);
      if (fs.existsSync(candidate)) return true;
    }
  }
  return false;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const summary = buildPrivateDemoReadinessSummary();
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.canAttemptPrivateWindowsDemo) process.exitCode = 1;
}
