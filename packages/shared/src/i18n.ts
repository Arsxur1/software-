import ru from "../i18n/ru.json" with { type: "json" };
import uz from "../i18n/uz.json" with { type: "json" };
import type { Lang } from "./types.js";

export type { Lang };

export type I18nKey = keyof typeof ru;
export const dictionaries: Record<Lang, Record<string, string>> = { ru, uz };

export const DEFAULT_LANG: Lang = "uz";

/** Maps a Telegram `language_code` to one of our two UI languages. */
export function normalizeLang(code: string | null | undefined): Lang {
  if (!code) return DEFAULT_LANG;
  const c = code.toLowerCase();
  if (c.startsWith("ru") || c.startsWith("kk") || c.startsWith("be") || c.startsWith("uk")) return "ru";
  return "uz";
}

export function t(lang: Lang, key: I18nKey, params?: Record<string, string | number>): string {
  const template = dictionaries[lang][key] ?? dictionaries.ru[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    params[name] !== undefined ? String(params[name]) : m,
  );
}

/** Lists are stored as "a|b|c" strings so that translators edit one line per list. */
export function tList(lang: Lang, key: I18nKey): string[] {
  return t(lang, key)
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}
