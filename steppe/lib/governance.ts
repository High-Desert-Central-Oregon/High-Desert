import type { ProposalStatus } from "@/lib/types/db";

/**
 * A proposal's state is COMPUTED from its window and the clock, never trusted
 * from a stored flag alone. There is no scheduled job flipping proposals in this
 * prototype, so time is the source of truth — and these boundaries deliberately
 * mirror the database:
 *   • voting is allowed while `opens_at <= now <= closes_at` (votes RLS), and
 *   • results appear only once `now > closes_at` (the proposal_results view).
 * A moderator may also mark a proposal `closed` early; that always wins.
 */
export type ProposalState = "upcoming" | "open" | "closed";

/** Foundational proposals require a full notice period before voting opens.
 * The database is authoritative (migration 0033); this constant only provides
 * a friendly form error before the insert reaches that guard. */
export const FOUNDATIONAL_NOTICE_DAYS = 30;

export function hasFoundationalNotice(opensAtMs: number, createdAtMs: number): boolean {
  return opensAtMs >= createdAtMs + FOUNDATIONAL_NOTICE_DAYS * 24 * 60 * 60 * 1000;
}

export function proposalState(
  opensAt: string,
  closesAt: string,
  status: ProposalStatus,
  nowMs: number,
): ProposalState {
  if (status === "closed") return "closed";
  const opens = Date.parse(opensAt);
  const closes = Date.parse(closesAt);
  if (Number.isFinite(closes) && nowMs > closes) return "closed";
  if (Number.isFinite(opens) && nowMs < opens) return "upcoming";
  return "open";
}
