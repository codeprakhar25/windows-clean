const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "run-windows-readiness.mjs");

(async () => {
  const readiness = await import(pathToFileURL(script).href);
  const routeEnv = {
    SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR: "1"
  };
  const missingDependencyCheck = readiness.buildWindowsToolchainCheck({
    platform: "win32",
    projectRoot: path.join(os.tmpdir(), "spaceguard-missing-node-modules"),
    env: {
      npm_execpath: process.env.npm_execpath || __filename,
      npm_config_user_agent: "npm/10.8.2 node/v18.20.8"
    }
  });
  assert(missingDependencyCheck.missing.includes("tauri-cli"), "toolchain check should require the local Tauri CLI dependency");
  assert(missingDependencyCheck.nextStep.includes("npm install"), "missing local dependencies should tell the user to run npm install");

  const fakeProject = fs.mkdtempSync(path.join(os.tmpdir(), "spaceguard-ready-deps-"));
  fs.mkdirSync(path.join(fakeProject, "node_modules", ".bin"), { recursive: true });
  fs.mkdirSync(path.join(fakeProject, "node_modules", "@tauri-apps", "cli"), { recursive: true });
  fs.writeFileSync(path.join(fakeProject, "node_modules", ".bin", "tauri.cmd"), "");
  const installedDependencyCheck = readiness.buildWindowsToolchainCheck({
    platform: "win32",
    projectRoot: fakeProject,
    env: {
      npm_execpath: process.env.npm_execpath || __filename,
      npm_config_user_agent: "npm/10.8.2 node/v18.20.8"
    }
  });
  assert(!installedDependencyCheck.missing.includes("tauri-cli"), "installed Tauri CLI dependency should satisfy readiness");

  const missingToolchain = readiness.buildWindowsReadinessReport({
    routeInput: "npm-cache",
    env: routeEnv,
    dotenv: {},
    envFilePresent: false,
    generatedAt: "2026-06-09T00:00:00.000Z",
    platform: "win32",
    toolchain: {
      schemaVersion: "spaceguard-windows-toolchain-check/v1",
      status: "missing-tools",
      ready: false,
      checks: [],
      missing: ["cargo"],
      missingLabels: ["Cargo"],
      nextStep: "Install Cargo."
    }
  });
  assert.strictEqual(missingToolchain.schemaVersion, "spaceguard-windows-readiness/v1", "readiness should expose a stable schema");
  assert.strictEqual(missingToolchain.status, "toolchain-blocked", "Windows launch should block before native dev when Cargo/Rust are missing");
  assert.strictEqual(missingToolchain.readyForNativeDev, false, "missing toolchain should prevent native dev launch");
  assert(missingToolchain.nextSteps.some((step) => step.includes("Cargo")), "toolchain blocker should name missing tools");

  const ready = readiness.buildWindowsReadinessReport({
    routeInput: "npm-cache",
    env: routeEnv,
    dotenv: {},
    envFilePresent: false,
    generatedAt: "2026-06-09T00:00:00.000Z",
    platform: "win32",
    toolchain: {
      schemaVersion: "spaceguard-windows-toolchain-check/v1",
      status: "ready",
      ready: true,
      checks: [],
      missing: [],
      missingLabels: [],
      nextStep: "Required local toolchain commands are available."
    }
  });
  assert.strictEqual(ready.status, "ready-for-native-dev", "one armed route with toolchain ready should launch native dev on Windows");
  assert.strictEqual(ready.readyForNativeDev, true, "ready Windows preflight should allow native dev launch");

  console.log("windows readiness ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
