/**
 * Steppe — read-only retry for a failed collection load.
 * Copyright (C) 2026 Steppe
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Dictionary } from "@/lib/i18n";

export function LoadFailure({
  href,
  dict,
}: {
  href: string;
  dict: Dictionary;
}) {
  return (
    <div className="flex flex-col items-start gap-3 border p-4">
      <p role="alert">{dict.common.loadFailed}</p>
      {/* A document GET retries the read even when the current route is cached. */}
      <a
        href={href}
        className="focus-ring inline-flex min-h-11 items-center underline"
      >
        {dict.common.retry}
      </a>
    </div>
  );
}
