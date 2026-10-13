import type { Currency } from "../types.js";

export interface ParsedPrice {
  amount: number;
  currency: Currency;
}

const USD_RE = /(\$|usd|у\.?\s?е\.?|долл|dollar|dollor|\bye\b)/i;
const MLN_RE = /(млн|mln|million|миллион|\d\s*m\b)/i;
const THOUSAND_RE = /(тыс|ming|\d\s*k\b)/i;

/**
 * Parses free-form price strings common in Uzbek listings:
 * "3,5 млн", "3.5 mln so'm", "3 500 000 сум", "$300", "300 у.е.", "450k".
 * Returns null when no number is found.
 */
export function parsePrice(input: string): ParsedPrice | null {
  const text = input.toLowerCase().replace(/ /g, " ");
  const numMatch = text.match(/\d[\d\s.,]*/);
  if (!numMatch) return null;

  let raw = numMatch[0].trim();
  const hasMultiplier = MLN_RE.test(text) || THOUSAND_RE.test(text);

  // "3 500 000" or "3.500.000" -> grouping separators
  if (/^\d{1,3}([ .,]\d{3})+$/.test(raw) && !hasMultiplier) {
    raw = raw.replace(/[ .,]/g, "");
  } else {
    raw = raw.replace(/\s/g, "").replace(",", ".");
  }
  let amount = Number.parseFloat(raw);
  if (!Number.isFinite(amount)) return null;

  if (MLN_RE.test(text)) amount *= 1_000_000;
  else if (THOUSAND_RE.test(text)) amount *= 1_000;

  const currency: Currency = USD_RE.test(text) ? "USD" : "UZS";
  return { amount: Math.round(amount), currency };
}

/**
 * Converts any supported currency to UZS.
 * Small UZS numbers (< 100 000) in electronics are almost always USD typed without a sign,
 * but we do not guess here: the caller decides.
 */
export function toUzs(amount: number, currency: Currency, usdRate: number): number {
  return Math.round(currency === "USD" ? amount * usdRate : amount);
}

export function formatUzs(amount: number): string {
  return `${Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ")} UZS`;
}
