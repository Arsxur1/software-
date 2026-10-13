import { readFileSync } from "node:fs";
import { CheckReportSchema, ExtractedListingSchema, type ExtractedListing, type Lang } from "@ishonch/shared";
import { PROMPTS_DIR } from "@ishonch/shared/node";
import type { AiService, StructuredCall } from "../src/ai/aiService.js";

export interface Fixture {
  name: string;
  lang: Lang;
  input: string;
  expect: {
    category: string;
    model_key_contains: string;
    prepayment: boolean;
    shipping_or_other_city?: boolean;
    urgency?: boolean;
    risk_level: "low" | "medium" | "high";
  };
  mock_extract: ExtractedListing;
}

export const fixtures: Fixture[] = JSON.parse(readFileSync(`${PROMPTS_DIR}__fixtures__/checks.json`, "utf8"));

/** Deterministic stand-in for Claude: returns the fixture's extraction and a neutral report. */
export function mockAi(extract: ExtractedListing, riskAdjustment = 0): Pick<AiService, "structured"> & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async structured(call: StructuredCall<never>) {
      calls.push(call.promptId);
      const usage = {
        feature: call.feature,
        model: "claude-haiku-5-5",
        promptId: call.promptId,
        inputTokens: 1000,
        outputTokens: 300,
        costUsd: 0.00025,
        durationMs: 1,
        requestId: null,
      };
      if (call.promptId === "check_extract") {
        return { data: ExtractedListingSchema.parse(extract) as never, usage };
      }
      const report = CheckReportSchema.parse({
        pros: ["pro 1", "pro 2"],
        cons: ["con 1", "con 2"],
        questions: ["q1", "q2", "q3", "q4", "q5"],
        extra_red_flags: [],
        risk_adjustment: riskAdjustment,
      });
      return { data: report as never, usage };
    },
  };
}

// ---------- module D (seller cabinet) ----------
import type { ListingAnalysis, ListingText } from "@ishonch/shared";

export interface ListingFixture {
  name: string;
  lang: Lang;
  input: string;
  answers: Record<string, string>;
  expect: { category: string; model_key_contains: string; max_questions: number; must_mention: string[]; forbidden: string[] };
  mock_analysis: ListingAnalysis;
  mock_text: ListingText;
}

export const listingFixtures: ListingFixture[] = JSON.parse(
  readFileSync(`${PROMPTS_DIR}__fixtures__/listings.json`, "utf8"),
);

/** Mock that answers by prompt id; records every call for assertions. */
export function mockAiByPrompt(responses: Record<string, unknown>) {
  const calls: Array<{ promptId: string; content: unknown }> = [];
  return {
    calls,
    async structured(call: StructuredCall<import("zod").ZodType>) {
      calls.push({ promptId: call.promptId, content: call.content });
      const r = responses[call.promptId];
      const data = typeof r === "function" ? (r as (c: StructuredCall<import("zod").ZodType>) => unknown)(call) : r;
      if (data === undefined) throw new Error(`no mock for ${call.promptId}`);
      return {
        data: call.schema.parse(data) as never,
        usage: {
          feature: call.feature,
          model: "claude-haiku-5-5",
          promptId: call.promptId,
          inputTokens: 1500,
          outputTokens: 400,
          costUsd: 0.00035,
          durationMs: 1,
          requestId: null,
        },
      };
    },
  };
}

/** A small non-uniform JPEG so perceptual hashes differ between seeds. */
export async function testPhoto(seed = 1, size = 640): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  const raw = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3;
      // Smooth shapes like a real photo (high-frequency noise would alias when resized).
      const u = x / size;
      const v = y / size;
      const val = 128 + 60 * Math.sin(u * Math.PI * (seed + 1)) + 60 * Math.cos(v * Math.PI * (seed % 3 + 1) + seed);
      raw[i] = Math.max(0, Math.min(255, val));
      raw[i + 1] = Math.max(0, Math.min(255, 255 - val));
      raw[i + 2] = Math.max(0, Math.min(255, (val + seed * 30) % 256));
    }
  return sharp(raw, { raw: { width: size, height: size, channels: 3 } }).jpeg().toBuffer();
}
