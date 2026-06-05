const assert = require("assert");

(async () => {
const { buildDemoRehearsalSummary } = await import("../scripts/run-demo-rehearsal.mjs");
const summary = buildDemoRehearsalSummary();

assert.strictEqual(summary.schemaVersion, "spaceguard-demo-run/v1", "demo rehearsal should expose a schema version");
assert.strictEqual(summary.status, "passed", "demo rehearsal should pass");
assert.strictEqual(summary.scanMode, "demo", "demo rehearsal must not use real local data");
assert.strictEqual(summary.runbookStatus, "demo-evidence-ready", "demo rehearsal should complete the no-real-data workflow");
assert.strictEqual(summary.safetyStatus, "dry-run-interlocked", "demo rehearsal should be dry-run interlocked");
assert.strictEqual(summary.launchStatus, "dry-run-launch-ready", "demo rehearsal should be launch-ready");
assert.strictEqual(summary.workOrderStatus, "validation-blocked", "demo rehearsal should keep first-safe work order blocked by missing Windows evidence");
assert.strictEqual(summary.activationGateStatus, "preflight-missing", "demo rehearsal should keep temp activation blocked before native preflight evidence");
assert.strictEqual(summary.activationRehearsalStatus, "rehearsal-ready", "demo rehearsal should synthesize disabled temp activation evidence");
assert.strictEqual(summary.activationRehearsalGateStatus, "feature-flag-disabled", "demo activation rehearsal should stop at disabled temp flag");
assert.strictEqual(summary.realDataRoadmapStatus, "demo-ready", "demo rehearsal should expose the demo-ready launch roadmap state");
assert.strictEqual(summary.realDataRoadmapMilestone, "No-real-data demo proof", "demo roadmap should name the current product milestone");
assert.strictEqual(summary.realRunEnabled, false, "demo rehearsal must not enable real execution");
assert.strictEqual(summary.destructiveCommands, false, "demo rehearsal must not expose destructive commands");
assert(summary.planId.startsWith("plan-"), "demo rehearsal should bind a plan id");
assert(summary.planLockId.startsWith("lock-"), "demo rehearsal should bind a plan-lock id");
assert(summary.ledgerRows > 0, "demo rehearsal should produce simulated ledger rows");
assert.deepStrictEqual(summary.failures, [], "demo rehearsal should have no failed proof checks");

console.log("demo rehearsal ok");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
