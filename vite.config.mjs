import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { getOpenAIAgentConfig, requestOpenAIAgentAdvice } from "./src/openai-agent.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), spaceguardOpenAIAgentProxy(env)],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url))
      }
    },
    server: {
      host: "127.0.0.1",
      port: 4173,
      strictPort: false
    },
    preview: {
      host: "127.0.0.1",
      port: 4173,
      strictPort: false
    }
  };
});

function spaceguardOpenAIAgentProxy(env) {
  return {
    name: "spaceguard-openai-agent-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || "/", "http://127.0.0.1");
        if (url.pathname === "/api/openai-agent/status") {
          const config = getOpenAIAgentConfig(env);
          writeJson(res, 200, {
            schemaVersion: "spaceguard-openai-agent-proxy-status/v1",
            configured: Boolean(config.apiKey),
            provider: config.provider,
            model: config.model,
            keySource: config.apiKey ? config.keySource : "missing",
            reasoningEffort: config.reasoningEffort,
            transport: "vite-dev-proxy"
          });
          return;
        }
        if (url.pathname !== "/api/openai-agent/advice") {
          next();
          return;
        }
        if (req.method !== "POST") {
          writeJson(res, 405, { error: { message: "Use POST for OpenAI agent advice." } });
          return;
        }

        try {
          const request = await readJsonBody(req);
          if (request?.context?.schemaVersion !== "spaceguard-openai-agent-context/v1") {
            writeJson(res, 400, { error: { message: "OpenAI advisor requires a SpaceGuard context packet." } });
            return;
          }

          const config = getOpenAIAgentConfig(env);
          if (!config.apiKey) {
            writeJson(res, 500, {
              error: { message: "Set OPENAI_API_KEY in .env and restart the Vite dev server." },
              configured: false,
              keySource: "missing",
              transport: "vite-dev-proxy"
            });
            return;
          }

          const result = await requestOpenAIAgentAdvice({
            context: request.context,
            userPrompt: request.userPrompt,
            config: {
              ...config,
              model: request.model || config.model,
              reasoningEffort: request.reasoningEffort || config.reasoningEffort
            },
            host: {},
            fetchImpl: globalThis.fetch
          });
          if (result.requestId) res.setHeader("x-request-id", result.requestId);
          writeJson(res, 200, {
            ...result,
            keySource: config.keySource,
            transport: "vite-dev-proxy"
          });
        } catch (error) {
          writeJson(res, 500, {
            error: { message: error instanceof Error ? error.message : String(error) },
            transport: "vite-dev-proxy"
          });
        }
      });
    }
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    req.on("data", (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > 1024 * 1024) {
        reject(new Error("OpenAI advisor request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("OpenAI advisor request body must be JSON."));
      }
    });
    req.on("error", reject);
  });
}

function writeJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
