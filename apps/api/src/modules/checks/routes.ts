import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import { LANGS, t, type Lang } from "@ishonch/shared";
import { CheckRejected, CheckService, MAX_IMAGES } from "./service.js";
import type { CheckImage } from "./pipeline.js";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function checkRoutes(app: FastifyInstance, service: CheckService, requireUser: preHandlerHookHandler) {
  app.get("/checks/limit", { preHandler: requireUser }, async (req) => service.limitInfo(req.user!));

  app.post("/checks", { preHandler: requireUser }, async (req, reply) => {
    const user = req.user!;
    let text: string | undefined;
    let lang: Lang | undefined;
    const images: CheckImage[] = [];

    if (req.isMultipart()) {
      for await (const part of req.parts()) {
        if (part.type === "file") {
          const buf = await part.toBuffer();
          if (!IMAGE_TYPES.has(part.mimetype)) continue;
          images.push({ mediaType: part.mimetype as CheckImage["mediaType"], base64: buf.toString("base64") });
        } else if (part.fieldname === "text") {
          text = String(part.value);
        } else if (part.fieldname === "lang") {
          lang = String(part.value) as Lang;
        }
      }
    } else {
      const body = (req.body ?? {}) as { text?: string; lang?: string };
      text = body.text;
      lang = body.lang as Lang | undefined;
    }
    if (lang && !LANGS.includes(lang)) lang = undefined;

    try {
      return await service.create(user, { lang, text, images });
    } catch (err) {
      if (err instanceof CheckRejected) {
        const l = lang ?? (user.language as Lang);
        return reply.code(err.status).send({
          error: err.code,
          message: t(l, `check.${err.code}` as Parameters<typeof t>[1], err.params),
        });
      }
      throw err;
    }
  });

  // Public on purpose: shareable link. IDs are random UUIDs and results are anonymised.
  app.get<{ Params: { id: string } }>("/checks/:id", async (req, reply) => {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return reply.code(404).send({ error: "not_found" });
    const check = await service.get(req.params.id);
    if (!check) return reply.code(404).send({ error: "not_found" });
    return check;
  });
}

export const multipartLimits = { files: MAX_IMAGES + 1, fileSize: MAX_IMAGE_BYTES, fields: 5 };
