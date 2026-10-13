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
