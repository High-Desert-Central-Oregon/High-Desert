import { redirect } from "next/navigation";

/**
 * The events LIST folded into the Exchange (docs/spec/exchange-x1-spec-v1.md
 * §6.5): the board's EVENT filter is its successor. Event DETAIL and NEW keep
 * their canonical URLs — printed QRs, emails, and RSVP links never break.
 */
export default function EventsPage() {
  redirect("/protected/exchange?f=event");
}
