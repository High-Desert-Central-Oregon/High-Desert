import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Load steppe/.env.local for local runs so the RLS smoke suite can reach the dev
// Supabase using the PUBLIC anon/publishable key (RLS still gates every row, so
// this is safe to use in a test). In CI there is no .env.local, so this is a
// no-op and the RLS suite skips itself. Values are loaded into process.env only —
// never logged. process.loadEnvFile is a Node built-in (>= 20.12).
const envPath = fileURLToPath(new URL("../.env.local", import.meta.url));
if (existsSync(envPath)) {
  try {
    process.loadEnvFile(envPath);
  } catch {
    // A malformed or unreadable .env.local just means the RLS suite skips.
  }
}
