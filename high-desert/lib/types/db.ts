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
