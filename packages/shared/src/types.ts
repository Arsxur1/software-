import { z } from "zod";

export const LANGS = ["uz", "ru"] as const;
export type Lang = (typeof LANGS)[number];

export const ROLES = ["buyer", "seller", "shop", "operator", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const CHECK_CATEGORIES = [
  "smartphone",
  "laptop",
  "tablet",
  "headphones",
  "smartwatch",
  "console",
  "tv",
  "camera",
  "other_electronics",
  "other",
] as const;
export type CheckCategory = (typeof CHECK_CATEGORIES)[number];

export const CURRENCIES = ["UZS", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

/**
 * Data extracted from a third-party listing. Must stay anonymised:
 * no seller names, phone numbers, usernames or links are allowed here.
 */
export const ExtractedListingSchema = z.object({
  is_listing: z.boolean().describe("false if the input is not a product listing at all"),
  category: z.enum(CHECK_CATEGORIES),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  model_key: z
    .string()
    .nullable()
    .describe("normalised lowercase key like 'apple iphone 13 128gb'"),
  specs: z.array(z.string()).describe("key characteristics, e.g. '128 GB', 'battery 87%'"),
  condition: z.enum(["new", "like_new", "good", "fair", "broken", "unknown"]),
  price_amount: z.number().nullable().describe("numeric price as written, e.g. 3500000 or 300"),
  price_currency: z.enum(CURRENCIES).nullable(),
  city: z.string().nullable(),
  seller_signals: z.object({
    prepayment: z.boolean().describe("asks for prepayment, card transfer, deposit/zadatok"),
    other_city: z.boolean().describe("seller is in another city or region"),
    shipping_only: z.boolean().describe("offers to send by post/courier only, no meeting"),
    urgency: z.boolean().describe("pressure: 'today only', 'many buyers', 'urgent'"),
    stock_photos: z.boolean().describe("photos look like stock/catalog images"),
    no_meeting: z.boolean().describe("refuses inspection or meeting"),
  }),
  suspicious_phrases: z.array(z.string()).describe("short anonymised quotes that look suspicious"),
  ai_market_estimate_uzs: z
    .object({ min: z.number(), max: z.number() })
    .nullable()
    .describe("rough Tashkent second-hand price range in UZS if you know it, else null"),
});
export type ExtractedListing = z.infer<typeof ExtractedListingSchema>;

export const CheckReportSchema = z.object({
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  questions: z.array(z.string()).describe("exactly 5 questions to ask the seller"),
  extra_red_flags: z.array(z.string()).describe("additional concrete red flags not already listed"),
  risk_adjustment: z
    .number()
    .describe("AI correction to the rule-based risk score, from -15 to 15"),
});
export type CheckReport = z.infer<typeof CheckReportSchema>;

export type PriceVerdictKind = "below" | "market" | "above" | "unknown";
export type PriceSource = "reference" | "catalog" | "ai" | "none";

export interface PriceVerdict {
  verdict: PriceVerdictKind;
  /** signed difference vs. market median, percent (negative = cheaper) */
  diffPct: number | null;
  priceUzs: number | null;
  range: { min: number; median: number; max: number } | null;
  source: PriceSource;
  approximate: boolean;
}

export type RiskLevel = "low" | "medium" | "high";

export interface RiskFlag {
  id: string;
  weight: number;
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
  flags: RiskFlag[];
  aiAdjustment: number;
}

/** What the API returns to the bot / Mini App for one check. */
export interface CheckResult {
  id: string;
  lang: Lang;
  createdAt: string;
  title: string;
  category: CheckCategory;
  price: PriceVerdict;
  risk: RiskResult;
  redFlags: string[];
  pros: string[];
  cons: string[];
  questions: string[];
  checklist: string[];
  remainingToday: number | null;
}
