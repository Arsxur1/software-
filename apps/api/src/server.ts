import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";

const config = loadConfig();
const { db, sql } = createDb(config.DATABASE_URL);
const app = await buildApp({ config, db });

const shutdown = async () => {
  await app.close();
  await sql.end();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.listen({ port: config.PORT, host: "0.0.0.0" });
