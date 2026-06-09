#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { buildWindowsReadinessReport } from "./run-windows-readiness.mjs";

const SCRIPT_ID = "spaceguard-windows-dev";
const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), "..");

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

function runNodeScript(scriptName, args = []) {
  return spawnSync(process.execPath, [path.join(root, "scripts", scriptName), ...args], {
    cwd: root,
    stdio: "inherit",
    env: process.env
  });
}

function runNpmScript(scriptName, args = []) {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  return spawnSync(command, ["run", scriptName, "--", ...args], {
    cwd: root,
    stdio: "inherit",
    env: process.env
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

  const readiness = buildWindowsReadinessReport({ routeInput });
  printReadinessSummary(readiness);
  if (args.dryRun) return;
  if (!readiness.readyForNativeDev) {
    process.exitCode = 1;
    return;
  }

  const launch = runNpmScript("native:dev");
  process.exitCode = launch.status || 0;
}

main();
