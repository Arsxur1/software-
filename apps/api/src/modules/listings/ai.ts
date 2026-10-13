import type Anthropic from "@anthropic-ai/sdk";
import {
  ListingAnalysisSchema,
  ListingTextSchema,
  rangeFromMinMax,
  scrubPii,
  suggestPrice,
  type ListingAnalysis,
  type ListingText,
  type MarketRange,
  type PriceSuggestion,
} from "@ishonch/shared";
import type { AiService } from "../../ai/aiService.js";

export interface AnalyzeInput {
  /** JPEG buffers already downscaled for the AI. */
  images: Buffer[];
  transcript?: string;
  text?: string;
}

export interface AnalyzeDeps {
  ai: Pick<AiService, "structured">;
  usdRate: number;
  findReferencePrice: (modelKey: string) => Promise<MarketRange | null>;
}

export interface AnalyzeResult {
  analysis: ListingAnalysis;
  priceSuggestion: PriceSuggestion | null;
  costUsd: number;
}

export const MAX_QUESTIONS = 3;

export async function analyzeListing(input: AnalyzeInput, deps: AnalyzeDeps): Promise<AnalyzeResult> {
  const content: Anthropic.ContentBlockParam[] = input.images.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: "image/jpeg", data: img.toString("base64") },
  }));
  const words = [
    input.transcript?.trim() && `Seller's voice note (transcript):\n${input.transcript.trim()}`,
    input.text?.trim() && `Seller's text:\n${input.text.trim()}`,
  ].filter(Boolean);
  content.push({
    type: "text",
    text: words.length ? words.join("\n\n") : "The seller only sent photos. Identify the item from them.",
  });

  const res = await deps.ai.structured({
    feature: "listing.analyze",
    promptId: "listing_analyze",
    vars: { usd_rate: deps.usdRate },
    content,
    schema: ListingAnalysisSchema,
  });
  const analysis: ListingAnalysis = {
    ...res.data,
    specs: res.data.specs.map((s) => ({ name: s.name, value: scrubPii(s.value) })),
    questions: res.data.questions.slice(0, MAX_QUESTIONS),
    photo_hints: input.images.length ? res.data.photo_hints.slice(0, 3) : res.data.photo_hints.slice(0, 1),
  };

  let priceSuggestion: PriceSuggestion | null = null;
  if (analysis.model_key) {
    const ref = await deps.findReferencePrice(analysis.model_key);
    if (ref) priceSuggestion = suggestPrice(ref, "reference");
  }
  if (!priceSuggestion && analysis.ai_market_estimate_uzs) {
    priceSuggestion = suggestPrice(
      rangeFromMinMax(analysis.ai_market_estimate_uzs.min, analysis.ai_market_estimate_uzs.max),
      "ai",
    );
  }
  return { analysis, priceSuggestion, costUsd: res.usage.costUsd };
}

export interface GenerateInput {
  analysis: ListingAnalysis;
  /** question key -> seller's answer */
  answers: Record<string, string>;
  sellerWords?: string;
}

/** Writes RU + UZ title/description from confirmed facts only. */
export async function generateListingText(
  input: GenerateInput,
  deps: { ai: Pick<AiService, "structured"> },
): Promise<{ text: ListingText; costUsd: number }> {
  const a = input.analysis;
  const answered = a.questions
    .filter((q) => input.answers[q.key]?.trim())
    .map((q) => ({ question: q.question_ru, answer: input.answers[q.key]!.trim() }));

  const facts = {
    category: a.category,
    brand: a.brand,
    model: a.model,
    specs: a.specs,
    condition: a.condition,
    visible_defects: a.visible_defects,
    seller_answers: answered,
    seller_words: input.sellerWords ? scrubPii(input.sellerWords) : null,
  };

  const res = await deps.ai.structured({
    feature: "listing.generate",
    promptId: "listing_generate",
    content: [{ type: "text", text: JSON.stringify(facts, null, 1) }],
    schema: ListingTextSchema,
  });
  const clean = (s: string) => scrubPii(s).trim();
  return {
    text: {
      title_ru: clean(res.data.title_ru).slice(0, 80),
      title_uz: clean(res.data.title_uz).slice(0, 80),
      description_ru: clean(res.data.description_ru),
      description_uz: clean(res.data.description_uz),
    },
    costUsd: res.usage.costUsd,
  };
}
