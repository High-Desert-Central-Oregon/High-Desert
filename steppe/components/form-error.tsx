"use client";

import { useEffect, useRef } from "react";

/** Keep returned save errors visible and give keyboard users a way back to the draft. */
export function FormError({
  message,
  pending,
  id,
}: {
  message: string;
  pending: boolean;
  id?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (pending) return;
    ref.current?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ block: "center" });
  }, [message, pending]);

  return (
    <p
      id={id}
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="focus-ring text-sm text-destructive"
    >
      {message}
    </p>
  );
}
