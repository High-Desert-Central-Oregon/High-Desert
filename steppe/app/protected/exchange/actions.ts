"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";

/**
 * Create an Exchange post (spec §1.5/§6.3). Server sets everything the client
 * must not: author_id is pinned to the signed-in member and the board is the
 * Everyone system group — the X1 composer targets the community board only
 * (group boards come with the group-posting slice). RLS (po_insert) enforces
 * both for real; this action is the friendly layer. The EVENT category never
 * reaches here — the composer's EVENT chip routes to the structured event
 * form instead (define errors out of existence).
 *
 * NOTE (0018): posts has column-precise grants — the insert must name exactly
 * the granted columns; anything else fails loudly by privilege.
 */

/** The five writing categories; 'event' deliberately absent (§6.3). */
const WRITE_CATS = ["need", "offer", "aid", "job", "goods"] as const;
type WriteCat = (typeof WRITE_CATS)[number];

export type PostFormState = null | {
  error: "title-required" | "body-required" | "generic";
};

export async function createPost(
  _prev: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  // Friendly layer only — po_insert enforces is_verified() for real.
  if (!profile.verified) return { error: "generic" };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const rawCategory = String(formData.get("category") ?? "");
  const rawNeighborhood = String(formData.get("neighborhood_id") ?? "").trim();

  if (title.length === 0 || title.length > 160) return { error: "title-required" };
  if (body.length === 0 || body.length > 4000) return { error: "body-required" };
  if (!(WRITE_CATS as readonly string[]).includes(rawCategory))
    return { error: "generic" };
  const category = rawCategory as WriteCat;
  const neighborhoodId = rawNeighborhood.length > 0 ? rawNeighborhood : null;

  const supabase = await createClient();

  const { data: everyone } = await supabase
    .from("groups")
    .select("id")
    .eq("slug", "everyone")
    .eq("is_system", true)
    .single<{ id: string }>();
  if (!everyone) return { error: "generic" };

  const { error } = await supabase.from("posts").insert({
    group_id: everyone.id,
    author_id: profile.id,
    category,
    title,
    body,
    neighborhood_id: neighborhoodId,
  });
  if (error) return { error: "generic" };

  revalidatePath("/protected/exchange");
  // The board confirms with the bundle's own words: "Posted · newest first".
  redirect("/protected/exchange?posted=1");
}
