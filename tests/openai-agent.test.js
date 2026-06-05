const assert = require("assert");

(async () => {
  const openai = await import("../src/openai-agent.mjs");

  const primaryConfig = openai.getOpenAIAgentConfig({
    OPENAI_API_KEY: "test-openai-key",
    OPENAI_MODEL: "gpt-5.2",
    OPENAI_REASONING_EFFORT: "low"
  });
  assert.strictEqual(primaryConfig.connected, true, "OPENAI_API_KEY should configure the OpenAI advisor");
  assert.strictEqual(primaryConfig.model, "gpt-5.2", "OpenAI advisor should accept OPENAI_MODEL");
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
            model: "gpt-5.2",
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
  assert.strictEqual(request.body.model, "gpt-5.2", "OpenAI request should use the configured model");
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

  console.log("openai agent adapter ok");
})();
