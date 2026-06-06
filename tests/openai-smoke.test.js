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

  const context = smoke.buildFixtureContext({ routeInput: "pnpm-store" });
  const task = context.agentTaskQueue.rows.find((row) =>
    row.actionType === "run-pnpm-store-executor" &&
    row.targetId === "pnpm-store" &&
    row.route === "bounded-pnpm-store-delete"
  );
  assert(task, "pnpm fixture context should expose a pnpm executor task");
  assert.strictEqual(task.status, "ready", "pnpm fixture task should be broker-ready");

  const result = smoke.buildFixtureOnlyAdviceResult({ requiredRecommendation: pnpmRoute.requiredRecommendation });
  const broker = smoke.buildFixtureRecommendationBroker({ context, advice: result.advice, route: pnpmRoute });
  const validation = smoke.validateSmokeAdvice({
    context,
    advice: result.advice,
    broker,
    requiredRecommendation: pnpmRoute.requiredRecommendation
  });

  assert.strictEqual(validation.passed, true, `pnpm fixture advice should validate: ${validation.failures.join(", ")}`);

  for (const supportedRoute of smoke.listSupportedSmokeRoutes()) {
    const route = smoke.resolveSmokeRoute(supportedRoute.aliases[0]);
    const routeContext = smoke.buildFixtureContext({ routeInput: supportedRoute.aliases[0] });
    const routeResult = smoke.buildFixtureOnlyAdviceResult({ requiredRecommendation: route.requiredRecommendation });
    const routeBroker = smoke.buildFixtureRecommendationBroker({ context: routeContext, advice: routeResult.advice, route });
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
