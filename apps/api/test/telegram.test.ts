import { describe, expect, it } from "vitest";
import { buildInitData, validateInitData } from "../src/auth/telegram.js";

const TOKEN = "123456:TEST-TOKEN";
const user = { id: 42, first_name: "Test", language_code: "ru" };

describe("validateInitData", () => {
  it("accepts a correctly signed payload", () => {
    const res = validateInitData(buildInitData(user, TOKEN), TOKEN, 3600);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.user.id).toBe(42);
  });

  it("rejects a tampered payload", () => {
    const tampered = buildInitData(user, TOKEN).replace("%22id%22%3A42", "%22id%22%3A43");
    expect(validateInitData(tampered, TOKEN, 3600)).toEqual({ ok: false, reason: "bad_hash" });
  });

  it("rejects a payload signed with another bot token", () => {
    expect(validateInitData(buildInitData(user, "999:OTHER"), TOKEN, 3600)).toEqual({ ok: false, reason: "bad_hash" });
  });

  it("rejects an expired payload", () => {
    const old = buildInitData(user, TOKEN, Math.floor(Date.now() / 1000) - 7200);
    expect(validateInitData(old, TOKEN, 3600)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects missing hash", () => {
    expect(validateInitData("auth_date=1&user=%7B%7D", TOKEN, 3600)).toEqual({ ok: false, reason: "missing_hash" });
  });
});
