import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SupportThread = {
  thread_id: string;
  contact_id: string;
  counterpart_name: string | null;
};

// Participant-only metadata. No service client, support-operator queue, or
// general profile directory: the DB returns names only for my support threads.
export const getSupportThreads = cache(async (): Promise<SupportThread[]> => {
  const db = await createClient();
  const { data, error } = await db.rpc("my_support_threads");
  if (error && !["PGRST202", "42883"].includes(error.code))
    throw new Error("Message context unavailable");
  return error ? [] : (data ?? []) as SupportThread[];
});

export async function getSteppeContact(): Promise<{
  contact_name: string;
  thread_id: string | null;
  is_contact: boolean;
} | null> {
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("steppe_contact_status");
    // Missing migration or a failed read retains the email fallback.
    return error ? null : data?.[0] ?? null;
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}
