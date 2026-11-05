import { createAdminClient } from "@/lib/supabase/admin";

/** Bounded Storage API deletion; the database retains unacknowledged work. */
export async function cleanupOrphanEvidence(): Promise<boolean> {
  const db = createAdminClient();
  const { data, error } = await db.rpc("claim_orphan_evidence_cleanup");
  if (error || !Array.isArray(data)) return false;
  let ok = true;
  for (const row of data as { path: string; claim: string }[]) {
    let removed = false;
    try {
      const { error: storageError } = await db.storage
        .from("verification-evidence")
        .remove([row.path]);
      removed = !storageError;
    } catch {
      /* Retain the leased job and report failure without document data. */
    }
    const { error: finishError } = await db.rpc(
      "finish_orphan_evidence_cleanup",
      {
        p_path: row.path,
        p_claim: row.claim,
        p_success: removed,
      },
    );
    if (!removed || finishError) ok = false;
  }
  const remaining = await db.rpc("orphan_evidence_cleanup_pending");
  return ok && !remaining.error && remaining.data === false;
}
