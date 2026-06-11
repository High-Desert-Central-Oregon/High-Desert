"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t, type Dictionary } from "@/lib/i18n";
import { deleteMyAccount } from "./actions";

/**
 * Deleting an account is the most consequential, irreversible thing a member can
 * do, so it is deliberately effortful (Pattern 22 / invariant 10): the action is
 * gated behind a typed confirmation, and the button is destructive-styled and
 * disabled until the member types the confirmation word. The real guarantees are
 * server-side (the self-pinned RPC + the admin scrub in the action); this is the
 * human pause in front of them. On success the action redirects away.
 */
export function DeleteAccount({ dict }: { dict: Dictionary }) {
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const word = dict.account.deleteConfirmWord;
  const armed = confirm.trim().toLowerCase() === word.toLowerCase();

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-destructive/40 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{dict.account.deleteHeading}</h2>
        <p className="text-sm text-muted-foreground">{dict.account.deleteBody}</p>
      </div>

      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
        <li>{dict.account.deleteKept}</li>
        <li>{dict.account.deleteErased}</li>
        <li>{dict.account.deleteIrreversible}</li>
      </ul>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm-delete">
          {t(dict.account.deleteConfirmLabel, { word })}
        </Label>
        <Input
          id="confirm-delete"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          className="max-w-xs"
          aria-describedby={error ? "delete-error" : undefined}
        />
      </div>

      {error && (
        <p
          id="delete-error"
          role="alert"
          className="text-sm text-red-700 dark:text-red-400"
        >
          {error}
        </p>
      )}

      <Button
        type="button"
        variant="destructive"
        disabled={!armed || pending}
        className="self-start"
        onClick={() => {
          setError(null);
          start(async () => {
            // Success redirects server-side; reaching here means it failed.
            const result = await deleteMyAccount();
            if (result?.error) setError(dict.account.deleteError);
          });
        }}
      >
        {pending ? dict.account.deleting : dict.account.deleteButton}
      </Button>
    </section>
  );
}
