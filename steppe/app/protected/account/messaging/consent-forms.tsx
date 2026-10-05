"use client";
import { useActionState, useState } from "react";
import { DraftForm } from "@/components/draft-form";
import { FormError } from "@/components/form-error";
import type { Locale } from "@/lib/i18n";
import { consentCopy } from "@/lib/messages/consent-copy";
import { saveGroupContact, saveGroupRules, type ConsentState } from "./actions";
const button =
  "min-h-11 self-start border bg-primary px-4 py-2 font-semibold text-primary-foreground focus-ring disabled:opacity-60";
export function GroupRulesForm({
  groupId,
  rules,
  locale,
}: {
  groupId: string;
  rules: string | null;
  locale: Locale;
}) {
  const copy = consentCopy[locale];
  const [draft, setDraft] = useState(rules ?? "");
  const [saved, setSaved] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ConsentState, FormData>(
    async (previous, data) => {
      const result = await saveGroupRules(previous, data);
      if (result && "saved" in result)
        setSaved(String(data.get("rules") ?? ""));
      return result;
    },
    null,
  );
  return (
    <DraftForm action={action} className="flex flex-col gap-3">
      <input type="hidden" name="group_id" value={groupId} />
      <p className="text-sm text-muted-foreground">{copy.rulesIntro}</p>
      {state && "error" in state && (
        <FormError message={copy.failed} pending={pending} />
      )}
      <label htmlFor="group-message-rules" className="font-medium">
        {copy.rulesLabel}
      </label>
      <textarea
        id="group-message-rules"
        name="rules"
        rows={5}
        maxLength={2000}
        disabled={pending}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={copy.rulesPlaceholder}
        className="field-control focus-ring w-full border bg-card p-3 text-base"
      />
      <button type="submit" disabled={pending} className={button}>
        {pending ? copy.saving : copy.save}
      </button>
      {state && "saved" in state && saved === draft && (
        <p role="status" className="text-sm text-success">
          {copy.rulesSaved}
        </p>
      )}
    </DraftForm>
  );
}
export function GroupContactForm({
  groupId,
  rules,
  version,
  acknowledgedVersion,
  allow,
  locale,
}: {
  groupId: string;
  rules: string | null;
  version: number;
  acknowledgedVersion: number | null;
  allow: boolean;
  locale: Locale;
}) {
  const copy = consentCopy[locale];
  const [checked, setChecked] = useState(allow);
  const [ack, setAck] = useState(acknowledgedVersion === version && !!rules);
  const [saved, setSaved] = useState<{ allow: boolean; ack: boolean } | null>(
    null,
  );
  const [state, action, pending] = useActionState<ConsentState, FormData>(
    async (previous, data) => {
      const result = await saveGroupContact(previous, data);
      if (result && "saved" in result) {
        const value = data.get("disable") !== "1" && data.get("allow") === "on";
        setSaved({ allow: value, ack: data.get("acknowledge") === "on" });
        setChecked(value);
      }
      return result;
    },
    null,
  );
  const stale = !!acknowledgedVersion && acknowledgedVersion !== version;
  return (
    <DraftForm action={action} className="flex min-w-0 flex-col gap-3">
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="version" value={version} />
      {state && "error" in state && (
        <FormError message={copy.failed} pending={pending} />
      )}
      {rules ? (
        <>
          <p className="font-semibold">{copy.review}</p>
          <p className="whitespace-pre-wrap break-words text-sm">{rules}</p>
          <p className="text-sm text-muted-foreground">{copy.baseline}</p>
          {stale && <p className="text-sm font-medium">{copy.paused}</p>}
          <label className="flex items-start gap-3 text-sm">
            <input
              disabled={pending}
              name="acknowledge"
              type="checkbox"
              required
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="focus-ring mt-1 size-4 shrink-0 accent-primary"
            />
            <span>{copy.acknowledge}</span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              disabled={pending}
              name="allow"
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="focus-ring mt-1 size-4 shrink-0 accent-primary"
            />
            <span>{copy.allow}</span>
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={pending} className={button}>
              {pending ? copy.saving : copy.save}
            </button>
            {allow && (
              <button
                type="submit"
                name="disable"
                value="1"
                formNoValidate
                disabled={pending}
                className="min-h-11 border px-4 py-2 focus-ring"
              >
                {copy.disable}
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{copy.off}</p>
          {allow && (
            <button
              type="submit"
              name="disable"
              value="1"
              disabled={pending}
              className={button}
            >
              {copy.disable}
            </button>
          )}
        </>
      )}
      {state &&
        "saved" in state &&
        saved?.allow === checked &&
        saved.ack === ack && (
          <p role="status" className="text-sm text-success">
            {copy.saved}
          </p>
        )}
    </DraftForm>
  );
}
