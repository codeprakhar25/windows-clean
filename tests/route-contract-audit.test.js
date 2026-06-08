const assert = require("assert");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "run-route-contract-audit.mjs");

(async () => {
  const audit = await import(pathToFileURL(script).href);

  const report = audit.buildRouteContractAuditReport({
    env: { SPACEGUARD_ROUTE_SETUP_IGNORE_DOTENV: "1" },
    generatedAt: "2026-06-07T00:00:00.000Z"
  });
  assert.strictEqual(report.schemaVersion, "spaceguard-route-contract-audit/v1", "route contract audit should expose a stable schema");
  assert.strictEqual(report.status, "passed", "route contract audit should pass when every setup route has a contract");
  assert(report.counts.routes >= 14, "route contract audit should cover every setup route");
  assert.strictEqual(report.counts.failed, 0, "route contract audit should not contain failed rows");

  const npmRow = report.rows.find((row) => row.route === "bounded-npm-cache-delete");
  assert(npmRow, "route contract audit should include npm cache route");
  assert.strictEqual(npmRow.status, "passed", "npm route contract should pass");
  assert.strictEqual(npmRow.adapterFunction, "runNativeNpmCacheExecutor", "npm route contract should expose the native adapter");
  assert.strictEqual(npmRow.validationStatus, "first-route-proof-required", "npm route contract should preserve the first-route proof gate");
  assert.strictEqual(npmRow.firstRouteProofRequired, true, "npm route contract should require first-route completion proof before live validation");
  assert.strictEqual(npmRow.openAiTaskStatus, "ready", "npm route contract should prove OpenAI fixture task readiness");
  assert.strictEqual(npmRow.validationRequestMode, "execute-npm-cache", "npm route contract should prove validation packet request mode");

  const recycleRow = report.rows.find((row) => row.route === "shell-recycle-bin");
  assert(recycleRow, "route contract audit should include Recycle Bin route");
  assert.strictEqual(recycleRow.adapterFunction, "runNativeRecycleBinExecutor", "Recycle Bin route contract should expose the native adapter");
  assert.strictEqual(recycleRow.openAiTaskStatus, "needs-user-review", "Recycle Bin route contract should preserve permanent-removal review state");
  assert.strictEqual(recycleRow.canExecuteWithoutAppEvidence, false, "route contract audit should prove app evidence remains required");

  assert(report.captureArtifacts.includes("route-contract-audit-report"), "route contract audit should name its capture artifact");
  assert(report.nextSteps.some((step) => step.includes("Windows")), "route contract audit should point to Windows validation as next proof");
  assert(report.nextSteps.some((step) => step.includes("selected-route proof packet export")), "route contract audit should require selected-route proof packet export before import");

  console.log("route contract audit ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
