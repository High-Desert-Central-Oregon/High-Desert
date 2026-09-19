"use client";
/**
 * Steppe — submit a draft without clearing it on a returned action error.
 * Copyright (C) 2026 Steppe
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { startTransition, type ComponentProps } from "react";

type Props = Omit<ComponentProps<"form">, "action" | "onSubmit"> & {
  action: (data: FormData) => void | Promise<void>;
};

export function DraftForm({ action, ...props }: Props) {
  return (
    <form
      {...props}
      action={action}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        // Dispatch in a transition so useActionState retains pending/error
        // behavior, without the form action's automatic native reset. That
        // reset also clears controlled selects. Success navigates away or
        // leaves the saved settings visible. The action remains the no-JS path.
        startTransition(() => action(data));
      }}
    />
  );
}
