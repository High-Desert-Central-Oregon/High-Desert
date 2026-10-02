import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { getSteppeContact } from "@/lib/messages/contact";
import { contactCopy } from "@/lib/messages/contact-copy";
import { PageSkeleton } from "@/components/page-skeleton";
import { ContactForm } from "./contact-form";

export const metadata = { title: "Contact Steppe" };

async function ContactContent({ searchParams }: { searchParams: Promise<{ msgErr?: string }> }) {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  const [{ locale }, contact, sp] = await Promise.all([
    getServerDictionary(), getSteppeContact(), searchParams,
  ]);
  const copy = contactCopy[locale];
  return (
    <div lang={locale} className="flex flex-col gap-5">
      <Link href="/protected/messages" className="self-start underline focus-ring">{copy.back}</Link>
      <h1 className="font-serif text-3xl">{copy.title}</h1>
      <p>{copy.intro}</p>
      {sp.msgErr === "1" && <p role="alert" className="text-accent">{copy.error}</p>}
      {!contact ? <p role="status">{copy.unavailable}</p> : contact.is_contact ? (
        <p>{copy.receiving}</p>
      ) : contact.thread_id ? (
        <>
          <p className="text-sm text-muted-foreground">{copy.privacy.replace("{name}", contact.contact_name)}</p>
          <Link href={`/protected/messages/${contact.thread_id}`} className="inline-flex min-h-11 items-center self-start bg-primary px-5 py-3 font-semibold text-primary-foreground focus-ring">{copy.continue}</Link>
        </>
      ) : <ContactForm locale={locale} contactName={contact.contact_name} />}
      <a href="mailto:hello@steppe.community" className="self-start underline focus-ring">{copy.email}</a>
    </div>
  );
}

export default function ContactPage({ searchParams }: { searchParams: Promise<{ msgErr?: string }> }) {
  return <Suspense fallback={<PageSkeleton />}><ContactContent searchParams={searchParams} /></Suspense>;
}
