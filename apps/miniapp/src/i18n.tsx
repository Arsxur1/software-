import { createContext, useContext } from "react";
import { t as translate, type I18nKey, type Lang } from "@ishonch/shared/i18n";

export const LangContext = createContext<Lang>("uz");

export function useT() {
  const lang = useContext(LangContext);
  return (key: I18nKey, params?: Record<string, string | number>) => translate(lang, key, params);
}

export function useLang() {
  return useContext(LangContext);
}
