import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
const root = dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root,
  resolve: { alias: { "@": root } },
  test: {
    environment: "node",
    include: [
      "tests/member-pipelines*.test.ts",
      "tests/bug-*.test.ts",
      "tests/interest-route.test.ts",
      "tests/invite-redeem-route.test.ts",
      "tests/pledge-route.test.ts",
    ],
    setupFiles: [],
    env: { SUPABASE_SERVICE_ROLE_KEY: "", RESEND_API_KEY: "" },
  },
});
