const assert = require("assert");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "run-openai-advisor-smoke.mjs");

(async () => {
  const smoke = await import(pathToFileURL(script).href);

  const pnpmRoute = smoke.resolveSmokeRoute("pnpm-store");
  assert.strictEqual(pnpmRoute.requiredRecommendation.actionType, "run-pnpm-store-executor", "pnpm smoke should require the pnpm executor");
  assert.strictEqual(pnpmRoute.requiredRecommendation.targetId, "pnpm-store", "pnpm smoke should target the pnpm store row");
  assert.strictEqual(pnpmRoute.requiredRecommendation.route, "bounded-pnpm-store-delete", "pnpm smoke should use the pnpm route");

  const context = smoke.buildRouteContractContext({ routeInput: "pnpm-store" });
  assert.strictEqual(context.liveRouteValidation.schemaVersion, "spaceguard-openai-live-route-validation/v1", "pnpm route-contract smoke should expose live route validation");
  assert.strictEqual(context.liveRouteValidation.route, "bounded-pnpm-store-delete", "pnpm route-contract smoke should bind OpenAI to the selected live route");
  assert.strictEqual(context.liveRouteValidation.requestMode, "execute-pnpm-store", "pnpm route-contract smoke should expose the native request mode");
  assert.strictEqual(context.liveRouteValidation.panelId, "pnpm-store-executor-panel", "pnpm route-contract smoke should expose the target UI panel");
  assert.strictEqual(context.liveRouteValidation.canExecuteWithoutAppEvidence, false, "pnpm route-contract smoke should require app evidence before execution");
  assert.strictEqual(context.liveRouteValidation.nativeBoundary.adapterFunction, "runNativePnpmStoreExecutor", "pnpm route-contract smoke should expose the pnpm native adapter");
  assert.strictEqual(context.liveRouteValidation.nativeBoundary.rustFunction, "execute_pnpm_store_cleanup", "pnpm route-contract smoke should expose the pnpm Rust executor branch");
  assert(context.liveRouteValidation.nativeBoundary.targetRejects.some((row) => row.includes("node_modules")), "pnpm route-contract smoke should expose pnpm target rejects");
  assert(context.liveRouteValidation.nativeBoundary.deletePolicy.some((row) => row.includes("versioned")), "pnpm route-contract smoke should expose pnpm versioned store deletion scope");
  const task = context.agentTaskQueue.rows.find((row) =>
    row.actionType === "run-pnpm-store-executor" &&
    row.targetId === "pnpm-store" &&
    row.route === "bounded-pnpm-store-delete"
  );
  assert(task, "pnpm route context should expose a pnpm executor task");
  assert.strictEqual(task.status, "ready", "pnpm route task should be broker-ready");

  const result = smoke.buildRouteContractAdviceResult({ requiredRecommendation: pnpmRoute.requiredRecommendation });
  const broker = smoke.buildRouteContractRecommendationBroker({ context, advice: result.advice, route: pnpmRoute });
  const validation = smoke.validateSmokeAdvice({
    context,
    advice: result.advice,
    broker,
    requiredRecommendation: pnpmRoute.requiredRecommendation
  });

  assert.strictEqual(validation.passed, true, `pnpm route-contract advice should validate: ${validation.failures.join(", ")}`);
  const mismatchedLiveRouteValidation = smoke.validateSmokeAdvice({
    context: {
      ...context,
      liveRouteValidation: {
        ...context.liveRouteValidation,
        route: "bounded-npm-cache-delete",
        requestMode: "execute-npm-cache",
        panelId: "npm-cache-executor-panel"
      }
    },
    advice: result.advice,
    broker,
    requiredRecommendation: pnpmRoute.requiredRecommendation
  });
  assert.strictEqual(mismatchedLiveRouteValidation.passed, false, "smoke validation should fail when the live route contract differs from the required recommendation");
  assert(mismatchedLiveRouteValidation.failures.some((failure) => failure.includes("live route contract")), "smoke validation should explain live route contract mismatches");

  for (const supportedRoute of smoke.listSupportedSmokeRoutes()) {
    const route = smoke.resolveSmokeRoute(supportedRoute.aliases[0]);
    const routeContext = smoke.buildRouteContractContext({ routeInput: supportedRoute.aliases[0] });
    assert.strictEqual(routeContext.liveRouteValidation.route, route.route, `${route.route} smoke should expose the selected live route contract`);
    assert.strictEqual(routeContext.liveRouteValidation.requestMode, route.spec.requestMode, `${route.route} smoke should expose the selected request mode`);
    const routeResult = smoke.buildRouteContractAdviceResult({ requiredRecommendation: route.requiredRecommendation });
    const routeBroker = smoke.buildRouteContractRecommendationBroker({ context: routeContext, advice: routeResult.advice, route });
    const routeValidation = smoke.validateSmokeAdvice({
      context: routeContext,
      advice: routeResult.advice,
      broker: routeBroker,
      requiredRecommendation: route.requiredRecommendation
    });
    assert.strictEqual(routeValidation.passed, true, `${supportedRoute.route} smoke should validate: ${routeValidation.failures.join(", ")}`);
  }

  console.log("openai smoke ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
