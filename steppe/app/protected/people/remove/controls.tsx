"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rc, type RemovalCopyKey } from "@/lib/member-pipelines/removal-copy";
import {
  previewRemoval,
  removeAccount,
  retryRemoval,
  type RemovalPreview,
} from "./actions";

export function RemovalControls({ locale }: { locale: string }) {
  const [email, setEmail] = useState("");
  const [person, setPerson] = useState<RemovalPreview>();
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [message, setMessage] = useState<RemovalCopyKey>();
  const [busy, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setPerson(undefined);
          setConfirmation("");
          setReason("");
          setAcknowledged(false);
          setMessage(undefined);
          start(async () => {
            try {
              const result = await previewRemoval(email);
              if (!result.ok) setMessage("failed");
              else if (!result.person) setMessage("missing");
              else {
                setPerson(result.person);
                if (result.person.removal_id) setMessage("pending");
              }
            } catch {
              setMessage("failed");
            }
          });
        }}
      >
        <label className="flex flex-col gap-2">
          {rc(locale, "email")}
          <Input
            type="email"
            required
            maxLength={320}
            autoComplete="off"
            value={email}
            disabled={busy}
            onChange={(event) => {
              setEmail(event.target.value);
              setPerson(undefined);
              setMessage(undefined);
            }}
          />
        </label>
        <Button disabled={busy}>{rc(locale, busy ? "busy" : "find")}</Button>
      </form>
      {person && !person.removal_id && (
        <section className="flex flex-col gap-4 rounded-lg border border-destructive/40 p-4">
          <h2 className="break-words font-semibold">
            {person.display_name} · {person.email}
          </h2>
          <p>{rc(locale, person.verified ? "verified" : "unverified")}</p>
          {!person.eligible ? (
            <p>{rc(locale, "protected")}</p>
          ) : (
            <>
              <p>{rc(locale, "erased")}</p>
              <p>{rc(locale, "kept")}</p>
              <form
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  setMessage(undefined);
                  start(async () => {
                    try {
                      const result = await removeAccount({
                        target: person.target_id,
                        confirmation,
                        reason,
                        acknowledged,
                      });
                      setMessage(result.state);
                      if (result.state !== "failed") setPerson(undefined);
                    } catch {
                      setMessage("failed");
                    }
                    router.refresh();
                  });
                }}
              >
                <label className="flex flex-col gap-2">
                  {rc(locale, "reason")}
                  <select
                    required
                    value={reason}
                    disabled={busy}
                    onChange={(event) => setReason(event.target.value)}
                    className="min-h-11 rounded border bg-background p-2"
                  >
                    <option value="">{rc(locale, "choose")}</option>
                    <option value="member_request">
                      {rc(locale, "member_request")}
                    </option>
                    <option value="test_reset">
                      {rc(locale, "test_reset")}
                    </option>
                  </select>
                </label>
                <label className="flex flex-col gap-2">
                  {rc(locale, "confirmation")}
                  <Input
                    type="email"
                    required
                    autoComplete="off"
                    spellCheck={false}
                    value={confirmation}
                    disabled={busy}
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                </label>
                <label className="flex items-start gap-3 py-2">
                  <input
                    type="checkbox"
                    required
                    checked={acknowledged}
                    disabled={busy}
                    onChange={(event) => setAcknowledged(event.target.checked)}
                    className="mt-1 size-5 shrink-0"
                  />
                  {rc(locale, "acknowledge")}
                </label>
                <Button
                  variant="destructive"
                  className="min-h-11 self-start whitespace-normal"
                  disabled={
                    busy ||
                    !acknowledged ||
                    !reason ||
                    confirmation.trim().toLowerCase() !==
                      person.email.toLowerCase()
                  }
                >
                  {rc(locale, busy ? "busy" : "remove")}
                </Button>
              </form>
            </>
          )}
        </section>
      )}
      {message && <p role="status">{rc(locale, message)}</p>}
      {message === "complete" && (
        <Link href="/protected/people" className="underline">
          {rc(locale, "invite")}
        </Link>
      )}
    </div>
  );
}

export function RetryRemoval({ id, locale }: { id: string; locale: string }) {
  const [busy, start] = useTransition();
  const [message, setMessage] = useState<RemovalCopyKey>();
  const router = useRouter();
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="outline"
        disabled={busy}
        onClick={() =>
          start(async () => {
            try {
              setMessage((await retryRemoval(id)).state);
            } catch {
              setMessage("failed");
            }
            router.refresh();
          })
        }
      >
        {rc(locale, busy ? "busy" : "retry")}
      </Button>
      {message && <p role="status">{rc(locale, message)}</p>}
    </div>
  );
}
