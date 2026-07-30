"use client";

import { useState } from "react";
import { revokeInviteToken } from "./actions";
import { Button } from "@/components/ui/button";
import { t, type Dictionary } from "@/lib/i18n";

/**
 * One token in the list: what it is, how much of it is left, and the one
 * consequential action.
 *
 * REVOKING IS A READ-AND-CONFIRM (invariant 10). It is not reversible and it is
 * not retroactive, and the confirm step says both in plain words before the
 * button does anything. The alternative — a one-tap revoke with an undo — would
 * be a lie, because there is nothing to undo: `revoked_at` closes the door and
 * leaves every allowlist row a past redemption already wrote (ADR §5).
 *
 * The state line is derived, not stored: a token can be revoked, expired,
 * exhausted, or live, and those are computed from the three columns rather than
 * kept as a fourth that could disagree with them.
 */
export function TokenRow({
  dict,
  id,
  token,
  label,
  maxUses,
  usesCount,
  expiresAt,
  expiresLabel,
  revoked,
  neighborhood,
  origin,
}: {
  dict: Dictionary;
  id: string;
  token: string;
  label: string | null;
  maxUses: number;
  usesCount: number;
  expiresAt: string;
  /** Pre-formatted on the server, so the row does not ship a date library. */
  expiresLabel: string;
  revoked: boolean;
  neighborhood: string | null;
  origin: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isRevoked, setIsRevoked] = useState(revoked);

  const expired = new Date(expiresAt).getTime() <= Date.now();
  const exhausted = usesCount >= maxUses;
  const live = !isRevoked && !expired && !exhausted;
  const url = `${origin}/invite/${token}`;

  const state = isRevoked
    ? dict.invites.stateRevoked
    : expired
      ? dict.invites.stateExpired
      : exhausted
        ? dict.invites.stateExhausted
        : dict.invites.stateLive;

  const handleRevoke = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await revokeInviteToken(id);
      if (result.ok) {
        setIsRevoked(true);
        setConfirming(false);
      } else {
        setError(dict.invites.revokeFailed);
      }
    } catch {
      setError(dict.invites.revokeFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">
          {label || dict.invites.unlabeled}
        </span>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {state}
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        {t(dict.invites.rowUses, { used: usesCount, cap: maxUses })}
        {" · "}
        {t(dict.invites.rowExpires, { date: expiresLabel })}
        {neighborhood ? ` · ${neighborhood}` : ` · ${dict.invites.generalPurpose}`}
      </p>

      <code className="overflow-x-auto rounded bg-muted px-2 py-1 font-mono text-xs">
        {url}
      </code>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          {copied ? dict.invites.copied : dict.invites.copyUrl}
        </Button>

        {live && !confirming && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(true)}
          >
            {dict.invites.revoke}
          </Button>
        )}
      </div>

      {confirming && (
        <div className="flex flex-col gap-2 rounded border border-destructive/40 p-3">
          {/* Says what revoking does AND what it does not do, before the button
              is available. The second half is the part a moderator would
              otherwise assume wrongly. */}
          <p className="text-sm">{dict.invites.revokeConfirm}</p>
          <p className="text-xs text-muted-foreground">
            {dict.invites.revokeNotRetroactive}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRevoke}
              disabled={busy}
            >
              {busy ? dict.invites.revoking : dict.invites.revokeConfirmButton}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(false)}
              disabled={busy}
            >
              {dict.invites.cancel}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-700 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
