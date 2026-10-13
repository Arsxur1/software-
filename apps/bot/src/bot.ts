import { Bot, InlineKeyboard, type Context } from "grammy";
import type { Message } from "grammy/types";
import { normalizeLang, t, type CheckResult, type Lang } from "@ishonch/shared";
import { ApiClient, ApiError, type ImageFile, type TgUser } from "./api.js";
import { formatCheck } from "./format.js";

export interface BotConfig {
  token: string;
  miniAppUrl: string;
  /** Telegram username of the bot, used for share deep links. */
  username?: string;
}

const MAX_IMAGES = 5;
const ALBUM_WAIT_MS = 1200;

function tgUser(ctx: Context): TgUser | null {
  return ctx.from ? { id: ctx.from.id, language_code: ctx.from.language_code } : null;
}

export function createBot(cfg: BotConfig, api: ApiClient) {
  const bot = new Bot(cfg.token);

  async function langOf(user: TgUser): Promise<Lang> {
    try {
      return (await api.me(user)).language;
    } catch {
      return normalizeLang(user.language_code);
    }
  }

  function resultKeyboard(lang: Lang, check: CheckResult) {
    const kb = new InlineKeyboard().webApp(
      t(lang, "bot.find_similar"),
      `${cfg.miniAppUrl}?startapp=similar_${check.id}#/catalog`,
    );
    const username = cfg.username ?? (bot.isInited() ? bot.botInfo.username : undefined);
    if (username) {
      const link = `https://t.me/${username}?start=check_${check.id}`;
      kb.row().url(t(lang, "bot.share"), `https://t.me/share/url?url=${encodeURIComponent(link)}`);
    }
    return kb;
  }

  async function runCheck(ctx: Context, user: TgUser, fn: (lang: Lang) => Promise<CheckResult>) {
    const lang = await langOf(user);
    const progress = await ctx.reply(t(lang, "bot.processing"));
    try {
      const check = await fn(lang);
      await ctx.api.editMessageText(progress.chat.id, progress.message_id, formatCheck(check), {
        parse_mode: "HTML",
        reply_markup: resultKeyboard(lang, check),
        link_preview_options: { is_disabled: true },
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t(lang, "common.error");
      if (!(err instanceof ApiError)) console.error("check failed", err);
      await ctx.api.editMessageText(progress.chat.id, progress.message_id, message);
    }
  }

  async function download(fileId: string): Promise<ImageFile> {
    const file = await bot.api.getFile(fileId);
    const res = await fetch(`https://api.telegram.org/file/bot${cfg.token}/${file.file_path}`);
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    const path = file.file_path ?? "";
    const mediaType = path.endsWith(".png") ? "image/png" : path.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return { data: new Uint8Array(await res.arrayBuffer()), mediaType };
  }

  function imageFileId(msg: Message): string | null {
    if (msg.photo?.length) return msg.photo[msg.photo.length - 1]!.file_id;
    if (msg.document?.mime_type?.startsWith("image/")) return msg.document.file_id;
    return null;
  }

  async function checkImages(ctx: Context, messages: Message[]) {
    const user = tgUser(ctx);
    if (!user) return;
    const ids = messages.map(imageFileId).filter((x): x is string => x !== null);
    const caption = messages.map((m) => m.caption).filter(Boolean).join("\n") || undefined;
    if (ids.length > MAX_IMAGES) {
      await ctx.reply(t(await langOf(user), "check.too_many_images"));
      return;
    }
    await runCheck(ctx, user, async (lang) => api.checkImages(user, await Promise.all(ids.map(download)), caption, lang));
  }

  // ---- commands ----
  bot.command("start", async (ctx) => {
    const user = tgUser(ctx);
    if (!user) return;
    const payload = ctx.match?.trim();
    const lang = await langOf(user);

    if (payload?.startsWith("check_")) {
      try {
        const check = await api.getCheck(payload.slice("check_".length));
        await ctx.reply(formatCheck({ ...check, remainingToday: null }), { parse_mode: "HTML" });
      } catch {
        await ctx.reply(t(lang, "common.error"));
      }
      return;
    }

    await ctx.reply(t(lang, "bot.welcome"), {
      reply_markup: new InlineKeyboard()
        .webApp(t(lang, "bot.open_app"), cfg.miniAppUrl)
        .row()
        .text("🇺🇿 O'zbekcha", "lang:uz")
        .text("🇷🇺 Русский", "lang:ru"),
    });
  });

  bot.command("help", async (ctx) => {
    const user = tgUser(ctx);
    if (user) await ctx.reply(t(await langOf(user), "bot.help"));
  });

  bot.command("lang", async (ctx) => {
    await ctx.reply(t("uz", "bot.choose_language"), {
      reply_markup: new InlineKeyboard().text("🇺🇿 O'zbekcha", "lang:uz").text("🇷🇺 Русский", "lang:ru"),
    });
  });

  bot.callbackQuery(/^lang:(uz|ru)$/, async (ctx) => {
    const user = tgUser(ctx);
    const lang = ctx.match[1] as Lang;
    if (user) await api.setLanguage(user, lang);
    await ctx.answerCallbackQuery({ text: t(lang, "bot.language_set") });
    await ctx.reply(t(lang, "bot.help"), {
      reply_markup: new InlineKeyboard().webApp(t(lang, "bot.open_app"), cfg.miniAppUrl),
    });
  });

  // ---- module B: listing check ----
  const albums = new Map<string, { ctx: Context; messages: Message[]; timer: NodeJS.Timeout }>();

  bot.on(["message:photo", "message:document"], async (ctx) => {
    if (!imageFileId(ctx.message)) return;
    const groupId = ctx.message.media_group_id;
    if (!groupId) return checkImages(ctx, [ctx.message]);

    const key = `${ctx.chat.id}:${groupId}`;
    const existing = albums.get(key);
    if (existing) {
      existing.messages.push(ctx.message);
      clearTimeout(existing.timer);
    }
    const entry = existing ?? { ctx, messages: [ctx.message], timer: undefined as unknown as NodeJS.Timeout };
    entry.timer = setTimeout(() => {
      albums.delete(key);
      void checkImages(entry.ctx, entry.messages);
    }, ALBUM_WAIT_MS);
    albums.set(key, entry);
  });

  bot.on("message:text", async (ctx) => {
    const user = tgUser(ctx);
    if (!user || ctx.message.text.startsWith("/")) return;
    await runCheck(ctx, user, (lang) => api.checkText(user, ctx.message.text, lang));
  });

  bot.on("message", async (ctx) => {
    const user = tgUser(ctx);
    if (user) await ctx.reply(t(await langOf(user), "bot.unsupported"));
  });

  bot.catch((err) => console.error("bot error", err.error));
  return bot;
}
