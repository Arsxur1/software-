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
import { listingRoutes, MAX_UPLOAD_BYTES } from "./modules/listings/routes.js";
import { ListingService } from "./modules/listings/service.js";
import { ShopService } from "./modules/shops/service.js";
import { FsStorage, S3Storage, type Storage } from "./storage/storage.js";
import { DisabledSpeechToText, HttpWhisperSpeechToText, type SpeechToText } from "./stt/speechToText.js";
import { BotApiPublisher, type ChannelPublisher } from "./telegram/publisher.js";

export interface AppDeps {
  config: Config;
  db: Db;
  /** Injected in tests; defaults to the real Anthropic client. */
  ai?: Pick<AiService, "structured">;
  storage?: Storage;
  stt?: SpeechToText;
  publisher?: ChannelPublisher | null;
}

export function createStorage(config: Config): Storage {
  return config.STORAGE_DRIVER === "s3"
    ? new S3Storage(config.MINIO_BUCKET, {
        endpoint: config.MINIO_ENDPOINT,
        accessKeyId: config.MINIO_ROOT_USER,
        secretAccessKey: config.MINIO_ROOT_PASSWORD,
      })
    : new FsStorage(config.STORAGE_DIR);
}

export async function buildApp({ config, db, ai, storage, stt, publisher }: AppDeps) {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "test" ? "silent" : "info",
      ...(config.LOG_FILE ? { file: config.LOG_FILE } : {}),
      redact: ["req.headers.authorization", 'req.headers["x-telegram-user"]'],
    },
    bodyLimit: 1024 * 1024,
  });
  await app.register(cors, { origin: config.CORS_ORIGIN === "*" ? true : config.CORS_ORIGIN.split(",") });
  await app.register(multipart, {
    limits: { ...multipartLimits, files: 12, fileSize: Math.max(multipartLimits.fileSize, MAX_UPLOAD_BYTES) },
  });
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

  const store = storage ?? createStorage(config);
  const shopsSvc = new ShopService(repo, store);
  const listingsSvc = new ListingService({
    repo,
    ai: aiService,
    storage: store,
    stt:
      stt ??
      (config.STT_URL
        ? new HttpWhisperSpeechToText({ url: config.STT_URL, apiKey: config.STT_API_KEY, model: config.STT_MODEL })
        : new DisabledSpeechToText()),
    publisher: publisher !== undefined ? publisher : config.BOT_TOKEN ? new BotApiPublisher(config.BOT_TOKEN, config.MINIAPP_LINK) : null,
    photoSecret: config.PHOTO_URL_SECRET || `${config.INTERNAL_API_TOKEN}:photos`,
    usdRate: config.USD_RATE,
    codPlatformEnabled: config.COD_PLATFORM_ENABLED,
  });

  app.get("/health", async () => ({ ok: true }));
  userRoutes(app, repo, checks, auth.requireUser);
  checkRoutes(app, checks, auth.requireUser);
  adminRoutes(app, repo, auth.requireRole("admin"));
  listingRoutes(app, listingsSvc, shopsSvc, repo, {
    requireUser: auth.requireUser,
    requireInternal: auth.requireInternal,
    optionalUser: auth.optionalUser,
    requireAdmin: auth.requireRole("admin"),
  });

  return app;
}
