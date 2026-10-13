import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { buildCaption } from "../src/telegram/publisher.js";
import { dHash, hammingDistance, processImage } from "../src/storage/images.js";
import { testPhoto } from "./helpers.js";

describe("images", () => {
  it("normalises photos and downsizes the AI copy", async () => {
    const big = await testPhoto(3, 2400);
    const p = await processImage(big);
    expect(Math.max(p.width, p.height)).toBe(1600);
    const ai = await sharp(p.ai).metadata();
    expect(Math.max(ai.width!, ai.height!)).toBe(1024);
    expect(p.phash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("perceptual hash survives resize/recompression and separates different photos", async () => {
    const a = await testPhoto(2, 800);
    const aSmall = await sharp(a).resize(300).jpeg({ quality: 50 }).toBuffer();
    const b = await testPhoto(7, 800);
    const [ha, hs, hb] = await Promise.all([dHash(a), dHash(aSmall), dHash(b)]);
    expect(hammingDistance(ha, hs)).toBeLessThanOrEqual(6);
    expect(hammingDistance(ha, hb)).toBeGreaterThan(10);
  });

  it("rejects non-images", async () => {
    await expect(processImage(Buffer.from("not an image"))).rejects.toThrow();
  });
});

describe("channel caption", () => {
  it("fits 1024 chars, escapes HTML and keeps title/price/footer", () => {
    const c = buildCaption({
      title: "iPhone <13>",
      price: "5 800 000 UZS",
      meta: ["📍 Toshkent"],
      description: "Очень & длинно ".repeat(200),
      footer: "#Ishonch",
    });
    expect(c.length).toBeLessThanOrEqual(1024);
    expect(c).toContain("<b>iPhone &lt;13&gt;</b>");
    expect(c).toContain("5 800 000 UZS");
    expect(c.endsWith("#Ishonch")).toBe(true);
    expect(c).not.toMatch(/&a?m?p?…/);
  });
});
