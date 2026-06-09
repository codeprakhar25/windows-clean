#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { routeSpecs } from "./run-setup-route.mjs";

const SCRIPT_ID = "spaceguard-arm-route";
const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), "..");
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");
const routeEnvVars = routeSpecs.map((route) => route.envVar);

function parseArgs(argv) {
  const args = { route: "", dryRun: false, list: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--dry-run") args.dryRun = true;
    if (value === "--list") args.list = true;
    if (value === "--route") args.route = argv[index + 1] || "";
    if (value.startsWith("--route=")) args.route = value.slice("--route=".length);
  }
  return args;
}

function resolveSpec(routeInput = "") {
  const clean = String(routeInput || "").trim().toLowerCase();
  if (!clean) return null;
  return routeSpecs.find((spec) =>
    spec.route.toLowerCase() === clean ||
    spec.aliases.some((alias) => alias.toLowerCase() === clean)
  ) || null;
}

function loadEnvSource() {
  if (fs.existsSync(envPath)) {
    return {
      source: ".env",
      content: fs.readFileSync(envPath, "utf8")
    };
  }
  if (fs.existsSync(examplePath)) {
    return {
      source: ".env.example",
      content: fs.readFileSync(examplePath, "utf8")
    };
  }
  return {
    source: "generated",
    content: [
      "OPENAI_API_KEY=",
      "OPENAI_MODEL=gpt-5.2",
      "OPENAI_REASONING_EFFORT=low",
      ""
    ].join("\n")
  };
}

function envLineKey(line = "") {
  const clean = line.trim();
  if (!clean || clean.startsWith("#")) return "";
  const withoutExport = clean.startsWith("export ") ? clean.slice("export ".length) : clean;
  const index = withoutExport.indexOf("=");
  if (index === -1) return "";
  return withoutExport.slice(0, index).trim();
}

function setEnvValue(lines, key, value) {
  const nextLine = `${key}=${value}`;
  const index = lines.findIndex((line) => envLineKey(line) === key);
  if (index === -1) {
    lines.push(nextLine);
    return;
  }
  lines[index] = nextLine;
}

function buildArmedEnv({ content, selectedEnvVar }) {
  const lines = String(content || "").split(/\r?\n/);
  if (!lines.some((line) => envLineKey(line) === "OPENAI_API_KEY")) {
    lines.unshift("OPENAI_API_KEY=");
  }
  for (const envVar of routeEnvVars) {
    setEnvValue(lines, envVar, envVar === selectedEnvVar ? "1" : "0");
  }
  const output = lines.join("\n").replace(/\n*$/, "\n");
  return output;
}

function listRoutes() {
  return routeSpecs.map((route) => ({
    route: route.route,
    aliases: route.aliases,
    title: route.title,
    envVar: route.envVar
  }));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.list) {
    console.log(JSON.stringify({
      schemaVersion: "spaceguard-arm-route/v1",
      tool: SCRIPT_ID,
      status: "route-list",
      routes: listRoutes()
    }, null, 2));
    return;
  }

  const selected = resolveSpec(args.route);
  if (!selected) {
    console.error(`${SCRIPT_ID}: choose a route with --route npm-cache. Use --list to see route aliases.`);
    process.exit(1);
  }

  const source = loadEnvSource();
  const nextContent = buildArmedEnv({
    content: source.content,
    selectedEnvVar: selected.envVar
  });

  if (!args.dryRun) {
    fs.writeFileSync(envPath, nextContent);
  }

  console.log(JSON.stringify({
    schemaVersion: "spaceguard-arm-route/v1",
    tool: SCRIPT_ID,
    status: args.dryRun ? "dry-run" : "armed",
    routeInput: args.route,
    route: selected.route,
    title: selected.title,
    envFile: envPath,
    source: source.source,
    selectedEnvVar: selected.envVar,
    disabledRouteFlags: routeEnvVars.filter((envVar) => envVar !== selected.envVar),
    nextSteps: [
      "Set OPENAI_API_KEY in .env if it is still blank.",
      `Run npm run setup:route -- --route ${selected.aliases[0] || selected.route}.`,
      `Run npm run windows:dev -- --route ${selected.aliases[0] || selected.route} and complete scan, review, consent, execute, rescan, export proof in the app.`
    ]
  }, null, 2));
}

main();
