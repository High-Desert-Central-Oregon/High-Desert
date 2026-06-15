/**
 * Hand-written row types for the tables this slice touches. They mirror
 * `schema.sql`; regenerate with the Supabase CLI once the schema settles.
 *
 * Trust columns (`verified`, `role`, `tenure_start`) are listed here for reads,
 * but the database — not this app — is the only thing that may set them
 * (schema.sql `trg_guard_profile_columns`). Never write them from the client.
 */
export type MemberRole = "member" | "moderator" | "admin";

export type Profile = {
  id: string;
  display_name: string;
  neighborhood_id: string | null;
  verified: boolean;
  role: MemberRole;
  tenure_start: string | null;
  locale: string;
  created_at: string;
};

export type NeighborhoodRequestStatus = "open" | "resolved";

export type NeighborhoodRequest = {
  id: string;
  user_id: string;
  note: string | null;
  status: NeighborhoodRequestStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

export type EventStatus = "active" | "cancelled";

export type EventRow = {
  id: string;
  creator_id: string;
  neighborhood_id: string | null;
  title: string;
  body: string | null;
  starts_at: string;
  location: string | null;
  capacity: number | null;
  status: EventStatus;
  created_at: string;
};

export type RsvpStatus = "going" | "maybe";

export type EventRsvp = {
  id: string;
  event_id: string;
  user_id: string;
  status: RsvpStatus;
  bringing: string | null;
  created_at: string;
};

export type ProposalKind = "minor" | "major" | "immutable";
export type ProposalStatus = "draft" | "open" | "closed";
export type VoteChoice = "yes" | "no" | "abstain";

export type ProposalRow = {
  id: string;
  author_id: string | null;
  title: string;
  body: string | null;
  kind: ProposalKind;
  status: ProposalStatus;
  opens_at: string;
  closes_at: string;
  created_at: string;
};

/** Aggregate, weighted result — read ONLY from the proposal_results view, which
 *  exposes closed proposals only and never per-ballot data. `revealed` is the
 *  MIN_TURNOUT floor: below it the weighted breakdown is withheld (null) so a
 *  small-N close can't de-anonymise a ballot; turnout (`ballots`) still shows. */
export type ProposalResult = {
  proposal_id: string;
  title: string;
  kind: ProposalKind;
  status: ProposalStatus;
  closes_at: string;
  ballots: number;
  revealed: boolean;
  yes_weight: number | null;
  no_weight: number | null;
  abstain_weight: number | null;
};

export type ModAction =
  | "warn"
  | "temp_ban"
  | "extended_ban"
  | "review"
  | "remove"
  | "restore";

export type ModerationActionRow = {
  id: string;
  target_type: string;
  target_id: string;
  actor_id: string;
  action: ModAction;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
};

/** A row of the content_moderation view: the LATEST remove/restore for a target. */
export type ContentModerationRow = {
  action_id: string;
  target_type: string;
  target_id: string;
  action: "remove" | "restore";
  reason: string | null;
  actor_id: string;
  created_at: string;
};

export type AppealStatus = "open" | "upheld" | "overturned";

export type AppealRow = {
  id: string;
  moderation_action_id: string;
  user_id: string;
  body: string;
  status: AppealStatus;
  created_at: string;
};

// Groups core (Spec v2 §1; migration 0013).
export type GroupVisibility = "public" | "members_only";
export type GroupJoinPolicy = "open" | "request" | "locked";
export type GroupMemberRole = "maintainer" | "member";
export type GroupMemberStatus = "active" | "pending" | "invited";

export type Category = {
  id: string;
  slug: string;
  name: string;
  created_by: string | null;
  created_at: string;
};

/** Full group row (base table) — readable for public groups, or members_only
 *  groups you're an active member of (grp_read). */
export type GroupRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category_id: string | null;
  visibility: GroupVisibility;
  join_policy: GroupJoinPolicy;
  is_system: boolean;
  created_by: string | null;
  created_at: string;
  archived_at: string | null;
};

/** Directory-safe projection (groups_directory view): every group to any verified
 *  member, but `description` is null for members_only groups (G8). */
export type GroupDirectoryRow = {
  id: string;
  slug: string;
  name: string;
  category_id: string | null;
  visibility: GroupVisibility;
  join_policy: GroupJoinPolicy;
  is_system: boolean;
  created_at: string;
  archived_at: string | null;
  description: string | null;
  member_count: number;
};

export type GroupMemberRow = {
  id: string;
  group_id: string;
  user_id: string;
  role: GroupMemberRole;
  status: GroupMemberStatus;
  created_at: string;
};

export type DocKind = "terms" | "privacy";

export type DocumentRow = {
  id: string;
  kind: DocKind;
  version: string;
  body: string;
  published_at: string;
};

export type ConsentRow = {
  id: string;
  user_id: string;
  document_id: string;
  accepted_at: string;
};
