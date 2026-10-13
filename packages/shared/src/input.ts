import type { CheckCategory, Lang } from "./types.js";
import { tList } from "./i18n.js";

const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b(?:olx\.uz|t\.me|instagram\.com|telegram\.me)\/\S*/gi;

/** True when the text is essentially just links (we never scrape other marketplaces). */
export function isLinkOnly(text: string): boolean {
  const withoutLinks = text.replace(URL_RE, "").replace(/[\s\p{P}]/gu, "");
  return withoutLinks.length < 15 && new RegExp(URL_RE.source, "i").test(text);
}

const PHONE_RE = /(?:\+?998[\s-]?)?\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/g;
const HANDLE_RE = /@[a-z0-9_]{4,}/gi;
const CARD_RE = /\b(?:\d{4}[\s-]?){3}\d{4}\b/g;

/** Removes phones, card numbers, @handles and links from text that we are about to store. */
export function scrubPii(text: string): string {
  return text
    .replace(CARD_RE, "[card]")
    .replace(PHONE_RE, "[phone]")
    .replace(HANDLE_RE, "[user]")
    .replace(URL_RE, "[link]");
}

export function inspectionChecklist(lang: Lang, category: CheckCategory): string[] {
  return tList(lang, `checklist.${category}` as Parameters<typeof tList>[1]);
}
