const assert = require("assert");

(async () => {
const { buildNativeReadonlyRehearsalSummary } = await import("../scripts/run-native-readonly-rehearsal.mjs");
const summary = buildNativeReadonlyRehearsalSummary();

assert.strictEqual(summary.schemaVersion, "spaceguard-native-readonly-run/v1", "native read-only rehearsal should expose a schema version");
assert.strictEqual(summary.status, "passed", "native read-only rehearsal should pass");
assert.strictEqual(summary.scanMode, "native-readonly", "native read-only rehearsal should use native scan mode");
assert.strictEqual(summary.scanStatus, "native-current", "native scan evidence should be current");
assert.strictEqual(summary.setupStatus, "native-scan-ready", "setup assistant should recognize native scan readiness");
assert.strictEqual(summary.privacyStatus, "native-local-only", "native rehearsal should stay local-only");
assert.strictEqual(summary.safetyStatus, "dry-run-interlocked", "native rehearsal should be dry-run interlocked");
assert.strictEqual(summary.launchStatus, "dry-run-launch-ready", "native rehearsal should be launch-ready for dry-run only");
assert.strictEqual(summary.workOrderStatus, "validation-blocked", "native rehearsal should keep first-safe work order blocked by missing Windows validation evidence");
assert.strictEqual(summary.activationGateStatus, "preflight-missing", "native rehearsal should keep temp activation blocked before write preflight evidence");
assert.strictEqual(summary.realRunEnabled, false, "native rehearsal must not enable real execution");
assert.strictEqual(summary.destructiveCommands, false, "native rehearsal must not expose destructive commands");
assert(summary.planId.startsWith("plan-"), "native rehearsal should bind a plan id");
assert(summary.planLockId.startsWith("lock-"), "native rehearsal should bind a plan-lock id");
assert(summary.measuredBytes > 0, "native rehearsal should include measured bytes");
assert(summary.ledgerRows > 0, "native rehearsal should produce simulated ledger rows");
assert.deepStrictEqual(summary.failures, [], "native rehearsal should have no failed proof checks");

console.log("native read-only rehearsal ok");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
