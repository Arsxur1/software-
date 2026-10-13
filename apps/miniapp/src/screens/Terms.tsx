import { useT } from "../i18n";

/** Legal texts are prepared by a lawyer; set their URLs via env when ready. */
const LINKS = {
  offer: import.meta.env.VITE_OFFER_URL ?? "#",
  privacy: import.meta.env.VITE_PRIVACY_URL ?? "#",
  prohibited: import.meta.env.VITE_PROHIBITED_URL ?? "#",
};

export function Terms({ onAccept, busy }: { onAccept: () => void; busy: boolean }) {
  const t = useT();
  return (
    <div className="stack center">
      <h1>{t("terms.title")}</h1>
      <p>{t("terms.text")}</p>
      <ul className="links">
        <li><a href={LINKS.offer} target="_blank" rel="noreferrer">{t("terms.offer")}</a></li>
        <li><a href={LINKS.privacy} target="_blank" rel="noreferrer">{t("terms.privacy")}</a></li>
        <li><a href={LINKS.prohibited} target="_blank" rel="noreferrer">{t("terms.prohibited")}</a></li>
      </ul>
      <button className="primary" onClick={onAccept} disabled={busy}>
        {t("terms.accept")}
      </button>
    </div>
  );
}
