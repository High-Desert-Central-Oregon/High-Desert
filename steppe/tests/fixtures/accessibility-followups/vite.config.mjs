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
    port: 8770,
    strictPort: true,
    fs: { allow: [root] },
  },
};
export default config;
