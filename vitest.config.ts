import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"],
    exclude: ["**/node_modules/**", process.env.RUN_LIVE_AI ? "" : "apps/api/test/live/**"].filter(Boolean),
  },
});
