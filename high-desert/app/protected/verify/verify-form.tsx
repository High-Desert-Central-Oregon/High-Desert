"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { submitVerification } from "./actions";
import {
  ALL_METHODS,
  ALLOWED_EVIDENCE_TYPES,
  EVIDENCE_BUCKET,
  MAX_EVIDENCE_BYTES,
  evidenceExtension,
  isAllowedEvidenceType,
  isDocumentMethod,
  type VerificationMethod,
} from "@/lib/verification";
import type { Dictionary } from "@/lib/i18n";

/**
 * Member-facing verification form. Lets a member pick one method and submit it
 * for human review. For document methods the file is uploaded straight from the
 * browser into the member's own `<uid>/…` folder in the private evidence bucket
 * (the storage own-folder policy is the gate); then a server action records the
 * pending request. The postcard path uploads nothing and just files the request.
 *
 * `uid` is passed only to name the upload path; the storage policy — not this
 * value — is what actually restricts where a member can write.
 */
export function VerifyForm({
  dict,
  uid,
}: {
  dict: Dictionary;
  uid: string;
}) {
  const [method, setMethod] = useState<VerificationMethod | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const needsFile = method !== null && isDocumentMethod(method);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!method) return;

    startTransition(async () => {
      let evidencePath: string | null = null;

      if (isDocumentMethod(method)) {
        if (!file) {
          setError(dict.verify.fileRequired);
          return;
        }
        if (file.size > MAX_EVIDENCE_BYTES) {
          setError(dict.verify.tooLarge);
          return;
        }
        if (!isAllowedEvidenceType(file.type)) {
          setError(dict.verify.badType);
          return;
        }

        const supabase = createClient();
        evidencePath = `${uid}/${crypto.randomUUID()}.${evidenceExtension(file.type)}`;
        const { error: uploadError } = await supabase.storage
          .from(EVIDENCE_BUCKET)
          .upload(evidencePath, file, {
            contentType: file.type,
            upsert: false,
          });
        if (uploadError) {
          setError(dict.verify.errorGeneric);
          return;
        }
      }

      const result = await submitVerification(method, evidencePath);
      // On success the action redirects; only an error comes back here.
      if (result?.error) setError(dict.verify.errorGeneric);
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">
          {dict.verify.methodLegend}
        </legend>

        {ALL_METHODS.map((m) => {
          const selected = method === m;
          return (
            <label
              key={m}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
                selected ? "border-foreground bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <input
                type="radio"
                name="method"
                value={m}
                checked={selected}
                onChange={() => setMethod(m)}
                required
                aria-describedby={`hint-${m}`}
                className="mt-1 size-4 shrink-0 accent-foreground"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  {dict.verify.methods[m]}
                </span>
                <span id={`hint-${m}`} className="text-xs text-muted-foreground">
                  {dict.verify.methodHints[m]}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {needsFile && (
        <div className="flex flex-col gap-2">
          <label htmlFor="evidence" className="text-sm font-medium">
            {dict.verify.fileLabel}
          </label>
          <input
            id="evidence"
            type="file"
            accept={ALLOWED_EVIDENCE_TYPES.join(",")}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            aria-describedby="file-hint"
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm"
          />
          <p id="file-hint" className="text-xs text-muted-foreground">
            {dict.verify.fileHint}
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        className="w-full sm:w-auto sm:self-start"
        disabled={isPending || method === null}
      >
        {isPending
          ? dict.verify.submitting
          : method === "postcard_code"
            ? dict.verify.postcardSubmit
            : dict.verify.submit}
      </Button>
    </form>
  );
}
