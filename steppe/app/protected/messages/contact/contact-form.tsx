import type { Locale } from "@/lib/i18n";
import { contactCopy } from "@/lib/messages/contact-copy";
import { contactSteppe, contactSteppeDraft } from "../actions";
import { MessageForm } from "../message-form";

export function ContactForm({ locale, contactName }: { locale: Locale; contactName: string }) {
  const copy = contactCopy[locale];
  return (
    <MessageForm
      action={contactSteppeDraft}
      fallbackAction={contactSteppe}
      className="flex flex-col gap-3 border bg-card p-4"
      buttonClassName="inline-flex min-h-11 items-center self-start bg-primary px-5 py-3 font-semibold text-primary-foreground shadow-letterpress focus-ring"
      sendLabel={copy.send}
      sendingLabel={copy.sending}
      errorMessage={copy.error}
    >
      <p className="text-sm text-muted-foreground">{copy.privacy.replace("{name}", contactName)}</p>
      <label htmlFor="support-body" className="font-semibold">{copy.label}</label>
      <textarea
        id="support-body" name="body" required maxLength={4000} rows={5}
        aria-describedby="support-limit" placeholder={copy.placeholder}
        className="field-control focus-ring w-full resize-y border bg-card px-3 py-2 text-base text-foreground placeholder:text-muted-foreground"
      />
      <p id="support-limit" className="text-sm text-muted-foreground">{copy.limit}</p>
    </MessageForm>
  );
}
