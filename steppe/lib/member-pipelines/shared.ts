export function inviteEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? email
    : null;
}
export function safeReturnPath(value: unknown, fallback = "/protected") {
  if (
    typeof value !== "string" ||
    !/^\/protected(?:\/|$)/.test(value) ||
    /[\\\r\n]/.test(value)
  )
    return fallback;
  try {
    const url = new URL(value, "https://steppe.invalid");
    return url.origin === "https://steppe.invalid" &&
      /^\/protected(?:\/|$)/.test(url.pathname)
      ? url.pathname + url.search
      : fallback;
  } catch {
    return fallback;
  }
}
export type Provider = "google" | "apple";
export function isProvider(value: unknown): value is Provider {
  return value === "google" || value === "apple";
}

/** Only board filters may travel in a return link; never accept an arbitrary redirect. */
export function exchangeReturnPath(value: unknown) {
  if (typeof value !== "string") return "/protected/exchange";
  try {
    const url = new URL(value, "https://steppe.invalid");
    if (
      url.origin !== "https://steppe.invalid" ||
      url.pathname !== "/protected/exchange"
    )
      return "/protected/exchange";
    const params = new URLSearchParams();
    for (const key of ["f", "s", "q"]) {
      const value = url.searchParams.get(key);
      if (value) params.set(key, value.slice(0, 200));
    }
    return url.pathname + (params.size ? `?${params}` : "");
  } catch {
    return "/protected/exchange";
  }
}
