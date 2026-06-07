const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "run-setup-route.mjs");

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
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "spaceguard-first-route-gate-")), "first-route-completion-check.json");
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

function runPacket(args = [], env = {}) {
  if (args.includes("--list")) return routeSetup.buildRouteListPacket({ env: cleanEnv(env) });
  const routeIndex = args.indexOf("--route");
  const routeInput = routeIndex >= 0 ? args[routeIndex + 1] : "";
  return routeSetup.buildPacket({ routeInput, env: cleanEnv(env) });
}

let routeSetup;

(async () => {
  routeSetup = await import(pathToFileURL(script).href);

  const disabledPacket = runPacket(["--route", "npm-cache"]);
  assert.strictEqual(disabledPacket.schemaVersion, "spaceguard-route-setup-packet/v1", "route setup should emit a stable schema");
  assert.strictEqual(disabledPacket.status, "flag-disabled", "disabled npm route should ask for its feature flag");
  assert.strictEqual(disabledPacket.route, "bounded-npm-cache-delete", "npm-cache alias should map to the native npm route");
  assert.strictEqual(disabledPacket.selected.envVar, "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR", "npm route should expose its feature flag");
  assert.strictEqual(disabledPacket.selected.requestMode, "execute-npm-cache", "npm route should expose its native request mode");
  assert.strictEqual(disabledPacket.selected.panelId, "npm-cache-executor-panel", "npm route should expose its panel id");
  assert(disabledPacket.commands.enablePowerShell.includes("SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR"), "route setup should print the PowerShell enable command");
  assert(disabledPacket.commands.fixtureOpenAiSmoke.includes("npm run openai:smoke:fixture -- --route npm-cache"), "route setup should print route-specific fixture smoke command");
  assert(disabledPacket.commands.openAiSmoke.includes("npm run openai:smoke -- --route npm-cache"), "route setup should print route-specific OpenAI smoke command");

  const proofPath = writeAcceptedFirstRouteCompletion();
  const blockedWithoutFirstProof = runPacket(["--route", "npm-cache"], { SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR: "1" });
  assert.strictEqual(blockedWithoutFirstProof.status, "first-route-proof-required", "enabled real-data route should block until first-route proof is accepted");
  assert.strictEqual(blockedWithoutFirstProof.firstRouteProof.required, true, "real-data route should require first-route proof");
  assert.strictEqual(blockedWithoutFirstProof.firstRouteProof.status, "missing", "missing first-route proof should be surfaced");
  assert(blockedWithoutFirstProof.nextSteps.some((step) => step.includes("SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK")), "blocked real-data route should tell the operator how to provide first-route proof");

  const readyPacket = runPacket(["--route", "npm-cache"], {
    SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR: "1",
    SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK: proofPath
  });
  assert.strictEqual(readyPacket.status, "ready", "enabled npm route should be ready for native dev launch");
  assert.strictEqual(readyPacket.enabledFlags.length, 1, "ready packet should record the single enabled flag");
  assert.strictEqual(readyPacket.firstRouteProof.status, "accepted", "ready real-data route should expose accepted first-route proof");
  assert(readyPacket.nextSteps.some((step) => step.includes("npm run native:dev")), "ready packet should route to native dev launch");

  const tempReadyPacket = runPacket(["--route", "temp-fixture"], { SPACEGUARD_ENABLE_TEMP_EXECUTOR: "1" });
  assert.strictEqual(tempReadyPacket.status, "ready", "temp fixture route should remain the bootstrap proof route");
  assert.strictEqual(tempReadyPacket.firstRouteProof.required, false, "temp fixture route should not require prior first-route proof");

  const multiplePacket = runPacket(["--route", "npm-cache"], {
    SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR: "1",
    SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR: "1"
  });
  assert.strictEqual(multiplePacket.status, "multiple-flags", "multiple enabled flags should block route setup");
  assert.strictEqual(multiplePacket.enabledFlags.length, 2, "multiple flag packet should list both enabled flags");
  assert(multiplePacket.nextSteps.some((step) => step.includes("Turn off all but")), "multiple flag packet should tell the operator to narrow scope");

  const listedRoutes = runPacket(["--list"]);
  assert.strictEqual(listedRoutes.status, "route-list", "route list should emit route-list status");
  assert(listedRoutes.routes.some((route) => route.aliases.includes("npm-cache")), "route list should include the npm-cache alias");
  assert(listedRoutes.routes.some((route) => route.requestMode === "execute-browser-cache"), "route list should include browser cache request mode");

  console.log("setup route ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
