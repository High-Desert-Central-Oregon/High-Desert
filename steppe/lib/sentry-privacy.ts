import type { ErrorEvent, Session, SessionAggregates } from "@sentry/core";

// Only compiled, public application assets can identify a code location. Never
// send the current route, URL parameters, member IDs, form values or error text.
function assetUrl(value?: string): string | undefined {
  if (!value) return undefined;
  const clean = value.split(/[?#]/, 1)[0];
  return /^(?:https?:\/\/[^/]+|app:\/\/)?\/_next\/static\/[a-zA-Z0-9_./%~-]+\.js$/.test(clean)
    ? clean : undefined;
}

export function sanitizeError(event: ErrorEvent): ErrorEvent | null {
  if (!event.exception?.values?.length) return null;
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: "javascript",
    level: event.level,
    release: event.release,
    environment: event.environment,
    sdk: event.sdk,
    exception: { values: event.exception.values.map((exception) => ({
      type: /^(?:Error|TypeError|RangeError|ReferenceError|SyntaxError|URIError|EvalError)$/.test(exception.type || "")
        ? exception.type : "Error",
      value: "Application error (message withheld)",
      mechanism: { type: "generic", handled: exception.mechanism?.handled !== false },
      stacktrace: { frames: (exception.stacktrace?.frames || []).flatMap((frame) => {
        const filename = assetUrl(frame.filename);
        return filename ? [{ filename, lineno: frame.lineno, colno: frame.colno, in_app: true }] : [];
      }) },
    })) },
    debug_meta: event.debug_meta ? { images: event.debug_meta.images?.flatMap((image) => {
      const code_file = assetUrl(image.code_file);
      return code_file && image.type === "sourcemap" ? [{ type: "sourcemap" as const, code_file, debug_id: image.debug_id }] : [];
    }) } : undefined,
  };
}

export function sanitizeSession(session: Session | SessionAggregates): void {
  if (!("sid" in session)) return;
  delete session.did;
  delete session.ipAddress;
  delete session.userAgent;
}
