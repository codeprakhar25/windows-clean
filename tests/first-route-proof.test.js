const assert = require("assert");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "run-first-route-proof.mjs");

(async () => {
  const proof = await import(pathToFileURL(script).href);

  const packet = proof.buildFirstRouteProofRunPacket({
    routeInput: "temp-fixture",
    env: { SPACEGUARD_ROUTE_SETUP_IGNORE_DOTENV: "1" },
    generatedAt: "2026-06-07T12:00:00.000Z"
  });

  assert.strictEqual(packet.schemaVersion, "spaceguard-first-route-proof-run/v1", "first-route proof packet should expose a stable schema");
  assert.strictEqual(packet.status, "ready-for-windows-proof", "temp fixture proof should be ready with synthesized one-route env");
  assert.strictEqual(packet.route, "known-temp-delete", "temp fixture should bind to the known temp route");
  assert.strictEqual(packet.routeInput, "temp-fixture", "packet should preserve the requested route alias");
  assert.strictEqual(packet.recommendedFirstRoute, true, "temp fixture should be the recommended first proof route");
  assert.strictEqual(packet.counts.routeContractsPassed, 14, "first proof packet should include full route contract audit coverage");
  assert(packet.checks.some((check) => check.id === "route-contract-audit" && check.passed), "first proof packet should prove route contracts pass");
  assert(packet.checks.some((check) => check.id === "single-scoped-flag" && check.passed), "first proof packet should synthesize exactly one scoped flag");
  assert(packet.checks.some((check) => check.id === "positive-recovered-bytes-invariant" && check.passed), "first proof packet should name the positive-byte proof invariant");
  assert(packet.commands.seedFixtures.includes("seed-spaceguard-fixtures.ps1"), "first proof packet should include the fixture seed command");
  assert(packet.commands.enablePowerShell.includes("SPACEGUARD_ENABLE_TEMP_EXECUTOR"), "first proof packet should include the temp executor flag command");
  assert(packet.commands.validateWorkflowProof.includes("validate:workflow-proof"), "first proof packet should include final workflow proof validation");
  assert(packet.appSteps.some((step) => step.includes("Seeded temp fixture")), "first proof packet should tell the operator to select the seeded fixture");
  assert(packet.appSteps.some((step) => step.includes("post-run rescan")), "first proof packet should require the post-run rescan");
  assert(packet.appSteps.some((step) => step.includes("Selected route proof import")), "first proof packet should require selected route proof import");
  assert(packet.forbiddenActions.includes("select-broad-temp-cleanup-for-fixture-proof"), "fixture proof should forbid broad temp cleanup");
  assert(packet.acceptanceCriteria.some((criterion) => criterion.includes("positive recovered bytes")), "acceptance criteria should require positive recovered bytes");

  const npmPacket = proof.buildFirstRouteProofRunPacket({
    routeInput: "npm-cache",
    env: { SPACEGUARD_ROUTE_SETUP_IGNORE_DOTENV: "1" }
  });
  assert.strictEqual(npmPacket.route, "bounded-npm-cache-delete", "non-temp routes should still resolve");
  assert.strictEqual(npmPacket.recommendedFirstRoute, false, "npm route should not be the recommended first fixture proof");
  assert.strictEqual(npmPacket.status, "manual-route-selected", "non-fixture routes should be marked manual-route-selected");
  assert(npmPacket.checks.some((check) => check.id === "fixture-seed" && !check.passed), "non-fixture routes should not claim seeded fixture support");
  assert.strictEqual(npmPacket.commands.seedFixtures, "", "non-fixture routes should not print the temp fixture seed command");

  console.log("first route proof ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
