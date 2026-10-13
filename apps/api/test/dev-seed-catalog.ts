// Seeds the demo catalog (fixtures/assistant.json) with generated photos for local development.
//   pnpm --filter @ishonch/api dev:seed-catalog
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { PROMPTS_DIR } from "@ishonch/shared/node";
import { loadConfig } from "../src/config.js";
import { createDb } from "../src/db/client.js";
import { Repo } from "../src/db/repo.js";
import { listingPhotos, listings, shops, users } from "../src/db/schema.js";
import { processImage } from "../src/storage/images.js";
import { FsStorage, type Storage } from "../src/storage/storage.js";
import { testPhoto } from "./helpers.js";

const config = loadConfig();
const { db, sql } = createDb(config.DATABASE_URL);
const repo = new Repo(db);
const storage: Storage = new FsStorage(process.env.STORAGE_DIR ?? "./data/storage");
const { catalog } = JSON.parse(readFileSync(`${PROMPTS_DIR}__fixtures__/assistant.json`, "utf8"));

const shopOwner = await repo.upsertTelegramUser({ id: 999_000_001, language_code: "uz" });
const privateSeller = await repo.upsertTelegramUser({ id: 999_000_002, language_code: "ru" });
await db.update(users).set({ createdAt: new Date(Date.now() - 200 * 864e5), phone: "+998900000001" }).where(eq(users.id, shopOwner.id));
const [shop] = await db
  .insert(shops)
  .values({ ownerUserId: shopOwner.id, name: "Malika Tech", marketLocation: "Malika, 3-qator, 12", verified: true, verifiedAt: new Date() })
  .onConflictDoUpdate({ target: shops.ownerUserId, set: { verified: true } })
  .returning();
await db.delete(listings).where(eq(listings.sellerUserId, shopOwner.id));
await db.delete(listings).where(eq(listings.sellerUserId, privateSeller.id));

for (const [i, f] of catalog.entries()) {
  const fromShop = ["mba_m1", "redmi_note13", "airpods_pro2"].includes(f.key);
  const [row] = await db
    .insert(listings)
    .values({
      sellerUserId: fromShop ? shopOwner.id : privateSeller.id,
      shopId: fromShop ? shop!.id : null,
      category: f.category,
      titleRu: f.titleRu,
      titleUz: f.titleUz,
      descriptionRu: f.descriptionRu,
      descriptionUz: f.descriptionUz,
      attributes: { brand: null, model: null, modelKey: f.modelKey, specs: [] },
      condition: f.condition,
      price: f.price,
      district: f.district,
      status: "active",
      publishedAt: new Date(),
      bumpedAt: new Date(Date.now() - i * 60_000),
      expiresAt: new Date(Date.now() + 30 * 864e5),
    })
    .returning();
  const img = await processImage(await testPhoto(i + 2));
  const key = `listings/${row!.id}/demo.jpg`;
  await storage.put(key, img.full, "image/jpeg");
  await db.insert(listingPhotos).values({ listingId: row!.id, storageKey: key, phash: img.phash, width: img.width, height: img.height });
}
console.log(`seeded ${catalog.length} demo listings`);
await sql.end();
