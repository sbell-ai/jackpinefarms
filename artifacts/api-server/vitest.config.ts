import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    // Each file gets its own isolated module registry (important for rate-limit state)
    pool: "forks",
  },
});
