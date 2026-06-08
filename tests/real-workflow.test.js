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
    destructiveCommands: true,
    firstRouteProof: { accepted: true, path: "C:\\proof\\first-route-completion-check.json" }
  };
  const readyStatus = workflow.buildRouteReadiness({
    recipe: npmRecipe,
    finding: { status: "measured" },
    runtime: readyRuntime
  });

  assert.strictEqual(readyStatus.canExecute, true, "ready route should pass every guardrail");
  assert.deepStrictEqual(
    readyStatus.rows.map((row) => row.id),
    ["native-runtime", "executor-command", "single-route-scope", "route-flag", "real-run-authority", "first-route-proof", "native-finding-status"],
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

  const missingProof = workflow.buildRouteReadiness({
    recipe: npmRecipe,
    finding: { status: "measured" },
    runtime: {
      ...readyRuntime,
      firstRouteProof: { accepted: false, status: "missing" }
    }
  });
  assert.strictEqual(missingProof.canExecute, false, "real-data route should require first-route proof");
  assert.strictEqual(missingProof.rows.find((row) => row.id === "first-route-proof").status, "blocked");

  const tempRoute = workflow.buildRouteReadiness({
    recipe: { route: "known-temp-delete", flagKey: "tempCleanupExecutor", envVar: "SPACEGUARD_ENABLE_TEMP_EXECUTOR", executor: "temp" },
    finding: { status: "measured" },
    runtime: {
      ...readyRuntime,
      executorFlags: { tempCleanupExecutor: true },
      firstRouteProof: { accepted: false, status: "missing" }
    }
  });
  assert.strictEqual(tempRoute.canExecute, true, "known-temp-delete should not require prior first-route proof");
  assert.strictEqual(tempRoute.rows.find((row) => row.id === "first-route-proof").status, "not-required");

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
      firstRouteProof: { accepted: false, status: "missing" },
      openAiAdvisorConfigured: true
    }
  });

  assert.strictEqual(npmSetup.schemaVersion, "spaceguard-route-setup-checklist/v1", "route setup checklist should expose a stable schema");
  assert.strictEqual(npmSetup.routeInput, "npm-cache", "route setup should preserve selected route input");
  assert.strictEqual(npmSetup.ready, false, "npm setup should not be ready without route flag and first proof");
  assert.strictEqual(npmSetup.requiresFirstRouteProof, true, "npm setup should require first-route proof");
  assert(npmSetup.steps.some((step) => step.id === "route-flag" && step.command === "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR=1"), "setup should show exact env flag");
  assert(npmSetup.steps.some((step) => step.command === "npm run setup:route -- --route npm-cache"), "setup should show route setup command");
  assert(npmSetup.steps.some((step) => step.command === "npm run openai:smoke -- --route npm-cache"), "setup should show live OpenAI smoke command");
  assert(npmSetup.steps.some((step) => step.command === "npm run v1:windows -- -SelectedRoute npm-cache"), "setup should show full V1 proof command");
  assert(npmSetup.blockers.some((blocker) => blocker.id === "route-flag"), "missing route flag should be a blocker");
  assert(npmSetup.blockers.some((blocker) => blocker.id === "first-route-proof"), "missing first-route proof should be a blocker");
  assert.strictEqual(npmSetup.envBlock.schemaVersion, "spaceguard-route-env-block/v1", "route setup should expose a stable selected .env block schema");
  assert.strictEqual(npmSetup.envBlock.fileName, ".env", "route setup env block should target .env");
  assert.strictEqual(npmSetup.envBlock.selectedEnvVar, "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR", "route setup env block should mark the selected route flag");
  assert(npmSetup.envBlock.content.includes("OPENAI_API_KEY=sk-..."), "route setup env block should include the OpenAI placeholder");
  assert(npmSetup.envBlock.content.includes("SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR=1"), "route setup env block should enable the selected route");
  assert(npmSetup.envBlock.content.includes("SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR=0"), "route setup env block should disable competing route flags");
  assert(npmSetup.envBlock.content.includes("SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK=C:\\path\\to\\first-route-completion-check.json"), "real-data route env block should show first-route proof path placeholder");
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
      firstRouteProof: { accepted: false, status: "missing" },
      openAiAdvisorConfigured: false
    }
  });

  assert.strictEqual(tempSetup.requiresFirstRouteProof, false, "known-temp setup should not require prior first-route proof");
  assert(tempSetup.steps.find((step) => step.id === "first-route-proof").status === "not-required", "known-temp first proof step should be not-required");
  assert(tempSetup.envBlock.content.includes("SPACEGUARD_ENABLE_TEMP_EXECUTOR=1"), "known-temp env block should enable the temp route");
  assert(tempSetup.envBlock.content.includes("SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK="), "known-temp env block should keep first-route proof empty");

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
      firstRouteProof: { accepted: true, path: "C:\\proof\\first-route-completion-check.json" },
      openAiAdvisorConfigured: true
    }
  });

  assert.strictEqual(multiFlagSetup.ready, false, "multi-flag setup should not be ready");
  assert(multiFlagSetup.blockers.find((blocker) => blocker.id === "single-route-scope").detail.includes("SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR"), "multi-flag blocker should name enabled flags");

  console.log("real workflow ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
