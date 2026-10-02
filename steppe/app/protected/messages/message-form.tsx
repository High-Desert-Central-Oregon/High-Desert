"use client";
/** Steppe — keep a message draft visible after an unconfirmed send.
 * Copyright (C) 2026 Steppe
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { useState, useTransition, type ReactNode } from "react";
import { FormError } from "@/components/form-error";
import {
  attemptMessageAction,
  type MessageActionState,
} from "@/lib/messages/action-result";

export function MessageForm({
  action,
  fallbackAction,
  children,
  className,
  buttonClassName,
  sendLabel,
  sendingLabel,
  errorMessage,
  iconOnly = false,
}: {
  action: (
    previous: MessageActionState,
    data: FormData,
  ) => Promise<MessageActionState>;
  fallbackAction: (data: FormData) => Promise<void>;
  children: ReactNode;
  className: string;
  buttonClassName: string;
  sendLabel: string;
  sendingLabel: string;
  errorMessage: string;
  iconOnly?: boolean;
}) {
  const [state, setState] = useState<MessageActionState>(null);
  const [pending, start] = useTransition();

  return (
    <form
      action={fallbackAction}
      className={className}
      aria-busy={pending}
      onSubmit={(event) => {
        // Keep native controls intact on an unconfirmed send. The server action
        // remains the plain HTML fallback when enhancement is unavailable.
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        start(async () => {
          setState(await attemptMessageAction(() => action(null, data)));
        });
      }}
    >
      {state?.error && (
        <div className="w-full">
          <FormError message={errorMessage} pending={pending} />
        </div>
      )}
      <fieldset disabled={pending} className="contents">
        {children}
        <button
          type="submit"
          aria-label={pending ? sendingLabel : sendLabel}
          className={buttonClassName}
        >
          {iconOnly ? (pending ? (
            <span aria-hidden="true">…</span>
          ) : (
              <svg
                width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                strokeLinejoin="round" aria-hidden="true"
              >
                <path d="M5 12h13M13 6l6 6-6 6" />
              </svg>
          )) : pending ? sendingLabel : sendLabel}
        </button>
      </fieldset>
    </form>
  );
}
