import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` throws outside React Server Components; tests run in plain Node.
      "server-only": path.resolve(import.meta.dirname, "test/empty-module.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    env: { TZ: "UTC" },
  },
});
