import type Anthropic from "@anthropic-ai/sdk";
import {
  CheckReportSchema,
  ExtractedListingSchema,
  inspectionChecklist,
  priceVerdict,
  rangeFromMinMax,
  scoreRisk,
  scrubPii,
  t,
  toUzs,
  type CheckReport,
  type CheckResult,
  type ExtractedListing,
  type Lang,
  type MarketRange,
  type PriceSource,
  type RiskRules,
} from "@ishonch/shared";
import type { AiService } from "../../ai/aiService.js";

export interface CheckImage {
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  base64: string;
}

export interface CheckInput {
  lang: Lang;
  text?: string;
  images?: CheckImage[];
}

export interface CheckPipelineDeps {
  ai: Pick<AiService, "structured">;
  findReferencePrice: (modelKey: string) => Promise<MarketRange | null>;
  /** Median of similar listings in our own catalog (module A); returns null until the catalog exists. */
  findCatalogPrice: (modelKey: string) => Promise<MarketRange | null>;
  usdRate: number;
  riskRules: RiskRules;
}

export interface CheckOutcome {
  extracted: ExtractedListing;
  result: Omit<CheckResult, "id" | "createdAt" | "remainingToday">;
  costUsd: number;
  notListing: boolean;
}

const LANG_NAME: Record<Lang, string> = { ru: "Russian", uz: "Uzbek (Latin script)" };

/** Electronics priced below this in "UZS" were almost certainly typed in USD. */
const USD_GUESS_THRESHOLD = 10_000;

export function anonymise(e: ExtractedListing): ExtractedListing {
  return {
    ...e,
    city: e.city ? scrubPii(e.city) : null,
    specs: e.specs.map(scrubPii),
    suspicious_phrases: e.suspicious_phrases.map(scrubPii),
  };
}

export async function runCheck(input: CheckInput, deps: CheckPipelineDeps): Promise<CheckOutcome> {
  const content: Anthropic.ContentBlockParam[] = [];
  for (const img of input.images ?? []) {
    content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } });
  }
  content.push({
    type: "text",
    text: input.text?.trim()
      ? `Listing text / buyer description:\n${input.text.trim()}`
      : "Extract the listing from the screenshots above.",
  });

  // 1. Extraction
  const extractedCall = await deps.ai.structured({
    feature: "check.extract",
    promptId: "check_extract",
    vars: { usd_rate: deps.usdRate },
    content,
    schema: ExtractedListingSchema,
  });
  const extracted = anonymise(extractedCall.data);
  let cost = extractedCall.usage.costUsd;

  // 2. Market price
  let priceUzs: number | null = null;
  if (extracted.price_amount != null && extracted.price_amount > 0) {
    const currency =
      extracted.price_currency ?? (extracted.price_amount < USD_GUESS_THRESHOLD ? "USD" : "UZS");
    priceUzs = toUzs(extracted.price_amount, currency, deps.usdRate);
  }

  let range: MarketRange | null = null;
  let source: PriceSource = "none";
  if (extracted.model_key) {
    range = await deps.findReferencePrice(extracted.model_key);
    if (range) source = "reference";
    else {
      range = await deps.findCatalogPrice(extracted.model_key);
      if (range) source = "catalog";
    }
  }
  if (!range && extracted.ai_market_estimate_uzs) {
    range = rangeFromMinMax(extracted.ai_market_estimate_uzs.min, extracted.ai_market_estimate_uzs.max);
    if (range) source = "ai";
  }
  const price = priceVerdict(priceUzs, range, source);

  // 3. Rule-based risk (before AI adjustment)
  const s = extracted.seller_signals;
  const signals = {
    priceDiffPct: price.diffPct,
    prepayment: s.prepayment,
    otherCity: s.other_city,
    shippingOnly: s.shipping_only || s.no_meeting,
    stockOrDuplicatePhotos: s.stock_photos,
    urgency: s.urgency,
  };
  const ruleRisk = scoreRisk(signals, deps.riskRules);

  const title = [extracted.brand, extracted.model].filter(Boolean).join(" ") || extracted.category;

  if (!extracted.is_listing) {
    return {
      extracted,
      notListing: true,
      costUsd: cost,
      result: emptyResult(input.lang, title, extracted, price, ruleRisk),
    };
  }

  // 4. Buyer-facing report
  const reportCall = await deps.ai.structured({
    feature: "check.report",
    promptId: "check_report",
    vars: { lang_name: LANG_NAME[input.lang] },
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            listing: {
              category: extracted.category,
              brand: extracted.brand,
              model: extracted.model,
              specs: extracted.specs,
              condition: extracted.condition,
              price_uzs: priceUzs,
              city: extracted.city,
              seller_signals: extracted.seller_signals,
              suspicious_phrases: extracted.suspicious_phrases,
            },
            price_verdict: price,
            rule_flags: ruleRisk.flags.map((f) => f.id),
            rule_score: ruleRisk.score,
          },
          null,
          1,
        ),
      },
    ],
    schema: CheckReportSchema,
  });
  cost += reportCall.usage.costUsd;
  const report: CheckReport = reportCall.data;

  const risk = scoreRisk({ ...signals, aiAdjustment: report.risk_adjustment }, deps.riskRules);
  const ruleFlagTexts = risk.flags
    .filter((f) => f.weight > 0)
    .map((f) => t(input.lang, `check.flag.${f.id}` as Parameters<typeof t>[1]));

  return {
    extracted,
    notListing: false,
    costUsd: cost,
    result: {
      lang: input.lang,
      title,
      category: extracted.category,
      price,
      risk,
      redFlags: [...ruleFlagTexts, ...report.extra_red_flags.map(scrubPii)],
      pros: report.pros,
      cons: report.cons,
      questions: report.questions.slice(0, 5),
      checklist: inspectionChecklist(input.lang, extracted.category),
    },
  };
}

function emptyResult(
  lang: Lang,
  title: string,
  extracted: ExtractedListing,
  price: CheckOutcome["result"]["price"],
  risk: CheckOutcome["result"]["risk"],
): CheckOutcome["result"] {
  return {
    lang,
    title,
    category: extracted.category,
    price,
    risk,
    redFlags: [],
    pros: [],
    cons: [],
    questions: [],
    checklist: [],
  };
}
