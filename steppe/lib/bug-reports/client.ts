"use client";
import { DiagnosticBuffer, type EventName, type Environment } from "./shared";
export const diagnosticBuffer = new DiagnosticBuffer();
export function recordDiagnostic(name: EventName) {
  if (typeof window !== "undefined")
    diagnosticBuffer.record(name, window.location.pathname);
}
export function clearDiagnostics() {
  diagnosticBuffer.enable(false);
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("steppe:diagnostics-cleared"));
}
export function diagnosticEnvironment(
  locale: "en" | "es",
  release: string,
): Environment {
  const ua = navigator.userAgent;
  const match =
    ua.match(/(Edg)\/([\d.]+)/) ??
    ua.match(/(Firefox|Chrome|Version)\/([\d.]+)/);
  const browsers: Record<string, string> = {
    Edg: "Edge",
    Firefox: "Firefox",
    Chrome: "Chrome",
    Version: "Safari",
  };
  return {
    release,
    browser: match ? browsers[match[1]] : "unknown",
    version: match?.[2] ?? "unknown",
    os: /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/.test(ua) ||
          (/Mac/.test(ua) && navigator.maxTouchPoints > 1)
        ? "iOS"
        : /Mac/.test(ua)
          ? "macOS"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : "unknown",
    width: window.innerWidth,
    height: window.innerHeight,
    locale,
    mode: matchMedia("(display-mode: standalone)").matches
      ? "installed"
      : "browser",
    online: navigator.onLine,
  };
}
