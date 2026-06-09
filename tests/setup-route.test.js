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
  assert(disabledPacket.commands.armRoute.includes("npm run route:arm -- --route npm-cache"), "route setup should print the route arming command");
  assert(disabledPacket.commands.enablePowerShell.includes("SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR"), "route setup should print the PowerShell enable command");
  assert(!Object.prototype.hasOwnProperty.call(disabledPacket.commands, "fixtureOpenAiSmoke"), "route setup must not print fixture-only smoke commands for the real app");
  assert(disabledPacket.commands.openAiSmoke.includes("npm run openai:smoke -- --route npm-cache"), "route setup should print route-specific OpenAI smoke command");

  const blockedWithoutFirstProof = runPacket(["--route", "npm-cache"], { SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR: "1" });
  assert.strictEqual(blockedWithoutFirstProof.status, "ready", "enabled real-data route should be ready with only the selected route flag");
  assert(!Object.prototype.hasOwnProperty.call(blockedWithoutFirstProof, "firstRouteProof"), "route setup must not expose seeded proof fields");
  assert(!blockedWithoutFirstProof.nextSteps.some((step) => /first-route|fixture|SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK/i.test(step)), "real-data route setup must not point to seeded proof artifacts");

  const readyPacket = runPacket(["--route", "npm-cache"], {
    SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR: "1"
  });
  assert.strictEqual(readyPacket.status, "ready", "enabled npm route should be ready for native dev launch");
  assert.strictEqual(readyPacket.enabledFlags.length, 1, "ready packet should record the single enabled flag");
  assert(readyPacket.nextSteps.some((step) => step.includes("npm run windows:dev -- --route npm-cache")), "ready packet should route to Windows dev launch");

  const tempReadyPacket = runPacket(["--route", "known-temp-delete"], { SPACEGUARD_ENABLE_TEMP_EXECUTOR: "1" });
  assert.strictEqual(tempReadyPacket.status, "ready", "known temp cleanup should remain launchable as a real route");
  assert(!Object.prototype.hasOwnProperty.call(tempReadyPacket, "firstRouteProof"), "known temp setup must not expose prior proof ceremony");

  const multiplePacket = runPacket(["--route", "npm-cache"], {
    SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR: "1",
    SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR: "1"
  });
  assert.strictEqual(multiplePacket.status, "multiple-flags", "multiple enabled flags should block route setup");
  assert.strictEqual(multiplePacket.enabledFlags.length, 2, "multiple flag packet should list both enabled flags");
  assert(multiplePacket.nextSteps.some((step) => step.includes("npm run route:arm -- --route npm-cache")), "multiple flag packet should tell the operator to narrow scope with route arming");

  const listedRoutes = runPacket(["--list"]);
  assert.strictEqual(listedRoutes.status, "route-list", "route list should emit route-list status");
  assert(listedRoutes.routes.some((route) => route.aliases.includes("npm-cache")), "route list should include the npm-cache alias");
  assert(listedRoutes.routes.some((route) => route.requestMode === "execute-browser-cache"), "route list should include browser cache request mode");

  console.log("setup route ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
