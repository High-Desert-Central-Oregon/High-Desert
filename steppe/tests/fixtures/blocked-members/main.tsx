import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/600.css";
import "../../../app/globals.css";
import { createRoot } from "react-dom/client";
import { UnblockForm } from "../../../app/protected/account/blocked/unblock-form";
import { blocksCopy } from "../../../lib/messages/blocks-copy";
const params = new URLSearchParams(location.search);
const locale = params.get("lang") === "es" ? "es" : "en";
const copy = blocksCopy[locale];
document.documentElement.classList.toggle("dark", params.get("night") === "1");
createRoot(document.getElementById("root")!).render(
  <main lang={locale} className="mx-auto flex max-w-lg flex-col gap-6 p-4">
    <p className="text-sm text-muted-foreground">
      Local review · synthetic member · no blocks changed
    </p>
    <h1 className="text-2xl font-semibold">{copy.title}</h1>
    <p className="text-sm text-muted-foreground">{copy.sub}</p>
    <UnblockForm
      locale={locale}
      blockedId="22222222-2222-4222-8222-222222222222"
      name="Sample Neighbor with a long display name"
    />
  </main>,
);
