import type { Lang } from "@ishonch/shared";
import { useLang, useT } from "../i18n";

interface Props {
  remaining: number;
  onOpenCheck: () => void;
  onLanguage: (lang: Lang) => void;
  onDeleteAccount: () => void;
}

export function Home({ remaining, onOpenCheck, onLanguage, onDeleteAccount }: Props) {
  const t = useT();
  const lang = useLang();
  return (
    <div className="stack">
      <header className="row between">
        <div>
          <h1>{t("app.name")}</h1>
          <p className="hint">{t("app.tagline")}</p>
        </div>
        <div className="lang-switch" role="group" aria-label={t("common.language")}>
          {(["uz", "ru"] as const).map((l) => (
            <button key={l} className={l === lang ? "active" : ""} onClick={() => onLanguage(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <button className="tile primary-tile" onClick={onOpenCheck} data-testid="open-check">
        <span className="tile-icon">🔎</span>
        <span>
          <strong>{t("home.tekshir.title")}</strong>
          <span className="hint">{t("home.tekshir.desc")}</span>
          <span className="hint">{t("check.remaining", { n: remaining })}</span>
        </span>
      </button>

      <button className="tile" disabled>
        <span className="tile-icon">🛍️</span>
        <span>
          <strong>{t("home.catalog.title")}</strong>
          <span className="hint">{t("home.catalog.desc")} · {t("common.soon")}</span>
        </span>
      </button>

      <button className="tile" disabled>
        <span className="tile-icon">📸</span>
        <span>
          <strong>{t("home.sell.title")}</strong>
          <span className="hint">{t("home.sell.desc")} · {t("common.soon")}</span>
        </span>
      </button>

      <button className="link danger" onClick={onDeleteAccount}>
        {t("home.delete_account")}
      </button>
    </div>
  );
}
