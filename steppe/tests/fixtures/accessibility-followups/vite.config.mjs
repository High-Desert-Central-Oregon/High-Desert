/** Steppe — isolated accessibility regression fixture.
 * Copyright (C) 2026 Steppe
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const here = fileURLToPath(new URL("./", import.meta.url));
const config = {
  root: here,
  define: { "process.env": {} },
  resolve: {
    alias: {
      "@/lib/supabase/client": here + "auth-client.ts",
      "@": root,
      "next/link": here + "link.tsx",
      "next/navigation": here + "navigation.ts",
    },
  },
  plugins: [
    {
      name: "inert-actions",
      enforce: "pre",
      configureServer(server) {
        // Synthetic responses only. Never proxy to production or retain bodies.
        server.middlewares.use("/api/bug-reports", (_req, res) => {
          let body = "";
          _req.on("data", (chunk) => { body += chunk; });
          _req.on("end", () => {
            let success = false;
            try { success = JSON.parse(body).expected === "Synthetic success"; } catch {}
            res.statusCode = success ? 200 : 503;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(success
              ? { ok: true, id: "synthetic-report" }
              : { ok: false }));
          });
        });
      },
      resolveId(id) {
        if (/(?:^|\/)(?:actions|workflow-actions)$/.test(id))
          return here + "actions.ts";
      },
    },
  ],
  css: { postcss: root },
  server: {
    host: "127.0.0.1",
    port: 8770,
    strictPort: true,
    fs: { allow: [root] },
  },
};
export default config;
