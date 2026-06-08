#!/usr/bin/env node
import fs from "node:fs";
import process from "node:process";
import {
  buildRejectedWorkflowProofCheck,
  buildWorkflowProofCheck
} from "../src/workflow-proof-check.mjs";

function parseArgs(argv) {
  const args = { file: "", allowIncomplete: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--file") args.file = argv[index + 1] || "";
    if (value.startsWith("--file=")) args.file = value.slice("--file=".length);
    if (value === "--allow-incomplete") args.allowIncomplete = true;
  }
  return args;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  const args = parseArgs(process.argv.slice(2));
  let result;
  try {
    if (!args.file) {
      result = buildRejectedWorkflowProofCheck("file-required", "Pass --file path/to/spaceguard-real-workflow-proof.md.");
    } else {
      const evidenceText = fs.readFileSync(args.file, "utf8");
      result = buildWorkflowProofCheck({ evidenceText });
    }
  } catch (error) {
    result = buildRejectedWorkflowProofCheck(
      "read-error",
      error instanceof Error ? error.message : "Workflow proof file could not be read."
    );
  }
  console.log(JSON.stringify(result, null, 2));
  if (!result.canAccept && !args.allowIncomplete) process.exitCode = 1;
}

export {
  buildRejectedWorkflowProofCheck,
  buildWorkflowProofCheck
};
