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
      "@": root,
      "next/link": here + "link.tsx",
      "next/navigation": here + "navigation.ts",
    },
  },
  plugins: [
    {
      name: "location-fixture",
      configureServer(server) {
        // Exercise the browser's fragment inheritance across a server redirect.
        server.middlewares.use("/auth-error-callback", (_req, res) => {
          res.statusCode = 302;
          res.setHeader("Location", "/?screen=auth-error&issue=provider");
          res.end();
        });
        server.middlewares.use("/api/event-locations", (_req, res) => {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              suggestions: [
                {
                  name: "Sample Park",
                  address: "12 Main Street, Redmond, Oregon",
                  value: "Sample Park, 12 Main Street, Redmond, Oregon",
                  source: "public",
                },
                {
                  name: "Sample Library, 20 Main Street",
                  address: "",
                  value: "Sample Library, 20 Main Street",
                  source: "steppe",
                },
              ],
            }),
          );
        });
      },
    },
    {
      name: "inert-actions",
      enforce: "pre",
      resolveId(id) {
        if (/(?:^|\/)(?:actions|workflow-actions)$/.test(id))
          return here + "actions.ts";
      },
    },
  ],
  css: { postcss: root },
  server: {
    host: "127.0.0.1",
    port: 8771,
    strictPort: true,
    fs: { allow: [root] },
  },
};
export default config;
