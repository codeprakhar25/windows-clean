const assert = require("assert");

(async () => {
  const workflow = await import("../src/real-workflow.mjs");

  const executedAt = "2026-06-08T15:00:00.000Z";
  const postRunGeneratedAt = "2026-06-08T15:01:00.000Z";
  const selectedInstaller = {
    id: "downloads-installers:setup-old",
    recipeId: "downloads-installers",
    title: "setup-old.exe",
    route: "item-review-recycle-bin",
    routeInput: "downloads",
    targetPath: "C:\\Users\\LocalUser\\Downloads\\setup-old.exe",
    bytes: 128 * 1024 * 1024,
    sourceFinding: {
      recipeId: "downloads-installers",
      path: "C:\\Users\\LocalUser\\Downloads"
    },
    reviewTarget: {
      path: "C:\\Users\\LocalUser\\Downloads\\setup-old.exe",
      bytes: 128 * 1024 * 1024
    }
  };

  const proof = workflow.buildPostRunProof({
    candidate: selectedInstaller,
    executionRecord: {
      executedAt,
      bytes: 128 * 1024 * 1024
    },
    postRunScan: {
      generatedAt: postRunGeneratedAt,
      findings: [
        {
          recipeId: "downloads-installers",
          path: "C:\\Users\\LocalUser\\Downloads",
          bytes: 512 * 1024 * 1024,
          items: [
            {
              id: "setup-new",
              path: "C:\\Users\\LocalUser\\Downloads\\setup-new.exe",
              bytes: 512 * 1024 * 1024
            }
          ]
        }
      ]
    }
  });

  assert.strictEqual(proof.status, "matched", "selected item proof should match when that item is absent after rescan");
  assert.strictEqual(proof.actualBytes, 0, "selected item proof should compare the selected item, not parent finding bytes");
  assert.strictEqual(proof.targetEvidence.kind, "item", "selected item proof should record item-level evidence");

  const archiveCandidate = {
    route: "item-review-large-files",
    routeInput: "large-files",
    title: "old-video.mkv",
    targetPath: "C:\\Users\\LocalUser\\Videos\\old-video.mkv",
    requiresArchiveDestination: true
  };
  const missingArchiveDestination = workflow.buildExecutionPrerequisites({
    candidate: archiveCandidate,
    archiveDestination: ""
  });
  assert.strictEqual(missingArchiveDestination.ready, false, "large-file archive should require a destination before execution");
  assert(missingArchiveDestination.rows.some((row) => row.id === "archive-destination" && !row.passed), "archive prerequisites should expose the missing destination row");

  const relativeArchiveDestination = workflow.buildExecutionPrerequisites({
    candidate: archiveCandidate,
    archiveDestination: "Archives"
  });
  assert.strictEqual(relativeArchiveDestination.ready, false, "large-file archive should reject relative destinations before native execution");
  assert(relativeArchiveDestination.rows.some((row) => row.id === "archive-destination-absolute" && !row.passed), "archive prerequisites should require an absolute Windows destination");

  const sameDriveArchiveDestination = workflow.buildExecutionPrerequisites({
    candidate: archiveCandidate,
    archiveDestination: "C:\\SpaceGuardArchive"
  });
  assert.strictEqual(sameDriveArchiveDestination.ready, false, "large-file archive should reject same-drive archive destinations before native execution");
  assert(sameDriveArchiveDestination.rows.some((row) => row.id === "archive-destination-drive" && !row.passed), "archive prerequisites should require a different drive");

  const protectedArchiveDestination = workflow.buildExecutionPrerequisites({
    candidate: archiveCandidate,
    archiveDestination: "D:\\Windows\\SpaceGuardArchive"
  });
  assert.strictEqual(protectedArchiveDestination.ready, false, "large-file archive should reject protected archive destinations before native execution");
  assert(protectedArchiveDestination.rows.some((row) => row.id === "archive-destination-protected" && !row.passed), "archive prerequisites should block protected roots");

  const validArchiveDestination = workflow.buildExecutionPrerequisites({
    candidate: archiveCandidate,
    archiveDestination: "D:\\SpaceGuardArchive"
  });
  assert.strictEqual(validArchiveDestination.ready, true, "large-file archive should allow a different-drive archive destination");

  const recyclePrerequisites = workflow.buildExecutionPrerequisites({
    candidate: {
      route: "shell-recycle-bin",
      routeInput: "recycle-bin",
      title: "Recycle Bin",
      targetPath: "C:\\$Recycle.Bin",
      requiresPermanentConfirmation: true
    },
    permanentRemovalConfirmed: false
  });
  assert.strictEqual(recyclePrerequisites.ready, false, "Recycle Bin execution should require permanent-removal confirmation");
  assert(recyclePrerequisites.rows.some((row) => row.id === "permanent-removal-confirmation" && !row.passed), "Recycle Bin prerequisites should expose the missing permanent confirmation");

  const confirmedRecyclePrerequisites = workflow.buildExecutionPrerequisites({
    candidate: {
      route: "shell-recycle-bin",
      routeInput: "recycle-bin",
      title: "Recycle Bin",
      targetPath: "C:\\$Recycle.Bin",
      requiresPermanentConfirmation: true
    },
    permanentRemovalConfirmed: true
  });
  assert.strictEqual(confirmedRecyclePrerequisites.ready, true, "Recycle Bin execution should unlock after explicit permanent-removal confirmation");

  const stillPresent = workflow.buildPostRunProof({
    candidate: selectedInstaller,
    executionRecord: {
      executedAt,
      bytes: 128 * 1024 * 1024
    },
    postRunScan: {
      generatedAt: postRunGeneratedAt,
      findings: [
        {
          recipeId: "downloads-installers",
          path: "C:\\Users\\LocalUser\\Downloads",
          bytes: 640 * 1024 * 1024,
          items: [
            {
              id: "setup-old",
              path: "C:\\Users\\LocalUser\\Downloads\\setup-old.exe",
              bytes: 128 * 1024 * 1024
            }
          ]
        }
      ]
    }
  });

  assert.strictEqual(stillPresent.status, "review-needed", "selected item proof should fail if the selected item is still present");
  assert.strictEqual(stillPresent.actualBytes, 128 * 1024 * 1024, "selected item proof should report remaining selected item bytes");

  const rootCandidate = {
    id: "npm-cache:C:\\Users\\LocalUser\\AppData\\Local\\npm-cache\\_cacache",
    recipeId: "npm-cache",
    route: "bounded-npm-cache-delete",
    routeInput: "npm-cache",
    targetPath: "C:\\Users\\LocalUser\\AppData\\Local\\npm-cache\\_cacache",
    bytes: 300 * 1024 * 1024,
    sourceFinding: {
      recipeId: "npm-cache",
      path: "C:\\Users\\LocalUser\\AppData\\Local\\npm-cache\\_cacache"
    }
  };
  const rootProof = workflow.buildPostRunProof({
    candidate: rootCandidate,
    executionRecord: {
      executedAt,
      bytes: 250 * 1024 * 1024
    },
    postRunScan: {
      generatedAt: postRunGeneratedAt,
      findings: [
        {
          recipeId: "npm-cache",
          path: "C:\\Users\\LocalUser\\AppData\\Local\\npm-cache\\_cacache",
          bytes: 40 * 1024 * 1024
        }
      ]
    }
  });

  assert.strictEqual(rootProof.status, "matched", "root proof should keep using root finding bytes");
  assert.strictEqual(rootProof.targetEvidence.kind, "finding", "root proof should record finding-level evidence");

  const npmRecipe = {
    route: "bounded-npm-cache-delete",
    flagKey: "npmCacheExecutor",
    envVar: "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR",
    executor: "npm"
  };
  const readyRuntime = {
    windows: true,
    executeCleanupPlan: true,
    executorScopeStatus: "single-scoped-flag",
    executorFlags: { npmCacheExecutor: true },
    realRunEnabled: true,
    destructiveCommands: true
  };
  const readyStatus = workflow.buildRouteReadiness({
    recipe: npmRecipe,
    finding: { status: "measured" },
    runtime: readyRuntime
  });

  assert.strictEqual(readyStatus.canExecute, true, "ready route should pass every guardrail");
  assert.deepStrictEqual(
    readyStatus.rows.map((row) => row.id),
    ["native-runtime", "executor-command", "single-route-scope", "route-flag", "real-run-authority", "native-finding-status"],
    "route readiness should expose each execution guardrail in order"
  );
  assert(readyStatus.rows.every((row) => row.passed), "ready route readiness rows should all pass");

  const missingFlag = workflow.buildRouteReadiness({
    recipe: npmRecipe,
    finding: { status: "measured" },
    runtime: {
      ...readyRuntime,
      executorFlags: { npmCacheExecutor: false },
      realRunEnabled: false
    }
  });
  assert.strictEqual(missingFlag.canExecute, false, "missing route flag should block execution");
  assert.strictEqual(missingFlag.blockedReason, "Set SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR=1 in .env and restart the desktop app.");
  assert.strictEqual(missingFlag.rows.find((row) => row.id === "route-flag").status, "blocked", "route flag row should fail explicitly");
  assert(missingFlag.rows.find((row) => row.id === "route-flag").detail.includes("SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR=1"), "route flag row should show exact env var");

  const multiFlag = workflow.buildRouteReadiness({
    recipe: npmRecipe,
    finding: { status: "measured" },
    runtime: {
      ...readyRuntime,
      executorScopeStatus: "multiple-scoped-flags",
      enabledScopedExecutorFlags: ["SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR", "SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR"]
    }
  });
  assert.strictEqual(multiFlag.canExecute, false, "multiple route flags should block execution");
  assert(multiFlag.rows.find((row) => row.id === "single-route-scope").detail.includes("SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR"), "scope row should show enabled flags");

  const tempRoute = workflow.buildRouteReadiness({
    recipe: { route: "known-temp-delete", flagKey: "tempCleanupExecutor", envVar: "SPACEGUARD_ENABLE_TEMP_EXECUTOR", executor: "temp" },
    finding: { status: "measured" },
    runtime: {
      ...readyRuntime,
      executorFlags: { tempCleanupExecutor: true }
    }
  });
  assert.strictEqual(tempRoute.canExecute, true, "known-temp-delete should not require prior first-route proof");

  const npmSetup = workflow.buildRouteSetupChecklist({
    route: {
      routeInput: "npm-cache",
      route: "bounded-npm-cache-delete",
      label: "npm cache cleanup",
      envVar: "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR"
    },
    runtime: {
      executorScopeStatus: "no-scoped-flags",
      executorFlags: { npmCacheExecutor: false },
      enabledScopedExecutorFlags: [],
      openAiAdvisorConfigured: true
    }
  });

  assert.strictEqual(npmSetup.schemaVersion, "spaceguard-route-setup-checklist/v1", "route setup checklist should expose a stable schema");
  assert.strictEqual(npmSetup.routeInput, "npm-cache", "route setup should preserve selected route input");
  assert.strictEqual(npmSetup.ready, false, "npm setup should not be ready without the route flag");
  assert(!Object.prototype.hasOwnProperty.call(npmSetup, "requiresFirstRouteProof"), "route setup should not expose seeded proof requirements");
  assert(npmSetup.steps.some((step) => step.id === "route-flag" && step.command === "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR=1"), "setup should show exact env flag");
  assert(npmSetup.steps.some((step) => step.command === "npm run setup:route -- --route npm-cache"), "setup should show route setup command");
  assert(npmSetup.steps.some((step) => step.command === "npm run openai:smoke -- --route npm-cache"), "setup should show live OpenAI smoke command");
  assert(npmSetup.steps.some((step) => step.command.includes("validate:workflow-proof")), "setup should show app proof export validation command");
  assert(npmSetup.blockers.some((blocker) => blocker.id === "route-flag"), "missing route flag should be a blocker");
  assert.strictEqual(npmSetup.envBlock.schemaVersion, "spaceguard-route-env-block/v1", "route setup should expose a stable selected .env block schema");
  assert.strictEqual(npmSetup.envBlock.fileName, ".env", "route setup env block should target .env");
  assert.strictEqual(npmSetup.envBlock.selectedEnvVar, "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR", "route setup env block should mark the selected route flag");
  assert.strictEqual(npmSetup.runbook.schemaVersion, "spaceguard-windows-real-test-runbook/v1", "route setup should expose a Windows test runbook");
  assert.strictEqual(npmSetup.runbook.routeInput, "npm-cache", "Windows test runbook should preserve route input");
  assert(npmSetup.runbook.commands.some((row) => row.command === "npm run setup:doctor"), "Windows test runbook should include setup doctor");
  assert(npmSetup.runbook.commands.some((row) => row.command === "npm run openai:smoke -- --local-contract --route npm-cache"), "Windows test runbook should include offline route-contract smoke");
  assert(npmSetup.runbook.commands.some((row) => row.command === "npm run openai:smoke -- --route npm-cache"), "Windows test runbook should include live OpenAI smoke");
  assert(npmSetup.runbook.commands.some((row) => row.command === "npm run native:dev"), "Windows test runbook should launch the desktop app");
  assert(npmSetup.runbook.commands.some((row) => row.command === "npm run validate:workflow-proof -- --file spaceguard-real-workflow-proof.md"), "Windows test runbook should include proof verifier");
  assert(npmSetup.runbook.commands.some((row) => row.command === "npm run support:bundle"), "Windows test runbook should include support bundle capture");
  assert(npmSetup.runbook.appSteps.some((row) => row.id === "execute-route"), "Windows test runbook should include the app execution step");
  assert(npmSetup.runbook.appSteps.some((row) => row.id === "support-bundle"), "Windows test runbook should include support bundle app step");
  assert(npmSetup.runbook.guardrails.some((row) => row.id === "one-route"), "Windows test runbook should keep the one-route guardrail visible");
  assert(npmSetup.runbook.content.includes("Windows real-route test runbook"), "Windows test runbook should expose copyable markdown");
  assert(!npmSetup.runbook.content.includes("validate:route"), "Windows test runbook must not include removed validation commands");
  assert(npmSetup.envBlock.content.includes("OPENAI_API_KEY=sk-..."), "route setup env block should include the OpenAI placeholder");
  assert(npmSetup.envBlock.content.includes("SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR=1"), "route setup env block should enable the selected route");
  assert(npmSetup.envBlock.content.includes("SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR=0"), "route setup env block should disable competing route flags");
  assert(!npmSetup.envBlock.content.includes("SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK"), "real-data route env block must not include seeded proof env vars");
  assert(!npmSetup.envBlock.content.includes("first-route-completion-check.json"), "real-data route env block must not require seeded proof artifacts");
  assert.strictEqual(
    npmSetup.envBlock.executorFlagLines.filter((line) => line.endsWith("=1")).length,
    1,
    "route setup env block should enable exactly one executor flag"
  );
  assert(npmSetup.steps.some((step) => step.id === "env-block" && step.command === "Copy selected .env block into .env"), "setup should include a copy-env step before launch");

  const tempSetup = workflow.buildRouteSetupChecklist({
    route: {
      routeInput: "known-temp-delete",
      route: "known-temp-delete",
      label: "Windows temp cleanup",
      envVar: "SPACEGUARD_ENABLE_TEMP_EXECUTOR"
    },
    runtime: {
      executorScopeStatus: "single-scoped-flag",
      executorFlags: { tempCleanupExecutor: true },
      enabledScopedExecutorFlags: ["SPACEGUARD_ENABLE_TEMP_EXECUTOR"],
      openAiAdvisorConfigured: false
    }
  });

  assert(!Object.prototype.hasOwnProperty.call(tempSetup, "requiresFirstRouteProof"), "known-temp setup should not expose prior proof ceremony");
  assert(tempSetup.envBlock.content.includes("SPACEGUARD_ENABLE_TEMP_EXECUTOR=1"), "known-temp env block should enable the temp route");
  assert(!tempSetup.envBlock.content.includes("SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK"), "known-temp env block should not include prior proof env vars");

  const multiFlagSetup = workflow.buildRouteSetupChecklist({
    route: {
      routeInput: "gradle-cache",
      route: "bounded-cache-delete",
      label: "Gradle cache cleanup",
      envVar: "SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR"
    },
    runtime: {
      executorScopeStatus: "multiple-scoped-flags",
      enabledScopedExecutorFlags: ["SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR", "SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR"],
      executorFlags: { gradleCacheExecutor: true },
      openAiAdvisorConfigured: true
    }
  });

  assert.strictEqual(multiFlagSetup.ready, false, "multi-flag setup should not be ready");
  assert(multiFlagSetup.blockers.find((blocker) => blocker.id === "single-route-scope").detail.includes("SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR"), "multi-flag blocker should name enabled flags");

  const installedAppGuidance = workflow.buildManualFindingGuidance({
    recipeId: "installed-app-footprints",
    title: "Installed app footprints",
    path: "Windows uninstall inventory",
    bytes: 8 * 1024 * 1024 * 1024,
    status: "measured"
  });
  assert.strictEqual(installedAppGuidance.schemaVersion, "spaceguard-manual-finding-guidance/v1", "manual guidance should expose a stable schema");
  assert.strictEqual(installedAppGuidance.kind, "installed-app-review", "installed app findings should use app review guidance");
  assert.strictEqual(installedAppGuidance.primaryAction, "Review in Windows Settings before uninstalling.", "installed app guidance should point to Windows uninstall review");
  assert.strictEqual(installedAppGuidance.command, "ms-settings:appsfeatures", "installed app guidance should expose the Windows settings URI");
  assert(installedAppGuidance.blockedActions.includes("Do not delete application folders directly."), "installed app guidance should block raw folder deletion");

  const customRootGuidance = workflow.buildManualFindingGuidance({
    recipeId: "custom-root-0",
    title: "Custom root",
    path: "D:\\Archive",
    bytes: 20 * 1024 * 1024 * 1024,
    status: "measured"
  });
  assert.strictEqual(customRootGuidance.kind, "manual-filesystem-review", "custom roots should stay manual filesystem review");
  assert.strictEqual(customRootGuidance.command, "explorer.exe /select,\"D:\\Archive\"", "custom root guidance should expose an Explorer review command");
  assert(customRootGuidance.blockedActions.includes("No SpaceGuard executor is mapped to this finding."), "custom root guidance should block unmapped execution");

  const installedAppRows = workflow.buildManualFindingReviewRows({
    recipeId: "installed-app-footprints",
    items: [
      {
        id: "app-old-ide",
        name: "Old IDE 2023",
        path: "C:\\Program Files\\Old IDE 2023",
        bytes: 6 * 1024 * 1024 * 1024,
        recommendation: "review",
        reason: "Manual uninstall candidate",
        signals: [
          { label: "usage proof", value: "not proven", tone: "restricted" },
          { label: "uninstall entry", value: "present", tone: "safe" }
        ]
      },
      {
        id: "app-unity-hub",
        name: "Unity Hub",
        path: "C:\\Program Files\\Unity Hub",
        bytes: 4 * 1024 * 1024 * 1024,
        recommendation: "keep",
        reason: "Read-only app usage evidence found via UserAssist launch evidence matching Unity Hub.",
        signals: [
          { label: "usage proof", value: "UserAssist launch evidence", tone: "safe" },
          { label: "usage match", value: "name match: unity hub", tone: "safe" }
        ]
      }
    ]
  });
  assert.strictEqual(installedAppRows.schemaVersion, "spaceguard-manual-review-rows/v1", "manual review rows should expose a stable schema");
  assert.strictEqual(installedAppRows.rows.length, 2, "manual review rows should preserve visible installed-app candidates");
  assert.strictEqual(installedAppRows.rows[0].action, "review-uninstall", "unused-app candidates should be review-only uninstall hints");
  assert.strictEqual(installedAppRows.rows[0].actionLabel, "Review uninstall");
  assert.strictEqual(installedAppRows.rows[0].blockedAction, "Do not delete this folder directly.");
  assert(installedAppRows.rows[0].signals.some((signal) => signal.label === "usage proof" && signal.value === "not proven"), "review row should preserve missing usage proof");
  assert.strictEqual(installedAppRows.rows[1].action, "keep-installed", "apps with usage evidence should not be framed as uninstall candidates");
  assert(installedAppRows.rows[1].signals.some((signal) => signal.label === "usage proof" && signal.value === "UserAssist launch evidence"), "keep row should preserve usage evidence");

  console.log("real workflow ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
