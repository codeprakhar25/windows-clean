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
  "known-temp-delete": {
    tauriCommand: "execute_cleanup_plan",
    adapterFunction: "runNativeTempCleanupExecutor",
    rustFunction: "execute_first_safe_temp_cleanup",
    requestShape: [
      "schemaVersion=spaceguard-write-boundary-request/v1",
      "requestMode=execute-first-safe",
      "route=known-temp-delete",
      "dryRunOnly=false",
      "mutationAttempted=true",
      "planId, scanFingerprint, consentPlanId, expectedBytes, and one or more actions required"
    ],
    targetAllowlist: [
      "allowlisted Windows temp roots only",
      "current user's allowlisted temp child roots",
      "target must be a real directory, not a symlink"
    ],
    targetRejects: [
      "Downloads",
      "Documents",
      "Desktop",
      "browser identity stores",
      "Program Files",
      "ProgramData",
      "Windows outside allowlisted temp roots"
    ],
    deletePolicy: [
      "Deletes only old files under allowlisted temp roots.",
      "Skips symlinks and unreadable entries.",
      "Removes only empty directories below the selected temp root."
    ],
    postRunProof: [
      "execution ledger entry for known-temp-delete",
      "native GetDiskFreeSpaceExW before/after volume proof",
      "post-run native rescan comparison",
      "accepted spaceguard-real-workflow-proof/v1 check"
    ]
  },
  "item-review-recycle-bin": {
    tauriCommand: "execute_cleanup_plan",
    adapterFunction: "runNativeDownloadsCleanupExecutor",
    rustFunction: "execute_downloads_review_cleanup",
    requestShape: [
      "schemaVersion=spaceguard-downloads-recycle-bin-request/v1",
      "requestMode=execute-downloads-recycle-bin",
      "route=item-review-recycle-bin",
      "dryRunOnly=false",
      "mutationAttempted=true",
      "planId, scanFingerprint, consentPlanId, expectedBytes, and reviewed actions required"
    ],
    targetAllowlist: [
      "reviewed files under the current user's Downloads folder only",
      "installer/archive file candidates selected by the user",
      "target must be a real file, not a symlink"
    ],
    targetRejects: [
      "unreviewed Downloads folders",
      "folders outside Downloads",
      "recent files",
      "non-installer/non-archive files",
      "Program Files",
      "Windows",
      "custom roots"
    ],
    deletePolicy: [
      "Moves only reviewed Downloads installer/archive targets through Recycle Bin semantics.",
      "Skips folders, symlinks, and unreadable entries.",
      "Does not empty the Recycle Bin or delete arbitrary Downloads contents."
    ],
    postRunProof: [
      "execution ledger entry for item-review-recycle-bin",
      "native GetDiskFreeSpaceExW before/after volume proof",
      "post-run native rescan comparison",
      "accepted spaceguard-real-workflow-proof/v1 check"
    ]
  },
  "item-review-large-files": {
    tauriCommand: "execute_cleanup_plan",
    adapterFunction: "runNativeLargeFileArchiveExecutor",
    rustFunction: "execute_large_file_archive_cleanup",
    requestShape: [
      "schemaVersion=spaceguard-large-file-archive-request/v1",
      "requestMode=execute-large-file-archive",
      "route=item-review-large-files",
      "dryRunOnly=false",
      "mutationAttempted=true",
      "archiveDestination and reviewed actions required"
    ],
    targetAllowlist: [
      "reviewed old large files under allowed current-user folders only",
      "explicit existing archive destination required",
      "target must be a real file, not a symlink"
    ],
    targetRejects: [
      "folders",
      "recent files",
      "small files",
      "files outside allowed user folders",
      "system folders",
      "missing archive destination",
      "custom roots without review"
    ],
    deletePolicy: [
      "Archives or moves only reviewed large-file targets to the configured destination.",
      "Skips symlinks and unreadable entries.",
      "Does not delete personal folders or choose destinations automatically."
    ],
    postRunProof: [
      "execution ledger entry for item-review-large-files",
      "native GetDiskFreeSpaceExW before/after volume proof",
      "post-run native rescan comparison",
      "accepted spaceguard-real-workflow-proof/v1 check"
    ]
  },
  "item-review-project-cache": {
    tauriCommand: "execute_cleanup_plan",
    adapterFunction: "runNativeProjectDependencyExecutor",
    rustFunction: "execute_project_dependency_cleanup",
    requestShape: [
      "schemaVersion=spaceguard-project-deps-request/v1",
      "requestMode=execute-project-deps",
      "route=item-review-project-cache",
      "dryRunOnly=false",
      "mutationAttempted=true",
      "planId, scanFingerprint, consentPlanId, expectedBytes, and reviewed actions required"
    ],
    targetAllowlist: [
      "reviewed project dependency folders only",
      "node_modules or equivalent dependency folders with project metadata",
      "target must be a real directory, not a symlink"
    ],
    targetRejects: [
      "project source folders",
      "package files",
      "lockfiles",
      "global package stores",
      "Program Files",
      "Windows",
      "custom roots without review"
    ],
    deletePolicy: [
      "Deletes only user-reviewed rebuildable dependency folders.",
      "Skips symlinks and unreadable entries.",
      "Does not delete source files, lockfiles, or package metadata."
    ],
    postRunProof: [
      "execution ledger entry for item-review-project-cache",
      "native GetDiskFreeSpaceExW before/after volume proof",
      "post-run native rescan comparison",
      "accepted spaceguard-real-workflow-proof/v1 check"
    ]
  },
  "browser-cache-only": {
    tauriCommand: "execute_cleanup_plan",
    adapterFunction: "runNativeBrowserCacheExecutor",
    rustFunction: "execute_browser_cache_cleanup",
    requestShape: [
      "schemaVersion=spaceguard-browser-cache-request/v1",
      "requestMode=execute-browser-cache",
      "route=browser-cache-only",
      "dryRunOnly=false",
      "mutationAttempted=true",
      "planId, scanFingerprint, consentPlanId, expectedBytes, and scanned cache actions required"
    ],
    targetAllowlist: [
      "latest native-scanned browser cache roots only",
      "cache and code-cache directories under browser profiles",
      "target must be a real directory, not a symlink"
    ],
    targetRejects: [
      "cookies",
      "sessions",
      "saved logins",
      "extensions",
      "history",
      "profile identity stores",
      "browser profile root"
    ],
    deletePolicy: [
      "Deletes only old cache files inside scanned browser cache roots.",
      "Skips identity, credential, history, extension, and session stores.",
      "Skips symlinks and unreadable entries."
    ],
    postRunProof: [
      "execution ledger entry for browser-cache-only",
      "native GetDiskFreeSpaceExW before/after volume proof",
      "post-run native rescan comparison",
      "accepted spaceguard-real-workflow-proof/v1 check"
    ]
  },
  "bounded-cache-delete": {
    tauriCommand: "execute_cleanup_plan",
    adapterFunction: "runNativeGradleCacheExecutor",
    rustFunction: "execute_gradle_cache_cleanup",
    requestShape: [
      "schemaVersion=spaceguard-gradle-cache-request/v1",
      "requestMode=execute-gradle-cache",
      "route=bounded-cache-delete",
      "dryRunOnly=false",
      "mutationAttempted=true",
      "planId, scanFingerprint, consentPlanId, expectedBytes, and one action required"
    ],
    targetAllowlist: [
      "current user's .gradle\\caches root only",
      "target must come from the latest native-scanned gradle-cache finding",
      "target must be a real directory, not a symlink"
    ],
    targetRejects: [
      "Gradle wrapper files",
      "Gradle daemon state",
      "init scripts",
      "project source folders",
      "lock files",
      "Program Files",
      "Windows"
    ],
    deletePolicy: [
      "Deletes only old rebuildable files under .gradle\\caches.",
      "Skips Gradle metadata, wrappers, daemon state, lock files, symlinks, and unreadable entries.",
      "Removes only empty cache directories below the selected cache root."
    ],
    postRunProof: [
      "execution ledger entry for bounded-cache-delete",
      "native GetDiskFreeSpaceExW before/after volume proof",
      "post-run native rescan comparison",
      "accepted spaceguard-real-workflow-proof/v1 check"
    ]
  },
  "bounded-user-cache-delete": {
    tauriCommand: "execute_cleanup_plan",
    adapterFunction: "runNativeUserCacheExecutor",
    rustFunction: "execute_user_cache_cleanup",
    requestShape: [
      "schemaVersion=spaceguard-user-cache-request/v1",
      "requestMode=execute-user-cache",
      "route=bounded-user-cache-delete",
      "dryRunOnly=false",
      "mutationAttempted=true",
      "planId, scanFingerprint, consentPlanId, expectedBytes, and one action required"
    ],
    targetAllowlist: [
      "current user's .cache root only",
      "target must come from the latest native-scanned user-cache finding",
      "target must be a real directory, not a symlink"
    ],
    targetRejects: [
      "configuration files",
      "databases",
      "credential-like files",
      "session data",
      "logs",
      "lock files",
      "project folders"
    ],
    deletePolicy: [
      "Deletes only old cache-like files under the current user's .cache root.",
      "Skips config, database, credential, session, log, lock, symlink, and unreadable entries.",
      "Removes only empty cache directories below .cache."
    ],
    postRunProof: [
      "execution ledger entry for bounded-user-cache-delete",
      "native GetDiskFreeSpaceExW before/after volume proof",
      "post-run native rescan comparison",
      "accepted spaceguard-real-workflow-proof/v1 check"
    ]
  },
  "bounded-android-cache-delete": {
    tauriCommand: "execute_cleanup_plan",
    adapterFunction: "runNativeAndroidCacheExecutor",
    rustFunction: "execute_android_cache_cleanup",
    requestShape: [
      "schemaVersion=spaceguard-android-cache-request/v1",
      "requestMode=execute-android-cache",
      "route=bounded-android-cache-delete",
      "dryRunOnly=false",
      "mutationAttempted=true",
      "planId, scanFingerprint, consentPlanId, expectedBytes, and scanned cache actions required"
    ],
    targetAllowlist: [
      "native-scanned Android Studio cache roots only",
      "current user's .android\\build-cache root",
      "target must be a real directory, not a symlink"
    ],
    targetRejects: [
      "Android SDKs",
      "AVDs",
      "emulators",
      "project folders",
      "Gradle data outside the selected Android cache",
      "Program Files",
      "Windows"
    ],
    deletePolicy: [
      "Deletes only old cache files under scanned Android cache roots.",
      "Skips SDKs, AVDs, emulators, project folders, symlinks, and unreadable entries.",
      "Removes only empty cache directories below the selected Android cache root."
    ],
    postRunProof: [
      "execution ledger entry for bounded-android-cache-delete",
      "native GetDiskFreeSpaceExW before/after volume proof",
      "post-run native rescan comparison",
      "accepted spaceguard-real-workflow-proof/v1 check"
    ]
  },
  "launcher-cache-cleanup": {
    tauriCommand: "execute_cleanup_plan",
    adapterFunction: "runNativeShaderCacheExecutor",
    rustFunction: "execute_shader_cache_cleanup",
    requestShape: [
      "schemaVersion=spaceguard-shader-cache-request/v1",
      "requestMode=execute-shader-cache",
      "route=launcher-cache-cleanup",
      "dryRunOnly=false",
      "mutationAttempted=true",
      "planId, scanFingerprint, consentPlanId, expectedBytes, and scanned cache actions required"
    ],
    targetAllowlist: [
      "native-scanned current-user graphics shader cache roots only",
      "launcher or GPU shader cache directories",
      "target must be a real directory, not a symlink"
    ],
    targetRejects: [
      "game installs",
      "save data",
      "launcher profiles",
      "configuration stores",
      "package folders",
      "Program Files game folders",
      "Windows"
    ],
    deletePolicy: [
      "Deletes only old shader-cache files under scanned shader cache roots.",
      "Skips installs, saves, profiles, config stores, symlinks, and unreadable entries.",
      "Removes only empty cache directories below the selected shader cache root."
    ],
    postRunProof: [
      "execution ledger entry for launcher-cache-cleanup",
      "native GetDiskFreeSpaceExW before/after volume proof",
      "post-run native rescan comparison",
      "accepted spaceguard-real-workflow-proof/v1 check"
    ]
  },
  "bounded-pip-cache-delete": {
    tauriCommand: "execute_cleanup_plan",
    adapterFunction: "runNativePipCacheExecutor",
    rustFunction: "execute_pip_cache_cleanup",
    requestShape: [
      "schemaVersion=spaceguard-pip-cache-request/v1",
      "requestMode=execute-pip-cache",
      "route=bounded-pip-cache-delete",
      "dryRunOnly=false",
      "mutationAttempted=true",
      "planId, scanFingerprint, consentPlanId, expectedBytes, and one action required"
    ],
    targetAllowlist: [
      "current user's pip\\Cache root only",
      "target must come from the latest native-scanned pip-cache finding",
      "target must be a real directory, not a symlink"
    ],
    targetRejects: [
      "Python installs",
      "virtualenvs",
      "site-packages",
      "pip config",
      "project folders",
      "package-manager commands",
      "Program Files"
    ],
    deletePolicy: [
      "Deletes only old pip cache files under the current user's pip\\Cache root.",
      "Skips config, virtualenvs, Python installs, site-packages, symlinks, and unreadable entries.",
      "Removes only empty cache directories below pip\\Cache."
    ],
    postRunProof: [
      "execution ledger entry for bounded-pip-cache-delete",
      "native GetDiskFreeSpaceExW before/after volume proof",
      "post-run native rescan comparison",
      "accepted spaceguard-real-workflow-proof/v1 check"
    ]
  },
  "tool-native-docker-build-cache-prune": {
    tauriCommand: "execute_cleanup_plan",
    adapterFunction: "runNativeDockerBuildCacheExecutor",
    rustFunction: "execute_docker_build_cache_cleanup",
    requestShape: [
      "schemaVersion=spaceguard-docker-build-cache-request/v1",
      "requestMode=execute-docker-build-cache",
      "route=tool-native-docker-build-cache-prune",
      "dryRunOnly=false",
      "mutationAttempted=true",
      "planId, scanFingerprint, consentPlanId, expectedBytes, and Docker CLI inventory required"
    ],
    targetAllowlist: [
      "Docker Desktop build cache inventory only",
      "allowlisted docker builder prune --force command only",
      "target must come from the latest native Docker build-cache finding"
    ],
    targetRejects: [
      "Docker volumes",
      "running containers",
      "images",
      "Docker data-root folders",
      "shell commands",
      "docker system prune",
      "arbitrary filesystem paths"
    ],
    deletePolicy: [
      "Runs only the allowlisted docker builder prune --force command.",
      "Does not prune volumes, images, containers, system state, or arbitrary folders.",
      "Requires Docker CLI inventory from the latest native scan."
    ],
    postRunProof: [
      "execution ledger entry for tool-native-docker-build-cache-prune",
      "native GetDiskFreeSpaceExW before/after volume proof",
      "post-run native rescan comparison",
      "accepted spaceguard-real-workflow-proof/v1 check"
    ]
  },
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
  },
  "shell-recycle-bin": {
    tauriCommand: "execute_cleanup_plan",
    adapterFunction: "runNativeRecycleBinExecutor",
    rustFunction: "execute_recycle_bin_cleanup",
    requestShape: [
      "schemaVersion=spaceguard-recycle-bin-request/v1",
      "requestMode=execute-recycle-bin",
      "route=shell-recycle-bin",
      "dryRunOnly=false",
      "mutationAttempted=true",
      "permanentRemovalConfirmed=true, planId, scanFingerprint, consentPlanId, expectedBytes, and one action required"
    ],
    targetAllowlist: [
      "selected drive's Shell Recycle Bin only",
      "target must come from the latest native-scanned recycle-bin finding",
      "permanent-removal confirmation must be typed in the app"
    ],
    targetRejects: [
      "personal folders outside Recycle Bin",
      "Program Files",
      "ProgramData",
      "Windows",
      "custom roots",
      "missing permanent-removal confirmation"
    ],
    deletePolicy: [
      "Permanently removes only selected Recycle Bin contents after explicit app confirmation.",
      "Does not delete files directly from user folders.",
      "Requires post-run rescan and proof before any next route."
    ],
    postRunProof: [
      "execution ledger entry for shell-recycle-bin",
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
