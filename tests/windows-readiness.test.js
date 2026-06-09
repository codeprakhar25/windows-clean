const assert = require("assert");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "run-windows-readiness.mjs");

(async () => {
  const readiness = await import(pathToFileURL(script).href);
  const routeEnv = {
    SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR: "1"
  };

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
