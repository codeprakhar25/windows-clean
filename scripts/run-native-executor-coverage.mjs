#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildRouteNativeBoundary } from "../src/route-boundary-contracts.mjs";
import { routeSpecs } from "./run-setup-route.mjs";

const SCRIPT_ID = "spaceguard-native-executor-coverage";
const SCHEMA_VERSION = "spaceguard-native-executor-coverage/v1";

const REQUIRED_RUST_TESTS_BY_ROUTE = {
  "known-temp-delete": [
    "temp_target_gate_rejects_parent_traversal_out_of_env_temp"
  ],
  "bounded-npm-cache-delete": [
    "npm_cache_target_gate_accepts_only_current_user_cacache",
    "npm_cache_file_filter_limits_deletion_to_old_content_and_tmp_files",
    "npm_cache_deleter_removes_only_old_content_and_tmp_files"
  ],
  "bounded-pnpm-store-delete": [
    "pnpm_store_deleter_removes_only_old_content_and_temp_files"
  ],
  "bounded-cache-delete": [
    "gradle_cache_deleter_removes_only_old_cache_files"
  ],
  "bounded-user-cache-delete": [
    "user_cache_deleter_removes_only_old_non_metadata_files"
  ],
  "bounded-android-cache-delete": [
    "android_cache_deleter_removes_only_old_cache_files"
  ],
  "launcher-cache-cleanup": [
    "shader_cache_deleter_removes_only_old_cache_files"
  ],
  "bounded-pip-cache-delete": [
    "pip_cache_deleter_removes_only_old_cache_files"
  ],
  "browser-cache-only": [
    "browser_cache_deleter_removes_only_old_cache_files"
  ],
  "item-review-project-cache": [
    "project_dependency_target_validation_rejects_forbidden_locations",
    "project_dependency_deleter_removes_only_reviewed_node_modules"
  ],
  "item-review-recycle-bin": [
    "downloads_target_validation_accepts_only_old_reviewed_installer_files"
  ],
  "item-review-large-files": [
    "large_file_archive_target_validation_accepts_only_old_large_reviewed_files"
  ],
  "tool-native-docker-build-cache-prune": [
    "docker_build_cache_target_validation_accepts_only_inventory_marker"
  ],
  "shell-recycle-bin": [
    "recycle_bin_target_validation_accepts_only_drive_recycle_bin_root"
  ]
};

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(scriptPath), "..");

export function buildNativeExecutorCoverageReport({
  rootDir = defaultRoot,
  generatedAt = new Date().toISOString(),
  hostPlatform = process.platform
} = {}) {
  const root = path.resolve(rootDir);
  const rustPath = path.join(root, "src-tauri", "src", "main.rs");
  const rustText = readText(rustPath);
  const rustTestNames = extractRustUnitTestNames(rustText);
  const rustTestSet = new Set(rustTestNames);

  const rows = routeSpecs.map((spec) => {
    const boundary = buildRouteNativeBoundary(spec);
    const requiredRustTests = REQUIRED_RUST_TESTS_BY_ROUTE[spec.route] || [];
    const missingRustTests = requiredRustTests.filter((name) => !rustTestSet.has(name));
    const covered = Boolean(
      boundary.adapterFunction &&
        boundary.rustFunction &&
        boundary.deletePolicy?.length &&
        boundary.targetAllowlist?.length &&
        boundary.targetRejects?.length &&
        requiredRustTests.length &&
        missingRustTests.length === 0
    );
    return {
      route: spec.route,
      routeInput: spec.aliases?.[0] || spec.route,
      requestMode: spec.requestMode,
      adapterFunction: boundary.adapterFunction,
      rustFunction: boundary.rustFunction,
      status: covered ? "covered" : "blocked",
      requiredRustTests,
      missingRustTests,
      targetAllowlist: boundary.targetAllowlist || [],
      targetRejects: boundary.targetRejects || [],
      deletePolicy: boundary.deletePolicy || [],
      postRunProof: boundary.postRunProof || []
    };
  });

  const blockers = rows
    .filter((row) => row.status !== "covered")
    .map((row) => ({
      id: row.route,
      label: "Native executor coverage missing",
      detail: row.missingRustTests.length
        ? `Missing Rust unit test(s): ${row.missingRustTests.join(", ")}.`
        : "Route boundary or required Rust unit test mapping is missing."
    }));
  const covered = blockers.length === 0;

  return {
    schemaVersion: SCHEMA_VERSION,
    tool: SCRIPT_ID,
    generatedAt,
    status: covered ? "covered" : "blocked",
    rustPath: path.relative(root, rustPath),
    host: buildHostRustTestSummary(hostPlatform),
    rows,
    blockers,
    counts: {
      routes: rows.length,
      covered: rows.filter((row) => row.status === "covered").length,
      blocked: blockers.length,
      rustUnitTests: rustTestNames.length
    },
    primary: covered
      ? "Native executor route boundaries and Rust unit-test coverage are visible for the real cleanup surface."
      : `Native executor coverage is blocked by ${blockers.length} route(s).`
  };
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function extractRustUnitTestNames(rustText = "") {
  const names = [];
  const testPattern = /#\s*\[\s*test\s*\]\s*fn\s+([A-Za-z0-9_]+)/g;
  for (const match of rustText.matchAll(testPattern)) {
    if (match[1]) names.push(match[1]);
  }
  return names;
}

function buildHostRustTestSummary(hostPlatform = process.platform) {
  const currentPlatform = String(hostPlatform || process.platform);
  return {
    currentPlatform,
    cargoTestCommand: "cargo test --manifest-path src-tauri/Cargo.toml",
    warnings: currentPlatform === "win32"
      ? ["Run cargo test on the prepared Windows demo host before public beta."]
      : ["Run cargo test on a prepared host with Tauri system dependencies; this Linux sandbox currently needs pkg-config and GTK/WebKit packages before cargo test can compile."]
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = buildNativeExecutorCoverageReport();
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "covered") process.exitCode = 1;
}
