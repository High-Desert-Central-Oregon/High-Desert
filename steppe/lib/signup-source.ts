// Allowlist for interest_signups.source (migration 0031). Printed collateral
// carries a QR code with ?r=<code>: bc = business card, pc = postcard,
// bm = bookmark. 'direct' is not a printed code — it is the value the server
// stores when no ?r= is present or the value isn't recognized (route.ts
// coerces; this file is shared by the client for the same allowlist so the
// two never drift).
export const SIGNUP_SOURCE_CODES = ["bc", "pc", "bm"] as const;

export type SignupSourceCode = (typeof SIGNUP_SOURCE_CODES)[number];

const SIGNUP_SOURCE_SET = new Set<string>(SIGNUP_SOURCE_CODES);

export function isSignupSourceCode(value: string | null): value is SignupSourceCode {
  return value != null && SIGNUP_SOURCE_SET.has(value);
}
