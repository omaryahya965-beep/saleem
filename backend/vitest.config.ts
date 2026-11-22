import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    // D214: refuses any database target other than the isolated test stack, before any test file runs.
    setupFiles: ["tests/helpers/db-guard.ts"],
  },
});
