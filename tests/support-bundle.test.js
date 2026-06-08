const assert = require("assert");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "run-support-bundle.mjs");

(async () => {
  const support = await import(pathToFileURL(script).href);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "spaceguard-support-"));
  const generatedAt = "2026-06-08T18:50:00.000Z";
  const proofCheck = {
    schemaVersion: "spaceguard-workflow-proof-check/v1",
    status: "accepted",
    canAccept: true,
    routeInput: "npm-cache",
    blockers: [],
    counts: {
      reclaimedBytes: 1024,
      blockers: 0
    },
    primary: "Workflow proof for npm-cache is accepted for next-route handoff."
  };
  fs.writeFileSync(path.join(tempDir, "spaceguard-selected-route-proof-packet.md"), "# selected proof\n", "utf8");
  fs.writeFileSync(path.join(tempDir, "spaceguard-real-workflow-proof.md"), "# workflow proof\n", "utf8");
  fs.writeFileSync(path.join(tempDir, "spaceguard-workflow-proof-check.json"), JSON.stringify(proofCheck, null, 2), "utf8");

  const report = support.buildSupportBundleReport({
    rootDir: tempDir,
    generatedAt,
    setupReport: {
      status: "one-route-ready",
      scopedExecutors: {
        selectedFlag: "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR",
        validationStatus: "one-route-ready"
      },
      realWorkflow: {
        routeInput: "npm-cache"
      }
    }
  });
  assert.strictEqual(report.schemaVersion, "spaceguard-support-bundle/v1", "support bundle should expose a stable schema");
  assert.strictEqual(report.status, "handoff-ready", "accepted workflow proof should make the support bundle handoff-ready");
  assert.strictEqual(report.readyForHandoff, true, "accepted workflow proof should clear the support bundle handoff gate");
  assert.strictEqual(report.workflowProofCheck.status, "accepted", "support bundle should preserve proof check status");
  assert.strictEqual(report.workflowProofCheck.canAccept, true, "support bundle should preserve proof check acceptance");
  assert(report.proofArtifacts.every((artifact) => artifact.exists), "all required proof artifacts should be present");
  assert(report.nextStep.includes("You can archive this bundle"), "accepted proof should produce an archive-ready next step");

  const markdown = support.renderSupportBundleMarkdown(report);
  assert(markdown.includes("spaceguard-support-bundle/v1"), "support markdown should include the bundle schema");
  assert(markdown.includes("spaceguard-selected-route-proof-packet.md"), "support markdown should list selected-route proof");
  assert(markdown.includes("spaceguard-real-workflow-proof.md"), "support markdown should list workflow proof");
  assert(markdown.includes("spaceguard-workflow-proof-check.json"), "support markdown should list workflow proof check");
  assert(markdown.includes("accepted"), "support markdown should include accepted proof status");
  assert(markdown.includes("npm-cache"), "support markdown should include the selected route");

  const outputPath = path.join(tempDir, "spaceguard-support-bundle.md");
  const writeResult = support.writeSupportBundle({
    rootDir: tempDir,
    outputPath,
    generatedAt,
    setupReport: report.setup
  });
  assert.strictEqual(writeResult.written, true, "support bundle writer should write markdown");
  assert.strictEqual(writeResult.path, outputPath, "support bundle writer should preserve output path");
  assert(fs.readFileSync(outputPath, "utf8").includes("spaceguard-workflow-proof-check.json"), "written support bundle should include proof check artifact");

  fs.rmSync(path.join(tempDir, "spaceguard-workflow-proof-check.json"));
  const missingCheck = support.buildSupportBundleReport({
    rootDir: tempDir,
    generatedAt,
    setupReport: report.setup
  });
  assert.strictEqual(missingCheck.readyForHandoff, false, "missing proof check should block support bundle handoff");
  assert(missingCheck.nextStep.includes("Export proof"), "missing proof check should point back to proof export");

  const blockedDir = fs.mkdtempSync(path.join(os.tmpdir(), "spaceguard-support-blocked-"));
  const blockedOut = path.join(blockedDir, "spaceguard-support-bundle.md");
  const blockedCli = spawnSync(process.execPath, [script, "--dir", blockedDir, "--out", blockedOut], {
    encoding: "utf8"
  });
  assert.strictEqual(blockedCli.status, 0, "support bundle CLI should write blocked bundles without failing the shell");
  assert(fs.existsSync(blockedOut), "support bundle CLI should write blocked bundle markdown");
  assert(fs.readFileSync(blockedOut, "utf8").includes("Export proof"), "blocked support bundle markdown should show the next proof-export step");

  console.log("support bundle ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
