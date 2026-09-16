"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  canManageOnboarding,
  deliverMemberNotices,
} from "@/lib/member-pipelines/server";
import { inviteEmail } from "@/lib/member-pipelines/shared";
import { UUID } from "@/lib/bug-reports/shared";
export async function changeInvitation(input: {
  action: "invite" | "resend" | "revoke";
  email?: string;
  locale?: string;
  interestId?: string;
  id?: string;
}) {
  if (!(await canManageOnboarding())) return { ok: false };
  const db = await createClient();
  let result;
  if (input.action === "invite") {
    const email = inviteEmail(input.email);
    if (!email || (input.interestId && !UUID.test(input.interestId)))
      return { ok: false };
    result = await db.rpc("create_individual_invitation", {
      p_email: email,
      p_locale: input.locale === "es" ? "es" : "en",
      p_interest: input.interestId ?? null,
    });
  } else if (
    (input.action === "resend" || input.action === "revoke") &&
    input.id &&
    UUID.test(input.id)
  ) {
    result = await db.rpc(
      input.action === "resend"
        ? "retry_individual_invitation"
        : "revoke_individual_invitation",
      { p_id: input.id },
    );
  } else return { ok: false };
  if (result.error) return { ok: false };
  after(async () => {
    try {
      await deliverMemberNotices();
    } catch {
      console.error("[member-pipelines] service email pending");
    }
  });
  revalidatePath("/protected/people");
  revalidatePath("/protected/work");
  return { ok: true };
}
