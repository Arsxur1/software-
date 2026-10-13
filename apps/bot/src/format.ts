import { formatUzs, t, type CheckResult, type Lang } from "@ishonch/shared";

const RISK_EMOJI = { low: "🟢", medium: "🟡", high: "🔴" } as const;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const list = (items: string[], bullet = "•") => items.map((i) => `${bullet} ${escapeHtml(i)}`).join("\n");

export function priceLine(lang: Lang, c: CheckResult): string {
  const p = c.price;
  if (p.verdict === "unknown" || p.diffPct == null) return t(lang, "check.price.unknown");
  const key = `check.price.${p.verdict}` as const;
  return t(lang, key, { pct: Math.abs(p.diffPct) });
}

/** Telegram HTML card for a check result (fits the 4096-char limit for normal results). */
export function formatCheck(c: CheckResult): string {
  const lang = c.lang;
  const p = c.price;
  const parts: string[] = [`🔎 <b>${escapeHtml(c.title)}</b>`];

  const priceBlock = [`💰 <b>${t(lang, "check.price.title")}:</b> ${priceLine(lang, c)}`];
  if (p.priceUzs) priceBlock[0] += ` (${formatUzs(p.priceUzs)})`;
  if (p.range) {
    priceBlock.push(t(lang, "check.price.range", { min: formatUzs(p.range.min), max: formatUzs(p.range.max) }));
  }
  if (p.source !== "none") priceBlock.push(`<i>${t(lang, `check.price.source.${p.source}`)}</i>`);
  parts.push(priceBlock.join("\n"));

  const risk = [
    `${RISK_EMOJI[c.risk.level]} <b>${t(lang, "check.risk.title")}:</b> ${t(lang, `check.risk.${c.risk.level}`)} (${c.risk.score}/100)`,
  ];
  if (c.redFlags.length) risk.push(`<b>${t(lang, "check.flags.title")}:</b>\n${list(c.redFlags, "🚩")}`);
  parts.push(risk.join("\n"));

  if (c.pros.length) parts.push(`✅ <b>${t(lang, "check.pros")}:</b>\n${list(c.pros)}`);
  if (c.cons.length) parts.push(`⚠️ <b>${t(lang, "check.cons")}:</b>\n${list(c.cons)}`);
  if (c.questions.length) {
    parts.push(
      `❓ <b>${t(lang, "check.questions")}:</b>\n${c.questions.map((q, i) => `${i + 1}. ${escapeHtml(q)}`).join("\n")}`,
    );
  }
  if (c.checklist.length) parts.push(`📋 <b>${t(lang, "check.checklist")}:</b>\n${list(c.checklist, "☐")}`);
  if (c.remainingToday != null) parts.push(t(lang, "check.remaining", { n: c.remainingToday }));
  parts.push(`<i>${t(lang, "ai.disclaimer")}</i>`);
  return parts.join("\n\n");
}
