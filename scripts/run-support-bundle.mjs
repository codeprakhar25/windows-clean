#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { buildSetupDoctorReport } from "./run-setup-doctor.mjs";

const SCRIPT_ID = "spaceguard-support-bundle";
const REQUIRED_PROOF_ARTIFACTS = [
  "spaceguard-selected-route-proof-packet.md",
  "spaceguard-real-workflow-proof.md",
  "spaceguard-workflow-proof-check.json"
];

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), "..");

function parseArgs(argv) {
  const args = {
    dir: root,
    out: "spaceguard-support-bundle.md",
    json: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--dir") args.dir = argv[index + 1] || args.dir;
    if (value.startsWith("--dir=")) args.dir = value.slice("--dir=".length);
    if (value === "--out") args.out = argv[index + 1] || args.out;
    if (value.startsWith("--out=")) args.out = value.slice("--out=".length);
    if (value === "--json") args.json = true;
  }
  return args;
}

function resolvePath(rootDir, filePath) {
  if (path.isAbsolute(filePath)) return path.resolve(filePath);
  return path.resolve(rootDir, filePath);
}

function readTextIfPresent(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function readJsonIfPresent(filePath) {
  const text = readTextIfPresent(filePath);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function inspectProofArtifacts(rootDir) {
  return REQUIRED_PROOF_ARTIFACTS.map((fileName) => {
    const filePath = path.join(rootDir, fileName);
    let stat = null;
    try {
      stat = fs.statSync(filePath);
    } catch {
      stat = null;
    }
    return {
      fileName,
      path: filePath,
      exists: Boolean(stat?.isFile()),
      bytes: stat?.isFile() ? stat.size : 0,
      modifiedAt: stat?.isFile() ? stat.mtime.toISOString() : ""
    };
  });
}

function normalizeWorkflowProofCheck(value = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      schemaVersion: "",
      status: "missing",
      canAccept: false,
      routeInput: "",
      primary: "spaceguard-workflow-proof-check.json is missing or invalid.",
      blockers: [{ id: "proof-check-missing", label: "Proof check missing", detail: "Export proof in the desktop app to write the workflow proof check artifact." }],
      counts: {
        reclaimedBytes: 0,
        blockers: 1
      }
    };
  }
  return {
    schemaVersion: String(value.schemaVersion || ""),
    status: String(value.status || "unknown"),
    canAccept: Boolean(value.canAccept),
    routeInput: String(value.routeInput || value.route || ""),
    primary: String(value.primary || ""),
    blockers: Array.isArray(value.blockers)
      ? value.blockers.map((blocker) => ({
          id: String(blocker?.id || ""),
          label: String(blocker?.label || ""),
          detail: String(blocker?.detail || "")
        }))
      : [],
    counts: {
      reclaimedBytes: Number(value.counts?.reclaimedBytes || 0),
      blockers: Number(value.counts?.blockers ?? (Array.isArray(value.blockers) ? value.blockers.length : 0))
    }
  };
}

function buildNextStep({ artifacts = [], workflowProofCheck }) {
  const missing = artifacts.filter((artifact) => !artifact.exists);
  if (missing.length) {
    return `Export proof in the desktop app so ${missing.map((artifact) => artifact.fileName).join(", ")} exists before handoff.`;
  }
  if (!workflowProofCheck.canAccept) {
    return "Resolve workflow proof check blockers in the app, rerun post-run rescan if needed, then export proof again.";
  }
  return "You can archive this bundle with the three proof artifacts before enabling another cleanup route.";
}

export function buildSupportBundleReport({
  rootDir = root,
  generatedAt = new Date().toISOString(),
  setupReport = buildSetupDoctorReport()
} = {}) {
  const normalizedRoot = path.resolve(rootDir);
  const proofArtifacts = inspectProofArtifacts(normalizedRoot);
  const workflowProofCheck = normalizeWorkflowProofCheck(readJsonIfPresent(path.join(normalizedRoot, "spaceguard-workflow-proof-check.json")));
  const allProofArtifactsPresent = proofArtifacts.every((artifact) => artifact.exists);
  const readyForHandoff = Boolean(allProofArtifactsPresent && workflowProofCheck.canAccept);
  return {
    schemaVersion: "spaceguard-support-bundle/v1",
    tool: SCRIPT_ID,
    generatedAt,
    rootDir: normalizedRoot,
    status: readyForHandoff ? "handoff-ready" : "handoff-blocked",
    readyForHandoff,
    setup: setupReport,
    selectedRoute: setupReport?.realWorkflow?.routeInput || workflowProofCheck.routeInput || "",
    selectedFlag: setupReport?.scopedExecutors?.selectedFlag || "",
    proofArtifacts,
    workflowProofCheck,
    nextStep: buildNextStep({ artifacts: proofArtifacts, workflowProofCheck })
  };
}

function formatBytes(bytes = 0) {
  const value = Number(bytes || 0);
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function renderSupportBundleMarkdown(report = {}) {
  const artifacts = Array.isArray(report.proofArtifacts) ? report.proofArtifacts : [];
  const blockers = Array.isArray(report.workflowProofCheck?.blockers) ? report.workflowProofCheck.blockers : [];
  return [
    "# SpaceGuard Support Bundle",
    "",
    `- Schema: ${report.schemaVersion || "spaceguard-support-bundle/v1"}`,
    `- Generated: ${report.generatedAt || ""}`,
    `- Status: ${report.status || "unknown"}`,
    `- Route: ${report.selectedRoute || "unknown"}`,
    `- Selected flag: ${report.selectedFlag || "none"}`,
    `- Next step: ${report.nextStep || ""}`,
    "",
    "## Proof Artifacts",
    "",
    "| File | State | Size | Modified |",
    "| --- | --- | ---: | --- |",
    ...artifacts.map((artifact) => `| ${artifact.fileName} | ${artifact.exists ? "present" : "missing"} | ${formatBytes(artifact.bytes)} | ${artifact.modifiedAt || ""} |`),
    "",
    "## Workflow Proof Check",
    "",
    `- Schema: ${report.workflowProofCheck?.schemaVersion || "missing"}`,
    `- Status: ${report.workflowProofCheck?.status || "missing"}`,
    `- Accepted: ${report.workflowProofCheck?.canAccept ? "yes" : "no"}`,
    `- Reclaimed: ${formatBytes(report.workflowProofCheck?.counts?.reclaimedBytes || 0)}`,
    `- Summary: ${report.workflowProofCheck?.primary || ""}`,
    "",
    "## Blockers",
    "",
    blockers.length
      ? blockers.map((blocker) => `- ${blocker.label || blocker.id}: ${blocker.detail || ""}`).join("\n")
      : "- None",
    "",
    "## Setup Snapshot",
    "",
    "```json",
    JSON.stringify(report.setup || {}, null, 2),
    "```",
    ""
  ].join("\n");
}

export function writeSupportBundle({
  rootDir = root,
  outputPath = "spaceguard-support-bundle.md",
  generatedAt = new Date().toISOString(),
  setupReport = buildSetupDoctorReport()
} = {}) {
  const normalizedRoot = path.resolve(rootDir);
  const targetPath = resolvePath(normalizedRoot, outputPath);
  const report = buildSupportBundleReport({ rootDir: normalizedRoot, generatedAt, setupReport });
  const markdown = renderSupportBundleMarkdown(report);
  fs.writeFileSync(targetPath, markdown, "utf8");
  return {
    written: true,
    path: targetPath,
    report,
    bytes: Buffer.byteLength(markdown, "utf8")
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const args = parseArgs(process.argv.slice(2));
  const result = writeSupportBundle({
    rootDir: args.dir,
    outputPath: args.out
  });
  if (args.json) {
    console.log(JSON.stringify(result.report, null, 2));
  } else {
    console.log(`Wrote ${path.relative(process.cwd(), result.path) || result.path}`);
    console.log(result.report.nextStep);
  }
}
