import Anthropic from "@anthropic-ai/sdk";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import type { Config } from "./config.js";
import { AiService } from "./ai/aiService.js";
import { makeAuth } from "./auth/plugin.js";
import { Repo, startOfMonthUtc } from "./db/repo.js";
import type { Db } from "./db/client.js";
import { adminRoutes } from "./modules/admin/routes.js";
import { checkRoutes, multipartLimits } from "./modules/checks/routes.js";
import { CheckService } from "./modules/checks/service.js";
import { userRoutes } from "./modules/users/routes.js";

export interface AppDeps {
  config: Config;
  db: Db;
  /** Injected in tests; defaults to the real Anthropic client. */
  ai?: Pick<AiService, "structured">;
}

export async function buildApp({ config, db, ai }: AppDeps) {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "test" ? "silent" : "info",
      ...(config.LOG_FILE ? { file: config.LOG_FILE } : {}),
      redact: ["req.headers.authorization", 'req.headers["x-telegram-user"]'],
    },
    bodyLimit: 1024 * 1024,
  });
  await app.register(cors, { origin: config.CORS_ORIGIN === "*" ? true : config.CORS_ORIGIN.split(",") });
  await app.register(multipart, { limits: multipartLimits });
  app.addContentTypeParser("text/csv", { parseAs: "string" }, (_req, body, done) => done(null, body));

  const repo = new Repo(db, config.ADMIN_TELEGRAM_IDS);
  const aiService =
    ai ??
    new AiService({
      client: new Anthropic({ apiKey: config.ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 1 }),
      models: { fast: config.AI_MODEL_FAST, strong: config.AI_MODEL_STRONG },
      recordUsage: (u) => repo.recordAiUsage(u),
      monthlySpend: () => repo.aiSpendSince(startOfMonthUtc()),
      monthlyLimitUsd: () => repo.getSetting("ai_monthly_limit_usd", config.AI_MONTHLY_LIMIT_USD),
      logger: app.log,
    });

  const auth = makeAuth({
    repo,
    botToken: config.BOT_TOKEN,
    internalToken: config.INTERNAL_API_TOKEN,
    maxAgeSec: config.INIT_DATA_MAX_AGE_SEC,
  });
  const checks = new CheckService(repo, aiService, { checksPerDay: config.CHECKS_PER_DAY, usdRate: config.USD_RATE });

  app.get("/health", async () => ({ ok: true }));
  userRoutes(app, repo, checks, auth.requireUser);
  checkRoutes(app, checks, auth.requireUser);
  adminRoutes(app, repo, auth.requireRole("admin"));

  return app;
}
