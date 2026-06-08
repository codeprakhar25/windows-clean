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

  console.log("real workflow ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
