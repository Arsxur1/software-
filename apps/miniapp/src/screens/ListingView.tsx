import { useEffect, useState } from "react";
import { formatUzs, listingDescription, listingTitle, type ListingDto } from "@ishonch/shared";
import { ApiError, apiUrl, type Api } from "../api";
import { useLang, useT } from "../i18n";

/** Public listing card (target of the "Buy with delivery" button in seller channels). */
export function ListingView({ api, id }: { api: Api; id: string }) {
  const t = useT();
  const lang = useLang();
  const [l, setL] = useState<ListingDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState(0);
  const [showDelivery, setShowDelivery] = useState(false);

  useEffect(() => {
    api
      .listing(id)
      .then(setL)
      .catch((e) => setError(e instanceof ApiError ? e.message : t("listing.not_found")));
  }, [api, id]);

  if (error) return <p className="center hint">{error}</p>;
  if (!l) return <p className="center hint">{t("common.loading")}</p>;
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang === "ru" ? "ru-RU" : "uz-UZ");

  return (
    <div className="stack" data-testid="listing-view">
      {l.photos.length > 0 && (
        <div className="gallery">
          <img src={apiUrl(l.photos[photo]!.url)} alt="" />
          {l.photos.length > 1 && (
            <div className="dots">
              {l.photos.map((p, i) => (
                <button key={p.id} className={i === photo ? "active" : ""} onClick={() => setPhoto(i)} aria-label={`photo ${i + 1}`} />
              ))}
            </div>
          )}
        </div>
      )}
      <h1>{listingTitle(l, lang)}</h1>
      {l.price && <p className="price">{formatUzs(l.price)}</p>}
      <p className="hint">
        {l.condition && t(`condition.${l.condition}`)}
        {l.district && ` · 📍 ${t(`district.${l.district}`)}`}
      </p>
      <p className="description">{listingDescription(l, lang)}</p>

      {l.seller && (
        <section className="card">
          <h3>{t("listing.seller")}</h3>
          {l.seller.shop && (
            <p>
              🏪 {l.seller.shop.name} {l.seller.shop.verified && <span className="badge">{t("shop.verified")}</span>}
              {l.seller.shop.marketLocation && <span className="hint">{l.seller.shop.marketLocation}</span>}
            </p>
          )}
          <p className="hint">{t("listing.seller_since", { date: date(l.seller.registeredAt) })}</p>
          <p className="hint">{t("listing.sales", { n: l.seller.platformSales })}</p>
        </section>
      )}

      <section className="card">
        <h3>🚚 {t("listing.delivery_modes")}</h3>
        <ul>
          {l.allowedDeliveryModes.map((m) => (
            <li key={m}>{t(`delivery.${m}`)}</li>
          ))}
        </ul>
        <p className="hint">{t(`fee_payer.${l.feePayer}`)}</p>
      </section>

      {l.status === "active" && (
        <button className="primary" onClick={() => setShowDelivery(true)}>
          {t("listing.buy_delivery")}
        </button>
      )}
      {showDelivery && <p className="toast">{t("listing.delivery_soon")}</p>}
    </div>
  );
}
