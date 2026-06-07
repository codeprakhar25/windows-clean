const assert = require("assert");
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
  assert(blocked.commands.enablePowerShell.includes("SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR"), "validation packet should print the PowerShell flag command");
  assert(blocked.preRunChecklist.some((row) => row.id === "single-scoped-flag" && row.status === "blocked"), "disabled route should block the single-flag preflight");
  assert(blocked.postRunProofChecklist.some((row) => row.id === "native-volume-proof" && row.status === "blocked"), "disabled route should block native volume proof capture");
  assert(blocked.captureArtifacts.includes("before-native-scan-report"), "validation packet should require before-scan evidence");
  assert(blocked.captureArtifacts.includes("post-run-rescan-comparison"), "validation packet should require post-run rescan proof");
  assert(blocked.captureArtifacts.includes("selected-route-proof-packet"), "validation packet should require selected-route proof packet export");
  assert(blocked.captureArtifacts.includes("selected-route-proof-import"), "validation packet should require selected-route proof import evidence");
  assert(blocked.captureArtifacts.includes("native-write-volume-proof"), "validation packet should require native volume proof evidence");
  assert(blocked.forbiddenActions.includes("enable-second-executor-flag"), "validation packet should forbid multi-route validation");

  const ready = validation.buildWindowsValidationPacket({
    routeInput: "npm-cache",
    env: cleanEnv({ SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR: "1" })
  });
  assert.strictEqual(ready.status, "ready", "one enabled route should be ready for Windows validation");
  assert.strictEqual(ready.enabledFlags.length, 1, "ready validation should include one enabled flag");
  assert(ready.preRunChecklist.every((row) => row.status !== "blocked"), "ready validation should not contain blocked preflight rows");
  assert(ready.postRunProofChecklist.every((row) => row.status !== "blocked"), "ready validation should not contain blocked post-run proof rows");
  assert(ready.postRunProofChecklist.some((row) => row.id === "selected-route-proof-packet"), "ready validation should require selected-route proof packet export");
  assert(ready.postRunProofChecklist.some((row) => row.id === "selected-route-proof-import"), "ready validation should require selected-route proof import");
  assert(ready.operatorSteps.some((step) => step.includes("Run real scan")), "ready validation should include native scan workflow");
  assert(ready.operatorSteps.some((step) => step.includes("post-run rescan")), "ready validation should include post-run proof workflow");
  assert(ready.operatorSteps.some((step) => step.includes("native volume proof")), "ready validation should include native volume proof capture");
  assert(ready.operatorSteps.some((step) => step.includes("import it into Validation evidence")), "ready validation should include route proof import workflow");

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
