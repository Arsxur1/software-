import { z } from "zod";

const csvNumbers = z
  .string()
  .default("")
  .transform((s) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map(Number),
  );

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().default("postgres://ishonch:ishonch@localhost:5432/ishonch"),
  BOT_TOKEN: z.string().default(""),
  INTERNAL_API_TOKEN: z.string().default("dev-internal-token"),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL_FAST: z.string().default("claude-haiku-5-5"),
  AI_MODEL_STRONG: z.string().default("claude-opus-5-5"),
  AI_MONTHLY_LIMIT_USD: z.coerce.number().default(50),
  CHECKS_PER_DAY: z.coerce.number().default(5),
  USD_RATE: z.coerce.number().default(12800),
  ADMIN_TELEGRAM_IDS: csvNumbers,
  INIT_DATA_MAX_AGE_SEC: z.coerce.number().default(24 * 3600),
  CORS_ORIGIN: z.string().default("*"),
  LOG_FILE: z.string().optional(),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return EnvSchema.parse(env);
}
