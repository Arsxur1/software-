import { createHmac, timingSafeEqual } from "node:crypto";

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export type InitDataResult =
  | { ok: true; user: TelegramUser; authDate: number; startParam?: string }
  | { ok: false; reason: "missing_hash" | "bad_hash" | "expired" | "no_user" };

function dataCheckString(params: URLSearchParams): string {
  return [...params.entries()]
    .filter(([k]) => k !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
}

export function signInitData(params: URLSearchParams, botToken: string): string {
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  return createHmac("sha256", secret).update(dataCheckString(params)).digest("hex");
}

/**
 * Validates Telegram Mini App `initData` as described in
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateInitData(
  initData: string,
  botToken: string,
  maxAgeSec: number,
  nowSec: number = Math.floor(Date.now() / 1000),
): InitDataResult {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "missing_hash" };

  const expected = Buffer.from(signInitData(params, botToken), "hex");
  const given = Buffer.from(hash, "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, reason: "bad_hash" };
  }

  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || nowSec - authDate > maxAgeSec) return { ok: false, reason: "expired" };

  const rawUser = params.get("user");
  if (!rawUser) return { ok: false, reason: "no_user" };
  const user = JSON.parse(rawUser) as TelegramUser;
  if (typeof user.id !== "number") return { ok: false, reason: "no_user" };

  return { ok: true, user, authDate, startParam: params.get("start_param") ?? undefined };
}

/** Builds a signed initData string — used by tests and the local dev script. */
export function buildInitData(user: TelegramUser, botToken: string, authDate = Math.floor(Date.now() / 1000)) {
  const params = new URLSearchParams({ auth_date: String(authDate), query_id: "dev", user: JSON.stringify(user) });
  params.set("hash", signInitData(params, botToken));
  return params.toString();
}
