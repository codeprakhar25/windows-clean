const assert = require("assert");

(async () => {
  const openai = await import("../src/openai-agent.mjs");

  const primaryConfig = openai.getOpenAIAgentConfig({
    OPENAI_API_KEY: "test-openai-key",
    OPENAI_MODEL: "gpt-5.5",
    OPENAI_REASONING_EFFORT: "low"
  });
  assert.strictEqual(primaryConfig.connected, true, "OPENAI_API_KEY should configure the OpenAI advisor");
  assert.strictEqual(primaryConfig.model, "gpt-5.5", "OpenAI advisor should accept OPENAI_MODEL");
  assert.strictEqual(primaryConfig.keySource, "OPENAI_API_KEY", "OpenAI advisor should prefer OPENAI_API_KEY");
  assert.strictEqual(primaryConfig.reasoningEffort, "low", "OpenAI advisor should normalize reasoning effort");
  assert.strictEqual(primaryConfig.directToolAccess, false, "OpenAI advisor must not receive direct tool access");

  const legacyConfig = openai.getOpenAIAgentConfig({
    VITE_OPENAI_API_KEY: "legacy-openai-key",
    VITE_OPENAI_MODEL: "gpt-5-mini",
    VITE_OPENAI_REASONING_EFFORT: "none"
  });
  assert.strictEqual(legacyConfig.keySource, "VITE_OPENAI_API_KEY", "OpenAI advisor should keep the legacy Vite key fallback");
  assert.strictEqual(legacyConfig.model, "gpt-5-mini", "OpenAI advisor should keep the legacy model fallback");
  assert.strictEqual(legacyConfig.reasoningEffort, "none", "OpenAI advisor should keep the legacy reasoning fallback");

  assert.strictEqual(openai.getNativeOpenAIAgentCapability({}).available, false, "browser host should not expose the native OpenAI command");
  assert.strictEqual(
    openai.getNativeOpenAIAgentCapability({ __TAURI__: { core: { invoke() {} } } }).available,
    true,
    "Tauri host should expose the native OpenAI command"
  );

  const manualContext = openai.buildOpenAIAgentContext({
    scanSession: {
      status: "current",
      currentFingerprint: "scan-openai-manual"
    },
    planSnapshot: {
      id: "plan-openai-manual",
      scanMode: "native-readonly",
      selectedCount: 1,
      selectedBytes: 6 * 1024 ** 3,
      goalBytes: 10 * 1024 ** 3,
      selectedIds: ["installed-app-footprints"]
    },
    nativeScan: {
      findings: [
        {
          recipeId: "installed-app-footprints",
          items: [
            {
              id: "app-old-ide",
              name: "Old IDE 2023",
              path: "C:\\Program Files\\Old IDE 2023",
              bytes: 6 * 1024 ** 3,
              ageDays: 180,
              kind: "developer tool footprint",
              recommendation: "review",
              reason: "Large old app footprint",
              signals: [
                { label: "usage proof", value: "not proven", tone: "restricted" },
                { label: "uninstall entry", value: "present", tone: "safe" }
              ]
            }
          ]
        },
        {
          recipeId: "user-cache",
          title: "User .cache folder",
          path: "C:\\Users\\real\\.cache",
          bytes: 3 * 1024 ** 3,
          status: "measured"
        },
        {
          recipeId: "android-cache",
          title: "Android Studio cache folders",
          path: "C:\\Users\\real\\AppData\\Local\\Google\\AndroidStudio2025.1\\caches",
          bytes: 2 * 1024 ** 3,
          status: "measured"
        }
      ]
    },
    itemReviewsByAction: {
      "installed-app-footprints": {
        items: [
          {
            id: "app-old-ide",
            name: "Old IDE 2023",
            path: "C:\\Program Files\\Old IDE 2023",
            bytes: 6 * 1024 ** 3,
            ageDays: 180,
            kind: "developer tool footprint",
            recommendation: "review",
            decision: "remove",
            reason: "Manual uninstall candidate",
            signals: [
              { label: "usage proof", value: "not proven", tone: "restricted" },
              { label: "registry match", value: "Windows uninstall metadata", tone: "safe" },
              { label: "uninstall entry", value: "present", tone: "safe" },
              { label: "official action", value: "Windows Settings or vendor uninstaller", tone: "restricted" }
            ]
          }
        ]
      }
    },
    executorPlan: {
      rows: [
        {
          id: "large-user-files",
          title: "Large personal files",
          route: "item-review-large-files",
          archiveTargets: [
            {
              id: "old-video",
              name: "old-video.mov",
              path: "C:\\Users\\real\\Videos\\old-video.mov",
              bytes: 2 * 1024 ** 3,
              ageDays: 140,
              kind: "large personal file",
              decision: "archive",
              reason: "Move to external archive.",
              signals: [{ label: "modified age", value: "140d", tone: "review" }]
            }
          ]
        }
      ]
    },
    driveInventorySummary: {
      topRows: [
        {
          id: "drive-users",
          name: "Users",
          path: "C:\\Users",
          bytes: 256 * 1024 ** 3,
          status: "limited",
          classification: "user-data-review",
          nextStep: "Review user-owned folders manually."
        }
      ]
    },
    customRootTriage: {
      rows: [
        {
          id: "custom-root-1",
          title: "Custom folder: Archives",
          path: "C:\\Users\\real\\Archives",
          bytes: 7 * 1024 ** 3,
          status: "needs-disposition",
          disposition: "undecided",
          nextStep: "Choose keep, archive, move, or inspect later."
        }
      ]
    },
    consentReceipt: { planId: "plan-openai-manual" },
    writeReadiness: { status: "ready-for-real-execution", readyForRealExecution: true },
    releaseGate: { readyForRealRun: true },
    validationPack: { readyForRealRun: true },
    executionProofHandoff: { status: "waiting-for-execution", canRunRescan: false, primary: "Ready for first scoped executor." },
    rescanComparison: { status: "not-run", postRunScanEvidence: false }
  });
  assert.strictEqual(manualContext.execution.planId, "plan-openai-manual", "OpenAI context should expose the active execution plan id");
  assert.strictEqual(manualContext.execution.scanFingerprintPresent, true, "OpenAI context should expose scan fingerprint presence");
  assert.strictEqual(manualContext.execution.consentMatchesPlan, true, "OpenAI context should expose current consent match");
  assert.strictEqual(manualContext.execution.proofStatus, "waiting-for-execution", "OpenAI context should expose post-run proof state");
  assert.strictEqual(manualContext.execution.proofAllowsNextExecutor, true, "OpenAI context should expose whether another executor may run");
  assert.strictEqual(manualContext.execution.readyForRealExecution, true, "OpenAI context should expose write readiness");
  assert.strictEqual(manualContext.execution.validationReadyForRealRun, true, "OpenAI context should expose validation readiness");
  assert.strictEqual(manualContext.execution.releaseReadyForRealRun, true, "OpenAI context should expose release readiness");
  assert.strictEqual(manualContext.appBoundary.allowedActions.includes("recommend-manual-review"), true, "OpenAI context should permit manual-review recommendations");
  assert.strictEqual(manualContext.plan.id, "plan-openai-manual", "OpenAI context should include the current plan id");
  assert.strictEqual(manualContext.plan.selectedCount, 1, "OpenAI context should include current plan selection counts");
  assert.strictEqual(manualContext.manualReviewTargets[0].route, "manual-app-uninstall", "installed app candidates should enter the OpenAI context as manual uninstall targets");
  assert.strictEqual(manualContext.manualReviewTargets[0].manualOnly, true, "installed app candidates should stay manual-only in OpenAI context");
  assert.strictEqual(manualContext.manualReviewTargets[0].canCreateExecutor, false, "OpenAI context must not turn installed app review into an executor route");
  assert.strictEqual(manualContext.manualReviewTargets[0].selectedForRemoval, false, "manual uninstall decisions must not be represented as automatic removal authority");
  assert.strictEqual(manualContext.manualReviewTargets[0].signals[0].label, "usage proof", "OpenAI context should include structured app review signals");
  assert.strictEqual(manualContext.manualReviewTargets[0].signals[0].value, "not proven", "OpenAI context should not overclaim app usage proof");
  assert.strictEqual(manualContext.installedAppReview.manualOnly, true, "installed app review context should stay manual-only");
  assert.strictEqual(manualContext.installedAppReview.canCreateExecutor, false, "installed app review context must not create executor authority");
  assert.strictEqual(manualContext.installedAppReview.rows[0].status, "manual-uninstall-selected", "installed app review context should preserve manual uninstall selections");
  assert.strictEqual(manualContext.installedAppReview.rows[0].usageProof, "not proven", "installed app review context should preserve missing usage proof");
  assert.strictEqual(manualContext.installedAppReview.rows[0].uninstallEntry, "present", "installed app review context should preserve uninstall-entry evidence");
  assert(manualContext.installedAppReview.forbiddenActions.includes("automated-uninstall"), "installed app review context should forbid automated uninstall");
  assert.strictEqual(manualContext.installedAppUninstallWorkOrder.status, "ready-for-manual-uninstall", "OpenAI context should expose selected app uninstall work-order state");
  assert.strictEqual(manualContext.installedAppUninstallWorkOrder.manualOnly, true, "OpenAI app uninstall work order should stay manual-only");
  assert.strictEqual(manualContext.installedAppUninstallWorkOrder.canRunUninstaller, false, "OpenAI app uninstall work order must not run uninstallers");
  assert.strictEqual(manualContext.installedAppUninstallWorkOrder.rows[0].route, "manual-app-uninstall", "OpenAI app uninstall work order should route manual app follow-up explicitly");
  assert(manualContext.installedAppUninstallWorkOrder.forbiddenActions.includes("run-uninstall-string"), "OpenAI app uninstall work order should forbid uninstall-string execution");
  assert.strictEqual(manualContext.largeFileArchiveTargets[0].route, "item-review-large-files", "OpenAI context should include reviewed large-file archive targets");
  assert.strictEqual(manualContext.largeFileArchiveTargets[0].decision, "archive", "OpenAI context should preserve archive decisions");
  assert.strictEqual(manualContext.userCacheTargets[0].route, "bounded-user-cache-delete", "OpenAI context should include scanned user .cache targets");
  assert.strictEqual(manualContext.androidCacheTargets[0].route, "bounded-android-cache-delete", "OpenAI context should include scanned Android cache targets");
  assert.strictEqual(manualContext.driveInventoryRows[0].canCreateExecutor, false, "drive inventory rows should be advisory-only in OpenAI context");
  assert.strictEqual(manualContext.customRootRows[0].manualOnly, true, "custom root rows should be manual-only in OpenAI context");

  let nativeInvocation = null;
  const nativeResult = await openai.requestOpenAIAgentAdvice({
    config: openai.getOpenAIAgentConfig({ OPENAI_API_KEY: "renderer-key-should-not-cross" }),
    userPrompt: "Use the native advisor.",
    context: { schemaVersion: "spaceguard-openai-agent-context/v1", runtime: { openAiAgentAdvice: true } },
    host: {
      __TAURI__: {
        core: {
          invoke(command, payload) {
            nativeInvocation = { command, payload };
            return Promise.resolve({
              schemaVersion: "spaceguard-openai-agent-advice/v1",
              provider: "openai",
              model: "gpt-5.5",
              requestId: "req_native_openai",
              responseId: "resp_native_openai",
              createdAt: "unix:1",
              rawText: JSON.stringify({
                summary: "Native advisor returned a scoped plan.",
                nextAction: "Run a native scan first.",
                confidence: "medium",
                recommendedActions: [
                  {
                    id: "rescan",
                    title: "Refresh scan",
                    reason: "Native scan evidence should be current.",
                    priority: "high",
                    actionType: "rescan",
                    targetId: "",
                    route: ""
                  }
                ],
                blockedActions: [],
                questions: [],
                warnings: []
              }),
              advice: {
                summary: "Native advisor returned a scoped plan.",
                nextAction: "Run a native scan first.",
                confidence: "medium",
                recommendedActions: [
                  {
                    id: "rescan",
                    title: "Refresh scan",
                    reason: "Native scan evidence should be current.",
                    priority: "high",
                    actionType: "rescan",
                    targetId: "",
                    route: ""
                  }
                ],
                blockedActions: [],
                questions: [],
                warnings: []
              },
              keySource: ".env:OPENAI_API_KEY",
              transport: "native-tauri",
              warnings: ["advisory only"]
            });
          }
        }
      }
    }
  });
  assert.strictEqual(nativeInvocation.command, "openai_agent_advice", "OpenAI adapter should prefer the native Tauri advisor command");
  assert.strictEqual(nativeInvocation.payload.request.userPrompt, "Use the native advisor.", "native OpenAI request should pass the user prompt");
  assert.strictEqual(nativeInvocation.payload.request.context.schemaVersion, "spaceguard-openai-agent-context/v1", "native OpenAI request should pass bounded context");
  assert.strictEqual(nativeInvocation.payload.request.model, "gpt-5.5", "native OpenAI request should pass model preference without a key");
  assert.strictEqual(JSON.stringify(nativeInvocation.payload).includes("renderer-key-should-not-cross"), false, "renderer API key must not be sent to the native command");
  assert.strictEqual(nativeResult.transport, "native-tauri", "native OpenAI result should preserve transport");
  assert.strictEqual(nativeResult.keySource, ".env:OPENAI_API_KEY", "native OpenAI result should expose key source only");
  assert.strictEqual(nativeResult.advice.recommendedActions[0].actionType, "rescan", "native OpenAI result should normalize advice rows");
  const nativeRunRecord = openai.buildOpenAIAgentRunRecord({
    result: nativeResult,
    context: manualContext,
    userPrompt: "Use the native advisor.",
    planSnapshot: manualContext.plan,
    createdAt: "2026-06-05T00:00:00.000Z"
  });
  assert.strictEqual(nativeRunRecord.schemaVersion, "spaceguard-openai-agent-run/v1", "OpenAI run records should expose a schema version");
  assert.strictEqual(nativeRunRecord.planId, "plan-openai-manual", "OpenAI run records should bind advice to a plan id");
  assert.strictEqual(nativeRunRecord.context.counts.manualReviewTargets, 1, "OpenAI run records should retain compact context counts");
  assert.strictEqual(nativeRunRecord.context.counts.installedAppReviewRows, 1, "OpenAI run records should retain compact installed app review counts");
  assert.strictEqual(nativeRunRecord.context.counts.installedAppWorkOrderRows, 1, "OpenAI run records should retain compact app uninstall work-order counts");
  assert.strictEqual(nativeRunRecord.context.execution.scanFingerprintPresent, true, "OpenAI run records should retain compact scan proof presence");
  assert.strictEqual(nativeRunRecord.context.execution.proofStatus, "waiting-for-execution", "OpenAI run records should retain compact proof status");
  assert.strictEqual(nativeRunRecord.context.privacy.storesFullContext, false, "OpenAI run records should not persist the full path-level context");
  assert.strictEqual(nativeRunRecord.recommendationBroker.status, "not-recorded", "OpenAI run records should show missing broker provenance explicitly");
  assert.strictEqual(JSON.stringify(nativeRunRecord).includes("C:\\Program Files"), false, "OpenAI run records should not persist local app paths");
  assert.strictEqual(JSON.stringify(nativeRunRecord).includes("scan-openai-manual"), false, "OpenAI run records should not persist raw scan fingerprints");
  const appendedAgentRuns = openai.appendOpenAIAgentRunRecord([], nativeRunRecord);
  const dedupedAgentRuns = openai.appendOpenAIAgentRunRecord(appendedAgentRuns, nativeRunRecord);
  assert.strictEqual(appendedAgentRuns.length, 1, "OpenAI run history should append valid run records");
  assert.strictEqual(dedupedAgentRuns.length, 1, "OpenAI run history should dedupe repeated run records");

  await assert.rejects(
    () => openai.requestOpenAIAgentAdvice({ context: {}, userPrompt: "rank cleanup" }),
    /OPENAI_API_KEY/,
    "missing OpenAI key should explain the required .env setting"
  );

  let request = null;
  const result = await openai.requestOpenAIAgentAdvice({
    config: primaryConfig,
    userPrompt: "Find safe space to recover.",
    context: {
      schemaVersion: "spaceguard-openai-agent-context/v1",
      runtime: { realRunEnabled: true, npmCacheExecutor: true },
      npmCacheTargets: [{ id: "npm-cache", route: "bounded-npm-cache-delete", bytes: 1024 }]
    },
    fetchImpl(url, options) {
      request = {
        url,
        headers: options.headers,
        body: JSON.parse(options.body)
      };
      return Promise.resolve({
        ok: true,
        headers: {
          get(name) {
            return name === "x-request-id" ? "req_test_openai" : "";
          }
        },
        json() {
          return Promise.resolve({
            id: "resp_test_openai",
            model: "gpt-5.5",
            output: [
              {
                content: [
                  {
                    text: JSON.stringify({
                      summary: "npm cache is the fastest scoped recovery path.",
                      nextAction: "Run the npm cache executor after reviewing the target.",
                      confidence: "high",
                      recommendedActions: [
                        {
                          id: "npm-cache",
                          title: "Clean npm cache",
                          reason: "The runtime has a scoped npm executor and a scanned cache root.",
                          priority: "high",
                          actionType: "run-npm-cache-executor",
                          targetId: "npm-cache",
                          route: "bounded-npm-cache-delete"
                        }
                      ],
                      blockedActions: [],
                      questions: [],
                      warnings: ["Verify the scan fingerprint is current."]
                    })
                  }
                ]
              }
            ]
          });
        }
      });
    }
  });

  assert.strictEqual(request.url, "https://api.openai.com/v1/responses", "OpenAI advisor should call the Responses API endpoint");
  assert.strictEqual(request.headers.Authorization, "Bearer test-openai-key", "OpenAI key should be sent only as an Authorization header");
  assert.strictEqual(request.body.model, "gpt-5.5", "OpenAI request should use the configured model");
  assert.deepStrictEqual(request.body.reasoning, { effort: "low" }, "OpenAI request should include configured reasoning effort");
  assert.strictEqual(request.body.store, false, "OpenAI request should disable response storage");
  assert.strictEqual(request.body.text.format.type, "json_schema", "OpenAI request should use structured outputs");
  assert.strictEqual(request.body.text.format.strict, true, "OpenAI request should request strict schema adherence");
  assert.strictEqual(request.body.text.format.name, "spaceguard_cleanup_agent_advice", "OpenAI request should use the bounded advice schema");
  assert.strictEqual(request.body.input[0].role, "user", "OpenAI request should send bounded app context as user input");
  assert(request.body.input[0].content[0].text.includes("npmCacheTargets"), "OpenAI request should include the scan/planning context");
  assert(!JSON.stringify(result).includes("test-openai-key"), "OpenAI response object must not echo the API key");
  assert.strictEqual(result.requestId, "req_test_openai", "OpenAI result should preserve request id for support");
  assert.strictEqual(result.responseId, "resp_test_openai", "OpenAI result should preserve response id");
  assert.strictEqual(result.advice.confidence, "high", "OpenAI adapter should parse strict JSON advice");
  assert.strictEqual(result.advice.recommendedActions[0].actionType, "run-npm-cache-executor", "OpenAI adapter should preserve executor recommendation action type");
  assert.strictEqual(result.advice.recommendedActions[0].route, "bounded-npm-cache-delete", "OpenAI adapter should preserve executor route");
  const readyBroker = openai.buildOpenAIAgentRecommendationBroker({
    advice: result.advice,
    context: {
      plan: { id: "plan-npm" },
      runtime: { nativeAvailable: true, realRunEnabled: true, npmCacheExecutor: true },
      npmCacheTargets: [{ id: "npm-cache", route: "bounded-npm-cache-delete", bytes: 1024 }]
    },
    executionState: {
      planId: "plan-npm",
      scanFingerprint: "scan-npm",
      consentPlanId: "plan-npm"
    }
  });
  assert.strictEqual(readyBroker.schemaVersion, "spaceguard-openai-recommendation-broker/v1", "OpenAI recommendation broker should expose a schema");
  assert.strictEqual(readyBroker.rows[0].status, "ready", "broker should allow a scoped executor only when deterministic gates pass");
  assert.strictEqual(readyBroker.rows[0].canAct, true, "ready broker row should be actionable");
  assert.strictEqual(readyBroker.rows[0].directToolAccess, false, "brokered recommendations should not grant direct tool access");
  assert.strictEqual(readyBroker.counts.ready, 1, "broker should count ready recommendations");
  const manualAppBroker = openai.buildOpenAIAgentRecommendationBroker({
    advice: {
      recommendedActions: [
        {
          id: "manual-app-uninstall",
          title: "Review selected app uninstall work order",
          reason: "Selected app candidates need user-owned uninstall follow-up.",
          priority: "medium",
          actionType: "manual-only",
          targetId: "installed-app-footprints",
          route: "manual-app-uninstall"
        }
      ]
    },
    context: manualContext
  });
  assert.strictEqual(manualAppBroker.rows[0].kind, "manual", "manual app recommendations should stay manual broker rows");
  assert.strictEqual(manualAppBroker.rows[0].targetPanel, "app-uninstall-work-order-panel", "broker should route manual app recommendations to the app uninstall work-order panel");
  assert.strictEqual(manualAppBroker.rows[0].canAct, true, "manual app recommendations should be actionable as UI focus only");
  assert.strictEqual(manualAppBroker.rows[0].directToolAccess, false, "manual app recommendations must not grant tool access");
  const contextOnlyBroker = openai.buildOpenAIAgentRecommendationBroker({
    advice: result.advice,
    context: {
      plan: { id: "plan-npm" },
      runtime: { nativeAvailable: true, realRunEnabled: true, npmCacheExecutor: true },
      execution: {
        planId: "plan-npm",
        scanFingerprint: "scan-npm",
        consentPlanId: "plan-npm",
        proofStatus: "waiting-for-execution"
      },
      npmCacheTargets: [{ id: "npm-cache", route: "bounded-npm-cache-delete", bytes: 1024 }]
    }
  });
  assert.strictEqual(contextOnlyBroker.rows[0].status, "ready", "broker should use execution state embedded in the OpenAI context");
  const brokeredRunRecord = openai.buildOpenAIAgentRunRecord({
    result,
    context: { plan: { id: "plan-npm" }, runtime: { openAiKeySource: ".env:OPENAI_API_KEY" } },
    userPrompt: "Find safe space to recover.",
    planSnapshot: { id: "plan-npm" },
    recommendationBroker: readyBroker,
    createdAt: "2026-06-05T00:10:00.000Z"
  });
  assert.strictEqual(brokeredRunRecord.recommendationBroker.status, "broker-ready", "OpenAI run records should persist broker status");
  assert.strictEqual(brokeredRunRecord.recommendationBroker.counts.ready, 1, "OpenAI run records should persist broker readiness counts");
  assert.strictEqual(brokeredRunRecord.recommendationBroker.rows[0].checkIds.includes("feature-flag"), true, "OpenAI run records should retain compact broker check ids");
  assert.strictEqual(JSON.stringify(brokeredRunRecord).includes("scan-npm"), false, "broker provenance should not persist scan fingerprints");

  const blockedBroker = openai.buildOpenAIAgentRecommendationBroker({
    advice: result.advice,
    context: {
      plan: { id: "plan-npm" },
      runtime: { nativeAvailable: true, realRunEnabled: true, npmCacheExecutor: false },
      npmCacheTargets: [{ id: "npm-cache", route: "bounded-npm-cache-delete", bytes: 1024 }]
    },
    executionState: {
      planId: "plan-npm",
      scanFingerprint: "scan-npm",
      consentPlanId: "",
      proofStatus: "proof-required"
    }
  });
  assert.strictEqual(blockedBroker.rows[0].status, "blocked", "broker should block executor recommendations when a feature flag or consent gate is missing");
  assert.strictEqual(blockedBroker.rows[0].canAct, false, "blocked broker row should not execute");
  assert(blockedBroker.rows[0].checks.some((check) => check.id === "feature-flag" && !check.passed), "broker should expose missing feature-flag evidence");
  assert(blockedBroker.rows[0].checks.some((check) => check.id === "consent" && !check.passed), "broker should expose missing consent evidence");
  assert(blockedBroker.rows[0].checks.some((check) => check.id === "post-run-proof" && !check.passed), "broker should expose pending post-run proof evidence");

  const pnpmBroker = openai.buildOpenAIAgentRecommendationBroker({
    advice: {
      recommendedActions: [
        {
          id: "pnpm-store",
          title: "Clean pnpm store",
          reason: "The scanned pnpm store has a scoped executor.",
          priority: "medium",
          actionType: "run-pnpm-store-executor",
          targetId: "pnpm-store",
          route: "bounded-pnpm-store-delete"
        }
      ]
    },
    context: {
      plan: { id: "plan-pnpm" },
      runtime: { nativeAvailable: true, realRunEnabled: true, pnpmStoreExecutor: true },
      pnpmStoreTargets: [{ id: "pnpm-store", route: "bounded-pnpm-store-delete", bytes: 2048 }]
    },
    executionState: {
      planId: "plan-pnpm",
      scanFingerprint: "scan-pnpm",
      consentPlanId: "plan-pnpm"
    }
  });
  assert.strictEqual(pnpmBroker.rows[0].targetPanel, "pnpm-store-executor-panel", "broker should route pnpm recommendations to the pnpm executor panel");
  assert.strictEqual(pnpmBroker.rows[0].canAct, true, "broker should allow pnpm executor only when deterministic gates pass");
  assert.strictEqual(pnpmBroker.rows[0].buttonLabel, "Run pnpm cleanup", "broker should label pnpm executor recommendations");
  const userCacheBroker = openai.buildOpenAIAgentRecommendationBroker({
    advice: {
      recommendedActions: [
        {
          id: "user-cache",
          title: "Clean user .cache",
          reason: "The scanned current-user .cache root has a scoped executor.",
          priority: "medium",
          actionType: "run-user-cache-executor",
          targetId: "user-cache",
          route: "bounded-user-cache-delete"
        }
      ]
    },
    context: {
      plan: { id: "plan-user-cache" },
      runtime: { nativeAvailable: true, realRunEnabled: true, userCacheExecutor: true },
      userCacheTargets: [{ id: "user-cache", route: "bounded-user-cache-delete", bytes: 4096 }]
    },
    executionState: {
      planId: "plan-user-cache",
      scanFingerprint: "scan-user-cache",
      consentPlanId: "plan-user-cache"
    }
  });
  assert.strictEqual(userCacheBroker.rows[0].targetPanel, "user-cache-executor-panel", "broker should route user .cache recommendations to the user .cache panel");
  assert.strictEqual(userCacheBroker.rows[0].canAct, true, "broker should allow user .cache executor only when deterministic gates pass");
  assert.strictEqual(userCacheBroker.rows[0].buttonLabel, "Run .cache cleanup", "broker should label user .cache executor recommendations");
  const androidCacheBroker = openai.buildOpenAIAgentRecommendationBroker({
    advice: {
      recommendedActions: [
        {
          id: "android-cache",
          title: "Clean Android Studio cache",
          reason: "The scanned Android cache roots have a scoped executor.",
          priority: "medium",
          actionType: "run-android-cache-executor",
          targetId: "android-cache",
          route: "bounded-android-cache-delete"
        }
      ]
    },
    context: {
      plan: { id: "plan-android-cache" },
      runtime: { nativeAvailable: true, realRunEnabled: true, androidCacheExecutor: true },
      androidCacheTargets: [{ id: "android-cache-1", route: "bounded-android-cache-delete", bytes: 2048 }]
    },
    executionState: {
      planId: "plan-android-cache",
      scanFingerprint: "scan-android-cache",
      consentPlanId: "plan-android-cache"
    }
  });
  assert.strictEqual(androidCacheBroker.rows[0].targetPanel, "android-cache-executor-panel", "broker should route Android cache recommendations to the Android cache panel");
  assert.strictEqual(androidCacheBroker.rows[0].canAct, true, "broker should allow Android cache executor only when deterministic gates pass");
  assert.strictEqual(androidCacheBroker.rows[0].buttonLabel, "Run Android cache", "broker should label Android cache executor recommendations");

  console.log("openai agent adapter ok");
})();
