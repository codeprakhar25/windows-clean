#!/usr/bin/env node
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { buildWindowsReadinessReport } from "./run-windows-readiness.mjs";
import { routeSpecs } from "./run-setup-route.mjs";

const SCRIPT_ID = "spaceguard-windows-dev";
const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), "..");
const dotenvPath = path.join(root, ".env");
const routeEnvVars = routeSpecs.map((route) => route.envVar);

function parseArgs(argv = []) {
  const args = { route: "npm-cache", dryRun: false, skipArm: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--dry-run") args.dryRun = true;
    if (value === "--skip-arm") args.skipArm = true;
    if (value === "--route") args.route = argv[index + 1] || "";
    if (value.startsWith("--route=")) args.route = value.slice("--route=".length);
  }
  return args;
}

function resolveRouteSpec(routeInput = "") {
  const clean = String(routeInput || "").trim().toLowerCase();
  if (!clean) return null;
  return routeSpecs.find((route) =>
    route.route.toLowerCase() === clean ||
    route.aliases.some((alias) => alias.toLowerCase() === clean)
  ) || null;
}

function runNodeScript(scriptName, args = []) {
  return spawnSync(process.execPath, [path.join(root, "scripts", scriptName), ...args], {
    cwd: root,
    stdio: "inherit",
    env: process.env
  });
}

export function readLauncherDotEnv(filePath) {
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

export function buildWindowsLaunchEnv({ env = process.env, dotenv = {} } = {}) {
  const launchEnv = { ...env };
  for (const [key, value] of Object.entries(dotenv)) {
    if (routeEnvVars.includes(key)) {
      launchEnv[key] = value;
    } else if (String(value || "").trim() && !String(launchEnv[key] || "").trim()) {
      launchEnv[key] = value;
    }
  }
  return launchEnv;
}

function applyArmedRouteToDotEnv(dotenv = {}, routeInput = "") {
  const selected = resolveRouteSpec(routeInput);
  if (!selected) return dotenv;
  const next = { ...dotenv };
  for (const envVar of routeEnvVars) {
    next[envVar] = envVar === selected.envVar ? "1" : "0";
  }
  return next;
}

function runNpmScript(scriptName, args = [], env = process.env) {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  return spawnSync(command, ["run", scriptName, "--", ...args], {
    cwd: root,
    stdio: "inherit",
    env
  });
}

function printReadinessSummary(report) {
  console.log(JSON.stringify({
    schemaVersion: "spaceguard-windows-dev/v1",
    tool: SCRIPT_ID,
    status: report.readyForNativeDev ? "launching-native-dev" : "launch-blocked",
    routeInput: report.routeInput,
    readinessStatus: report.status,
    readyForNativeDev: report.readyForNativeDev,
    platform: report.platform,
    dryRun: report.dryRun,
    simulatedRouteArm: report.simulatedRouteArm,
    envFilePresent: report.env.envFilePresent,
    selectedEnvVar: report.route.selectedEnvVar,
    enabledFlags: report.route.enabledFlags,
    nextSteps: report.nextSteps
  }, null, 2));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const routeInput = args.route || "npm-cache";
  if (!args.skipArm) {
    const armArgs = ["--route", routeInput];
    if (args.dryRun) armArgs.push("--dry-run");
    const arm = runNodeScript("arm-route.mjs", armArgs);
    if (arm.status !== 0) {
      process.exitCode = arm.status || 1;
      return;
    }
  }

  const dotenvFromDisk = readLauncherDotEnv(dotenvPath);
  const dotenv = args.dryRun && !args.skipArm
    ? applyArmedRouteToDotEnv(dotenvFromDisk, routeInput)
    : dotenvFromDisk;
  const launchEnv = buildWindowsLaunchEnv({ env: process.env, dotenv });
  const readiness = buildWindowsReadinessReport({
    routeInput,
    env: launchEnv,
    dotenv,
    envFilePresent: fs.existsSync(dotenvPath),
    dryRun: args.dryRun,
    simulatedRouteArm: Boolean(args.dryRun && !args.skipArm)
  });
  printReadinessSummary(readiness);
  if (args.dryRun) return;
  if (!readiness.readyForNativeDev) {
    process.exitCode = 1;
    return;
  }

  const launch = runNpmScript("native:dev", [], launchEnv);
  process.exitCode = launch.status || 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main();
}
