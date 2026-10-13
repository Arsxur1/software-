import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests share one PostgreSQL database: run files one after another.
    fileParallelism: false,
    include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"],
    exclude: ["**/node_modules/**", process.env.RUN_LIVE_AI ? "" : "apps/api/test/live/**"].filter(Boolean),
  },
});
