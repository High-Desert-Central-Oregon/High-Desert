import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { PageSkeleton } from "@/components/page-skeleton";
import { PostForm } from "../../new/post-form";
async function Edit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  const db = await createClient();
  const { data: post } = await db
    .from("posts")
    .select("id,title,body,tags,category,neighborhood_id")
    .eq("id", id)
    .eq("author_id", profile.id)
    .maybeSingle();
  if (!post || !profile.verified) notFound();
  const { data: neighborhoods } = await db
    .from("neighborhoods")
    .select("id,name")
    .order("name");
  const { locale, dict } = await getServerDictionary();
  return (
    <div lang={locale} className="flex flex-col gap-6">
      <Link href="/protected/exchange" className="underline">
        {dict.exchange.backToBoard}
      </Link>
      <h1 className="text-2xl font-semibold">{dict.exchange.edit}</h1>
      <PostForm
        initial={post}
        neighborhoods={neighborhoods ?? []}
        dict={dict}
      />
    </div>
  );
}
export default function EditPostPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Edit {...props} />
    </Suspense>
  );
}
