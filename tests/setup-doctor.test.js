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

  const blockedOneFlag = runDoctor({
    SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR: "1"
  });
  assert.strictEqual(blockedOneFlag.scopedExecutors.validationStatus, "one-route-ready", "real-data route should be ready with one enabled route flag");
  assert.strictEqual(blockedOneFlag.scopedExecutors.safeToLaunchWriteMode, true, "one route flag should be safe for write-mode launch");
  assert.strictEqual(blockedOneFlag.realWorkflow.ready, true, "one route flag should make the compact workflow ready");
  assert(!blockedOneFlag.nextSteps.some((step) => /first-route|fixture|validate:route/.test(step)), "setup doctor must not point to removed proof or validation packet commands");

  const oneFlag = runDoctor({
    SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR: "1"
  });
  assert.strictEqual(oneFlag.scopedExecutors.validationStatus, "one-route-ready", "one flag should be ready for one-route validation");
  assert.strictEqual(oneFlag.scopedExecutors.safeToLaunchWriteMode, true, "one flag should be safe to launch for one-route validation");
  assert(!Object.prototype.hasOwnProperty.call(oneFlag.scopedExecutors, "firstRouteProof"), "setup doctor should not expose seeded proof gates");
  assert.strictEqual(oneFlag.scopedExecutors.selectedFlag, "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR", "setup doctor should identify the selected route flag");
  assert.strictEqual(oneFlag.scopedExecutors.selectedRoute.routeInput, "npm-cache", "setup doctor should map the selected flag to its route alias");
  assert(!Object.prototype.hasOwnProperty.call(oneFlag.commands, "routeValidation"), "setup doctor must not expose removed validation packet command");
  assert(oneFlag.commands.workflowProofValidation.includes("npm run validate:workflow-proof -- --file"), "setup doctor should expose workflow proof validation command");
  assert(!Object.prototype.hasOwnProperty.call(oneFlag.commands, "routeCompletionValidation"), "setup doctor must not expose removed route completion command");
  assert.strictEqual(oneFlag.realWorkflow.routeInput, "npm-cache", "setup doctor should expose the selected route workflow alias");
  assert.strictEqual(oneFlag.realWorkflow.ready, true, "one-route setup should make the compact real workflow ready");
  assert.deepStrictEqual(
    oneFlag.realWorkflow.steps.map((step) => step.id),
    ["openai-smoke", "route-setup", "native-scan", "arm-consent", "execute-route", "post-run-rescan", "proof-export", "support-bundle", "next-route"],
    "setup doctor should emit the compact real cleanup workflow in order"
  );
  assert(oneFlag.commands.supportBundle.includes("npm run support:bundle"), "setup doctor should expose support bundle capture command");
  assert(oneFlag.realWorkflow.steps.find((step) => step.id === "proof-export").detail.includes("spaceguard-workflow-proof-check.json"), "compact workflow should export the in-app proof check artifact");
  assert(!oneFlag.realWorkflow.steps.some((step) => step.id === "proof-import"), "compact workflow should not require a manual selected-route proof import");
  assert(!oneFlag.realWorkflow.steps.some((step) => step.id === "workflow-proof-check"), "compact workflow should not require a separate verifier step before support bundle capture");
  assert(oneFlag.realWorkflow.steps.find((step) => step.id === "support-bundle").command.includes("support:bundle"), "compact workflow should capture support bundle before next route");

  const pnpmFlag = runDoctor({
    SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR: "1"
  });
  assert.strictEqual(pnpmFlag.scopedExecutors.selectedFlag, "SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR", "setup doctor should identify pnpm as the selected route flag");
  assert.strictEqual(pnpmFlag.scopedExecutors.selectedRoute.routeInput, "pnpm-store", "setup doctor should map pnpm flag to pnpm-store route alias");
  assert(pnpmFlag.commands.routeSetup.includes("npm run setup:route -- --route pnpm-store"), "setup doctor should expose selected pnpm route setup command");
  assert(!Object.prototype.hasOwnProperty.call(pnpmFlag.commands, "routeValidation"), "setup doctor should not expose selected pnpm validation packet command");
  assert(!Object.prototype.hasOwnProperty.call(pnpmFlag.commands, "openAiFixtureSmoke"), "setup doctor must not expose fixture-only smoke commands");
  assert(pnpmFlag.commands.openAiSmoke.includes("npm run openai:smoke -- --route pnpm-store"), "setup doctor should expose selected pnpm OpenAI smoke command");
  assert(!Object.prototype.hasOwnProperty.call(pnpmFlag.commands, "routeCompletionValidation"), "setup doctor should not expose removed selected pnpm completion command");
  assert(!Object.prototype.hasOwnProperty.call(pnpmFlag.openAi, "fixtureSmokeCommand"), "setup doctor OpenAI summary must not expose fixture-only smoke commands");
  assert(pnpmFlag.nextSteps.some((step) => step.includes("pnpm-store")), "setup doctor next steps should name the selected route alias");
  assert(!pnpmFlag.nextSteps.some((step) => /fixture|first-route|validate:route/i.test(step)), "setup doctor next steps must stay real-route only");

  const tempFlag = runDoctor({
    SPACEGUARD_ENABLE_TEMP_EXECUTOR: "1"
  });
  assert.strictEqual(tempFlag.scopedExecutors.validationStatus, "one-route-ready", "known temp cleanup should remain launchable as a real route");
  assert(!Object.prototype.hasOwnProperty.call(tempFlag.scopedExecutors, "firstRouteProof"), "known temp setup should not expose prior proof ceremony");

  const noFlag = runDoctor();
  assert.strictEqual(noFlag.scopedExecutors.validationStatus, "readonly-ready", "no flags should remain read-only ready");
  assert.strictEqual(noFlag.scopedExecutors.safeToLaunchWriteMode, false, "read-only setup should not claim write launch readiness");

  console.log("setup doctor ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
