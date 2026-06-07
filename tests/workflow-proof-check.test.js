const assert = require("assert");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "run-workflow-proof-check.mjs");

(async () => {
  const verifier = await import(pathToFileURL(script).href);

  const provenPacket = {
    schemaVersion: "spaceguard-real-workflow-proof/v1",
    status: "workflow-proven",
    route: "bounded-npm-cache-delete",
    routeInput: "npm-cache",
    proofStatus: "proof-complete",
    proofImportStatus: "import-complete",
    readyForNextRoute: true,
    unsafeRuntime: false,
    counts: {
      ledgerEntries: 1,
      matchedRows: 1,
      reclaimedBytes: 1024
    },
    rows: [
      { id: "native-scan-current", passed: true },
      { id: "post-run-proof-complete", passed: true },
      { id: "selected-route-proof-import", passed: true },
      { id: "next-route-clearance", passed: true }
    ]
  };
  const accepted = verifier.buildWorkflowProofCheck({ evidenceObject: provenPacket, checkedAt: "2026-06-07T10:00:00.000Z" });
  assert.strictEqual(accepted.schemaVersion, "spaceguard-workflow-proof-check/v1", "workflow proof check should expose a stable schema");
  assert.strictEqual(accepted.status, "accepted", "workflow-proven packet should be accepted");
  assert.strictEqual(accepted.canAccept, true, "workflow-proven packet should be accepted for route handoff");
  assert.strictEqual(accepted.readyForNextRoute, true, "workflow-proven packet should preserve next-route clearance");

  const markdown = [
    "# SpaceGuard Real Workflow Proof",
    "",
    "```json",
    JSON.stringify(provenPacket),
    "```"
  ].join("\n");
  const acceptedMarkdown = verifier.buildWorkflowProofCheck({ evidenceText: markdown });
  assert.strictEqual(acceptedMarkdown.status, "accepted", "workflow proof check should parse markdown JSON fences");

  const blockedPacket = {
    ...provenPacket,
    status: "proof-import-required",
    proofImportStatus: "needs-import",
    readyForNextRoute: false,
    rows: provenPacket.rows.map((row) => row.id === "selected-route-proof-import" ? { ...row, passed: false } : row)
  };
  const blocked = verifier.buildWorkflowProofCheck({ evidenceObject: blockedPacket });
  assert.strictEqual(blocked.status, "blocked", "incomplete workflow proof should block");
  assert.strictEqual(blocked.canAccept, false, "incomplete workflow proof must not be accepted");
  assert(blocked.blockers.some((blocker) => blocker.id === "selected-route-proof-import"), "blocked workflow proof should name missing proof import");

  const wrongSchema = verifier.buildWorkflowProofCheck({ evidenceObject: { schemaVersion: "wrong" } });
  assert.strictEqual(wrongSchema.status, "schema-mismatch", "wrong schema should be rejected");

  console.log("workflow proof check ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
