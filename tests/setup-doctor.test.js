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

  const proofPath = writeAcceptedFirstRouteCompletion();
  const blockedOneFlag = runDoctor({
    SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR: "1"
  });
  assert.strictEqual(blockedOneFlag.scopedExecutors.validationStatus, "first-route-proof-required", "real-data route should block until first-route completion proof is accepted");
  assert.strictEqual(blockedOneFlag.scopedExecutors.safeToLaunchWriteMode, false, "missing first-route proof should prevent write-mode launch");
  assert.strictEqual(blockedOneFlag.realWorkflow.ready, false, "missing first-route proof should block the compact workflow");
  assert(blockedOneFlag.nextSteps.some((step) => step.includes("SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK")), "setup doctor should point to the first-route completion proof env var");

  const oneFlag = runDoctor({
    SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR: "1",
    SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK: proofPath
  });
  assert.strictEqual(oneFlag.scopedExecutors.validationStatus, "one-route-ready", "one flag should be ready for one-route validation");
  assert.strictEqual(oneFlag.scopedExecutors.safeToLaunchWriteMode, true, "one flag should be safe to launch for one-route validation");
  assert.strictEqual(oneFlag.scopedExecutors.firstRouteProof.status, "accepted", "setup doctor should expose the accepted first-route proof gate");
  assert.strictEqual(oneFlag.scopedExecutors.selectedFlag, "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR", "setup doctor should identify the selected route flag");
  assert.strictEqual(oneFlag.scopedExecutors.selectedRoute.routeInput, "npm-cache", "setup doctor should map the selected flag to its route alias");
  assert(oneFlag.commands.routeValidation.includes("npm run validate:route -- --route npm-cache"), "setup doctor should expose route validation command");
  assert(oneFlag.commands.workflowProofValidation.includes("npm run validate:workflow-proof -- --file"), "setup doctor should expose workflow proof validation command");
  assert(oneFlag.commands.routeCompletionValidation.includes("npm run validate:route-completion -- --preflight"), "setup doctor should expose route completion validation command");
  assert.strictEqual(oneFlag.realWorkflow.routeInput, "npm-cache", "setup doctor should expose the selected route workflow alias");
  assert.strictEqual(oneFlag.realWorkflow.ready, true, "one-route setup should make the compact real workflow ready");
  assert.deepStrictEqual(
    oneFlag.realWorkflow.steps.map((step) => step.id),
    ["fixture-openai-smoke", "openai-smoke", "route-setup", "route-validation", "native-scan", "arm-consent", "execute-route", "post-run-rescan", "proof-import", "workflow-proof-check", "route-completion-check", "next-route"],
    "setup doctor should emit the compact real cleanup workflow in order"
  );
  assert(oneFlag.realWorkflow.steps.find((step) => step.id === "proof-import").detail.includes("Selected route proof import"), "compact workflow should include proof import before next route");
  assert(oneFlag.realWorkflow.steps.find((step) => step.id === "workflow-proof-check").command.includes("validate:workflow-proof"), "compact workflow should validate the exported workflow proof before next route");
  assert(oneFlag.realWorkflow.steps.find((step) => step.id === "route-completion-check").command.includes("validate:route-completion"), "compact workflow should validate selected-route completion before next route");

  const pnpmFlag = runDoctor({
    SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR: "1",
    SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK: proofPath
  });
  assert.strictEqual(pnpmFlag.scopedExecutors.selectedFlag, "SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR", "setup doctor should identify pnpm as the selected route flag");
  assert.strictEqual(pnpmFlag.scopedExecutors.selectedRoute.routeInput, "pnpm-store", "setup doctor should map pnpm flag to pnpm-store route alias");
  assert(pnpmFlag.commands.routeSetup.includes("npm run setup:route -- --route pnpm-store"), "setup doctor should expose selected pnpm route setup command");
  assert(pnpmFlag.commands.routeValidation.includes("npm run validate:route -- --route pnpm-store"), "setup doctor should expose selected pnpm validation command");
  assert(pnpmFlag.commands.openAiFixtureSmoke.includes("npm run openai:smoke:fixture -- --route pnpm-store"), "setup doctor should expose selected pnpm fixture smoke command");
  assert(pnpmFlag.commands.openAiSmoke.includes("npm run openai:smoke -- --route pnpm-store"), "setup doctor should expose selected pnpm OpenAI smoke command");
  assert(pnpmFlag.commands.routeCompletionValidation.includes("validate:route-completion"), "setup doctor should expose selected pnpm completion validation command");
  assert(pnpmFlag.openAi.fixtureSmokeCommand.includes("--route pnpm-store"), "setup doctor OpenAI summary should be route-specific");
  assert(pnpmFlag.openAi.fixtureSmokeValidates.includes("live-route-contract"), "setup doctor should document live route contract validation in fixture smoke");
  assert(pnpmFlag.realWorkflow.steps.find((step) => step.id === "fixture-openai-smoke").detail.includes("live route contract"), "real workflow should explain fixture smoke route-contract proof");
  assert(pnpmFlag.nextSteps.some((step) => step.includes("pnpm-store")), "setup doctor next steps should name the selected route alias");
  assert(pnpmFlag.nextSteps.some((step) => step.includes("live route contract")), "setup doctor next steps should mention route contract validation");

  const tempFlag = runDoctor({
    SPACEGUARD_ENABLE_TEMP_EXECUTOR: "1"
  });
  assert.strictEqual(tempFlag.scopedExecutors.validationStatus, "one-route-ready", "temp fixture should remain launchable as the first proof route");
  assert.strictEqual(tempFlag.scopedExecutors.firstRouteProof.required, false, "temp fixture should not require prior first-route proof");

  const noFlag = runDoctor();
  assert.strictEqual(noFlag.scopedExecutors.validationStatus, "readonly-ready", "no flags should remain read-only ready");
  assert.strictEqual(noFlag.scopedExecutors.safeToLaunchWriteMode, false, "read-only setup should not claim write launch readiness");

  console.log("setup doctor ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
