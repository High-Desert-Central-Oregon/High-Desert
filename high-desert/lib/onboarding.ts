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
 * The current published version of each member-facing document, newest first by
 * `published_at`, returned in reading order (terms, then privacy). "Current"
 * means latest version; when a document is re-published with a new version it
 * gets a new id, which is what makes re-consent fall out naturally below.
 */
export async function getCurrentDocuments(): Promise<DocumentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, kind, version, body, published_at")
    .order("published_at", { ascending: false })
    .returns<DocumentRow[]>();

  const latestByKind = new Map<DocKind, DocumentRow>();
  for (const doc of data ?? []) {
    if (!latestByKind.has(doc.kind)) latestByKind.set(doc.kind, doc);
  }

  return KIND_ORDER.map((kind) => latestByKind.get(kind)).filter(
    (doc): doc is DocumentRow => Boolean(doc),
  );
}

export type ConsentState = {
  currentDocs: DocumentRow[];
  /** True only when the member has a consent row for every current document. */
  hasConsentedAll: boolean;
};

/**
 * Whether the signed-in member has agreed to every current document. If a new
 * version is published, its new id won't be in the member's consents, so this
 * returns false and the gate re-appears — "re-confirm on change" for free.
 */
export async function getConsentState(): Promise<ConsentState> {
  const supabase = await createClient();
  const currentDocs = await getCurrentDocuments();

  const { data: consents } = await supabase
    .from("consents")
    .select("document_id");

  const agreed = new Set((consents ?? []).map((row) => row.document_id));
  const hasConsentedAll =
    currentDocs.length > 0 && currentDocs.every((doc) => agreed.has(doc.id));

  return { currentDocs, hasConsentedAll };
}
