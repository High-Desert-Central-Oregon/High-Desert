import { describe, expect, it } from "vitest";
import {
  fragmentIssue,
  providerIssue,
} from "@/lib/member-pipelines/auth-issue";

describe("provider error presentation", () => {
  it("recognizes Supabase's fragment conflict without exposing its description", () => {
    expect(
      fragmentIssue(
        "#error=server_error&error_code=identity_already_exists&error_description=private-detail",
      ),
    ).toBe("identity-linked");
  });
  it.each([
    "#error=access_denied",
    "#error_code=unknown",
    "#error_description=identity_already_exists",
  ])("uses generic copy for other errors: %s", (hash) => {
    expect(fragmentIssue(hash)).toBe("provider");
  });
  it.each(["", "#section", "#access_token=fixture&refresh_token=fixture"])(
    "ignores non-error fragments: %s",
    (hash) => {
      expect(fragmentIssue(hash)).toBeNull();
    },
  );
  it.each([
    undefined,
    "identity_already_exists<script>",
    "https://elsewhere.example",
  ])("allowlists the exact code only: %s", (code) => {
    expect(providerIssue(code)).toBe("provider");
  });
});
