import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  createClient as createSupaClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

// Write-path guard for setNeighborhood (the f18c38c read-back verification,
// mirrored from setFieldVisibility). Parity sibling of set-field-visibility.test.
//
// This runs the REAL action against a REAL local Postgres with RLS ON — the
// supabase client, PostgREST, RLS, and `.select("neighborhood_id").single()` are
// all real. A mocked supabase client would let this pass vacuously even if the
// read-back verification were deleted; the whole point is to reproduce the
// faithful prod condition (a 0-row UPDATE under pf_update → PGRST116) and assert
// the action refuses to report success. Run against the pre-read-back
// setNeighborhood, the NON-PERSIST case fails (it returned { saved: true }).
//
// SAFETY: the persist case WRITES a row, so this suite must only ever touch a
// LOCAL Supabase — never prod (constitution: test writes never run against prod).
// It is hard-gated to a localhost/127.0.0.1 URL and skips otherwise (incl. CI,
// which has no .env.local). It uses the seeded dry-run users and restores the
// one row it changes.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const isLocal = !!url && /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url);
const enabled = Boolean(url && anonKey && isLocal);

// seed/dry-run-accounts.sql — password is the same for every persona.
const BEN = { id: "00000000-0000-0000-0000-0000000000b2", email: "ben@dryrun.test" };
const AIDA_ID = "00000000-0000-0000-0000-0000000000a1";
const PW = "dryrun-password";

function form(neighborhoodId: string): FormData {
  const fd = new FormData();
  fd.set("neighborhood_id", neighborhoodId);
  return fd;
}

describe.skipIf(!enabled)(
  "setNeighborhood — write-verify against local Postgres (RLS on)",
  () => {
    // A real client authenticated as Ben → auth.uid() = Ben for every request.
    let ben: SupabaseClient;
    let benOriginal: string | null;
    let targetId: string;

    beforeAll(async () => {
      ben = createSupaClient(url as string, anonKey as string, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await ben.auth.signInWithPassword({
        email: BEN.email,
        password: PW,
      });
      if (error) {
        throw new Error(
          `local sign-in failed (is the dry-run seed loaded?): ${error.message}`,
        );
      }
      const { data: prof } = await ben
        .from("profiles")
        .select("neighborhood_id")
        .eq("id", BEN.id)
        .single();
      benOriginal = (prof as { neighborhood_id: string | null }).neighborhood_id;

      // A real seeded neighborhood id that ISN'T Ben's current one, so the persist
      // case is a genuine change rather than a no-op write.
      const { data: hoods } = await ben
        .from("neighborhoods")
        .select("id")
        .order("name", { ascending: true })
        .limit(5);
      const ids = ((hoods as { id: string }[] | null) ?? []).map((r) => r.id);
      const picked = ids.find((id) => id !== benOriginal);
      if (!picked) {
        throw new Error("no seeded neighborhoods found for the persist case");
      }
      targetId = picked;

      // Mock ONLY the construction seams — never the client's behavior:
      //  · server createClient() returns the REAL authenticated Ben client,
      //  · next/cache revalidatePath() is a no-op outside a Next request,
      //  · next/navigation redirect() is a no-op (imported by actions.ts).
      // getCurrentUser() is mocked per-case below to pick the acting id;
      // isModerator is stubbed because actions.ts imports it (setNeighborhood
      // itself never calls it).
      vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => ben }));
      vi.doMock("next/cache", () => ({ revalidatePath: () => {} }));
      vi.doMock("next/navigation", () => ({ redirect: () => {} }));
    });

    afterAll(async () => {
      if (ben) {
        // restore the one row the persist case changed, then drop the session
        await ben
          .from("profiles")
          .update({ neighborhood_id: benOriginal })
          .eq("id", BEN.id);
        await ben.auth.signOut();
      }
      vi.doUnmock("@/lib/supabase/server");
      vi.doUnmock("next/cache");
      vi.doUnmock("next/navigation");
      vi.resetModules();
    });

    it("NON-PERSIST: a 0-row UPDATE under RLS returns { error: 'not-persisted' }, never { saved: true }", async () => {
      // Authenticated as Ben, but the action acts for AIDA → it runs
      // UPDATE profiles ... WHERE id = aida; pf_update USING (id = auth.uid() = ben)
      // matches 0 rows → .select().single() → PGRST116 → not-persisted. This is the
      // exact prod false-positive condition (auth.uid() != the target row).
      vi.doMock("@/lib/auth", () => ({
        getCurrentUser: async () => ({ id: AIDA_ID, email: null }),
        isModerator: async () => false,
      }));
      vi.resetModules();
      const { setNeighborhood } = await import(
        "@/app/protected/neighborhoods/actions"
      );

      const res = await setNeighborhood(null, form(targetId));

      expect(res).toEqual({ error: "not-persisted" });
      expect(res).not.toHaveProperty("saved");

      // and Aida's row was not touched (the write matched nothing)
      const { data } = await ben
        .from("profiles")
        .select("neighborhood_id")
        .eq("id", AIDA_ID)
        .maybeSingle();
      // Ben can't read Aida's base row (pf_read owner-only), so this is null —
      // which also proves the write couldn't have reached her row.
      expect(data).toBeNull();
    });

    it("PERSIST: an owner updating their own row returns { saved: true, cleared: false } and the stored value equals the request", async () => {
      vi.doMock("@/lib/auth", () => ({
        getCurrentUser: async () => ({ id: BEN.id, email: BEN.email }),
        isModerator: async () => false,
      }));
      vi.resetModules();
      const { setNeighborhood } = await import(
        "@/app/protected/neighborhoods/actions"
      );

      const res = await setNeighborhood(null, form(targetId));

      expect(res).toEqual({ saved: true, cleared: false });

      // read-back confirms the persisted value equals what we asked for
      const { data } = await ben
        .from("profiles")
        .select("neighborhood_id")
        .eq("id", BEN.id)
        .single();
      expect(
        (data as { neighborhood_id: string | null }).neighborhood_id,
      ).toBe(targetId);
    });
  },
);
