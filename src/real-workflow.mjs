export const MB = 1024 ** 2;
export const RESCAN_TOLERANCE_BYTES = 64 * MB;

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
