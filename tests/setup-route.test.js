const assert = require("assert");
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

  const readyPacket = runPacket(["--route", "npm-cache"], { SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR: "1" });
  assert.strictEqual(readyPacket.status, "ready", "enabled npm route should be ready for native dev launch");
  assert.strictEqual(readyPacket.enabledFlags.length, 1, "ready packet should record the single enabled flag");
  assert(readyPacket.nextSteps.some((step) => step.includes("npm run native:dev")), "ready packet should route to native dev launch");

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
