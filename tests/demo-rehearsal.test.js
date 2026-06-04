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
