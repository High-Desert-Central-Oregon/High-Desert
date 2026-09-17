import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { durableOrigin } from "@/lib/site-url";
import { formatRedmondDateTime } from "@/lib/time";
import type { Provider } from "./shared";
export const pipelinesEnabled = () =>
  process.env.MEMBER_PIPELINES_ENABLED === "true";
export const providerEnabled = (provider: Provider) =>
  pipelinesEnabled() &&
  process.env[`AUTH_${provider.toUpperCase()}_ENABLED`] === "true";
export async function canManageOnboarding() {
  if (!pipelinesEnabled()) return false;
  const db = await createClient();
  const { data, error } = await db.rpc("can_manage_onboarding");
  return !error && data === true;
}
export async function deliverMemberNotices() {
  const db = createAdminClient();
  const { data, error } = await db.rpc("claim_member_notices");
  if (error) throw new Error("service email queue unavailable");
  for (const row of (data ?? []) as {
    id: string;
    claim: string;
    kind: string;
    recipient_email: string | null;
    locale: string;
    reference_id: string;
    expires_at: string | null;
  }[]) {
    let sent = false;
    try {
      const reviewer =
        row.kind === "verification_received" ||
        row.kind === "verification_reply";
      const to = reviewer
        ? (process.env.MEMBER_REVIEW_NOTIFY_TO ??
          process.env.BUG_REPORT_NOTIFY_TO)
        : row.recipient_email;
      if (to && process.env.RESEND_API_KEY) {
        const { Resend } = await import("resend");
        const invitation = row.kind === "invitation";
        const es = row.locale === "es";
        if (invitation && !row.expires_at)
          throw new Error("Invitation expiry missing");
        const expiry = row.expires_at
          ? formatRedmondDateTime(row.expires_at, row.locale)
          : "";
        const path = invitation
          ? "/auth/login"
          : reviewer
            ? `/protected/review/${row.reference_id}`
            : "/protected/verify";
        const result = await new Resend(process.env.RESEND_API_KEY).emails.send(
          {
            from: process.env.CONTACT_FROM ?? "Steppe <hello@steppe.community>",
            to,
            subject: invitation
              ? es
                ? "Tu invitación a Steppe"
                : "Your invitation to Steppe"
              : es
                ? "Actualización de verificación en Steppe"
                : "Steppe verification update",
            text: invitation
              ? es
                ? `Estás invitado a la beta de Steppe. Inicia sesión con esta dirección de correo antes de ${expiry}. Después completarás la verificación de residencia.\n\n${durableOrigin()}${path}`
                : `You're invited to the Steppe beta. Sign in with this email address before ${expiry}. You'll then complete the normal residency verification.\n\n${durableOrigin()}${path}`
              : es
                ? `Hay una actualización de verificación. Inicia sesión para verla.\n\n${durableOrigin()}${path}`
                : `There is a verification update. Sign in to view it.\n\n${durableOrigin()}${path}`,
          },
          { idempotencyKey: `steppe-member-notice-${row.id}` },
        );
        sent = !result.error;
      }
    } catch {
      /* Retry from durable queue; never log recipient or case content. */
    }
    const result = await db.rpc("finish_member_notice", {
      p_id: row.id,
      p_claim: row.claim,
      p_sent: sent,
    });
    if (result.error) throw new Error("service email acknowledgement failed");
  }
}
