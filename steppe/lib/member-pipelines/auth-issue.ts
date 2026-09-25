// Provider error details are untrusted. Only this code selects specific UI copy;
// never display provider descriptions or use them to change an account/session.
export function providerIssue(code: unknown): "identity-linked" | "provider" {
  return code === "identity_already_exists" ? "identity-linked" : "provider";
}

export function fragmentIssue(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (
    !params.has("error") &&
    !params.has("error_code") &&
    !params.has("error_description")
  )
    return null;
  return providerIssue(params.get("error_code"));
}
