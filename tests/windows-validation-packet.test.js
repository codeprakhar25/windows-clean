const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "run-windows-validation-packet.mjs");

function cleanEnv(extra = {}) {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    SystemRoot: process.env.SystemRoot,
    SPACEGUARD_ROUTE_SETUP_IGNORE_DOTENV: "1",
    ...extra
  };
}

function writeAcceptedFirstRouteCompletion() {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "spaceguard-validation-first-route-")), "first-route-completion-check.json");
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

(async () => {
  const validation = await import(pathToFileURL(script).href);

  const blocked = validation.buildWindowsValidationPacket({
    routeInput: "npm-cache",
    env: cleanEnv()
  });
  assert.strictEqual(blocked.schemaVersion, "spaceguard-windows-validation-packet/v1", "validation packet should emit a stable schema");
  assert.strictEqual(blocked.status, "flag-disabled", "route validation should block until the scoped route flag is enabled");
  assert.strictEqual(blocked.route, "bounded-npm-cache-delete", "npm-cache alias should map to the native npm route");
  assert.strictEqual(blocked.selected.envVar, "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR", "validation packet should expose the route feature flag");
  assert.strictEqual(blocked.selected.requestMode, "execute-npm-cache", "validation packet should expose the native request mode");
  assert.strictEqual(blocked.selected.panelId, "npm-cache-executor-panel", "validation packet should expose the app panel id");
  assert(blocked.commands.setupRoute.includes("npm run setup:route -- --route npm-cache"), "validation packet should point to setup:route");
  assert(blocked.commands.openAiFixtureSmoke.includes("npm run openai:smoke:fixture -- --route npm-cache"), "validation packet should point to route-specific fixture smoke");
  assert(blocked.commands.openAiSmoke.includes("npm run openai:smoke -- --route npm-cache"), "validation packet should point to route-specific OpenAI smoke");
  assert(blocked.commands.workflowProofValidation.includes("npm run validate:workflow-proof -- --file"), "validation packet should point to workflow proof verifier");
  assert(blocked.commands.routeCompletionValidation.includes("npm run validate:route-completion -- --preflight"), "validation packet should point to route completion verifier");
  assert(blocked.commands.enablePowerShell.includes("SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR"), "validation packet should print the PowerShell flag command");
  assert(blocked.preRunChecklist.some((row) => row.id === "single-scoped-flag" && row.status === "blocked"), "disabled route should block the single-flag preflight");
  assert(blocked.postRunProofChecklist.some((row) => row.id === "native-volume-proof" && row.status === "blocked"), "disabled route should block native volume proof capture");
  assert(blocked.captureArtifacts.includes("before-native-scan-report"), "validation packet should require before-scan evidence");
  assert(blocked.captureArtifacts.includes("post-run-rescan-comparison"), "validation packet should require post-run rescan proof");
  assert(blocked.captureArtifacts.includes("selected-route-proof-packet"), "validation packet should require selected-route proof packet export");
  assert(blocked.captureArtifacts.includes("selected-route-proof-import"), "validation packet should require selected-route proof import evidence");
  assert(blocked.captureArtifacts.includes("real-workflow-proof"), "validation packet should require real workflow proof export");
  assert(blocked.captureArtifacts.includes("workflow-proof-check-output"), "validation packet should require workflow proof verifier output");
  assert(blocked.captureArtifacts.includes("selected-route-completion-check-output"), "validation packet should require selected-route completion verifier output");
  assert(blocked.captureArtifacts.includes("live-validation-manifest"), "validation packet should require the live route manifest");
  assert(blocked.captureArtifacts.includes("native-write-volume-proof"), "validation packet should require native volume proof evidence");
  assert(blocked.forbiddenActions.includes("enable-second-executor-flag"), "validation packet should forbid multi-route validation");
  assert.strictEqual(blocked.liveValidationManifest.schemaVersion, "spaceguard-live-route-validation/v1", "live manifest should expose a stable schema");
  assert.strictEqual(blocked.liveValidationManifest.route, "bounded-npm-cache-delete", "live manifest should identify the selected route");
  assert.strictEqual(blocked.liveValidationManifest.contract.requestMode, "execute-npm-cache", "live manifest should expose the native request mode");
  assert.strictEqual(blocked.liveValidationManifest.contract.panelId, "npm-cache-executor-panel", "live manifest should expose the UI executor panel");
  assert(blocked.liveValidationManifest.contract.routeCompletionCommand.includes("validate:route-completion"), "live manifest should expose the route completion verifier command");
  assert.strictEqual(blocked.liveValidationManifest.runtime.routeFlagReady, false, "disabled manifest should not be route-flag ready");
  assert.strictEqual(blocked.liveValidationManifest.runtime.canExecuteWithoutAppEvidence, false, "manifest must not claim direct execution outside app evidence");
  assert(blocked.liveValidationManifest.nativeBoundary.tauriCommand === "execute_cleanup_plan", "live manifest should name the native Tauri executor command");
  assert(blocked.liveValidationManifest.nativeBoundary.adapterFunction === "runNativeNpmCacheExecutor", "live manifest should name the npm adapter");
  assert(blocked.liveValidationManifest.nativeBoundary.rustFunction === "execute_npm_cache_cleanup", "live manifest should name the Rust executor branch");
  assert(blocked.liveValidationManifest.nativeBoundary.targetAllowlist.some((row) => row.includes("npm-cache\\_cacache")), "live manifest should describe the npm target allowlist");
  assert(blocked.liveValidationManifest.nativeBoundary.deletePolicy.some((row) => row.includes("content-v2")), "live manifest should describe npm content deletion scope");
  assert(blocked.liveValidationManifest.nativeBoundary.deletePolicy.some((row) => row.includes("lock")), "live manifest should describe lock-file skips");

  const proofPath = writeAcceptedFirstRouteCompletion();
  const blockedWithoutFirstProof = validation.buildWindowsValidationPacket({
    routeInput: "npm-cache",
    env: cleanEnv({ SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR: "1" })
  });
  assert.strictEqual(blockedWithoutFirstProof.status, "first-route-proof-required", "non-fixture route validation should block without accepted first-route proof");
  assert.strictEqual(blockedWithoutFirstProof.liveValidationManifest.runtime.routeFlagReady, false, "missing first proof should keep live validation route flag blocked");
  assert.strictEqual(blockedWithoutFirstProof.liveValidationManifest.runtime.disabledReason.includes("first-route completion"), true, "live manifest should explain first-route proof blocker");

  const ready = validation.buildWindowsValidationPacket({
    routeInput: "npm-cache",
    env: cleanEnv({
      SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR: "1",
      SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK: proofPath
    })
  });
  assert.strictEqual(ready.status, "ready", "one enabled route should be ready for Windows validation");
  assert.strictEqual(ready.enabledFlags.length, 1, "ready validation should include one enabled flag");
  assert(ready.preRunChecklist.every((row) => row.status !== "blocked"), "ready validation should not contain blocked preflight rows");
  assert(ready.postRunProofChecklist.every((row) => row.status !== "blocked"), "ready validation should not contain blocked post-run proof rows");
  assert(ready.postRunProofChecklist.some((row) => row.id === "selected-route-proof-packet"), "ready validation should require selected-route proof packet export");
  assert(ready.postRunProofChecklist.some((row) => row.id === "selected-route-proof-import"), "ready validation should require selected-route proof import");
  assert(ready.postRunProofChecklist.some((row) => row.id === "real-workflow-proof-check"), "ready validation should require workflow proof verifier output");
  assert(ready.postRunProofChecklist.some((row) => row.id === "real-workflow-proof-check" && row.detail.includes("positive recovered bytes")), "workflow proof checklist should require positive recovered bytes");
  assert(ready.postRunProofChecklist.some((row) => row.id === "selected-route-completion-check"), "ready validation should require selected-route completion verifier output");
  assert(ready.operatorSteps.some((step) => step.includes("Run real scan")), "ready validation should include native scan workflow");
  assert(ready.operatorSteps.some((step) => step.includes("post-run rescan")), "ready validation should include post-run proof workflow");
  assert(ready.operatorSteps.some((step) => step.includes("native volume proof")), "ready validation should include native volume proof capture");
  assert(ready.operatorSteps.some((step) => step.includes("import it into Validation evidence")), "ready validation should include route proof import workflow");
  assert(ready.operatorSteps.some((step) => step.includes("validate:workflow-proof")), "ready validation should include workflow proof verifier workflow");
  assert(ready.operatorSteps.some((step) => step.includes("validate:route-completion")), "ready validation should include route completion verifier workflow");
  assert(!ready.operatorSteps.some((step) => step.includes("Run Run")), "operator steps should not duplicate command verbs");
  assert(!ready.postRunProofChecklist.some((row) => row.detail.includes("After Run ")), "post-run proof copy should not duplicate command verbs");
  assert.strictEqual(ready.liveValidationManifest.runtime.routeFlagReady, true, "ready manifest should mark the route flag ready");
  assert.strictEqual(ready.liveValidationManifest.runtime.canAttemptWindowsValidation, true, "ready manifest should allow one-route Windows validation");
  assert.strictEqual(ready.liveValidationManifest.runtime.canExecuteWithoutAppEvidence, false, "ready manifest should still require app evidence before execution");
  assert(ready.liveValidationManifest.requiredAppEvidence.includes("current-native-scan-fingerprint"), "ready manifest should require current native scan evidence");
  assert(ready.liveValidationManifest.requiredAppEvidence.includes("current-plan-consent-receipt"), "ready manifest should require current consent evidence");
  assert(ready.liveValidationManifest.requiredAppEvidence.includes("native-scanned-target"), "ready manifest should require concrete target evidence");
  assert(ready.liveValidationManifest.requiredPostRunProof.includes("workflow-proof-check-output"), "ready manifest should require workflow proof verifier output after execution");
  assert(ready.liveValidationManifest.requiredPostRunProof.includes("selected-route-completion-check-output"), "ready manifest should require route completion verifier output after execution");

  const pnpmBlocked = validation.buildWindowsValidationPacket({
    routeInput: "pnpm-store",
    env: cleanEnv()
  });
  assert.strictEqual(pnpmBlocked.route, "bounded-pnpm-store-delete", "pnpm-store alias should map to the native pnpm route");
  assert.strictEqual(pnpmBlocked.selected.envVar, "SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR", "pnpm validation packet should expose the route feature flag");
  assert.strictEqual(pnpmBlocked.selected.requestMode, "execute-pnpm-store", "pnpm validation packet should expose the native request mode");
  assert.strictEqual(pnpmBlocked.liveValidationManifest.nativeBoundary.adapterFunction, "runNativePnpmStoreExecutor", "pnpm live manifest should name the pnpm adapter");
  assert.strictEqual(pnpmBlocked.liveValidationManifest.nativeBoundary.rustFunction, "execute_pnpm_store_cleanup", "pnpm live manifest should name the Rust executor branch");
  assert(pnpmBlocked.liveValidationManifest.nativeBoundary.targetAllowlist.some((row) => row.includes("pnpm\\store")), "pnpm live manifest should describe the pnpm store allowlist");
  assert(pnpmBlocked.liveValidationManifest.nativeBoundary.targetRejects.some((row) => row.includes("node_modules")), "pnpm live manifest should describe pnpm target rejects");
  assert(pnpmBlocked.liveValidationManifest.nativeBoundary.deletePolicy.some((row) => row.includes("versioned")), "pnpm live manifest should describe versioned store deletion scope");

  const multiple = validation.buildWindowsValidationPacket({
    routeInput: "npm-cache",
    env: cleanEnv({
      SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR: "1",
      SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR: "1"
    })
  });
  assert.strictEqual(multiple.status, "multiple-flags", "validation packet should block when multiple scoped flags are enabled");
  assert.strictEqual(multiple.conflictingFlags.length, 1, "validation packet should list the conflicting flag");
  assert(multiple.nextSteps.some((step) => step.includes("Turn off all but")), "multi-flag validation should instruct narrowing");

  console.log("windows validation packet ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
