const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "run-private-demo-readiness.mjs");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

(async () => {
  assert(fs.existsSync(script), "private demo readiness verifier should exist");
  assert(
    packageJson.scripts["demo:private-readiness"]?.includes("run-private-demo-readiness.mjs"),
    "package.json should expose the private demo readiness verifier"
  );

  const readiness = await import(pathToFileURL(script).href);
  const summary = readiness.buildPrivateDemoReadinessSummary({
    rootDir: root,
    generatedAt: "2026-06-08T12:00:00.000Z"
  });

  assert.strictEqual(summary.schemaVersion, "spaceguard-private-demo-readiness/v1", "readiness verifier should expose a stable schema");
  assert.strictEqual(summary.status, "ready", "private compiled demo should be ready to attempt");
  assert.strictEqual(summary.canAttemptPrivateWindowsDemo, true, "readiness verifier should clear the private Windows demo attempt");
  assert.strictEqual(summary.target, "private-windows-demo", "readiness verifier should target the private Windows demo milestone");
  assert.strictEqual(summary.build.platformRequired, "windows", "compiled demo attempt should be Windows-specific");
  assert.strictEqual(summary.build.tauriProductName, "SpaceGuard", "readiness verifier should preserve the Tauri product name");
  assert.strictEqual(summary.routes.firstRoute, "temp-fixture", "first route should remain the seeded fixture route");
  assert.strictEqual(summary.routes.selectedRoute, "npm-cache", "first bounded real-data route should be npm-cache");
  assert.deepStrictEqual(summary.blockers, [], "readiness verifier should have no blockers");
  assert(summary.counts.requiredChecks >= 14, "readiness verifier should cover build, route, proof, OpenAI, and runner checks");
  assert.strictEqual(summary.counts.blockers, 0, "readiness verifier should count zero blockers");
  assertReadyCheck(summary, "vite-build-script");
  assertReadyCheck(summary, "tauri-native-build-script");
  assertReadyCheck(summary, "tauri-bundle-active");
  assertReadyCheck(summary, "first-route-windows-runner");
  assertReadyCheck(summary, "selected-route-windows-runner");
  assertReadyCheck(summary, "exact-proof-import-artifact");
  assertReadyCheck(summary, "openai-fixture-smoke");
  assertReadyCheck(summary, "setup-doctor");
  assertReadyCheck(summary, "route-setup-validation");
  assertReadyCheck(summary, "workflow-proof-validation");
  assertReadyCheck(summary, "completion-verifiers");
  assertReadyCheck(summary, "runner-direct-delete-free");
  assert(summary.nextCommands.includes("npm test"), "readiness verifier should require tests before the compiled demo");
  assert(summary.nextCommands.includes("npm run build"), "readiness verifier should require web build before native build");
  assert(summary.nextCommands.includes("npm run native:build"), "readiness verifier should include the native build command");
  assert(
    summary.nextCommands.some((command) => command.includes("proof:first-route:windows")),
    "readiness verifier should include the first-route Windows proof command"
  );
  assert(
    summary.nextCommands.some((command) => command.includes("proof:route:windows") && command.includes("npm-cache")),
    "readiness verifier should include the npm-cache selected-route proof command"
  );

  const linuxMissingPkgConfig = readiness.buildPrivateDemoReadinessSummary({
    rootDir: root,
    generatedAt: "2026-06-08T12:00:00.000Z",
    hostPlatform: "linux",
    commandAvailability: { "pkg-config": false }
  });
  assert.strictEqual(linuxMissingPkgConfig.host.currentPlatform, "linux", "readiness verifier should expose the local host platform");
  assert.strictEqual(linuxMissingPkgConfig.host.nativeBuildStatus, "host-prereqs-missing", "Linux native build status should explain missing host prerequisites");
  assert(
    linuxMissingPkgConfig.host.warnings.some((warning) => warning.includes("pkg-config")),
    "Linux native build warning should mention pkg-config"
  );
  assert.strictEqual(
    linuxMissingPkgConfig.canAttemptPrivateWindowsDemo,
    true,
    "missing Linux packaging deps should not block the Windows-target private demo contract"
  );

  console.log("private demo readiness ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

function assertReadyCheck(summary, id) {
  const row = summary.checks.find((check) => check.id === id);
  assert(row, `${id} check should be present`);
  assert.strictEqual(row.passed, true, `${id} check should pass: ${row.detail || "no detail"}`);
}
