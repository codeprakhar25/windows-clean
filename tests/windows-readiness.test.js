const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "run-windows-readiness.mjs");

(async () => {
  const readiness = await import(pathToFileURL(script).href);
  const missingDependencyCheck = readiness.buildWindowsToolchainCheck({
    platform: "win32",
    projectRoot: path.join(os.tmpdir(), "spaceguard-missing-node-modules"),
    env: {
      npm_execpath: process.env.npm_execpath || __filename,
      npm_config_user_agent: "npm/10.8.2 node/v18.20.8"
    }
  });
  assert(missingDependencyCheck.missing.includes("tauri-cli"), "toolchain check should require the local Tauri CLI dependency");
  assert(missingDependencyCheck.missing.includes("msvc-build-tools"), "Windows readiness should require Visual Studio C++ Build Tools");
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
      npm_config_user_agent: "npm/10.8.2 node/v18.20.8",
      VCINSTALLDIR: "C:\\BuildTools\\VC"
    }
  });
  assert(!installedDependencyCheck.missing.includes("tauri-cli"), "installed Tauri CLI dependency should satisfy readiness");
  assert(!installedDependencyCheck.missing.includes("msvc-build-tools"), "active VC developer environment should satisfy readiness");

  const missingMsvcCheck = readiness.buildWindowsToolchainCheck({
    platform: "win32",
    projectRoot: fakeProject,
    env: {
      npm_execpath: process.env.npm_execpath || __filename,
      npm_config_user_agent: "npm/10.8.2 node/v18.20.8"
    }
  });
  assert(missingMsvcCheck.missing.includes("msvc-build-tools"), "missing MSVC should block Windows native launch");
  assert(missingMsvcCheck.nextStep.includes("Desktop development with C++"), "missing MSVC next step should name the required Visual Studio workload");

  const missingToolchain = readiness.buildWindowsReadinessReport({
    routeInput: "npm-cache",
    env: {},
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
  assert.strictEqual(readiness.shouldFailReadinessCli(missingToolchain), true, "readiness CLI should fail until native dev launch is actually ready");
  assert(missingToolchain.nextSteps.some((step) => step.includes("Cargo")), "toolchain blocker should name missing tools");

  const ready = readiness.buildWindowsReadinessReport({
    routeInput: "npm-cache",
    env: {},
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
  assert.strictEqual(ready.status, "ready-for-native-dev", "Windows toolchain readiness should launch native dev without route arming");
  assert.strictEqual(ready.readyForNativeDev, true, "ready Windows preflight should allow native dev launch");
  assert.strictEqual(readiness.shouldFailReadinessCli(ready), false, "readiness CLI should exit green only for ready Windows native dev launch");
  assert.strictEqual(ready.route.status, "flag-disabled", "route diagnostics may remain disabled without blocking native launch");
  assert.strictEqual(ready.routeAudit.ready, false, "optional route audit should not be treated as native launch readiness");
  assert(ready.nextSteps.some((step) => step.includes("npm run native:dev")), "ready preflight should point users to the direct native launcher");
  assert(ready.nextSteps.some((step) => step.includes("Delete all") && step.includes("Delete selected")), "ready preflight should match the simplified cleanup flow");
  assert(!ready.nextSteps.some((step) => /can clean|delete confirmation|delete selected files|refresh space/i.test(step)), "ready preflight should not mention obsolete cleanup UI labels");
  assert(!ready.nextSteps.some((step) => /setup:route|route:arm|openai:smoke|windows:dev/.test(step)), "ready preflight should not require advanced route commands");

  const unknownRoute = readiness.buildWindowsReadinessReport({
    routeInput: "not-a-real-route",
    env: {},
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
  assert.strictEqual(unknownRoute.readyForNativeDev, true, "unknown optional route audit input should not block the native app launcher");
  assert.strictEqual(unknownRoute.localContract.brokerStatus, "unsupported-route", "unknown optional route audit should be reported as diagnostic data");

  console.log("windows readiness ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
