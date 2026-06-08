const SCRIPT_ID = "spaceguard-workflow-proof-check";
const PROOF_SCHEMA = "spaceguard-real-workflow-proof/v1";
const CHECK_SCHEMA = "spaceguard-workflow-proof-check/v1";
const SELECTED_ROUTE_APP_CLOSE_CONTRACT_SCHEMA = "spaceguard-selected-route-app-close-contract/v1";
const COMMON_APP_CLOSE_REQUIREMENTS = [
  "post-run-rescan-matched",
  "selected-route-proof-packet-exported",
  "selected-route-proof-reviewed",
  "spaceguard-real-workflow-proof-exported"
];
const appCloseContracts = {
  [SELECTED_ROUTE_APP_CLOSE_CONTRACT_SCHEMA]: {
    nextRouteBlockedUntil: "validate:workflow-proof accepted",
    nextRouteDetail: "App-close contract must keep next route blocked until workflow proof is accepted.",
    requiredBeforeClosingApp: ["native-volume-proof-captured", ...COMMON_APP_CLOSE_REQUIREMENTS]
  }
};
const requiredRowIds = [
  "native-scan-current",
  "post-run-proof-complete",
  "selected-route-proof-reviewed",
  "selected-route-proof-export",
  "next-route-clearance"
];

function parseWorkflowProofInput(evidenceObject = null, evidenceText = "") {
  if (evidenceObject && typeof evidenceObject === "object" && !Array.isArray(evidenceObject)) {
    return { ok: true, value: evidenceObject };
  }
  const text = String(evidenceText || "").trim();
  if (!text) return { ok: false, detail: "Workflow proof JSON or markdown export is required." };

  const candidates = [
    text,
    ...[...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((match) => match[1]?.trim()).filter(Boolean)
  ];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { ok: true, value: parsed };
      }
    } catch {
      // Continue through possible markdown code fences.
    }
  }
  return { ok: false, detail: "Workflow proof could not be parsed as JSON." };
}

export function buildWorkflowProofCheck({
  evidenceText = "",
  evidenceObject = null,
  checkedAt = new Date().toISOString()
} = {}) {
  const parsed = parseWorkflowProofInput(evidenceObject, evidenceText);
  if (!parsed.ok) {
    return buildRejectedWorkflowProofCheck("parse-error", parsed.detail, checkedAt);
  }

  const proof = parsed.value;
  if (proof.schemaVersion !== PROOF_SCHEMA) {
    return buildRejectedWorkflowProofCheck("schema-mismatch", `Workflow proof must use ${PROOF_SCHEMA}.`, checkedAt, proof);
  }

  const blockers = buildWorkflowProofBlockers(proof);
  const canAccept = blockers.length === 0;
  return {
    schemaVersion: CHECK_SCHEMA,
    tool: SCRIPT_ID,
    checkedAt,
    status: canAccept ? "accepted" : "blocked",
    canAccept,
    route: String(proof.route || ""),
    routeInput: String(proof.routeInput || proof.route || ""),
    proofStatus: proof.proofStatus || "",
    selectedRouteProofReviewStatus: proof.selectedRouteProofReviewStatus || "",
    readyForNextRoute: Boolean(proof.readyForNextRoute),
    blockers,
    counts: {
      ledgerEntries: Number(proof.counts?.ledgerEntries || 0),
      matchedRows: Number(proof.counts?.matchedRows || 0),
      reclaimedBytes: Number(proof.counts?.reclaimedBytes || 0),
      proofRows: Array.isArray(proof.rows) ? proof.rows.length : 0,
      blockers: blockers.length
    },
    primary: canAccept
      ? `Workflow proof for ${proof.routeInput || proof.route || "selected route"} is accepted for next-route handoff.`
      : `Workflow proof is blocked by ${blockers.length} issue(s).`
  };
}

export function buildRejectedWorkflowProofCheck(status, detail, checkedAt = new Date().toISOString(), proof = null) {
  return {
    schemaVersion: CHECK_SCHEMA,
    tool: SCRIPT_ID,
    checkedAt,
    status,
    canAccept: false,
    route: String(proof?.route || ""),
    routeInput: String(proof?.routeInput || proof?.route || ""),
    proofStatus: proof?.proofStatus || "",
    selectedRouteProofReviewStatus: proof?.selectedRouteProofReviewStatus || "",
    readyForNextRoute: Boolean(proof?.readyForNextRoute),
    blockers: [{ id: status, label: "Workflow proof rejected", detail }],
    counts: {
      ledgerEntries: Number(proof?.counts?.ledgerEntries || 0),
      matchedRows: Number(proof?.counts?.matchedRows || 0),
      reclaimedBytes: Number(proof?.counts?.reclaimedBytes || 0),
      proofRows: Array.isArray(proof?.rows) ? proof.rows.length : 0,
      blockers: 1
    },
    primary: detail
  };
}

function buildWorkflowProofBlockers(proof = {}) {
  const blockers = [];
  const add = (id, label, detail) => {
    if (!blockers.some((blocker) => blocker.id === id)) blockers.push({ id, label, detail });
  };

  if (proof.unsafeRuntime) add("unsafe-runtime", "Unsafe runtime", "Workflow proof reports visible write capability or unsafe runtime state.");
  if (proof.status !== "workflow-proven") add("status", "Status not proven", `Expected workflow-proven, received ${proof.status || "missing"}.`);
  if (proof.proofStatus !== "proof-complete") add("post-run-proof-complete", "Post-run proof incomplete", `Expected proof-complete, received ${proof.proofStatus || "missing"}.`);
  if (proof.selectedRouteProofReviewStatus !== "review-complete") {
    add("selected-route-proof-reviewed", "Selected-route proof review incomplete", `Expected review-complete, received ${proof.selectedRouteProofReviewStatus || "missing"}.`);
  }
  if (proof.readyForNextRoute !== true) add("next-route-clearance", "Next route blocked", "Workflow proof must explicitly set readyForNextRoute=true.");
  if (Number(proof.counts?.ledgerEntries || 0) < 1) add("execution-ledger", "Ledger missing", "At least one selected-route execution ledger entry is required.");
  if (Number(proof.counts?.matchedRows || 0) < 1) add("post-run-rescan", "Matched rescan missing", "At least one matched post-run rescan row is required.");
  if (Number(proof.counts?.reclaimedBytes || 0) <= 0) add("reclaimed-bytes", "Recovered bytes missing", "Workflow proof must report positive reclaimed bytes before next-route handoff is accepted.");
  validateAppCloseContract(proof.appCloseContract, add);

  const effectiveRequiredRowIds = [...requiredRowIds, "native-volume-proof"];
  if (proof.volumeProof?.status !== "measured" && proof.volumeProof?.measured !== true) {
    add("native-volume-proof", "Native volume proof missing", "Selected-route workflow proof must include measured native volume proof.");
  }

  for (const rowId of effectiveRequiredRowIds) {
    const row = Array.isArray(proof.rows) ? proof.rows.find((item) => item?.id === rowId) : null;
    if (!row?.passed) add(rowId, "Proof row blocked", `${rowId} must be present and passed.`);
  }

  return blockers;
}

function validateAppCloseContract(contract, add) {
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
    add("app-close-contract", "App-close contract missing", "Workflow proof must include the app-close proof contract exported by the desktop app.");
    return;
  }

  const schemaVersion = String(contract.schemaVersion || "");
  const expectedContract = appCloseContracts[schemaVersion];
  if (!expectedContract) {
    add(
      "app-close-contract",
      "App-close contract schema mismatch",
      `Expected ${SELECTED_ROUTE_APP_CLOSE_CONTRACT_SCHEMA}.`
    );
  }
  if (String(contract.workflowProofPath || "") !== ".\\spaceguard-real-workflow-proof.md") {
    add("app-close-contract", "Workflow proof export path mismatch", "App-close contract must point to .\\spaceguard-real-workflow-proof.md.");
  }
  if (String(contract.selectedRouteProofPacketPath || "") !== ".\\spaceguard-selected-route-proof-packet.md") {
    add("app-close-contract", "Selected-route proof export path mismatch", "App-close contract must point to .\\spaceguard-selected-route-proof-packet.md.");
  }
  if (String(contract.expectedWorkflowProofSchema || "") !== PROOF_SCHEMA) {
    add("app-close-contract", "Workflow proof schema mismatch", `App-close contract must require ${PROOF_SCHEMA}.`);
  }
  if (Number(contract.minimumReclaimedBytes || 0) < 1) {
    add("app-close-contract", "Recovered-byte minimum missing", "App-close contract must require positive reclaimed bytes.");
  }
  if (expectedContract && String(contract.nextRouteBlockedUntil || "") !== expectedContract.nextRouteBlockedUntil) {
    add("app-close-contract", "Next-route gate missing", expectedContract.nextRouteDetail);
  }

  const requirements = Array.isArray(contract.requiredBeforeClosingApp)
    ? contract.requiredBeforeClosingApp.map((item) => String(item || ""))
    : [];
  const missing = (expectedContract?.requiredBeforeClosingApp || COMMON_APP_CLOSE_REQUIREMENTS).filter((item) => !requirements.includes(item));
  if (missing.length) {
    add("app-close-contract", "Before-close requirements missing", `Missing app-close requirement(s): ${missing.join(", ")}.`);
  }
}
