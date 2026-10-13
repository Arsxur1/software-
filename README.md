# Ishonch — MVP маркетплейса б/у товаров (Ташкент)

Telegram Mini App + бот + API. Стратегия запуска **B + D → A**: сначала «Tekshir» (проверка чужих объявлений), затем кабинет продавца, затем каталог.

| Этап | Статус |
|---|---|
| 0. Каркас (монорепо, Docker, БД, авторизация Telegram, RU/UZ, `aiService`) | ✅ готов |
| 1. Модуль B «Tekshir» (проверка по скриншоту/тексту, справочник цен, скоринг риска) | ✅ готов, ждёт живой проверки с ключами |
| 2. Модуль D — кабинет продавца | ⏭ следующий |
| 3. Модуль A — каталог и AI-помощник | — |
| 4. Доставка и доверие | — |
| 5. Админка и метрики | — |

## Структура

```
apps/api        Fastify API, Drizzle ORM + миграции (drizzle/), aiService, модуль checks
apps/bot        grammY-бот: /start, выбор языка, проверка текста/фото/альбомов, deep-link «Поделиться»
apps/miniapp    React + Vite + @telegram-apps/sdk-react: согласие, главная, Tekshir, карточка результата
packages/shared типы, i18n (i18n/ru.json, i18n/uz.json), промпты (prompts/*.vN.md), цены, скоринг риска
```

## Быстрый старт (локально)

```bash
pnpm install
cp .env.example .env            # заполнить BOT_TOKEN, ANTHROPIC_API_KEY, ADMIN_TELEGRAM_IDS
docker compose up -d postgres minio minio-init
pnpm db:migrate && pnpm db:seed # таблицы, категории, 20 моделей в справочнике цен, настройки
pnpm dev:api                    # http://localhost:3000
pnpm dev:bot
pnpm dev:miniapp                # http://localhost:5173 (проксирует /api → :3000)
```

Mini App в Telegram должен открываться по HTTPS: для разработки пробросьте `:5173` через туннель (cloudflared/ngrok) и укажите адрес в `MINIAPP_URL` и в @BotFather (Bot Settings → Menu Button / Mini App).

**Без ключа Claude**: `pnpm --filter @ishonch/api dev:mock` поднимает API с детерминированным AI из фикстур и печатает подписанный `INIT_DATA`. Откройте `http://localhost:5173/?initData=<INIT_DATA>` — приложение работает вне Telegram.

## Продакшн (VPS в Узбекистане)

```bash
cp .env.example .env   # реальные значения
docker compose up -d --build
```

Сервисы: `postgres` (16), `minio` (+ bucket), `api` (при старте применяет миграции и сид), `bot` (long polling), `miniapp` (nginx, отдаёт статику и проксирует `/api` → `api`). Перед `miniapp` нужен TLS-прокси. Логи API — `./logs/api.log`.

## Тесты

```bash
pnpm test        # 62 теста: цены, риск, i18n, initData, пайплайн на 5 фикстурах, бот, интеграция с БД
pnpm typecheck
ANTHROPIC_API_KEY=... pnpm test:ai   # живые вызовы Claude на 5 фикстурах: время < 20 c, стоимость < $0.02
```

Интеграционный тест API (`apps/api/test/app.test.ts`) использует PostgreSQL из `TEST_DATABASE_URL` (по умолчанию локальный) и пропускается, если БД недоступна.

## Как устроено

**Авторизация.** Mini App шлёт `Authorization: tma <initData>`; API проверяет HMAC-подпись по токену бота и срок `auth_date`, создаёт пользователя. Бот ходит в API с `Authorization: Internal <INTERNAL_API_TOKEN>` + `X-Telegram-User`. БД есть только у API. Админы задаются через `ADMIN_TELEGRAM_IDS`.

**AI.** Все вызовы идут через `apps/api/src/ai/aiService.ts`: он загружает версионированный промпт из `packages/shared/prompts/<id>.v<N>.md` (front matter: модель, max_tokens, effort), проверяет месячный лимит (`ai_monthly_limit_usd`, по умолчанию $50, предупреждение в логе с 80%), валидирует структурированный ответ (zod) и пишет токены и стоимость в `ai_usage`. Модели: `claude-haiku-5-5` для всего на этапах 0–2, `claude-opus-5-5` только для помощника покупателя (этап 3). Обе меняются через env.

**Модуль B — пайплайн** (`apps/api/src/modules/checks/pipeline.ts`):
1. `check_extract` — структура объявления из скриншотов/текста (обезличенно: имена, телефоны, ссылки не извлекаются; дополнительно вычищаются регулярками).
2. Рыночная цена: справочник `price_reference` (нечёткий поиск pg_trgm, но номер модели и объём памяти должны совпасть) → медиана каталога (появится в модуле A) → оценка AI с пометкой «приблизительно».
3. Скоринг риска по правилам раздела 7 (`packages/shared/src/risk/defaultRules.json`, переопределяется ключом `risk_rules` в таблице `settings` без релиза).
4. `check_report` — плюсы/минусы, 5 вопросов продавцу, доп. красные флаги и корректировка риска (±15; понизить уровень, определённый правилами, AI не может).
5. Чек-лист осмотра — статичный по категории из i18n (дешевле и надёжнее AI).

Ограничения: 5 проверок в день (`checks_per_day` в `settings`), только ссылка → просьба прислать скриншот/текст (сайты не парсим), скриншоты не сохраняются, в `checks` лежат только обезличенные поля.

**API**

| Метод | Путь | Доступ |
|---|---|---|
| GET | `/health` | все |
| GET/PATCH/DELETE | `/me` (профиль, язык, удаление аккаунта) | пользователь |
| POST | `/me/accept-terms` | пользователь |
| POST | `/checks` (JSON `{text, lang}` или multipart `images[]`, `text`, `lang`) | пользователь |
| GET | `/checks/limit` | пользователь |
| GET | `/checks/:id` (для «Поделиться», данные обезличены) | все |
| GET/PUT | `/admin/price-reference` | admin |
| POST | `/admin/price-reference/import` (`text/csv`: `model_key,price_min,price_median,price_max`) | admin |
| DELETE | `/admin/price-reference/:id` | admin |
| GET | `/admin/ai-usage` (расходы за день/месяц, превышение лимита) | admin |

**Юридическое.** Экран согласия при первом входе; ссылки на оферту, политику и список запрещённых товаров задаются через `VITE_OFFER_URL`, `VITE_PRIVACY_URL`, `VITE_PROHIBITED_URL` (тексты готовит юрист). Дисклеймер AI под каждой проверкой. Удаление аккаунта: `DELETE /me` (проверки остаются обезличенными, без привязки к пользователю).

## Проверено / не проверено

- ✅ Все тесты и typecheck; миграции и сид на PostgreSQL 16; сквозной сценарий в Mini App через Playwright (согласие → главная → проверка → карточка «высокий риск»), AI замокан.
- ⚠️ Не проверено в этом окружении: живые вызовы Claude (нет `ANTHROPIC_API_KEY`) — запустите `pnpm test:ai`, чтобы подтвердить критерии «< 20 с» и «< $0.02»; реальный бот (нужен `BOT_TOKEN`); сборка Docker-образов (Docker Hub ограничил запросы; `docker compose config` валиден).

## Дальше — этап 2 (модуль D)

Создание объявления по 1–10 фото и голосу (интерфейс `SpeechToText`), загрузка фото в MinIO, AI-описание RU/UZ с уточняющими вопросами, рекомендация цены (быстрая/рыночная/максимальная), публикация в каталог и канал продавца, таблицы `listings`, `listing_photos`, `shops`, `channels`.
