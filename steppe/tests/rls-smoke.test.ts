import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// RLS smoke test — proves the database refuses what the invariants forbid, from an
// ANONYMOUS client (the anon/publishable key, RLS-gated). It only attempts
// operations that must be denied and asserts the denial, so it is safe to run
// against local OR prod: a denied write creates nothing, a denied read leaks
// nothing. If it ever passes an op that should fail, the test fails — which is the
// point. Requires NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
// (loaded from .env.local by tests/setup.ts); skips cleanly when they're absent.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const enabled = Boolean(url && anonKey);

describe.skipIf(!enabled)("RLS smoke — deny-by-default (anonymous client)", () => {
  // Built in beforeAll (not at describe-body top level) so a SKIPPED suite never calls
  // createClient — which throws on an empty/absent URL and would fail collection in CI.
  let supa: SupabaseClient;
  beforeAll(() => {
    supa = createClient(url as string, anonKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  it("anon cannot READ interest_signups — the interest list never leaks", async () => {
    const { data, error } = await supa.from("interest_signups").select("*").limit(5);
    // Deny-by-default returns an empty set to anon (never the rows themselves).
    expect(error ? true : (data ?? []).length === 0).toBe(true);
  });

  it("anon cannot WRITE interest_signups — only the service-role route writes it", async () => {
    const { error } = await supa
      .from("interest_signups")
      .insert({ email: "rls-probe@example.com", consent: true });
    // No INSERT policy for anon → row-level-security violation.
    expect(error).toBeTruthy();
  });

  it("anon cannot READ votes — ballots are secret (no read policy exists)", async () => {
    const { data, error } = await supa.from("votes").select("*").limit(5);
    expect(error ? true : (data ?? []).length === 0).toBe(true);
  });
});
