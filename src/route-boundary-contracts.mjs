const DEFAULT_NATIVE_BOUNDARY = {
  tauriCommand: "execute_cleanup_plan",
  adapterFunction: "",
  rustFunction: "",
  requestShape: [],
  targetAllowlist: ["Use only the native-scanned target for the selected route."],
  targetRejects: ["custom roots", "system folders", "personal folders outside the selected route"],
  deletePolicy: ["Mutation is scoped to the selected route-specific native executor only."],
  postRunProof: ["execution ledger", "native volume proof", "post-run native rescan"]
};

const ROUTE_NATIVE_BOUNDARIES = {
  "bounded-npm-cache-delete": {
    tauriCommand: "execute_cleanup_plan",
    adapterFunction: "runNativeNpmCacheExecutor",
    rustFunction: "execute_npm_cache_cleanup",
    requestShape: [
      "schemaVersion=spaceguard-npm-cache-request/v1",
      "requestMode=execute-npm-cache",
      "route=bounded-npm-cache-delete",
      "dryRunOnly=false",
      "mutationAttempted=true",
      "planId, scanFingerprint, consentPlanId, expectedBytes, and one action required"
    ],
    targetAllowlist: [
      "current user %LocalAppData%\\npm-cache\\_cacache only",
      "target must come from the latest native-scanned npm-cache finding",
      "target must be a real directory, not a symlink"
    ],
    targetRejects: [
      "node_modules",
      "global npm packages",
      "AppData\\Roaming\\npm",
      "Program Files",
      "ProgramData",
      "Windows",
      "Downloads, Documents, Desktop"
    ],
    deletePolicy: [
      "Deletes only age-gated files under _cacache\\content-v2 and _cacache\\tmp.",
      "Skips npm index metadata outside content-v2/tmp.",
      "Skips lock files.",
      "Skips symlinks and unreadable entries.",
      "Removes only empty cache subdirectories below _cacache."
    ],
    postRunProof: [
      "execution ledger entry for bounded-npm-cache-delete",
      "native GetDiskFreeSpaceExW before/after volume proof",
      "post-run native rescan comparison",
      "accepted spaceguard-real-workflow-proof/v1 check"
    ]
  },
  "bounded-pnpm-store-delete": {
    tauriCommand: "execute_cleanup_plan",
    adapterFunction: "runNativePnpmStoreExecutor",
    rustFunction: "execute_pnpm_store_cleanup",
    requestShape: [
      "schemaVersion=spaceguard-pnpm-store-request/v1",
      "requestMode=execute-pnpm-store",
      "route=bounded-pnpm-store-delete",
      "dryRunOnly=false",
      "mutationAttempted=true",
      "planId, scanFingerprint, consentPlanId, expectedBytes, and one action required"
    ],
    targetAllowlist: [
      "current user %LocalAppData%\\pnpm\\store only",
      "target must come from the latest native-scanned pnpm-store finding",
      "target must be a real directory, not a symlink"
    ],
    targetRejects: [
      "project node_modules",
      "global pnpm bins",
      "AppData\\Roaming\\pnpm",
      "pnpm\\global",
      "Program Files",
      "ProgramData",
      "Windows",
      "Downloads, Documents, Desktop"
    ],
    deletePolicy: [
      "Deletes only age-gated files under versioned store files roots, store files, tmp, and temp.",
      "Skips pnpm store metadata outside files/tmp/temp.",
      "Skips symlinks and unreadable entries.",
      "Removes only empty store subdirectories below the pnpm store root."
    ],
    postRunProof: [
      "execution ledger entry for bounded-pnpm-store-delete",
      "native GetDiskFreeSpaceExW before/after volume proof",
      "post-run native rescan comparison",
      "accepted spaceguard-real-workflow-proof/v1 check"
    ]
  }
};

function cloneList(value = []) {
  return Array.isArray(value) ? value.map((row) => String(row || "")).filter(Boolean) : [];
}

function cloneBoundary(boundary = null) {
  const source = boundary || DEFAULT_NATIVE_BOUNDARY;
  return {
    tauriCommand: source.tauriCommand || DEFAULT_NATIVE_BOUNDARY.tauriCommand,
    adapterFunction: source.adapterFunction || "",
    rustFunction: source.rustFunction || "",
    requestShape: cloneList(source.requestShape),
    targetAllowlist: cloneList(source.targetAllowlist),
    targetRejects: cloneList(source.targetRejects),
    deletePolicy: cloneList(source.deletePolicy),
    postRunProof: cloneList(source.postRunProof)
  };
}

export function getRouteNativeBoundary(route = "") {
  return cloneBoundary(ROUTE_NATIVE_BOUNDARIES[String(route || "").trim()] || null);
}

export function buildRouteNativeBoundary(selected = {}) {
  const boundary = getRouteNativeBoundary(selected?.route || "");
  const requestShape = boundary.requestShape.length
    ? boundary.requestShape
    : [
        `requestMode=${selected?.requestMode || ""}`,
        "dryRunOnly=false",
        "mutationAttempted=true",
        "planId, scanFingerprint, and consentPlanId required"
      ];

  return {
    ...boundary,
    requestShape,
    targetAllowlist: boundary.targetAllowlist.length ? boundary.targetAllowlist : cloneList(DEFAULT_NATIVE_BOUNDARY.targetAllowlist),
    targetRejects: boundary.targetRejects.length ? boundary.targetRejects : cloneList(DEFAULT_NATIVE_BOUNDARY.targetRejects),
    deletePolicy: boundary.deletePolicy.length ? boundary.deletePolicy : cloneList(DEFAULT_NATIVE_BOUNDARY.deletePolicy),
    postRunProof: boundary.postRunProof.length ? boundary.postRunProof : cloneList(DEFAULT_NATIVE_BOUNDARY.postRunProof)
  };
}
