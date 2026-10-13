import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull().unique(),
  phone: text("phone"),
  language: text("language").notNull().default("uz"),
  role: text("role").notNull().default("buyer"),
  acceptedTermsAt: timestamp("accepted_terms_at", { withTimezone: true }),
  createdAt: createdAt(),
  bannedAt: timestamp("banned_at", { withTimezone: true }),
  banReason: text("ban_reason"),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id"),
  slug: text("slug").notNull().unique(),
  nameRu: text("name_ru").notNull(),
  nameUz: text("name_uz").notNull(),
  attributesSchema: jsonb("attributes_schema").notNull().default({}),
});

export const priceReference = pgTable(
  "price_reference",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id").references(() => categories.id),
    modelKey: text("model_key").notNull().unique(),
    priceMin: bigint("price_min", { mode: "number" }).notNull(),
    priceMedian: bigint("price_median", { mode: "number" }).notNull(),
    priceMax: bigint("price_max", { mode: "number" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    source: text("source").notNull().default("manual"),
  },
  (t) => [index("price_reference_model_key_trgm").using("gin", sql`${t.modelKey} gin_trgm_ops`)],
);

/** One module-B check. Only anonymised data is stored (no screenshots, names or phones). */
export const checks = pgTable(
  "checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    lang: text("lang").notNull(),
    inputType: text("input_type").notNull(),
    extracted: jsonb("extracted").notNull(),
    priceVerdict: text("price_verdict").notNull(),
    priceDiffPct: integer("price_diff_pct"),
    priceUzs: bigint("price_uzs", { mode: "number" }),
    priceSource: text("price_source").notNull(),
    riskScore: integer("risk_score").notNull(),
    riskLevel: text("risk_level").notNull(),
    flags: jsonb("flags").notNull(),
    result: jsonb("result").notNull(),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6, mode: "number" }).notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("checks_user_created_idx").on(t.userId, t.createdAt)],
);

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    feature: text("feature").notNull(),
    model: text("model").notNull(),
    promptId: text("prompt_id"),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6, mode: "number" }).notNull(),
    durationMs: integer("duration_ms").notNull().default(0),
    requestId: text("request_id"),
    createdAt: createdAt(),
  },
  (t) => [index("ai_usage_created_idx").on(t.createdAt)],
);

export const events = pgTable("events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  props: jsonb("props").notNull().default({}),
  createdAt: createdAt(),
});

/** Runtime-editable configuration (limits, risk rules, currency rate). */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
