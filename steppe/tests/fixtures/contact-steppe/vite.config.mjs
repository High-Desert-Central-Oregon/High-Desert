import { fileURLToPath } from "node:url";
const here = fileURLToPath(new URL("./", import.meta.url));
const root = fileURLToPath(new URL("../../../", import.meta.url));
const config = {
  root: here,
  define: { "process.env": {} },
  resolve: { alias: { "@": root, "next/navigation": here + "navigation.ts", "next/link": here + "../member-usability/link.tsx" } },
  plugins: [{ name: "inert-support-action", enforce: "pre", resolveId(id, importer) {
    if (id === "../actions" && importer?.includes("messages/contact/contact-form")) return here + "actions.ts";
  } }],
  css: { postcss: root },
  server: { host: "127.0.0.1", port: 8772, strictPort: true, fs: { allow: [root] } },
};
export default config;
