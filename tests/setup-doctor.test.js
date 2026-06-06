const assert = require("assert");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "run-setup-doctor.mjs");

(async () => {
  const doctor = await import(pathToFileURL(script).href);
  function runDoctor(extraEnv = {}) {
    return doctor.buildSetupDoctorReport({
      env: extraEnv,
      dotenv: {},
      envFilePresent: false,
      generatedAt: "2026-06-06T00:00:00.000Z"
    });
  }

  const multiFlag = runDoctor({
    SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR: "1",
    SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR: "1"
  });
  assert.strictEqual(multiFlag.schemaVersion, "spaceguard-setup-doctor/v1", "setup doctor should emit a stable schema");
  assert.strictEqual(multiFlag.scopedExecutors.validationStatus, "multi-flag-blocked", "setup doctor should block multi-flag write launches");
  assert.strictEqual(multiFlag.scopedExecutors.safeToLaunchWriteMode, false, "multi-flag setup should not be safe for write mode");
  assert.deepStrictEqual(
    multiFlag.scopedExecutors.conflictingFlags,
    ["SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR", "SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR"],
    "setup doctor should list conflicting scoped executor flags"
  );
  assert(multiFlag.nextSteps.some((step) => step.includes("Turn off all but one")), "multi-flag setup should tell the operator to narrow flags");

  const oneFlag = runDoctor({
    SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR: "1"
  });
  assert.strictEqual(oneFlag.scopedExecutors.validationStatus, "one-route-ready", "one flag should be ready for one-route validation");
  assert.strictEqual(oneFlag.scopedExecutors.safeToLaunchWriteMode, true, "one flag should be safe to launch for one-route validation");
  assert.strictEqual(oneFlag.scopedExecutors.selectedFlag, "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR", "setup doctor should identify the selected route flag");
  assert.strictEqual(oneFlag.scopedExecutors.selectedRoute.routeInput, "npm-cache", "setup doctor should map the selected flag to its route alias");
  assert(oneFlag.commands.routeValidation.includes("npm run validate:route -- --route npm-cache"), "setup doctor should expose route validation command");

  const pnpmFlag = runDoctor({
    SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR: "1"
  });
  assert.strictEqual(pnpmFlag.scopedExecutors.selectedFlag, "SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR", "setup doctor should identify pnpm as the selected route flag");
  assert.strictEqual(pnpmFlag.scopedExecutors.selectedRoute.routeInput, "pnpm-store", "setup doctor should map pnpm flag to pnpm-store route alias");
  assert(pnpmFlag.commands.routeSetup.includes("npm run setup:route -- --route pnpm-store"), "setup doctor should expose selected pnpm route setup command");
  assert(pnpmFlag.commands.routeValidation.includes("npm run validate:route -- --route pnpm-store"), "setup doctor should expose selected pnpm validation command");
  assert(pnpmFlag.commands.openAiFixtureSmoke.includes("npm run openai:smoke:fixture -- --route pnpm-store"), "setup doctor should expose selected pnpm fixture smoke command");
  assert(pnpmFlag.commands.openAiSmoke.includes("npm run openai:smoke -- --route pnpm-store"), "setup doctor should expose selected pnpm OpenAI smoke command");
  assert(pnpmFlag.openAi.fixtureSmokeCommand.includes("--route pnpm-store"), "setup doctor OpenAI summary should be route-specific");
  assert(pnpmFlag.nextSteps.some((step) => step.includes("pnpm-store")), "setup doctor next steps should name the selected route alias");

  const noFlag = runDoctor();
  assert.strictEqual(noFlag.scopedExecutors.validationStatus, "readonly-ready", "no flags should remain read-only ready");
  assert.strictEqual(noFlag.scopedExecutors.safeToLaunchWriteMode, false, "read-only setup should not claim write launch readiness");

  console.log("setup doctor ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
