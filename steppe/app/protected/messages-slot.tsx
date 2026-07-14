import Link from "next/link";
import { IconSlot } from "@/components/broadsheet/chips";

/**
 * The shell header's round messages slot (bundle :452-455) — un-reserved with
 * M1. Ships WITH the feature (no dead icons). The unread signal is a 9px rust
 * presence dot (:2085, "quiet signals only — a DOT, never a number" :1518),
 * server-computed per navigation (poll-on-nav; lib/messages.ts getUnreadState)
 * and passed in. Links to the inbox; works without JavaScript.
 */
export function MessagesSlot({
  label,
  hasUnread,
}: {
  label: string;
  hasUnread: boolean;
}) {
  return (
    <Link
      href="/protected/messages"
      aria-label={label}
      className="relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <IconSlot>
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2A2E2C"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.4 9.4 0 0 1-2.8-.4L4 21l1.3-3.9A8.2 8.2 0 0 1 12 3.2a8.4 8.4 0 0 1 9 8.3z" />
        </svg>
      </IconSlot>
      {hasUnread && (
        <span
          aria-hidden="true"
          className="absolute -right-px -top-px size-[9px] rounded-full border-2 border-muted bg-accent"
        />
      )}
    </Link>
  );
}
