import type {
  GroupJoinPolicy,
  GroupMemberRole,
  GroupMemberStatus,
} from "@/lib/types/db";

/**
 * Which membership control a viewer should see for a group, derived purely from
 * the 1a state (join_policy × the viewer's own membership). Shared by the
 * directory and the group page so the two never drift. The server RPCs remain the
 * real gate — this only chooses which control to render.
 *
 *   manage  — active maintainer → the maintainer console
 *   member  — active member (incl. the implicit Everyone group)
 *   pending — a request awaiting a maintainer
 *   invited — invited, not yet active
 *   join    — open policy, not a member → join instantly
 *   request — request policy, not a member → ask to join
 *   locked  — invite-only, not a member → no self-join
 */
export type GroupControl =
  | "manage"
  | "member"
  | "pending"
  | "invited"
  | "join"
  | "request"
  | "locked";

export function groupControl(opts: {
  joinPolicy: GroupJoinPolicy;
  isSystem: boolean;
  myStatus: GroupMemberStatus | null;
  myRole: GroupMemberRole | null;
}): GroupControl {
  const { joinPolicy, isSystem, myStatus, myRole } = opts;
  if (myStatus === "active") return myRole === "maintainer" ? "manage" : "member";
  // The Everyone group: every verified member belongs implicitly (no row).
  if (isSystem) return "member";
  if (myStatus === "pending") return "pending";
  if (myStatus === "invited") return "invited";
  if (joinPolicy === "open") return "join";
  if (joinPolicy === "request") return "request";
  return "locked";
}

/**
 * Turn a group name into a URL slug — lowercase, runs of non-alphanumerics to a
 * single hyphen, trimmed. Mirrors the slug normalization in create_group /
 * suggest_category so the slug the UI computes matches the one the DB stores.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
