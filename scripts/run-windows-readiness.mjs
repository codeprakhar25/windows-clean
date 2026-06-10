#!/usr/bin/env node
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { buildSetupDoctorReport } from "./run-setup-doctor.mjs";
import { buildPacket } from "./run-setup-route.mjs";
import {
  buildRouteContractAdviceResult,
  buildRouteContractContext,
  buildRouteContractRecommendationBroker,
  resolveSmokeRoute,
  validateSmokeAdvice
} from "./run-openai-advisor-smoke.mjs";

const SCRIPT_ID = "spaceguard-windows-readiness";
const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), "..");
const dotenvPath = path.join(root, ".env");

function parseArgs(argv = []) {
  const args = { route: "npm-cache" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--route") args.route = argv[index + 1] || "";
    if (value.startsWith("--route=")) args.route = value.slice("--route=".length);
  }
  return args;
}

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
    const value = withoutExport.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key) rows[key] = value;
  }
  return rows;
}

function buildLocalContractCheck(routeInput) {
  let route;
  try {
    route = resolveSmokeRoute(routeInput);
  } catch (error) {
    return {
      passed: false,
      route: "",
      routeInput,
      expectedActionType: "",
      expectedTargetId: "",
      brokerStatus: "unsupported-route",
      blockers: [error?.message || "Unsupported optional route audit input."]
    };
  }
  const requiredRecommendation = route.requiredRecommendation;
  const context = buildRouteContractContext({ routeInput });
  const result = buildRouteContractAdviceResult({ requiredRecommendation });
  const broker = buildRouteContractRecommendationBroker({ context, advice: result.advice, route });
  const validation = validateSmokeAdvice({
    context,
    advice: result.advice,
    broker,
    requiredRecommendation
  });
  return {
    passed: validation.passed,
    route: route.spec.route,
    routeInput,
    expectedActionType: requiredRecommendation.actionType,
    expectedTargetId: requiredRecommendation.targetId,
    brokerStatus: broker.status,
    blockers: validation.blockers || []
  };
}

function checkTool({ id, label, command, args = [] }) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = String(result.stdout || result.stderr || "").trim().split(/\r?\n/)[0] || "";
  const available = result.status === 0 && !result.error;
  return {
    id,
    label,
    command: [command, ...args].join(" "),
    available,
    version: available ? output : "",
    error: available ? "" : result.error?.message || output || "command failed"
  };
}

function checkWindowsCommandOnPath(command) {
  const result = spawnSync("where.exe", [command], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = String(result.stdout || result.stderr || "").trim().split(/\r?\n/)[0] || "";
  return {
    command,
    available: result.status === 0 && !result.error,
    path: result.status === 0 && !result.error ? output : "",
    error: result.error?.message || output || "not found on PATH"
  };
}

function checkNpmTool({ platform = process.platform, env = process.env } = {}) {
  const execPath = String(env.npm_execpath || "").trim();
  const userAgent = String(env.npm_config_user_agent || "").trim();
  const versionMatch = userAgent.match(/npm\/([^\s]+)/i);
  if (execPath && fs.existsSync(execPath)) {
    return {
      id: "npm",
      label: "npm",
      command: platform === "win32" ? "npm.cmd --version" : "npm --version",
      available: true,
      version: versionMatch ? versionMatch[1] : "npm available",
      error: ""
    };
  }
  const npmCommand = platform === "win32" ? "npm.cmd" : "npm";
  return checkTool({ id: "npm", label: "npm", command: npmCommand, args: ["--version"] });
}

function checkLocalTauriCli({ platform = process.platform, projectRoot = root } = {}) {
  const command = platform === "win32"
    ? path.join(projectRoot, "node_modules", ".bin", "tauri.cmd")
    : path.join(projectRoot, "node_modules", ".bin", "tauri");
  const packageDir = path.join(projectRoot, "node_modules", "@tauri-apps", "cli");
  const available = fs.existsSync(command) && fs.existsSync(packageDir);
  return {
    id: "tauri-cli",
    label: "Tauri CLI dependency",
    command,
    available,
    version: available ? "local dependency installed" : "",
    error: available ? "" : "Run npm install so node_modules/.bin/tauri is available."
  };
}

function findVsWherePath(env = process.env) {
  const roots = [
    env["ProgramFiles(x86)"],
    env.ProgramFiles,
    "C:\\Program Files (x86)",
    "C:\\Program Files"
  ].map((value) => String(value || "").trim()).filter(Boolean);
  for (const rootPath of roots) {
    const candidate = path.join(rootPath, "Microsoft Visual Studio", "Installer", "vswhere.exe");
    if (fs.existsSync(candidate)) return candidate;
  }
  return "";
}

function checkVsWhereForComponent({ env = process.env, component = "" } = {}) {
  const vswherePath = findVsWherePath(env);
  if (!vswherePath || !component) {
    return {
      available: false,
      command: vswherePath || "vswhere.exe",
      installPath: "",
      error: vswherePath ? "component not specified" : "vswhere.exe was not found"
    };
  }
  const result = spawnSync(vswherePath, [
    "-latest",
    "-products",
    "*",
    "-requires",
    component,
    "-property",
    "installationPath"
  ], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const installPath = String(result.stdout || "").trim().split(/\r?\n/)[0] || "";
  const error = String(result.stderr || "").trim();
  return {
    available: result.status === 0 && !result.error && Boolean(installPath),
    command: `${vswherePath} -requires ${component}`,
    installPath,
    error: result.error?.message || error || "Visual Studio component was not found"
  };
}

function checkWindowsMsvcBuildTools({ platform = process.platform, env = process.env } = {}) {
  if (platform !== "win32") return null;
  const developerEnvKey = ["VCINSTALLDIR", "VCToolsInstallDir", "VSINSTALLDIR"]
    .find((key) => String(env[key] || "").trim());
  if (developerEnvKey) {
    return {
      id: "msvc-build-tools",
      label: "Visual Studio C++ Build Tools",
      command: developerEnvKey,
      available: true,
      version: `${developerEnvKey}=${env[developerEnvKey]}`,
      error: ""
    };
  }

  const usingProcessEnv = env === process.env;
  const hasDiscoveryEnv = Boolean(
    String(env["ProgramFiles(x86)"] || env.ProgramFiles || env.Path || env.PATH || "").trim()
  );
  if (!usingProcessEnv && !hasDiscoveryEnv) {
    return {
      id: "msvc-build-tools",
      label: "Visual Studio C++ Build Tools",
      command: "VCINSTALLDIR, VCToolsInstallDir, VSINSTALLDIR, ProgramFiles, or PATH",
      available: false,
      version: "",
      error: "Visual Studio Build Tools were not visible in the provided environment."
    };
  }

  const vswhere = checkVsWhereForComponent({
    env,
    component: "Microsoft.VisualStudio.Component.VC.Tools.x86.x64"
  });
  if (vswhere.available) {
    return {
      id: "msvc-build-tools",
      label: "Visual Studio C++ Build Tools",
      command: vswhere.command,
      available: true,
      version: vswhere.installPath,
      error: ""
    };
  }

  const tools = ["cl.exe", "link.exe", "lib.exe"].map((tool) => checkWindowsCommandOnPath(tool));
  const missing = tools.filter((tool) => !tool.available).map((tool) => tool.command);
  return {
    id: "msvc-build-tools",
    label: "Visual Studio C++ Build Tools",
    command: "where.exe cl.exe && where.exe link.exe && where.exe lib.exe",
    available: missing.length === 0,
    version: missing.length === 0 ? tools.map((tool) => `${tool.command}=${tool.path}`).join("; ") : "",
    error: missing.length === 0
      ? ""
      : `Missing ${missing.join(", ")}. Install Visual Studio Build Tools with Desktop development with C++, then restart PowerShell or use Developer PowerShell.`
  };
}

export function buildWindowsToolchainCheck({ platform = process.platform, env = process.env, projectRoot = root } = {}) {
  const checks = [
    checkTool({ id: "node", label: "Node.js", command: process.execPath, args: ["--version"] }),
    checkNpmTool({ platform, env }),
    checkLocalTauriCli({ platform, projectRoot }),
    checkTool({ id: "rustc", label: "Rust compiler", command: "rustc", args: ["--version"] }),
    checkTool({ id: "cargo", label: "Cargo", command: "cargo", args: ["--version"] })
  ];
  const msvcCheck = checkWindowsMsvcBuildTools({ platform, env });
  if (msvcCheck) checks.push(msvcCheck);
  const missing = checks.filter((row) => !row.available);
  const missingMsvc = missing.some((row) => row.id === "msvc-build-tools");
  return {
    schemaVersion: "spaceguard-windows-toolchain-check/v1",
    status: missing.length ? "missing-tools" : "ready",
    ready: missing.length === 0,
    checks,
    missing: missing.map((row) => row.id),
    missingLabels: missing.map((row) => row.label),
    nextStep: missing.length
      ? missingMsvc
        ? "Run npm install if node_modules is missing, install Visual Studio Build Tools with the Desktop development with C++ workload, restart PowerShell or use Developer PowerShell, then rerun npm run windows:ready."
        : "Run npm install, then install or repair Node.js, Rustup/Cargo, and the Tauri Windows prerequisites before launching the desktop shell."
      : "Required local toolchain commands are available."
  };
}

export function buildWindowsReadinessReport({
  routeInput = "npm-cache",
  env = process.env,
  dotenv = readDotEnv(dotenvPath),
  envFilePresent = fs.existsSync(dotenvPath),
  generatedAt = new Date().toISOString(),
  dryRun = false,
  simulatedRouteArm = false,
  platform = process.platform,
  projectRoot = root,
  toolchain = buildWindowsToolchainCheck({ platform, env, projectRoot })
} = {}) {
  const routePacket = buildPacket({
    routeInput,
    env: {
      ...dotenv,
      ...env
    }
  });
  const doctor = buildSetupDoctorReport({
    env,
    dotenv,
    envFilePresent,
    generatedAt
  });
  const contract = buildLocalContractCheck(routeInput);
  const windowsHost = platform === "win32";
  const toolchainReady = Boolean(toolchain.ready);
  const routeArmed = routePacket.status === "ready";
  const singleRouteReady = doctor.scopedExecutors.validationStatus === "one-route-ready";
  const routeAuditReady = Boolean(routeArmed && singleRouteReady && contract.passed);
  const readyForNativeDev = Boolean(windowsHost && toolchainReady);
  const status = readyForNativeDev
    ? "ready-for-native-dev"
    : !windowsHost
      ? "host-not-windows"
      : "toolchain-blocked";

  return {
    schemaVersion: "spaceguard-windows-readiness/v1",
    tool: SCRIPT_ID,
    generatedAt,
    dryRun: Boolean(dryRun),
    simulatedRouteArm: Boolean(simulatedRouteArm),
    status,
    readyForNativeDev,
    routeInput,
    platform: {
      os: platform,
      windowsHost
    },
    env: {
      envFilePresent,
      envFilePath: ".env"
    },
    toolchain,
    route: {
      status: routePacket.status,
      route: routePacket.route,
      selectedEnvVar: routePacket.selected?.envVar || "",
      enabledFlags: routePacket.enabledFlags || [],
      conflictingFlags: routePacket.conflictingFlags || [],
      armCommand: routePacket.commands?.armRoute || `npm run route:arm -- --route ${routeInput}`,
      setupCommand: routePacket.commands?.setupRoute || `npm run setup:route -- --route ${routeInput}`
    },
    doctor: {
      status: doctor.status,
      openAiConfigured: doctor.openAi.configured,
      selectedFlag: doctor.scopedExecutors.selectedFlag,
      safeToLaunchWriteMode: doctor.scopedExecutors.safeToLaunchWriteMode
    },
    localContract: contract,
    routeAudit: {
      status: routeAuditReady ? "ready" : "optional",
      ready: routeAuditReady,
      routeArmed,
      singleRouteReady,
      localContractPassed: contract.passed
    },
    nextSteps: buildReadinessNextSteps({
      status,
      doctor,
      windowsHost,
      toolchain
    })
  };
}

function buildReadinessNextSteps({ status, doctor, windowsHost, toolchain }) {
  const steps = [];
  if (!windowsHost) {
    steps.push("Run this readiness command again on the Windows PC before launching the desktop app.");
    return steps;
  }
  if (!toolchain?.ready) {
    steps.push(`Install or repair missing desktop toolchain command(s): ${(toolchain?.missingLabels || toolchain?.missing || []).join(", ")}.`);
    if ((toolchain?.missing || []).includes("msvc-build-tools")) {
      steps.push("Install Visual Studio Build Tools with the Desktop development with C++ workload so cl.exe, link.exe, and lib.exe are available to native crates.");
      steps.push("Restart PowerShell after installing Build Tools, or run the app from Developer PowerShell for VS.");
    }
    steps.push("Run npm install after pulling this repo, then restart the terminal after installing Rustup/Cargo or Tauri Windows prerequisites.");
    steps.push("Rerun npm run windows:ready before launching the desktop app.");
  }
  if (status === "ready-for-native-dev") {
    steps.push("Run npm run native:dev.");
    steps.push("In the app: Scan PC, pick a row marked can clean, check the delete confirmation, delete selected files, then refresh space.");
  }
  if (!doctor.openAi.configured) {
    steps.push("Set OPENAI_API_KEY in .env only if you want the Ask AI page.");
  }
  return steps;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = buildWindowsReadinessReport({ routeInput: args.route || "npm-cache" });
  console.log(JSON.stringify(report, null, 2));
  if (shouldFailReadinessCli(report)) {
    process.exitCode = 1;
  }
}

export function shouldFailReadinessCli(report) {
  return !report?.readyForNativeDev;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main();
}
