#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_ID = "spaceguard-route-setup";
const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), "..");

export const routeSpecs = [
  {
    route: "known-temp-delete",
    aliases: ["temp", "known-temp", "known-temp-delete"],
    title: "Known temp cleanup",
    envVar: "SPACEGUARD_ENABLE_TEMP_EXECUTOR",
    requestMode: "execute-first-safe",
    panelId: "first-safe-temp-executor-panel",
    actionLabel: "Run real temp cleanup"
  },
  {
    route: "item-review-recycle-bin",
    aliases: ["downloads", "downloads-installers", "item-review-recycle-bin"],
    title: "Reviewed Downloads cleanup",
    envVar: "SPACEGUARD_ENABLE_DOWNLOADS_EXECUTOR",
    requestMode: "execute-downloads-recycle-bin",
    panelId: "downloads-cleanup-executor-panel",
    actionLabel: "Move reviewed Downloads items"
  },
  {
    route: "item-review-large-files",
    aliases: ["large-files", "archive", "large-user-files", "item-review-large-files"],
    title: "Reviewed large-file archive",
    envVar: "SPACEGUARD_ENABLE_LARGE_FILE_ARCHIVE_EXECUTOR",
    requestMode: "execute-large-file-archive",
    panelId: "large-file-archive-executor-panel",
    actionLabel: "Archive reviewed large files",
    requirements: ["Archive destination must be selected in the app."]
  },
  {
    route: "item-review-project-cache",
    aliases: ["project-deps", "node-modules", "node-modules-old", "item-review-project-cache"],
    title: "Reviewed project dependency cleanup",
    envVar: "SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR",
    requestMode: "execute-project-deps",
    panelId: "project-dependency-executor-panel",
    actionLabel: "Run reviewed dependency cleanup"
  },
  {
    route: "browser-cache-only",
    aliases: ["browser-cache", "browser", "browser-cache-only"],
    title: "Browser cache cleanup",
    envVar: "SPACEGUARD_ENABLE_BROWSER_CACHE_EXECUTOR",
    requestMode: "execute-browser-cache",
    panelId: "browser-cache-executor-panel",
    actionLabel: "Run browser cache cleanup"
  },
  {
    route: "bounded-cache-delete",
    aliases: ["gradle", "gradle-cache", "bounded-cache-delete"],
    title: "Gradle cache cleanup",
    envVar: "SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR",
    requestMode: "execute-gradle-cache",
    panelId: "gradle-cache-executor-panel",
    actionLabel: "Run Gradle cache cleanup"
  },
  {
    route: "bounded-user-cache-delete",
    aliases: ["user-cache", ".cache", "bounded-user-cache-delete"],
    title: "User .cache cleanup",
    envVar: "SPACEGUARD_ENABLE_USER_CACHE_EXECUTOR",
    requestMode: "execute-user-cache",
    panelId: "user-cache-executor-panel",
    actionLabel: "Run user .cache cleanup"
  },
  {
    route: "bounded-android-cache-delete",
    aliases: ["android-cache", "android", "bounded-android-cache-delete"],
    title: "Android cache cleanup",
    envVar: "SPACEGUARD_ENABLE_ANDROID_CACHE_EXECUTOR",
    requestMode: "execute-android-cache",
    panelId: "android-cache-executor-panel",
    actionLabel: "Run Android cache cleanup"
  },
  {
    route: "launcher-cache-cleanup",
    aliases: ["shader-cache", "steam-shader-cache", "launcher-cache-cleanup", "shader"],
    title: "Shader cache cleanup",
    envVar: "SPACEGUARD_ENABLE_SHADER_CACHE_EXECUTOR",
    requestMode: "execute-shader-cache",
    panelId: "shader-cache-executor-panel",
    actionLabel: "Run shader cache cleanup"
  },
  {
    route: "bounded-pip-cache-delete",
    aliases: ["pip-cache", "pip", "bounded-pip-cache-delete"],
    title: "pip cache cleanup",
    envVar: "SPACEGUARD_ENABLE_PIP_CACHE_EXECUTOR",
    requestMode: "execute-pip-cache",
    panelId: "pip-cache-executor-panel",
    actionLabel: "Run pip cache cleanup"
  },
  {
    route: "tool-native-docker-build-cache-prune",
    aliases: ["docker-build-cache", "docker", "tool-native-docker-build-cache-prune"],
    title: "Docker build-cache cleanup",
    envVar: "SPACEGUARD_ENABLE_TOOL_NATIVE_PRUNE_EXECUTORS",
    requestMode: "execute-docker-build-cache",
    panelId: "docker-build-cache-executor-panel",
    actionLabel: "Run Docker prune",
    requirements: ["Docker CLI inventory must be visible in the latest native scan."]
  },
  {
    route: "bounded-npm-cache-delete",
    aliases: ["npm-cache", "npm", "bounded-npm-cache-delete"],
    title: "npm cache cleanup",
    envVar: "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR",
    requestMode: "execute-npm-cache",
    panelId: "npm-cache-executor-panel",
    actionLabel: "Run npm cache cleanup"
  },
  {
    route: "bounded-pnpm-store-delete",
    aliases: ["pnpm-store", "pnpm", "bounded-pnpm-store-delete"],
    title: "pnpm store cleanup",
    envVar: "SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR",
    requestMode: "execute-pnpm-store",
    panelId: "pnpm-store-executor-panel",
    actionLabel: "Run pnpm store cleanup"
  },
  {
    route: "shell-recycle-bin",
    aliases: ["recycle-bin", "recycle", "shell-recycle-bin"],
    title: "Recycle Bin cleanup",
    envVar: "SPACEGUARD_ENABLE_RECYCLE_BIN_EXECUTOR",
    requestMode: "execute-recycle-bin",
    panelId: "recycle-bin-executor-panel",
    actionLabel: "Empty selected Recycle Bin",
    requirements: ["Permanent-removal confirmation must be typed in the app."]
  }
];

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
  const args = { route: "", list: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--list") args.list = true;
    if (value === "--route") args.route = argv[index + 1] || "";
    if (value.startsWith("--route=")) args.route = value.slice("--route=".length);
  }
  return args;
}

function flagEnabled(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function resolveSpec(routeInput = "") {
  const clean = String(routeInput || "").trim().toLowerCase();
  if (!clean) return null;
  return routeSpecs.find((spec) => spec.route.toLowerCase() === clean || spec.aliases.some((alias) => alias.toLowerCase() === clean)) || null;
}

export function listRoutes(env) {
  return routeSpecs.map((spec) => ({
    ...spec,
    enabled: flagEnabled(env[spec.envVar])
  }));
}

export function buildPacket({ routeInput = "", env = {} } = {}) {
  const selected = resolveSpec(routeInput);
  const routes = listRoutes(env);
  const enabledFlags = routes
    .filter((route) => route.enabled)
    .map((route) => route.envVar);
  const basePacket = {
    schemaVersion: "spaceguard-route-setup-packet/v1",
    tool: SCRIPT_ID,
    generatedAt: new Date().toISOString()
  };
  if (!selected) {
    return {
      ...basePacket,
      status: routeInput ? "unknown-route" : "route-required",
      routeInput,
      route: "",
      selected: null,
      enabledFlags,
      conflictingFlags: enabledFlags,
      routes,
      usage: "npm run setup:route -- --route npm-cache",
      nextSteps: [
        "Choose one route from routes[].aliases.",
        "Run npm run setup:route -- --route npm-cache for a route setup packet."
      ]
    };
  }

  const selectedEnabled = flagEnabled(env[selected.envVar]);
  const otherEnabled = enabledFlags.filter((flag) => flag !== selected.envVar);
  const status = otherEnabled.length
    ? "multiple-flags"
    : selectedEnabled
      ? "ready"
      : "flag-disabled";

  return {
    ...basePacket,
    status,
    routeInput,
    route: selected.route,
    selected: {
      ...selected,
      enabled: selectedEnabled
    },
    enabledFlags,
    conflictingFlags: otherEnabled,
    commands: {
      enablePowerShell: `$env:${selected.envVar}="1"`,
      disablePowerShell: `$env:${selected.envVar}="0"`,
      setupRoute: `npm run setup:route -- --route ${selected.aliases[0] || selected.route}`,
      openAiSmoke: `npm run openai:smoke -- --route ${selected.aliases[0] || selected.route}`,
      nativeDev: "npm run native:dev"
    },
    nextSteps: buildNextSteps({ status, selected, otherEnabled })
  };
}

export function buildRouteListPacket({ env = {} } = {}) {
  return {
    schemaVersion: "spaceguard-route-setup-packet/v1",
    tool: SCRIPT_ID,
    generatedAt: new Date().toISOString(),
    status: "route-list",
    usage: "npm run setup:route -- --route npm-cache",
    routes: listRoutes(env)
  };
}

function buildNextSteps({ status, selected, otherEnabled = [] }) {
  if (status === "ready") {
    return [
      `Launch npm run native:dev with only ${selected.envVar}=1 enabled.`,
      `In the app, select route ${selected.route} and use ${selected.panelId}.`,
      "Run exactly one scoped executor, then complete post-run native rescan proof before enabling another route."
    ];
  }
  if (status === "multiple-flags") {
    return [
      `Turn off all but ${selected.envVar} before launching native dev.`,
      `Currently conflicting flag(s): ${otherEnabled.join(", ")}.`,
      "Run setup:route again after narrowing to one route."
    ];
  }
  return [
    `Set ${selected.envVar}=1 for this route only.`,
    `PowerShell: $env:${selected.envVar}="1"`,
    "Run setup:route again, then launch npm run native:dev."
  ];
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const args = parseArgs(process.argv.slice(2));
  const env = {
    ...readDotEnv(path.join(root, ".env")),
    ...process.env
  };
  const packet = args.list
    ? buildRouteListPacket({ env })
    : buildPacket({ routeInput: args.route, env });

  console.log(JSON.stringify(packet, null, 2));
}
