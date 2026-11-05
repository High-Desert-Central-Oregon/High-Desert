import { createHmac } from "node:crypto";
import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/rate-limit";
import { durableOrigin } from "@/lib/site-url";
import { sendInterestConfirmation } from "@/lib/interest-email";

type Enrollment = {
  email: string;
  purpose: "interest" | "pledge";
  slug: string;
  payload: Record<string, unknown>;
  locale: string;
};
/** Durable, cross-instance budgets. No enrollment lookup or mail in the response. */
export async function queuePublicEnrollment(
  request: Request,
  input: Enrollment,
): Promise<"queued" | "limited" | "error" | "unknown"> {
  try {
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) return "error";
    const caller = createHmac("sha256", secret)
      .update(`public-enrollment:${clientIp(request)}`)
      .digest("hex");
    const { data, error } = await createAdminClient().rpc(
      "queue_public_enrollment",
      {
        p_email: input.email,
        p_purpose: input.purpose,
        p_slug: input.slug,
        p_payload: input.payload,
        p_locale: input.locale === "es" ? "es" : "en",
        p_caller: caller,
      },
    );
    if (error) return error.code === "P0002" ? "unknown" : "error";
    return data === true ? "queued" : "limited";
  } catch {
    return "error";
  }
}

/** Dedicated bounded public-mail lane; essential member mail has separate work. */
export async function deliverPublicEnrollment(): Promise<boolean> {
  const db = createAdminClient();
  for (let i = 0; i < 5; i++) {
    const claimed = await db.rpc("claim_public_enrollment_mail");
    if (claimed.error || !Array.isArray(claimed.data)) return false;
    const row = claimed.data[0] as
      | {
          id: string;
          email: string;
          purpose: string;
          slug: string;
          locale: string;
          token: string;
          claim: string;
        }
      | undefined;
    if (!row) break;
    let sent = false;
    try {
      const t = await getTranslations({
        locale: row.locale,
        namespace: "enrollment",
      });
      const url = `${durableOrigin()}/enrollment/confirm?token=${encodeURIComponent(row.token)}`;
      const result = await sendInterestConfirmation({
        to: row.email,
        subject: t("subject"),
        heading: t("heading"),
        paragraphs: [
          t(row.purpose === "pledge" ? "pledgeBody" : "interestBody"),
          t("ignore"),
        ],
        action: { url, label: t("button") },
        idempotencyKey: `public-enrollment/${row.id}`,
      });
      sent = result.ok;
    } catch {
      /* No email addresses, tokens, or provider payloads in logs. */
    }
    const finished = await db.rpc("finish_public_enrollment_mail", {
      p_id: row.id,
      p_claim: row.claim,
      p_success: sent,
    });
    if (!sent || finished.error) return false;
  }
  const health = await db.rpc("public_enrollment_healthy");
  return !health.error && health.data === true;
}
