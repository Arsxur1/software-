import { useEffect, useMemo, useState } from "react";
import { normalizeLang, type Lang } from "@ishonch/shared";
import { createApi, type Me } from "./api";
import { LangContext } from "./i18n";
import { Check } from "./screens/Check";
import { Home } from "./screens/Home";
import { Terms } from "./screens/Terms";
import { setBackButton, type TelegramEnv } from "./telegram";
import { t } from "@ishonch/shared/i18n";

type Screen = "home" | "check";

export function App({ env }: { env: TelegramEnv }) {
  const api = useMemo(() => createApi(env.initData), [env.initData]);
  const [me, setMe] = useState<Me | null>(null);
  const [lang, setLang] = useState<Lang>(normalizeLang(env.languageCode));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    api
      .me()
      .then((m) => {
        setMe(m);
        setLang(m.language);
      })
      .catch(() => setError(t(lang, "common.error")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  useEffect(() => setBackButton(screen === "home" ? null : () => setScreen("home")), [screen]);

  async function acceptTerms() {
    setBusy(true);
    await api.acceptTerms().catch(() => undefined);
    setMe((m) => (m ? { ...m, acceptedTerms: true } : m));
    setBusy(false);
  }

  async function changeLanguage(l: Lang) {
    setLang(l);
    await api.setLanguage(l).catch(() => undefined);
  }

  async function deleteAccount() {
    if (!window.confirm(t(lang, "home.delete_confirm"))) return;
    await api.deleteAccount();
    setDeleted(true);
  }

  let content;
  if (deleted) content = <p className="center">{t(lang, "home.deleted")}</p>;
  else if (error) content = <p className="error center">{error}</p>;
  else if (!me) content = <p className="center hint">{t(lang, "common.loading")}</p>;
  else if (!me.acceptedTerms) content = <Terms onAccept={acceptTerms} busy={busy} />;
  else if (screen === "check")
    content = (
      <>
        <button className="link" onClick={() => setScreen("home")}>← {t(lang, "common.back")}</button>
        <Check
          api={api}
          remaining={me.checks.remaining}
          onDone={(remaining) => setMe({ ...me, checks: { ...me.checks, remaining } })}
        />
      </>
    );
  else
    content = (
      <Home
        remaining={me.checks.remaining}
        onOpenCheck={() => setScreen("check")}
        onLanguage={changeLanguage}
        onDeleteAccount={deleteAccount}
      />
    );

  return (
    <LangContext.Provider value={lang}>
      <main className="app">{content}</main>
    </LangContext.Provider>
  );
}
