const assert = require("assert");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const modulePath = path.join(root, "src", "route-boundary-contracts.mjs");

(async () => {
  const contracts = await import(pathToFileURL(modulePath).href);

  const npmBoundary = contracts.getRouteNativeBoundary("bounded-npm-cache-delete");
  assert.strictEqual(npmBoundary.adapterFunction, "runNativeNpmCacheExecutor", "shared registry should expose npm native adapter");
  assert.strictEqual(npmBoundary.rustFunction, "execute_npm_cache_cleanup", "shared registry should expose npm Rust branch");
  assert(npmBoundary.deletePolicy.some((row) => row.includes("content-v2")), "shared registry should expose npm delete policy");

  const pnpmBoundary = contracts.getRouteNativeBoundary("bounded-pnpm-store-delete");
  assert.strictEqual(pnpmBoundary.adapterFunction, "runNativePnpmStoreExecutor", "shared registry should expose pnpm native adapter");
  assert.strictEqual(pnpmBoundary.rustFunction, "execute_pnpm_store_cleanup", "shared registry should expose pnpm Rust branch");
  assert(pnpmBoundary.deletePolicy.some((row) => row.includes("versioned")), "shared registry should expose pnpm delete policy");

  pnpmBoundary.targetRejects.push("mutated-test-row");
  assert.strictEqual(
    contracts.getRouteNativeBoundary("bounded-pnpm-store-delete").targetRejects.includes("mutated-test-row"),
    false,
    "shared registry should return cloned boundary rows"
  );

  const fallback = contracts.buildRouteNativeBoundary({
    route: "unknown-test-route",
    requestMode: "execute-test-route"
  });
  assert.strictEqual(fallback.tauriCommand, "execute_cleanup_plan", "fallback boundary should still name the native executor command");
  assert(fallback.requestShape.some((row) => row.includes("requestMode=execute-test-route")), "fallback boundary should include the selected request mode");
  assert(fallback.targetRejects.includes("custom roots"), "fallback boundary should keep generic target rejects");

  console.log("route boundary contracts ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
