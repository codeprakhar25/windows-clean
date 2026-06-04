export const GB = 1024 ** 3;
export const MB = 1024 ** 2;

export const profile = {
  machine: "Demo Windows 11 workstation",
  drive: "C:",
  totalBytes: 512 * GB,
  usedBytes: 493 * GB,
  freeBytes: 19 * GB,
  lastScan: "Dry-run sample profile",
  mode: "demo",
  note: "No local file access is used in this prototype."
};

export const scenarios = [
  {
    id: "developer",
    label: "Developer workstation",
    description: "Heavy package caches, containers, WSL, and project artifacts.",
    profile: {
      ...profile,
      machine: "Demo developer workstation",
      totalBytes: 512 * GB,
      usedBytes: 493 * GB,
      freeBytes: 19 * GB
    },
    multipliers: {
      "Developer caches": 1.25,
      "Project artifacts": 1.2,
      Containers: 1.2,
      Virtualization: 1.15,
      Games: 0.55
    }
  },
  {
    id: "gamer",
    label: "Gaming laptop",
    description: "Large launcher caches, downloads, browser cache, and full primary drive.",
    profile: {
      ...profile,
      machine: "Demo gaming laptop",
      totalBytes: 1024 * GB,
      usedBytes: 948 * GB,
      freeBytes: 76 * GB
    },
    multipliers: {
      Games: 3.2,
      "User files": 1.45,
      Browsers: 1.15,
      "Developer caches": 0.35,
      Containers: 0.2,
      Virtualization: 0.2
    }
  },
  {
    id: "family",
    label: "Family laptop",
    description: "Downloads, browser data, old installers, and Windows cleanup opportunities.",
    profile: {
      ...profile,
      machine: "Demo family laptop",
      totalBytes: 256 * GB,
      usedBytes: 241 * GB,
      freeBytes: 15 * GB
    },
    multipliers: {
      "User files": 2.1,
      Browsers: 1.6,
      Windows: 1.15,
      "Developer caches": 0.15,
      "Project artifacts": 0.1,
      Containers: 0,
      Virtualization: 0
    }
  }
];

export const gates = {
  auto: {
    label: "Auto-safe",
    description: "Can be included after the user starts cleanup."
  },
  groupConfirm: {
    label: "Confirm",
    description: "Requires category approval because the data is rebuildable but useful."
  },
  permanentConfirm: {
    label: "Permanent confirm",
    description: "Requires explicit approval because the action permanently removes already-discarded data."
  },
  review: {
    label: "Review",
    description: "Requires item review because the data may be personal or project-specific."
  },
  typed: {
    label: "Typed gate",
    description: "Requires a typed acknowledgement because the change alters system behavior."
  },
  blocked: {
    label: "Blocked",
    description: "The agent will not execute this action."
  },
  advisory: {
    label: "Advisory",
    description: "The agent can explain the strategy but cannot perform it."
  }
};

const riskOrder = {
  safe: 0,
  rebuildable: 1,
  review: 2,
  advanced: 3,
  restricted: 4,
  advisory: 5
};

export const demoReviewItems = {
  "downloads-installers": [
    {
      id: "downloads-installers-vscode",
      name: "VSCodeUserSetup-x64-1.91.1.exe",
      path: "C:\\Users\\demo\\Downloads\\VSCodeUserSetup-x64-1.91.1.exe",
      bytes: 138 * MB,
      ageDays: 126,
      kind: "installer",
      recommendation: "review",
      reason: "Old installer; usually safe after the app is installed."
    },
    {
      id: "downloads-installers-android",
      name: "android-studio-2025.1.1.exe",
      path: "C:\\Users\\demo\\Downloads\\android-studio-2025.1.1.exe",
      bytes: 1.3 * GB,
      ageDays: 82,
      kind: "installer",
      recommendation: "review",
      reason: "Large installer package. Keep only if reinstall is likely."
    },
    {
      id: "downloads-installers-archive",
      name: "client-assets-final-v3.zip",
      path: "C:\\Users\\demo\\Downloads\\client-assets-final-v3.zip",
      bytes: 2.8 * GB,
      ageDays: 41,
      kind: "archive",
      recommendation: "keep",
      reason: "Archive-like personal/project data; never auto-clean."
    },
    {
      id: "downloads-installers-iso",
      name: "Win11_24H2_English_x64.iso",
      path: "C:\\Users\\demo\\Downloads\\Win11_24H2_English_x64.iso",
      bytes: 5.4 * GB,
      ageDays: 73,
      kind: "disk image",
      recommendation: "review",
      reason: "Large OS image; useful only if actively needed."
    }
  ],
  "large-user-files": [
    {
      id: "large-user-files-video",
      name: "screen-recording-final.mp4",
      path: "C:\\Users\\demo\\Videos\\screen-recording-final.mp4",
      bytes: 6.8 * GB,
      ageDays: 67,
      kind: "large video",
      recommendation: "keep",
      reason: "Large personal media; move/archive only after review."
    },
    {
      id: "large-user-files-vm",
      name: "ubuntu-lab-backup.vdi",
      path: "C:\\Users\\demo\\Documents\\VMs\\ubuntu-lab-backup.vdi",
      bytes: 18.4 * GB,
      ageDays: 154,
      kind: "virtual disk",
      recommendation: "review",
      reason: "Large backup-like virtual disk; verify it is not active before moving or deleting."
    },
    {
      id: "large-user-files-export",
      name: "client-export-raw.mov",
      path: "C:\\Users\\demo\\Downloads\\client-export-raw.mov",
      bytes: 9.2 * GB,
      ageDays: 96,
      kind: "large media export",
      recommendation: "keep",
      reason: "Potential client/project data; never auto-clean."
    },
    {
      id: "large-user-files-zip",
      name: "old-photos-archive.zip",
      path: "C:\\Users\\demo\\Desktop\\old-photos-archive.zip",
      bytes: 4.6 * GB,
      ageDays: 220,
      kind: "archive",
      recommendation: "review",
      reason: "Old large archive; likely a candidate for external storage after review."
    }
  ],
  "node-modules-old": [
    {
      id: "node-modules-old-dashboard",
      name: "node_modules",
      path: "C:\\Users\\demo\\Code\\old-dashboard\\node_modules",
      bytes: 4.9 * GB,
      ageDays: 92,
      kind: "project dependency folder",
      recommendation: "review",
      reason: "Project dependency cache untouched for 90+ days."
    },
    {
      id: "node-modules-old-client",
      name: "node_modules",
      path: "C:\\Users\\demo\\Code\\client-work\\node_modules",
      bytes: 7.1 * GB,
      ageDays: 8,
      kind: "project dependency folder",
      recommendation: "keep",
      reason: "Recently used project; protect or review manually."
    },
    {
      id: "node-modules-old-prototype",
      name: "node_modules",
      path: "C:\\Users\\demo\\Code\\prototype-2024\\node_modules",
      bytes: 3.6 * GB,
      ageDays: 184,
      kind: "project dependency folder",
      recommendation: "review",
      reason: "Old prototype dependency folder can usually be recreated."
    }
  ],
  "android-studio": [
    {
      id: "android-studio-pixel-7",
      name: "Pixel_7_API_33.avd",
      path: "C:\\Users\\demo\\.android\\avd\\Pixel_7_API_33.avd",
      bytes: 6.2 * GB,
      ageDays: 118,
      kind: "emulator image",
      recommendation: "review",
      reason: "Old emulator image; remove only if not needed for testing."
    },
    {
      id: "android-studio-cache",
      name: "AndroidStudio cache",
      path: "C:\\Users\\demo\\AppData\\Local\\Google\\AndroidStudio2024.3\\caches",
      bytes: 1.7 * GB,
      ageDays: 26,
      kind: "IDE cache",
      recommendation: "review",
      reason: "Rebuildable cache, but may slow the next IDE launch."
    }
  ]
};

export const executorPolicies = {
  "windows-temp": {
    route: "known-temp-delete",
    lane: "safe",
    label: "Known temp cleanup",
    realRunEnabled: false,
    dryRunSupported: true,
    requiresNativeValidation: true,
    verification: "Rescan temp roots and compare skipped locked files.",
    guardrails: ["Only known temp roots", "Skip locked files", "Never expand wildcards outside allowed roots"]
  },
  "recycle-bin": {
    route: "shell-recycle-bin",
    lane: "safe",
    label: "Recycle Bin empty",
    realRunEnabled: false,
    dryRunSupported: true,
    requiresNativeValidation: true,
    verification: "Query Recycle Bin size after execution.",
    guardrails: ["User-started only", "No arbitrary file deletion", "Ledger permanent-removal consequence"]
  },
  "browser-cache": {
    route: "browser-cache-only",
    lane: "safe",
    label: "Browser cache cleanup",
    realRunEnabled: false,
    dryRunSupported: true,
    requiresNativeValidation: true,
    verification: "Rescan cache directories; identity stores remain untouched.",
    guardrails: ["Cache folders only", "No cookies", "No sessions", "No saved logins", "No extensions"]
  },
  "gradle-cache": {
    route: "bounded-cache-delete",
    lane: "rebuildable",
    label: "Bounded Gradle cache cleanup",
    realRunEnabled: false,
    dryRunSupported: true,
    requiresNativeValidation: true,
    verification: "Rescan Gradle cache and keep daemon metadata.",
    guardrails: ["Age threshold", "User profile only", "No project source directories"]
  },
  "npm-cache": {
    route: "tool-native-prune",
    lane: "tool-native",
    label: "npm cache command",
    realRunEnabled: false,
    dryRunSupported: true,
    requiresNativeValidation: true,
    verification: "Run package-manager verification before size comparison.",
    guardrails: ["Prefer npm cache verify", "No global package removal", "No project node_modules deletion"]
  },
  "pnpm-store": {
    route: "tool-native-prune",
    lane: "tool-native",
    label: "pnpm store prune",
    realRunEnabled: false,
    dryRunSupported: true,
    requiresNativeValidation: true,
    verification: "Rescan store after tool-native prune.",
    guardrails: ["Tool-native prune only", "No direct store wipe", "No project source directories"]
  },
  "docker-build-cache": {
    route: "tool-native-prune",
    lane: "tool-native",
    label: "Docker build-cache prune",
    realRunEnabled: false,
    dryRunSupported: true,
    requiresNativeValidation: true,
    verification: "Compare Docker build-cache inventory before and after.",
    guardrails: ["Build cache only", "No volumes", "No running containers", "No images without explicit review"]
  },
  "windows-old": {
    route: "windows-cleanup-api",
    lane: "admin-rebuildable",
    label: "Windows cleanup API",
    realRunEnabled: false,
    dryRunSupported: true,
    requiresNativeValidation: true,
    verification: "Verify rollback path consequence and rescan Windows.old.",
    guardrails: ["Use Windows cleanup API", "No direct system-directory delete", "Require stable install acknowledgement"]
  },
  "steam-shader-cache": {
    route: "launcher-cache-cleanup",
    lane: "rebuildable",
    label: "Launcher cache cleanup",
    realRunEnabled: false,
    dryRunSupported: true,
    requiresNativeValidation: true,
    verification: "Rescan launcher cache roots only.",
    guardrails: ["Cache roots only", "No game uninstall", "No save-data paths"]
  },
  "downloads-installers": {
    route: "item-review-recycle-bin",
    lane: "review",
    label: "Reviewed item move",
    realRunEnabled: false,
    dryRunSupported: true,
    requiresNativeValidation: true,
    verification: "Move reviewed items through Recycle Bin or quarantine, then rescan.",
    guardrails: ["Item-level review", "No arbitrary Downloads wipe", "Prefer Recycle Bin"]
  },
  "large-user-files": {
    route: "item-review-large-files",
    lane: "review",
    label: "Reviewed large-file handling",
    realRunEnabled: false,
    dryRunSupported: true,
    requiresNativeValidation: true,
    verification: "Move reviewed files through Recycle Bin or archive target, then rescan.",
    guardrails: ["Item-level review", "No auto-delete personal files", "Prefer move/archive guidance", "Protected folders excluded"]
  },
  "node-modules-old": {
    route: "item-review-project-cache",
    lane: "review",
    label: "Reviewed project dependency cleanup",
    realRunEnabled: false,
    dryRunSupported: true,
    requiresNativeValidation: true,
    verification: "Confirm selected project folders are gone and source remains.",
    guardrails: ["Item-level review", "No source files", "No protected client work"]
  },
  "android-studio": {
    route: "item-review-tooling-cache",
    lane: "review",
    label: "Reviewed Android tooling cleanup",
    realRunEnabled: false,
    dryRunSupported: true,
    requiresNativeValidation: true,
    verification: "Rescan selected emulator/cache entries.",
    guardrails: ["Item-level review", "No unknown app data", "Keep current SDKs unless selected"]
  },
  "wsl-vhdx": {
    route: "advanced-checklist",
    lane: "advanced",
    label: "WSL compaction checklist",
    realRunEnabled: false,
    dryRunSupported: true,
    requiresNativeValidation: true,
    verification: "Verify distro boots and VHDX size changed.",
    guardrails: ["Typed acknowledgement", "Backup first", "WSL shutdown required", "No interruption"]
  },
  hibernation: {
    route: "advanced-system-toggle",
    lane: "advanced",
    label: "Hibernation toggle",
    realRunEnabled: false,
    dryRunSupported: true,
    requiresNativeValidation: true,
    verification: "Verify hiberfil.sys state and power setting consequence.",
    guardrails: ["Typed acknowledgement", "No pagefile tuning", "Explain Fast Startup impact"]
  },
  "docker-volumes": {
    route: "blocked",
    lane: "blocked",
    label: "Blocked by policy",
    realRunEnabled: false,
    dryRunSupported: false,
    requiresNativeValidation: false,
    verification: "No execution path.",
    guardrails: ["Can contain databases", "Manual inspection only"]
  },
  "browser-identity": {
    route: "blocked",
    lane: "blocked",
    label: "Blocked by policy",
    realRunEnabled: false,
    dryRunSupported: false,
    requiresNativeValidation: false,
    verification: "No execution path.",
    guardrails: ["No cookies", "No saved logins", "No session stores"]
  },
  pagefile: {
    route: "blocked",
    lane: "blocked",
    label: "Blocked by policy",
    realRunEnabled: false,
    dryRunSupported: false,
    requiresNativeValidation: false,
    verification: "No execution path.",
    guardrails: ["No pagefile tuning", "Avoid memory instability"]
  },
  partitioning: {
    route: "advisory",
    lane: "advisory",
    label: "Advisory only",
    realRunEnabled: false,
    dryRunSupported: false,
    requiresNativeValidation: false,
    verification: "Manual backup-first strategy only.",
    guardrails: ["No partition writes", "No automation", "Backup-first guidance"]
  }
};

export const taskPowerDefinitions = [
  {
    id: "safe-cleanup",
    label: "Safe cleanup",
    description: "Known disposable roots such as temp files, browser caches, and Recycle Bin with its separate permanent-removal gate.",
    scope: "Exact allowlisted roots only.",
    guardrails: ["No arbitrary folder deletion", "Skip identity stores", "Recycle Bin needs permanent confirmation"]
  },
  {
    id: "rebuildable-cache-cleanup",
    label: "Rebuildable cache cleanup",
    description: "Tool and launcher caches that can be recreated but may cost time or downloads later.",
    scope: "Bounded cache roots and tool-native inventory routes.",
    guardrails: ["User confirmation required", "No project source folders", "Prefer official tool commands"]
  },
  {
    id: "reviewed-item-cleanup",
    label: "Reviewed item cleanup",
    description: "Downloads, large personal files, project artifacts, and Android tooling entries that require per-item decisions.",
    scope: "Only items explicitly marked Remove enter executor preview.",
    guardrails: ["Item-by-item review", "Move/archive remains manual", "Protected paths stay excluded"]
  },
  {
    id: "admin-cleanup",
    label: "Admin cleanup",
    description: "System-owned cleanup surfaces such as Windows.old that must be allowed at intake before planning.",
    scope: "Supported Windows cleanup surfaces only.",
    guardrails: ["Dry-run planning consent first", "No direct system-directory delete", "Real execution locked"]
  },
  {
    id: "advanced-system-strategy",
    label: "Advanced system strategy",
    description: "WSL compaction and system toggles that require typed acknowledgement and backup or rollback context.",
    scope: "Guided advanced workflows; no self-elevation.",
    guardrails: ["Typed acknowledgement", "Backup or restore path", "No pagefile tuning"]
  },
  {
    id: "manual-storage-strategy",
    label: "Manual storage strategy",
    description: "Drive migration, uninstall, archive, and partition planning when cleanup alone cannot hit the goal.",
    scope: "Advice and evidence tracking only.",
    guardrails: ["No automated partition writes", "No automated uninstall", "Backup-first"]
  },
  {
    id: "restricted-zones",
    label: "Restricted zones",
    description: "Data classes the agent can explain but will not clean automatically.",
    scope: "Visible for education and reporting only.",
    guardrails: ["No browser identity cleanup", "No Docker volume cleanup", "No registry or pagefile automation"]
  }
];

export const releaseFeatureFlags = {
  realExecutors: false,
  tempCleanupExecutor: false,
  recycleBinExecutor: false,
  browserCacheExecutor: false,
  toolNativePruneExecutors: false,
  reviewedItemExecutors: false,
  advancedSystemExecutors: false
};

export const toolNativeCommandSpecs = [
  {
    id: "npm-cache",
    tool: "npm",
    actionId: "npm-cache",
    route: "tool-native-prune",
    title: "npm cache",
    inspectCommand: "npm cache verify",
    futureCommand: "npm cache clean --force",
    status: "future-disabled",
    evidence: "Verify cache index first; compare native cache root size before and after.",
    guardrails: ["No global package removal", "No project node_modules deletion", "No shell execution in current build"]
  },
  {
    id: "pnpm-store",
    tool: "pnpm",
    actionId: "pnpm-store",
    route: "tool-native-prune",
    title: "pnpm store",
    inspectCommand: "pnpm store status",
    futureCommand: "pnpm store prune",
    status: "future-disabled",
    evidence: "Inventory store status first; prune only through pnpm when validation exists.",
    guardrails: ["No direct store wipe", "No project source deletion", "No shell execution in current build"]
  },
  {
    id: "docker-build-cache",
    tool: "docker",
    actionId: "docker-build-cache",
    route: "tool-native-prune",
    title: "Docker build cache",
    inspectCommand: "docker system df -v",
    futureCommand: "docker builder prune",
    status: "future-disabled",
    evidence: "Inventory Docker build cache separately from images, containers, and volumes.",
    guardrails: ["No Docker volumes", "No running containers", "No docker system prune --volumes", "No shell execution in current build"]
  },
  {
    id: "gradle-cache",
    tool: "gradle",
    actionId: "gradle-cache",
    route: "bounded-cache-delete",
    title: "Gradle cache",
    inspectCommand: "gradle --status",
    futureCommand: "bounded cache cleanup only",
    status: "manual-boundary",
    evidence: "Gradle has no universal safe prune command; use bounded age/root policy and rescan.",
    guardrails: ["No project source directories", "Keep daemon metadata", "No shell execution in current build"]
  },
  {
    id: "windows-cleanup-api",
    tool: "windows",
    actionId: "windows-old",
    route: "windows-cleanup-api",
    title: "Windows cleanup API",
    inspectCommand: "Windows cleanup API inventory",
    futureCommand: "supported Windows cleanup API call",
    status: "admin-future-disabled",
    evidence: "Use supported Windows cleanup surfaces only after admin boundary, rollback consequence, and backup evidence.",
    guardrails: ["No direct system-directory delete", "No registry cleanup", "No shell execution in current build"]
  }
];

export const windowsValidationChecks = [
  {
    id: "windows-native-build",
    label: "Windows native build",
    lane: "setup",
    requiredFor: "all-real-executors",
    evidence: "Tauri app builds and launches on Windows 11 with MSVC and WebView2."
  },
  {
    id: "scanner-fixtures",
    label: "Scanner fixture parity",
    lane: "scanner",
    requiredFor: "all-real-executors",
    evidence: "Known temp, Downloads, browser cache, npm, pnpm, Gradle, WSL, and protected-path fixtures match expected byte ranges."
  },
  {
    id: "protected-path-fixtures",
    label: "Protected path enforcement",
    lane: "guardrail",
    requiredFor: "all-real-executors",
    evidence: "Protected roots and child items are excluded from plans, native scan traversal, and executor previews."
  },
  {
    id: "browser-identity-fixtures",
    label: "Browser identity exclusion",
    lane: "guardrail",
    requiredFor: "browser-cache-only",
    evidence: "Cookies, sessions, logins, extension state, and profile databases remain untouched in every browser fixture."
  },
  {
    id: "temp-locked-files",
    label: "Locked temp files",
    lane: "executor",
    requiredFor: "known-temp-delete",
    evidence: "Executor skips locked temp files and records skipped bytes without failing the whole run."
  },
  {
    id: "recycle-bin-only",
    label: "Recycle Bin boundary",
    lane: "executor",
    requiredFor: "shell-recycle-bin",
    evidence: "Executor only touches items already in Recycle Bin and records permanent-removal consequence."
  },
  {
    id: "tool-native-dry-runs",
    label: "Tool-native dry runs",
    lane: "executor",
    requiredFor: "tool-native-prune",
    evidence: "npm, pnpm, Docker build-cache commands are inventoried without touching volumes, source, or running containers."
  },
  {
    id: "ledger-rescan-parity",
    label: "Ledger and rescan parity",
    lane: "verification",
    requiredFor: "all-real-executors",
    evidence: "Post-run rescan matches ledger within tolerance and skipped actions are visible."
  },
  {
    id: "rollback-story",
    label: "Rollback story",
    lane: "verification",
    requiredFor: "reviewed-item-executors",
    evidence: "Review-gated items use Recycle Bin or quarantine path where possible, with a clear restore note."
  },
  {
    id: "signing-and-smartscreen",
    label: "Signing and distribution",
    lane: "release",
    requiredFor: "public-beta",
    evidence: "Build is signed, install/uninstall path is tested, and privacy/support docs are ready."
  }
];

export const disposableVmScenarios = [
  {
    id: "win11-standard-user",
    label: "Windows 11 standard user",
    coverage: "No admin rights, low-risk scan, protected user folders.",
    mustPass: ["windows-native-build", "scanner-fixtures", "protected-path-fixtures", "ledger-rescan-parity"]
  },
  {
    id: "win11-admin-low-disk",
    label: "Windows 11 admin, low disk",
    coverage: "Full C: pressure, Windows.old, temp cleanup, hibernation visibility.",
    mustPass: ["windows-native-build", "scanner-fixtures", "temp-locked-files", "ledger-rescan-parity"]
  },
  {
    id: "browser-heavy-profile",
    label: "Browser-heavy profile",
    coverage: "Chrome, Edge, Firefox cache roots plus identity stores.",
    mustPass: ["browser-identity-fixtures", "ledger-rescan-parity"]
  },
  {
    id: "developer-toolchains",
    label: "Developer toolchains",
    coverage: "Gradle, npm, pnpm, Docker Desktop, WSL, old project artifacts.",
    mustPass: ["tool-native-dry-runs", "protected-path-fixtures", "ledger-rescan-parity"]
  },
  {
    id: "review-data",
    label: "Review-gated data",
    coverage: "Downloads archives, old node_modules folders, Android Studio emulator/cache entries.",
    mustPass: ["protected-path-fixtures", "rollback-story", "ledger-rescan-parity"]
  }
];

export const windowsValidationFixtures = [
  {
    id: "known-temp-fixture",
    lane: "scanner",
    label: "Known temp roots",
    seedPaths: ["%TEMP%\\spaceguard-fixture", "C:\\Windows\\Temp\\spaceguard-fixture"],
    setup: "Seed disposable files, one locked file, and one nested folder in the two known temp roots.",
    assertions: [
      "Scanner reports only the seeded known temp roots.",
      "Locked files are skipped or reported without failing the run.",
      "No path outside the allowlisted temp roots appears in the executor preview."
    ]
  },
  {
    id: "protected-path-fixture",
    lane: "guardrail",
    label: "Protected user roots",
    seedPaths: ["C:\\Users\\demo\\ClientWork", "C:\\Users\\demo\\Code\\client-work"],
    setup: "Add a protected path that contains cache-like children and review-gated candidates.",
    assertions: [
      "Protected parent and child paths are excluded from selected plans.",
      "Item review marks protected children as keep.",
      "Executor preview produces zero executable rows for protected matches."
    ]
  },
  {
    id: "browser-cache-fixture",
    lane: "guardrail",
    label: "Browser cache versus identity",
    seedPaths: ["Chrome Cache", "Edge Cache", "Firefox cache2", "Cookies", "Login Data", "Sessions", "Extensions"],
    setup: "Prepare browser profiles with cache files beside cookies, sessions, saved-login, and extension stores.",
    assertions: [
      "Scanner classifies cache roots separately from identity stores.",
      "Browser identity recipe remains policy-blocked.",
      "Executor preview never includes cookies, sessions, saved logins, or extensions."
    ]
  },
  {
    id: "developer-tooling-fixture",
    lane: "executor",
    label: "Developer tool caches",
    seedPaths: ["%UserProfile%\\.gradle\\caches", "%LocalAppData%\\npm-cache", "%LocalAppData%\\pnpm\\store", "Docker Desktop build cache"],
    setup: "Install or seed Gradle, npm, pnpm, and Docker build-cache data without creating Docker volumes as cleanup candidates.",
    assertions: [
      "Tool-native routes are classified as dry-run only.",
      "Docker volumes stay policy-blocked.",
      "Post-run ledger can be compared with a second read-only scan."
    ]
  },
  {
    id: "review-data-fixture",
    lane: "review",
    label: "Review-gated user and project data",
    seedPaths: ["C:\\Users\\demo\\Downloads", "C:\\Users\\demo\\Desktop", "C:\\Users\\demo\\Videos", "C:\\Users\\demo\\Code\\old-project\\node_modules", "%UserProfile%\\.android\\avd"],
    setup: "Seed old installers, archives, large personal files, project dependency folders, and Android emulator/cache entries.",
    assertions: [
      "Downloads are shown item-by-item and never auto-selected as arbitrary user files.",
      "Large personal files are discovery-only and require item review before any move/delete route.",
      "Project source files are not represented as cleanup candidates.",
      "Rollback or Recycle Bin behavior is documented before any reviewed-item executor can ship."
    ]
  }
];

export const windowsValidationCommands = [
  {
    id: "guardrail-tests",
    label: "Guardrail and adapter tests",
    command: "npm test",
    expected: "Guardrails, native adapter normalization, and static UI markers pass."
  },
  {
    id: "web-build",
    label: "Production web build",
    command: "npm run build",
    expected: "Vite production bundle builds without warnings that hide broken imports."
  },
  {
    id: "native-dev",
    label: "Windows desktop smoke test",
    command: "npm run native:dev",
    expected: "Tauri app launches on Windows and Run real scan returns read-only findings."
  },
  {
    id: "native-build",
    label: "Windows native build",
    command: "npm run native:build",
    expected: "Windows installer/app bundle builds with the MSVC toolchain and WebView2."
  }
];

export const executorRouteRequirements = {
  "known-temp-delete": {
    title: "Known temp roots",
    lane: "safe",
    phase: "first-safe",
    implementation: "Delete only entries under exact allowlisted temp roots, skip locked files, and never follow reparse points.",
    rollback: "Temp files are disposable; skipped locked files stay in place and every removed byte must be verified by rescan.",
    proof: "A disposable VM fixture must show locked-file skips, allowlist boundaries, and ledger/rescan parity.",
    requiredValidationIds: ["windows-native-build", "scanner-fixtures", "protected-path-fixtures", "temp-locked-files", "ledger-rescan-parity"],
    fixtureIds: ["known-temp-fixture", "protected-path-fixture"],
    preconditions: ["Native Windows scan", "Current plan snapshot", "Root allowlist match", "User-started cleanup"]
  },
  "shell-recycle-bin": {
    title: "Recycle Bin boundary",
    lane: "safe",
    phase: "first-safe",
    implementation: "Use the shell Recycle Bin API boundary; never treat arbitrary user folders as Recycle Bin content.",
    rollback: "No automated rollback after emptying Recycle Bin; the UI must state permanent-removal consequence before execution.",
    proof: "Fixture evidence must show only existing Recycle Bin entries are removed.",
    requiredValidationIds: ["windows-native-build", "scanner-fixtures", "protected-path-fixtures", "recycle-bin-only", "ledger-rescan-parity"],
    fixtureIds: ["protected-path-fixture"],
    preconditions: ["Native Windows scan", "Recycle Bin inventory", "Permanent-removal acknowledgement"]
  },
  "browser-cache-only": {
    title: "Browser cache only",
    lane: "safe",
    phase: "first-safe",
    implementation: "Remove cache directories only while excluding cookies, sessions, saved logins, extensions, and profile databases.",
    rollback: "Browser cache rebuilds automatically; identity stores must remain untouched.",
    proof: "Browser fixture must prove cache changes without identity-store mutations.",
    requiredValidationIds: ["windows-native-build", "scanner-fixtures", "protected-path-fixtures", "browser-identity-fixtures", "ledger-rescan-parity"],
    fixtureIds: ["browser-cache-fixture"],
    preconditions: ["Native Windows scan", "Browser profile cache path match", "Identity store exclusion list"]
  },
  "bounded-cache-delete": {
    title: "Bounded rebuildable cache",
    lane: "rebuildable",
    phase: "second-safe",
    implementation: "Delete only bounded user-owned cache entries that match age and root constraints.",
    rollback: "Build tools recreate the data; first run after cleanup may be slower.",
    proof: "Developer-tool fixture must show project source directories are not touched.",
    requiredValidationIds: ["windows-native-build", "scanner-fixtures", "protected-path-fixtures", "tool-native-dry-runs", "ledger-rescan-parity"],
    fixtureIds: ["developer-tooling-fixture", "protected-path-fixture"],
    preconditions: ["Native Windows scan", "User profile root", "Age threshold", "No project source match"]
  },
  "tool-native-prune": {
    title: "Tool-native prune commands",
    lane: "tool-native",
    phase: "second-safe",
    implementation: "Prefer official dry-run or prune commands for npm, pnpm, and Docker build cache instead of raw directory wipes.",
    rollback: "Tool caches rebuild; Docker volumes and running containers remain outside this route.",
    proof: "Command evidence must show volumes, project source, and running workloads are not selected.",
    requiredValidationIds: ["windows-native-build", "scanner-fixtures", "protected-path-fixtures", "tool-native-dry-runs", "ledger-rescan-parity"],
    fixtureIds: ["developer-tooling-fixture", "protected-path-fixture"],
    preconditions: ["Native Windows scan", "Tool installed", "Tool command inventory", "No volume or source-path candidate"]
  },
  "windows-cleanup-api": {
    title: "Windows cleanup API",
    lane: "admin-rebuildable",
    phase: "admin-later",
    implementation: "Invoke supported Windows cleanup surfaces; never directly delete system directories.",
    rollback: "Windows.old cleanup can remove OS rollback capability and needs explicit acknowledgement.",
    proof: "Admin VM evidence must show API boundary and rollback consequence disclosure.",
    requiredValidationIds: ["windows-native-build", "scanner-fixtures", "protected-path-fixtures", "ledger-rescan-parity"],
    fixtureIds: ["protected-path-fixture"],
    preconditions: ["Native Windows scan", "Admin boundary", "Stable install acknowledgement", "No direct system-directory delete"]
  },
  "launcher-cache-cleanup": {
    title: "Launcher cache cleanup",
    lane: "rebuildable",
    phase: "second-safe",
    implementation: "Clean launcher cache roots only; never uninstall games or touch save-data paths.",
    rollback: "Launchers rebuild cache and may re-verify assets.",
    proof: "Gaming profile evidence must show installed game content and saves are excluded.",
    requiredValidationIds: ["windows-native-build", "scanner-fixtures", "protected-path-fixtures", "ledger-rescan-parity"],
    fixtureIds: ["protected-path-fixture"],
    preconditions: ["Native Windows scan", "Launcher cache root match", "No game install path", "No save-data path"]
  },
  "item-review-recycle-bin": {
    title: "Reviewed user items",
    lane: "review",
    phase: "review-later",
    implementation: "Move explicitly selected items through Recycle Bin or quarantine; never wipe an entire user folder.",
    rollback: "Recycle Bin or quarantine restore path must be visible before execution.",
    proof: "Review fixture must show per-item decisions, protected child exclusion, and restore guidance.",
    requiredValidationIds: ["windows-native-build", "scanner-fixtures", "protected-path-fixtures", "rollback-story", "ledger-rescan-parity"],
    fixtureIds: ["review-data-fixture", "protected-path-fixture"],
    preconditions: ["Native Windows scan", "Item-level remove decisions", "No undecided items", "Recycle Bin or quarantine route"]
  },
  "item-review-large-files": {
    title: "Reviewed large personal files",
    lane: "review",
    phase: "review-later",
    implementation: "Surface large files in user folders as review candidates; prefer move/archive guidance before any removal route.",
    rollback: "Recycle Bin or archive restore path must be visible before execution.",
    proof: "Large-file fixture must show personal files are item-reviewed, protected folders are excluded, and no broad folder wipe exists.",
    requiredValidationIds: ["windows-native-build", "scanner-fixtures", "protected-path-fixtures", "rollback-story", "ledger-rescan-parity"],
    fixtureIds: ["review-data-fixture", "protected-path-fixture"],
    preconditions: ["Native Windows scan", "Item-level remove decisions", "No undecided items", "No protected path", "Archive or Recycle Bin route"]
  },
  "item-review-project-cache": {
    title: "Reviewed project caches",
    lane: "review",
    phase: "review-later",
    implementation: "Remove selected dependency folders only after the project root and source files are excluded.",
    rollback: "Dependencies are recreated by the package manager; source files must never be represented as cleanup candidates.",
    proof: "Review fixture must show old node_modules cleanup without source-file inclusion.",
    requiredValidationIds: ["windows-native-build", "scanner-fixtures", "protected-path-fixtures", "rollback-story", "ledger-rescan-parity"],
    fixtureIds: ["review-data-fixture", "protected-path-fixture"],
    preconditions: ["Native Windows scan", "Item-level remove decisions", "Project source exclusion", "Lockfile/source preservation"]
  },
  "item-review-tooling-cache": {
    title: "Reviewed tooling data",
    lane: "review",
    phase: "review-later",
    implementation: "Remove explicitly selected emulator images or tooling caches while keeping unknown app data locked.",
    rollback: "Tooling data may need re-download; current SDKs stay unless selected.",
    proof: "Review fixture must show selected Android entries only.",
    requiredValidationIds: ["windows-native-build", "scanner-fixtures", "protected-path-fixtures", "rollback-story", "ledger-rescan-parity"],
    fixtureIds: ["review-data-fixture", "protected-path-fixture"],
    preconditions: ["Native Windows scan", "Item-level remove decisions", "Known Android roots", "No unknown app data"]
  },
  "advanced-checklist": {
    title: "Advanced compaction checklist",
    lane: "advanced",
    phase: "manual-checklist",
    implementation: "Guide backup, shutdown, compaction, and boot verification; keep write automation locked.",
    rollback: "Backup must exist before compaction; interrupted work can risk distro data.",
    proof: "Advanced VM evidence must prove backup and boot verification steps.",
    requiredValidationIds: ["windows-native-build", "scanner-fixtures", "protected-path-fixtures", "ledger-rescan-parity"],
    fixtureIds: ["developer-tooling-fixture", "protected-path-fixture"],
    preconditions: ["Typed acknowledgement", "Backup path", "WSL shutdown", "Post-run boot verification"]
  },
  "advanced-system-toggle": {
    title: "Advanced system toggle",
    lane: "advanced",
    phase: "manual-checklist",
    implementation: "Keep system toggles as guided/manual until rollback and support posture are proven.",
    rollback: "The user must know how to restore hibernation and the Fast Startup consequence.",
    proof: "Admin VM evidence must show state before/after and restoration instructions.",
    requiredValidationIds: ["windows-native-build", "scanner-fixtures", "protected-path-fixtures", "ledger-rescan-parity"],
    fixtureIds: ["protected-path-fixture"],
    preconditions: ["Typed acknowledgement", "Admin boundary", "Power setting consequence", "Restore instructions"]
  },
  blocked: {
    title: "Policy blocked",
    lane: "blocked",
    phase: "never",
    implementation: "No executor route exists.",
    rollback: "Not applicable because automation is blocked.",
    proof: "Product policy must keep this route visible but non-executable.",
    requiredValidationIds: [],
    fixtureIds: ["browser-cache-fixture", "developer-tooling-fixture"],
    preconditions: ["Manual inspection only"]
  },
  advisory: {
    title: "Advisory only",
    lane: "advisory",
    phase: "manual-strategy",
    implementation: "Explain a backup-first strategy; do not automate storage layout writes.",
    rollback: "Manual disk operations require user-owned backup and recovery planning.",
    proof: "The app must show guidance only and no executor route.",
    requiredValidationIds: [],
    fixtureIds: [],
    preconditions: ["Backup-first plan", "Manual operator decision"]
  }
};

export const actions = [
  {
    id: "windows-temp",
    title: "Windows temporary files",
    family: "Windows",
    path: "%TEMP%, C:\\Windows\\Temp",
    bytes: 6.4 * GB,
    risk: "safe",
    gate: "auto",
    method: "Use Storage Sense and known temp locations",
    consequence: "Disposable temporary files are removed. Active locked files are skipped.",
    recommendation: "Include in every cleanup plan.",
    selectedByDefault: true,
    executableInDemo: true
  },
  {
    id: "recycle-bin",
    title: "Recycle Bin",
    family: "Windows",
    path: "C:\\$Recycle.Bin",
    bytes: 3.2 * GB,
    risk: "safe",
    gate: "permanentConfirm",
    method: "Empty files already marked for deletion",
    consequence: "Files already in Recycle Bin are permanently removed.",
    recommendation: "Include unless the user intentionally keeps recoverable files there.",
    selectedByDefault: true,
    executableInDemo: true
  },
  {
    id: "windows-old",
    title: "Previous Windows installation",
    family: "Windows",
    path: "C:\\Windows.old",
    bytes: 12.7 * GB,
    risk: "rebuildable",
    gate: "groupConfirm",
    method: "Launch Windows cleanup API instead of deleting directly",
    consequence: "Rollback to the previous Windows build may no longer be available.",
    recommendation: "Clean only after the current Windows install is stable.",
    selectedByDefault: false,
    executableInDemo: true
  },
  {
    id: "gradle-cache",
    title: "Gradle dependency and build cache",
    family: "Developer caches",
    path: "C:\\Users\\demo\\.gradle\\caches",
    bytes: 9.6 * GB,
    risk: "rebuildable",
    gate: "groupConfirm",
    method: "Remove old Gradle cache entries, keep current daemon metadata",
    consequence: "Future builds may re-download dependencies and run slower once.",
    recommendation: "Clean entries unused for 30+ days.",
    selectedByDefault: true,
    executableInDemo: true
  },
  {
    id: "npm-cache",
    title: "npm package cache",
    family: "Developer caches",
    path: "%LocalAppData%\\npm-cache",
    bytes: 5.1 * GB,
    risk: "rebuildable",
    gate: "groupConfirm",
    method: "Prefer npm cache verify; clean only when space is the priority",
    consequence: "Packages may be fetched again on the next install.",
    recommendation: "Verify first, then clean if the target is still unmet.",
    selectedByDefault: true,
    executableInDemo: true
  },
  {
    id: "pnpm-store",
    title: "pnpm global store",
    family: "Developer caches",
    path: "C:\\Users\\demo\\AppData\\Local\\pnpm\\store",
    bytes: 8.8 * GB,
    risk: "rebuildable",
    gate: "groupConfirm",
    method: "Prune unreferenced packages through the package manager",
    consequence: "Some projects may fetch packages again.",
    recommendation: "Use package-manager prune rather than deleting the whole store.",
    selectedByDefault: true,
    executableInDemo: true
  },
  {
    id: "docker-build-cache",
    title: "Docker build cache",
    family: "Containers",
    path: "Docker Desktop data",
    bytes: 18.4 * GB,
    risk: "rebuildable",
    gate: "groupConfirm",
    method: "Run Docker prune for unused build cache and dangling images",
    consequence: "Docker builds may be slower until layers are rebuilt.",
    recommendation: "Clean build cache before touching images or volumes.",
    selectedByDefault: false,
    executableInDemo: true
  },
  {
    id: "docker-volumes",
    title: "Docker anonymous volumes",
    family: "Containers",
    path: "Docker Desktop volumes",
    bytes: 14.9 * GB,
    risk: "restricted",
    gate: "blocked",
    method: "Blocked in automated mode",
    consequence: "Volumes can contain databases and application state.",
    recommendation: "Never include in default cleanup. Require manual inspection.",
    selectedByDefault: false,
    executableInDemo: false
  },
  {
    id: "wsl-vhdx",
    title: "WSL virtual disk compaction",
    family: "Virtualization",
    path: "%LocalAppData%\\Packages\\*\\LocalState\\ext4.vhdx",
    bytes: 21.3 * GB,
    risk: "advanced",
    gate: "typed",
    typedPhrase: "COMPACT WSL",
    method: "Shut down WSL, export backup, compact VHDX, verify distro boots",
    consequence: "Requires downtime and can risk distro data if interrupted.",
    recommendation: "Offer only after a backup path is selected.",
    selectedByDefault: false,
    executableInDemo: true
  },
  {
    id: "android-studio",
    title: "Android Studio emulator images and caches",
    family: "Developer caches",
    path: "%UserProfile%\\.android, %LocalAppData%\\Google\\AndroidStudio*",
    bytes: 13.6 * GB,
    risk: "review",
    gate: "review",
    method: "Review emulator images and old SDK packages before removal",
    consequence: "Removed emulators or SDK versions must be downloaded again.",
    recommendation: "Delete only old emulator images and unused SDK packages.",
    selectedByDefault: false,
    executableInDemo: true
  },
  {
    id: "node-modules-old",
    title: "Old project node_modules folders",
    family: "Project artifacts",
    path: "C:\\Users\\demo\\Code\\**\\node_modules",
    bytes: 27.5 * GB,
    risk: "review",
    gate: "review",
    method: "Delete per project after reviewing modified time and lockfiles",
    consequence: "Projects need dependency reinstall before running.",
    recommendation: "Start with projects untouched for 60+ days.",
    selectedByDefault: false,
    executableInDemo: true
  },
  {
    id: "downloads-installers",
    title: "Old installers and archives in Downloads",
    family: "User files",
    path: "C:\\Users\\demo\\Downloads",
    bytes: 15.2 * GB,
    risk: "review",
    gate: "review",
    method: "Review file list and move to Recycle Bin or archive drive",
    consequence: "May remove files the user still wants.",
    recommendation: "Sort by size and age; never auto-delete.",
    selectedByDefault: false,
    executableInDemo: true
  },
  {
    id: "large-user-files",
    title: "Large personal files",
    family: "User files",
    path: "Downloads, Desktop, Documents, Videos",
    bytes: 29.1 * GB,
    risk: "review",
    gate: "review",
    method: "Review large files individually and prefer moving to archive storage",
    consequence: "May remove or move personal, project, or media files the user still needs.",
    recommendation: "Use as discovery only; never auto-select or bulk-delete.",
    selectedByDefault: false,
    executableInDemo: true
  },
  {
    id: "steam-shader-cache",
    title: "Game shader and launcher caches",
    family: "Games",
    path: "Steam, Epic, Xbox app cache folders",
    bytes: 7.7 * GB,
    risk: "rebuildable",
    gate: "groupConfirm",
    method: "Clean shader/download caches, not installed game content",
    consequence: "Some games may rebuild shaders or verify files later.",
    recommendation: "Clean caches; do not uninstall games without explicit review.",
    selectedByDefault: false,
    executableInDemo: true
  },
  {
    id: "browser-cache",
    title: "Browser cache only",
    family: "Browsers",
    path: "Edge, Chrome, Firefox cache directories",
    bytes: 4.8 * GB,
    risk: "safe",
    gate: "auto",
    method: "Clean cache folders; preserve cookies, sessions, passwords, extensions",
    consequence: "Websites may reload assets.",
    recommendation: "Clean cache only. Identity data is protected.",
    selectedByDefault: true,
    executableInDemo: true
  },
  {
    id: "browser-identity",
    title: "Browser cookies, sessions, saved logins",
    family: "Browsers",
    path: "Browser profile identity stores",
    bytes: 680 * MB,
    risk: "restricted",
    gate: "blocked",
    method: "Blocked",
    consequence: "Can sign users out or remove important browsing state.",
    recommendation: "Never include in automatic cleanup.",
    selectedByDefault: false,
    executableInDemo: false
  },
  {
    id: "hibernation",
    title: "Disable hibernation file",
    family: "Advanced system",
    path: "C:\\hiberfil.sys",
    bytes: 12 * GB,
    risk: "advanced",
    gate: "typed",
    typedPhrase: "DISABLE HIBERNATION",
    method: "Run powercfg /hibernate off after explicit typed approval",
    consequence: "Hibernate and possibly Fast Startup are disabled.",
    recommendation: "Offer only when the user understands the tradeoff.",
    selectedByDefault: false,
    executableInDemo: true
  },
  {
    id: "pagefile",
    title: "Pagefile size changes",
    family: "Advanced system",
    path: "C:\\pagefile.sys",
    bytes: 18 * GB,
    risk: "restricted",
    gate: "blocked",
    method: "Blocked",
    consequence: "Changing pagefile settings can destabilize memory-heavy workloads.",
    recommendation: "Explain only; do not automate.",
    selectedByDefault: false,
    executableInDemo: false
  },
  {
    id: "partitioning",
    title: "Partition resize or move strategy",
    family: "Advanced system",
    path: "Disk Management",
    bytes: 0,
    risk: "advisory",
    gate: "advisory",
    method: "Advisory only",
    consequence: "Partition operations can cause data loss when interrupted or misapplied.",
    recommendation: "Only suggest a backup-first manual plan.",
    selectedByDefault: false,
    executableInDemo: false
  }
];

export function getScenario(id) {
  return scenarios.find((scenario) => scenario.id === id) || scenarios[0];
}

export function buildScenarioActions(id) {
  const scenario = getScenario(id);
  return actions
    .map((action) => {
      const multiplier = scenario.multipliers[action.family] ?? 1;
      return {
        ...action,
        bytes: Math.round(action.bytes * multiplier)
      };
    })
    .filter((action) => action.bytes > 0 || action.gate === "advisory");
}

export const agentStages = [
  ["intake", "Intake", "Collect target, tolerance, protected paths, and admin boundary."],
  ["discover", "Discover", "Scan disk usage, known cache roots, virtual disks, and large files."],
  ["classify", "Classify", "Map raw paths to recipes. Unknown paths never become automatic actions."],
  ["plan", "Plan", "Prefer safe and rebuildable wins before personal or system changes."],
  ["gate", "Gate", "Require the correct approval and keep restricted actions locked."],
  ["execute", "Execute", "Use official tool commands where possible and simulate in this demo."],
  ["verify", "Verify", "Rescan affected roots and produce a local cleanup ledger."]
].map(([id, label, rule]) => ({ id, label, rule }));

export function formatBytes(bytes) {
  if (bytes === 0) return "0 GB";
  if (bytes >= GB) return `${(bytes / GB).toFixed(bytes >= 10 * GB ? 0 : 1)} GB`;
  return `${Math.round(bytes / MB)} MB`;
}

export function buildIntakePolicy({
  targetDrive = "C:",
  goalBytes = 0,
  mode = "safe",
  protectedPaths = [],
  adminAllowed = false
} = {}) {
  const cleanDrive = String(targetDrive || "C:").trim() || "C:";
  const protectedCount = Array.isArray(protectedPaths) ? protectedPaths.filter(Boolean).length : 0;
  const modeLabel = mode === "emergency" ? "Emergency" : mode === "balanced" ? "Balanced" : "Safe";
  const adminSensitiveBlocked = !adminAllowed;
  const items = [
    {
      id: "target-drive",
      label: "Target drive",
      detail: `${cleanDrive} is the only drive considered for cleanup planning.`,
      passed: Boolean(cleanDrive)
    },
    {
      id: "risk-tolerance",
      label: "Risk tolerance",
      detail: `${modeLabel} mode controls how aggressively the planner suggests guarded recovery.`,
      passed: ["safe", "balanced", "emergency"].includes(mode)
    },
    {
      id: "admin-allowance",
      label: "Admin/system actions",
      detail: adminAllowed
        ? "User allowed admin-sensitive routes to appear in dry-run planning."
        : "Admin-sensitive routes stay out of suggested and selectable plans.",
      passed: adminAllowed
    },
    {
      id: "protected-paths",
      label: "Protected paths",
      detail: protectedCount ? `${protectedCount} protected path(s) constrain planning.` : "No user-protected paths have been added yet.",
      passed: true
    }
  ];

  return {
    schemaVersion: "spaceguard-intake-policy/v1",
    targetDrive: cleanDrive,
    goalBytes,
    mode,
    adminAllowed,
    adminSensitiveBlocked,
    protectedCount,
    status: adminSensitiveBlocked ? "admin-sensitive-blocked" : "admin-sensitive-allowed",
    automationBlockedReason: adminSensitiveBlocked
      ? "Admin-sensitive cleanup routes require explicit user allowance before they can enter a dry-run plan."
      : "Admin-sensitive routes may appear in dry-run planning, but real execution remains locked.",
    items
  };
}

export function actionRequiresAdminConsent(action) {
  if (!action) return false;
  const policy = getExecutorPolicy(action);
  return (
    policy.lane === "admin-rebuildable" ||
    policy.lane === "advanced" ||
    policy.route === "windows-cleanup-api" ||
    policy.route === "advanced-checklist" ||
    policy.route === "advanced-system-toggle"
  );
}

export function actionAllowedByIntake(action, intakePolicy = null) {
  if (!intakePolicy) return true;
  if (intakePolicy.adminSensitiveBlocked && actionRequiresAdminConsent(action)) return false;
  return true;
}

export function getIntakeBlocker(action, intakePolicy = null) {
  if (!actionAllowedByIntake(action, intakePolicy)) return "intake admin boundary";
  return "";
}

export function selectableAction(action, protectedPaths = [], intakePolicy = null) {
  protectedPaths = Array.isArray(protectedPaths) ? protectedPaths : [];
  return action.gate !== "blocked" && action.gate !== "advisory" && !isActionProtected(action, protectedPaths) && actionAllowedByIntake(action, intakePolicy);
}

export function selectedByDefault(action, protectedPaths = [], intakePolicy = null) {
  protectedPaths = Array.isArray(protectedPaths) ? protectedPaths : [];
  return action.selectedByDefault && selectableAction(action, protectedPaths, intakePolicy);
}

export function computeTotals(selectedIds, actionList = actions, options = {}) {
  const selected = actionList.filter((action) => selectedIds.has(action.id));
  const selectedBytes = selected.reduce((sum, action) => sum + getPlannedActionBytes(action, options.approvals, options.itemReviewsByAction), 0);
  return {
    selected,
    selectedBytes,
    visibleBytes: actionList.reduce((sum, action) => sum + action.bytes, 0),
    blockedBytes: actionList.filter((action) => action.gate === "blocked").reduce((sum, action) => sum + action.bytes, 0)
  };
}

export function buildSuggestedPlan(goalBytes, selectedIds = new Set(), actionList = actions, protectedPaths = [], intakePolicy = null) {
  const ordered = actionList
    .filter((action) => selectableAction(action, protectedPaths, intakePolicy))
    .slice()
    .sort((a, b) => {
      const riskDelta = riskOrder[a.risk] - riskOrder[b.risk];
      return riskDelta || b.bytes - a.bytes;
    });

  const chosen = new Set(selectedIds);
  let total = computeTotals(chosen, actionList).selectedBytes;

  for (const action of ordered) {
    if (total >= goalBytes) break;
    chosen.add(action.id);
    total += action.bytes;
  }

  return chosen;
}

export function getExecutionReadiness(selectedIds, approvals) {
  return getExecutionReadinessForActions(selectedIds, approvals, actions);
}

export function getExecutionReadinessForActions(selectedIds, approvals, actionList = actions, protectedPaths = [], itemReviewsByAction = null, intakePolicy = null) {
  const selected = actionList.filter((action) => selectedIds.has(action.id));
  const reviewsByAction = itemReviewsByAction || buildReviewItemsByAction(actionList, null, protectedPaths, approvals);
  const unresolved = selected
    .map((action) => ({ action, gate: unresolvedGate(action, approvals, protectedPaths, getItemReviewForAction(action, reviewsByAction), intakePolicy) }))
    .filter((entry) => entry.gate);

  return {
    ready: selected.length > 0 && unresolved.length === 0,
    unresolved
  };
}

export function makeExecutionLedger(selectedIds) {
  return makeExecutionLedgerForActions(selectedIds, actions);
}

export function makeExecutionLedgerForActions(selectedIds, actionList = actions, protectedPaths = [], options = {}) {
  const selected = actionList.filter((action) => selectedIds.has(action.id));
  const ledgerOptions = {
    ...options,
    itemReviewsByAction: options.itemReviewsByAction || buildReviewItemsByAction(actionList, null, protectedPaths, options.approvals || {})
  };
  const planId = options.planSnapshot?.id || options.planId || "";
  const executedAt = options.executedAt || "";
  return selected.map((action, index) => ({
    id: action.id,
    planId,
    executedAt,
    time: `T+${String(index + 1).padStart(2, "0")}m`,
    title: action.title,
    result: getLedgerResult(action, protectedPaths, ledgerOptions),
    bytes: getLedgerBytes(action, protectedPaths, ledgerOptions),
    method: getLedgerMethod(action, protectedPaths, ledgerOptions)
  }));
}

export function buildLedgerRunRecord({
  planSnapshot = null,
  ledger = [],
  executorPlan = null,
  scanMode = "demo",
  nativeScan = null,
  runtimeCapabilities = null,
  runReadiness = null,
  createdAt = "set-on-save"
} = {}) {
  const expectedBytes = executorPlan?.dryRunBytes ?? planSnapshot?.selectedBytes ?? 0;
  const reclaimedBytes = ledger.reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
  const deltaBytes = Math.abs(expectedBytes - reclaimedBytes);
  const routes = (executorPlan?.rows || [])
    .filter((row) => ledger.some((entry) => entry.id === row.id))
    .map((row) => ({
      id: row.id,
      title: row.title,
      route: row.route,
      lane: row.lane,
      status: row.status,
      bytes: row.bytes
    }));
  const entries = ledger.map((entry) => ({
    id: entry.id,
    planId: entry.planId || planSnapshot?.id || "",
    executedAt: entry.executedAt || "",
    time: entry.time,
    title: entry.title,
    result: entry.result,
    bytes: Number(entry.bytes || 0),
    method: entry.method
  }));
  const payload = {
    schemaVersion: "spaceguard-ledger-run/v1",
    planId: planSnapshot?.id || entries[0]?.planId || "",
    createdAt,
    scanMode,
    expectedBytes,
    reclaimedBytes,
    entryCount: entries.length,
    routeIds: routes.map((route) => route.id),
    entries
  };

  return {
    ...payload,
    id: `run-${hashText(stableStringify(payload))}`,
    currentPlanTitle: planSnapshot?.id || "",
    selectedCount: planSnapshot?.selectedCount || 0,
    deltaBytes,
    nativeEvidence: scanMode === "native-readonly" && Boolean(nativeScan),
    realRunEnabled: Boolean(runtimeCapabilities?.realRunEnabled),
    destructiveCommands: Boolean(runtimeCapabilities?.destructiveCommands),
    runReady: Boolean(runReadiness?.ready),
    routes,
    safety: {
      dryRunOnly: !runtimeCapabilities?.realRunEnabled,
      destructiveCommands: Boolean(runtimeCapabilities?.destructiveCommands),
      nativeWriteCapability: Boolean(nativeScan?.writeCapability)
    }
  };
}

export function appendLedgerRunRecord(history = [], record = null, { limit = 25 } = {}) {
  const existing = Array.isArray(history) ? history.filter(isLedgerRunRecord) : [];
  if (!isLedgerRunRecord(record)) return existing.slice(-limit);
  if (existing.some((item) => item.id === record.id)) return existing.slice(-limit);
  return [...existing, record].slice(-limit);
}

export function buildLedgerHistorySummary(history = [], planSnapshot = null) {
  const records = Array.isArray(history) ? history.filter(isLedgerRunRecord) : [];
  const planId = planSnapshot?.id || "";
  const currentRecords = planId ? records.filter((record) => record.planId === planId) : [];
  const staleRecords = planId ? records.filter((record) => record.planId !== planId) : records;
  const currentRecord = currentRecords[currentRecords.length - 1] || null;
  const latestRecord = records[records.length - 1] || null;

  return {
    schemaVersion: "spaceguard-ledger-history/v1",
    records,
    currentRecords,
    staleRecords,
    currentRecord,
    latestRecord,
    currentLedger: currentRecord?.entries || [],
    counts: {
      records: records.length,
      current: currentRecords.length,
      stale: staleRecords.length
    },
    totalReclaimedBytes: records.reduce((sum, record) => sum + Number(record.reclaimedBytes || 0), 0),
    currentReclaimedBytes: currentRecords.reduce((sum, record) => sum + Number(record.reclaimedBytes || 0), 0),
    hasCurrentPlanRecord: currentRecords.length > 0
  };
}

export function buildLedgerHistoryMarkdown(historySummary) {
  const summary = Array.isArray(historySummary) ? buildLedgerHistorySummary(historySummary) : historySummary;
  const records = summary?.records || [];
  const rows = records.length
    ? records
        .slice()
        .reverse()
        .map((record) => `- ${record.createdAt}: ${formatBytes(record.reclaimedBytes)} | ${record.entryCount} step(s) | plan=${record.planId} | mode=${record.scanMode}`)
        .join("\n")
    : "- No run history recorded.";

  return [
    "# SpaceGuard Local Run History",
    "",
    `Records: ${summary?.counts?.records || 0}`,
    `Current plan records: ${summary?.counts?.current || 0}`,
    `Stale records: ${summary?.counts?.stale || 0}`,
    `Total simulated recovery: ${formatBytes(summary?.totalReclaimedBytes || 0)}`,
    "",
    "## Runs",
    rows,
    "",
    "This history is local dry-run evidence only. It does not prove real filesystem cleanup."
  ].join("\n");
}

export function buildPlanSnapshot({
  selectedIds = new Set(),
  actionList = actions,
  approvals = { groupConfirm: false, permanentConfirm: false, reviewed: {}, reviewItems: {}, typed: {} },
  protectedPaths = [],
  itemReviewsByAction = null,
  scanMode = "demo",
  goalBytes = 0,
  intakePolicy = null
} = {}) {
  const reviewsByAction = itemReviewsByAction || buildReviewItemsByAction(actionList, null, protectedPaths, approvals);
  const selected = actionList.filter((action) => selectedIds.has(action.id));
  const rows = selected
    .map((action) => {
      const review = getItemReviewForAction(action, reviewsByAction);
      return {
        id: action.id,
        title: action.title,
        path: action.path,
        risk: action.risk,
        gate: action.gate,
        powerId: getActionTaskPowerId(action),
        bytes: getPlannedActionBytes(action, approvals, reviewsByAction),
        visibleBytes: action.bytes,
        permanentConfirm: Boolean(approvals.permanentConfirm),
        typed: approvals.typed?.[action.id] || "",
        reviewItems: review?.items?.map((item) => ({
          id: item.id,
          decision: item.decision,
          bytes: item.bytes,
          protected: item.protected
        })) || []
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const payload = {
    scanMode,
    goalBytes,
    intake: intakePolicy
      ? {
          targetDrive: intakePolicy.targetDrive,
          mode: intakePolicy.mode,
          adminAllowed: Boolean(intakePolicy.adminAllowed),
          adminSensitiveBlocked: Boolean(intakePolicy.adminSensitiveBlocked)
        }
      : null,
    protectedPaths: [...protectedPaths].sort(),
    groupConfirm: Boolean(approvals.groupConfirm),
    permanentConfirm: Boolean(approvals.permanentConfirm),
    rows
  };
  const id = `plan-${hashText(stableStringify(payload))}`;

  return {
    id,
    scanMode,
    goalBytes,
    selectedCount: rows.length,
    selectedBytes: rows.reduce((sum, row) => sum + row.bytes, 0),
    protectedCount: protectedPaths.length,
    rows,
    payload
  };
}

export function buildFamilyGroups(selectedIds, actionList = actions, options = {}) {
  const groups = new Map();

  for (const action of actionList) {
    const group = groups.get(action.family) || {
      family: action.family,
      bytes: 0,
      selectedBytes: 0,
      risk: action.risk
    };
    group.bytes += action.bytes;
    group.selectedBytes += selectedIds.has(action.id) ? getPlannedActionBytes(action, options.approvals, options.itemReviewsByAction) : 0;
    group.risk = riskOrder[action.risk] > riskOrder[group.risk] ? action.risk : group.risk;
    groups.set(action.family, group);
  }

  return Array.from(groups.values()).sort((a, b) => b.bytes - a.bytes);
}

export function buildScanCoverageSummary({
  actionList = actions,
  scanMode = "demo",
  nativeScan = null
} = {}) {
  const customRootRows = buildCustomRootCoverageRows(nativeScan);
  const rows = actionList.map((action) => {
    const evidence = action.scanSource ? action.scanStatus || "measured" : "demo-estimate";
    const verified = evidence === "measured" || evidence === "limited";
    const issue = evidence === "demo-estimate" || evidence === "missing" || evidence === "unsupported" || evidence === "protected";
    return {
      id: action.id,
      title: action.title,
      family: action.family,
      risk: action.risk,
      path: action.path,
      bytes: Number(action.bytes || 0),
      evidence,
      verified,
      issue,
      source: action.scanSource || "demo",
      nextStep: scanCoverageNextStep(action, evidence)
    };
  });
  const counts = rows.reduce(
    (acc, row) => {
      acc.total += 1;
      acc[row.evidence] = (acc[row.evidence] || 0) + 1;
      if (row.verified) acc.verified += 1;
      if (row.issue) acc.unverified += 1;
      return acc;
    },
    { total: 0, verified: 0, unverified: 0 }
  );
  const measuredBytes = rows.filter((row) => row.verified).reduce((sum, row) => sum + row.bytes, 0);
  const estimatedBytes = rows.filter((row) => row.evidence === "demo-estimate").reduce((sum, row) => sum + row.bytes, 0);
  const visibleBytes = rows.reduce((sum, row) => sum + row.bytes, 0);
  const customRootBytes = customRootRows.filter((row) => row.verified).reduce((sum, row) => sum + row.bytes, 0);
  const confidenceScore = visibleBytes > 0 ? Math.round((measuredBytes / visibleBytes) * 100) : 0;
  const unverifiedRows = rows
    .filter((row) => row.issue || row.evidence === "limited")
    .sort((a, b) => b.bytes - a.bytes || a.title.localeCompare(b.title));
  const status = scanMode !== "native-readonly"
    ? "demo-only"
    : !nativeScan?.available
      ? "native-unavailable"
      : counts.verified === 0
        ? "no-measured-roots"
        : unverifiedRows.length
          ? "partial-native"
          : "native-covered";
  const tone = status === "native-covered" ? "safe" : status === "no-measured-roots" || status === "native-unavailable" ? "restricted" : "review";
  const steps = scanCoverageSteps(status, unverifiedRows);

  return {
    schemaVersion: "spaceguard-scan-coverage/v1",
    status,
    tone,
    confidenceScore,
    scanMode,
    nativeAvailable: Boolean(nativeScan?.available),
    measuredBytes,
    estimatedBytes,
    visibleBytes,
    customRootBytes,
    counts,
    customRootRows,
    rows,
    unverifiedRows,
    warnings: nativeScan?.warnings || [],
    primary:
      status === "native-covered"
        ? "Native scan covered every visible cleanup recipe."
        : status === "partial-native"
          ? "Native scan is useful, but some recipes are still estimates or unsupported."
          : status === "demo-only"
            ? "Current plan uses demo estimates only."
            : "Native scan did not produce enough measured coverage.",
    steps
  };
}

function buildCustomRootCoverageRows(nativeScan = null) {
  return (nativeScan?.findings || [])
    .filter((finding) => String(finding.recipeId || finding.recipe_id || "").startsWith("custom-root-"))
    .map((finding) => {
      const evidence = finding.status || "unknown";
      const verified = evidence === "measured" || evidence === "limited";
      return {
        id: finding.recipeId || finding.recipe_id || "",
        title: finding.title || "Custom folder",
        path: finding.path || "",
        bytes: Number(finding.bytes || 0),
        evidence,
        verified,
        files: Number(finding.files || 0),
        dirs: Number(finding.dirs || 0),
        errors: Number(finding.errors || 0),
        note: finding.note || "",
        nextStep: "Review manually. Custom roots are read-only discovery and never create executor routes."
      };
    })
    .sort((a, b) => b.bytes - a.bytes || a.title.localeCompare(b.title));
}

export function buildPrivacyBoundary({
  scanMode = "demo",
  nativeScan = null,
  runHistory = [],
  validationEvidence = {},
  runtimeCapabilities = {}
} = {}) {
  const nativeFindings = nativeScan?.findings || [];
  const itemCount = nativeFindings.reduce((sum, finding) => sum + (finding.items?.length || 0), 0);
  const localRecordCount = Array.isArray(runHistory) ? runHistory.length : 0;
  const validationRecordCount = Object.values(validationEvidence || {}).filter((value) => value === true || value === "passed").length;
  const pathEvidencePresent = Boolean(nativeFindings.length || itemCount || localRecordCount);
  const exportOnly = true;
  const cloudDisabled = true;
  const telemetryDisabled = true;
  const destructiveDisabled = !runtimeCapabilities?.destructiveCommands && !nativeScan?.destructiveCommands;
  const rows = [
    {
      id: "local-scan-metadata",
      label: "Local scan metadata",
      status: scanMode === "native-readonly" ? "local-readonly" : "demo-only",
      detail:
        scanMode === "native-readonly"
          ? "Known root paths, sizes, statuses, and selected item candidates are processed on this device."
          : "Browser demo uses fixed sample data and does not inspect local folders.",
      sensitive: scanMode === "native-readonly"
    },
    {
      id: "explicit-export",
      label: "Explicit report export",
      status: exportOnly ? "user-started" : "automatic",
      detail: "Reports, validation packs, run history, and verification checklists leave the app only when the user exports them.",
      sensitive: pathEvidencePresent
    },
    {
      id: "local-storage",
      label: "Local browser storage",
      status: localRecordCount || validationRecordCount ? "records-present" : "empty",
      detail: `${localRecordCount} run record(s) and ${validationRecordCount} validation evidence record(s) are stored locally for audit continuity.`,
      sensitive: localRecordCount > 0 || validationRecordCount > 0
    },
    {
      id: "no-cloud-telemetry",
      label: "No cloud telemetry",
      status: cloudDisabled && telemetryDisabled ? "disabled" : "review",
      detail: "The current build has no upload endpoint, analytics event sender, or cloud report sync path.",
      sensitive: false
    },
    {
      id: "no-secret-collection",
      label: "No identity-store collection",
      status: "blocked",
      detail: "Browser cookies, sessions, saved logins, registry cleanup, and unknown app data are policy-blocked.",
      sensitive: false
    },
    {
      id: "destructive-commands",
      label: "Destructive commands",
      status: destructiveDisabled ? "disabled" : "enabled",
      detail: destructiveDisabled
        ? "Runtime and scan evidence do not expose destructive command capability."
        : "Destructive capability is present and must be blocked by release gates.",
      sensitive: false
    }
  ];
  const warnings = [
    pathEvidencePresent ? "Exports may contain local paths and filenames; share them only with trusted reviewers." : "",
    nativeScan?.warnings?.length ? "Native scan warnings should be included in privacy review before public beta." : "",
    runtimeCapabilities?.realRunEnabled ? "Runtime reports real executors enabled; privacy/support docs must be reviewed before release." : ""
  ].filter(Boolean);
  const readyForPublicDemo = scanMode === "demo" && cloudDisabled && telemetryDisabled && destructiveDisabled;
  const readyForNativeBeta = scanMode === "native-readonly" && cloudDisabled && telemetryDisabled && destructiveDisabled;

  return {
    schemaVersion: "spaceguard-privacy-boundary/v1",
    status: readyForNativeBeta ? "native-local-only" : readyForPublicDemo ? "demo-local-only" : "needs-review",
    tone: readyForNativeBeta || readyForPublicDemo ? "safe" : "review",
    scanMode,
    pathEvidencePresent,
    itemCandidateCount: itemCount,
    localRecordCount,
    validationRecordCount,
    cloudDisabled,
    telemetryDisabled,
    exportOnly,
    destructiveDisabled,
    rows,
    warnings,
    blockedCollections: [
      "Browser cookies",
      "Saved logins",
      "Browser sessions",
      "Registry cleanup targets",
      "Unknown app data",
      "Cloud telemetry"
    ],
    steps: [
      "Keep scan reports local unless the user explicitly exports them.",
      "Warn users before sharing reports because native scans can include local paths.",
      "Do not add telemetry until privacy policy, opt-in UX, and data minimization are implemented.",
      "Keep browser identity stores and registry cleanup blocked."
    ]
  };
}

export function buildPlanReview(actionList = actions, selectedIds = new Set(), approvals = {}, protectedPaths = [], itemReviewsByAction = null, intakePolicy = null) {
  const reviewsByAction = itemReviewsByAction || buildReviewItemsByAction(actionList, null, protectedPaths, approvals);
  const rows = actionList
    .map((action) => {
      const selected = selectedIds.has(action.id);
      const protectedByUser = isActionProtected(action, protectedPaths);
      const intakeBlocked = !actionAllowedByIntake(action, intakePolicy);
      const itemReview = getItemReviewForAction(action, reviewsByAction);
      const gate = selected ? unresolvedGate(action, approvals, protectedPaths, itemReview, intakePolicy) : null;
      const plannedBytes = getPlannedActionBytes(action, approvals, reviewsByAction);
      let status = "available";

      if (protectedByUser) status = "protected";
      else if (intakeBlocked) status = "intake-blocked";
      else if (action.gate === "blocked" || action.gate === "advisory") status = "blocked";
      else if (selected && gate) status = "pending";
      else if (selected) status = "approved";

      return {
        id: action.id,
        title: action.title,
        bytes: selected ? plannedBytes : action.bytes,
        visibleBytes: action.bytes,
        risk: action.risk,
        gate: gate || action.gate,
        status,
        selected,
        reason: getReviewReason(action, status, gate, itemReview)
      };
    })
    .sort((a, b) => {
      const statusRank = { pending: 0, protected: 1, "intake-blocked": 2, blocked: 3, approved: 4, available: 5 };
      return statusRank[a.status] - statusRank[b.status] || b.bytes - a.bytes;
    });

  return {
    rows,
    approved: rows.filter((row) => row.status === "approved"),
    pending: rows.filter((row) => row.status === "pending"),
    protected: rows.filter((row) => row.status === "protected"),
    blocked: rows.filter((row) => row.status === "blocked" || row.status === "intake-blocked")
  };
}

export function buildRecoveryAdvisor({
  scanned = false,
  scanMode = "demo",
  goalBytes = 0,
  actionList = actions,
  selectedIds = new Set(),
  approvals = { groupConfirm: false, permanentConfirm: false, reviewed: {}, typed: {} },
  protectedPaths = [],
  ledger = [],
  itemReviewsByAction = null,
  planSnapshot = null,
  intakePolicy = null
} = {}) {
  const reviewsByAction = itemReviewsByAction || buildReviewItemsByAction(actionList, null, protectedPaths, approvals);
  const totals = computeTotals(selectedIds, actionList, { approvals, itemReviewsByAction: reviewsByAction });
  const readiness = getExecutionReadinessForActions(selectedIds, approvals, actionList, protectedPaths, reviewsByAction, intakePolicy);
  const gapBytes = Math.max(0, goalBytes - totals.selectedBytes);
  const selectedPendingBytes = readiness.unresolved.reduce((sum, entry) => sum + getPendingActionBytes(entry.action, approvals, reviewsByAction), 0);
  const available = actionList
    .filter((action) => selectableAction(action, protectedPaths, intakePolicy) && !selectedIds.has(action.id))
    .slice()
    .sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk] || b.bytes - a.bytes);
  const quickWins = available.filter((action) => action.gate === "auto" || action.risk === "safe");
  const rebuildable = available.filter((action) => action.gate === "groupConfirm");
  const reviewCandidates = available.filter((action) => action.gate === "review");
  const advancedCandidates = available.filter((action) => action.gate === "typed");
  const blockedVisible = actionList.filter((action) => action.gate === "blocked" || action.gate === "advisory" || isActionProtected(action, protectedPaths) || !actionAllowedByIntake(action, intakePolicy));
  const normalCandidates = [...quickWins, ...rebuildable, ...reviewCandidates];
  const normalSelectableBytes = normalCandidates.reduce((sum, action) => sum + action.bytes, 0);

  const base = {
    scanMode,
    goalBytes,
    selectedBytes: totals.selectedBytes,
    gapBytes,
    selectedPendingBytes,
    status: "scan-first",
    tone: "review",
    primary: "Run a scan before deciding what to clean.",
    detail: "The agent needs a current profile before it can rank recovery actions.",
    steps: [
      "Run the demo scan or native read-only scan.",
      "Review the generated plan before approving any cleanup.",
      "Keep protected paths updated before execution."
    ],
    buckets: {
      quickWins,
      rebuildable,
      reviewCandidates,
      advancedCandidates,
      blockedVisible
    }
  };

  if (!scanned) return base;

  const currentLedgerCount = planSnapshot?.id ? ledger.filter((entry) => entry.planId === planSnapshot.id).length : ledger.length;

  if (currentLedgerCount > 0) {
    return {
      ...base,
      status: "verify",
      tone: "safe",
      primary: "Verification is the next step.",
      detail: "A ledger exists for this plan, so the agent should rescan affected roots before another run.",
      steps: ["Rescan affected roots.", "Compare expected and actual reclaimed space.", "Change the plan before any second execution."]
    };
  }

  if (readiness.unresolved.length > 0) {
    return {
      ...base,
      status: "needs-approval",
      tone: "review",
      primary: `${readiness.unresolved.length} selected gate(s) need attention.`,
      detail: `${formatBytes(selectedPendingBytes)} is selected but not approved yet.`,
      steps: readiness.unresolved.slice(0, 3).map((entry) => gateInstruction(entry.action, entry.gate))
    };
  }

  if (gapBytes === 0) {
    return {
      ...base,
      status: "on-track",
      tone: "safe",
      primary: "The current plan meets the recovery target.",
      detail: `${formatBytes(totals.selectedBytes)} is planned against a ${formatBytes(goalBytes)} goal.`,
      steps: ["Run the preflight checklist.", "Simulate execution.", "Export the report for review."]
    };
  }

  if (quickWins.reduce((sum, action) => sum + action.bytes, 0) >= gapBytes) {
    return {
      ...base,
      status: "add-safe",
      tone: "safe",
      primary: "The goal can still be met with low-risk actions.",
      detail: `${formatBytes(gapBytes)} remains. Add the remaining auto-safe findings first.`,
      steps: quickWins.slice(0, 3).map((action) => `Add ${action.title} for ${formatBytes(action.bytes)}.`)
    };
  }

  if (normalSelectableBytes >= gapBytes) {
    const candidates = normalCandidates.filter((action) => action.bytes > 0);
    return {
      ...base,
      status: "expand-plan",
      tone: "review",
      primary: "The target is reachable, but it needs broader approval.",
      detail: `${formatBytes(gapBytes)} remains after the current selection.`,
      steps: candidates.slice(0, 3).map((action) => gateInstruction(action, action.gate))
    };
  }

  if (advancedCandidates.length > 0 && normalSelectableBytes + advancedCandidates.reduce((sum, action) => sum + action.bytes, 0) >= gapBytes) {
    return {
      ...base,
      status: "advanced-options",
      tone: "advanced",
      primary: "Normal cleanup is not enough; advanced options are visible.",
      detail: `${formatBytes(gapBytes)} remains after selectable non-advanced actions.`,
      steps: advancedCandidates.slice(0, 3).map((action) => gateInstruction(action, action.gate))
    };
  }

  return {
    ...base,
    status: "strategy-needed",
    tone: "advisory",
    primary: "Cleanup alone is unlikely to hit the target.",
    detail: `${formatBytes(gapBytes)} remains. The agent should explain storage migration, uninstall, or partition strategy without automating it.`,
    steps: [
      "Review large personal files and installed apps manually.",
      "Move media, game libraries, or project archives to another drive.",
      "Use partition changes only as backup-first manual guidance."
    ]
  };
}

export function buildStorageStrategyPlan({
  scanned = false,
  profile = null,
  advisor = null,
  actionList = actions,
  selectedIds = new Set(),
  approvals = {},
  itemReviewsByAction = null,
  protectedPaths = [],
  scanCoverage = null,
  goalBytes = 0
} = {}) {
  const reviewsByAction = itemReviewsByAction || buildReviewItemsByAction(actionList, null, protectedPaths, approvals);
  const totals = computeTotals(selectedIds, actionList, { approvals, itemReviewsByAction: reviewsByAction });
  const gapBytes = advisor?.gapBytes ?? Math.max(0, goalBytes - totals.selectedBytes);
  const strategyNeeded = scanned && gapBytes > 0 && advisor?.status === "strategy-needed";
  const largeFileAction = actionList.find((action) => action.id === "large-user-files");
  const downloadsAction = actionList.find((action) => action.id === "downloads-installers");
  const projectAction = actionList.find((action) => action.id === "node-modules-old");
  const gameAction = actionList.find((action) => action.id === "steam-shader-cache");
  const partitionAction = actionList.find((action) => action.id === "partitioning");
  const customRootRows = scanCoverage?.customRootRows || [];
  const customRootBytes = Number(scanCoverage?.customRootBytes || 0);

  const options = [
    {
      id: "review-custom-roots",
      title: "Review custom discovered folders",
      lane: "manual-folder-review",
      priority: customRootBytes,
      impact: customRootBytes,
      recommended: customRootRows.length > 0 && customRootBytes > 0,
      detail: "Inspect custom read-only root findings and decide whether to archive, move, uninstall through the owning app, or leave them untouched.",
      evidence: "Custom root discovery rows plus user-owned keep/move/archive notes.",
      guardrails: ["Read-only discovery", "No executor route", "No bulk folder deletion"],
      automation: "manual"
    },
    {
      id: "archive-large-files",
      title: "Archive large personal files",
      lane: "move-or-archive",
      priority: largeFileAction?.bytes || 0,
      impact: largeFileAction?.bytes || 0,
      recommended: Boolean(largeFileAction && largeFileAction.bytes > 0),
      detail: "Move reviewed videos, exports, archives, and VM images to an external or secondary drive.",
      evidence: "Large-file item review with keep/move/remove decisions.",
      guardrails: ["Per-file review", "No bulk user-folder deletion", "Prefer move/archive before removal"],
      automation: "manual"
    },
    {
      id: "uninstall-apps-manually",
      title: "Review installed apps manually",
      lane: "manual-uninstall",
      priority: 0,
      impact: 0,
      recommended: true,
      detail: "Use Windows Settings or vendor uninstallers for apps and games the scanner cannot classify safely.",
      evidence: "User-confirmed app list, publisher, install size, and last-used context.",
      guardrails: ["No automated uninstall", "No registry cleanup", "No driver updater behavior"],
      automation: "manual"
    },
    {
      id: "move-game-project-libraries",
      title: "Move game or project libraries",
      lane: "library-migration",
      priority: (gameAction?.bytes || 0) + (projectAction?.bytes || 0),
      impact: (gameAction?.bytes || 0) + (projectAction?.bytes || 0),
      recommended: Boolean(gameAction || projectAction),
      detail: "Move launcher libraries, build artifacts, old repositories, or project archives through their owning app or folder workflow.",
      evidence: "Destination drive, backup state, and app-specific move support.",
      guardrails: ["No save-data deletion", "No source-folder wipe", "Use app-native move tools when available"],
      automation: "manual"
    },
    {
      id: "offload-downloads",
      title: "Offload old installers and archives",
      lane: "archive",
      priority: downloadsAction?.bytes || 0,
      impact: downloadsAction?.bytes || 0,
      recommended: Boolean(downloadsAction && downloadsAction.bytes > 0),
      detail: "Move reviewed installers and archives to external storage when reinstall value is low.",
      evidence: "Downloads item review and archive destination.",
      guardrails: ["Item review required", "Keep recent installers", "No arbitrary Downloads wipe"],
      automation: "manual"
    },
    {
      id: "partition-or-drive-plan",
      title: "Partition or drive capacity plan",
      lane: "backup-first",
      priority: gapBytes,
      impact: 0,
      recommended: strategyNeeded,
      detail: "Consider extending C:, migrating data to a larger drive, or adding secondary storage only after backup review.",
      evidence: "Full backup, Disk Management screenshot, BitLocker/recovery-key state, and rollback plan.",
      guardrails: partitionAction?.recommendation
        ? ["No automated partition writes", "Backup-first", partitionAction.recommendation]
        : ["No automated partition writes", "Backup-first", "Manual operator decision"],
      automation: "manual"
    }
  ]
    .filter((option) => option.recommended || option.id === "partition-or-drive-plan")
    .sort((a, b) => Number(b.recommended) - Number(a.recommended) || b.priority - a.priority);

  const status = !scanned ? "scan-first" : gapBytes === 0 ? "not-needed" : strategyNeeded ? "manual-strategy" : "cleanup-first";

  return {
    schemaVersion: "spaceguard-storage-strategy/v1",
    status,
    tone: status === "manual-strategy" ? "advisory" : status === "not-needed" ? "safe" : "review",
    goalBytes,
    selectedBytes: totals.selectedBytes,
    gapBytes,
    freeBytes: Number(profile?.freeBytes || 0),
    options,
    manualOnly: true,
    automationBlockedReason: "Storage migration, uninstall, and partition strategies require user-owned backup and manual execution.",
    primary:
      status === "manual-strategy"
        ? "Cleanup cannot meet the target; switch to manual storage strategy."
        : status === "not-needed"
          ? "The current cleanup plan meets the target."
          : status === "scan-first"
            ? "Run a scan before choosing storage strategy."
          : "Try lower-risk cleanup gates before manual storage strategy."
  };
}

export function buildManualStrategyChecklist({
  storageStrategy = null,
  evidence = {}
} = {}) {
  const strategy = storageStrategy || { status: "not-evaluated", options: [], manualOnly: true };
  const checks = (strategy.options || []).flatMap((option) =>
    manualStrategyChecksForOption(option).map((check) => {
      const id = `${option.id}:${check.key}`;
      const passed = evidence[id] === true || evidence[id] === "done" || evidence[id] === "passed";
      return {
        id,
        optionId: option.id,
        optionTitle: option.title,
        lane: option.lane,
        title: check.title,
        detail: check.detail,
        required: check.required !== false,
        passed,
        status: passed ? "done" : check.required === false ? "optional" : "waiting"
      };
    })
  );
  const requiredChecks = checks.filter((check) => check.required);
  const waitingChecks = requiredChecks.filter((check) => !check.passed);
  const active = strategy.status === "manual-strategy" || strategy.status === "cleanup-first";
  const status = !checks.length
    ? "no-manual-options"
    : !active
      ? "standby"
      : waitingChecks.length
        ? "manual-work-open"
        : "manual-plan-documented";

  return {
    schemaVersion: "spaceguard-manual-strategy-checklist/v1",
    status,
    tone: status === "manual-plan-documented" ? "safe" : status === "standby" ? "review" : "advisory",
    manualOnly: true,
    automationBlockedReason: strategy.automationBlockedReason || "Manual strategy steps are tracked only; the app does not automate them.",
    optionCount: strategy.options?.length || 0,
    checks,
    waitingChecks,
    counts: {
      total: checks.length,
      required: requiredChecks.length,
      done: checks.filter((check) => check.passed).length,
      waiting: waitingChecks.length
    },
    primary:
      status === "manual-plan-documented"
        ? "Manual storage strategy has the required evidence marked."
        : status === "manual-work-open"
          ? "Manual storage strategy needs user-owned evidence before action."
          : status === "standby"
            ? "Manual strategy is visible, but lower-risk cleanup should be tried first."
            : "No manual storage strategy options are available yet."
  };
}

export function buildDecisionLog({
  scanned = false,
  scanning = false,
  scanMode = "demo",
  actionList = actions,
  selectedIds = new Set(),
  approvals = { groupConfirm: false, permanentConfirm: false, reviewed: {}, typed: {} },
  readiness,
  protectedPaths = [],
  ledger = [],
  goalBytes = 0,
  itemReviewsByAction = null,
  intakePolicy = null,
  taskPowerCatalog = null
} = {}) {
  const reviewsByAction = itemReviewsByAction || buildReviewItemsByAction(actionList, null, protectedPaths, approvals);
  const totals = computeTotals(selectedIds, actionList, { approvals, itemReviewsByAction: reviewsByAction });
  const gateState = readiness || getExecutionReadinessForActions(selectedIds, approvals, actionList, protectedPaths, reviewsByAction, intakePolicy);
  const selected = actionList.filter((action) => selectedIds.has(action.id));
  const protectedCount = actionList.filter((action) => isActionProtected(action, protectedPaths)).length;
  const intakeBlockedCount = actionList.filter((action) => !actionAllowedByIntake(action, intakePolicy)).length;
  const blockedCount = actionList.filter((action) => action.gate === "blocked" || action.gate === "advisory").length;
  const goalMet = totals.selectedBytes >= goalBytes;

  return [
    {
      id: "source",
      title: "Data source chosen",
      status: scanMode === "native-readonly" ? "real-readonly" : "demo",
      tone: scanMode === "native-readonly" ? "safe" : "review",
      detail: scanMode === "native-readonly" ? "Native scan data can size known local roots." : "Browser mode uses fixed sample data."
    },
    {
      id: "scan",
      title: "Scan state",
      status: scanning ? "running" : scanned ? "complete" : "waiting",
      tone: scanned ? "safe" : "review",
      detail: scanning ? "Scanner is running." : scanned ? "Planner can use the current scan profile." : "Run a scan before execution."
    },
    {
      id: "plan",
      title: "Plan coverage",
      status: goalMet ? "target-met" : "gap",
      tone: goalMet ? "safe" : "review",
      detail: `${formatBytes(totals.selectedBytes)} selected against ${formatBytes(goalBytes)} target.`
    },
    {
      id: "gates",
      title: "Approval gates",
      status: gateState.unresolved.length === 0 ? "resolved" : "pending",
      tone: gateState.unresolved.length === 0 ? "safe" : "review",
      detail: gateState.unresolved.length === 0 ? "No selected action is waiting on approval." : `${gateState.unresolved.length} selected action(s) still need approval.`
    },
    {
      id: "policy",
      title: "Policy boundary",
      status: protectedCount > 0 ? "protected" : intakeBlockedCount > 0 ? "intake-blocked" : "locked-visible",
      tone: protectedCount > 0 || intakeBlockedCount > 0 ? "restricted" : "review",
      detail: `${protectedCount} protected match(es), ${intakeBlockedCount} intake-blocked route(s), ${blockedCount} blocked or advisory zone(s) visible.`
    },
    {
      id: "task-powers",
      title: "Task powers",
      status: taskPowerCatalog?.status || "not-evaluated",
      tone: taskPowerCatalog?.tone || "review",
      detail: taskPowerCatalog
        ? `${taskPowerCatalog.counts.selected} selected power(s), ${taskPowerCatalog.counts.needsApproval} waiting, ${taskPowerCatalog.counts.locked} locked, real execution disabled.`
        : "Scoped powers have not been evaluated yet."
    },
    {
      id: "execution",
      title: "Execution state",
      status: ledger.length > 0 ? "ledger-written" : selected.length > 0 ? "not-run" : "no-selection",
      tone: ledger.length > 0 ? "safe" : "review",
      detail: ledger.length > 0 ? `${ledger.length} simulated step(s) recorded.` : selected.length > 0 ? "No execution has run for this plan." : "No actions selected."
    }
  ];
}

export function buildAgentQuestionQueue({
  scanned = false,
  scanning = false,
  scanMode = "demo",
  nativeCapability = { available: false },
  runtimeCapabilities = {},
  actionList = actions,
  selectedIds = new Set(),
  approvals = {},
  readiness = null,
  reviewWorkbench = null,
  recoveryAdvisor = null,
  manualStrategyChecklist = null,
  runReadiness = null,
  consentReceipt = null,
  verificationSummary = null,
  rescanComparison = null,
  rollbackPlan = null,
  validationPack = null,
  fixtureImportResult = null,
  writeBoundaryProbe = null,
  intakePolicy = null
} = {}) {
  const selected = actionList.filter((action) => selectedIds.has(action.id));
  const gateState = readiness || getExecutionReadinessForActions(selectedIds, approvals, actionList, [], null, intakePolicy);
  const questions = [];
  const addQuestion = (question) => {
    questions.push({
      status: "waiting",
      tone: questionTone(question.lane),
      options: [],
      ...question
    });
  };

  if (scanning) {
    addQuestion({
      id: "scan-running",
      lane: "discovery",
      priority: 100,
      title: "Scan in progress",
      prompt: "Should I wait for the current scan before changing the plan?",
      detail: "Planning and execution stay locked while scanner state is moving.",
      status: "active",
      action: "none",
      options: ["Wait for scan results"]
    });
  }

  if (!scanned && !scanning) {
    addQuestion({
      id: "run-first-scan",
      lane: "discovery",
      priority: 98,
      title: "Start discovery",
      prompt: "Should I scan before suggesting cleanup?",
      detail: nativeCapability?.available
        ? "The desktop shell can run a native read-only scan, or the browser demo can use sample data."
        : "The browser demo can use sample data. Native local scan is available only inside the desktop shell.",
      status: "active",
      action: "run-scan",
      options: nativeCapability?.available ? ["Run real read-only scan", "Run demo scan"] : ["Run demo scan"]
    });
  }

  if (scanned && selected.length === 0) {
    addQuestion({
      id: "choose-plan",
      lane: "planning",
      priority: 92,
      title: "Choose recovery plan",
      prompt: "Should I build a suggested plan from the current scan?",
      detail: "The agent needs at least one selected action before approvals, dry-run consent, or verification can happen.",
      action: "suggest-plan",
      options: ["Suggest safest plan"]
    });
  }

  const intakeBlockedAdminCandidates = actionList
    .filter((action) => !selectedIds.has(action.id) && !actionAllowedByIntake(action, intakePolicy) && action.gate !== "blocked" && action.gate !== "advisory")
    .sort((a, b) => b.bytes - a.bytes);
  const intakeBlockedBytes = intakeBlockedAdminCandidates.reduce((sum, action) => sum + Number(action.bytes || 0), 0);
  if (
    scanned &&
    intakePolicy?.adminSensitiveBlocked &&
    intakeBlockedAdminCandidates.length > 0 &&
    (recoveryAdvisor?.gapBytes || 0) > 0 &&
    recoveryAdvisor?.status === "strategy-needed" &&
    (gateState?.unresolved || []).length === 0 &&
    !questions.some((question) => question.id === "run-first-scan" || question.id === "choose-plan")
  ) {
    addQuestion({
      id: "allow-admin-system-routes",
      lane: "intake",
      priority: 90,
      title: "Allow admin/system dry-run routes",
      prompt: "Should admin/system cleanup routes be allowed into this dry-run plan?",
      detail: `${formatBytes(intakeBlockedBytes)} is visible behind the intake boundary. This only allows dry-run planning; real execution stays locked.`,
      action: "allow-admin-routes",
      options: ["Allow admin/system dry-run routes", "Keep admin routes gated"]
    });
  }

  const unresolved = gateState?.unresolved || [];
  if (unresolved.some((entry) => entry.gate === "permanentConfirm")) {
    const entry = unresolved.find((item) => item.gate === "permanentConfirm");
    addQuestion({
      id: "confirm-permanent-removal",
      lane: "approval",
      priority: 89,
      title: "Confirm permanent removal",
      prompt: "Can Recycle Bin emptying be included in this dry-run plan?",
      detail: entry ? gateInstruction(entry.action, entry.gate) : "Permanent-removal routes need explicit confirmation before dry-run simulation.",
      action: "confirm-permanent-removal",
      options: ["Confirm permanent removal", "Leave Recycle Bin pending"]
    });
  }

  if (unresolved.some((entry) => entry.gate === "groupConfirm")) {
    addQuestion({
      id: "approve-rebuildable-caches",
      lane: "approval",
      priority: 88,
      title: "Approve rebuildable caches",
      prompt: "Can rebuildable cache cleanup be included in this dry-run plan?",
      detail: "Caches can be recreated, but the app still asks before including them in executor preview.",
      action: "approve-rebuildable",
      options: ["Approve selected rebuildable caches", "Leave them pending"]
    });
  }

  unresolved
    .filter((entry) => entry.gate === "review")
    .slice(0, 3)
    .forEach((entry, index) => {
      addQuestion({
        id: `review-${entry.action.id}`,
        lane: "review",
        priority: 84 - index,
        title: `Review ${entry.action.title}`,
        prompt: "Which items should be removed, moved, archived, or kept?",
        detail: gateInstruction(entry.action, entry.gate),
        action: "focus-review",
        actionId: entry.action.id,
        options: ["Open item review", "Keep pending"]
      });
    });

  unresolved
    .filter((entry) => entry.gate === "typed")
    .slice(0, 2)
    .forEach((entry, index) => {
      addQuestion({
        id: `typed-${entry.action.id}`,
        lane: "advanced",
        priority: 78 - index,
        title: `Confirm ${entry.action.title}`,
        prompt: `Type ${entry.action.typedPhrase} only if you understand the consequence.`,
        detail: entry.action.consequence || "Advanced action requires explicit typed acknowledgement.",
        action: "none",
        actionId: entry.action.id,
        options: ["Use typed approval field", "Skip advanced action"]
      });
    });

  const reviewWaiting = reviewWorkbench?.needsDecision || [];
  if (reviewWaiting.length > 0 && !questions.some((question) => question.lane === "review")) {
    const row = reviewWaiting[0];
    addQuestion({
      id: `workbench-${row.id}`,
      lane: "review",
      priority: 76,
      title: `Resolve ${row.title}`,
      prompt: "Should I open the item review for this finding?",
      detail: row.nextStep || "Review-gated findings need explicit item decisions.",
      action: "focus-review",
      actionId: row.id,
      options: ["Open item review"]
    });
  }

  if (recoveryAdvisor?.status === "add-safe" || recoveryAdvisor?.status === "expand-plan" || recoveryAdvisor?.status === "advanced-options") {
    addQuestion({
      id: `advisor-${recoveryAdvisor.status}`,
      lane: "planning",
      priority: 72,
      title: "Adjust cleanup plan",
      prompt: recoveryAdvisor.primary,
      detail: recoveryAdvisor.detail,
      action: "suggest-plan",
      options: ["Rebuild suggested plan", "Keep current selection"]
    });
  }

  if (manualStrategyChecklist?.status === "manual-work-open") {
    const waiting = manualStrategyChecklist.waitingChecks?.[0];
    addQuestion({
      id: "manual-strategy-evidence",
      lane: "strategy",
      priority: 66,
      title: "Document manual strategy",
      prompt: "Which backup or manual storage evidence should be recorded next?",
      detail: waiting ? `${waiting.optionTitle}: ${waiting.detail}` : manualStrategyChecklist.primary,
      action: "none",
      options: ["Use manual checklist", "Keep cleanup-only plan"]
    });
  }

  if (runReadiness?.ready && !consentReceipt?.ready) {
    addQuestion({
      id: "arm-dry-run",
      lane: "consent",
      priority: 62,
      title: "Arm dry-run",
      prompt: "Should I arm this exact plan snapshot for dry-run simulation?",
      detail: "Consent is tied to the current selected actions, approvals, protected paths, and item decisions.",
      action: "arm-consent",
      options: ["Arm current dry-run", "Review plan first"]
    });
  }

  if (consentReceipt?.ready && !verificationSummary?.current) {
    addQuestion({
      id: "simulate-current-plan",
      lane: "execution",
      priority: 60,
      title: "Simulate plan",
      prompt: "Should I run the dry-run simulation for the armed plan?",
      detail: "This writes a local dry-run ledger only. Real deletion remains locked.",
      action: "simulate",
      options: ["Simulate dry-run", "Export report first"]
    });
  }

  if (verificationSummary?.current && rescanComparison?.status !== "matched") {
    addQuestion({
      id: "post-run-rescan",
      lane: "verification",
      priority: 58,
      title: "Verify the ledger",
      prompt: scanMode === "native-readonly" ? "Should I run a fresh native read-only scan for rescan parity?" : "Should I switch to native scan evidence before counting parity?",
      detail: rescanComparison?.detail || "Post-run verification needs a native scan after the dry-run ledger timestamp.",
      action: nativeCapability?.available ? "run-real-scan" : "none",
      options: nativeCapability?.available ? ["Run real read-only scan"] : ["Use desktop shell for native evidence"]
    });
  }

  const rollbackWaiting = rollbackPlan?.rows?.filter((row) => row.proofRequired && !row.proof?.complete) || [];
  if (rollbackWaiting.length > 0) {
    addQuestion({
      id: "rollback-proof-detail",
      lane: "rollback",
      priority: 56,
      title: "Complete rollback proof",
      prompt: "Which selected route needs restore, backup, or acknowledgement proof?",
      detail: `${rollbackWaiting[0].title} needs reviewer, evidence path, and route-specific rollback reference before real cleanup can be reviewed.`,
      action: "focus-panel",
      targetPanel: "rollback-plan-panel",
      options: ["Open rollback proof ledger"]
    });
  }

  const detailNeeded = validationPack?.validationChecks?.filter((check) => check.evidenceValue && !check.evidenceComplete) || [];
  if (detailNeeded.length > 0) {
    addQuestion({
      id: "validation-evidence-detail",
      lane: "validation",
      priority: 52,
      title: "Complete validation evidence",
      prompt: "Which validation record needs reviewer and artifact details?",
      detail: `${detailNeeded[0].label} is marked but cannot count until reviewer and evidence path are recorded.`,
      action: "none",
      options: ["Fill validation evidence fields"]
    });
  }

  const scannerFixtureCheck = validationPack?.validationChecks?.find((check) => check.id === "scanner-fixtures");
  if (scannerFixtureCheck && !scannerFixtureCheck.evidenceValue && !fixtureImportResult?.canApply) {
    addQuestion({
      id: "import-fixture-evidence",
      lane: "validation",
      priority: 50,
      title: "Import fixture evidence",
      prompt: "Should I import the disposable fixture evidence JSON?",
      detail: "Fixture import can fill only scanner-fixtures after reviewer and artifact details are present.",
      action: "focus-panel",
      targetPanel: "validation-evidence-panel",
      options: ["Open fixture evidence import"]
    });
  }

  if (writeBoundaryProbe?.commandAvailable && writeBoundaryProbe?.status !== "rejected") {
    addQuestion({
      id: "probe-write-boundary",
      lane: "validation",
      priority: 48,
      title: "Probe rejecting write boundary",
      prompt: "Should I capture rejection evidence from the native write boundary?",
      detail: "The probe must return accepted=false, every entry rejected, and zero reclaimed bytes.",
      action: "probe-write-boundary",
      options: ["Probe write boundary", "Leave unprobed"]
    });
  }

  const sorted = questions.sort((a, b) => b.priority - a.priority);
  const activeQuestion = sorted.find((question) => question.status === "active") || sorted[0] || null;

  return {
    schemaVersion: "spaceguard-question-queue/v1",
    status: !sorted.length ? "clear" : activeQuestion?.lane || "waiting",
    tone: !sorted.length ? "safe" : activeQuestion?.tone || "review",
    activeQuestion,
    questions: sorted,
    counts: {
      total: sorted.length,
      active: activeQuestion ? 1 : 0,
      approval: sorted.filter((question) => question.lane === "approval").length,
      intake: sorted.filter((question) => question.lane === "intake").length,
      review: sorted.filter((question) => question.lane === "review").length,
      validation: sorted.filter((question) => question.lane === "validation").length,
      rollback: sorted.filter((question) => question.lane === "rollback").length,
      actionable: sorted.filter((question) => question.action && question.action !== "none").length
    },
    primary: activeQuestion
      ? activeQuestion.prompt
      : "No immediate question is blocking the guarded workflow."
  };
}

export function buildReviewWorkbench(actionList = actions, selectedIds = new Set(), approvals = {}, protectedPaths = [], itemReviewsByAction = null, intakePolicy = null) {
  const reviewsByAction = itemReviewsByAction || buildReviewItemsByAction(actionList, null, protectedPaths, approvals);
  const rows = actionList
    .map((action) => {
      const protectedByUser = isActionProtected(action, protectedPaths);
      const intakeBlocked = !actionAllowedByIntake(action, intakePolicy);
      const selected = selectedIds.has(action.id);
      const itemReview = getItemReviewForAction(action, reviewsByAction);
      const gate = unresolvedGate(action, approvals, protectedPaths, itemReview, intakePolicy);
      const evidence = action.scanSource ? action.scanStatus || "measured" : "demo-estimate";
      const reviewSummary = getReviewDecisionSummary(action, approvals, itemReview);
      const status = protectedByUser
        ? "protected"
        : intakeBlocked || action.gate === "blocked" || action.gate === "advisory"
          ? "locked"
          : gate
            ? "needs-decision"
            : selected
              ? "ready"
              : "available";

      return {
        id: action.id,
        title: action.title,
        family: action.family,
        bytes: action.bytes,
        risk: action.risk,
        gate: gate || action.gate,
        selected,
        status,
        evidence,
        path: action.path,
        reviewSummary,
        nextStep: reviewNextStep(action, status, gate, evidence, reviewSummary)
      };
    })
    .sort((a, b) => {
      const statusRank = { "needs-decision": 0, protected: 1, locked: 2, ready: 3, available: 4 };
      return statusRank[a.status] - statusRank[b.status] || b.bytes - a.bytes;
    });

  return {
    rows,
    needsDecision: rows.filter((row) => row.status === "needs-decision"),
    protected: rows.filter((row) => row.status === "protected"),
    locked: rows.filter((row) => row.status === "locked"),
    measured: rows.filter((row) => row.evidence === "measured" || row.evidence === "limited"),
    unsupported: rows.filter((row) => row.evidence === "unsupported")
  };
}

export function buildReviewItemsByAction(actionList = actions, nativeScan = null, protectedPaths = [], approvals = {}) {
  return Object.fromEntries(
    actionList
      .filter((action) => action.gate === "review")
      .map((action) => [action.id, buildItemReview(action.id, actionList, nativeScan, protectedPaths, approvals)])
  );
}

export function buildItemReview(actionId, actionList = actions, nativeScan = null, protectedPaths = [], approvals = {}) {
  const action = actionList.find((item) => item.id === actionId) || actionList.find((item) => item.gate === "review") || actionList[0];
  if (!action) {
    return {
      action: null,
      source: "none",
      items: [],
      reviewBytes: 0,
      keepBytes: 0,
      protectedBytes: 0,
      removeBytes: 0,
      moveBytes: 0,
      archiveBytes: 0,
      manualDispositionBytes: 0,
      selectedBytes: 0,
      removeCount: 0,
      moveCount: 0,
      archiveCount: 0,
      keepCount: 0,
      undecidedCount: 0,
      summary: "No action is available for item review."
    };
  }

  const nativeItems = collectNativeReviewItems(action.id, nativeScan);
  const sourceItems = nativeItems.length ? nativeItems : demoReviewItems[action.id] || [];
  const source = nativeItems.length ? "native-readonly" : sourceItems.length ? "demo-review" : "none";
  const items = sourceItems.map((item, index) => normalizeReviewItem(item, action, protectedPaths, approvals, index));
  const reviewBytes = items.filter((item) => item.recommendation === "review").reduce((sum, item) => sum + item.bytes, 0);
  const keepBytes = items.filter((item) => item.recommendation === "keep").reduce((sum, item) => sum + item.bytes, 0);
  const protectedBytes = items.filter((item) => item.protected).reduce((sum, item) => sum + item.bytes, 0);
  const decisionSummary = summarizeReviewItems(items);

  return {
    action,
    source,
    items,
    reviewBytes,
    keepBytes,
    protectedBytes,
    removeBytes: decisionSummary.removeBytes,
    moveBytes: decisionSummary.moveBytes,
    archiveBytes: decisionSummary.archiveBytes,
    manualDispositionBytes: decisionSummary.moveBytes + decisionSummary.archiveBytes,
    selectedBytes: decisionSummary.removeBytes,
    removeCount: decisionSummary.removeCount,
    moveCount: decisionSummary.moveCount,
    archiveCount: decisionSummary.archiveCount,
    keepCount: decisionSummary.keepCount,
    undecidedCount: decisionSummary.undecidedCount,
    summary: items.length
      ? `${items.length} candidate item(s), ${formatBytes(decisionSummary.removeBytes)} selected for cleanup and ${formatBytes(decisionSummary.moveBytes + decisionSummary.archiveBytes)} marked for manual move/archive.`
      : "This root has no item-level candidates yet."
  };
}

export function getExecutorPolicy(action) {
  return executorPolicies[action.id] || {
    route: "unclassified",
    lane: "blocked",
    label: "Unclassified executor",
    realRunEnabled: false,
    dryRunSupported: false,
    requiresNativeValidation: true,
    verification: "No executor until the recipe is classified.",
    guardrails: ["Unknown actions default to blocked"]
  };
}

export function getActionTaskPower(action) {
  const policy = getExecutorPolicy(action);
  const powerId = getActionTaskPowerId(action, policy);
  return getTaskPowerDefinition(powerId);
}

export function buildTaskPowerCatalog({
  actionList = actions,
  selectedIds = new Set(),
  approvals = { groupConfirm: false, permanentConfirm: false, reviewed: {}, reviewItems: {}, typed: {} },
  protectedPaths = [],
  itemReviewsByAction = null,
  intakePolicy = null,
  runtimeCapabilities = {},
  scanMode = "demo"
} = {}) {
  const reviewsByAction = itemReviewsByAction || buildReviewItemsByAction(actionList, null, protectedPaths, approvals);
  const rows = taskPowerDefinitions.map((definition) => {
    const availableActions = actionList.filter((action) => getActionTaskPowerId(action) === definition.id);
    const selectedActions = availableActions.filter((action) => selectedIds.has(action.id));
    const unresolved = selectedActions
      .map((action) => ({
        action,
        gate: unresolvedGate(action, approvals, protectedPaths, getItemReviewForAction(action, reviewsByAction), intakePolicy)
      }))
      .filter((entry) => entry.gate);
    const blockers = buildTaskPowerBlockers(definition, availableActions, selectedActions, unresolved, intakePolicy);
    const plannedBytes = selectedActions.reduce((sum, action) => sum + getPlannedActionBytes(action, approvals, reviewsByAction), 0);
    const visibleBytes = availableActions.reduce((sum, action) => sum + Number(action.bytes || 0), 0);
    const dryRunActions = selectedActions.filter((action) => {
      const policy = getExecutorPolicy(action);
      const plannedActionBytes = getPlannedActionBytes(action, approvals, reviewsByAction);
      return action.executableInDemo && policy.dryRunSupported && !blockers.length && plannedActionBytes > 0;
    });
    const status = getTaskPowerStatus(definition, availableActions, selectedActions, blockers, intakePolicy);
    const tone = getTaskPowerTone(status);

    return {
      id: definition.id,
      label: definition.label,
      description: definition.description,
      scope: definition.scope,
      status,
      tone,
      selected: selectedActions.length > 0,
      availableCount: availableActions.length,
      selectedCount: selectedActions.length,
      plannedBytes,
      visibleBytes,
      dryRunAvailable: dryRunActions.length > 0,
      dryRunCount: dryRunActions.length,
      realRunAvailable: false,
      scanMode,
      runtimeRealRunEnabled: Boolean(runtimeCapabilities?.realRunEnabled),
      actions: availableActions.map((action) => ({
        id: action.id,
        title: action.title,
        gate: action.gate,
        risk: action.risk,
        selected: selectedIds.has(action.id),
        bytes: selectedIds.has(action.id) ? getPlannedActionBytes(action, approvals, reviewsByAction) : Number(action.bytes || 0),
        route: getExecutorPolicy(action).route
      })),
      blockers,
      guardrails: definition.guardrails,
      nextStep: getTaskPowerNextStep(definition, status, blockers, selectedActions)
    };
  });
  const selectedRows = rows.filter((row) => row.selected);
  const blockedRows = selectedRows.filter((row) => row.status === "blocked" || row.status === "locked" || row.status === "needs-approval");
  const status = !selectedRows.length
    ? "no-power-selected"
    : blockedRows.length
      ? "powers-need-decision"
      : "powers-scoped";

  return {
    schemaVersion: "spaceguard-task-powers/v1",
    status,
    tone: status === "powers-scoped" ? "safe" : status === "no-power-selected" ? "review" : "restricted",
    scanMode,
    realRunEnabled: false,
    destructiveCommands: Boolean(runtimeCapabilities?.destructiveCommands),
    rows,
    selectedRows,
    blockedRows,
    counts: {
      total: rows.length,
      selected: selectedRows.length,
      active: rows.filter((row) => row.status === "active").length,
      available: rows.filter((row) => row.status === "available").length,
      needsApproval: rows.filter((row) => row.status === "needs-approval").length,
      locked: rows.filter((row) => row.status === "locked").length,
      blocked: rows.filter((row) => row.status === "blocked").length,
      advisory: rows.filter((row) => row.status === "advisory").length,
      dryRun: rows.reduce((sum, row) => sum + row.dryRunCount, 0)
    },
    primary: getTaskPowerPrimary(status, blockedRows, selectedRows),
    steps: getTaskPowerSteps(status, blockedRows, selectedRows)
  };
}

export function buildExecutorPlan({
  selectedIds = new Set(),
  actionList = actions,
  approvals = { groupConfirm: false, permanentConfirm: false, reviewed: {}, typed: {} },
  protectedPaths = [],
  scanMode = "demo",
  preflight = null,
  itemReviewsByAction = null,
  intakePolicy = null
} = {}) {
  const reviewsByAction = itemReviewsByAction || buildReviewItemsByAction(actionList, null, protectedPaths, approvals);
  const selected = actionList.filter((action) => selectedIds.has(action.id));
  const rows = selected.map((action) => {
    const policy = getExecutorPolicy(action);
    const protectedByUser = isActionProtected(action, protectedPaths);
    const intakeBlocker = getIntakeBlocker(action, intakePolicy);
    const itemReview = getItemReviewForAction(action, reviewsByAction);
    const gate = unresolvedGate(action, approvals, protectedPaths, itemReview, intakePolicy);
    const policyBlocked = action.gate === "blocked" || action.gate === "advisory" || policy.lane === "blocked" || policy.lane === "advisory";
    const realBlockedReason = getRealExecutionBlocker(action, policy, scanMode);
    const plannedBytes = getPlannedActionBytes(action, approvals, reviewsByAction);
    const blockers = [
      protectedByUser ? "protected path" : null,
      intakeBlocker || null,
      gate ? gates[gate]?.label || gate : null,
      policyBlocked ? policy.label : null
    ].filter(Boolean);
    const status = blockers.length
      ? "blocked"
      : realBlockedReason
        ? "dry-run-only"
        : "real-ready";

    return {
      id: action.id,
      title: action.title,
      bytes: plannedBytes,
      visibleBytes: action.bytes,
      path: action.path,
      risk: action.risk,
      gate: gate || action.gate,
      powerId: getActionTaskPowerId(action, policy),
      powerLabel: getTaskPowerDefinition(getActionTaskPowerId(action, policy)).label,
      lane: policy.lane,
      route: policy.route,
      label: policy.label,
      method: action.method,
      consequence: action.consequence,
      status,
      canSimulate: action.executableInDemo && !protectedByUser && !policyBlocked && !gate && plannedBytes > 0,
      canRealRun: false,
      realBlockedReason,
      blockers,
      reviewDecision: itemReview ? getReviewDecisionSummary(action, approvals, itemReview) : null,
      verification: policy.verification,
      guardrails: policy.guardrails
    };
  });
  const dryRunRows = rows.filter((row) => row.canSimulate);
  const blockedRows = rows.filter((row) => row.blockers.length > 0);
  const futureRows = rows.filter((row) => row.status === "dry-run-only");

  return {
    rows,
    selectedCount: selected.length,
    dryRunCount: dryRunRows.length,
    blockedCount: blockedRows.length,
    futureCount: futureRows.length,
    realRunEnabled: false,
    preflightReady: Boolean(preflight?.ready),
    dryRunBytes: dryRunRows.reduce((sum, row) => sum + row.bytes, 0),
    blockedBytes: blockedRows.reduce((sum, row) => sum + row.bytes, 0),
    futureBytes: futureRows.reduce((sum, row) => sum + row.bytes, 0)
  };
}

export function buildExecutorReadiness(executorPlan, preflight) {
  const items = [
    {
      id: "preflight",
      label: "Execution preflight",
      detail: preflight?.ready ? "Plan preflight is ready for simulation." : "Resolve scan, selection, approval, protected path, and ledger checks first.",
      passed: Boolean(preflight?.ready)
    },
    {
      id: "dry-run-routes",
      label: "Dry-run routes classified",
      detail: executorPlan.rows.length ? `${executorPlan.dryRunCount}/${executorPlan.rows.length} selected action(s) can simulate.` : "Select at least one action.",
      passed: executorPlan.rows.length > 0 && executorPlan.dryRunCount > 0
    },
    {
      id: "policy-blockers",
      label: "No executor policy blockers",
      detail: executorPlan.blockedCount === 0 ? "Selected routes are not policy-blocked." : `${executorPlan.blockedCount} selected route(s) are blocked or gated.`,
      passed: executorPlan.blockedCount === 0
    },
    {
      id: "real-disabled",
      label: "Real deletion disabled",
      detail: "The app is still dry-run only until Windows validation and rollback tests exist.",
      passed: !executorPlan.realRunEnabled
    }
  ];

  return {
    ready: items.every((item) => item.passed),
    items
  };
}

export function buildRunReadiness(preflight, executorReadiness) {
  const dryRunItem = executorReadiness?.items?.find((item) => item.id === "dry-run-routes");
  const policyItem = executorReadiness?.items?.find((item) => item.id === "policy-blockers");
  const items = [
    {
      id: "workflow-preflight",
      label: "Workflow preflight ready",
      detail: preflight?.ready ? "Scan, selection, gates, protected paths, and current ledger checks pass." : "Resolve workflow preflight before simulation.",
      passed: Boolean(preflight?.ready)
    },
    {
      id: "dry-run-route",
      label: "Dry-run route available",
      detail: dryRunItem?.detail || "Executor plan has no simulatable route.",
      passed: Boolean(dryRunItem?.passed)
    },
    {
      id: "executor-policy",
      label: "Executor policy clear",
      detail: policyItem?.detail || "Executor policy has not been evaluated.",
      passed: Boolean(policyItem?.passed)
    },
    {
      id: "real-run-locked",
      label: "Real deletion still locked",
      detail: "Simulation is allowed only while real deletion remains disabled.",
      passed: Boolean(executorReadiness?.items?.find((item) => item.id === "real-disabled")?.passed)
    }
  ];

  return {
    ready: items.every((item) => item.passed),
    items,
    blockedCount: items.filter((item) => !item.passed).length
  };
}

export function buildPrivilegeBoundary({
  runtimeCapabilities = null,
  executorPlan = null
} = {}) {
  const runtime = runtimeCapabilities || {};
  const rows = executorPlan?.rows || [];
  const adminRows = rows.filter((row) => requiresAdminBoundary(row));
  const elevated = Boolean(runtime.elevated);
  const nativeAvailable = Boolean(runtime.available);
  const status = !nativeAvailable
    ? "browser-demo"
    : adminRows.length && !elevated
      ? "admin-required"
      : elevated
        ? "elevated"
        : "standard-user";
  const items = [
    {
      id: "native-runtime",
      label: "Native runtime evidence",
      detail: nativeAvailable ? `Runtime platform is ${runtime.platform || "unknown"}.` : "Browser demo cannot prove elevation state.",
      passed: nativeAvailable
    },
    {
      id: "elevation-state",
      label: "Elevation state captured",
      detail: nativeAvailable
        ? elevated
          ? `Process is elevated via ${runtime.elevationSource || "runtime evidence"}.`
          : `Process is not elevated${runtime.elevationSource ? ` via ${runtime.elevationSource}` : ""}.`
        : "Start the Windows desktop shell to capture elevation state.",
      passed: nativeAvailable
    },
    {
      id: "admin-routes",
      label: "Admin route boundary",
      detail: adminRows.length
        ? `${adminRows.length} selected route(s) would require admin/elevation validation before real execution.`
        : "No selected route currently requires admin validation.",
      passed: adminRows.length === 0 || elevated
    },
    {
      id: "no-elevation-automation",
      label: "No elevation automation",
      detail: "The app never self-elevates or requests UAC; admin-sensitive work remains explicit and user-owned.",
      passed: true
    },
    {
      id: "real-locked",
      label: "Real execution locked",
      detail: runtime.realRunEnabled ? "Real execution is enabled; admin policy must be re-reviewed." : "Real execution remains disabled.",
      passed: !runtime.realRunEnabled
    }
  ];

  return {
    schemaVersion: "spaceguard-privilege-boundary/v1",
    status,
    tone: status === "admin-required" ? "review" : status === "elevated" ? "safe" : "restricted",
    nativeAvailable,
    elevated,
    elevationSource: runtime.elevationSource || "",
    adminRows,
    adminCount: adminRows.length,
    readyForAdminRoutes: adminRows.length === 0 || elevated,
    items,
    blockedCount: items.filter((item) => !item.passed).length
  };
}

export function buildExecutionConsentReceipt({
  planSnapshot = null,
  executorPlan = null,
  runReadiness = null,
  consent = {}
} = {}) {
  const planId = planSnapshot?.id || "";
  const accepted = Boolean(consent.accepted);
  const acceptedPlanId = consent.planId || "";
  const planMatches = accepted && acceptedPlanId === planId;
  const rows = executorPlan?.rows || [];
  const executableRows = rows.filter((row) => row.canSimulate);
  const consequenceRows = executableRows.filter((row) => row.consequence);
  const items = [
    {
      id: "run-ready",
      label: "Run readiness passed",
      detail: runReadiness?.ready ? "Workflow, route, policy, and dry-run lock checks pass." : "Resolve run readiness before arming the plan.",
      passed: Boolean(runReadiness?.ready)
    },
    {
      id: "plan-accepted",
      label: "Current plan acknowledged",
      detail: accepted ? `Consent captured for ${acceptedPlanId || "unknown plan"}.` : "Arm the current plan before simulation.",
      passed: accepted
    },
    {
      id: "plan-match",
      label: "Consent matches plan snapshot",
      detail: planMatches ? `Consent is tied to ${planId}.` : "The plan changed after consent or no matching consent exists.",
      passed: planMatches
    },
    {
      id: "real-locked",
      label: "Real deletion locked",
      detail: executorPlan?.realRunEnabled ? "Real execution is enabled; dry-run consent is not sufficient." : "This receipt can only start dry-run simulation.",
      passed: !executorPlan?.realRunEnabled
    }
  ];

  return {
    schemaVersion: "spaceguard-execution-consent/v1",
    ready: items.every((item) => item.passed),
    planId,
    accepted,
    acceptedPlanId,
    acceptedAt: consent.acceptedAt || "",
    selectedCount: planSnapshot?.selectedCount || 0,
    expectedBytes: executorPlan?.dryRunBytes || planSnapshot?.selectedBytes || 0,
    executableCount: executableRows.length,
    routeCount: new Set(executableRows.map((row) => row.route)).size,
    warnings: consequenceRows.map((row) => ({
      id: row.id,
      title: row.title,
      route: row.route,
      consequence: row.consequence
    })),
    items,
    blockedCount: items.filter((item) => !item.passed).length
  };
}

export function buildRollbackPlan({
  planSnapshot = null,
  executorPlan = null,
  itemReviewsByAction = {},
  postRunVerification = null,
  rollbackEvidence = {},
  scanMode = "demo"
} = {}) {
  const rows = (executorPlan?.rows || []).map((row) => {
    const requirement = getExecutorRouteRequirement(row.route);
    const itemReview = itemReviewsByAction?.[row.id] || null;
    const checkpoint = postRunVerification?.checkpoints?.find((item) => item.id === row.id) || null;
    const posture = getRollbackPosture(row, requirement, itemReview);
    const proof = normalizeRollbackEvidenceRecord(row.id, posture, rollbackEvidence[row.id]);
    const proofRequired = isRollbackProofRequired(posture.status);
    const status = proofRequired && proof.complete ? "proof-complete" : posture.status;
    return {
      id: row.id,
      title: row.title,
      route: row.route,
      lane: row.lane,
      status,
      rollbackStatus: posture.status,
      tone: status === "proof-complete" ? "safe" : posture.tone,
      bytes: Number(row.bytes || 0),
      dryRunAllowed: Boolean(row.canSimulate),
      realRunAllowed: false,
      proofRequired,
      restoreMode: posture.restoreMode,
      recovery: posture.recovery,
      reviewedItems: itemReview?.removeCount || 0,
      restoreTarget: posture.restoreTarget,
      rollback: requirement.rollback,
      consequence: row.consequence || "",
      checkpointStatus: checkpoint?.status || "not-run",
      checkpointEvidence: checkpoint?.evidenceRequired || "",
      requiredEvidence: posture.requiredEvidence,
      proof,
      blockers: row.blockers || []
    };
  });
  const executableRows = rows.filter((row) => row.dryRunAllowed);
  const needsProofRows = rows.filter((row) => row.proofRequired && !row.proof.complete);
  const blockedRows = rows.filter((row) => row.status === "not-executable");
  const rebuildableRows = rows.filter((row) => row.status === "rebuildable-rescan");
  const proofCompleteRows = rows.filter((row) => row.status === "proof-complete");
  const proofDraftRows = rows.filter((row) => row.proofRequired && row.proof.status !== "missing" && !row.proof.complete);
  const status = !rows.length
    ? "no-selection"
    : executableRows.length === 0
      ? "no-executable-routes"
      : needsProofRows.length
        ? "needs-rollback-proof"
        : "rebuildable-routes";
  const tone = status === "rebuildable-routes" ? "safe" : status === "needs-rollback-proof" ? "review" : "restricted";

  return {
    schemaVersion: "spaceguard-rollback-plan/v1",
    planId: planSnapshot?.id || "",
    scanMode,
    status,
    tone,
    realRunEnabled: false,
    rows,
    counts: {
      routes: rows.length,
      dryRunAllowed: executableRows.length,
      rebuildable: rebuildableRows.length,
      proofComplete: proofCompleteRows.length,
      proofDraft: proofDraftRows.length,
      needsProof: needsProofRows.length,
      blocked: blockedRows.length,
      permanent: rows.filter((row) => row.rollbackStatus === "permanent-warning").length,
      checkpoints: postRunVerification?.checkpoints?.length || 0
    },
    detail: getRollbackPlanDetail(status, rows, needsProofRows),
    steps: buildRollbackSteps(status, rows, needsProofRows, postRunVerification)
  };
}

export function normalizeRollbackEvidenceRecord(rowId, posture = {}, value = null) {
  const proofRequired = isRollbackProofRequired(posture.status);

  if (value === true || value === "complete" || value === "proved") {
    return {
      id: rowId,
      status: proofRequired ? "legacy-needs-detail" : "proved",
      complete: !proofRequired,
      restoreLocation: "",
      evidencePath: "",
      reviewer: "",
      notes: "",
      recordedAt: "",
      updatedAt: "",
      detail: proofRequired
        ? "Legacy rollback proof needs reviewer, artifact path, and route-specific reference."
        : "Rebuildable route does not require rollback proof detail."
    };
  }

  if (!value || typeof value !== "object") {
    return {
      id: rowId,
      status: "missing",
      complete: false,
      restoreLocation: "",
      evidencePath: "",
      reviewer: "",
      notes: "",
      recordedAt: "",
      updatedAt: "",
      detail: proofRequired
        ? "Rollback proof has not been recorded."
        : "Rebuildable route uses ledger and rescan proof instead of rollback proof."
    };
  }

  const status =
    value.status === "proved" || value.status === "complete"
      ? "proved"
      : value.status === "failed"
        ? "failed"
        : "draft";
  const restoreLocation = String(
    value.restoreLocation ||
      value.restore_location ||
      value.backupReference ||
      value.backup_reference ||
      value.acknowledgementReference ||
      value.acknowledgement_reference ||
      ""
  ).trim();
  const evidencePath = String(value.evidencePath || value.evidence_path || value.artifactId || value.artifact_id || "").trim();
  const reviewer = String(value.reviewer || "").trim();
  const notes = String(value.notes || "").trim();
  const recordedAt = String(value.recordedAt || value.recorded_at || "").trim();
  const updatedAt = String(value.updatedAt || value.updated_at || "").trim();
  const complete =
    proofRequired &&
    status === "proved" &&
    Boolean(reviewer) &&
    Boolean(evidencePath) &&
    Boolean(restoreLocation);

  return {
    id: rowId,
    status,
    complete,
    restoreLocation,
    evidencePath,
    reviewer,
    notes,
    recordedAt,
    updatedAt,
    detail: complete
      ? `Rollback proof recorded by ${reviewer}.`
      : status === "proved"
        ? "Reviewer, evidence path, and route-specific restore, backup, or acknowledgement reference are required."
        : status === "failed"
          ? "Rollback proof was marked failed and cannot satisfy write readiness."
        : "Draft rollback proof is visible but does not satisfy write readiness."
  };
}

export const normalizeRollbackProofRecord = normalizeRollbackEvidenceRecord;

export function buildExecutorManifest({
  actionList = actions,
  executorPlan = null,
  releaseGate = null
} = {}) {
  const selectedRows = executorPlan?.rows || [];
  const releaseChecks = releaseGate?.rows || windowsValidationChecks.map((check) => ({ ...check, status: "missing-evidence", passed: false }));
  const routeIds = Array.from(
    new Set([
      ...Object.keys(executorRouteRequirements),
      ...actionList.map((action) => getExecutorPolicy(action).route),
      ...selectedRows.map((row) => row.route)
    ])
  );

  const routes = routeIds.map((route) => {
    const requirement = getExecutorRouteRequirement(route);
    const routeActions = actionList.filter((action) => getExecutorPolicy(action).route === route);
    const routePolicies = routeActions.map((action) => getExecutorPolicy(action));
    const selectedRouteRows = selectedRows.filter((row) => row.route === route);
    const representativePolicy = routePolicies[0] || {};
    const lane = requirement.lane || representativePolicy.lane || "blocked";
    const requiredChecks = (requirement.requiredValidationIds || []).map((id) => {
      const check = releaseChecks.find((row) => row.id === id) || windowsValidationChecks.find((row) => row.id === id);
      return {
        id,
        label: check?.label || id,
        status: check?.status || "missing-evidence",
        passed: Boolean(check?.passed)
      };
    });
    const missingCheckIds = requiredChecks.filter((check) => !check.passed).map((check) => check.id);
    const dryRunSupported = routePolicies.some((policy) => policy.dryRunSupported) || selectedRouteRows.some((row) => row.canSimulate);
    const realRunEnabled = routePolicies.some((policy) => policy.realRunEnabled) || selectedRouteRows.some((row) => row.canRealRun);
    const blocked = lane === "blocked" || route === "blocked";
    const advisory = lane === "advisory" || route === "advisory";
    const status = blocked
      ? "blocked"
      : advisory
        ? "advisory"
        : !dryRunSupported
          ? "no-dry-run"
          : missingCheckIds.length
            ? "needs-validation"
            : realRunEnabled
              ? "real-enabled"
              : "validated-locked";

    return {
      route,
      title: requirement.title,
      lane,
      phase: requirement.phase,
      status,
      actionIds: routeActions.map((action) => action.id),
      actionTitles: routeActions.map((action) => action.title),
      selectedCount: selectedRouteRows.length,
      canSimulateCount: selectedRouteRows.filter((row) => row.canSimulate).length,
      dryRunSupported,
      realRunEnabled,
      requiredChecks,
      missingCheckIds,
      fixtureIds: requirement.fixtureIds || [],
      preconditions: requirement.preconditions || [],
      implementation: requirement.implementation,
      rollback: requirement.rollback,
      proof: requirement.proof,
      guardrails: uniqueStrings(routePolicies.flatMap((policy) => policy.guardrails || []))
    };
  });
  const selectedRoutes = routes.filter((route) => route.selectedCount > 0);
  const shippableRoutes = routes.filter((route) => route.phase === "first-safe" && route.status !== "blocked" && route.status !== "advisory");

  return {
    schemaVersion: "spaceguard-executor-manifest/v1",
    routes,
    selectedRoutes,
    shippableRoutes,
    counts: {
      routes: routes.length,
      selectedRoutes: selectedRoutes.length,
      firstSafeRoutes: routes.filter((route) => route.phase === "first-safe").length,
      needsValidation: routes.filter((route) => route.status === "needs-validation").length,
      blocked: routes.filter((route) => route.status === "blocked").length,
      advisory: routes.filter((route) => route.status === "advisory").length,
      realEnabled: routes.filter((route) => route.status === "real-enabled").length
    },
    nextSteps: buildExecutorManifestNextSteps(routes, selectedRoutes)
  };
}

export function buildRealExecutorCapsule({
  executorManifest = null,
  executorPlan = null,
  releaseGate = null,
  writeReadiness = null,
  rollbackPlan = null,
  rescanComparison = null,
  privilegeBoundary = null,
  privacyBoundary = null,
  runtimeCapabilities = {}
} = {}) {
  const selectedRoutes = executorManifest?.selectedRoutes || [];
  const firstSafeRoutes = executorManifest?.routes?.filter((route) => route.phase === "first-safe" && route.status !== "blocked" && route.status !== "advisory") || [];
  const selectedFirstSafe = selectedRoutes.find((route) => route.phase === "first-safe" && route.status !== "blocked" && route.status !== "advisory");
  const route = selectedFirstSafe || firstSafeRoutes[0] || null;
  const selectedRows = route ? (executorPlan?.rows || []).filter((row) => row.route === route.route) : [];
  const releaseMissingIds = route?.missingCheckIds || [];
  const writeBlockedItems = writeReadiness?.blockedItems || [];
  const implementationBlocked = !route || !executorPlan?.realRunEnabled || selectedRows.every((row) => !row.canRealRun);
  const destructiveActionAvailable = false;
  const blockers = [
    !route
      ? {
          id: "no-first-safe-route",
          label: "No first-safe route",
          detail: "Select a cleanup route with a first-safe executor lane before implementation planning."
        }
      : null,
    implementationBlocked
      ? {
          id: "implementation-missing",
          label: "Implementation missing",
          detail: "No write-capable Tauri command is implemented or enabled for this route."
        }
      : null,
    ...releaseMissingIds.map((id) => ({
      id: `validation-${id}`,
      label: "Validation missing",
      detail: `${id} evidence is required for ${route?.title || "the selected route"}.`
    })),
    rescanComparison?.status === "matched"
      ? null
      : {
          id: "rescan-parity",
          label: "Rescan parity missing",
          detail: rescanComparison?.detail || "Post-run native rescan comparison has not matched."
        },
    rollbackPlan?.status === "rebuildable-routes"
      ? null
      : {
          id: "rollback-proof",
          label: "Rollback proof missing",
          detail: rollbackPlan?.detail || "Rollback posture is not clean for real execution."
        },
    privilegeBoundary?.nativeAvailable && privilegeBoundary?.readyForAdminRoutes
      ? null
      : {
          id: "privilege-boundary",
          label: "Privilege boundary missing",
          detail: "Native privilege evidence must be captured before write execution."
        },
    privacyBoundary?.cloudDisabled && privacyBoundary?.telemetryDisabled && privacyBoundary?.exportOnly
      ? null
      : {
          id: "privacy-boundary",
          label: "Privacy boundary missing",
          detail: "Local-only privacy boundary must pass before write execution."
        },
    ...writeBlockedItems.slice(0, 3).map((item) => ({
      id: `write-${item.id}`,
      label: item.label,
      detail: item.detail
    }))
  ].filter(Boolean);
  const uniqueBlockers = dedupeBlockers(blockers);
  const status = !route
    ? "no-route"
    : destructiveActionAvailable
      ? "execution-available"
      : implementationBlocked
        ? "implementation-capsule"
        : uniqueBlockers.length
          ? "evidence-blocked"
          : "implementation-ready";

  return {
    schemaVersion: "spaceguard-real-executor-capsule/v1",
    status,
    tone: destructiveActionAvailable ? "safe" : status === "implementation-capsule" || status === "no-route" ? "restricted" : "review",
    destructiveActionAvailable,
    realRunEnabled: Boolean(executorPlan?.realRunEnabled),
    route: route
      ? {
          id: route.route,
          title: route.title,
          lane: route.lane,
          phase: route.phase,
          status: route.status,
          implementation: route.implementation,
          rollback: route.rollback,
          proof: route.proof,
          preconditions: route.preconditions || [],
          fixtureIds: route.fixtureIds || [],
          missingCheckIds: releaseMissingIds,
          selectedCount: route.selectedCount || 0
        }
      : null,
    selectedRows: selectedRows.map((row) => ({
      id: row.id,
      title: row.title,
      bytes: Number(row.bytes || 0),
      canSimulate: Boolean(row.canSimulate),
      canRealRun: Boolean(row.canRealRun),
      status: row.status
    })),
    codePath: {
      command: "execute_cleanup_plan",
      status: runtimeCapabilities?.executeCleanupPlan ? "rejecting-stub" : "not-implemented",
      destructiveCommands: false,
      featureFlag: "realExecutors",
      nativeBoundary: runtimeCapabilities?.executeCleanupPlan
        ? "Tauri command is present but rejects every request while real execution is disabled."
        : "Tauri command must reject every route except the selected first-safe capsule."
    },
    blockers: uniqueBlockers,
    counts: {
      blockers: uniqueBlockers.length,
      missingChecks: releaseMissingIds.length,
      selectedRows: selectedRows.length,
      fixtures: route?.fixtureIds?.length || 0,
      preconditions: route?.preconditions?.length || 0
    },
    primary: getRealExecutorCapsulePrimary(status, route, uniqueBlockers),
    steps: buildRealExecutorCapsuleSteps(status, route, uniqueBlockers)
  };
}

export function buildWriteBoundaryProbe({
  nativeWriteBoundary = null,
  realExecutorCapsule = null,
  runtimeCapabilities = {}
} = {}) {
  const stateStatus = nativeWriteBoundary?.status || "idle";
  const result = nativeWriteBoundary?.result || (nativeWriteBoundary?.entries ? nativeWriteBoundary : null);
  const selectedRows = realExecutorCapsule?.selectedRows || [];
  const warnings = Array.isArray(result?.warnings) ? result.warnings : [];
  const entries = Array.isArray(result?.entries)
    ? result.entries.map((entry) => ({
        id: entry.id || "",
        title: entry.title || "",
        route: entry.route || "",
        result: entry.result || "unknown",
        bytes: Number(entry.bytes || 0),
        note: entry.note || ""
      }))
    : [];
  const accepted = Boolean(result?.accepted);
  const realRunEnabled = Boolean(result?.realRunEnabled || runtimeCapabilities?.realRunEnabled);
  const destructiveCommands = Boolean(result?.destructiveCommands || runtimeCapabilities?.destructiveCommands);
  const available = Boolean(result?.available !== false && runtimeCapabilities?.available);
  const commandAvailable = Boolean(runtimeCapabilities?.executeCleanupPlan);
  const bytes = entries.reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
  const rejected = entries.filter((entry) => entry.result === "rejected").length;
  const complete = stateStatus === "complete" || Boolean(result);
  const unavailable = !runtimeCapabilities?.available || !commandAvailable || result?.available === false;
  const zeroByteRejection =
    complete &&
    !unavailable &&
    !accepted &&
    !realRunEnabled &&
    !destructiveCommands &&
    bytes === 0 &&
    entries.length > 0 &&
    rejected === entries.length;
  const unsafeSignal =
    complete &&
    !unavailable &&
    (accepted || realRunEnabled || destructiveCommands || bytes > 0 || entries.some((entry) => entry.result !== "rejected"));
  const status = stateStatus === "running"
    ? "running"
    : stateStatus === "error"
      ? "error"
      : !complete || stateStatus === "idle"
        ? "not-run"
        : unavailable
          ? "native-unavailable"
          : unsafeSignal
            ? "unsafe-signal"
            : zeroByteRejection
              ? "rejected"
              : "inconclusive";

  return {
    schemaVersion: "spaceguard-write-boundary-probe/v1",
    status,
    tone: status === "rejected" ? "safe" : status === "unsafe-signal" || status === "error" ? "restricted" : "review",
    rejectionEvidence: status === "rejected",
    destructiveActionAvailable: false,
    available,
    commandAvailable,
    accepted,
    realRunEnabled,
    destructiveCommands,
    reason: nativeWriteBoundary?.error || result?.reason || getWriteBoundaryProbeReason(status),
    route: realExecutorCapsule?.route || null,
    entries,
    warnings,
    counts: {
      selectedRows: selectedRows.length,
      entries: entries.length,
      rejected,
      bytes,
      warnings: warnings.length
    },
    primary: getWriteBoundaryProbePrimary(status, { selectedRows, entries, rejected, bytes }),
    steps: buildWriteBoundaryProbeSteps(status)
  };
}

export function buildToolCommandInventory({
  actionList = actions,
  executorPlan = null,
  releaseGate = null
} = {}) {
  const selectedRows = executorPlan?.rows || [];
  const validationRows = releaseGate?.rows || [];
  const commandEvidence = validationRows.find((row) => row.id === "tool-native-dry-runs");
  const rows = toolNativeCommandSpecs.map((spec) => {
    const action = actionList.find((item) => item.id === spec.actionId) || null;
    const selectedRow = selectedRows.find((row) => row.id === spec.actionId || row.route === spec.route);
    const selected = Boolean(selectedRow);
    const supported = spec.route === "tool-native-prune" || spec.route === "bounded-cache-delete" || spec.route === "windows-cleanup-api";
    const status = !supported
      ? "unsupported"
      : selected
        ? "selected-inventory-only"
        : spec.status;
    return {
      ...spec,
      selected,
      visibleBytes: action?.bytes || selectedRow?.visibleBytes || 0,
      plannedBytes: selectedRow?.bytes || 0,
      executorStatus: selectedRow?.status || "not-selected",
      canSimulate: Boolean(selectedRow?.canSimulate),
      canRealRun: false,
      realRunEnabled: false,
      status,
      validationStatus: commandEvidence?.passed ? "evidence-recorded" : commandEvidence?.status || "missing-evidence",
      validationPassed: Boolean(commandEvidence?.passed),
      blockedReason: "Command inventory is documentation and validation planning only; the app does not execute shell commands."
    };
  });
  const selectedRowsForCommands = rows.filter((row) => row.selected);
  const waitingRows = rows.filter((row) => row.selected && !row.validationPassed);

  return {
    schemaVersion: "spaceguard-tool-command-inventory/v1",
    realRunEnabled: false,
    commandExecutionEnabled: false,
    rows,
    selectedRows: selectedRowsForCommands,
    waitingRows,
    counts: {
      commands: rows.length,
      selected: selectedRowsForCommands.length,
      waiting: waitingRows.length,
      validationRecorded: rows.filter((row) => row.validationPassed).length,
      shellExecutors: 0
    },
    primary: selectedRowsForCommands.length
      ? "Selected tool-native routes have command inventory, but shell execution is disabled."
      : "Tool-native command inventory is available for future Windows validation.",
    steps: [
      "Use native read-only scan evidence before any command validation.",
      "Record tool-native dry-run evidence in disposable Windows VMs.",
      "Keep command execution disabled until release gates and rollback proof pass."
    ]
  };
}

export function buildReleaseGate({
  featureFlags = releaseFeatureFlags,
  validationEvidence = {},
  scanMode = "demo",
  nativeCapability = { available: false },
  executorPlan = null
} = {}) {
  const flags = { ...releaseFeatureFlags, ...featureFlags };
  const realFlagEnabled = Boolean(flags.realExecutors);
  const nativeReady = scanMode === "native-readonly" && Boolean(nativeCapability.available);
  const rows = windowsValidationChecks.map((check) => {
    const evidenceRecord = normalizeValidationEvidenceRecord(check.id, validationEvidence[check.id]);
    const passed = evidenceRecord.passed;
    const status = passed
      ? "passed"
      : evidenceRecord.marked
        ? evidenceRecord.qualityStatus
        : !realFlagEnabled
          ? "blocked-by-flag"
          : !nativeReady
            ? "needs-native"
            : "missing-evidence";

    return {
      ...check,
      status,
      passed,
      evidenceValue: evidenceRecord.evidenceValue,
      evidenceRecord
    };
  });
  const vmRows = disposableVmScenarios.map((scenario) => {
    const passedCount = scenario.mustPass.filter((id) => rows.find((row) => row.id === id)?.passed).length;
    return {
      ...scenario,
      passedCount,
      totalCount: scenario.mustPass.length,
      status: passedCount === scenario.mustPass.length ? "passed" : realFlagEnabled ? "missing-evidence" : "blocked-by-flag"
    };
  });
  const missingRows = rows.filter((row) => !row.passed);
  const routeRows = executorPlan?.rows || [];
  const candidateRoutes = routeRows.filter((row) => row.status === "dry-run-only" || row.canSimulate);

  return {
    flags,
    realFlagEnabled,
    nativeReady,
    readyForRealRun: realFlagEnabled && nativeReady && missingRows.length === 0 && candidateRoutes.length > 0,
    rows,
    vmRows,
    missingRows,
    passedCount: rows.length - missingRows.length,
    totalCount: rows.length,
    candidateRoutes,
    blockedReason: getReleaseBlockedReason({ realFlagEnabled, nativeReady, missingRows, candidateRoutes })
  };
}

export function normalizeValidationEvidenceRecord(checkId, value = null) {
  if (value === true || value === "passed") {
    return {
      id: checkId,
      status: "passed",
      evidenceValue: "legacy-passed",
      marked: true,
      legacy: true,
      complete: false,
      passed: false,
      qualityStatus: "legacy-needs-detail",
      evidencePath: "",
      reviewer: "",
      notes: "",
      recordedAt: "",
      updatedAt: "",
      detail: "Legacy checkbox evidence must be replaced with reviewer and artifact path before release."
    };
  }

  if (!value || typeof value !== "object") {
    return {
      id: checkId,
      status: "not-run",
      evidenceValue: "",
      marked: false,
      legacy: false,
      complete: false,
      passed: false,
      qualityStatus: "missing-evidence",
      evidencePath: "",
      reviewer: "",
      notes: "",
      recordedAt: "",
      updatedAt: "",
      detail: "No evidence record has been captured."
    };
  }

  const status = value.status === "passed" || value.status === "failed" || value.status === "draft" ? value.status : "draft";
  const evidencePath = String(value.evidencePath || value.evidence_path || "").trim();
  const reviewer = String(value.reviewer || "").trim();
  const notes = String(value.notes || "").trim();
  const recordedAt = String(value.recordedAt || value.recorded_at || "").trim();
  const updatedAt = String(value.updatedAt || value.updated_at || "").trim();
  const complete = status === "passed" && Boolean(evidencePath) && Boolean(reviewer);
  const qualityStatus = complete
    ? "passed"
    : status === "failed"
      ? "failed"
      : status === "passed"
        ? "needs-evidence-detail"
        : "draft";

  return {
    id: checkId,
    status,
    evidenceValue: status,
    marked: status !== "not-run",
    legacy: false,
    complete,
    passed: complete,
    qualityStatus,
    evidencePath,
    reviewer,
    notes,
    recordedAt,
    updatedAt,
    detail: complete
      ? `Evidence recorded by ${reviewer}.`
      : status === "passed"
        ? "Reviewer and artifact path are required before this check can pass."
        : status === "failed"
          ? "Evidence run failed and blocks release."
          : "Draft evidence is not enough for release."
  };
}

export function buildFixtureEvidenceImport({
  evidenceText = "",
  evidenceObject = null,
  reviewer = "",
  artifactId = "",
  currentEvidence = {},
  importedAt = new Date().toISOString()
} = {}) {
  const parsed = parseFixtureEvidenceInput(evidenceObject, evidenceText);
  const cleanReviewer = String(reviewer || "").trim();

  if (!parsed.ok) {
    return buildRejectedFixtureImport("parse-error", parsed.detail, currentEvidence, importedAt);
  }

  const evidence = parsed.value;
  if (evidence.schemaVersion !== "spaceguard-fixture-evidence/v1") {
    return buildRejectedFixtureImport("schema-mismatch", "Fixture evidence must use spaceguard-fixture-evidence/v1.", currentEvidence, importedAt, evidence);
  }
  if (evidence.destructiveCommands !== false) {
    return buildRejectedFixtureImport("destructive-evidence", "Fixture evidence must prove destructiveCommands=false.", currentEvidence, importedAt, evidence);
  }
  if (!evidence.passed) {
    return buildRejectedFixtureImport("fixture-failed", "Fixture evidence did not pass all existence, size, and age checks.", currentEvidence, importedAt, evidence);
  }
  if (!Array.isArray(evidence.records) || evidence.records.length === 0) {
    return buildRejectedFixtureImport("missing-records", "Fixture evidence has no records.", currentEvidence, importedAt, evidence);
  }
  if (!cleanReviewer) {
    return buildRejectedFixtureImport("missing-reviewer", "Reviewer is required before fixture evidence can update validation records.", currentEvidence, importedAt, evidence);
  }

  const failingRecords = evidence.records.filter((record) => !record?.exists || !record?.sizeMatches || !record?.oldEnough);
  if (failingRecords.length) {
    return buildRejectedFixtureImport("fixture-record-failed", `${failingRecords.length} fixture record(s) failed existence, size, or age assertions.`, currentEvidence, importedAt, evidence);
  }

  const purposes = Array.from(new Set(evidence.records.map((record) => String(record.purpose || "").trim()).filter(Boolean))).sort();
  const checkIds = purposes.length ? ["scanner-fixtures"] : [];
  const evidencePath = String(artifactId || "").trim() || `fixture-evidence:${evidence.generatedAt || importedAt}`;
  const notes = [
    "Imported disposable fixture evidence.",
    `records=${evidence.records.length}`,
    `purposes=${purposes.join(", ") || "none"}`,
    "destructiveCommands=false"
  ].join(" | ");
  const validationEvidence = {
    ...currentEvidence
  };
  for (const checkId of checkIds) {
    validationEvidence[checkId] = {
      status: "passed",
      evidencePath,
      reviewer: cleanReviewer,
      notes,
      recordedAt: evidence.generatedAt || importedAt,
      updatedAt: importedAt,
      source: "fixture-evidence-import",
      fixtureSummary: {
        schemaVersion: evidence.schemaVersion,
        generatedAt: evidence.generatedAt || "",
        counts: sanitizeFixtureCounts(evidence.counts),
        purposes
      }
    };
  }

  return {
    schemaVersion: "spaceguard-fixture-evidence-import/v1",
    status: checkIds.length ? "ready" : "no-mapped-checks",
    canApply: checkIds.length > 0,
    importedAt,
    generatedAt: evidence.generatedAt || "",
    reviewer: cleanReviewer,
    artifactId: evidencePath,
    mappedCheckIds: checkIds,
    counts: {
      records: evidence.records.length,
      purposes: purposes.length,
      mappedChecks: checkIds.length,
      missing: Number(evidence.counts?.missing || 0),
      sizeMismatches: Number(evidence.counts?.sizeMismatches || 0),
      ageMismatches: Number(evidence.counts?.ageMismatches || 0)
    },
    purposes,
    detail: checkIds.length
      ? `Fixture evidence can update ${checkIds.length} validation check(s).`
      : "Fixture evidence passed, but no validation check mapping exists.",
    validationEvidence,
    warnings: buildFixtureImportWarnings(purposes)
  };
}

function parseFixtureEvidenceInput(evidenceObject, evidenceText) {
  if (evidenceObject && typeof evidenceObject === "object" && !Array.isArray(evidenceObject)) {
    return { ok: true, value: evidenceObject };
  }
  const text = String(evidenceText || "").trim();
  if (!text) {
    return { ok: false, detail: "Fixture evidence JSON is required." };
  }
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, detail: "Fixture evidence must be a JSON object." };
    }
    return { ok: true, value: parsed };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "Fixture evidence JSON could not be parsed."
    };
  }
}

function buildRejectedFixtureImport(status, detail, currentEvidence, importedAt, evidence = null) {
  return {
    schemaVersion: "spaceguard-fixture-evidence-import/v1",
    status,
    canApply: false,
    importedAt,
    generatedAt: evidence?.generatedAt || "",
    reviewer: "",
    artifactId: "",
    mappedCheckIds: [],
    counts: {
      records: Array.isArray(evidence?.records) ? evidence.records.length : 0,
      purposes: 0,
      mappedChecks: 0,
      missing: Number(evidence?.counts?.missing || 0),
      sizeMismatches: Number(evidence?.counts?.sizeMismatches || 0),
      ageMismatches: Number(evidence?.counts?.ageMismatches || 0)
    },
    purposes: [],
    detail,
    validationEvidence: currentEvidence || {},
    warnings: []
  };
}

function sanitizeFixtureCounts(counts = {}) {
  return {
    records: Number(counts.records || 0),
    missing: Number(counts.missing || 0),
    sizeMismatches: Number(counts.sizeMismatches || 0),
    ageMismatches: Number(counts.ageMismatches || 0)
  };
}

function buildFixtureImportWarnings(purposes) {
  const warnings = [];
  const knownPurposes = new Set(purposes);
  if (!knownPurposes.has("known-temp-fixture")) {
    warnings.push("Known-temp fixture purpose was not present.");
  }
  if (knownPurposes.has("protected-path-fixture")) {
    warnings.push("Protected-path fixture presence is not protected-path validation; verify exclusion separately.");
  }
  if (knownPurposes.has("review-data-fixture") || knownPurposes.has("downloads-installers") || knownPurposes.has("large-user-files")) {
    warnings.push("Review-data fixture presence is not rollback proof; keep rollback evidence separate.");
  }
  if (knownPurposes.has("developer-tooling-fixture")) {
    warnings.push("Developer fixture presence is not tool-native command proof; keep command evidence separate.");
  }
  return warnings;
}

export function buildWriteReadiness({
  releaseGate = null,
  runtimeCapabilities = {},
  executorPlan = null,
  rollbackPlan = null,
  rescanComparison = null,
  privilegeBoundary = null,
  privacyBoundary = null,
  consentReceipt = null,
  runReadiness = null
} = {}) {
  const rows = executorPlan?.rows || [];
  const realRouteRows = rows.filter((row) => row.canRealRun);
  const candidateRoutes = releaseGate?.candidateRoutes || rows.filter((row) => row.status === "dry-run-only" || row.canSimulate);
  const items = [
    {
      id: "real-route-implementation",
      label: "Real executor implementation",
      passed: Boolean(executorPlan?.realRunEnabled && realRouteRows.length > 0),
      detail: executorPlan?.realRunEnabled && realRouteRows.length > 0
        ? `${realRouteRows.length} route(s) expose real execution.`
        : "No selected route exposes real execution in this build."
    },
    {
      id: "runtime-write-capability",
      label: "Runtime write capability",
      passed: Boolean(runtimeCapabilities?.realRunEnabled && runtimeCapabilities?.destructiveCommands),
      detail: runtimeCapabilities?.realRunEnabled
        ? runtimeCapabilities?.destructiveCommands
          ? "Runtime reports real execution and destructive command capability."
          : "Runtime reports real execution without destructive command capability evidence."
        : "Runtime keeps real execution disabled."
    },
    {
      id: "release-gate",
      label: "Release gate passed",
      passed: Boolean(releaseGate?.readyForRealRun),
      detail: releaseGate?.readyForRealRun
        ? "Feature flag, native evidence, route selection, and validation checks pass."
        : releaseGate?.blockedReason || "Release gate has not been evaluated."
    },
    {
      id: "rescan-parity",
      label: "Rescan parity matched",
      passed: Boolean(rescanComparison?.status === "matched" && rescanComparison?.postRunScanEvidence && rescanComparison?.counts?.matched > 0),
      detail: rescanComparison?.status === "matched"
        ? `${rescanComparison.counts.matched} route(s) matched post-run native scan evidence.`
        : rescanComparison?.detail || "Run a post-ledger native rescan comparison."
    },
    {
      id: "rollback-proof",
      label: "Rollback proof clean",
      passed: Boolean(rollbackPlan?.status === "rebuildable-routes" && rollbackPlan?.counts?.needsProof === 0 && rollbackPlan?.counts?.blocked === 0),
      detail: rollbackPlan?.status === "rebuildable-routes"
        ? "Selected routes are rebuildable or disposable with rescan proof requirements."
        : rollbackPlan?.detail || "Rollback posture has not been evaluated."
    },
    {
      id: "privilege-boundary",
      label: "Privilege boundary ready",
      passed: Boolean(privilegeBoundary?.nativeAvailable && privilegeBoundary?.readyForAdminRoutes),
      detail: privilegeBoundary?.nativeAvailable
        ? privilegeBoundary?.readyForAdminRoutes
          ? "Native runtime captured privilege state and selected admin routes are allowed by boundary."
          : "Selected admin-sensitive routes need elevation or manual handling."
        : "Native runtime evidence is required before real execution."
    },
    {
      id: "privacy-boundary",
      label: "Privacy boundary local-only",
      passed: Boolean(privacyBoundary?.cloudDisabled && privacyBoundary?.telemetryDisabled && privacyBoundary?.exportOnly),
      detail: privacyBoundary?.cloudDisabled && privacyBoundary?.telemetryDisabled && privacyBoundary?.exportOnly
        ? "Reports and path evidence remain local unless the user exports them."
        : "Privacy boundary must prove local-only operation before real execution."
    },
    {
      id: "current-plan-consent",
      label: "Current plan consent",
      passed: Boolean(runReadiness?.ready && consentReceipt?.ready),
      detail: consentReceipt?.ready
        ? `Consent is tied to ${consentReceipt.planId || "the current plan"}.`
        : "Dry-run consent must be current before any real-execution review."
    }
  ];
  const blockedItems = items.filter((item) => !item.passed);
  const ready = blockedItems.length === 0;
  const status = ready
    ? "ready-for-real-execution"
    : !executorPlan?.realRunEnabled || !realRouteRows.length
      ? "implementation-locked"
      : releaseGate?.realFlagEnabled || runtimeCapabilities?.realRunEnabled
        ? "blocked-after-flag"
        : "policy-locked";

  return {
    schemaVersion: "spaceguard-write-readiness/v1",
    status,
    tone: ready ? "safe" : status === "implementation-locked" ? "restricted" : "review",
    readyForRealExecution: ready,
    realRunEnabled: Boolean(executorPlan?.realRunEnabled || runtimeCapabilities?.realRunEnabled),
    candidateRoutes,
    realRouteRows,
    items,
    blockedItems,
    counts: {
      total: items.length,
      passed: items.length - blockedItems.length,
      blocked: blockedItems.length,
      candidateRoutes: candidateRoutes.length,
      realRoutes: realRouteRows.length
    },
    primary: getWriteReadinessPrimary(status, blockedItems),
    steps: buildWriteReadinessSteps(status, blockedItems)
  };
}

export function buildPublicBetaReadiness({
  scanMode = "demo",
  nativeCapability = { available: false },
  runtimeCapabilities = {},
  releaseGate = null,
  privacyBoundary = null,
  validationEvidence = {},
  documentationEvidence = {}
} = {}) {
  const signingRecord = normalizeValidationEvidenceRecord("signing-and-smartscreen", validationEvidence["signing-and-smartscreen"]);
  const signingPassed = signingRecord.passed || releaseGate?.rows?.find((row) => row.id === "signing-and-smartscreen")?.passed;
  const destructiveLocked = !runtimeCapabilities?.realRunEnabled && !runtimeCapabilities?.destructiveCommands;
  const localOnlyPrivacy = Boolean(privacyBoundary?.cloudDisabled && privacyBoundary?.telemetryDisabled && privacyBoundary?.exportOnly);
  const nativeReadOnly = scanMode === "native-readonly" && Boolean(nativeCapability?.available || runtimeCapabilities?.scanKnownRoots);
  const rows = [
    {
      id: "web-demo-safe",
      lane: "web-demo",
      label: "Public web demo",
      passed: destructiveLocked,
      status: destructiveLocked ? "ready" : "blocked",
      detail: destructiveLocked
        ? "Browser demo can be public because it uses sample data and exposes no write capability."
        : "Write capability is visible, so public demo positioning must stop."
    },
    {
      id: "native-readonly-beta",
      lane: "native-beta",
      label: "Read-only native beta",
      passed: nativeReadOnly,
      status: nativeReadOnly ? "ready" : "waiting",
      detail: nativeReadOnly
        ? "Native read-only scanner evidence is available for this session."
        : "Run the desktop shell and capture native read-only scan evidence before claiming a native beta."
    },
    {
      id: "real-executor-claims",
      lane: "claims",
      label: "No real cleanup claim",
      passed: destructiveLocked && !releaseGate?.readyForRealRun,
      status: destructiveLocked && !releaseGate?.readyForRealRun ? "ready" : "blocked",
      detail: "Public copy must describe the current build as demo or read-only scanner until write-capable executors are separately validated."
    },
    {
      id: "privacy-local-first",
      lane: "privacy",
      label: "Local-first privacy",
      passed: localOnlyPrivacy,
      status: localOnlyPrivacy ? "ready" : "waiting",
      detail: localOnlyPrivacy
        ? "Reports, paths, and audit records remain local unless the user exports them."
        : "Privacy boundary needs local-only export and telemetry/cloud controls."
    },
    {
      id: "public-release-runbook",
      lane: "docs",
      label: "Public release runbook",
      passed: Boolean(documentationEvidence.publicReleaseResearch && documentationEvidence.windowsRealDataSetup),
      status: documentationEvidence.publicReleaseResearch && documentationEvidence.windowsRealDataSetup ? "ready" : "waiting",
      detail: "Public release notes and Windows real-data setup must exist before beta distribution."
    },
    {
      id: "signing-support-uninstall",
      lane: "distribution",
      label: "Signing and support",
      passed: Boolean(signingPassed),
      status: signingPassed ? "ready" : "waiting",
      detail: signingPassed
        ? "Signing, install/uninstall, privacy, and support evidence is recorded."
        : "Record signing, SmartScreen/distribution, install/uninstall, privacy, and support evidence before native beta."
    }
  ];
  const webDemoReady = rows.find((row) => row.id === "web-demo-safe")?.passed && rows.find((row) => row.id === "real-executor-claims")?.passed && localOnlyPrivacy;
  const nativeBetaRows = rows.filter((row) => row.id !== "web-demo-safe");
  const nativeBetaReady = nativeBetaRows.every((row) => row.passed);
  const waitingRows = rows.filter((row) => !row.passed);
  const status = nativeBetaReady ? "native-beta-ready" : webDemoReady ? "web-demo-ready" : "blocked";

  return {
    schemaVersion: "spaceguard-public-beta-readiness/v1",
    status,
    tone: nativeBetaReady ? "safe" : webDemoReady ? "review" : "restricted",
    readyForWebDemo: Boolean(webDemoReady),
    readyForNativeBeta: Boolean(nativeBetaReady),
    realRunEnabled: Boolean(runtimeCapabilities?.realRunEnabled || releaseGate?.readyForRealRun),
    rows,
    waitingRows,
    counts: {
      total: rows.length,
      ready: rows.filter((row) => row.passed).length,
      waiting: waitingRows.length,
      docs: rows.filter((row) => row.lane === "docs" && row.passed).length,
      distribution: rows.filter((row) => row.lane === "distribution" && row.passed).length
    },
    primary: nativeBetaReady
      ? "Native read-only beta evidence is complete."
      : webDemoReady
        ? "The web demo is publishable; native beta still needs distribution evidence."
        : "Public release is blocked until privacy and claim boundaries are safe.",
    steps: buildPublicBetaSteps(status, waitingRows)
  };
}

export function buildSupportBundle({
  profile: supportProfile = null,
  scanMode = "demo",
  scanSettings = null,
  nativeScan = null,
  scanCoverage = null,
  privacyBoundary = null,
  publicBetaReadiness = null,
  releaseGate = null,
  runtimeCapabilities = {},
  executorPlan = null,
  rollbackPlan = null,
  ledgerHistorySummary = null,
  generatedAt = "set-on-export"
} = {}) {
  const findings = nativeScan?.findings || [];
  const selectedRoutes = executorPlan?.rows || [];
  const redactedFindings = findings.map((finding) => ({
    recipeId: finding.recipeId || "",
    title: finding.title || "",
    status: finding.status || "unknown",
    bytes: Number(finding.bytes || 0),
    files: Number(finding.files || 0),
    dirs: Number(finding.dirs || 0),
    errors: Number(finding.errors || 0),
    itemCount: finding.items?.length || 0,
    note: finding.note || ""
  }));
  const warningCount = (nativeScan?.warnings?.length || 0) + (privacyBoundary?.warnings?.length || 0);

  return {
    schemaVersion: "spaceguard-support-bundle/v1",
    product: "SpaceGuard",
    generatedAt,
    redactedPaths: true,
    summary: {
      status: publicBetaReadiness?.status || "unknown",
      scanMode,
      readyForWebDemo: Boolean(publicBetaReadiness?.readyForWebDemo),
      readyForNativeBeta: Boolean(publicBetaReadiness?.readyForNativeBeta),
      realRunEnabled: Boolean(runtimeCapabilities?.realRunEnabled || releaseGate?.readyForRealRun),
      warningCount
    },
    environment: {
      drive: supportProfile?.drive || "",
      totalBytes: Number(supportProfile?.totalBytes || 0),
      usedBytes: Number(supportProfile?.usedBytes || 0),
      freeBytes: Number(supportProfile?.freeBytes || 0),
      platform: runtimeCapabilities?.platform || nativeScan?.platform || "unknown",
      windows: Boolean(runtimeCapabilities?.windows || nativeScan?.windows),
      elevated: Boolean(runtimeCapabilities?.elevated),
      elevationSource: runtimeCapabilities?.elevationSource || ""
    },
    scan: {
      settings: scanSettings
        ? {
            includeProjectArtifacts: Boolean(scanSettings.includeProjectArtifacts),
            maxDepth: Number(scanSettings.maxDepth || 0),
            maxEntriesPerRoot: Number(scanSettings.maxEntriesPerRoot || 0)
          }
        : null,
      nativeAvailable: Boolean(nativeScan?.available),
      volumeSource: nativeScan?.volume?.source || "",
      totalMeasuredBytes: Number(nativeScan?.totalBytes || 0),
      findingCount: findings.length,
      measuredCount: findings.filter((finding) => finding.status === "measured" || finding.status === "limited").length,
      coverageStatus: scanCoverage?.status || "not-evaluated",
      coverageConfidence: scanCoverage?.confidenceScore || 0,
      findings: redactedFindings
    },
    safety: {
      cloudDisabled: Boolean(privacyBoundary?.cloudDisabled),
      telemetryDisabled: Boolean(privacyBoundary?.telemetryDisabled),
      exportOnly: Boolean(privacyBoundary?.exportOnly),
      destructiveCommands: Boolean(runtimeCapabilities?.destructiveCommands || nativeScan?.destructiveCommands),
      writeCapability: Boolean(nativeScan?.writeCapability),
      blockedCollections: privacyBoundary?.blockedCollections || []
    },
    release: {
      publicBetaStatus: publicBetaReadiness?.status || "unknown",
      publicBetaWaiting: publicBetaReadiness?.waitingRows?.map((row) => row.id) || [],
      realReleaseReady: Boolean(releaseGate?.readyForRealRun),
      releaseBlockedReason: releaseGate?.blockedReason || "",
      validationPassed: releaseGate?.passedCount || 0,
      validationTotal: releaseGate?.totalCount || 0
    },
    routes: {
      selectedCount: selectedRoutes.length,
      dryRunCount: executorPlan?.dryRunCount || 0,
      blockedCount: executorPlan?.blockedCount || 0,
      realRunEnabled: Boolean(executorPlan?.realRunEnabled),
      selectedRoutes: selectedRoutes.map((row) => ({
        id: row.id,
        title: row.title,
        route: row.route,
        lane: row.lane,
        status: row.status,
        bytes: Number(row.bytes || 0),
        canSimulate: Boolean(row.canSimulate),
        canRealRun: Boolean(row.canRealRun)
      })),
      rollbackStatus: rollbackPlan?.status || "not-evaluated",
      rollbackWaiting: rollbackPlan?.rows?.filter((row) => row.status !== "rebuildable-rescan").map((row) => row.id) || []
    },
    history: {
      records: ledgerHistorySummary?.counts?.records || 0,
      currentPlanRecords: ledgerHistorySummary?.counts?.current || 0,
      staleRecords: ledgerHistorySummary?.counts?.stale || 0
    },
    warnings: [
      ...(nativeScan?.warnings || []).map((warning) => `native: ${warning}`),
      ...(privacyBoundary?.warnings || []).map((warning) => `privacy: ${warning}`)
    ],
    supportNotes: [
      "This bundle intentionally excludes local paths and filenames.",
      "Ask the user for the full dry-run report only when path-level diagnosis is required.",
      "This bundle does not enable real cleanup."
    ]
  };
}

export function buildSupportBundleMarkdown(bundle) {
  const findings = bundle.scan.findings.length
    ? bundle.scan.findings
        .slice(0, 12)
        .map((finding) => `- ${finding.title}: ${finding.status}, ${formatBytes(finding.bytes)}, items=${finding.itemCount}, errors=${finding.errors}`)
        .join("\n")
    : "- No native findings.";
  const routes = bundle.routes.selectedRoutes.length
    ? bundle.routes.selectedRoutes.map((route) => `- ${route.title}: ${route.status} via ${route.route}, ${formatBytes(route.bytes)}`).join("\n")
    : "- No selected routes.";
  const waiting = bundle.release.publicBetaWaiting.length ? bundle.release.publicBetaWaiting.map((id) => `- ${id}`).join("\n") : "- None";
  const warnings = bundle.warnings.length ? bundle.warnings.map((warning) => `- ${warning}`).join("\n") : "- None";

  return [
    "# SpaceGuard Support Bundle",
    "",
    `Generated: ${bundle.generatedAt}`,
    `Schema: ${bundle.schemaVersion}`,
    `Redacted paths: ${bundle.redactedPaths ? "yes" : "no"}`,
    `Scan mode: ${bundle.summary.scanMode}`,
    `Public beta status: ${bundle.summary.status}`,
    `Real run enabled: ${bundle.summary.realRunEnabled ? "yes" : "no"}`,
    "",
    "## Environment",
    `Drive: ${bundle.environment.drive || "unknown"}`,
    `Platform: ${bundle.environment.platform}`,
    `Elevated: ${bundle.environment.elevated ? "yes" : "no"}`,
    `Free space: ${formatBytes(bundle.environment.freeBytes)}`,
    "",
    "## Scan",
    `Coverage: ${bundle.scan.coverageStatus} (${bundle.scan.coverageConfidence}%)`,
    `Measured bytes: ${formatBytes(bundle.scan.totalMeasuredBytes)}`,
    `Findings: ${bundle.scan.findingCount}`,
    findings,
    "",
    "## Selected Routes",
    routes,
    "",
    "## Public Beta Waiting",
    waiting,
    "",
    "## Warnings",
    warnings,
    "",
    "## Notes",
    bundle.supportNotes.map((note) => `- ${note}`).join("\n")
  ].join("\n");
}

export function buildValidationEvidencePack({
  releaseGate = null,
  executorPlan = null,
  executorManifest = null,
  scanMode = "demo",
  runtimeCapabilities = null,
  nativeScan = null,
  generatedAt = "set-on-export"
} = {}) {
  const gate = releaseGate || buildReleaseGate({ scanMode, executorPlan });
  const runtime = runtimeCapabilities || {};
  const executorRows = executorPlan?.rows || [];
  const manifest = executorManifest || buildExecutorManifest({ executorPlan, releaseGate: gate });
  const checkRows = gate.rows || windowsValidationChecks.map((check) => ({ ...check, status: "missing-evidence", passed: false }));
  const vmRows = gate.vmRows || disposableVmScenarios.map((scenario) => ({ ...scenario, passedCount: 0, totalCount: scenario.mustPass.length, status: "missing-evidence" }));

  return {
    schemaVersion: "spaceguard-validation-pack/v1",
    product: "SpaceGuard",
    generatedAt,
    scanMode,
    readyForRealRun: Boolean(gate.readyForRealRun),
    blockedReason: gate.blockedReason || "Real execution remains locked until every check is proven.",
    safetyInvariants: [
      {
        id: "real-run-gated",
        label: "Real execution gated",
        passed: !runtime.realRunEnabled || gate.readyForRealRun,
        detail: "The build must stay dry-run only until the release gate is explicitly opened."
      },
      {
        id: "no-destructive-commands",
        label: "No destructive native commands",
        passed: !runtime.destructiveCommands,
        detail: "Native capabilities must report destructive commands disabled before validation starts."
      },
      {
        id: "native-evidence-required",
        label: "Native Windows evidence required",
        passed: gate.nativeReady,
        detail: "Real data validation must come from the Windows desktop shell, not browser demo data."
      },
      {
        id: "no-self-elevation",
        label: "No self elevation",
        passed: true,
        detail: "The app may report elevation state but must not start UAC prompts or self-elevate."
      }
    ],
    runtime: {
      mode: runtime.mode || "unknown",
      platform: runtime.platform || "unknown",
      nativeAvailable: Boolean(runtime.available),
      windows: Boolean(runtime.windows),
      elevated: Boolean(runtime.elevated),
      elevationSource: runtime.elevationSource || "",
      realRunEnabled: Boolean(runtime.realRunEnabled),
      destructiveCommands: Boolean(runtime.destructiveCommands),
      scanKnownRoots: Boolean(runtime.scanKnownRoots),
      simulateCleanupPlan: Boolean(runtime.simulateCleanupPlan),
      safeExecutorsEnabled: Boolean(runtime.safeExecutorsEnabled),
      reason: runtime.reason || ""
    },
    nativeScan: nativeScan
      ? {
          platform: nativeScan.platform || "unknown",
          windows: Boolean(nativeScan.windows),
          volume: nativeScan.volume
            ? {
                drive: nativeScan.volume.drive || "",
                totalBytes: Number(nativeScan.volume.totalBytes || 0),
                usedBytes: Number(nativeScan.volume.usedBytes || 0),
                freeBytes: Number(nativeScan.volume.freeBytes || 0),
                source: nativeScan.volume.source || ""
              }
            : null,
          totalBytes: Number(nativeScan.totalBytes || 0),
          findingCount: nativeScan.findings?.length || 0,
          measuredCount: nativeScan.findings?.filter((finding) => finding.status === "measured" || finding.status === "limited").length || 0,
          warnings: nativeScan.warnings || [],
          writeCapability: Boolean(nativeScan.writeCapability),
          destructiveCommands: Boolean(nativeScan.destructiveCommands)
        }
      : {
          platform: "not-run",
          windows: false,
          volume: null,
          totalBytes: 0,
          findingCount: 0,
          measuredCount: 0,
          warnings: ["Native read-only scan has not been captured for this pack."],
          writeCapability: false,
          destructiveCommands: false
        },
    featureFlags: Object.entries(gate.flags || releaseFeatureFlags).map(([id, enabled]) => ({
      id,
      enabled: Boolean(enabled),
      requiredState: id === "realExecutors" ? "enabled only after all evidence passes" : "enabled only for validated executor lanes"
    })),
    validationChecks: checkRows.map((row) => ({
      id: row.id,
      label: row.label,
      lane: row.lane,
      requiredFor: row.requiredFor,
      status: row.status || (row.passed ? "passed" : "missing-evidence"),
      passed: Boolean(row.passed),
      evidenceValue: row.evidenceValue || "",
      requiredEvidence: row.evidence,
      result: row.passed ? "passed" : row.evidenceRecord?.qualityStatus || "not-run",
      evidencePath: row.evidenceRecord?.evidencePath || "",
      notes: row.evidenceRecord?.notes || "",
      reviewer: row.evidenceRecord?.reviewer || "",
      recordedAt: row.evidenceRecord?.recordedAt || "",
      updatedAt: row.evidenceRecord?.updatedAt || "",
      evidenceComplete: Boolean(row.evidenceRecord?.complete),
      evidenceLegacy: Boolean(row.evidenceRecord?.legacy),
      evidenceDetail: row.evidenceRecord?.detail || ""
    })),
    vmScenarios: vmRows.map((row) => ({
      id: row.id,
      label: row.label,
      coverage: row.coverage,
      status: row.status,
      passedCount: row.passedCount,
      totalCount: row.totalCount,
      mustPass: row.mustPass,
      checklist: buildVmChecklist(row, checkRows),
      result: row.status === "passed" ? "passed" : "not-run",
      evidencePath: "",
      notes: ""
    })),
    fixtureRoots: windowsValidationFixtures.map((fixture) => ({
      ...fixture,
      result: "not-run",
      evidencePath: "",
      notes: ""
    })),
    commands: windowsValidationCommands.map((command) => ({
      ...command,
      result: "not-run",
      evidencePath: "",
      notes: ""
    })),
    executorRoutes: executorRows.map((row) => ({
      id: row.id,
      title: row.title,
      lane: row.lane,
      route: row.route,
      status: row.status,
      canSimulate: Boolean(row.canSimulate),
      canRealRun: Boolean(row.canRealRun),
      bytes: row.bytes,
      guardrails: row.guardrails || [],
      verification: row.verification,
      blockedReason: row.realBlockedReason || row.blockers?.join(", ") || ""
    })),
    executorManifest: {
      schemaVersion: manifest.schemaVersion,
      counts: manifest.counts,
      nextSteps: manifest.nextSteps,
      routes: manifest.routes.map((route) => ({
        route: route.route,
        title: route.title,
        lane: route.lane,
        phase: route.phase,
        status: route.status,
        actionIds: route.actionIds,
        selectedCount: route.selectedCount,
        dryRunSupported: route.dryRunSupported,
        realRunEnabled: route.realRunEnabled,
        missingCheckIds: route.missingCheckIds,
        fixtureIds: route.fixtureIds,
        preconditions: route.preconditions,
        implementation: route.implementation,
        rollback: route.rollback,
        proof: route.proof,
        guardrails: route.guardrails
      }))
    },
    missingCheckIds: (gate.missingRows || []).map((row) => row.id),
    signoff: {
      operator: "",
      reviewer: "",
      decision: gate.readyForRealRun ? "ready-for-real-run-review" : "blocked",
      notes: gate.blockedReason || ""
    }
  };
}

export function buildValidationPackMarkdown(pack) {
  const invariants = pack.safetyInvariants
    .map((item) => `- ${item.passed ? "PASS" : "WAIT"} ${item.label}: ${item.detail}`)
    .join("\n");
  const checks = pack.validationChecks
    .map((check) => {
      const detail = check.evidenceComplete
        ? `evidence=${check.evidencePath}; reviewer=${check.reviewer}; recorded=${check.recordedAt || "unknown"}`
        : check.evidenceDetail || "evidence details missing";
      return `- [${check.passed ? "x" : " "}] ${check.label} (${check.lane}) - ${check.requiredEvidence} | ${detail}`;
    })
    .join("\n");
  const vms = pack.vmScenarios
    .map((scenario) => `- ${scenario.label}: ${scenario.passedCount}/${scenario.totalCount} checks, ${scenario.status}`)
    .join("\n");
  const fixtures = pack.fixtureRoots
    .map((fixture) => `- ${fixture.label}: ${fixture.setup}`)
    .join("\n");
  const commands = pack.commands
    .map((command) => `- ${command.command} - ${command.expected}`)
    .join("\n");
  const routes = pack.executorRoutes.length
    ? pack.executorRoutes.map((route) => `- ${route.title}: ${route.status} via ${route.route}`).join("\n")
    : "- No selected executor routes.";
  const volume = pack.nativeScan?.volume
    ? `${pack.nativeScan.volume.drive}: ${formatBytes(pack.nativeScan.volume.freeBytes)} free of ${formatBytes(pack.nativeScan.volume.totalBytes)} (${pack.nativeScan.volume.source})`
    : "not available";
  const manifestRoutes = pack.executorManifest?.routes?.length
    ? pack.executorManifest.routes
        .map((route) => `- ${route.title}: ${route.status} | ${route.phase} | missing=${route.missingCheckIds.length}`)
        .join("\n")
    : "- No executor manifest routes.";
  const manifestSteps = pack.executorManifest?.nextSteps?.length
    ? pack.executorManifest.nextSteps.map((step) => `- ${step}`).join("\n")
    : "- Select a plan before executor sequencing.";

  return [
    "# SpaceGuard Validation Evidence Pack",
    "",
    `Generated: ${pack.generatedAt}`,
    `Scan mode: ${pack.scanMode}`,
    `Volume evidence: ${volume}`,
    `Ready for real run: ${pack.readyForRealRun ? "yes" : "no"}`,
    `Blocked reason: ${pack.blockedReason || "None"}`,
    "",
    "## Safety Invariants",
    invariants,
    "",
    "## Required Checks",
    checks,
    "",
    "## Disposable VM Matrix",
    vms,
    "",
    "## Fixture Roots",
    fixtures,
    "",
    "## Validation Commands",
    commands,
    "",
    "## Executor Routes Under Review",
    routes,
    "",
    "## Executor Manifest",
    manifestRoutes,
    "",
    "## Manifest Next Steps",
    manifestSteps,
    "",
    "## Signoff",
    `Decision: ${pack.signoff.decision}`,
    "Operator:",
    "Reviewer:",
    "Notes:"
  ].join("\n");
}

export function buildVerificationSummary({
  planSnapshot = null,
  ledger = [],
  executorPlan = null,
  scanMode = "demo",
  nativeScan = null
} = {}) {
  const expectedBytes = executorPlan?.dryRunBytes ?? planSnapshot?.selectedBytes ?? 0;
  const reclaimedBytes = ledger.reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
  const currentLedger = planSnapshot?.id ? ledger.filter((entry) => entry.planId === planSnapshot.id) : ledger;
  const staleLedger = planSnapshot?.id ? ledger.filter((entry) => entry.planId !== planSnapshot.id) : [];
  const deltaBytes = Math.abs(expectedBytes - reclaimedBytes);

  if (ledger.length === 0) {
    return {
      status: "not-run",
      tone: "review",
      current: false,
      planId: planSnapshot?.id || "",
      expectedBytes,
      reclaimedBytes: 0,
      deltaBytes: expectedBytes,
      nativeEvidence: scanMode === "native-readonly" && Boolean(nativeScan),
      detail: "No ledger exists for the current plan.",
      steps: ["Run simulation.", "Review skipped actions.", "Export report before changing the plan."]
    };
  }

  if (staleLedger.length > 0 || currentLedger.length === 0) {
    return {
      status: "stale-ledger",
      tone: "advanced",
      current: false,
      planId: planSnapshot?.id || "",
      expectedBytes,
      reclaimedBytes,
      deltaBytes: expectedBytes,
      nativeEvidence: scanMode === "native-readonly" && Boolean(nativeScan),
      detail: "The visible ledger belongs to an older plan. Simulate again before trusting the numbers.",
      steps: ["Run simulation for the current plan.", "Discard or export the stale report for audit only.", "Do not compare old ledger bytes to new selections."]
    };
  }

  if (deltaBytes > MB) {
    return {
      status: "needs-rescan",
      tone: "review",
      current: true,
      planId: planSnapshot?.id || "",
      expectedBytes,
      reclaimedBytes,
      deltaBytes,
      nativeEvidence: scanMode === "native-readonly" && Boolean(nativeScan),
      detail: `${formatBytes(deltaBytes)} differs between expected dry-run bytes and the ledger.`,
      steps: ["Rescan affected roots.", "Check skipped actions.", "Export the mismatch before another run."]
    };
  }

  return {
    status: "ledger-current",
    tone: "safe",
    current: true,
    planId: planSnapshot?.id || "",
    expectedBytes,
    reclaimedBytes,
    deltaBytes,
    nativeEvidence: scanMode === "native-readonly" && Boolean(nativeScan),
    detail: "The ledger matches the current plan snapshot within tolerance.",
    steps: ["Export the report.", "Use native rescan evidence before enabling real execution.", "Change the plan before any second run."]
  };
}

export function buildPostRunVerificationPlan({
  planSnapshot = null,
  ledger = [],
  executorPlan = null,
  scanMode = "demo",
  nativeScan = null
} = {}) {
  const planId = planSnapshot?.id || "";
  const currentEntries = planId ? ledger.filter((entry) => entry.planId === planId) : ledger;
  const staleEntries = planId ? ledger.filter((entry) => entry.planId !== planId) : [];
  const rows = executorPlan?.rows || [];
  const nativeEvidence = scanMode === "native-readonly" && Boolean(nativeScan);
  const checkpoints = currentEntries.map((entry) => {
    const row = rows.find((item) => item.id === entry.id) || {};
    const skipped = entry.result === "skipped" || Number(entry.bytes || 0) === 0;
    return {
      id: entry.id,
      title: entry.title,
      planId: entry.planId || planId,
      route: row.route || "unknown",
      lane: row.lane || "unknown",
      path: row.path || "unknown affected root",
      baselineBytes: Number(row.visibleBytes ?? row.bytes ?? entry.bytes ?? 0),
      expectedBytes: Number(entry.bytes || 0),
      ledgerResult: entry.result,
      method: entry.method || row.method || "",
      verification: row.verification || "Rescan affected root and compare with ledger.",
      consequence: row.consequence || "",
      status: skipped
        ? "skipped"
        : nativeEvidence
          ? "ready-for-comparison"
          : "needs-native-rescan",
      evidenceRequired: skipped
        ? "Confirm skipped action remains visible in the ledger."
        : row.verification || "Capture a read-only rescan of the affected root."
    };
  });

  if (ledger.length === 0) {
    return {
      schemaVersion: "spaceguard-post-run-verification/v1",
      status: "not-run",
      tone: "review",
      planId,
      current: false,
      nativeEvidence,
      checkpoints: [],
      skippedCount: 0,
      expectedBytes: 0,
      detail: "No ledger exists yet, so there is no post-run verification checklist.",
      steps: ["Run simulation first.", "Save the run record.", "Use native read-only rescan evidence for Windows validation."]
    };
  }

  if (staleEntries.length > 0 || currentEntries.length === 0) {
    return {
      schemaVersion: "spaceguard-post-run-verification/v1",
      status: "stale-ledger",
      tone: "advanced",
      planId,
      current: false,
      nativeEvidence,
      checkpoints: [],
      skippedCount: 0,
      expectedBytes: 0,
      detail: "The available ledger does not match the current plan snapshot.",
      steps: ["Simulate the current plan.", "Keep stale history as audit evidence only.", "Do not use stale entries for rescan parity."]
    };
  }

  const skippedCount = checkpoints.filter((checkpoint) => checkpoint.status === "skipped").length;
  const expectedBytes = checkpoints.reduce((sum, checkpoint) => sum + checkpoint.expectedBytes, 0);
  const status = nativeEvidence ? "ready-for-comparison" : "needs-native-rescan";

  return {
    schemaVersion: "spaceguard-post-run-verification/v1",
    status,
    tone: nativeEvidence ? "safe" : "review",
    planId,
    current: true,
    nativeEvidence,
    checkpoints,
    skippedCount,
    expectedBytes,
    detail: nativeEvidence
      ? `${checkpoints.length} checkpoint(s) can be compared against the current native scan evidence.`
      : `${checkpoints.length} checkpoint(s) need native read-only rescan evidence before validation.`,
    steps: nativeEvidence
      ? ["Compare each affected root with the ledger.", "Record skipped files and byte deltas.", "Export the verification checklist with the dry-run report."]
      : ["Run the Windows desktop read-only scan after execution.", "Compare affected roots with the ledger.", "Keep real execution locked until rescan parity is proven."]
  };
}

export function buildRescanComparison({
  postRunVerification = null,
  nativeScan = null,
  scanMode = "demo",
  ledger = [],
  planSnapshot = null,
  toleranceBytes = 64 * MB
} = {}) {
  const checkpoints = postRunVerification?.checkpoints || [];
  const planId = postRunVerification?.planId || planSnapshot?.id || "";
  const currentEntries = planId ? ledger.filter((entry) => entry.planId === planId) : ledger;
  const staleEntries = planId ? ledger.filter((entry) => entry.planId !== planId) : [];
  const nativeEvidence = scanMode === "native-readonly" && Boolean(nativeScan?.available !== false && nativeScan);
  const latestExecutionAt = latestComparableTimestamp(currentEntries.map((entry) => entry.executedAt));
  const scanGeneratedAt = nativeScan?.generatedAt || "";
  const postRunScanEvidence = Boolean(nativeEvidence && latestExecutionAt && isTimestampAtOrAfter(scanGeneratedAt, latestExecutionAt));
  const rows = checkpoints.map((checkpoint) =>
    buildRescanComparisonRow({
      checkpoint,
      nativeScan,
      nativeEvidence,
      postRunScanEvidence,
      latestExecutionAt,
      scanGeneratedAt,
      toleranceBytes
    })
  );
  const counts = {
    rows: rows.length,
    matched: rows.filter((row) => row.state === "matched").length,
    mismatch: rows.filter((row) => row.state === "mismatch").length,
    skipped: rows.filter((row) => row.state === "skipped").length,
    noFinding: rows.filter((row) => row.state === "no-finding").length,
    waiting: rows.filter((row) => row.state === "needs-post-run-native-rescan" || row.state === "needs-native-rescan").length
  };

  if (!checkpoints.length || !ledger.length) {
    return {
      schemaVersion: "spaceguard-rescan-comparison/v1",
      status: "not-run",
      tone: "review",
      planId,
      current: false,
      nativeEvidence,
      postRunScanEvidence: false,
      latestExecutionAt,
      scanGeneratedAt,
      toleranceBytes,
      rows: [],
      counts,
      expectedBytes: 0,
      actualRemainingBytes: 0,
      detail: "No current ledger checkpoints exist yet, so rescan parity cannot be evaluated.",
      steps: ["Run dry-run simulation.", "Run a native read-only scan after the ledger is created.", "Compare affected roots before any real executor work."]
    };
  }

  if (postRunVerification?.status === "stale-ledger" || staleEntries.length > 0 || !postRunVerification?.current) {
    return {
      schemaVersion: "spaceguard-rescan-comparison/v1",
      status: "stale-ledger",
      tone: "advanced",
      planId,
      current: false,
      nativeEvidence,
      postRunScanEvidence: false,
      latestExecutionAt,
      scanGeneratedAt,
      toleranceBytes,
      rows: [],
      counts: { ...counts, rows: 0, matched: 0, mismatch: 0, skipped: 0, noFinding: 0, waiting: 0 },
      expectedBytes: 0,
      actualRemainingBytes: 0,
      detail: "The ledger is not current for this plan, so native scan data cannot prove parity.",
      steps: ["Simulate the current plan.", "Run a fresh native read-only scan after that ledger.", "Ignore stale run history for parity decisions."]
    };
  }

  const expectedBytes = rows.reduce((sum, row) => sum + row.expectedBytes, 0);
  const actualRemainingBytes = rows.reduce((sum, row) => sum + row.actualBytes, 0);
  const status = getRescanComparisonStatus({ rows, nativeEvidence, postRunScanEvidence });

  return {
    schemaVersion: "spaceguard-rescan-comparison/v1",
    status,
    tone: getRescanComparisonTone(status),
    planId,
    current: true,
    nativeEvidence,
    postRunScanEvidence,
    latestExecutionAt,
    scanGeneratedAt,
    toleranceBytes,
    rows,
    counts,
    expectedBytes,
    actualRemainingBytes,
    detail: getRescanComparisonDetail(status, counts),
    steps: getRescanComparisonSteps(status)
  };
}

export function buildRescanComparisonMarkdown(comparison) {
  const rows = comparison?.rows?.length
    ? comparison.rows
        .map((row) => [
          `- ${row.title}: ${row.state}`,
          `  - Expected removal: ${formatBytes(row.expectedBytes)}`,
          `  - Expected remaining: ${formatBytes(row.expectedRemainingBytes)}`,
          `  - Native remaining: ${formatBytes(row.actualBytes)}`,
          `  - Delta: ${formatBytes(row.deltaBytes)}`,
          `  - Evidence: ${row.evidence}`
        ].join("\n"))
        .join("\n")
    : "- No comparison rows.";
  const steps = comparison?.steps?.length ? comparison.steps.map((step) => `- ${step}`).join("\n") : "- No steps.";

  return [
    "# SpaceGuard Rescan Comparison",
    "",
    `Plan: ${comparison?.planId || "none"}`,
    `Status: ${comparison?.status || "not-run"}`,
    `Native evidence: ${comparison?.nativeEvidence ? "yes" : "no"}`,
    `Post-run scan evidence: ${comparison?.postRunScanEvidence ? "yes" : "no"}`,
    `Ledger timestamp: ${comparison?.latestExecutionAt || "missing"}`,
    `Scan timestamp: ${comparison?.scanGeneratedAt || "missing"}`,
    "",
    "## Steps",
    steps,
    "",
    "## Rows",
    rows,
    "",
    "This comparison is proof-gathering only. It does not enable real cleanup."
  ].join("\n");
}

export function buildPostRunVerificationMarkdown(plan) {
  const checkpoints = plan?.checkpoints?.length
    ? plan.checkpoints
        .map((checkpoint) => [
          `- ${checkpoint.title}: ${checkpoint.status}`,
          `  - Route: ${checkpoint.route}`,
          `  - Root: ${checkpoint.path}`,
          `  - Expected: ${formatBytes(checkpoint.expectedBytes)}`,
          `  - Evidence: ${checkpoint.evidenceRequired}`
        ].join("\n"))
        .join("\n")
    : "- No checkpoints.";
  const steps = plan?.steps?.length ? plan.steps.map((step) => `- ${step}`).join("\n") : "- No verification steps.";

  return [
    "# SpaceGuard Post-Run Verification Checklist",
    "",
    `Plan: ${plan?.planId || "none"}`,
    `Status: ${plan?.status || "not-run"}`,
    `Native evidence: ${plan?.nativeEvidence ? "yes" : "no"}`,
    `Expected recovery: ${formatBytes(plan?.expectedBytes || 0)}`,
    "",
    "## Steps",
    steps,
    "",
    "## Checkpoints",
    checkpoints,
    "",
    "This checklist is verification evidence only. It does not enable real cleanup."
  ].join("\n");
}

export function buildExecutionPreflight({
  scanned = false,
  scanning = false,
  selectedIds = new Set(),
  actionList = actions,
  readiness,
  protectedPaths = [],
  ledger = [],
  planSnapshot = null
} = {}) {
  const selected = actionList.filter((action) => selectedIds.has(action.id));
  const selectedProtected = selected.filter((action) => isActionProtected(action, protectedPaths));
  const unresolvedCount = readiness?.unresolved?.length ?? 0;
  const currentLedgerCount = planSnapshot?.id ? ledger.filter((entry) => entry.planId === planSnapshot.id).length : ledger.length;
  const staleLedgerCount = planSnapshot?.id ? ledger.filter((entry) => entry.planId !== planSnapshot.id).length : 0;
  const items = [
    {
      id: "scan-complete",
      label: "Scan complete",
      detail: scanned ? "Current profile has been scanned." : "Run a scan before simulation.",
      passed: scanned
    },
    {
      id: "scan-idle",
      label: "Scanner idle",
      detail: scanning ? "Wait for the current scan to finish." : "No scan is currently running.",
      passed: !scanning
    },
    {
      id: "selection",
      label: "Actions selected",
      detail: selected.length > 0 ? `${selected.length} action(s) selected.` : "Select at least one executable action.",
      passed: selected.length > 0
    },
    {
      id: "gates",
      label: "Approval gates resolved",
      detail: unresolvedCount === 0 ? "No selected action is waiting on approval." : `${unresolvedCount} selected action(s) still need approval.`,
      passed: unresolvedCount === 0
    },
    {
      id: "protected",
      label: "No selected protected paths",
      detail: selectedProtected.length === 0 ? "No selected action matches a protected path." : `${selectedProtected.length} selected action(s) match protected paths.`,
      passed: selectedProtected.length === 0
    },
    {
      id: "ledger-clear",
      label: "Current ledger clear",
      detail: currentLedgerCount === 0
        ? staleLedgerCount > 0
          ? "Only stale ledger entries exist; current plan can be simulated."
          : "No simulation has been run for this plan."
        : "Change the plan or rescan before running again.",
      passed: currentLedgerCount === 0
    }
  ];

  return {
    ready: items.every((item) => item.passed),
    items,
    selectedCount: selected.length,
    selectedProtectedCount: selectedProtected.length
  };
}

export function isActionProtected(action, protectedPaths = []) {
  protectedPaths = Array.isArray(protectedPaths) ? protectedPaths : [];
  const actionPath = normalizeMatchText(action.path);
  return protectedPaths.some((path) => {
    const protectedPath = normalizeMatchText(path);
    if (!protectedPath) return false;
    return actionPath.includes(protectedPath) || protectedPath.includes(actionPath) || pathTailMatch(actionPath, protectedPath);
  });
}

export function buildReport({
  scenario,
  profile: reportProfile,
  actionList,
  selectedIds,
  readiness,
  ledger,
  protectedPaths,
  goalBytes,
  scanMode = "demo",
  scanSettings = null,
  nativeScan = null,
  advisor = null,
  decisionLog = [],
  agentQuestionQueue = null,
  itemReview = null,
  executorPlan = null,
  releaseGate = null,
  validationPack = null,
  runtimeCapabilities = null,
  itemReviewsByAction = null,
  planSnapshot = null,
  verificationSummary = null,
  postRunVerification = null,
  rescanComparison = null,
  runReadiness = null,
  consentReceipt = null,
  privilegeBoundary = null,
  privacyBoundary = null,
  rollbackPlan = null,
  publicBetaReadiness = null,
  executorManifest = null,
  toolCommandInventory = null,
  writeReadiness = null,
  realExecutorCapsule = null,
  writeBoundaryProbe = null,
  ledgerHistorySummary = null,
  storageStrategy = null,
  manualStrategyChecklist = null,
  scanCoverage = null,
  intakePolicy = null,
  taskPowerCatalog = null
}) {
  const reviewsByAction = itemReviewsByAction || buildReviewItemsByAction(actionList, nativeScan, protectedPaths, {});
  const totals = computeTotals(selectedIds, actionList, { itemReviewsByAction: reviewsByAction });
  const reclaimed = ledger.reduce((sum, entry) => sum + entry.bytes, 0);
  const selected = actionList.filter((action) => selectedIds.has(action.id));
  const locked = actionList.filter((action) => action.gate === "blocked" || isActionProtected(action, protectedPaths) || !actionAllowedByIntake(action, intakePolicy));
  const measuredFindings = nativeScan?.findings?.filter((finding) => finding.status === "measured" || finding.status === "limited") || [];

  return [
    "# SpaceGuard Dry-Run Report",
    "",
    `Data mode: ${scanMode === "native-readonly" ? "Native read-only scan" : "Demo data"}`,
    `Scenario: ${scenario.label}`,
    `Machine: ${reportProfile.machine}`,
    `Drive: ${reportProfile.drive}`,
    `Goal: ${formatBytes(goalBytes)}`,
    `Selected recovery: ${formatBytes(totals.selectedBytes)}`,
    `Simulated reclaimed: ${formatBytes(reclaimed)}`,
    `Pending gates: ${readiness.unresolved.length}`,
    `Admin/system actions: ${intakePolicy?.adminAllowed ? "allowed for dry-run planning" : "blocked by intake"}`,
    "",
    "## Intake Policy",
    intakePolicy
      ? [
          `- Target drive: ${intakePolicy.targetDrive}`,
          `- Goal: ${formatBytes(intakePolicy.goalBytes || goalBytes)}`,
          `- Tolerance: ${intakePolicy.mode}`,
          `- Admin allowed: ${intakePolicy.adminAllowed ? "yes" : "no"}`,
          `- Status: ${intakePolicy.status}`,
          `- Boundary: ${intakePolicy.automationBlockedReason}`
        ].join("\n")
      : "- Not captured.",
    "",
    "## Task Powers",
    taskPowerCatalog
      ? [
          `- Status: ${taskPowerCatalog.status}`,
          `- Real run enabled: ${taskPowerCatalog.realRunEnabled ? "yes" : "no"}`,
          `- Selected powers: ${taskPowerCatalog.counts.selected}`,
          `- Active powers: ${taskPowerCatalog.counts.active}`,
          `- Powers needing approval: ${taskPowerCatalog.counts.needsApproval}`,
          `- Locked powers: ${taskPowerCatalog.counts.locked}`,
          `- Blocked powers: ${taskPowerCatalog.counts.blocked}`,
          taskPowerCatalog.rows
            .map((row) => `- ${row.label}: ${row.status} | selected=${row.selectedCount}/${row.availableCount} | dry-run=${row.dryRunCount} | ${row.nextStep}`)
            .join("\n")
        ].join("\n")
      : "- Not evaluated.",
    "",
    "## Protected Paths",
    protectedPaths.length ? protectedPaths.map((path) => `- ${path}`).join("\n") : "- None",
    "",
    "## Real Read-Only Scan",
    nativeScan
      ? [
          `- Platform: ${nativeScan.platform || "unknown"}`,
          nativeScan.volume
            ? `- Volume: ${nativeScan.volume.drive} | total=${formatBytes(nativeScan.volume.totalBytes)} | used=${formatBytes(nativeScan.volume.usedBytes)} | free=${formatBytes(nativeScan.volume.freeBytes)} | source=${nativeScan.volume.source}`
            : "- Volume: not available",
          `- Measured known roots: ${formatBytes(nativeScan.totalBytes || 0)}`,
          `- Write capability: ${nativeScan.writeCapability ? "present" : "disabled"}`,
          `- Destructive commands: ${nativeScan.destructiveCommands ? "present" : "disabled"}`,
          measuredFindings.length
            ? measuredFindings
                .slice()
                .sort((a, b) => b.bytes - a.bytes)
                .slice(0, 12)
                .map((finding) => `- ${finding.title}: ${formatBytes(finding.bytes)} | ${finding.path}`)
                .join("\n")
            : "- No known roots measured.",
          nativeScan.warnings?.length ? nativeScan.warnings.map((warning) => `- Warning: ${warning}`).join("\n") : "- No scanner warnings."
        ].join("\n")
      : "- Not run.",
    "",
    "## Scan Settings",
    scanSettings
      ? [
          `- Project artifacts: ${scanSettings.includeProjectArtifacts ? "included" : "excluded"}`,
          `- Max depth: ${scanSettings.maxDepth}`,
          `- Max entries per root: ${scanSettings.maxEntriesPerRoot}`,
          `- Custom roots: ${scanSettings.customRoots?.length || 0}`
        ].join("\n")
      : "- Default scanner settings.",
    "",
    "## Scan Coverage",
    scanCoverage
      ? [
          `- Status: ${scanCoverage.status}`,
          `- Confidence: ${scanCoverage.confidenceScore}%`,
          `- Measured bytes: ${formatBytes(scanCoverage.measuredBytes || 0)}`,
          `- Demo-estimated bytes: ${formatBytes(scanCoverage.estimatedBytes || 0)}`,
          `- Custom roots: ${scanCoverage.customRootRows?.length || 0}`,
          `- Custom root bytes: ${formatBytes(scanCoverage.customRootBytes || 0)}`,
          `- Unverified rows: ${scanCoverage.counts?.unverified || 0}`,
          scanCoverage.unverifiedRows?.length
            ? scanCoverage.unverifiedRows.slice(0, 8).map((row) => `- ${row.title}: ${row.evidence} | ${row.nextStep}`).join("\n")
            : "- No unverified rows."
        ].join("\n")
      : "- Not evaluated.",
    "",
    "## Recovery Advisor",
    advisor
      ? [
          `- Status: ${advisor.status}`,
          `- Open gap: ${formatBytes(advisor.gapBytes)}`,
          `- Primary: ${advisor.primary}`,
          advisor.steps.length ? advisor.steps.map((step) => `- ${step}`).join("\n") : "- No next steps."
        ].join("\n")
      : "- Not evaluated.",
    "",
    "## Storage Strategy",
    storageStrategy
      ? [
          `- Status: ${storageStrategy.status}`,
          `- Manual only: ${storageStrategy.manualOnly ? "yes" : "no"}`,
          `- Remaining gap: ${formatBytes(storageStrategy.gapBytes || 0)}`,
          `- Automation boundary: ${storageStrategy.automationBlockedReason}`,
          storageStrategy.options?.length
            ? storageStrategy.options
                .slice(0, 5)
                .map((option) => `- ${option.title}: ${option.lane} | ${option.detail} | guardrails=${option.guardrails.join(", ")}`)
                .join("\n")
            : "- No manual storage strategies are available."
        ].join("\n")
      : "- Not evaluated.",
    "",
    "## Manual Strategy Checklist",
    manualStrategyChecklist
      ? [
          `- Status: ${manualStrategyChecklist.status}`,
          `- Manual only: ${manualStrategyChecklist.manualOnly ? "yes" : "no"}`,
          `- Options: ${manualStrategyChecklist.optionCount}`,
          `- Done checks: ${manualStrategyChecklist.counts.done}/${manualStrategyChecklist.counts.total}`,
          `- Waiting required checks: ${manualStrategyChecklist.counts.waiting}`,
          `- Automation boundary: ${manualStrategyChecklist.automationBlockedReason}`,
          manualStrategyChecklist.checks.length
            ? manualStrategyChecklist.checks
                .slice(0, 20)
                .map((check) => `- ${check.optionTitle} / ${check.title}: ${check.status} | ${check.detail}`)
                .join("\n")
            : "- No manual checklist rows."
        ].join("\n")
      : "- Not evaluated.",
    "",
    "## Decision Log",
    decisionLog.length ? decisionLog.map((entry) => `- ${entry.title}: ${entry.status} | ${entry.detail}`).join("\n") : "- No decisions recorded.",
    "",
    "## Agent Questions",
    agentQuestionQueue
      ? [
          `- Status: ${agentQuestionQueue.status}`,
          `- Active question: ${agentQuestionQueue.activeQuestion?.prompt || "none"}`,
          `- Total questions: ${agentQuestionQueue.counts.total}`,
          `- Actionable questions: ${agentQuestionQueue.counts.actionable}`,
          agentQuestionQueue.questions.length
            ? agentQuestionQueue.questions
                .slice(0, 10)
                .map((question) => `- ${question.title}: ${question.prompt} | ${question.detail}`)
                .join("\n")
            : "- No blocking questions."
        ].join("\n")
      : "- Not evaluated.",
    "",
    "## Plan Snapshot",
    planSnapshot
      ? [
          `- Plan id: ${planSnapshot.id}`,
          `- Selected actions: ${planSnapshot.selectedCount}`,
          `- Selected recovery: ${formatBytes(planSnapshot.selectedBytes)}`,
          `- Scan mode: ${planSnapshot.scanMode}`
        ].join("\n")
      : "- Not generated.",
    "",
    "## Verification",
    verificationSummary
      ? [
          `- Status: ${verificationSummary.status}`,
          `- Current ledger: ${verificationSummary.current ? "yes" : "no"}`,
          `- Expected: ${formatBytes(verificationSummary.expectedBytes)}`,
          `- Ledger reclaimed: ${formatBytes(verificationSummary.reclaimedBytes)}`,
          `- Delta: ${formatBytes(verificationSummary.deltaBytes)}`,
          `- Detail: ${verificationSummary.detail}`
        ].join("\n")
      : "- Not evaluated.",
    "",
    "## Post-Run Verification",
    postRunVerification
      ? [
          `- Status: ${postRunVerification.status}`,
          `- Current plan: ${postRunVerification.current ? "yes" : "no"}`,
          `- Native evidence: ${postRunVerification.nativeEvidence ? "yes" : "no"}`,
          `- Checkpoints: ${postRunVerification.checkpoints.length}`,
          `- Skipped checkpoints: ${postRunVerification.skippedCount}`,
          `- Expected recovery: ${formatBytes(postRunVerification.expectedBytes)}`,
          postRunVerification.steps.map((step) => `- ${step}`).join("\n")
        ].join("\n")
      : "- Not evaluated.",
    "",
    "## Rescan Comparison",
    rescanComparison
      ? [
          `- Status: ${rescanComparison.status}`,
          `- Native evidence: ${rescanComparison.nativeEvidence ? "yes" : "no"}`,
          `- Post-run scan evidence: ${rescanComparison.postRunScanEvidence ? "yes" : "no"}`,
          `- Ledger timestamp: ${rescanComparison.latestExecutionAt || "missing"}`,
          `- Scan timestamp: ${rescanComparison.scanGeneratedAt || "missing"}`,
          `- Matched rows: ${rescanComparison.counts.matched}`,
          `- Mismatch rows: ${rescanComparison.counts.mismatch}`,
          `- Waiting rows: ${rescanComparison.counts.waiting}`,
          rescanComparison.rows.length
            ? rescanComparison.rows.map((row) => `- ${row.title}: ${row.state} | expected remaining=${formatBytes(row.expectedRemainingBytes)} | native remaining=${formatBytes(row.actualBytes)} | ${row.evidence}`).join("\n")
            : "- No rescan comparison rows."
        ].join("\n")
      : "- Not evaluated.",
    "",
    "## Rollback Plan",
    rollbackPlan
      ? [
          `- Status: ${rollbackPlan.status}`,
          `- Real run enabled: ${rollbackPlan.realRunEnabled ? "yes" : "no"}`,
          `- Routes: ${rollbackPlan.counts.routes}`,
          `- Rebuildable routes: ${rollbackPlan.counts.rebuildable}`,
          `- Proof complete: ${rollbackPlan.counts.proofComplete}`,
          `- Proof drafts: ${rollbackPlan.counts.proofDraft}`,
          `- Routes needing proof: ${rollbackPlan.counts.needsProof}`,
          `- Permanent-removal routes: ${rollbackPlan.counts.permanent}`,
          `- Rescan checkpoints: ${rollbackPlan.counts.checkpoints}`,
          `- Detail: ${rollbackPlan.detail}`,
          rollbackPlan.rows.length
            ? rollbackPlan.rows
                .map((row) => `- ${row.title}: ${row.status} | ${row.route} | ${row.recovery} | proof=${row.proof.status}${row.proof.evidencePath ? ` @ ${row.proof.evidencePath}` : ""} | evidence=${row.requiredEvidence.join("; ")}`)
                .join("\n")
            : "- No selected rollback rows."
        ].join("\n")
      : "- Not evaluated.",
    "",
    "## Run Readiness",
    runReadiness
      ? [
          `- Ready: ${runReadiness.ready ? "yes" : "no"}`,
          `- Blocked checks: ${runReadiness.blockedCount}`,
          runReadiness.items.map((item) => `- ${item.label}: ${item.passed ? "passed" : "blocked"} | ${item.detail}`).join("\n")
        ].join("\n")
      : "- Not evaluated.",
    "",
    "## Dry-Run Consent",
    consentReceipt
      ? [
          `- Armed: ${consentReceipt.ready ? "yes" : "no"}`,
          `- Accepted: ${consentReceipt.accepted ? "yes" : "no"}`,
          `- Accepted plan: ${consentReceipt.acceptedPlanId || "none"}`,
          `- Current plan: ${consentReceipt.planId || "none"}`,
          `- Expected recovery: ${formatBytes(consentReceipt.expectedBytes)}`,
          `- Executable routes: ${consentReceipt.routeCount}`,
          `- Warnings: ${consentReceipt.warnings.length}`,
          consentReceipt.items.map((item) => `- ${item.label}: ${item.passed ? "passed" : "blocked"} | ${item.detail}`).join("\n")
        ].join("\n")
      : "- Not evaluated.",
    "",
    "## Privilege Boundary",
    privilegeBoundary
      ? [
          `- Status: ${privilegeBoundary.status}`,
          `- Elevated: ${privilegeBoundary.elevated ? "yes" : "no"}`,
          `- Elevation source: ${privilegeBoundary.elevationSource || "unknown"}`,
          `- Admin-sensitive selected routes: ${privilegeBoundary.adminCount}`,
          `- Ready for admin routes: ${privilegeBoundary.readyForAdminRoutes ? "yes" : "no"}`,
          privilegeBoundary.adminRows.length
            ? privilegeBoundary.adminRows.map((row) => `- ${row.title}: ${row.route} | ${row.lane}`).join("\n")
            : "- No selected admin-sensitive routes.",
          privilegeBoundary.items.map((item) => `- ${item.label}: ${item.passed ? "passed" : "blocked"} | ${item.detail}`).join("\n")
        ].join("\n")
      : "- Not evaluated.",
    "",
    "## Privacy Boundary",
    privacyBoundary
      ? [
          `- Status: ${privacyBoundary.status}`,
          `- Cloud disabled: ${privacyBoundary.cloudDisabled ? "yes" : "no"}`,
          `- Telemetry disabled: ${privacyBoundary.telemetryDisabled ? "yes" : "no"}`,
          `- Exports are user-started: ${privacyBoundary.exportOnly ? "yes" : "no"}`,
          `- Local audit records: ${privacyBoundary.localRecordCount}`,
          `- Validation evidence records: ${privacyBoundary.validationRecordCount}`,
          privacyBoundary.warnings.length ? privacyBoundary.warnings.map((warning) => `- Warning: ${warning}`).join("\n") : "- No privacy warnings.",
          privacyBoundary.blockedCollections.length
            ? `- Blocked collection classes: ${privacyBoundary.blockedCollections.join(", ")}`
            : "- No blocked collection classes listed."
        ].join("\n")
      : "- Not evaluated.",
    "",
    "## Item Review",
    itemReview?.action
      ? [
          `Action: ${itemReview.action.title}`,
          `Source: ${itemReview.source}`,
          `Review bytes: ${formatBytes(itemReview.reviewBytes)}`,
          `Keep bytes: ${formatBytes(itemReview.keepBytes)}`,
          `Protected bytes: ${formatBytes(itemReview.protectedBytes)}`,
          `Selected item bytes: ${formatBytes(itemReview.selectedBytes || 0)}`,
          `Manual move/archive bytes: ${formatBytes(itemReview.manualDispositionBytes || 0)}`,
          `Item decisions: ${itemReview.removeCount || 0} remove, ${itemReview.moveCount || 0} move, ${itemReview.archiveCount || 0} archive, ${itemReview.keepCount || 0} keep, ${itemReview.undecidedCount || 0} undecided`,
          itemReview.items.length
            ? itemReview.items
                .map((item) => `- ${item.name}: ${formatBytes(item.bytes)} | recommendation=${item.recommendation} | decision=${item.decision}${item.protected ? " | protected" : ""} | ${item.path}`)
                .join("\n")
            : "- No item candidates."
        ].join("\n")
      : "- Not selected.",
    "",
    "## Executor Policy",
    executorPlan
      ? [
          `- Dry-run routes: ${executorPlan.dryRunCount}`,
          `- Future executor routes: ${executorPlan.futureCount}`,
          `- Blocked routes: ${executorPlan.blockedCount}`,
          `- Real run enabled: ${executorPlan.realRunEnabled ? "yes" : "no"}`,
          executorPlan.rows.length
            ? executorPlan.rows
                .map((row) => `- ${row.title}: ${row.status} | power=${row.powerLabel} | ${row.lane} | ${row.route} | ${row.realBlockedReason || row.verification}`)
                .join("\n")
            : "- No selected executor routes."
        ].join("\n")
      : "- Not evaluated.",
    "",
    "## Executor Manifest",
    executorManifest
      ? [
          `- Routes: ${executorManifest.counts.routes}`,
          `- First-safe routes: ${executorManifest.counts.firstSafeRoutes}`,
          `- Needs validation: ${executorManifest.counts.needsValidation}`,
          `- Blocked routes: ${executorManifest.counts.blocked}`,
          executorManifest.selectedRoutes.length
            ? executorManifest.selectedRoutes
                .map((route) => `- Selected: ${route.title} | ${route.status} | ${route.phase} | missing checks=${route.missingCheckIds.length}`)
                .join("\n")
            : "- No selected manifest routes.",
          executorManifest.nextSteps.length ? executorManifest.nextSteps.map((step) => `- Next: ${step}`).join("\n") : "- No manifest next steps."
        ].join("\n")
      : "- Not evaluated.",
    "",
    "## Public Beta Readiness",
    publicBetaReadiness
      ? [
          `- Status: ${publicBetaReadiness.status}`,
          `- Web demo ready: ${publicBetaReadiness.readyForWebDemo ? "yes" : "no"}`,
          `- Native beta ready: ${publicBetaReadiness.readyForNativeBeta ? "yes" : "no"}`,
          `- Real run enabled: ${publicBetaReadiness.realRunEnabled ? "yes" : "no"}`,
          `- Ready checks: ${publicBetaReadiness.counts.ready}/${publicBetaReadiness.counts.total}`,
          `- Primary: ${publicBetaReadiness.primary}`,
          publicBetaReadiness.rows.map((row) => `- ${row.label}: ${row.status} | ${row.detail}`).join("\n")
        ].join("\n")
      : "- Not evaluated.",
    "",
    "## Tool Command Inventory",
    toolCommandInventory
      ? [
          `- Command execution enabled: ${toolCommandInventory.commandExecutionEnabled ? "yes" : "no"}`,
          `- Real run enabled: ${toolCommandInventory.realRunEnabled ? "yes" : "no"}`,
          `- Commands: ${toolCommandInventory.counts.commands}`,
          `- Selected command routes: ${toolCommandInventory.counts.selected}`,
          `- Waiting validation: ${toolCommandInventory.counts.waiting}`,
          toolCommandInventory.rows
            .map((row) => `- ${row.title}: ${row.status} | inspect=${row.inspectCommand} | future=${row.futureCommand} | guardrails=${row.guardrails.join(", ")}`)
            .join("\n")
        ].join("\n")
      : "- Not evaluated.",
    "",
    "## Write Readiness",
    writeReadiness
      ? [
          `- Status: ${writeReadiness.status}`,
          `- Ready for real execution: ${writeReadiness.readyForRealExecution ? "yes" : "no"}`,
          `- Passed checks: ${writeReadiness.counts.passed}/${writeReadiness.counts.total}`,
          `- Candidate routes: ${writeReadiness.counts.candidateRoutes}`,
          `- Real routes: ${writeReadiness.counts.realRoutes}`,
          `- Primary: ${writeReadiness.primary}`,
          writeReadiness.items.map((item) => `- ${item.label}: ${item.passed ? "passed" : "blocked"} | ${item.detail}`).join("\n")
        ].join("\n")
      : "- Not evaluated.",
    "",
    "## Real Executor Capsule",
    realExecutorCapsule
      ? [
          `- Status: ${realExecutorCapsule.status}`,
          `- Destructive action available: ${realExecutorCapsule.destructiveActionAvailable ? "yes" : "no"}`,
          `- Route: ${realExecutorCapsule.route ? `${realExecutorCapsule.route.title} (${realExecutorCapsule.route.id})` : "none"}`,
          `- Code path: ${realExecutorCapsule.codePath.command} | ${realExecutorCapsule.codePath.status}`,
          `- Missing checks: ${realExecutorCapsule.counts.missingChecks}`,
          `- Blockers: ${realExecutorCapsule.counts.blockers}`,
          `- Primary: ${realExecutorCapsule.primary}`,
          realExecutorCapsule.blockers.length
            ? realExecutorCapsule.blockers.map((blocker) => `- ${blocker.label}: ${blocker.detail}`).join("\n")
            : "- No capsule blockers."
        ].join("\n")
      : "- Not evaluated.",
    "",
    "## Write Boundary Probe",
    writeBoundaryProbe
      ? [
          `- Status: ${writeBoundaryProbe.status}`,
          `- Rejection evidence: ${writeBoundaryProbe.rejectionEvidence ? "yes" : "no"}`,
          `- Accepted: ${writeBoundaryProbe.accepted ? "yes" : "no"}`,
          `- Real run enabled: ${writeBoundaryProbe.realRunEnabled ? "yes" : "no"}`,
          `- Destructive commands: ${writeBoundaryProbe.destructiveCommands ? "present" : "disabled"}`,
          `- Entries: ${writeBoundaryProbe.counts.entries}`,
          `- Rejected entries: ${writeBoundaryProbe.counts.rejected}`,
          `- Bytes reclaimed: ${formatBytes(writeBoundaryProbe.counts.bytes || 0)}`,
          `- Reason: ${writeBoundaryProbe.reason || "None"}`,
          writeBoundaryProbe.entries.length
            ? writeBoundaryProbe.entries.map((entry) => `- ${entry.title}: ${entry.result} | ${formatBytes(entry.bytes)} | ${entry.note || "no mutation"}`).join("\n")
            : "- No write-boundary entries."
        ].join("\n")
      : "- Not evaluated.",
    "",
    "## Release Gate",
    releaseGate
      ? [
          `- Ready for real run: ${releaseGate.readyForRealRun ? "yes" : "no"}`,
          `- Blocked reason: ${releaseGate.blockedReason || "None"}`,
          `- Validation checks passed: ${releaseGate.passedCount}/${releaseGate.totalCount}`,
          `- Real executor flag: ${releaseGate.realFlagEnabled ? "enabled" : "disabled"}`,
          `- Native ready: ${releaseGate.nativeReady ? "yes" : "no"}`,
          releaseGate.missingRows.length
            ? releaseGate.missingRows.map((row) => `- Missing: ${row.label} | ${row.status} | ${row.evidence}`).join("\n")
            : "- No missing checks."
        ].join("\n")
      : "- Not evaluated.",
    "",
    "## Validation Evidence Pack",
    validationPack
      ? [
          `- Ready for real run: ${validationPack.readyForRealRun ? "yes" : "no"}`,
          `- Missing checks: ${validationPack.missingCheckIds.length}`,
          `- Complete evidence records: ${validationPack.validationChecks.filter((check) => check.evidenceComplete).length}`,
          `- Detail-needed records: ${validationPack.validationChecks.filter((check) => check.evidenceValue && !check.evidenceComplete).length}`,
          `- VM scenarios: ${validationPack.vmScenarios.length}`,
          `- Fixture roots: ${validationPack.fixtureRoots.length}`,
          `- Safety invariants waiting: ${validationPack.safetyInvariants.filter((item) => !item.passed).length}`,
          validationPack.validationChecks.length
            ? validationPack.validationChecks
                .slice(0, 12)
                .map((check) => `- Check: ${check.label} | ${check.status} | evidence=${check.evidenceComplete ? "complete" : check.evidenceValue ? "needs-detail" : "missing"}`)
                .join("\n")
            : "- No validation checks.",
          validationPack.commands.length
            ? validationPack.commands.map((command) => `- Command: ${command.command} | ${command.result}`).join("\n")
            : "- No validation commands."
        ].join("\n")
      : "- Not generated.",
    "",
    "## Local Run History",
    ledgerHistorySummary
      ? [
          `- Records: ${ledgerHistorySummary.counts.records}`,
          `- Current plan records: ${ledgerHistorySummary.counts.current}`,
          `- Stale records: ${ledgerHistorySummary.counts.stale}`,
          `- Total simulated recovery: ${formatBytes(ledgerHistorySummary.totalReclaimedBytes)}`,
          ledgerHistorySummary.latestRecord
            ? `- Latest: ${ledgerHistorySummary.latestRecord.createdAt} | ${formatBytes(ledgerHistorySummary.latestRecord.reclaimedBytes)} | ${ledgerHistorySummary.latestRecord.planId}`
            : "- Latest: none"
        ].join("\n")
      : "- Not loaded.",
    "",
    "## Runtime Capabilities",
    runtimeCapabilities
      ? [
          `- Mode: ${runtimeCapabilities.mode}`,
          `- Platform: ${runtimeCapabilities.platform}`,
          `- Native available: ${runtimeCapabilities.available ? "yes" : "no"}`,
          `- Elevated: ${runtimeCapabilities.elevated ? "yes" : "no"}`,
          `- Elevation source: ${runtimeCapabilities.elevationSource || "unknown"}`,
          `- Real run enabled: ${runtimeCapabilities.realRunEnabled ? "yes" : "no"}`,
          `- Destructive commands: ${runtimeCapabilities.destructiveCommands ? "present" : "disabled"}`,
          `- Reason: ${runtimeCapabilities.reason || "None"}`
        ].join("\n")
      : "- Not checked.",
    "",
    "## Selected Actions",
    selected.length
      ? selected.map((action) => `- ${action.title}: ${formatBytes(getPlannedActionBytes(action, {}, reviewsByAction))} | ${action.risk} | ${gates[action.gate].label}`).join("\n")
      : "- None",
    "",
    "## Locked Or Restricted",
    locked.length ? locked.map((action) => `- ${action.title}: ${action.gate === "blocked" ? "policy blocked" : "protected path"}`).join("\n") : "- None",
    "",
    "## Ledger",
    ledger.length ? ledger.map((entry) => `- ${entry.time} ${entry.result}: ${entry.title} (${formatBytes(entry.bytes)})`).join("\n") : "- No execution simulated yet.",
    "",
    scanMode === "native-readonly"
      ? "This report may include locally measured path sizes from a native read-only scan. No cleanup was performed."
      : "This report was generated from demo data only. No local filesystem scan or cleanup was performed."
  ].join("\n");
}

function getActionTaskPowerId(action, policy = null) {
  const resolvedPolicy = policy || getExecutorPolicy(action);
  if (!action || action.gate === "blocked" || resolvedPolicy.lane === "blocked" || resolvedPolicy.route === "blocked") return "restricted-zones";
  if (action.gate === "advisory" || resolvedPolicy.lane === "advisory" || resolvedPolicy.route === "advisory") return "manual-storage-strategy";
  if (resolvedPolicy.lane === "admin-rebuildable" || resolvedPolicy.route === "windows-cleanup-api") return "admin-cleanup";
  if (resolvedPolicy.lane === "advanced" || resolvedPolicy.route === "advanced-checklist" || resolvedPolicy.route === "advanced-system-toggle") return "advanced-system-strategy";
  if (action.gate === "review" || resolvedPolicy.lane === "review") return "reviewed-item-cleanup";
  if (resolvedPolicy.lane === "tool-native" || resolvedPolicy.lane === "rebuildable" || action.gate === "groupConfirm") return "rebuildable-cache-cleanup";
  return "safe-cleanup";
}

function getTaskPowerDefinition(powerId) {
  return taskPowerDefinitions.find((power) => power.id === powerId) || taskPowerDefinitions[taskPowerDefinitions.length - 1];
}

function buildTaskPowerBlockers(definition, availableActions = [], selectedActions = [], unresolved = [], intakePolicy = null) {
  const blockers = [];
  const addBlocker = (id, label, detail, gate = "") => {
    if (blockers.some((blocker) => blocker.id === id && blocker.detail === detail)) return;
    blockers.push({ id, label, detail, gate });
  };

  if (definition.id === "restricted-zones" && availableActions.length) {
    addBlocker("policy-blocked", "Policy blocked", "This power is intentionally unavailable for automatic cleanup.", "blocked");
  }

  if (definition.id === "manual-storage-strategy" && availableActions.length) {
    addBlocker("manual-only", "Manual only", "This power tracks backup-first strategy but never creates executor routes.", "advisory");
  }

  if ((definition.id === "admin-cleanup" || definition.id === "advanced-system-strategy") && intakePolicy?.adminSensitiveBlocked) {
    addBlocker("intake-admin-boundary", "Intake admin boundary", "Allow admin/system routes before this power can enter dry-run planning.", "intake");
  }

  for (const entry of unresolved) {
    if (entry.gate === "intake") {
      addBlocker(`intake-${entry.action.id}`, "Intake locked", `${entry.action.title} is blocked by the admin/system intake boundary.`, "intake");
    } else if (entry.gate === "protected") {
      addBlocker(`protected-${entry.action.id}`, "Protected path", `${entry.action.title} matches a user-protected path.`, "protected");
    } else if (entry.gate === "groupConfirm") {
      addBlocker("rebuildable-approval", "Approval needed", "Approve selected rebuildable cache cleanup before dry-run simulation.", "groupConfirm");
    } else if (entry.gate === "permanentConfirm") {
      addBlocker("permanent-confirm", "Permanent confirmation", "Confirm Recycle Bin permanent-removal consequence before dry-run simulation.", "permanentConfirm");
    } else if (entry.gate === "review") {
      addBlocker(`review-${entry.action.id}`, "Item review needed", `${entry.action.title} needs explicit item decisions.`, "review");
    } else if (entry.gate === "typed") {
      addBlocker(`typed-${entry.action.id}`, "Typed acknowledgement", `${entry.action.title} needs its exact typed phrase.`, "typed");
    } else if (entry.gate) {
      addBlocker(`gate-${entry.action.id}`, "Gate needed", `${entry.action.title} is waiting on ${entry.gate}.`, entry.gate);
    }
  }

  return blockers;
}

function getTaskPowerStatus(definition, availableActions = [], selectedActions = [], blockers = [], intakePolicy = null) {
  if (!availableActions.length) return "empty";
  if (definition.id === "restricted-zones") return "blocked";
  if (definition.id === "manual-storage-strategy") return "advisory";
  if ((definition.id === "admin-cleanup" || definition.id === "advanced-system-strategy") && intakePolicy?.adminSensitiveBlocked) return "locked";
  if (!selectedActions.length) return "available";
  if (blockers.length) return "needs-approval";
  return "active";
}

function getTaskPowerTone(status) {
  if (status === "active") return "safe";
  if (status === "available" || status === "needs-approval") return "review";
  if (status === "advisory") return "advisory";
  if (status === "blocked" || status === "locked") return "restricted";
  return "outline";
}

function getTaskPowerNextStep(definition, status, blockers = [], selectedActions = []) {
  if (status === "active") return `${definition.label} is scoped and ready for dry-run simulation.`;
  if (status === "available") return `Select a matching cleanup action to use ${definition.label}.`;
  if (status === "locked") return "Use the intake control to allow admin/system dry-run routes, then review the specific action gate.";
  if (status === "blocked") return "Keep this visible for education and manual inspection only; no executor route is available.";
  if (status === "advisory") return "Track evidence manually. The app will not automate this storage strategy.";
  if (status === "needs-approval") {
    const first = blockers[0];
    return first?.detail || `Resolve gates for ${selectedActions.length} selected action(s).`;
  }
  return "No matching cleanup actions are present in this scenario.";
}

function getTaskPowerPrimary(status, blockedRows = [], selectedRows = []) {
  if (status === "powers-scoped") return "Selected task powers are scoped for dry-run only.";
  if (status === "powers-need-decision") return `${blockedRows.length} selected task power(s) need approval, review, or intake changes.`;
  return "Select cleanup actions to activate scoped task powers.";
}

function getTaskPowerSteps(status, blockedRows = [], selectedRows = []) {
  if (status === "powers-scoped") {
    return [
      "Keep real execution disabled until validation evidence exists.",
      "Arm dry-run consent for the current plan snapshot.",
      "Simulate and rescan affected roots."
    ];
  }
  if (status === "powers-need-decision") {
    return blockedRows.slice(0, 3).map((row) => row.nextStep);
  }
  const availableSelected = selectedRows.length ? selectedRows : [];
  if (availableSelected.length) return availableSelected.slice(0, 3).map((row) => row.nextStep);
  return [
    "Run a scan.",
    "Select a cleanup action.",
    "Resolve the power-specific gate before dry-run simulation."
  ];
}

function unresolvedGate(action, approvals = {}, protectedPaths = [], itemReview = null, intakePolicy = null) {
  if (isActionProtected(action, protectedPaths)) return "protected";
  if (!actionAllowedByIntake(action, intakePolicy)) return "intake";
  if (!selectableAction(action, protectedPaths, intakePolicy) || action.gate === "auto") return null;
  if (action.gate === "groupConfirm") return approvals.groupConfirm ? null : "groupConfirm";
  if (action.gate === "permanentConfirm") return approvals.permanentConfirm ? null : "permanentConfirm";
  if (action.gate === "review") return isReviewGateResolved(action, approvals, itemReview) ? null : "review";
  if (action.gate === "typed") return approvals.typed?.[action.id] === action.typedPhrase ? null : "typed";
  return action.gate;
}

function isReviewGateResolved(action, approvals = {}, itemReview = null) {
  if (itemReview?.items?.length) {
    return itemReview.undecidedCount === 0;
  }
  return Boolean(approvals.reviewed?.[action.id]);
}

function getReviewReason(action, status, gate, itemReview = null) {
  if (status === "protected") return "Matches a user-protected path.";
  if (status === "intake-blocked") return "Blocked by intake policy until admin/system actions are allowed.";
  if (status === "blocked") return action.gate === "advisory" ? "Advisory only." : "Blocked by product policy.";
  if (status === "pending") {
    if (gate === "intake") return "Needs intake consent for admin-sensitive cleanup.";
    if (gate === "groupConfirm") return "Needs rebuildable-cache approval.";
    if (gate === "permanentConfirm") return "Needs permanent-removal confirmation.";
    if (gate === "typed") return "Needs typed acknowledgement.";
    if (itemReview?.items?.length) {
      if (itemReview.undecidedCount > 0) return `${itemReview.undecidedCount} item decision(s) still unset.`;
      if (itemReview.removeCount === 0) return "Manual item decisions are resolved, but no Remove bytes are selected for executor preview.";
    }
    return "Needs item review.";
  }
  if (status === "approved") {
    if (itemReview?.items?.length && itemReview.removeCount === 0) {
      return "Item review is resolved for manual move/archive/keep; no executable cleanup bytes are selected.";
    }
    return "Approved for dry-run simulation.";
  }
  return "Not selected.";
}

function gateInstruction(action, gate) {
  if (gate === "auto") return `Add ${action.title} for ${formatBytes(action.bytes)}.`;
  if (gate === "groupConfirm") return `Approve rebuildable-cache cleanup for ${action.title} (${formatBytes(action.bytes)}).`;
  if (gate === "permanentConfirm") return `Confirm permanent removal for ${action.title} (${formatBytes(action.bytes)}); these files leave the Recycle Bin.`;
  if (gate === "review") return `Review ${action.title} item-by-item before selecting ${formatBytes(action.bytes)}.`;
  if (gate === "typed") return `Use typed acknowledgement for ${action.title} only after backup/rollback is clear.`;
  if (gate === "protected") return `Remove or narrow the protected path before considering ${action.title}.`;
  return `Keep ${action.title} visible as ${gates[action.gate]?.label || action.gate}.`;
}

function collectNativeReviewItems(actionId, nativeScan) {
  if (!nativeScan?.findings?.length) return [];
  return nativeScan.findings
    .filter((finding) => finding.recipeId === actionId)
    .flatMap((finding) =>
      Array.isArray(finding.items)
        ? finding.items.map((item) => ({
            ...item,
            path: item.path || finding.path,
            sourceFinding: finding.title
          }))
        : []
    );
}

function normalizeReviewItem(item, action, protectedPaths, approvals = {}, index = 0) {
  const path = item.path || action.path;
  const protectedByUser = pathMatchesProtected(path, protectedPaths);
  const ageDays = Number(item.ageDays ?? item.age_days ?? 0);
  let recommendation = item.recommendation || inferItemRecommendation(action, item, ageDays);
  if (protectedByUser) recommendation = "keep";
  const id = item.id || `${action.id}-${index}`;
  const storedDecision = approvals.reviewItems?.[action.id]?.[id] || "";
  const decision = protectedByUser ? "keep" : isItemReviewDecision(storedDecision) ? storedDecision : "undecided";

  return {
    id,
    name: item.name || item.title || path.split("\\").filter(Boolean).pop() || action.title,
    path,
    bytes: Number(item.bytes || 0),
    ageDays,
    kind: item.kind || "filesystem item",
    recommendation,
    decision,
    selectedForRemoval: decision === "remove",
    selectedForManualDisposition: decision === "move" || decision === "archive",
    protected: protectedByUser,
    reason: protectedByUser ? "Matches a user-protected path." : item.reason || item.note || inferItemReason(action, recommendation, ageDays)
  };
}

function getItemReviewForAction(action, itemReviewsByAction = {}) {
  if (!action || action.gate !== "review") return null;
  return itemReviewsByAction?.[action.id] || null;
}

function isItemReviewDecision(value) {
  return value === "remove" || value === "keep" || value === "move" || value === "archive";
}

function summarizeReviewItems(items = []) {
  return items.reduce(
    (summary, item) => {
      if (item.decision === "remove") {
        summary.removeCount += 1;
        summary.removeBytes += item.bytes;
      } else if (item.decision === "move") {
        summary.moveCount += 1;
        summary.moveBytes += item.bytes;
      } else if (item.decision === "archive") {
        summary.archiveCount += 1;
        summary.archiveBytes += item.bytes;
      } else if (item.decision === "keep") {
        summary.keepCount += 1;
        summary.keepBytes += item.bytes;
      } else {
        summary.undecidedCount += 1;
        summary.undecidedBytes += item.bytes;
      }
      return summary;
    },
    {
      removeCount: 0,
      removeBytes: 0,
      moveCount: 0,
      moveBytes: 0,
      archiveCount: 0,
      archiveBytes: 0,
      keepCount: 0,
      keepBytes: 0,
      undecidedCount: 0,
      undecidedBytes: 0
    }
  );
}

function getReviewDecisionSummary(action, approvals = {}, itemReview = null) {
  if (!itemReview?.items?.length) {
    return {
      removeCount: approvals.reviewed?.[action.id] ? 1 : 0,
      moveCount: 0,
      archiveCount: 0,
      keepCount: 0,
      undecidedCount: approvals.reviewed?.[action.id] ? 0 : 1,
      removeBytes: approvals.reviewed?.[action.id] ? action.bytes : 0,
      moveBytes: 0,
      archiveBytes: 0,
      keepBytes: 0,
      undecidedBytes: approvals.reviewed?.[action.id] ? 0 : action.bytes
    };
  }
  return summarizeReviewItems(itemReview.items);
}

function getPlannedActionBytes(action, approvals = {}, itemReviewsByAction = {}) {
  const itemReview = getItemReviewForAction(action, itemReviewsByAction);
  if (itemReview) return itemReview.selectedBytes || itemReview.removeBytes || 0;
  if (action.gate === "review" && !approvals.reviewed?.[action.id]) return 0;
  return action.bytes;
}

function getPendingActionBytes(action, approvals = {}, itemReviewsByAction = {}) {
  const itemReview = getItemReviewForAction(action, itemReviewsByAction);
  if (itemReview) return itemReview.undecidedBytes || itemReview.reviewBytes || action.bytes;
  return action.bytes;
}

function getLedgerResult(action, protectedPaths, options = {}) {
  if (isActionProtected(action, protectedPaths)) return "skipped";
  if (!action.executableInDemo) return "skipped";
  if (action.gate === "review" && getPlannedActionBytes(action, options.approvals, options.itemReviewsByAction) === 0) return "skipped";
  return "simulated";
}

function getLedgerBytes(action, protectedPaths, options = {}) {
  if (getLedgerResult(action, protectedPaths, options) !== "simulated") return 0;
  return getPlannedActionBytes(action, options.approvals, options.itemReviewsByAction);
}

function getLedgerMethod(action, protectedPaths, options = {}) {
  if (isActionProtected(action, protectedPaths)) return "Skipped because the path is user-protected.";
  const itemReview = getItemReviewForAction(action, options.itemReviewsByAction);
  if (itemReview) {
    return `Simulated cleanup for ${itemReview.removeCount} reviewed item(s); ${itemReview.keepCount} kept and ${itemReview.undecidedCount} undecided.`;
  }
  return action.method;
}

function inferItemRecommendation(action, item, ageDays) {
  if (action.id === "node-modules-old") return ageDays >= 60 ? "review" : "keep";
  if (action.id === "downloads-installers") return ageDays >= 30 ? "review" : "keep";
  if (action.id === "large-user-files") return ageDays >= 90 ? "review" : "keep";
  if (action.id === "android-studio") return ageDays >= 30 ? "review" : "keep";
  return item.bytes > 0 ? "review" : "keep";
}

function inferItemReason(action, recommendation, ageDays) {
  if (recommendation === "keep") return "Recent or ambiguous item; keep until the user confirms.";
  if (action.id === "node-modules-old") return `Dependency folder last changed about ${ageDays} day(s) ago.`;
  if (action.id === "downloads-installers") return `Download candidate is about ${ageDays} day(s) old.`;
  if (action.id === "large-user-files") return `Large personal file last changed about ${ageDays} day(s) ago.`;
  if (action.id === "android-studio") return `Android tooling candidate is about ${ageDays} day(s) old.`;
  return "Review before selecting this item.";
}

function getRealExecutionBlocker(action, policy, scanMode) {
  if (!policy.realRunEnabled) return "Real execution is disabled in this build.";
  if (scanMode !== "native-readonly") return "Requires native read-only scan evidence.";
  if (policy.requiresNativeValidation && !action.scanSource) return "Requires measured native finding.";
  return "";
}

function requiresAdminBoundary(row) {
  if (!row) return false;
  return (
    row.lane === "admin-rebuildable" ||
    row.lane === "advanced" ||
    row.route === "windows-cleanup-api" ||
    row.route === "advanced-checklist" ||
    row.route === "advanced-system-toggle"
  );
}

function getRollbackPosture(row, requirement, itemReview = null) {
  if (!row?.canSimulate || row.status === "blocked" || row.blockers?.length) {
    return {
      status: "not-executable",
      tone: "restricted",
      restoreMode: "none",
      restoreTarget: "No executor route",
      recovery: "This route cannot run in the current plan.",
      requiredEvidence: ["Resolve gates, protected paths, or policy blockers before considering rollback."]
    };
  }

  if (row.route === "shell-recycle-bin") {
    return {
      status: "permanent-warning",
      tone: "restricted",
      restoreMode: "none-after-empty",
      restoreTarget: "Not restorable after emptying",
      recovery: "Emptying Recycle Bin is a permanent-removal boundary; there is no automated restore path after execution.",
      requiredEvidence: [
        "Recycle Bin inventory before execution.",
        "Permanent-removal acknowledgement shown before execution.",
        "Post-run rescan or shell inventory evidence."
      ]
    };
  }

  if (row.route === "item-review-recycle-bin" || row.route === "item-review-large-files") {
    const selectedCount = itemReview?.removeCount || 0;
    return {
      status: "restore-proof-required",
      tone: "review",
      restoreMode: row.route === "item-review-large-files" ? "archive-or-recycle-bin" : "recycle-bin-or-quarantine",
      restoreTarget: row.route === "item-review-large-files" ? "Archive destination, quarantine, or Recycle Bin" : "Recycle Bin or quarantine folder",
      recovery: `${selectedCount} reviewed item(s) need a visible restore location before real cleanup can ship.`,
      requiredEvidence: [
        "Per-item Remove/Keep decisions.",
        "Restore location displayed before execution.",
        "Protected item exclusion evidence.",
        "Post-run affected-root rescan checkpoint."
      ]
    };
  }

  if (row.route === "windows-cleanup-api") {
    return {
      status: "backup-required",
      tone: "advanced",
      restoreMode: "windows-rollback-sensitive",
      restoreTarget: "Windows recovery or backup state",
      recovery: "Windows cleanup can remove OS rollback data, so the app needs explicit backup and rollback-consequence evidence.",
      requiredEvidence: [
        "Admin boundary evidence.",
        "OS rollback consequence acknowledgement.",
        "Backup or recovery state captured before execution.",
        "Supported Windows cleanup API proof."
      ]
    };
  }

  if (row.route === "advanced-checklist" || row.route === "advanced-system-toggle") {
    return {
      status: "backup-required",
      tone: "advanced",
      restoreMode: "manual-rollback",
      restoreTarget: "Manual backup or tool-owned restore flow",
      recovery: "Advanced routes stay manual until backup state and restore steps are proven.",
      requiredEvidence: [
        "Typed acknowledgement.",
        "Backup or restore point reference.",
        "Manual rollback steps visible before execution.",
        "Post-run verification checklist."
      ]
    };
  }

  return {
    status: "rebuildable-rescan",
    tone: requirement.lane === "safe" ? "safe" : "rebuildable",
    restoreMode: "recreate-or-rescan",
    restoreTarget: "Tool or system rebuilds the data",
    recovery: requirement.rollback || "Data is disposable or rebuildable; verify by read-only rescan.",
    requiredEvidence: [
      "Exact allowlisted affected root.",
      "Skipped-file ledger entry for locked or protected files.",
      "Post-run read-only rescan comparison."
    ]
  };
}

function getRollbackPlanDetail(status, rows, needsProofRows) {
  if (status === "no-selection") return "No selected executor route needs rollback handling yet.";
  if (status === "no-executable-routes") return "Selected routes are blocked or advisory-only, so rollback remains a policy explanation.";
  if (status === "needs-rollback-proof") {
    return `${needsProofRows.length} selected route(s) need restore, backup, or permanent-removal proof before real cleanup.`;
  }
  const proofCompleteRows = rows.filter((row) => row.status === "proof-complete");
  if (proofCompleteRows.length) {
    return `${proofCompleteRows.length} selected route(s) have structured rollback proof recorded; real cleanup still needs ledger and rescan evidence.`;
  }
  return `${rows.length} selected route(s) are disposable or rebuildable, but still need ledger and rescan evidence.`;
}

function buildRollbackSteps(status, rows, needsProofRows, postRunVerification = null) {
  if (status === "no-selection") {
    return ["Select a cleanup action.", "Resolve its gate.", "Review the route rollback posture before arming a dry run."];
  }
  if (status === "no-executable-routes") {
    return ["Remove blocked or advisory selections.", "Resolve item gates and protected paths.", "Keep real execution locked."];
  }

  const steps = ["Keep real execution locked until rollback proof is captured."];
  if (rows.some((row) => row.rollbackStatus === "restore-proof-required" && !row.proof.complete)) {
    steps.push("Show Recycle Bin, quarantine, or archive restore location for every reviewed item route.");
  }
  if (rows.some((row) => row.rollbackStatus === "permanent-warning" && !row.proof.complete)) {
    steps.push("Require permanent-removal acknowledgement for Recycle Bin emptying.");
  }
  if (rows.some((row) => row.rollbackStatus === "backup-required" && !row.proof.complete)) {
    steps.push("Capture backup or recovery-state evidence for admin and advanced routes.");
  }
  if (postRunVerification?.checkpoints?.length) {
    steps.push("Attach current affected-root checkpoints to rollback evidence.");
  } else {
    steps.push("Run dry-run simulation to create affected-root checkpoints.");
  }
  if (!needsProofRows.length) {
    steps.push("Use native read-only rescan parity as the restore proof for rebuildable routes.");
  }
  return steps;
}

function isRollbackProofRequired(status) {
  return status === "restore-proof-required" || status === "backup-required" || status === "permanent-warning";
}

function buildRescanComparisonRow({
  checkpoint,
  nativeScan,
  nativeEvidence,
  postRunScanEvidence,
  latestExecutionAt,
  scanGeneratedAt,
  toleranceBytes
}) {
  const skipped = checkpoint.status === "skipped" || checkpoint.ledgerResult === "skipped" || Number(checkpoint.expectedBytes || 0) === 0;
  const expectedBytes = Number(checkpoint.expectedBytes || 0);
  const baselineBytes = Number(checkpoint.baselineBytes ?? expectedBytes);
  const expectedRemainingBytes = skipped ? baselineBytes : Math.max(0, baselineBytes - expectedBytes);
  const finding = findNativeFindingForCheckpoint(checkpoint, nativeScan);
  const measured = finding && (finding.status === "measured" || finding.status === "limited");
  const actualBytes = measured ? Number(finding.bytes || 0) : 0;
  const deltaBytes = measured ? Math.abs(actualBytes - expectedRemainingBytes) : expectedRemainingBytes;
  let state = "needs-native-rescan";
  let evidence = "Run the Windows desktop read-only scanner after the ledger is created.";

  if (skipped) {
    state = "skipped";
    evidence = "Ledger skipped this route; keep the skipped result visible for audit.";
  } else if (!nativeEvidence) {
    state = "needs-native-rescan";
    evidence = "No native scan is available for this comparison.";
  } else if (!postRunScanEvidence) {
    state = "needs-post-run-native-rescan";
    evidence = latestExecutionAt
      ? `Native scan must be newer than ledger timestamp ${latestExecutionAt}.`
      : "Ledger is missing an absolute execution timestamp; simulate again before comparing.";
  } else if (!finding || !measured) {
    state = "no-finding";
    evidence = finding
      ? `Native finding status is ${finding.status}; measured or limited evidence is required.`
      : "No matching native finding exists for this affected route.";
  } else if (deltaBytes <= toleranceBytes) {
    state = "matched";
    evidence = `Native remaining size is within ${formatBytes(toleranceBytes)} tolerance.`;
  } else {
    state = "mismatch";
    evidence = `Native remaining size differs by ${formatBytes(deltaBytes)}.`;
  }

  return {
    id: checkpoint.id,
    title: checkpoint.title,
    route: checkpoint.route,
    path: checkpoint.path,
    state,
    tone: getRescanRowTone(state),
    baselineBytes,
    expectedBytes,
    expectedRemainingBytes,
    actualBytes,
    deltaBytes,
    nativeStatus: finding?.status || "missing",
    nativePath: finding?.path || "",
    latestExecutionAt,
    scanGeneratedAt,
    evidence
  };
}

function findNativeFindingForCheckpoint(checkpoint, nativeScan) {
  const findings = nativeScan?.findings || [];
  if (!findings.length) return null;
  const byRecipe = findings.filter((finding) => finding.recipeId === checkpoint.id);
  if (byRecipe.length) return sumNativeFindings(byRecipe);
  const checkpointPath = normalizeComparablePath(checkpoint.path);
  if (!checkpointPath) return null;
  const byPath = findings.filter((finding) => {
    const findingPath = normalizeComparablePath(finding.path);
    return findingPath && (checkpointPath.includes(findingPath) || findingPath.includes(checkpointPath));
  });
  return byPath.length ? sumNativeFindings(byPath) : null;
}

function sumNativeFindings(findings) {
  const measured = findings.filter((finding) => finding.status === "measured" || finding.status === "limited");
  const rows = measured.length ? measured : findings;
  const first = rows[0] || {};
  return {
    recipeId: first.recipeId || "",
    title: first.title || "",
    path: rows.map((finding) => finding.path).filter(Boolean).join(", "),
    status: measured.some((finding) => finding.status === "limited")
      ? "limited"
      : measured.length
        ? "measured"
        : first.status || "missing",
    bytes: rows.reduce((sum, finding) => sum + Number(finding.bytes || 0), 0)
  };
}

function normalizeComparablePath(path) {
  return String(path || "")
    .toLowerCase()
    .replace(/%userprofile%/g, "c:\\users\\demo")
    .replace(/%localappdata%/g, "c:\\users\\demo\\appdata\\local")
    .replace(/%temp%/g, "temp")
    .replace(/\s+\+\d+\s+more/g, "")
    .split(",")[0]
    .trim();
}

function latestComparableTimestamp(values = []) {
  const timestamps = values
    .map((value) => ({ value, time: parseComparableTimestamp(value) }))
    .filter((entry) => entry.value && Number.isFinite(entry.time))
    .sort((a, b) => b.time - a.time);
  return timestamps[0]?.value || "";
}

function isTimestampAtOrAfter(value, baseline) {
  const valueTime = parseComparableTimestamp(value);
  const baselineTime = parseComparableTimestamp(baseline);
  return Number.isFinite(valueTime) && Number.isFinite(baselineTime) && valueTime >= baselineTime;
}

function parseComparableTimestamp(value) {
  if (typeof value === "number") return value < 10_000_000_000 ? value * 1000 : value;
  const text = String(value || "").trim();
  if (!text) return Number.NaN;
  const unixMatch = text.match(/^unix:(\d+(?:\.\d+)?)$/i);
  if (unixMatch) return Number(unixMatch[1]) * 1000;
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const numeric = Number(text);
    return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  }
  return Date.parse(text);
}

function getRescanComparisonStatus({ rows, nativeEvidence, postRunScanEvidence }) {
  if (!nativeEvidence) return "needs-native-rescan";
  if (!postRunScanEvidence) return "needs-post-run-native-rescan";
  if (rows.some((row) => row.state === "mismatch" || row.state === "no-finding")) return "mismatch";
  if (rows.some((row) => row.state === "matched")) return "matched";
  if (rows.every((row) => row.state === "skipped")) return "skipped";
  return "needs-post-run-native-rescan";
}

function getRescanComparisonTone(status) {
  if (status === "matched" || status === "skipped") return "safe";
  if (status === "mismatch") return "restricted";
  if (status === "stale-ledger") return "advanced";
  return "review";
}

function getRescanRowTone(state) {
  if (state === "matched" || state === "skipped") return "safe";
  if (state === "mismatch" || state === "no-finding") return "restricted";
  return "review";
}

function getRescanComparisonDetail(status, counts) {
  if (status === "matched") return `${counts.matched} affected route(s) match the post-run native rescan within tolerance.`;
  if (status === "mismatch") return `${counts.mismatch + counts.noFinding} affected route(s) still need investigation before parity can count.`;
  if (status === "skipped") return "All checkpoints were skipped; keep the skipped ledger visible and do not claim reclaimed space.";
  if (status === "needs-native-rescan") return "Native read-only scan evidence is required before affected-root comparison can start.";
  return "Run a native read-only scan after the current ledger timestamp before comparing affected roots.";
}

function getRescanComparisonSteps(status) {
  if (status === "matched") {
    return ["Export the dry-run report.", "Attach the rescan comparison to Windows validation evidence.", "Keep real cleanup disabled until release gates pass."];
  }
  if (status === "mismatch") {
    return ["Inspect mismatched affected roots.", "Check skipped files, locks, and scanner limits.", "Do not use this run as ledger/rescan parity evidence."];
  }
  if (status === "skipped") {
    return ["Keep skipped entries in the ledger.", "Explain why no bytes were reclaimed.", "Rescan again only after a plan that can actually run."];
  }
  return ["Run dry-run simulation for the current plan.", "Run native read-only scan after the ledger timestamp.", "Compare every affected route before real-executor validation."];
}

function getReleaseBlockedReason({ realFlagEnabled, nativeReady, missingRows, candidateRoutes }) {
  if (!realFlagEnabled) return "Real executor feature flag is disabled.";
  if (!nativeReady) return "Native Windows scan evidence is required.";
  if (missingRows.length > 0) return `${missingRows.length} validation check(s) still need evidence.`;
  if (candidateRoutes.length === 0) return "No selected executor route is eligible.";
  return "";
}

function getWriteReadinessPrimary(status, blockedItems = []) {
  if (status === "ready-for-real-execution") return "All real-execution gates are satisfied for the current plan.";
  if (status === "implementation-locked") return "Real cleanup is blocked because no write-capable executor is implemented for the selected route.";
  const first = blockedItems[0];
  return first ? `${first.label}: ${first.detail}` : "Real cleanup remains locked by policy.";
}

function buildWriteReadinessSteps(status, blockedItems = []) {
  if (status === "ready-for-real-execution") {
    return ["Show final destructive-action confirmation.", "Run only selected real executor routes.", "Write ledger and immediately require a post-run native rescan."];
  }
  if (status === "implementation-locked") {
    return ["Keep the app in dry-run mode.", "Implement one first-safe real executor behind a feature flag.", "Validate it in disposable Windows fixtures before exposing it."];
  }
  return blockedItems.slice(0, 4).map((item) => `${item.label}: ${item.detail}`);
}

function buildPublicBetaSteps(status, waitingRows = []) {
  if (status === "native-beta-ready") {
    return [
      "Keep real cleanup claims out of public copy.",
      "Publish the read-only beta with support and uninstall docs.",
      "Continue real-executor validation in disposable Windows VMs."
    ];
  }
  if (status === "web-demo-ready") {
    const firstWaiting = waitingRows.slice(0, 3).map((row) => `${row.label}: ${row.detail}`);
    return firstWaiting.length ? firstWaiting : ["Publish demo only and keep native beta private until evidence is recorded."];
  }
  return [
    "Keep the app private until local-only privacy and no-real-cleanup claims are proven.",
    "Run browser-demo checks and native read-only smoke tests.",
    "Record distribution/support evidence before native beta."
  ];
}

function getExecutorRouteRequirement(route) {
  return executorRouteRequirements[route] || {
    title: "Unclassified route",
    lane: "blocked",
    phase: "never",
    implementation: "No executor route exists until the route is classified.",
    rollback: "Not applicable because unclassified routes cannot run.",
    proof: "Route must be assigned to an explicit manifest entry before validation.",
    requiredValidationIds: [],
    fixtureIds: [],
    preconditions: ["Classify route"]
  };
}

function buildExecutorManifestNextSteps(routes, selectedRoutes) {
  if (!selectedRoutes.length) {
    return ["Select at least one cleanup action to see which executor routes would be involved."];
  }

  const selectedNeedingValidation = selectedRoutes.filter((route) => route.status === "needs-validation");
  const selectedBlocked = selectedRoutes.filter((route) => route.status === "blocked" || route.status === "advisory" || route.status === "no-dry-run");
  const firstSafeWaiting = routes.filter((route) => route.phase === "first-safe" && route.status === "needs-validation");
  const steps = [];

  if (selectedBlocked.length) {
    steps.push(`Remove or keep manual-only selected routes: ${selectedBlocked.map((route) => route.title).join(", ")}.`);
  }
  if (selectedNeedingValidation.length) {
    steps.push(`Capture Windows validation evidence for selected route(s): ${selectedNeedingValidation.map((route) => route.title).join(", ")}.`);
  }
  if (firstSafeWaiting.length) {
    steps.push(`Prioritize first-safe executor lanes: ${firstSafeWaiting.map((route) => route.title).join(", ")}.`);
  }
  if (!steps.length) {
    steps.push("Selected routes have manifest coverage; keep real execution locked until runtime flags and release evidence are reviewed.");
  }

  return steps;
}

function getRealExecutorCapsulePrimary(status, route, blockers = []) {
  if (status === "execution-available") return "A write-capable executor is available for the selected capsule.";
  if (!route) return "No first-safe executor capsule is selected yet.";
  if (status === "implementation-capsule") return `${route.title} is the next implementation capsule, but no write-capable command exists.`;
  if (status === "implementation-ready") return `${route.title} has evidence ready for implementation work, but destructive execution is still hidden.`;
  const first = blockers[0];
  return first ? `${route.title}: ${first.detail}` : `${route.title} is waiting for implementation evidence.`;
}

function buildRealExecutorCapsuleSteps(status, route, blockers = []) {
  if (!route) {
    return ["Select a first-safe cleanup route.", "Generate its executor manifest.", "Keep real execution hidden."];
  }
  if (status === "implementation-ready") {
    return [
      `Implement ${route.title} in a dedicated Tauri command.`,
      "Reject every route outside this capsule at runtime.",
      "Run disposable Windows fixture validation before exposing the feature flag."
    ];
  }
  if (status === "execution-available") {
    return ["Show destructive-action confirmation.", "Run only this capsule route.", "Write a ledger and require immediate native rescan."];
  }
  const blockerSteps = blockers.slice(0, 4).map((blocker) => `${blocker.label}: ${blocker.detail}`);
  return blockerSteps.length
    ? blockerSteps
    : [`Keep ${route.title} in dry-run mode until implementation and validation evidence are complete.`];
}

function getWriteBoundaryProbeReason(status) {
  if (status === "not-run") return "Probe has not been run for the current plan.";
  if (status === "native-unavailable") return "Desktop native runtime or rejecting write command is unavailable.";
  if (status === "unsafe-signal") return "Probe returned a signal that would be unsafe in the current build.";
  if (status === "error") return "Probe failed before rejection evidence could be recorded.";
  if (status === "running") return "Probe is running against the native rejecting boundary.";
  if (status === "rejected") return "Native boundary rejected the request and reported zero reclaimed bytes.";
  return "Probe result did not provide enough rejection evidence.";
}

function getWriteBoundaryProbePrimary(status, { selectedRows = [], entries = [], rejected = 0, bytes = 0 } = {}) {
  if (status === "rejected") return `Rejection evidence recorded for ${rejected} write-boundary entr${rejected === 1 ? "y" : "ies"} with zero bytes reclaimed.`;
  if (status === "native-unavailable") return "Run the Tauri desktop shell to probe the rejecting native write boundary.";
  if (status === "unsafe-signal") return `Write boundary returned accepted/destructive/non-zero signals; bytes=${formatBytes(bytes)}.`;
  if (status === "running") return "Native write boundary probe is running.";
  if (status === "error") return "Native write boundary probe failed.";
  if (!selectedRows.length) return "Select a first-safe executor capsule before probing the write boundary.";
  if (!entries.length) return "Probe the write boundary to collect rejection evidence for the selected capsule.";
  return "Write boundary result is inconclusive.";
}

function buildWriteBoundaryProbeSteps(status) {
  if (status === "rejected") {
    return [
      "Keep real cleanup disabled.",
      "Attach rejection evidence to Windows validation notes.",
      "Do not count write-boundary probe entries as recovered space."
    ];
  }
  if (status === "unsafe-signal") {
    return [
      "Stop release review for this build.",
      "Inspect the native execute_cleanup_plan implementation.",
      "Keep destructive UI hidden until the boundary rejects again."
    ];
  }
  if (status === "native-unavailable") {
    return [
      "Run npm run native:dev in the desktop shell.",
      "Confirm runtime capabilities show the rejecting write command.",
      "Probe again after selecting a first-safe capsule."
    ];
  }
  return [
    "Select a first-safe executor capsule.",
    "Run the native rejecting write-boundary probe.",
    "Verify accepted=false, destructiveCommands=false, and zero bytes."
  ];
}

function questionTone(lane) {
  if (lane === "discovery" || lane === "planning" || lane === "execution") return "review";
  if (lane === "approval" || lane === "intake" || lane === "review" || lane === "validation" || lane === "rollback") return "review";
  if (lane === "advanced" || lane === "strategy") return "advanced";
  if (lane === "verification" || lane === "consent") return "safe";
  return "outline";
}

function dedupeBlockers(blockers = []) {
  const seen = new Set();
  return blockers.filter((blocker) => {
    if (!blocker?.id || seen.has(blocker.id)) return false;
    seen.add(blocker.id);
    return true;
  });
}

function scanCoverageNextStep(action, evidence) {
  if (evidence === "measured") return "Measured by native scanner; keep normal approval gates.";
  if (evidence === "limited") return "Measured with traversal limits; review scanner warnings before trusting the size.";
  if (evidence === "missing") return "No matching root was found in the native scan; do not substitute demo size.";
  if (evidence === "unsupported") return "Needs a dedicated detector or app-native inventory before execution.";
  if (evidence === "protected") return "Protected path policy blocks traversal and planning.";
  if (action.gate === "blocked" || action.gate === "advisory") return "Policy-only row; keep visible but non-executable.";
  return "Still a demo estimate; run the Windows desktop scanner before real-data decisions.";
}

function scanCoverageSteps(status, unverifiedRows) {
  if (status === "native-covered") {
    return ["Review approval gates.", "Keep real deletion locked until validation evidence is complete.", "Export the scan and dry-run report."];
  }
  if (status === "demo-only") {
    return ["Start the Tauri desktop shell.", "Run a native read-only scan.", "Treat all current sizes as demo estimates."];
  }
  if (status === "native-unavailable" || status === "no-measured-roots") {
    return ["Confirm the app is running inside the desktop shell.", "Check protected paths and scanner permissions.", "Use demo data only for presentation, not real cleanup decisions."];
  }
  const topRows = unverifiedRows.slice(0, 3).map((row) => `${row.title}: ${row.nextStep}`);
  return topRows.length ? topRows : ["Resolve scanner coverage gaps before trusting the plan."];
}

function manualStrategyChecksForOption(option) {
  const common = [
    {
      key: "evidence",
      title: "Evidence captured",
      detail: option.evidence || "Capture evidence before acting manually."
    },
    {
      key: "guardrails",
      title: "Guardrails reviewed",
      detail: option.guardrails?.join(", ") || "Review guardrails before manual action."
    }
  ];

  if (option.id === "review-custom-roots") {
    return [
      {
        key: "folder-owner-reviewed",
        title: "Folder owner reviewed",
        detail: "Confirm what app, project, or workflow owns each custom root before moving or deleting anything."
      },
      {
        key: "manual-disposition",
        title: "Manual disposition chosen",
        detail: "Each custom root is marked keep, archive, move through the owning app, or inspect later."
      },
      {
        key: "no-executor-route",
        title: "No executor route",
        detail: "Custom root findings remain manual evidence and cannot be added to automated cleanup."
      },
      ...common
    ];
  }

  if (option.id === "archive-large-files") {
    return [
      {
        key: "per-file-decisions",
        title: "Per-file decisions complete",
        detail: "Every large personal file is marked keep, move, archive, or remove outside any bulk-folder action."
      },
      {
        key: "archive-destination",
        title: "Archive destination chosen",
        detail: "External or secondary drive destination has enough free space and is user-approved."
      },
      {
        key: "no-bulk-delete",
        title: "No bulk deletion",
        detail: "Manual action avoids deleting broad user folders or unknown personal data."
      },
      ...common
    ];
  }

  if (option.id === "uninstall-apps-manually") {
    return [
      {
        key: "settings-or-vendor",
        title: "Uninstall path is official",
        detail: "Use Windows Settings or the vendor uninstaller; do not use registry cleaners or driver updaters."
      },
      {
        key: "publisher-reviewed",
        title: "Publisher and last-use reviewed",
        detail: "Confirm app identity, publisher, approximate size, and whether the user still needs it."
      },
      {
        key: "no-automated-uninstall",
        title: "No automated uninstall",
        detail: "SpaceGuard tracks the decision only and does not invoke uninstall commands."
      },
      ...common
    ];
  }

  if (option.id === "move-game-project-libraries") {
    return [
      {
        key: "destination-ready",
        title: "Destination drive ready",
        detail: "Destination has enough free space and a rollback path if the move fails."
      },
      {
        key: "app-native-move",
        title: "App-native move path",
        detail: "Use launcher, package-manager, or project-owned move workflows when available."
      },
      {
        key: "saves-and-source-protected",
        title: "Saves and source protected",
        detail: "Game saves, active project source, and client work are excluded from the manual move."
      },
      ...common
    ];
  }

  if (option.id === "offload-downloads") {
    return [
      {
        key: "download-item-decisions",
        title: "Download items reviewed",
        detail: "Old installers and archives are reviewed item-by-item before offload or removal."
      },
      {
        key: "archive-location",
        title: "Archive location recorded",
        detail: "Archive destination is known, reachable, and not the same full C: drive."
      },
      {
        key: "recent-installers-kept",
        title: "Recent installers kept",
        detail: "Recent, unknown, or important installers stay in place until the user confirms."
      },
      ...common
    ];
  }

  if (option.id === "partition-or-drive-plan") {
    return [
      {
        key: "full-backup",
        title: "Full backup confirmed",
        detail: "User has a current backup before any disk, partition, or drive replacement work."
      },
      {
        key: "recovery-keys",
        title: "Recovery keys available",
        detail: "BitLocker or device recovery keys are available before storage changes."
      },
      {
        key: "manual-disk-operator",
        title: "Manual disk operator",
        detail: "SpaceGuard provides guidance only; no partition resize, format, or disk write is automated."
      },
      ...common
    ];
  }

  return [
    {
      key: "manual-owner",
      title: "Manual owner confirmed",
      detail: "The user owns this manual action and understands SpaceGuard will not execute it."
    },
    ...common
  ];
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isLedgerRunRecord(record) {
  return Boolean(
    record &&
      typeof record === "object" &&
      record.schemaVersion === "spaceguard-ledger-run/v1" &&
      typeof record.id === "string" &&
      typeof record.planId === "string" &&
      Array.isArray(record.entries)
  );
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildVmChecklist(vmScenario, checkRows) {
  const requiredChecks = vmScenario.mustPass
    .map((id) => checkRows.find((row) => row.id === id))
    .filter(Boolean);

  return [
    "Restore the disposable VM snapshot before seeding fixtures.",
    "Run the native desktop shell and capture runtime capability output.",
    "Run a read-only scan and export the dry-run report before any executor validation.",
    ...requiredChecks.map((check) => `Capture ${check.label}: ${check.evidence}`),
    "Run the same scan again after the dry-run preview and compare the ledger with measured roots.",
    "Reset or discard the VM snapshot after collecting evidence."
  ];
}

function reviewNextStep(action, status, gate, evidence, reviewSummary = null) {
  if (status === "protected") return "Protected by user; never include until the protected path is removed.";
  if (gate === "intake") return "Allow admin/system actions in intake before this route can enter the dry-run plan.";
  if (status === "locked") return action.gate === "advisory" ? "Explain manually; do not automate." : "Policy-blocked; keep visible but non-executable.";
  if (evidence === "missing") return "No matching root was measured in the current scan.";
  if (evidence === "unsupported") return "Needs a dedicated detector before the app can size it.";
  if (gate === "review" && reviewSummary?.undecidedCount > 0) return `Resolve ${reviewSummary.undecidedCount} remaining item decision(s).`;
  if (gate === "review" && reviewSummary?.removeCount === 0) return "Choose Remove for executor cleanup, or Move/Archive/Keep for manual-only recovery.";
  if (!gate && reviewSummary?.removeCount === 0 && (reviewSummary?.moveCount > 0 || reviewSummary?.archiveCount > 0)) return "Manual move/archive decisions are tracked; no executor cleanup bytes are selected.";
  if (gate) return gateInstruction(action, gate);
  if (status === "ready") return "Ready for preflight after all other selected gates resolve.";
  return "Available if the user needs more recovery.";
}

function normalizeMatchText(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("%userprofile%", "c:\\users\\demo")
    .replaceAll("%localappdata%", "c:\\users\\demo\\appdata\\local")
    .replaceAll("%temp%", "temp")
    .replaceAll("*", "")
    .replaceAll("/", "\\")
    .replace(/\s+/g, " ")
    .trim();
}

function pathTailMatch(actionPath, protectedPath) {
  const tails = protectedPath.split("\\").filter(Boolean).slice(-2);
  if (tails.length === 0) return false;
  return tails.every((part) => actionPath.includes(part));
}

function pathMatchesProtected(path, protectedPaths = []) {
  const candidate = normalizeMatchText(path);
  return protectedPaths.some((protectedPath) => {
    const protectedText = normalizeMatchText(protectedPath);
    return protectedText && (candidate.includes(protectedText) || protectedText.includes(candidate) || pathTailMatch(candidate, protectedText));
  });
}
