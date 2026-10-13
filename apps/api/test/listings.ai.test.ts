import { describe, expect, it } from "vitest";
import { sameModel, suggestPrice, type MarketRange } from "@ishonch/shared";
import { analyzeListing, generateListingText } from "../src/modules/listings/ai.js";
import { listingFixtures, mockAiByPrompt } from "./helpers.js";

const REFERENCE: Record<string, MarketRange> = {
  "apple iphone 12 128gb": { min: 3_600_000, median: 4_200_000, max: 4_800_000 },
  "apple macbook air m1 256gb": { min: 7_000_000, median: 7_800_000, max: 8_800_000 },
  "sony playstation 5": { min: 5_500_000, median: 6_300_000, max: 7_000_000 },
};
const findReferencePrice = async (k: string) => Object.entries(REFERENCE).find(([r]) => sameModel(r, k))?.[1] ?? null;

describe("module D AI pipeline on fixtures (RU + UZ electronics)", () => {
  for (const f of listingFixtures) {
    it(f.name, async () => {
      const ai = mockAiByPrompt({ listing_analyze: f.mock_analysis, listing_generate: f.mock_text });
      const a = await analyzeListing({ images: [], transcript: f.input }, { ai, usdRate: 12_800, findReferencePrice });
      expect(a.analysis.category).toBe(f.expect.category);
      expect(a.analysis.model_key).toContain(f.expect.model_key_contains);
      expect(a.analysis.questions.length).toBeLessThanOrEqual(f.expect.max_questions);
      expect(a.priceSuggestion).not.toBeNull();
      expect(a.priceSuggestion!.quick).toBeLessThanOrEqual(a.priceSuggestion!.market);
      expect(a.priceSuggestion!.market).toBeLessThanOrEqual(a.priceSuggestion!.max);

      const g = await generateListingText({ analysis: a.analysis, answers: f.answers, sellerWords: f.input }, { ai });
      for (const field of [g.text.title_ru, g.text.title_uz, g.text.description_ru, g.text.description_uz]) {
        expect(field.length).toBeGreaterThan(5);
        for (const bad of f.expect.forbidden) expect(field).not.toContain(bad);
      }
      for (const must of f.expect.must_mention) expect(`${g.text.description_ru} ${g.text.description_uz}`).toContain(must);
      expect(a.costUsd + g.costUsd).toBeLessThan(0.02);
    });
  }

  it("uses the reference price when the model is known, AI estimate otherwise", async () => {
    const iphone = listingFixtures.find((f) => f.name === "iphone12_voice_uz")!;
    const ai = mockAiByPrompt({ listing_analyze: iphone.mock_analysis });
    const a = await analyzeListing({ images: [], text: iphone.input }, { ai, usdRate: 12_800, findReferencePrice });
    expect(a.priceSuggestion).toEqual({ quick: 3_780_000, market: 4_200_000, max: 4_800_000, source: "reference", approximate: false });

    const airpods = listingFixtures.find((f) => f.name === "airpods_pro2_voice_ru")!;
    const b = await analyzeListing(
      { images: [], text: airpods.input },
      { ai: mockAiByPrompt({ listing_analyze: airpods.mock_analysis }), usdRate: 12_800, findReferencePrice },
    );
    expect(b.priceSuggestion?.source).toBe("ai");
    expect(b.priceSuggestion?.approximate).toBe(true);
  });

  it("asks at most 3 questions and passes only answered ones to the writer", async () => {
    const f = listingFixtures.find((x) => x.name === "samsung_a54_photo_only_ru")!;
    const many = { ...f.mock_analysis, questions: [...f.mock_analysis.questions, ...f.mock_analysis.questions] };
    const ai = mockAiByPrompt({ listing_analyze: many, listing_generate: f.mock_text });
    const a = await analyzeListing({ images: [Buffer.from("x")] }, { ai, usdRate: 12_800, findReferencePrice });
    expect(a.analysis.questions).toHaveLength(3);

    await generateListingText({ analysis: f.mock_analysis, answers: { storage: "256 ГБ" } }, { ai });
    const facts = JSON.parse((ai.calls.at(-1)!.content as Array<{ text: string }>)[0]!.text);
    expect(facts.seller_answers).toEqual([{ question: "Сколько памяти?", answer: "256 ГБ" }]);
  });

  it("scrubs phone numbers the model might copy from the seller", async () => {
    const f = listingFixtures[0]!;
    const ai = mockAiByPrompt({
      listing_generate: { ...f.mock_text, description_ru: "Звоните +998 90 123 45 67" },
    });
    const g = await generateListingText({ analysis: f.mock_analysis, answers: {} }, { ai });
    expect(g.text.description_ru).toBe("Звоните [phone]");
  });

  it("price suggestion rounds and keeps quick ≥ market minimum", () => {
    expect(suggestPrice({ min: 5_500_000, median: 5_800_000, max: 6_500_000 }, "reference")).toMatchObject({
      quick: 5_500_000,
      market: 5_800_000,
      max: 6_500_000,
    });
  });
});
