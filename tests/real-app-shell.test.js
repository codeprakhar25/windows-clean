const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src", "App.jsx"), "utf8");
const removedDataWord = "de" + "mo";
const removedSampleWord = "sce" + "nario";
const removedModelImport = "./spaceguard-" + "model.mjs";

const forbiddenRuntimeMarkers = [
  new RegExp(`\\b${removedDataWord}\\b`, "i"),
  new RegExp(`\\b${removedSampleWord}\\b`, "i"),
  /Review setup steps/i,
  /Legacy sample fixture/i,
  /buildLegacySampleActions/,
  /buildDemoRehearsalRunbook/,
  /simulateCleanup/,
  /sampleRows[,}]/,
  /getLegacySample/
];

for (const marker of forbiddenRuntimeMarkers) {
  assert(!marker.test(app), `App.jsx must not contain removed sample-data marker ${marker}`);
}

const requiredRealShellMarkers = [
  "Connect the Windows desktop app",
  "No local folders are scanned from this browser session.",
  "npm run windows:ready",
  "npm run native:dev",
  "OPENAI_API_KEY",
  "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR",
  "Run real scan",
  "Cleanup queue",
  "Explore C: allocation",
  "Selected cleanup",
  "Delete selected files",
  "Refresh scan after cleanup",
  "Support details",
  "Cleanup history",
  "spaceguard-real-workflow-proof.md",
  "getNativeRuntimeCapabilities",
  "runNativeReadonlyScan",
  "writeNativeProofArtifact",
  "requestOpenAIAgentAdvice"
];

for (const marker of requiredRealShellMarkers) {
  assert(app.includes(marker), `App.jsx should contain real-only shell marker ${marker}`);
}

assert(!app.includes(removedModelImport), "real app shell must not import bundled sample model data");
assert(app.includes("@/components/ui/button"), "real app shell should keep shadcn Button composition");
assert(app.includes("@/components/ui/card"), "real app shell should keep shadcn Card composition");

console.log("real app shell ok");
