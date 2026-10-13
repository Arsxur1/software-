import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import { z } from "zod";
import { startOfMonthUtc, startOfTashkentDay, type Repo } from "../../db/repo.js";

const PriceRowSchema = z.object({
  modelKey: z.string().min(2),
  priceMin: z.number().positive(),
  priceMedian: z.number().positive(),
  priceMax: z.number().positive(),
  categoryId: z.number().int().nullable().optional(),
});

/** CSV: model_key,price_min,price_median,price_max (header row optional, `;` or `,`). */
export function parsePriceCsv(csv: string) {
  const rows: z.infer<typeof PriceRowSchema>[] = [];
  const errors: string[] = [];
  csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const cols = line.split(/[;,]/).map((c) => c.trim().replace(/^"|"$/g, ""));
      if (i === 0 && /model/i.test(cols[0] ?? "")) return;
      const parsed = PriceRowSchema.safeParse({
        modelKey: cols[0],
        priceMin: Number(cols[1]),
        priceMedian: Number(cols[2]),
        priceMax: Number(cols[3]),
      });
      if (!parsed.success || parsed.data.priceMin > parsed.data.priceMedian || parsed.data.priceMedian > parsed.data.priceMax) {
        errors.push(`line ${i + 1}: ${line}`);
      } else rows.push(parsed.data);
    });
  return { rows, errors };
}

export function adminRoutes(app: FastifyInstance, repo: Repo, requireAdmin: preHandlerHookHandler) {
  app.get("/admin/price-reference", { preHandler: requireAdmin }, () => repo.listPriceReference());

  app.put("/admin/price-reference", { preHandler: requireAdmin }, async (req, reply) => {
    const parsed = z.array(PriceRowSchema).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad_request", details: parsed.error.issues });
    await repo.upsertPriceReference(parsed.data);
    return { ok: true, count: parsed.data.length };
  });

  app.delete<{ Params: { id: string } }>("/admin/price-reference/:id", { preHandler: requireAdmin }, async (req) => {
    await repo.deletePriceReference(Number(req.params.id));
    return { ok: true };
  });

  app.post("/admin/price-reference/import", { preHandler: requireAdmin }, async (req) => {
    const { rows, errors } = parsePriceCsv(String(req.body ?? ""));
    await repo.upsertPriceReference(rows.map((r) => ({ ...r, source: "csv" })));
    return { imported: rows.length, errors };
  });

  app.get("/admin/ai-usage", { preHandler: requireAdmin }, async () => {
    const [today, month] = await Promise.all([
      repo.aiSpendSince(startOfTashkentDay()),
      repo.aiSpendSince(startOfMonthUtc()),
    ]);
    const limit = await repo.getSetting("ai_monthly_limit_usd", 50);
    return { todayUsd: today, monthUsd: month, monthlyLimitUsd: limit, overLimit: month >= limit };
  });
}
