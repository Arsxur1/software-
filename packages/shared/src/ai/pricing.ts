/**
 * USD per 1M tokens. Keep in sync with https://docs.anthropic.com pricing.
 * Unknown models are priced at the most expensive known rate so limits stay conservative.
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
};

const FALLBACK = { input: 10, output: 50 };

export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = MODEL_PRICING[model] ?? FALLBACK;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}
