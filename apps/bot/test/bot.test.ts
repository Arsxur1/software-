import { describe, expect, it } from "vitest";
import type { Update } from "grammy/types";
import type { CheckResult } from "@ishonch/shared";
import { ApiClient, ApiError } from "../src/api.js";
import { createBot } from "../src/bot.js";
import { formatCheck } from "../src/format.js";

const check: CheckResult = {
  id: "11111111-1111-1111-1111-111111111111",
  lang: "ru",
  createdAt: new Date().toISOString(),
  title: "Apple iPhone 13 <128>",
  category: "smartphone",
  price: {
    verdict: "below",
    diffPct: -40,
    priceUzs: 3_500_000,
    range: { min: 5_200_000, median: 5_800_000, max: 6_500_000 },
    source: "reference",
    approximate: false,
  },
  risk: { score: 75, level: "high", flags: [{ id: "prepayment", weight: 30 }], aiAdjustment: 0 },
  redFlags: ["Просят предоплату / перевод на карту / задаток"],
  pros: ["Свежая модель"],
  cons: ["Подозрительно дёшево"],
  questions: ["1?", "2?", "3?", "4?", "5?"],
  checklist: ["IMEI"],
  remainingToday: 4,
};

describe("formatCheck", () => {
  it("renders all blocks and escapes HTML", () => {
    const html = formatCheck(check);
    expect(html).toContain("Apple iPhone 13 &lt;128&gt;");
    expect(html).toContain("ниже рынка на 40%");
    expect(html).toContain("🔴");
    expect(html).toContain("высокий");
    expect(html).toContain("5. 5?");
    expect(html).toContain("Это оценка AI, а не гарантия");
    expect(html).toContain("3 500 000 UZS");
  });

  it("uzbek card", () => {
    const html = formatCheck({ ...check, lang: "uz" });
    expect(html).toContain("bozordan 40% arzon");
    expect(html).toContain("Bu AI bahosi, kafolat emas");
  });
});

class FakeApi {
  calls: string[] = [];
  async me() {
    this.calls.push("me");
    return { id: "u", language: "ru" as const, role: "buyer", acceptedTerms: true, checks: { perDay: 5, remaining: 5 } };
  }
  async setLanguage() {
    this.calls.push("setLanguage");
    return {};
  }
  async checkText(_u: unknown, text: string) {
    this.calls.push(`checkText:${text}`);
    if (text.includes("olx.uz")) throw new ApiError(422, "link_not_supported", "Пришлите скриншот");
    return check;
  }
  async checkImages() {
    return check;
  }
  async getCheck() {
    return check;
  }
}

function setup() {
  const api = new FakeApi();
  const bot = createBot({ token: "1:TEST", miniAppUrl: "https://app.example", username: "ishonch_bot" }, api as unknown as ApiClient);
  bot.botInfo = {
    id: 1,
    is_bot: true,
    first_name: "Ishonch",
    username: "ishonch_bot",
    can_join_groups: false,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
    has_topics_enabled: false,
    allows_users_to_create_topics: false,
  } as typeof bot.botInfo;
  const sent: Array<{ method: string; payload: Record<string, unknown> }> = [];
  bot.api.config.use(async (_prev, method, payload) => {
    sent.push({ method, payload: payload as Record<string, unknown> });
    return { ok: true, result: { message_id: 10, chat: { id: 5, type: "private" }, date: 0 } } as never;
  });
  return { api, bot, sent };
}

const msg = (text: string): Update => ({
  update_id: 1,
  message: {
    message_id: 1,
    date: 0,
    chat: { id: 5, type: "private", first_name: "A" },
    from: { id: 5, is_bot: false, first_name: "A", language_code: "ru" },
    text,
    ...(text.startsWith("/") ? { entities: [{ type: "bot_command", offset: 0, length: text.split(" ")[0]!.length }] } : {}),
  },
});

describe("bot handlers", () => {
  it("/start shows the Mini App button and language choice", async () => {
    const { bot, sent } = setup();
    await bot.handleUpdate(msg("/start"));
    const reply = sent.find((s) => s.method === "sendMessage")!;
    expect(reply.payload.text).toMatch(/Ishonch/);
    const kb = JSON.stringify(reply.payload.reply_markup);
    expect(kb).toContain("https://app.example");
    expect(kb).toContain("lang:uz");
  });

  it("text listing -> processing message edited into the check card with share button", async () => {
    const { api, bot, sent } = setup();
    await bot.handleUpdate(msg("iPhone 13 за 3,5 млн, предоплата"));
    expect(api.calls).toContain("checkText:iPhone 13 за 3,5 млн, предоплата");
    const edit = sent.find((s) => s.method === "editMessageText")!;
    expect(edit.payload.parse_mode).toBe("HTML");
    expect(String(edit.payload.text)).toContain("высокий");
    expect(JSON.stringify(edit.payload.reply_markup)).toContain("start%3Dcheck_11111111");
  });

  it("link-only message gets the API's explanation", async () => {
    const { bot, sent } = setup();
    await bot.handleUpdate(msg("https://olx.uz/d/abc"));
    const edit = sent.find((s) => s.method === "editMessageText")!;
    expect(edit.payload.text).toBe("Пришлите скриншот");
  });

  it("/start check_<id> renders a shared check", async () => {
    const { bot, sent } = setup();
    await bot.handleUpdate(msg(`/start check_${check.id}`));
    const reply = sent.find((s) => s.method === "sendMessage")!;
    expect(String(reply.payload.text)).toContain("iPhone 13");
  });
});
