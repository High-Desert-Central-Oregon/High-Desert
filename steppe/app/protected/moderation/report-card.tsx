import { fileReport } from "./actions";
import type { Dictionary } from "@/lib/i18n";

/**
 * The member Report intake (0021; messages-m1-spec §2 — the X1 §8 action-row
 * debt). A JS-free details-reveal: the summary wears the bundle's secondary
 * hairline-button grammar (secBtn :2100 — 13.5px/600, paper, inset top
 * highlight); the revealed form is one required textarea and a submit. The
 * quiet line says who reads it. Confirmation is a ?reported=1 notice on the
 * page — identical every time (no oracle).
 */
export function ReportCard({
  targetType,
  targetId,
  back,
  dict,
}: {
  targetType: "post" | "event";
  targetId: string;
  back: string;
  dict: Dictionary;
}) {
  return (
    <details>
      <summary className="flex cursor-pointer items-center justify-center border bg-card p-[13px] text-[13.5px] font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,.5)] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        {dict.moderation.reportButton}
      </summary>
      <form
        action={fileReport}
        className="mt-[11px] flex flex-col gap-2 border bg-muted px-[14px] py-[13px]"
      >
        <input type="hidden" name="target_type" value={targetType} />
        <input type="hidden" name="target_id" value={targetId} />
        <input type="hidden" name="back" value={back} />
        <label
          htmlFor={`report-${targetId}`}
          className="text-sm font-medium text-foreground"
        >
          {dict.moderation.reportLabel}
        </label>
        <textarea
          id={`report-${targetId}`}
          name="body"
          required
          maxLength={2000}
          rows={3}
          placeholder={dict.moderation.reportPlaceholder}
          className="w-full resize-none border bg-card px-3 py-2 text-[15px] text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none"
        />
        <p className="flex items-center gap-[7px] font-mono text-[9.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          <span
            aria-hidden="true"
            className="inline-block size-[6px] rounded-full bg-[color:var(--marker-sage)]"
          />
          {dict.moderation.reportPrivacyNote}
        </p>
        <button
          type="submit"
          className="inline-flex items-center self-start border bg-card px-[14px] py-[9px] font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {dict.moderation.reportSubmit}
        </button>
      </form>
    </details>
  );
}
