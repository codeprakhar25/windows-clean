const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "run-native-executor-coverage.mjs");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

(async () => {
  assert(fs.existsSync(script), "native executor coverage verifier should exist");
  assert(
    packageJson.scripts["native:executor-coverage"]?.includes("run-native-executor-coverage.mjs"),
    "package.json should expose native executor coverage verification"
  );

  const coverage = await import(pathToFileURL(script).href);
  const report = coverage.buildNativeExecutorCoverageReport({
    rootDir: root,
    generatedAt: "2026-06-08T13:00:00.000Z"
  });

  assert.strictEqual(report.schemaVersion, "spaceguard-native-executor-coverage/v1", "coverage report should expose a stable schema");
  assert.strictEqual(report.status, "covered", "native executor coverage should pass for the real executor surface");
  assert.strictEqual(report.counts.blocked, 0, "native executor coverage should have no blocked rows");
  assert(report.counts.routes >= 14, "native executor coverage should inspect every setup route");
  assert(report.counts.rustUnitTests >= 15, "native executor coverage should count Rust unit tests");
  assert.deepStrictEqual(report.blockers, [], "native executor coverage should expose no blockers");

  const firstRoute = report.rows.find((row) => row.route === "known-temp-delete");
  assert(firstRoute, "coverage should include the first temp route");
  assert.strictEqual(firstRoute.status, "covered", "first temp route should be covered");
  assert(firstRoute.requiredRustTests.includes("temp_target_gate_rejects_parent_traversal_out_of_env_temp"), "first route should prove temp traversal rejection");

  const npm = report.rows.find((row) => row.route === "bounded-npm-cache-delete");
  assert(npm, "coverage should include npm cache");
  assert.strictEqual(npm.status, "covered", "npm cache route should be covered");
  assert(npm.requiredRustTests.includes("npm_cache_target_gate_accepts_only_current_user_cacache"), "npm route should prove current-user _cacache gating");
  assert(npm.requiredRustTests.includes("npm_cache_deleter_removes_only_old_content_and_tmp_files"), "npm route should prove age-gated deletion");
  assert(npm.deletePolicy.some((line) => line.includes("content-v2")), "npm route should expose delete policy detail");

  const projectDeps = report.rows.find((row) => row.route === "item-review-project-cache");
  assert(projectDeps, "coverage should include project dependency cleanup");
  assert(projectDeps.requiredRustTests.includes("project_dependency_deleter_removes_only_reviewed_node_modules"), "project deps should prove source files survive");

  assert(report.host.warnings.some((warning) => warning.includes("cargo test")), "coverage should explain how to run Rust tests on a prepared host");

  console.log("native executor coverage ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
