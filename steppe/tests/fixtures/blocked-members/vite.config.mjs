import { fileURLToPath } from "node:url";
const here = fileURLToPath(new URL("./", import.meta.url));
const root = fileURLToPath(new URL("../../../", import.meta.url));
const config = {
  root: here,
  define: { "process.env": {} },
  resolve: { alias: { "@": root } },
  plugins: [
    {
      name: "inert-unblock-action",
      enforce: "pre",
      resolveId(id, importer) {
        if (id === "./actions" && importer?.includes("blocked/unblock-form"))
          return here + "actions.ts";
      },
    },
  ],
  css: { postcss: root },
  server: {
    host: "127.0.0.1",
    port: 8775,
    strictPort: true,
    fs: { allow: [root] },
  },
};

export default config;
