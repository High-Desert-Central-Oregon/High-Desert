import { createClient } from "@/lib/supabase/server";
import type { DocKind, DocumentRow } from "@/lib/types/db";

/**
 * Onboarding / consent reads (SPEC §05, A5). The consent *record* lives in the
 * `consents` table — the only source of truth (no localStorage for trust state).
 * This module answers two questions for the gate: "what are the current
 * documents?" and "has this member agreed to all of them?".
 */

const KIND_ORDER: DocKind[] = ["terms", "privacy"];

/**
 * Reduce documents (already ordered newest-first by `published_at`) to the
 * latest row per kind, returned in reading order (terms, then privacy). Shared
 * by the body-carrying render read and the body-free consent check so the two
 * can never disagree on which version is "current".
 */
function latestPerKind<T extends { kind: DocKind }>(rows: T[]): T[] {
  const latestByKind = new Map<DocKind, T>();
  for (const row of rows) {
    if (!latestByKind.has(row.kind)) latestByKind.set(row.kind, row);
  }
  return KIND_ORDER.map((kind) => latestByKind.get(kind)).filter(
    (row): row is T => Boolean(row),
  );
}

/**
 * The current published version of each member-facing document, newest first by
 * `published_at`, returned in reading order (terms, then privacy). "Current"
 * means latest version; when a document is re-published with a new version it
 * gets a new id, which is what makes re-consent fall out naturally below.
 *
 * Carries the full `body` for rendering — call this only where the documents are
 * actually shown (the /welcome consent gate), never on the hot every-nav path.
 */
export async function getCurrentDocuments(): Promise<DocumentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, kind, version, body, published_at")
    .order("published_at", { ascending: false })
    .returns<DocumentRow[]>();

  return latestPerKind(data ?? []);
}

export type ConsentState = {
  /** True only when the member has a consent row for every current document. */
  hasConsentedAll: boolean;
};

/**
 * Whether the signed-in member has agreed to every current document. This runs
 * on every /protected navigation (the layout consent guard), so it is kept lean
 * (perf-audit-v2 F3):
 *
 *  - the two round-trips — the current documents and the member's consents —
 *    run in PARALLEL rather than one-after-the-other; and
 *  - the documents read pulls only `id`/`kind`, never the heavy `body` column.
 *    Body is needed solely to *render* the gate (getCurrentDocuments), not to
 *    check completeness here.
 *
 * If a new document version is published, its new id won't be in the member's
 * consents, so this returns false and the gate re-appears — "re-confirm on
 * change" for free.
 */
export async function getConsentState(): Promise<ConsentState> {
  const supabase = await createClient();

  const [{ data: docs }, { data: consents }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, kind, published_at")
      .order("published_at", { ascending: false })
      .returns<Pick<DocumentRow, "id" | "kind" | "published_at">[]>(),
    supabase.from("consents").select("document_id"),
  ]);

  const currentDocs = latestPerKind(docs ?? []);
  const agreed = new Set((consents ?? []).map((row) => row.document_id));
  const hasConsentedAll =
    currentDocs.length > 0 && currentDocs.every((doc) => agreed.has(doc.id));

  return { hasConsentedAll };
}
