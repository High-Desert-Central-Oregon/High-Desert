import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/fraunces/400.css";
import "../../../app/globals.css";
import { createRoot } from "react-dom/client";
import Link from "next/link";
import { ContactForm } from "../../../app/protected/messages/contact/contact-form";
import { contactCopy } from "../../../lib/messages/contact-copy";
import { setFailure } from "./actions";

const sp = new URLSearchParams(location.search);
const locale = sp.get("lang") === "es" ? "es" : "en";
const copy = contactCopy[locale];
document.documentElement.classList.toggle("dark", sp.get("night") === "1");
setFailure(sp.get("failure") ?? "returned");
createRoot(document.getElementById("root")!).render(
  <main lang={locale} className="mx-auto flex max-w-[var(--content-max)] flex-col gap-5 p-[var(--pad-screen)]">
    <p className="text-sm text-muted-foreground">Local review · synthetic contact · no messages sent</p>
    <Link href="/?lang=en" className="self-start underline focus-ring">{copy.back}</Link>
    <h1 className="font-serif text-3xl">{copy.title}</h1>
    <p>{copy.intro}</p>
    <ContactForm locale={locale} contactName="Sample support contact" />
    <a href="mailto:hello@steppe.community" className="self-start underline focus-ring">{copy.email}</a>
  </main>,
);
