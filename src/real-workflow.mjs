export const MB = 1024 ** 2;
export const RESCAN_TOLERANCE_BYTES = 64 * MB;
const DEFAULT_OPENAI_MODEL = "gpt-5.2";
const DEFAULT_OPENAI_REASONING_EFFORT = "low";
const EXECUTOR_ENV_VARS = [
  "SPACEGUARD_ENABLE_TEMP_EXECUTOR",
  "SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR",
  "SPACEGUARD_ENABLE_DOWNLOADS_EXECUTOR",
  "SPACEGUARD_ENABLE_LARGE_FILE_ARCHIVE_EXECUTOR",
  "SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR",
  "SPACEGUARD_ENABLE_USER_CACHE_EXECUTOR",
  "SPACEGUARD_ENABLE_ANDROID_CACHE_EXECUTOR",
  "SPACEGUARD_ENABLE_SHADER_CACHE_EXECUTOR",
  "SPACEGUARD_ENABLE_PIP_CACHE_EXECUTOR",
  "SPACEGUARD_ENABLE_TOOL_NATIVE_PRUNE_EXECUTORS",
  "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR",
  "SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR",
  "SPACEGUARD_ENABLE_RECYCLE_BIN_EXECUTOR",
  "SPACEGUARD_ENABLE_BROWSER_CACHE_EXECUTOR"
];

export function parseWorkflowTimestamp(value = "") {
  const text = String(value || "").trim();
  if (!text) return NaN;
  const unixMsMatch = text.match(/^unix-ms:(\d+)$/i);
  if (unixMsMatch) {
    return Number(unixMsMatch[1]);
  }
  const unixMatch = text.match(/^unix:(\d+)$/i);
  if (unixMatch) {
    return Number(unixMatch[1]) * 1000;
  }
  return Date.parse(text);
}

export function buildWorkflowAgentTargetId(candidate = {}, index = 0) {
  const base = candidate.routeInput || candidate.actionType || candidate.route || candidate.recipeId || candidate.id || "cleanup-target";
  const position = Number.isFinite(Number(index)) ? Number(index) + 1 : 1;
  return `${slugifyWorkflowId(base)}-${position}`;
}

export function resolveWorkflowAgentBrokerCandidate(row = {}, candidates = []) {
  const targetId = String(row.targetId || row.target_id || row.id || "").trim();
  if (!targetId) return null;
  const route = String(row.executorRoute || row.executor_route || row.recommendedRoute || row.recommended_route || row.route || row.route_id || "").trim();
  const actionType = String(row.actionType || row.action_type || "").trim();
  const requiresActionMatch = actionType.startsWith("run-") && actionType.endsWith("-executor");
  const rows = Array.isArray(candidates) ? candidates : [];

  return rows.find((candidate, index) => {
    const candidateIds = [
      candidate.id,
      candidate.targetId,
      candidate.target_id,
      buildWorkflowAgentTargetId(candidate, index)
    ].map((value) => String(value || "").trim());
    const targetMatches = candidateIds.includes(targetId);
    const routeMatches = !route || route === candidate.route || route === candidate.routeInput;
    const actionMatches = !requiresActionMatch || actionType === candidate.actionType;
    return targetMatches && routeMatches && actionMatches;
  }) || null;
}

export function resolveRuntimeRouteInput({ routes = [], runtime = null, fallbackRouteInput = "npm-cache" } = {}) {
  const routeRows = Array.isArray(routes) ? routes : [];
  const fallback = String(fallbackRouteInput || routeRows[0]?.routeInput || "npm-cache");
  const enabledEnvVars = Array.isArray(runtime?.enabledScopedExecutorFlags)
    ? runtime.enabledScopedExecutorFlags.map((flag) => String(flag || "").trim()).filter(Boolean)
    : [];
  if (enabledEnvVars.length === 1) {
    const enabledRoute = routeRows.find((route) => route.envVar === enabledEnvVars[0]);
    if (enabledRoute?.routeInput) return enabledRoute.routeInput;
  }
  if (enabledEnvVars.length > 1) return fallback;

  const enabledByFlagKey = routeRows.filter((route) => route.flagKey && runtime?.executorFlags?.[route.flagKey]);
  if (enabledByFlagKey.length === 1) return enabledByFlagKey[0].routeInput || fallback;
  return fallback;
}

function slugifyWorkflowId(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "cleanup-target";
}

export function buildRouteSetupChecklist({ route = {}, runtime = {} } = {}) {
  const routeInput = route.routeInput || route.route || "";
  const envVar = route.envVar || "";
  const flagKey = route.flagKey || envVarToFlagKey(envVar);
  const enabledFlags = Array.isArray(runtime?.enabledScopedExecutorFlags)
    ? runtime.enabledScopedExecutorFlags
    : [];
  const routeFlagEnabled = Boolean(runtime?.executorFlags?.[flagKey] || enabledFlags.includes(envVar));
  const multipleFlags = runtime?.executorScopeStatus === "multiple-scoped-flags";
  const envBlock = buildRouteEnvBlock({ route });
  const runbook = buildWindowsRealTestRunbook({ route, envBlock });

  const steps = [
    setupStep({
      id: "env-block",
      label: "Arm selected cleanup type",
      status: routeFlagEnabled && !multipleFlags ? "passed" : "instruction",
      command: `npm run route:arm -- --route ${routeInput}`,
      detail: routeFlagEnabled && !multipleFlags
        ? "The selected route flag is active and no competing route flag is detected."
        : "Run the arm command, set OPENAI_API_KEY if needed, then restart the desktop app."
    }),
    setupStep({
      id: "native-desktop",
      label: "Start desktop app",
      status: runtime?.windows ? "passed" : "instruction",
      command: `npm run windows:dev -- --route ${routeInput}`,
      detail: runtime?.windows ? "Windows desktop runtime is connected." : "Run the guarded Windows desktop launcher on the Windows machine."
    }),
    setupStep({
      id: "single-route-scope",
      label: "Keep one route armed",
      status: multipleFlags ? "blocked" : "passed",
      command: "Disable every other SPACEGUARD_ENABLE_*_EXECUTOR flag",
      detail: multipleFlags
        ? `Enabled flags: ${enabledFlags.join(", ") || "multiple scoped flags"}.`
        : "No competing scoped executor flags detected."
    }),
    setupStep({
      id: "route-flag",
      label: "Enable selected route",
      status: routeFlagEnabled ? "passed" : "blocked",
      command: `${envVar}=1`,
      detail: routeFlagEnabled ? `${envVar}=1 is active.` : `Run npm run route:arm -- --route ${routeInput} and restart the desktop app.`
    }),
    setupStep({
      id: "route-setup",
      label: "Create route setup packet",
      status: "instruction",
      command: `npm run setup:route -- --route ${routeInput}`,
      detail: "Confirms route metadata, selected env flag, and one-route launch status."
    }),
    setupStep({
      id: "openai-smoke",
      label: "Check OpenAI advisor",
      status: runtime?.openAiAdvisorConfigured ? "passed" : "instruction",
      command: `npm run openai:smoke -- --route ${routeInput}`,
      detail: runtime?.openAiAdvisorConfigured
        ? "OpenAI key is configured for advisory checks."
        : "Set OPENAI_API_KEY if you want advisory reasoning during the real workflow."
    }),
    setupStep({
      id: "app-workflow",
      label: "Run guarded app workflow",
      status: "instruction",
      command: "Scan -> select route -> consent -> execute -> rescan -> export proof",
      detail: "The app remains the only place where user consent and native execution are joined."
    }),
    setupStep({
      id: "v1-proof",
      label: "Capture proof packet",
      status: "instruction",
      command: "Export proof in the app, then run npm run validate:workflow-proof -- --file spaceguard-real-workflow-proof.md",
      detail: "The desktop app captures native execution, post-run rescan, and proof export for the selected real route."
    })
  ];
  const blockers = steps.filter((step) => step.status === "blocked");

  return {
    schemaVersion: "spaceguard-route-setup-checklist/v1",
    routeInput,
    route: route.route || "",
    label: route.label || routeInput,
    envVar,
    envBlock,
    runbook,
    ready: blockers.length === 0,
    steps,
    blockers
  };
}

export function buildWindowsRealTestRunbook({ route = {}, envBlock = buildRouteEnvBlock({ route }) } = {}) {
  const routeInput = route.routeInput || route.route || "";
  const selectedEnvVar = route.envVar || "";
  const commands = [
    runbookCommand({
      id: "install",
      label: "Install dependencies",
      command: "npm install",
      expected: "npm dependencies are installed in the project folder."
    }),
    runbookCommand({
      id: "arm-route",
      label: "Arm one cleanup type",
      command: `npm run route:arm -- --route ${routeInput}`,
      expected: `.env exists, ${selectedEnvVar}=1 is enabled, and every other cleanup route flag is set to 0.`
    }),
    runbookCommand({
      id: "edit-env",
      label: "Set OpenAI key",
      command: "notepad .env",
      expected: "OPENAI_API_KEY is set if you want live advisory reasoning."
    }),
    runbookCommand({
      id: "setup-doctor",
      label: "Check setup",
      command: "npm run setup:doctor",
      expected: "Status is one-route-ready after the selected flag is enabled."
    }),
    runbookCommand({
      id: "setup-route",
      label: "Check selected route",
      command: `npm run setup:route -- --route ${routeInput}`,
      expected: "Route packet names the same env flag, request mode, and panel as the app."
    }),
    runbookCommand({
      id: "openai-contract-smoke",
      label: "Check local route contract",
      command: `npm run openai:smoke -- --local-contract --route ${routeInput}`,
      expected: "Validation prints broker-ready without contacting OpenAI."
    }),
    runbookCommand({
      id: "openai-live-smoke",
      label: "Check live OpenAI advisor",
      command: `npm run openai:smoke -- --route ${routeInput}`,
      expected: "With OPENAI_API_KEY set, OpenAI returns the selected route recommendation through the broker."
    }),
    runbookCommand({
      id: "launch-app",
      label: "Launch desktop app",
      command: `npm run windows:dev -- --route ${routeInput}`,
      expected: "The guarded launcher opens the app with one route armed; browser-only setup state is not used."
    }),
    runbookCommand({
      id: "verify-proof",
      label: "Audit exported proof",
      command: "npm run validate:workflow-proof -- --file spaceguard-real-workflow-proof.md",
      expected: "Optional audit matches the in-app verifier and prints accepted before testing another route."
    }),
    runbookCommand({
      id: "support-bundle",
      label: "Capture support bundle",
      command: "npm run support:bundle",
      expected: "spaceguard-support-bundle.md summarizes setup, proof artifacts, verifier status, and next step."
    })
  ];
  const appSteps = [
    runbookStep("run-scan", "Run real scan", "Use the desktop app to scan C: through the native bridge."),
    runbookStep("select-target", "Select a ready cleanup target", "Pick one measured row for the selected route."),
    runbookStep("consent", "Review and consent", "Check the consent box and type the exact confirmation phrase."),
    runbookStep("execute-route", "Execute selected cleanup", "Run the scoped native executor from the app, not from a shell command."),
    runbookStep("post-run-rescan", "Run post-run rescan", "Capture the newer native scan and compare the selected target."),
    runbookStep("export-proof", "Export proof", "Export selected-route proof, real workflow proof, and spaceguard-workflow-proof-check.json from the app."),
    runbookStep("support-bundle", "Capture support bundle", "Run npm run support:bundle after proof export to collect the proof handoff summary.")
  ];
  const guardrails = [
    runbookGuardrail("one-route", "Keep exactly one route flag enabled before launch."),
    runbookGuardrail("desktop-only", "Do not scan or clean from a normal browser session."),
    runbookGuardrail("user-consent", "Do not execute until the app shows current-plan consent and route readiness."),
    runbookGuardrail("manual-only", "Do not delete installed app folders, custom roots, system files, WSL disks, or broad inventory rows directly."),
    runbookGuardrail("proof-before-next-route", "Do not enable another route until the in-app workflow proof verifier accepts the export.")
  ];
  const content = buildWindowsRealTestRunbookMarkdown({
    routeInput,
    selectedEnvVar,
    envBlock,
    commands,
    appSteps,
    guardrails
  });

  return {
    schemaVersion: "spaceguard-windows-real-test-runbook/v1",
    routeInput,
    route: route.route || "",
    selectedEnvVar,
    commands,
    appSteps,
    guardrails,
    content
  };
}

function runbookCommand({ id, label, command, expected }) {
  return { id, label, command, expected };
}

function runbookStep(id, label, detail) {
  return { id, label, detail };
}

function runbookGuardrail(id, detail) {
  return { id, detail };
}

function buildWindowsRealTestRunbookMarkdown({ routeInput, selectedEnvVar, envBlock, commands, appSteps, guardrails }) {
  return [
    `# Windows real-route test runbook: ${routeInput}`,
    "",
    "## Selected .env",
    "",
    "```dotenv",
    envBlock.content,
    "```",
    "",
    "## Terminal commands",
    "",
    ...commands.flatMap((row, index) => [
      `${index + 1}. ${row.label}`,
      "",
      "```powershell",
      row.command,
      "```",
      "",
      `Expected: ${row.expected}`,
      ""
    ]),
    "## App workflow",
    "",
    ...appSteps.map((row, index) => `${index + 1}. ${row.label}: ${row.detail}`),
    "",
    "## Guardrails",
    "",
    ...guardrails.map((row) => `- ${row.detail}`)
  ].join("\n");
}

export function buildRouteEnvBlock({ route = {} } = {}) {
  const routeInput = route.routeInput || route.route || "";
  const selectedEnvVar = route.envVar || "";
  const executorFlagLines = EXECUTOR_ENV_VARS.map((envVar) => `${envVar}=${envVar === selectedEnvVar ? "1" : "0"}`);
  const lines = [
    `# SpaceGuard selected route: ${routeInput}`,
    "OPENAI_API_KEY=sk-...",
    `OPENAI_MODEL=${DEFAULT_OPENAI_MODEL}`,
    `OPENAI_REASONING_EFFORT=${DEFAULT_OPENAI_REASONING_EFFORT}`,
    "",
    ...executorFlagLines
  ];

  return {
    schemaVersion: "spaceguard-route-env-block/v1",
    fileName: ".env",
    routeInput,
    route: route.route || "",
    selectedEnvVar,
    executorFlagLines,
    content: lines.join("\n")
  };
}

export function buildManualFindingGuidance(finding = {}) {
  const recipeId = String(finding.recipeId || "");
  const path = String(finding.path || "");
  if (recipeId === "installed-app-footprints") {
    return manualGuidance({
      kind: "installed-app-review",
      primaryAction: "Review in Windows Settings before uninstalling.",
      command: "ms-settings:appsfeatures",
      confidence: "review-required",
      blockedActions: [
        "Do not delete application folders directly.",
        "Do not remove Program Files, ProgramData, or AppData folders as a cleanup shortcut.",
        "Do not treat size alone as unused-app evidence."
      ]
    });
  }
  if (recipeId === "large-user-files") {
    return manualGuidance({
      kind: "reviewed-file-archive",
      primaryAction: "Select individual large-file rows in the cleanup queue or archive manually.",
      command: path ? `explorer.exe /select,"${path}"` : "Open File Explorer",
      confidence: "review-required",
      blockedActions: [
        "Do not bulk delete folders from this summary row.",
        "Do not archive without confirming the exact selected file and destination.",
        "Do not move files from protected profile folders through this manual card."
      ]
    });
  }
  if (recipeId === "docker-volumes") {
    return manualGuidance({
      kind: "tool-owned-data-review",
      primaryAction: "Review Docker volumes in Docker Desktop or docker volume commands.",
      command: "docker volume ls",
      confidence: "restricted",
      blockedActions: [
        "No SpaceGuard executor deletes Docker volumes.",
        "Do not delete Docker data-root folders directly.",
        "Do not run broad docker system prune from this app."
      ]
    });
  }
  if (recipeId === "windows-old") {
    return manualGuidance({
      kind: "windows-servicing-review",
      primaryAction: "Use Windows cleanup tools to remove a previous Windows installation.",
      command: "cleanmgr.exe",
      confidence: "restricted",
      blockedActions: [
        "Do not delete Windows.old directly from File Explorer.",
        "Do not remove the current Windows folder or servicing store.",
        "Do not run this cleanup until rollback needs are understood."
      ]
    });
  }
  if (recipeId === "hibernation") {
    return manualGuidance({
      kind: "advanced-system-setting",
      primaryAction: "Review whether disabling hibernation is acceptable before reclaiming hiberfil.sys.",
      command: "Run elevated PowerShell: powercfg /hibernate off",
      confidence: "advanced",
      blockedActions: [
        "Do not delete hiberfil.sys manually.",
        "Do not disable hibernation if the user relies on Hibernate or Fast Startup.",
        "SpaceGuard does not run elevated powercfg commands."
      ]
    });
  }
  if (recipeId === "pagefile") {
    return manualGuidance({
      kind: "advanced-system-setting",
      primaryAction: "Review virtual memory settings instead of deleting pagefile.sys.",
      command: "SystemPropertiesAdvanced.exe",
      confidence: "advanced",
      blockedActions: [
        "Do not delete pagefile.sys manually.",
        "Do not disable paging without checking RAM, crash dump, and workload needs.",
        "SpaceGuard does not modify virtual memory settings."
      ]
    });
  }
  if (recipeId === "wsl-vhdx") {
    return manualGuidance({
      kind: "tool-owned-data-review",
      primaryAction: "Shut down WSL and compact the distro virtual disk only after backup/review.",
      command: path ? `wsl --shutdown; review ${path}` : "wsl --shutdown",
      confidence: "advanced",
      blockedActions: [
        "Do not delete ext4.vhdx directly unless removing the distro intentionally.",
        "Do not compact while the distro is running.",
        "SpaceGuard does not run WSL compaction commands."
      ]
    });
  }
  if (recipeId.startsWith("custom-root-") || recipeId.startsWith("drive-")) {
    return manualGuidance({
      kind: "manual-filesystem-review",
      primaryAction: "Review the measured location in File Explorer before deciding.",
      command: path ? `explorer.exe /select,"${path}"` : "Open File Explorer",
      confidence: "manual-only",
      blockedActions: [
        "No SpaceGuard executor is mapped to this finding.",
        "Do not delete parent folders from a size summary.",
        "Do not bypass the cleanup queue consent flow."
      ]
    });
  }

  return manualGuidance({
    kind: "manual-review",
    primaryAction: "Review this finding manually before taking action.",
    command: path ? `explorer.exe /select,"${path}"` : "Open File Explorer",
    confidence: "manual-only",
    blockedActions: [
      "No SpaceGuard executor is mapped to this finding.",
      "Do not delete files without inspecting the exact target.",
      "Do not treat this advisory row as cleanup approval."
    ]
  });
}

export function buildManualFindingReviewRows(finding = {}) {
  const recipeId = String(finding.recipeId || "");
  const rows = Array.isArray(finding.items)
    ? finding.items
        .filter((item) => item && (item.name || item.path))
        .slice(0, 6)
        .map((item) => buildManualReviewRow(recipeId, item))
    : [];
  return {
    schemaVersion: "spaceguard-manual-review-rows/v1",
    recipeId,
    rows
  };
}

function buildManualReviewRow(recipeId, item = {}) {
  const recommendation = String(item.recommendation || "review").toLowerCase();
  const signals = normalizeReviewSignals(item.signals);
  const installedApp = recipeId === "installed-app-footprints";
  const action = installedApp && recommendation === "keep"
    ? "keep-installed"
    : installedApp
      ? "review-uninstall"
      : "review-item";
  const actionLabel = action === "keep-installed"
    ? "Keep installed"
    : action === "review-uninstall"
      ? "Review uninstall"
      : "Review item";
  return {
    id: String(item.id || item.path || item.name || ""),
    name: String(item.name || item.path || "Review item"),
    path: String(item.path || ""),
    bytes: Number(item.bytes || 0),
    recommendation,
    reason: String(item.reason || ""),
    action,
    actionLabel,
    blockedAction: installedApp
      ? "Do not delete this folder directly."
      : "Do not act on this row without selecting the exact target.",
    signals
  };
}

function normalizeReviewSignals(signals = []) {
  return Array.isArray(signals)
    ? signals
        .map((signal) => ({
          label: String(signal?.label || "").trim(),
          value: String(signal?.value || "").trim(),
          tone: String(signal?.tone || "outline").trim() || "outline"
        }))
        .filter((signal) => signal.label || signal.value)
        .slice(0, 6)
    : [];
}

function manualGuidance({ kind, primaryAction, command, confidence, blockedActions }) {
  return {
    schemaVersion: "spaceguard-manual-finding-guidance/v1",
    kind,
    primaryAction,
    command,
    confidence,
    blockedActions
  };
}

function setupStep({ id, label, status, command, detail }) {
  return {
    id,
    label,
    status,
    passed: status === "passed" || status === "not-required",
    command,
    detail
  };
}

function envVarToFlagKey(envVar = "") {
  const map = {
    SPACEGUARD_ENABLE_TEMP_EXECUTOR: "tempCleanupExecutor",
    SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR: "projectDependencyExecutor",
    SPACEGUARD_ENABLE_DOWNLOADS_EXECUTOR: "downloadsCleanupExecutor",
    SPACEGUARD_ENABLE_LARGE_FILE_ARCHIVE_EXECUTOR: "largeFileArchiveExecutor",
    SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR: "gradleCacheExecutor",
    SPACEGUARD_ENABLE_USER_CACHE_EXECUTOR: "userCacheExecutor",
    SPACEGUARD_ENABLE_ANDROID_CACHE_EXECUTOR: "androidCacheExecutor",
    SPACEGUARD_ENABLE_SHADER_CACHE_EXECUTOR: "shaderCacheExecutor",
    SPACEGUARD_ENABLE_PIP_CACHE_EXECUTOR: "pipCacheExecutor",
    SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR: "npmCacheExecutor",
    SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR: "pnpmStoreExecutor",
    SPACEGUARD_ENABLE_RECYCLE_BIN_EXECUTOR: "recycleBinExecutor",
    SPACEGUARD_ENABLE_BROWSER_CACHE_EXECUTOR: "browserCacheExecutor",
    SPACEGUARD_ENABLE_TOOL_NATIVE_PRUNE_EXECUTORS: "toolNativePruneExecutors"
  };
  return map[envVar] || "";
}

export function buildRouteReadiness({ recipe = {}, finding = {}, runtime = {}, selectedRouteInput = "" } = {}) {
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
  const findingStatus = finding.status || "unknown";
  const selectedRoute = String(selectedRouteInput || "").trim();
  const selectedRouteMatches = !selectedRoute || !recipe.routeInput || selectedRoute === recipe.routeInput;

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
      id: "selected-route-setup",
      label: "Selected route setup",
      passed: selectedRouteMatches,
      detail: selectedRouteMatches
        ? selectedRoute
          ? `${selectedRoute} is selected in the route setup wizard.`
          : "No route setup selection was provided by this caller."
        : `Select ${recipe.routeInput} in the route setup wizard before execution.`
    }),
    guardrailRow({
      id: "real-run-authority",
      label: "Real-run authority",
      passed: Boolean(runtime?.realRunEnabled && runtime?.destructiveCommands),
      detail: runtime?.realRunEnabled && runtime?.destructiveCommands
        ? "Runtime allows exactly one scoped mutating executor."
        : "Runtime does not report real-run authority for the single selected route."
    }),
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

export function buildExecutionPrerequisites({
  candidate = null,
  archiveDestination = "",
  permanentRemovalConfirmed = false
} = {}) {
  const rows = [];
  if (!candidate) {
    rows.push(guardrailRow({
      id: "selected-target",
      label: "Selected target",
      passed: false,
      detail: "Select one cleanup target before execution."
    }));
  }

  if (candidate?.requiresArchiveDestination || candidate?.route === "item-review-large-files") {
    const destination = String(archiveDestination || "").trim();
    const targetPath = String(candidate?.targetPath || candidate?.reviewTarget?.path || "");
    const destinationDrive = getWindowsDrive(destination);
    const sourceDrive = getWindowsDrive(targetPath);
    const destinationPresent = Boolean(destination);
    const destinationAbsolute = isAbsoluteWindowsPath(destination);
    const differentDrive = Boolean(destinationAbsolute && destinationDrive && sourceDrive && destinationDrive !== sourceDrive);
    const protectedDestination = isProtectedArchiveDestination(destination);

    rows.push(guardrailRow({
      id: "archive-destination",
      label: "Archive destination",
      passed: destinationPresent,
      detail: destinationPresent ? `Archive destination set to ${destination}.` : "Choose an archive destination before running this route."
    }));
    rows.push(guardrailRow({
      id: "archive-destination-absolute",
      label: "Absolute destination path",
      passed: destinationAbsolute,
      detail: destinationAbsolute ? "Archive destination is an absolute Windows path." : "Use an absolute Windows path such as D:\\SpaceGuardArchive."
    }));
    rows.push(guardrailRow({
      id: "archive-destination-drive",
      label: "Different destination drive",
      passed: differentDrive,
      detail: differentDrive
        ? "Archive destination is on a different drive from the selected file."
        : "Archive destination must be on a different drive from the selected file."
    }));
    rows.push(guardrailRow({
      id: "archive-destination-protected",
      label: "Protected destination",
      passed: destinationPresent && destinationAbsolute && !protectedDestination,
      detail: protectedDestination
        ? "Archive destination cannot be under Windows, Program Files, ProgramData, AppData, Temp, or Recycle Bin roots."
        : "Archive destination is outside protected system and app-data roots."
    }));
  }

  if (candidate?.requiresPermanentConfirmation || candidate?.route === "shell-recycle-bin") {
    rows.push(guardrailRow({
      id: "permanent-removal-confirmation",
      label: "Permanent removal confirmation",
      passed: Boolean(permanentRemovalConfirmed),
      detail: permanentRemovalConfirmed
        ? "Permanent Recycle Bin removal was explicitly confirmed."
        : "Confirm permanent Recycle Bin removal before executing this route."
    }));
  }

  const blockers = rows.filter((row) => !row.passed);
  return {
    schemaVersion: "spaceguard-execution-prerequisites/v1",
    ready: blockers.length === 0,
    rows,
    blockers,
    primary: rows.length
      ? blockers.length
        ? `Execution is blocked by ${blockers.length} route-specific prerequisite(s).`
        : "Route-specific execution prerequisites are satisfied."
      : "No additional route-specific execution prerequisites."
  };
}

export function buildExecutionGate({
  candidate = null,
  consentChecked = false,
  confirmationText = "",
  expectedConfirmation = "",
  executionPrerequisites = { ready: true, blockers: [] },
  scanFingerprint = "",
  executionStatus = "idle",
  workflowLocks = { proofAllowsNextExecutor: true },
  executionRecord = null,
  activeScanGeneratedAt = ""
} = {}) {
  const expected = String(expectedConfirmation || "").trim();
  const actual = String(confirmationText || "").trim();
  const prerequisiteBlockers = Array.isArray(executionPrerequisites?.blockers)
    ? executionPrerequisites.blockers
    : [];
  const acceptedPositiveExecution = Boolean(executionRecord?.accepted && Number(executionRecord?.bytes || 0) > 0);
  const baselineRequired = Boolean(acceptedPositiveExecution && workflowLocks?.proofAllowsNextExecutor !== false);
  const activeScanTime = parseWorkflowTimestamp(activeScanGeneratedAt);
  const executionTime = parseWorkflowTimestamp(executionRecord?.executedAt);
  const baselineCurrent = !baselineRequired || (
    Number.isFinite(activeScanTime) &&
    Number.isFinite(executionTime) &&
    activeScanTime >= executionTime
  );
  const rows = [
    guardrailRow({
      id: "selected-target",
      label: "Selected target",
      passed: Boolean(candidate),
      detail: candidate ? `Selected ${candidate.title || candidate.routeInput || "cleanup target"}.` : "Select one measured cleanup target."
    }),
    guardrailRow({
      id: "route-readiness",
      label: "Route readiness",
      passed: Boolean(candidate?.canExecute),
      detail: candidate?.canExecute ? "Selected target route readiness passed." : candidate?.blockedReason || "Selected target route readiness is blocked."
    }),
    guardrailRow({
      id: "consent-checkbox",
      label: "Explicit consent",
      passed: Boolean(consentChecked),
      detail: consentChecked ? "The operator checked the current-plan consent box." : "Check the current-plan consent box before execution."
    }),
    guardrailRow({
      id: "confirmation-phrase",
      label: "Confirmation phrase",
      passed: Boolean(expected && actual === expected),
      detail: expected && actual === expected ? "Confirmation phrase matches the selected route." : `Type exactly ${expected || "the selected route confirmation phrase"}.`
    }),
    guardrailRow({
      id: "scan-fingerprint",
      label: "Current scan fingerprint",
      passed: Boolean(String(scanFingerprint || "").trim()),
      detail: scanFingerprint ? "Current native scan fingerprint is present." : "Run a current native scan before execution."
    }),
    guardrailRow({
      id: "execution-prerequisites",
      label: "Route-specific prerequisites",
      passed: executionPrerequisites?.ready !== false,
      detail: executionPrerequisites?.ready !== false
        ? "Route-specific execution prerequisites are satisfied."
        : `Resolve ${prerequisiteBlockers.length || 1} route-specific prerequisite blocker(s).`
    }),
    guardrailRow({
      id: "proof-handoff",
      label: "Proof handoff",
      passed: workflowLocks?.proofAllowsNextExecutor !== false,
      detail: workflowLocks?.proofAllowsNextExecutor !== false
        ? "Workflow lock policy allows executor dispatch."
        : "Export proof and capture the support bundle before another executor dispatch."
    }),
    guardrailRow({
      id: "baseline-scan-current",
      label: "Active scan baseline",
      passed: baselineCurrent,
      detail: baselineCurrent
        ? baselineRequired
          ? "Active cleanup queue scan is newer than the accepted execution."
          : "No post-execution baseline refresh is required for this dispatch."
        : "Run a fresh real scan so the cleanup queue uses post-execution evidence before another executor dispatch."
    }),
    guardrailRow({
      id: "executor-not-running",
      label: "Executor not running",
      passed: executionStatus !== "running",
      detail: executionStatus === "running" ? "A native executor is already running." : "No native executor is currently running."
    })
  ];
  const blockers = rows.filter((row) => !row.passed);
  return {
    schemaVersion: "spaceguard-execution-gate/v1",
    ready: blockers.length === 0,
    rows,
    blockers,
    primary: blockers.length
      ? `Execution is blocked by ${blockers.length} dispatch gate(s).`
      : "Execution dispatch gate is ready."
  };
}

export function buildWorkflowGuide({
  nativeConnected = false,
  scan = null,
  scanStatus = "idle",
  candidates = [],
  selectedCandidate = null,
  executionGate = null,
  executionStatus = "idle",
  executionRecord = null,
  postRunProof = null,
  proofReviewed = false,
  workflowProofAccepted = false,
  supportBundleWritten = false,
  canExportProof = false,
  proofExportStatus = "idle"
} = {}) {
  const scanReady = Boolean(scan?.generatedAt);
  const candidateRows = Array.isArray(candidates) ? candidates : [];
  const hasSelectableTargets = candidateRows.length > 0;
  const recommendedTarget = candidateRows.find((candidate) => candidate?.canExecute) || candidateRows[0] || null;
  const targetSelected = Boolean(selectedCandidate);
  const guideTarget = selectedCandidate || recommendedTarget || executionRecord || null;
  const guideTargetPath = guideTarget?.targetPath || guideTarget?.reviewTarget?.path || guideTarget?.sourceFinding?.path || "";
  const executed = Boolean(executionRecord);
  const proofScanCaptured = Boolean(postRunProof?.scanGeneratedAt);
  const proofMatched = postRunProof?.status === "matched";
  const noOpExecution = Boolean(executionRecord?.accepted && Number(executionRecord?.bytes || 0) <= 0);
  const handoffComplete = Boolean(noOpExecution || (workflowProofAccepted && supportBundleWritten));

  let currentStepId = "connect";
  let primaryAction = "Connect Windows desktop app";
  let primaryActionKind = "connect-desktop";
  let actionEnabled = false;
  let primaryDetail = "Start the guarded Tauri desktop shell on the Windows PC before scanning local folders.";

  if (nativeConnected && !scanReady) {
    currentStepId = "scan";
    primaryAction = "Run real scan";
    primaryActionKind = "run-scan";
    actionEnabled = true;
    primaryDetail = "Measure C: through the native read-only scanner before selecting a cleanup target.";
  } else if (nativeConnected && scanReady && !targetSelected && !executed) {
    currentStepId = "select";
    primaryAction = hasSelectableTargets ? "Select cleanup target" : "Review findings or choose cleanup type";
    primaryActionKind = "select-target";
    actionEnabled = Boolean(recommendedTarget?.id);
    primaryDetail = hasSelectableTargets
      ? "Pick one measured cleanup row that matches the armed route."
      : "The current scan has no selectable cleanup row for this route; review manual findings or arm another route.";
  } else if (nativeConnected && scanReady && targetSelected && !executed && !executionGate?.ready) {
    currentStepId = "consent";
    primaryAction = "Resolve user gate";
    primaryActionKind = "resolve-user-gate";
    actionEnabled = false;
    primaryDetail = executionGate?.primary || "Review route readiness, check consent, and type the confirmation phrase.";
  } else if (nativeConnected && scanReady && targetSelected && !executed) {
    currentStepId = "execute";
    primaryAction = "Execute selected cleanup";
    primaryActionKind = "execute-cleanup";
    actionEnabled = Boolean(executionGate?.ready);
    primaryDetail = "Run the scoped native executor only after the selected target and consent gate are ready.";
  } else if (nativeConnected && noOpExecution) {
    currentStepId = "next-route";
    primaryAction = "Ready for next route";
    primaryActionKind = "next-route";
    actionEnabled = false;
    primaryDetail = "The accepted native executor reclaimed 0 bytes, so proof handoff is not required before another route can be considered.";
  } else if (nativeConnected && executed && !proofScanCaptured) {
    currentStepId = "rescan";
    primaryAction = "Run post-run rescan";
    primaryActionKind = "run-post-run-rescan";
    actionEnabled = true;
    primaryDetail = "Capture a newer native scan before exporting proof or enabling another route.";
  } else if (nativeConnected && executed && (!proofMatched || !proofReviewed)) {
    currentStepId = "review-proof";
    primaryAction = proofMatched ? "Review post-run proof" : "Resolve rescan mismatch";
    primaryActionKind = proofMatched ? "review-proof" : "resolve-proof-mismatch";
    actionEnabled = false;
    primaryDetail = proofMatched
      ? "Review the native ledger and matched post-run scan, then check the proof review box."
      : postRunProof?.detail || "The post-run scan has not matched the selected execution ledger.";
  } else if (nativeConnected && executed && !handoffComplete) {
    currentStepId = "export-proof";
    primaryAction = canExportProof ? "Export proof packet" : "Resolve proof export blockers";
    primaryActionKind = "export-proof";
    actionEnabled = Boolean(canExportProof);
    primaryDetail = canExportProof
      ? "Write the selected-route proof, real workflow proof, verifier output, and support bundle."
      : "Proof export remains locked until the matched rescan and proof review are complete.";
  } else if (nativeConnected && handoffComplete) {
    currentStepId = "next-route";
    primaryAction = "Ready for next route";
    primaryActionKind = "next-route";
    actionEnabled = false;
    primaryDetail = "The workflow proof and support bundle handoff are complete; another route can be considered.";
  }
  const actionBusy = Boolean(
    (primaryActionKind === "run-scan" && scanStatus === "scanning") ||
    (primaryActionKind === "run-post-run-rescan" && scanStatus === "rescanning") ||
    (primaryActionKind === "execute-cleanup" && executionStatus === "running") ||
    (primaryActionKind === "export-proof" && proofExportStatus === "running")
  );
  actionEnabled = Boolean(actionEnabled && !actionBusy);

  const order = [
    workflowGuideStep("connect", "Connect", "Desktop bridge", "Start the Windows desktop shell."),
    workflowGuideStep("scan", "Scan", "Real scan", "Run a native read-only scan."),
    workflowGuideStep("select", "Select", "Cleanup target", "Choose one measured target."),
    workflowGuideStep("consent", "Consent", "User gate", "Review guardrails and confirm."),
    workflowGuideStep("execute", "Execute", "Native executor", "Run the scoped cleanup."),
    workflowGuideStep("rescan", "Rescan", "Post-run scan", "Capture fresh evidence."),
    workflowGuideStep("review-proof", "Review", "Proof review", "Review matched ledger evidence."),
    workflowGuideStep("export-proof", "Export", "Proof handoff", "Write proof and support artifacts."),
    workflowGuideStep("next-route", "Next", "Next route", "Unlock route switching.")
  ];
  const currentIndex = Math.max(0, order.findIndex((step) => step.id === currentStepId));
  const steps = order.map((step, index) => ({
    ...step,
    status: index < currentIndex ? "done" : index === currentIndex ? "current" : "locked",
    passed: index < currentIndex || (currentStepId === "next-route" && index === currentIndex)
  }));

  return {
    schemaVersion: "spaceguard-workflow-guide/v1",
    status: handoffComplete ? "complete" : "active",
    currentStepId,
    primaryAction,
    primaryActionKind,
    primaryTargetId: recommendedTarget?.id || "",
    primaryTargetTitle: guideTarget?.title || "",
    primaryTargetRouteInput: guideTarget?.routeInput || "",
    primaryTargetBytes: Number(guideTarget?.bytes ?? guideTarget?.expectedBytes ?? 0),
    primaryTargetPath: redactWorkflowGuidePath(guideTargetPath),
    actionBusy,
    actionEnabled,
    primaryDetail,
    steps
  };
}

function workflowGuideStep(id, shortLabel, label, detail) {
  return { id, shortLabel, label, detail };
}

function redactWorkflowGuidePath(value = "") {
  return String(value || "")
    .replace(/[A-Za-z]:\\Users\\[^\\]+/gi, "%USERPROFILE%")
    .replace(/[A-Za-z]:\\Windows/gi, "%WINDIR%")
    .replace(/[A-Za-z]:\\Program Files \(x86\)/gi, "%PROGRAMFILES(X86)%")
    .replace(/[A-Za-z]:\\Program Files/gi, "%PROGRAMFILES%")
    .replace(/[A-Za-z]:\\ProgramData/gi, "%PROGRAMDATA%");
}

export function buildWorkflowLocks({
  executionRecord = null,
  workflowProofAccepted = false,
  supportBundleWritten = false
} = {}) {
  const accepted = Boolean(executionRecord?.accepted);
  const reclaimedBytes = Number(executionRecord?.bytes || 0);
  const noOpExecution = Boolean(accepted && reclaimedBytes <= 0);
  const positiveExecution = Boolean(accepted && reclaimedBytes > 0);
  const proofHandoffRequired = Boolean(positiveExecution && !supportBundleWritten);
  const proofAllowsNextExecutor = !proofHandoffRequired;
  const targetSwitchLocked = proofHandoffRequired;
  const routeSetupLocked = proofHandoffRequired;

  return {
    schemaVersion: "spaceguard-workflow-locks/v1",
    acceptedExecution: accepted,
    reclaimedBytes,
    noOpExecution,
    workflowProofAccepted: Boolean(workflowProofAccepted),
    supportBundleWritten: Boolean(supportBundleWritten),
    proofHandoffRequired,
    proofAllowsNextExecutor,
    targetSwitchLocked,
    routeSetupLocked,
    primary: noOpExecution
      ? "Native executor accepted but reclaimed 0 bytes; proof handoff is not required and route switching is unlocked."
      : proofHandoffRequired
        ? "Positive reclaimed bytes require proof export and support bundle capture before another route."
        : "Workflow route and target switching are unlocked."
  };
}

export function buildBaselinePromotion({
  currentScan = null,
  postRunScan = null,
  executionRecord = null,
  workflowProofAccepted = false,
  supportBundleWritten = false
} = {}) {
  const executionTime = parseWorkflowTimestamp(executionRecord?.executedAt);
  const postRunTime = parseWorkflowTimestamp(postRunScan?.generatedAt);
  const acceptedPositiveExecution = Boolean(executionRecord?.accepted && Number(executionRecord?.bytes || 0) > 0);
  const postRunScanCurrent = Boolean(
    Number.isFinite(executionTime) &&
      Number.isFinite(postRunTime) &&
      postRunTime >= executionTime
  );
  const canPromote = Boolean(
    acceptedPositiveExecution &&
      workflowProofAccepted &&
      supportBundleWritten &&
      postRunScan &&
      postRunScanCurrent
  );

  return {
    schemaVersion: "spaceguard-baseline-promotion/v1",
    canPromote,
    activeScan: canPromote ? postRunScan : currentScan,
    promotedAt: canPromote ? new Date().toISOString() : "",
    reason: canPromote
      ? "Post-run scan is verified and can become the next cleanup baseline."
      : "Keep the current active scan until accepted proof, support bundle, and a current post-run scan are available.",
    rows: [
      guardrailRow({
        id: "accepted-positive-execution",
        label: "Accepted positive execution",
        passed: acceptedPositiveExecution,
        detail: acceptedPositiveExecution ? "A positive native execution was accepted." : "No positive accepted execution is available."
      }),
      guardrailRow({
        id: "proof-accepted",
        label: "Workflow proof accepted",
        passed: Boolean(workflowProofAccepted),
        detail: workflowProofAccepted ? "Workflow proof verifier accepted the route." : "Workflow proof is not accepted."
      }),
      guardrailRow({
        id: "support-bundle-written",
        label: "Support bundle written",
        passed: Boolean(supportBundleWritten),
        detail: supportBundleWritten ? "Support bundle was captured." : "Support bundle capture is missing."
      }),
      guardrailRow({
        id: "post-run-scan-current",
        label: "Post-run scan current",
        passed: postRunScanCurrent,
        detail: postRunScanCurrent ? "Post-run scan is newer than the execution." : "Post-run scan is missing or predates the execution."
      })
    ]
  };
}

export function buildExecutionLedgerRows(result = {}) {
  const source = result && typeof result === "object" ? result : {};
  const rows = (Array.isArray(source.entries) ? source.entries : []).map((entry, index) => {
    const checks = Array.isArray(entry?.preflightChecks)
      ? entry.preflightChecks
      : Array.isArray(entry?.preflight_checks)
        ? entry.preflight_checks
        : [];
    return {
      id: String(entry?.id || `entry-${index + 1}`),
      title: String(entry?.title || "Native execution entry"),
      route: String(entry?.route || ""),
      result: String(entry?.result || "unknown"),
      rejectCode: String(entry?.rejectCode || entry?.reject_code || ""),
      bytes: Number(entry?.bytes || 0),
      preflightStatus: String(entry?.preflightStatus || entry?.preflight_status || "unknown"),
      note: String(entry?.note || ""),
      checks: checks.map((check, checkIndex) => ({
        id: String(check?.id || `check-${checkIndex + 1}`),
        label: String(check?.label || "Preflight check"),
        status: String(check?.status || "unknown"),
        detail: String(check?.detail || "")
      }))
    };
  });
  const warnings = (Array.isArray(source.warnings) ? source.warnings : [])
    .map((warning) => String(warning || "").trim())
    .filter(Boolean);
  const accepted = Boolean(source.accepted);
  const rejectedCount = rows.filter((row) => row.result === "rejected" || row.rejectCode).length;
  const executedCount = rows.filter((row) => row.result === "executed" || row.result === "no-op").length;
  const reclaimedBytes = rows.reduce((sum, row) => sum + Number(row.bytes || 0), 0);
  const status = accepted ? "accepted" : rejectedCount ? "rejected" : rows.length ? "review" : "empty";

  return {
    schemaVersion: "spaceguard-execution-ledger/v1",
    status,
    accepted,
    mode: String(source.mode || ""),
    reason: String(source.reason || ""),
    warnings,
    rows,
    counts: {
      entries: rows.length,
      executed: executedCount,
      rejected: rejectedCount,
      warnings: warnings.length,
      reclaimedBytes
    },
    primary: accepted
      ? `Native executor accepted ${executedCount} ledger entr${executedCount === 1 ? "y" : "ies"}.`
      : rejectedCount
        ? `Native executor rejected ${rejectedCount} ledger entr${rejectedCount === 1 ? "y" : "ies"}.`
        : "Native execution ledger has no accepted or rejected entries."
  };
}

const SUPPORT_BUNDLE_PROOF_ARTIFACTS = [
  "spaceguard-selected-route-proof-packet.md",
  "spaceguard-real-workflow-proof.md",
  "spaceguard-workflow-proof-check.json"
];

export function buildInAppSupportBundleReport({
  generatedAt = new Date().toISOString(),
  routeInput = "",
  selectedFlag = "",
  proofArtifacts = [],
  workflowProofCheck = null
} = {}) {
  const artifacts = proofArtifacts.map(normalizeSupportBundleArtifact);
  const requiredWritten = SUPPORT_BUNDLE_PROOF_ARTIFACTS.every((fileName) =>
    artifacts.some((artifact) => artifact.fileName === fileName && artifact.written)
  );
  const accepted = Boolean(workflowProofCheck?.canAccept);
  const readyForHandoff = Boolean(requiredWritten && accepted);
  const blockers = Array.isArray(workflowProofCheck?.blockers)
    ? workflowProofCheck.blockers.map((blocker) => ({
        id: String(blocker?.id || ""),
        label: String(blocker?.label || ""),
        detail: String(blocker?.detail || "")
      }))
    : [];

  return {
    schemaVersion: "spaceguard-support-bundle/v1",
    tool: "spaceguard-desktop-app",
    generatedAt,
    status: readyForHandoff ? "handoff-ready" : "handoff-blocked",
    readyForHandoff,
    selectedRoute: String(routeInput || workflowProofCheck?.routeInput || workflowProofCheck?.route || ""),
    selectedFlag: String(selectedFlag || ""),
    proofArtifacts: artifacts,
    workflowProofCheck: {
      schemaVersion: String(workflowProofCheck?.schemaVersion || ""),
      status: String(workflowProofCheck?.status || "missing"),
      canAccept: accepted,
      primary: String(workflowProofCheck?.primary || ""),
      blockers,
      counts: {
        reclaimedBytes: Number(workflowProofCheck?.counts?.reclaimedBytes || 0),
        blockers: Number(workflowProofCheck?.counts?.blockers ?? blockers.length)
      }
    },
    nextStep: buildInAppSupportBundleNextStep({ requiredWritten, accepted })
  };
}

export function renderInAppSupportBundleMarkdown(report = {}) {
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
    "| File | State | Size | Path |",
    "| --- | --- | ---: | --- |",
    ...artifacts.map((artifact) => `| ${artifact.fileName} | ${artifact.written ? "written" : "missing"} | ${formatBytes(artifact.bytes)} | ${artifact.path || ""} |`),
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
    ""
  ].join("\n");
}

function normalizeSupportBundleArtifact(value = {}) {
  return {
    fileName: String(value.fileName || value.file_name || ""),
    written: Boolean(value.written ?? value.exists),
    path: String(value.path || ""),
    bytes: Number(value.bytes || 0),
    reason: String(value.reason || "")
  };
}

function buildInAppSupportBundleNextStep({ requiredWritten, accepted }) {
  if (!requiredWritten) return "Export proof in the desktop app so all required proof artifacts are written before handoff.";
  if (!accepted) return "Resolve workflow proof check blockers in the app, rerun post-run rescan if needed, then export proof again.";
  return "You can archive this bundle with the three proof artifacts before enabling another cleanup route.";
}

export function buildAppAgentTaskQueue({
  cleanupQueue = [],
  manualReviewTargets = [],
  execution = {}
} = {}) {
  const rows = [];
  if (execution?.accepted && !execution.noOpExecution && execution.rescanComparisonStatus !== "matched") {
    const canRun = Boolean(execution.canRunPostRunRescan);
    rows.push({
      id: "task-post-run-rescan",
      source: "post-run-proof",
      actionType: "rescan",
      targetId: "post-run-rescan",
      route: "post-run-proof",
      title: "Run post-run rescan before another executor",
      bytes: 0,
      priority: "high",
      status: canRun ? "ready" : "blocked",
      canExecuteNow: canRun,
      manualOnly: false,
      executorFlag: "",
      buttonLabel: "Run post-run rescan",
      reason: canRun
        ? "A scoped executor has ledger evidence; capture the post-run native scan before any other executor."
        : "Post-run native rescan is required before any other executor.",
      blocker: canRun ? "" : "post-run-rescan-unavailable",
      checks: [
        appTaskCheck("execution-ledger", "Execution ledger", true, "Native execution ledger exists."),
        appTaskCheck("post-run-rescan", "Post-run rescan", canRun, canRun ? "Post-run rescan can run." : "Post-run rescan is unavailable.")
      ]
    });
  }

  if (
    execution?.accepted &&
    execution.proofStatus === "proof-complete" &&
    execution.workflowProofCheckCanAccept &&
    !execution.supportBundleWritten
  ) {
    rows.push({
      id: "task-support-bundle",
      source: "support-bundle",
      actionType: "manual-only",
      targetId: "spaceguard-support-bundle",
      route: "support-bundle",
      title: "Capture support bundle before another route",
      bytes: 0,
      priority: "high",
      status: "needs-user-review",
      canExecuteNow: false,
      manualOnly: true,
      executorFlag: "",
      buttonLabel: "Export proof packet",
      reason: "Workflow proof is accepted; write spaceguard-support-bundle.md before another cleanup route.",
      blocker: "support-bundle-required",
      checks: [
        appTaskCheck("workflow-proof-check", "Workflow proof check", true, "In-app workflow verifier accepted the proof."),
        appTaskCheck("support-bundle", "Support bundle", false, "spaceguard-support-bundle.md has not been written yet.")
      ]
    });
  }

  if (execution?.proofAllowsNextExecutor) {
    for (const candidate of cleanupQueue.slice(0, 12)) {
      const candidateReady = Boolean(candidate.canExecute);
      const consentReady = Boolean(execution.consentMatchesPlan);
      const scanReady = Boolean(execution.scanFingerprintPresent);
      const canExecute = Boolean(candidateReady && consentReady && scanReady);
      const blocker = canExecute
        ? ""
        : !candidateReady
          ? "route-readiness-blocked"
          : !consentReady
            ? "consent"
            : "scan-fingerprint";
      const blockedReason = !candidateReady
        ? candidate.blockedReason || "Route readiness blocks this cleanup target."
        : !consentReady
          ? "Current-plan consent is required before recommending the executor button."
          : "Current scan fingerprint is required before recommending the executor button.";
      rows.push({
        id: `task-${candidate.actionType || "run-executor"}-${candidate.targetId || candidate.id || candidate.routeInput || "target"}`,
        source: "scoped-executor",
        actionType: candidate.actionType || "run-scoped-executor",
        targetId: candidate.targetId || candidate.id || "",
        route: candidate.route || "",
        title: candidate.title || candidate.routeInput || "Cleanup target",
        bytes: Number(candidate.bytes || 0),
        priority: appTaskPriority(candidate.bytes, canExecute ? "ready" : "blocked"),
        status: canExecute ? "ready" : "blocked",
        canExecuteNow: canExecute,
        manualOnly: false,
        executorFlag: candidate.envVar || "",
        buttonLabel: "Execute selected cleanup",
        reason: canExecute
          ? "All app-visible route and consent gates are ready for this selected cleanup target."
          : blockedReason,
        blocker,
        checks: [
          appTaskCheck("target-ready", "Target ready", candidateReady, candidateReady ? "Target route readiness passed." : candidate.blockedReason || "Target is blocked."),
          appTaskCheck("consent", "Current consent", consentReady, consentReady ? "Consent matches the current plan." : "Current-plan consent is missing."),
          appTaskCheck("scan-fingerprint", "Scan fingerprint", scanReady, scanReady ? "Current scan fingerprint is present." : "Current scan fingerprint is missing.")
        ]
      });
    }
  }

  for (const target of manualReviewTargets.slice(0, 8)) {
    const targetId = target.targetId || target.id || target.path || target.title || "manual-review";
    rows.push({
      id: `task-manual-only-${targetId}`,
      source: "manual-review",
      actionType: "manual-only",
      targetId,
      route: target.route || "manual-review",
      title: target.title || "Manual review",
      bytes: Number(target.bytes || 0),
      priority: appTaskPriority(target.bytes, "manual-only"),
      status: "manual-only",
      canExecuteNow: false,
      manualOnly: true,
      executorFlag: "",
      buttonLabel: "Open manual review",
      reason: target.reason || "Manual review only; no SpaceGuard executor is mapped to this finding.",
      blocker: "manual-only",
      checks: [
        appTaskCheck("manual-only", "Manual-only boundary", true, "Routes to review guidance only."),
        appTaskCheck("no-executor", "No executor", true, "SpaceGuard will not delete or modify this target.")
      ]
    });
  }

  return {
    schemaVersion: "spaceguard-app-agent-task-queue/v1",
    status: rows.some((row) => row.status === "ready") ? "ready" : rows.length ? "needs-user-review" : "empty",
    rows,
    counts: {
      total: rows.length,
      ready: rows.filter((row) => row.status === "ready").length,
      blocked: rows.filter((row) => row.status === "blocked").length,
      manual: rows.filter((row) => row.manualOnly).length
    }
  };
}

function appTaskCheck(id, label, passed, detail) {
  return {
    id,
    label,
    passed: Boolean(passed),
    detail
  };
}

function appTaskPriority(bytes = 0, status = "") {
  const size = Number(bytes || 0);
  if (status === "ready") return "high";
  if (size >= 5 * 1024 ** 3) return "high";
  if (size >= 1024 ** 3) return "medium";
  return "low";
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

function isAbsoluteWindowsPath(value = "") {
  return /^[A-Za-z]:[\\/].+/.test(String(value || "").trim());
}

function getWindowsDrive(value = "") {
  const match = String(value || "").trim().match(/^([A-Za-z]):[\\/]/);
  return match ? match[1].toUpperCase() : "";
}

function isProtectedArchiveDestination(value = "") {
  const normalized = String(value || "").trim().replace(/\//g, "\\").toLowerCase();
  if (!normalized) return false;
  const withoutDrive = normalized.replace(/^[a-z]:/, "");
  return [
    "\\windows",
    "\\program files",
    "\\program files (x86)",
    "\\programdata",
    "\\$recycle.bin",
    "\\recovery",
    "\\system volume information"
  ].some((prefix) => withoutDrive === prefix || withoutDrive.startsWith(`${prefix}\\`)) ||
    /\\users\\[^\\]+\\appdata(\\|$)/.test(withoutDrive) ||
    /\\users\\[^\\]+\\appdata\\local\\temp(\\|$)/.test(withoutDrive);
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
  const generatedAt = parseWorkflowTimestamp(postRunScan.generatedAt);
  const executedAt = parseWorkflowTimestamp(executionRecord.executedAt);
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
