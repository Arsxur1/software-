import type { Lang } from "@ishonch/shared";
import { useLang, useT } from "../i18n";

interface Props {
  remaining: number;
  onOpen: (screen: "check" | "sell" | "my" | "shop") => void;
  onLanguage: (lang: Lang) => void;
  onDeleteAccount: () => void;
}

export function Home({ remaining, onOpen, onLanguage, onDeleteAccount }: Props) {
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

      <button className="tile primary-tile" onClick={() => onOpen("check")} data-testid="open-check">
        <span className="tile-icon">🔎</span>
        <span>
          <strong>{t("home.tekshir.title")}</strong>
          <span className="hint">{t("home.tekshir.desc")}</span>
          <span className="hint">{t("check.remaining", { n: remaining })}</span>
        </span>
      </button>

      <button className="tile" onClick={() => onOpen("sell")} data-testid="open-sell">
        <span className="tile-icon">📸</span>
        <span>
          <strong>{t("home.sell.title")}</strong>
          <span className="hint">{t("home.sell.desc_ready")}</span>
        </span>
      </button>

      <button className="tile" onClick={() => onOpen("my")} data-testid="open-my">
        <span className="tile-icon">📋</span>
        <span>
          <strong>{t("home.my.title")}</strong>
          <span className="hint">{t("home.my.desc")}</span>
        </span>
      </button>

      <button className="tile" onClick={() => onOpen("shop")}>
        <span className="tile-icon">🏪</span>
        <span>
          <strong>{t("home.shop.title")}</strong>
          <span className="hint">{t("home.shop.desc")}</span>
        </span>
      </button>

      <button className="tile" disabled>
        <span className="tile-icon">🛍️</span>
        <span>
          <strong>{t("home.catalog.title")}</strong>
          <span className="hint">
            {t("home.catalog.desc")} · {t("common.soon")}
          </span>
        </span>
      </button>

      <button className="link danger" onClick={onDeleteAccount}>
        {t("home.delete_account")}
      </button>
    </div>
  );
}
