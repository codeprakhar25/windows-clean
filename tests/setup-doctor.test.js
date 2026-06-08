const assert = require("assert");
const fs = require("fs");
const os = require("os");
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

  function writeAcceptedFirstRouteCompletion() {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "spaceguard-doctor-first-route-")), "first-route-completion-check.json");
    fs.writeFileSync(file, JSON.stringify({
      schemaVersion: "spaceguard-first-route-completion-check/v1",
      status: "accepted",
      canStartNextRoute: true,
      route: "known-temp-delete",
      counts: {
        reclaimedBytes: 1,
        selectedRouteProofPacketReclaimedBytes: 1
      }
    }, null, 2));
    return file;
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
  assert(!blockedOneFlag.nextSteps.some((step) => step.includes("SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK")), "setup doctor must not point to seeded first-route proof env vars");

  const oneFlag = runDoctor({
    SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR: "1"
  });
  assert.strictEqual(oneFlag.scopedExecutors.validationStatus, "one-route-ready", "one flag should be ready for one-route validation");
  assert.strictEqual(oneFlag.scopedExecutors.safeToLaunchWriteMode, true, "one flag should be safe to launch for one-route validation");
  assert.strictEqual(oneFlag.scopedExecutors.firstRouteProof.status, "not-required", "setup doctor should not expose seeded first-route proof gates");
  assert.strictEqual(oneFlag.scopedExecutors.selectedFlag, "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR", "setup doctor should identify the selected route flag");
  assert.strictEqual(oneFlag.scopedExecutors.selectedRoute.routeInput, "npm-cache", "setup doctor should map the selected flag to its route alias");
  assert(oneFlag.commands.routeValidation.includes("npm run validate:route -- --route npm-cache"), "setup doctor should expose route validation command");
  assert(oneFlag.commands.workflowProofValidation.includes("npm run validate:workflow-proof -- --file"), "setup doctor should expose workflow proof validation command");
  assert(oneFlag.commands.routeCompletionValidation.includes("npm run validate:route-completion -- --preflight"), "setup doctor should expose route completion validation command");
  assert.strictEqual(oneFlag.realWorkflow.routeInput, "npm-cache", "setup doctor should expose the selected route workflow alias");
  assert.strictEqual(oneFlag.realWorkflow.ready, true, "one-route setup should make the compact real workflow ready");
  assert.deepStrictEqual(
    oneFlag.realWorkflow.steps.map((step) => step.id),
    ["openai-smoke", "route-setup", "route-validation", "native-scan", "arm-consent", "execute-route", "post-run-rescan", "proof-export", "proof-import", "workflow-proof-check", "route-completion-check", "next-route"],
    "setup doctor should emit the compact real cleanup workflow in order"
  );
  assert(oneFlag.realWorkflow.steps.find((step) => step.id === "proof-export").detail.includes("spaceguard-selected-route-proof-packet.md"), "compact workflow should export selected-route proof before import");
  assert(oneFlag.realWorkflow.steps.find((step) => step.id === "proof-import").detail.includes("Selected route proof import"), "compact workflow should include proof import before next route");
  assert(oneFlag.realWorkflow.steps.find((step) => step.id === "workflow-proof-check").command.includes("validate:workflow-proof"), "compact workflow should validate the exported workflow proof before next route");
  assert(oneFlag.realWorkflow.steps.find((step) => step.id === "route-completion-check").command.includes("validate:route-completion"), "compact workflow should validate selected-route completion before next route");

  const pnpmFlag = runDoctor({
    SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR: "1"
  });
  assert.strictEqual(pnpmFlag.scopedExecutors.selectedFlag, "SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR", "setup doctor should identify pnpm as the selected route flag");
  assert.strictEqual(pnpmFlag.scopedExecutors.selectedRoute.routeInput, "pnpm-store", "setup doctor should map pnpm flag to pnpm-store route alias");
  assert(pnpmFlag.commands.routeSetup.includes("npm run setup:route -- --route pnpm-store"), "setup doctor should expose selected pnpm route setup command");
  assert(pnpmFlag.commands.routeValidation.includes("npm run validate:route -- --route pnpm-store"), "setup doctor should expose selected pnpm validation command");
  assert(!Object.prototype.hasOwnProperty.call(pnpmFlag.commands, "openAiFixtureSmoke"), "setup doctor must not expose fixture-only smoke commands");
  assert(pnpmFlag.commands.openAiSmoke.includes("npm run openai:smoke -- --route pnpm-store"), "setup doctor should expose selected pnpm OpenAI smoke command");
  assert(pnpmFlag.commands.routeCompletionValidation.includes("validate:route-completion"), "setup doctor should expose selected pnpm completion validation command");
  assert(!Object.prototype.hasOwnProperty.call(pnpmFlag.openAi, "fixtureSmokeCommand"), "setup doctor OpenAI summary must not expose fixture-only smoke commands");
  assert(pnpmFlag.nextSteps.some((step) => step.includes("pnpm-store")), "setup doctor next steps should name the selected route alias");
  assert(!pnpmFlag.nextSteps.some((step) => /fixture|first-route/i.test(step)), "setup doctor next steps must stay real-route only");

  const tempFlag = runDoctor({
    SPACEGUARD_ENABLE_TEMP_EXECUTOR: "1"
  });
  assert.strictEqual(tempFlag.scopedExecutors.validationStatus, "one-route-ready", "known temp cleanup should remain launchable as a real route");
  assert.strictEqual(tempFlag.scopedExecutors.firstRouteProof.required, false, "known temp cleanup should not require prior first-route proof");

  const noFlag = runDoctor();
  assert.strictEqual(noFlag.scopedExecutors.validationStatus, "readonly-ready", "no flags should remain read-only ready");
  assert.strictEqual(noFlag.scopedExecutors.safeToLaunchWriteMode, false, "read-only setup should not claim write launch readiness");

  console.log("setup doctor ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
