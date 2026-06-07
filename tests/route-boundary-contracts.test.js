const assert = require("assert");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const modulePath = path.join(root, "src", "route-boundary-contracts.mjs");
const setupRoutePath = path.join(root, "scripts", "run-setup-route.mjs");

const expectedRouteBranches = {
  "known-temp-delete": ["runNativeTempCleanupExecutor", "execute_first_safe_temp_cleanup"],
  "item-review-recycle-bin": ["runNativeDownloadsCleanupExecutor", "execute_downloads_review_cleanup"],
  "item-review-large-files": ["runNativeLargeFileArchiveExecutor", "execute_large_file_archive_cleanup"],
  "item-review-project-cache": ["runNativeProjectDependencyExecutor", "execute_project_dependency_cleanup"],
  "browser-cache-only": ["runNativeBrowserCacheExecutor", "execute_browser_cache_cleanup"],
  "bounded-cache-delete": ["runNativeGradleCacheExecutor", "execute_gradle_cache_cleanup"],
  "bounded-user-cache-delete": ["runNativeUserCacheExecutor", "execute_user_cache_cleanup"],
  "bounded-android-cache-delete": ["runNativeAndroidCacheExecutor", "execute_android_cache_cleanup"],
  "launcher-cache-cleanup": ["runNativeShaderCacheExecutor", "execute_shader_cache_cleanup"],
  "bounded-pip-cache-delete": ["runNativePipCacheExecutor", "execute_pip_cache_cleanup"],
  "tool-native-docker-build-cache-prune": ["runNativeDockerBuildCacheExecutor", "execute_docker_build_cache_cleanup"],
  "bounded-npm-cache-delete": ["runNativeNpmCacheExecutor", "execute_npm_cache_cleanup"],
  "bounded-pnpm-store-delete": ["runNativePnpmStoreExecutor", "execute_pnpm_store_cleanup"],
  "shell-recycle-bin": ["runNativeRecycleBinExecutor", "execute_recycle_bin_cleanup"]
};

(async () => {
  const contracts = await import(pathToFileURL(modulePath).href);
  const setupRoute = await import(pathToFileURL(setupRoutePath).href);

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

  for (const spec of setupRoute.routeSpecs) {
    const [adapterFunction, rustFunction] = expectedRouteBranches[spec.route] || [];
    assert(adapterFunction, `test should know expected adapter for ${spec.route}`);
    const boundary = contracts.buildRouteNativeBoundary(spec);
    assert.strictEqual(boundary.adapterFunction, adapterFunction, `${spec.route} should expose the native adapter`);
    assert.strictEqual(boundary.rustFunction, rustFunction, `${spec.route} should expose the Rust executor branch`);
    assert(boundary.requestShape.some((row) => row.includes(`requestMode=${spec.requestMode}`)), `${spec.route} should expose the request mode`);
    assert(boundary.requestShape.some((row) => row.includes(`route=${spec.route}`)), `${spec.route} should expose the bounded route`);
    assert(boundary.targetAllowlist.length > 0, `${spec.route} should expose target allowlist`);
    assert(boundary.targetRejects.length > 0, `${spec.route} should expose target rejects`);
    assert(boundary.deletePolicy.length > 0, `${spec.route} should expose delete policy`);
  }

  console.log("route boundary contracts ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
