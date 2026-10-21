import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // vibecode-starters ships its own tests; only run the app's
    include: ["lib/**/*.test.ts", "modules/**/*.test.ts"],
  },
});
