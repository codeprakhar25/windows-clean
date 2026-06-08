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
    appCloseContract: {
      schemaVersion: "spaceguard-first-route-app-close-contract/v1",
      workflowProofPath: ".\\spaceguard-real-workflow-proof.md",
      selectedRouteProofPacketPath: ".\\spaceguard-selected-route-proof-packet.md",
      expectedWorkflowProofSchema: "spaceguard-real-workflow-proof/v1",
      minimumReclaimedBytes: 1,
      nextRouteBlockedUntil: "validate:first-route-completion accepted",
      requiredBeforeClosingApp: [
        "post-run-rescan-matched",
        "selected-route-proof-packet-exported",
        "selected-route-proof-import-complete",
        "spaceguard-real-workflow-proof-exported"
      ]
    },
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

  const selectedRoutePacket = {
    ...provenPacket,
    route: "bounded-npm-cache-delete",
    routeInput: "npm-cache",
    volumeProof: {
      status: "measured",
      measured: true,
      driveLabel: "C:",
      freeBytesDelta: 1024,
      entries: 1
    },
    appCloseContract: {
      schemaVersion: "spaceguard-selected-route-app-close-contract/v1",
      workflowProofPath: ".\\spaceguard-real-workflow-proof.md",
      selectedRouteProofPacketPath: ".\\spaceguard-selected-route-proof-packet.md",
      expectedWorkflowProofSchema: "spaceguard-real-workflow-proof/v1",
      minimumReclaimedBytes: 1,
      nextRouteBlockedUntil: "validate:workflow-proof accepted",
      requiredBeforeClosingApp: [
        "native-volume-proof-captured",
        "post-run-rescan-matched",
        "selected-route-proof-packet-exported",
        "selected-route-proof-import-complete",
        "spaceguard-real-workflow-proof-exported"
      ]
    },
    rows: [
      ...provenPacket.rows,
      { id: "native-volume-proof", passed: true }
    ]
  };
  const acceptedSelectedRoute = verifier.buildWorkflowProofCheck({ evidenceObject: selectedRoutePacket });
  assert.strictEqual(acceptedSelectedRoute.status, "accepted", "selected-route workflow proof contract should be accepted");
  assert.strictEqual(acceptedSelectedRoute.canAccept, true, "selected-route workflow proof should clear the selected route handoff");

  const missingSelectedRouteMeasuredVolumeProof = verifier.buildWorkflowProofCheck({
    evidenceObject: {
      ...selectedRoutePacket,
      volumeProof: null,
      rows: selectedRoutePacket.rows.map((row) => row.id === "native-volume-proof" ? { ...row, passed: false } : row)
    }
  });
  assert.strictEqual(missingSelectedRouteMeasuredVolumeProof.status, "blocked", "selected-route workflow proof without measured native volume proof should block");
  assert(missingSelectedRouteMeasuredVolumeProof.blockers.some((blocker) => blocker.id === "native-volume-proof"), "missing measured native volume proof blocker should be surfaced");

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

  const zeroBytePacket = {
    ...provenPacket,
    counts: {
      ...provenPacket.counts,
      reclaimedBytes: 0
    }
  };
  const zeroByteCheck = verifier.buildWorkflowProofCheck({ evidenceObject: zeroBytePacket });
  assert.strictEqual(zeroByteCheck.status, "blocked", "zero-byte workflow proof should block");
  assert.strictEqual(zeroByteCheck.canAccept, false, "zero-byte workflow proof must not be accepted");
  assert(zeroByteCheck.blockers.some((blocker) => blocker.id === "reclaimed-bytes"), "zero-byte workflow proof should name missing recovered bytes");

  const missingAppCloseContract = verifier.buildWorkflowProofCheck({
    evidenceObject: {
      ...provenPacket,
      appCloseContract: null
    }
  });
  assert.strictEqual(missingAppCloseContract.status, "blocked", "workflow proof without app-close contract should block");
  assert(missingAppCloseContract.blockers.some((blocker) => blocker.id === "app-close-contract"), "missing app-close contract blocker should be surfaced");

  const missingSelectedRouteProofPacketPath = verifier.buildWorkflowProofCheck({
    evidenceObject: {
      ...provenPacket,
      appCloseContract: {
        ...provenPacket.appCloseContract,
        selectedRouteProofPacketPath: ""
      }
    }
  });
  assert.strictEqual(missingSelectedRouteProofPacketPath.status, "blocked", "workflow proof without selected-route proof packet path should block");
  assert(missingSelectedRouteProofPacketPath.blockers.some((blocker) => blocker.id === "app-close-contract"), "missing selected-route proof packet path should be an app-close contract blocker");

  const missingSelectedRouteVolumeProof = verifier.buildWorkflowProofCheck({
    evidenceObject: {
      ...selectedRoutePacket,
      appCloseContract: {
        ...selectedRoutePacket.appCloseContract,
        requiredBeforeClosingApp: selectedRoutePacket.appCloseContract.requiredBeforeClosingApp.filter((item) => item !== "native-volume-proof-captured")
      }
    }
  });
  assert.strictEqual(missingSelectedRouteVolumeProof.status, "blocked", "selected-route workflow proof without native volume proof requirement should block");
  assert(missingSelectedRouteVolumeProof.blockers.some((blocker) => blocker.id === "app-close-contract"), "missing selected-route native volume requirement should be an app-close contract blocker");

  const wrongSchema = verifier.buildWorkflowProofCheck({ evidenceObject: { schemaVersion: "wrong" } });
  assert.strictEqual(wrongSchema.status, "schema-mismatch", "wrong schema should be rejected");

  console.log("workflow proof check ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
