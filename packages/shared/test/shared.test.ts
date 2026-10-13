import { describe, expect, it } from "vitest";
import {
  dictionaries,
  inspectionChecklist,
  isLinkOnly,
  normalizeLang,
  parsePrice,
  priceVerdict,
  scoreRisk,
  scrubPii,
  t,
  toUzs,
  costUsd,
  CHECK_CATEGORIES,
  normalizeModelKey,
  sameModel,
} from "../src/index.js";

describe("parsePrice", () => {
  it.each([
    ["3,5 млн", 3_500_000, "UZS"],
    ["3.5 mln so'm", 3_500_000, "UZS"],
    ["3 500 000 сум", 3_500_000, "UZS"],
    ["3.500.000", 3_500_000, "UZS"],
    ["$300", 300, "USD"],
    ["300 у.е.", 300, "USD"],
    ["230$", 230, "USD"],
    ["450k", 450_000, "UZS"],
    ["500 ming", 500_000, "UZS"],
  ])("%s", (input, amount, currency) => {
    expect(parsePrice(input)).toEqual({ amount, currency });
  });

  it("returns null without digits", () => {
    expect(parsePrice("договорная")).toBeNull();
  });

  it("converts USD", () => {
    expect(toUzs(300, "USD", 12800)).toBe(3_840_000);
  });
});

describe("priceVerdict", () => {
  const range = { min: 5_200_000, median: 5_800_000, max: 6_500_000 };

  it("below market", () => {
    const v = priceVerdict(3_480_000, range, "reference");
    expect(v.verdict).toBe("below");
    expect(v.diffPct).toBe(-40);
    expect(v.approximate).toBe(false);
  });

  it("in market", () => {
    expect(priceVerdict(5_900_000, range, "reference").verdict).toBe("market");
  });

  it("above market", () => {
    expect(priceVerdict(7_000_000, range, "reference").verdict).toBe("above");
  });

  it("ai source is approximate", () => {
    expect(priceVerdict(5_900_000, range, "ai").approximate).toBe(true);
  });

  it("unknown without range or price", () => {
    expect(priceVerdict(null, range, "reference").verdict).toBe("unknown");
    expect(priceVerdict(1000, null, "none").verdict).toBe("unknown");
  });
});

describe("scoreRisk", () => {
  it("40% below market + prepayment => high (acceptance criterion)", () => {
    const r = scoreRisk({ priceDiffPct: -40, prepayment: true });
    expect(r.score).toBe(60);
    expect(r.level).toBe("high");
    expect(r.flags.map((f) => f.id)).toEqual(["price_below_market", "prepayment"]);
  });

  it("negative AI adjustment cannot lower the rule-based level", () => {
    const r = scoreRisk({ priceDiffPct: -40, prepayment: true, aiAdjustment: -15 });
    expect(r.level).toBe("high");
  });

  it("AI adjustment is clamped", () => {
    expect(scoreRisk({ aiAdjustment: 99 }).aiAdjustment).toBe(15);
  });

  it("honest listing is low", () => {
    expect(scoreRisk({ priceDiffPct: -5 }).level).toBe("low");
  });

  it("verified shop lowers the score but not below 0", () => {
    const r = scoreRisk({ urgency: true, verifiedShop: true });
    expect(r.score).toBe(0);
  });

  it("medium band", () => {
    expect(scoreRisk({ otherCity: true, urgency: true, accountAgeDays: 1 }).level).toBe(
      "medium",
    );
  });

  it("uses custom rules", () => {
    const r = scoreRisk(
      { urgency: true },
      {
        version: 2,
        priceBelowMarketPct: 30,
        newAccountDays: 3,
        aiAdjustmentMax: 15,
        levels: { medium: 5, high: 50 },
        weights: { urgency: 10 },
      },
    );
    expect(r.level).toBe("medium");
  });
});

describe("i18n", () => {
  it("ru and uz have the same keys", () => {
    expect(Object.keys(dictionaries.uz).sort()).toEqual(Object.keys(dictionaries.ru).sort());
  });

  it("interpolates params", () => {
    expect(t("ru", "check.remaining", { n: 3 })).toBe("Осталось проверок сегодня: 3");
  });

  it("normalizes telegram language codes", () => {
    expect(normalizeLang("ru")).toBe("ru");
    expect(normalizeLang("uz")).toBe("uz");
    expect(normalizeLang("en")).toBe("uz");
    expect(normalizeLang(undefined)).toBe("uz");
  });

  it("has a checklist for every category in both languages", () => {
    for (const c of CHECK_CATEGORIES) {
      expect(inspectionChecklist("ru", c).length).toBeGreaterThan(1);
      expect(inspectionChecklist("uz", c).length).toBeGreaterThan(1);
    }
  });
});

describe("input helpers", () => {
  it("detects link-only messages", () => {
    expect(isLinkOnly("https://www.olx.uz/d/obyavlenie/iphone-13-ID123.html")).toBe(true);
    expect(isLinkOnly("посмотри olx.uz/d/abc")).toBe(true);
    expect(isLinkOnly("iPhone 13 128gb за 3,5 млн, состояние идеал https://t.me/x")).toBe(false);
    expect(isLinkOnly("iPhone 13 за 3,5 млн")).toBe(false);
  });

  it("scrubs personal data", () => {
    const s = scrubPii("Звоните +998 90 123-45-67 или @seller_uz, карта 8600 1234 5678 9012");
    expect(s).not.toMatch(/\d{2}[\s-]?\d{2}\b.*45/);
    expect(s).toContain("[phone]");
    expect(s).toContain("[user]");
    expect(s).toContain("[card]");
  });
});

describe("costUsd", () => {
  it("prices haiku", () => {
    expect(costUsd("claude-haiku-5-5", 1_000_000, 1_000_000)).toBeCloseTo(0.6);
  });
});

describe("model matching", () => {
  it("normalizes storage and colours", () => {
    expect(normalizeModelKey("Apple iPhone 13 128 ГБ (Blue)")).toBe("apple iphone 13 128gb");
  });
  it("matches same model, rejects different generation / storage / modifier", () => {
    expect(sameModel("apple iphone 13 128gb", "iphone 13 128 gb midnight")).toBe(true);
    expect(sameModel("apple iphone 13 128gb", "apple iphone 12 128gb")).toBe(false);
    expect(sameModel("apple iphone 13 128gb", "apple iphone 13 256gb")).toBe(false);
    expect(sameModel("apple iphone 13 128gb", "apple iphone 13 pro 128gb")).toBe(false);
  });
});
