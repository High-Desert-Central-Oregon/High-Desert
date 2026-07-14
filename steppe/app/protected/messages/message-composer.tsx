import { startThread } from "./actions";
import type { Dictionary } from "@/lib/i18n";

/**
 * The "Message {FirstName}" door on post detail (bundle :777; spec §5 door 1).
 * A JS-free details-reveal in the bundle's primary-action grammar: the summary
 * is the juniper-deep letterpress button; opening it reveals the composer
 * (composePrivacy line + textarea + Send). start_thread() is the gate
 * (verified, post-anchored, no-oracle); on success it routes to the new thread.
 */
export function MessageComposer({
  authorId,
  authorName,
  postId,
  back,
  dict,
}: {
  authorId: string;
  authorName: string;
  postId: string;
  back: string;
  dict: Dictionary;
}) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-center bg-primary px-4 py-[15px] text-[15.5px] font-bold text-primary-foreground shadow-letterpress transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        {dict.messages.messageAuthor.replace(
          "{name}",
          authorName.split(/\s+/)[0] || authorName,
        )}
      </summary>
      <form action={startThread} className="mt-3 flex flex-col gap-2 border bg-card p-4">
        <input type="hidden" name="with_id" value={authorId} />
        <input type="hidden" name="about_post" value={postId} />
        <input type="hidden" name="back" value={back} />
        <p className="text-[13px] leading-[1.45] text-muted-foreground">
          {dict.messages.composerHint}
        </p>
        <label htmlFor="msg-body" className="sr-only">
          {dict.messages.placeholder}
        </label>
        <textarea
          id="msg-body"
          name="body"
          required
          maxLength={4000}
          rows={3}
          placeholder={dict.messages.placeholder}
          className="w-full resize-none border bg-card px-3 py-2 text-[15px] text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none"
        />
        {/* composePrivacy — un-reserved with M1 (X1 §8 reserved it for exactly
            this feature). Sage marker + the promise. */}
        <p className="flex items-start gap-[7px] text-[12.5px] leading-[1.45] text-muted-foreground">
          <span
            aria-hidden="true"
            className="mt-1 inline-block size-[7px] shrink-0 rounded-full bg-[color:var(--marker-sage)]"
          />
          {dict.messages.composePrivacy}
        </p>
        <button
          type="submit"
          className="inline-flex items-center self-start bg-primary px-5 py-[11px] font-mono text-[13px] font-bold uppercase tracking-[0.06em] text-primary-foreground shadow-letterpress transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {dict.messages.send}
        </button>
      </form>
    </details>
  );
}
