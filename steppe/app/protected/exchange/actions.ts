"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parsePostTags } from "@/lib/post-tags";
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
  const tags = parsePostTags(formData.getAll("category"));
  const rawCategory = tags?.[0] ?? "";
  const rawNeighborhood = String(formData.get("neighborhood_id") ?? "").trim();

  if (title.length === 0 || title.length > 160)
    return { error: "title-required" };
  if (body.length === 0 || body.length > 4000)
    return { error: "body-required" };
  if (!tags) return { error: "generic" };
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
    tags,
    title,
    body,
    neighborhood_id: neighborhoodId,
  });
  if (error) return { error: "generic" };

  revalidatePath("/protected/exchange");
  // The board confirms with the bundle's own words: "Posted · newest first".
  redirect("/protected/exchange?posted=1");
}

/** RLS and the explicit author predicate both scope mutations to the caller. */
export async function updatePost(
  id: string,
  _prev: PostFormState,
  fd: FormData,
): Promise<PostFormState> {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  const title = String(fd.get("title") ?? "").trim();
  const body = String(fd.get("body") ?? "").trim();
  const tags = parsePostTags(fd.getAll("category"));
  if (!title || title.length > 160) return { error: "title-required" };
  if (!body || body.length > 4000) return { error: "body-required" };
  if (!tags || !profile.verified) return { error: "generic" };
  const db = await createClient();
  const { data, error } = await db
    .from("posts")
    .update({
      title,
      body,
      tags,
      category: tags[0],
      neighborhood_id: String(fd.get("neighborhood_id") ?? "").trim() || null,
    })
    .eq("id", id)
    .eq("author_id", profile.id)
    .select("id")
    .single();
  if (error || !data) return { error: "generic" };
  revalidatePath("/protected/exchange");
  revalidatePath(`/protected/exchange/${id}`);
  revalidatePath("/protected/groups", "layout");
  redirect(`/protected/exchange/${id}?saved=1`);
}

export async function deletePost(
  id: string,
  _prev: PostFormState,
  fd: FormData,
): Promise<PostFormState> {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  if (fd.get("confirm") !== "delete") return { error: "generic" };
  const db = await createClient();
  const { data, error } = await db
    .from("posts")
    .delete()
    .eq("id", id)
    .eq("author_id", profile.id)
    .select("id")
    .single();
  if (error || !data) return { error: "generic" };
  revalidatePath("/protected/exchange");
  revalidatePath(`/protected/exchange/${id}`);
  revalidatePath("/protected/groups", "layout");
  redirect("/protected/exchange?deleted=1");
}
