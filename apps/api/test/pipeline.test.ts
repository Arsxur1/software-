import { describe, expect, it } from "vitest";
import { DEFAULT_RISK_RULES, sameModel, type MarketRange } from "@ishonch/shared";
import { runCheck } from "../src/modules/checks/pipeline.js";
import { fixtures, mockAi } from "./helpers.js";

// Mirrors part of the seed so the test does not need a database.
const REFERENCE: Record<string, MarketRange> = {
  "apple iphone 13 128gb": { min: 5_200_000, median: 5_800_000, max: 6_500_000 },
  "samsung galaxy a54 256gb": { min: 2_700_000, median: 3_100_000, max: 3_500_000 },
  "apple macbook air m1 256gb": { min: 7_000_000, median: 7_800_000, max: 8_800_000 },
};

const findReferencePrice = async (key: string) =>
  Object.entries(REFERENCE).find(([k]) => sameModel(k, key))?.[1] ?? null;

describe("check pipeline on fixtures (RU + UZ electronics)", () => {
  for (const f of fixtures) {
    it(f.name, async () => {
      const ai = mockAi(f.mock_extract);
      const out = await runCheck(
        { lang: f.lang, text: f.input },
        { ai, findReferencePrice, findCatalogPrice: async () => null, usdRate: 12_800, riskRules: DEFAULT_RISK_RULES },
      );
      expect(ai.calls).toEqual(["check_extract", "check_report"]);
      expect(out.result.category).toBe(f.expect.category);
      expect(out.extracted.model_key).toContain(f.expect.model_key_contains);
      expect(out.result.risk.level).toBe(f.expect.risk_level);
      expect(out.result.questions).toHaveLength(5);
      expect(out.result.checklist.length).toBeGreaterThan(1);
      expect(out.result.lang).toBe(f.lang);
      expect(out.costUsd).toBeLessThan(0.02);
    });
  }

  it("iPhone 40% below market with prepayment is high risk and priced from the reference", async () => {
    const f = fixtures.find((x) => x.name === "iphone13_prepay_ru")!;
    const out = await runCheck(
      { lang: "ru", text: f.input },
      {
        ai: mockAi(f.mock_extract, -15),
        findReferencePrice,
        findCatalogPrice: async () => null,
        usdRate: 12_800,
        riskRules: DEFAULT_RISK_RULES,
      },
    );
    expect(out.result.price.source).toBe("reference");
    expect(out.result.price.verdict).toBe("below");
    expect(out.result.price.diffPct).toBe(-40);
    expect(out.result.risk.level).toBe("high");
    expect(out.result.redFlags.join(" ")).toMatch(/предоплат/i);
  });

  it("USD prices are converted", async () => {
    const f = fixtures.find((x) => x.name === "samsung_a54_usd_ru")!;
    const out = await runCheck(
      { lang: "ru", text: f.input },
      { ai: mockAi(f.mock_extract), findReferencePrice, findCatalogPrice: async () => null, usdRate: 12_800, riskRules: DEFAULT_RISK_RULES },
    );
    expect(out.result.price.priceUzs).toBe(230 * 12_800);
    expect(out.result.price.verdict).toBe("market");
  });

  it("falls back to an approximate AI estimate when the model is not in the reference", async () => {
    const f = fixtures.find((x) => x.name === "airpods_pro2_description_ru")!;
    const out = await runCheck(
      { lang: "ru", text: f.input },
      { ai: mockAi(f.mock_extract), findReferencePrice, findCatalogPrice: async () => null, usdRate: 12_800, riskRules: DEFAULT_RISK_RULES },
    );
    expect(out.result.price.source).toBe("ai");
    expect(out.result.price.approximate).toBe(true);
  });

  it("stops after extraction when the input is not a listing", async () => {
    const f = fixtures[0]!;
    const ai = mockAi({ ...f.mock_extract, is_listing: false });
    const out = await runCheck(
      { lang: "ru", text: "привет" },
      { ai, findReferencePrice, findCatalogPrice: async () => null, usdRate: 12_800, riskRules: DEFAULT_RISK_RULES },
    );
    expect(out.notListing).toBe(true);
    expect(ai.calls).toEqual(["check_extract"]);
  });

  it("scrubs phones that slip into extracted phrases", async () => {
    const f = fixtures[0]!;
    const out = await runCheck(
      { lang: "ru", text: f.input },
      {
        ai: mockAi({ ...f.mock_extract, suspicious_phrases: ["звоните +998 90 123 45 67"] }),
        findReferencePrice,
        findCatalogPrice: async () => null,
        usdRate: 12_800,
        riskRules: DEFAULT_RISK_RULES,
      },
    );
    expect(out.extracted.suspicious_phrases[0]).toBe("звоните [phone]");
  });
});
