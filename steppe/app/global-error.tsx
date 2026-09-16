"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error, { mechanism: { type: "react", handled: false } });
  }, [error]);
  return <html lang="en"><body style={{ fontFamily: "system-ui", padding: "2rem" }}>
    <h1>Something went wrong</h1>
    <p>Please try again. / <span lang="es">Por favor, inténtalo de nuevo.</span></p>
    <button onClick={reset}>Try again / <span lang="es">Intentar de nuevo</span></button>
  </body></html>;
}
