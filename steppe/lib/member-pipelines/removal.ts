import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pipelinesEnabled } from "./server";

export async function canRemoveAccounts() {
  if (!pipelinesEnabled()) return false;
  const db = await createClient();
  const { data, error } = await db.rpc("can_remove_accounts");
  return !error && data === true;
}

export type RemovalJob = {
  id: string;
  target_id: string;
  pending_email: string | null;
  completed_at: string | null;
};

/** Call only after reading the job through the administrator's session/RLS.
 * Every step is retryable. Never use the default (hard) Auth deletion mode.
 * A bounded batch keeps large cleanups below a server-action timeout.
 */
export async function completeAccountRemoval(job: RemovalJob) {
  if (job.completed_at) return true;
  const db = createAdminClient();
  for (let batch = 0; batch < 5; batch++) {
    const { data: objects, error } = await db.rpc("account_removal_evidence", {
      p_id: job.id,
    });
    if (error || !Array.isArray(objects)) return false;
    if (objects.length === 0) {
      // Supabase's soft deletion clears identities, metadata and sessions while
      // retaining the UUID row required by ballots and other permanent records.
      const { data, error: readError } = await db.auth.admin.getUserById(
        job.target_id,
      );
      if (readError || !data.user) return false;
      const removed = data.user as typeof data.user & { deleted_at?: string };
      if (!removed.deleted_at) {
        const { error: authError } = await db.auth.admin.deleteUser(
          job.target_id,
          true,
        );
        if (authError) return false;
      }
      const { error: finishError } = await db.rpc("finish_account_removal", {
        p_id: job.id,
      });
      return !finishError;
    }
    const paths = objects.map((object: { name: string }) => object.name);
    if (paths.some((path) => !path.startsWith(`${job.target_id}/`)))
      return false;
    const { error: storageError } = await db.storage
      .from("verification-evidence")
      .remove(paths);
    if (storageError) return false;
  }
  return false;
}
