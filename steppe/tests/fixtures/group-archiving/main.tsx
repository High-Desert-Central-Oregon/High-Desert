import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/600.css";
import "../../../app/globals.css";
import "@fontsource/fraunces/600.css";
import { ArchivedGroup } from "../../../components/archived-group";
import { createRoot } from "react-dom/client";
import { ArchiveGroupForm } from "../../../app/protected/groups/[slug]/manage/archive-form";
const params = new URLSearchParams(location.search);
const locale = params.get("lang") === "es" ? "es" : "en";
document.documentElement.lang = locale;
document.documentElement.style.setProperty("--font-sans-mkt", '"Public Sans"');
document.documentElement.style.setProperty("--font-display", '"Fraunces"');
document.documentElement.classList.toggle("dark", params.get("night") === "1");
createRoot(document.getElementById("root")!).render(
  <main lang={locale} className="mx-auto flex max-w-lg flex-col gap-6 p-4">
    <p className="text-sm text-muted-foreground">
      Local review · synthetic group · no data changed
    </p>
    <h1 className="break-words text-2xl font-semibold">
      {locale === "es" ? "Administrar grupo de ejemplo" : "Manage sample group"}
    </h1>
    {params.get("view") === "archived" ? (
      <ArchivedGroup
        locale={locale}
        name="Sample neighborhood gardening group with a long name"
      />
    ) : (
      <ArchiveGroupForm
        locale={locale}
        groupId="11111111-1111-4111-8111-111111111111"
      />
    )}
  </main>,
);
