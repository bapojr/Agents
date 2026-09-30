import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {alias: {"@": fileURLToPath(new URL("./src", import.meta.url))}},
  test: {
    maxWorkers: 1, testTimeout: 15000, hookTimeout: 30000,
    server: {deps: {inline: ["next-auth"]}},
  },
});
