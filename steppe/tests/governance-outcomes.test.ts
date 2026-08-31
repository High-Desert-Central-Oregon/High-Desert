import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FOUNDATIONAL_NOTICE_DAYS,
  hasFoundationalNotice,
} from "@/lib/governance";

const migration = readFileSync(
  resolve(process.cwd(), "../migrations/0033_governance_outcomes.sql"),
  "utf8",
);

describe("governance outcome resolution (0033)", () => {
  it("requires the full foundational notice period at the friendly app boundary", () => {
    const created = Date.UTC(2026, 7, 29, 12);
    const day = 24 * 60 * 60 * 1000;

    expect(FOUNDATIONAL_NOTICE_DAYS).toBe(30);
    expect(hasFoundationalNotice(created + 30 * day - 1, created)).toBe(false);
    expect(hasFoundationalNotice(created + 30 * day, created)).toBe(true);
  });

  it("pins electorate, abstention, privacy-floor, thresholds, and notice in the database", () => {
    expect(migration).toContain("where verified and deleted_at is null");
    expect(migration).toContain("then yes_weight / (yes_weight + no_weight)");
    expect(migration).toContain("new.privacy_floor := 5");
    expect(migration).toContain(
      "when kind = 'minor' and approval_ratio > approval_fraction then 'passed'",
    );
    expect(migration).toContain(
      "when kind <> 'minor' and approval_ratio >= approval_fraction then 'passed'",
    );
    expect(migration).toContain("then 0.600");
    expect(migration).toContain("else 0.750");
    expect(migration).toContain("interval '30 days'");
    expect(migration).toContain("where public.is_verified()");
    expect(migration).toContain(
      "using (public.is_verified() or actor_id = auth.uid())",
    );
  });

  it("keeps the result view member-only and owner-rights", () => {
    expect(migration).toContain(
      "alter view public.proposal_results set (security_invoker = false)",
    );
    expect(migration).toContain(
      "revoke all on public.proposal_results from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant select on public.proposal_results to authenticated",
    );
  });
});
