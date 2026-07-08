import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests live in tests/ and are excluded from the Next build (tsconfig.json), so
// they never touch the production bundle. Vitest transpiles them with esbuild.
const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Mirror the tsconfig "@/*" -> "./*" alias so tests import app/lib code the same
  // way the app does (e.g. "@/app/api/interest/route").
  resolve: { alias: { "@": root } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
