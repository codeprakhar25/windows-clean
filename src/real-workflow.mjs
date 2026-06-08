export const MB = 1024 ** 2;
export const RESCAN_TOLERANCE_BYTES = 64 * MB;

export function buildRouteReadiness({ recipe = {}, finding = {}, runtime = {} } = {}) {
  const executable = Boolean(recipe.executor);
  if (!executable) {
    return {
      executable: false,
      canExecute: false,
      blockedReason: "Manual review only.",
      rows: [
        {
          id: "manual-only",
          label: "Manual review",
          status: "blocked",
          passed: false,
          detail: "No native executor is mapped for this finding."
        }
      ]
    };
  }

  const routeFlagEnabled = Boolean(runtime?.executorFlags?.[recipe.flagKey]);
  const multipleFlags = runtime?.executorScopeStatus === "multiple-scoped-flags";
  const enabledFlags = Array.isArray(runtime?.enabledScopedExecutorFlags)
    ? runtime.enabledScopedExecutorFlags
    : [];
  const firstRouteRequired = recipe.route !== "known-temp-delete";
  const firstRouteAccepted = Boolean(runtime?.firstRouteProof?.accepted);
  const findingStatus = finding.status || "unknown";

  const rows = [
    guardrailRow({
      id: "native-runtime",
      label: "Windows native runtime",
      passed: Boolean(runtime?.windows),
      detail: runtime?.windows ? "Desktop runtime is Windows." : "Windows native runtime is required."
    }),
    guardrailRow({
      id: "executor-command",
      label: "Executor command",
      passed: Boolean(runtime?.executeCleanupPlan),
      detail: runtime?.executeCleanupPlan ? "Native executor command is available." : "Native executor command is unavailable."
    }),
    guardrailRow({
      id: "single-route-scope",
      label: "Single route scope",
      passed: !multipleFlags,
      detail: multipleFlags
        ? `Turn off all but one scoped executor flag. Enabled: ${enabledFlags.join(", ") || "multiple flags"}.`
        : "No competing scoped executor flags detected."
    }),
    guardrailRow({
      id: "route-flag",
      label: "Route flag",
      passed: routeFlagEnabled,
      detail: routeFlagEnabled
        ? `${recipe.envVar}=1 is active for this route.`
        : `Set ${recipe.envVar}=1 in .env and restart the desktop app.`
    }),
    guardrailRow({
      id: "real-run-authority",
      label: "Real-run authority",
      passed: Boolean(runtime?.realRunEnabled && runtime?.destructiveCommands),
      detail: runtime?.realRunEnabled && runtime?.destructiveCommands
        ? "Runtime allows exactly one scoped mutating executor."
        : "Runtime does not report real-run authority for the single selected route."
    }),
    firstRouteRequired
      ? guardrailRow({
          id: "first-route-proof",
          label: "First-route proof",
          passed: firstRouteAccepted,
          detail: firstRouteAccepted
            ? `Accepted known-temp-delete proof: ${runtime?.firstRouteProof?.path || "configured path"}.`
            : "Accepted known-temp-delete completion proof is required before this route."
        })
      : {
          id: "first-route-proof",
          label: "First-route proof",
          status: "not-required",
          passed: true,
          detail: "Not required for known-temp-delete."
        },
    guardrailRow({
      id: "native-finding-status",
      label: "Native finding status",
      passed: ["measured", "limited"].includes(findingStatus),
      detail: ["measured", "limited"].includes(findingStatus)
        ? `Finding status is ${findingStatus}.`
        : `Native finding status is ${findingStatus}.`
    })
  ];

  const blocked = rows.find((row) => !row.passed);
  return {
    executable,
    canExecute: !blocked,
    blockedReason: blocked?.detail || "",
    rows
  };
}

function guardrailRow({ id, label, passed, detail }) {
  return {
    id,
    label,
    status: passed ? "passed" : "blocked",
    passed: Boolean(passed),
    detail
  };
}

export function buildPostRunProof({ candidate, executionRecord, postRunScan }) {
  if (!candidate || !executionRecord) {
    return { status: "not-run", detail: "Run a native executor first.", matched: false };
  }
  if (!postRunScan) {
    return { status: "needs-rescan", detail: "Run post-run rescan after the cleanup ledger.", matched: false };
  }

  const targetEvidence = findPostRunTargetEvidence(postRunScan, candidate);
  const beforeBytes = Number(candidate.bytes || 0);
  const actualBytes = Number(targetEvidence.bytes || 0);
  const reclaimedBytes = Number(executionRecord.bytes || 0);
  const generatedAt = Date.parse(postRunScan.generatedAt || "");
  const executedAt = Date.parse(executionRecord.executedAt || "");
  const newerScan = Number.isFinite(generatedAt) && Number.isFinite(executedAt) && generatedAt >= executedAt;
  const expectedRemaining = Math.max(0, beforeBytes - reclaimedBytes);
  const matched = Boolean(newerScan && reclaimedBytes > 0 && actualBytes <= expectedRemaining + RESCAN_TOLERANCE_BYTES);

  return {
    status: matched ? "matched" : "review-needed",
    detail: matched
      ? `Post-run scan is newer than the ledger and selected target bytes are within ${formatBytes(RESCAN_TOLERANCE_BYTES)} tolerance.`
      : `Expected selected target remaining ${formatBytes(expectedRemaining)}, observed ${formatBytes(actualBytes)}. Review before exporting proof.`,
    matched,
    beforeBytes,
    actualBytes,
    expectedRemaining,
    reclaimedBytes,
    scanGeneratedAt: postRunScan.generatedAt || "",
    latestExecutionAt: executionRecord.executedAt || "",
    postFinding: targetEvidence.finding,
    postItem: targetEvidence.item,
    targetEvidence
  };
}

export function findPostRunTargetEvidence(scan, candidate) {
  const finding = findMatchingFinding(scan, candidate);
  if (!finding) {
    return {
      kind: candidate?.reviewTarget?.path ? "item" : "finding",
      found: false,
      bytes: 0,
      finding: null,
      item: null,
      path: candidate?.targetPath || ""
    };
  }

  const reviewPath = candidate?.reviewTarget?.path || "";
  if (reviewPath) {
    const item = findMatchingItem(finding.items || [], reviewPath);
    return {
      kind: "item",
      found: Boolean(item),
      bytes: Number(item?.bytes || 0),
      finding,
      item: item || null,
      path: reviewPath
    };
  }

  return {
    kind: "finding",
    found: true,
    bytes: Number(finding.bytes || 0),
    finding,
    item: null,
    path: finding.path || candidate?.targetPath || ""
  };
}

function findMatchingFinding(scan, candidate) {
  return (scan?.findings || []).find((finding) =>
    finding.recipeId === candidate.recipeId &&
    normalizePathKey(finding.path || "") === normalizePathKey(candidate.sourceFinding?.path || candidate.targetPath || "")
  ) || null;
}

function findMatchingItem(items, targetPath) {
  const targetKey = normalizePathKey(targetPath);
  return items.find((item) => normalizePathKey(item.path || "") === targetKey) || null;
}

export function normalizePathKey(value = "") {
  return String(value || "").trim().toLowerCase().replace(/\//g, "\\");
}

export function formatBytes(bytes = 0) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const gb = 1024 ** 3;
  if (value >= gb) return `${(value / gb).toFixed(value >= 10 * gb ? 1 : 2)} GB`;
  if (value >= MB) return `${(value / MB).toFixed(value >= 10 * MB ? 1 : 2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${Math.round(value)} B`;
}
