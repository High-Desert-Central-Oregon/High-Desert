/** Steppe — isolated accessibility regression fixture.
 * Copyright (C) 2026 Steppe
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const here = fileURLToPath(new URL("./", import.meta.url));
const config = {
  root: here,
  publicDir: root + "public",
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
        // A real image error exercises the production map fallback; no hosted writes.
        server.middlewares.use(
          "/maps/redmond-2019/aerial.webp",
          (req, res, next) => {
            if (!req.headers.referer?.includes("map-image-failure=1"))
              return next();
            res.statusCode = 503;
            res.end("Synthetic map image failure");
          },
        );
        server.middlewares.use("/api/neighborhood-address", (req, res) => {
          res.setHeader("Content-Type", "application/json");
          if (req.headers.referer?.includes("address-failure=1")) {
            res.statusCode = 503;
            return res.end(JSON.stringify({ results: [], unavailable: true }));
          }
          if (req.headers.referer?.includes("address-empty=1"))
            return res.end(JSON.stringify({ results: [] }));
          res.end(
            JSON.stringify({
              results: [
                {
                  label: "Sam Johnson Park, Redmond, Oregon",
                  lat: 44.2733078,
                  lng: -121.1854115,
                },
                {
                  label: "Sample outside-map place, Redmond area",
                  lat: 44.27,
                  lng: -121.26,
                },
              ],
            }),
          );
        });
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
