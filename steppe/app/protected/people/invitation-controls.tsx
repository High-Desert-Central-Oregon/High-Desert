"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pc } from "@/lib/member-pipelines/copy";
import { changeInvitation } from "./actions";
export function InvitationControls({
  locale,
  email: initialEmail = "",
  interestId,
  invitationId,
  active = false,
  canInvite = true,
}: {
  locale: string;
  email?: string;
  interestId?: string;
  invitationId?: string;
  active?: boolean;
  canInvite?: boolean;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [language, setLanguage] = useState(locale === "es" ? "es" : "en");
  const [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  const router = useRouter();
  const act = (action: "invite" | "resend" | "revoke") => {
    if (action === "revoke" && !window.confirm(pc(locale, "confirmRevoke")))
      return;
    start(async () => {
      setMessage("");
      try {
        const result = await changeInvitation({
          action,
          email,
          locale: language,
          interestId,
          id: invitationId,
        });
        setMessage(
          pc(
            locale,
            result.ok
              ? action === "revoke"
                ? "revoked"
                : "queued"
              : "inviteFailed",
          ),
        );
        if (result.ok) router.refresh();
      } catch {
        setMessage(pc(locale, "inviteFailed"));
      }
    });
  };
  return (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          act("invite");
        }}
        className="flex flex-wrap items-end gap-3"
      >
        {!initialEmail && (
          <label className="flex flex-col gap-1">
            {pc(locale, "email")}
            <input
              required
              type="email"
              maxLength={320}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-11 rounded border bg-background p-2"
            />
          </label>
        )}
        {!active && canInvite && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              {pc(locale, "language")}
              <select
                className="min-h-11 border bg-background p-2"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </label>
            <button
              disabled={busy}
              className="min-h-11 rounded border px-3 font-semibold"
            >
              {pc(
                locale,
                busy ? "sending" : initialEmail ? "invitePerson" : "send",
              )}
            </button>
          </>
        )}
        {active && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => act("resend")}
              className="min-h-11 rounded border px-3"
            >
              {pc(locale, "resend")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act("revoke")}
              className="min-h-11 rounded border px-3"
            >
              {pc(locale, "revoke")}
            </button>
          </>
        )}
      </form>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
