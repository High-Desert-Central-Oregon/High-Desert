"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  blockNeighbor,
  leaveThread,
  reportThread,
  toggleMute,
} from "../actions";
import type { Dictionary } from "@/lib/i18n";

/**
 * The thread ⋯ menu (bundle :826/:840-851): mute · leave · block · report,
 * the four bundle verbs, G-6 normalized. Block and report open a read-and-
 * confirm (Pattern 10 — consequential actions are deliberate). NO "a steward
 * was notified" copy: block is silent (M-G3). Report attaches the reporter's
 * OWN quoted excerpt of the conversation (consent-based disclosure, §6.4).
 * Progressive enhancement: without JS the <details> still open and the forms
 * still post.
 */
export function ThreadMenu({
  threadId,
  counterpartId,
  muted,
  excerpt,
  dict,
}: {
  threadId: string;
  counterpartId: string;
  muted: boolean;
  /** The reporter's own rendered view of the thread, for a report. */
  excerpt: string;
  dict: Dictionary;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const item =
    "block w-full px-[22px] py-[15px] text-left text-[15px] font-medium transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";

  // Escape closes and returns focus to the trigger; an outside click closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={dict.messages.menuMore}
        aria-haspopup="menu"
        aria-controls={panelId}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex size-8 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="12" cy="19" r="1.7" />
        </svg>
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          className="absolute inset-x-0 top-full z-10 border-b bg-card shadow-[0_16px_40px_-18px_rgba(42,46,44,.4)]"
        >
          {/* Mute — one tap, reversible. */}
          <form action={toggleMute}>
            <input type="hidden" name="thread_id" value={threadId} />
            <input type="hidden" name="muted" value={muted ? "1" : "0"} />
            <button type="submit" className={`${item} text-foreground`}>
              {muted ? dict.messages.unmute : dict.messages.mute}
            </button>
          </form>

          {/* Leave — archive; a new message resurfaces it. */}
          <form action={leaveThread} className="border-t">
            <input type="hidden" name="thread_id" value={threadId} />
            <button type="submit" className={`${item} text-foreground`}>
              {dict.messages.leave}
            </button>
          </form>

          {/* Block — silent, read-and-confirm. */}
          <details className="border-t">
            <summary className={`${item} cursor-pointer list-none text-accent [&::-webkit-details-marker]:hidden`}>
              {dict.messages.block}
            </summary>
            <div className="flex flex-col gap-2 px-[22px] pb-4 pt-1">
              <p className="text-[13px] leading-[1.45] text-muted-foreground">
                {dict.messages.blockConfirm}
              </p>
              <form action={blockNeighbor}>
                <input type="hidden" name="blocked_id" value={counterpartId} />
                <button
                  type="submit"
                  className="inline-flex items-center self-start border bg-card px-[14px] py-[9px] font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-accent transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {dict.messages.blockCta}
                </button>
              </form>
            </div>
          </details>

          {/* Report — consent-based: the reporter's own quoted excerpt. */}
          <details className="border-t">
            <summary className={`${item} cursor-pointer list-none text-accent [&::-webkit-details-marker]:hidden`}>
              {dict.messages.reportThread}
            </summary>
            <div className="flex flex-col gap-2 px-[22px] pb-4 pt-1">
              <p className="text-[13px] leading-[1.45] text-muted-foreground">
                {dict.messages.reportThreadConfirm}
              </p>
              <form action={reportThread} className="flex flex-col gap-2">
                <input type="hidden" name="thread_id" value={threadId} />
                <input type="hidden" name="excerpt" value={excerpt} />
                <label htmlFor="report-body" className="sr-only">
                  {dict.messages.reportThreadLabel}
                </label>
                <textarea
                  id="report-body"
                  name="body"
                  required
                  maxLength={2000}
                  rows={2}
                  placeholder={dict.messages.reportThreadLabel}
                  className="w-full resize-none border bg-card px-3 py-2 text-[15px] text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex items-center self-start border bg-card px-[14px] py-[9px] font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {dict.messages.reportThreadCta}
                </button>
              </form>
            </div>
          </details>
        </div>
      )}
    </>
  );
}
