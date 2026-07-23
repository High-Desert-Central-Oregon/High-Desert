import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Never lint build output or deps — these are generated, not authored.
  // public/sw.js is the compiled service worker (@serwist/next writes it at
  // build time; app/sw.ts is the authored source and IS linted).
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "public/sw.js"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Allow intentionally-unused args/vars when prefixed with "_"
      // (e.g. useActionState's (_prev, _formData) signature).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default eslintConfig;
