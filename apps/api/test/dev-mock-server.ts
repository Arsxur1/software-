// Local dev server: real API + real DB, deterministic AI from fixtures (no Anthropic key needed).
import { buildApp } from "../src/app.js";
import { buildInitData } from "../src/auth/telegram.js";
import { loadConfig } from "../src/config.js";
import { createDb } from "../src/db/client.js";
import { fixtures, mockAi } from "./helpers.js";

const config = loadConfig({ ...process.env, BOT_TOKEN: process.env.BOT_TOKEN ?? "123456:DEV", NODE_ENV: "development" });
const { db } = createDb(config.DATABASE_URL);
const fixture = fixtures.find((f) => f.name === (process.env.FIXTURE ?? "iphone13_prepay_ru"))!;
const app = await buildApp({ config, db, ai: mockAi(fixture.mock_extract, 5) });
await app.listen({ port: 3000, host: "127.0.0.1" });
console.log("INIT_DATA=" + buildInitData({ id: 777000111, first_name: "E2E", language_code: process.env.E2E_LANG ?? "ru" }, process.env.BOT_TOKEN ?? "123456:DEV"));
