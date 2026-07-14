import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageSkeleton } from "@/components/page-skeleton";
import { MarkerChip } from "@/components/broadsheet/chips";
import { Monogram, initialsFor } from "@/components/broadsheet/post-row";
import { VerifiedGate } from "@/components/verified-gate";
import { RemovedBanner } from "../../moderation/removed-banner";
import { AppealArea } from "../../moderation/appeal-area";
import { ModerationControl } from "../../moderation/moderation-control";
import { ReportCard } from "../../moderation/report-card";
import { MessageComposer } from "../../messages/message-composer";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { formatRedmondDateTime } from "@/lib/time";
import { getContentModeration } from "@/lib/moderation";
import { postCategoryMarker, type PostCategory } from "@/lib/markers";

/**
 * Post detail (spec §1.6, as amended): author block with the verified line,
 * marker kicker, juniper Besley title, full body — and deliberately NO action
 * row: Message is M1 and member Reports are the first fast-follow (spec §8 +
 * the 2026-07-12 amendment). Moderators keep the remove control (existing
 * moderation flow, P7); removal shows the legible removed state to the author
 * and moderators — RLS hides the row from everyone else entirely.
 */

type PostRowFull = {
  id: string;
  author_id: string;
  category: PostCategory;
  title: string;
  body: string;
  neighborhood_id: string | null;
  created_at: string;
  edited_at: string | null;
};

type SearchParams = { reported?: string; reportErr?: string; msgErr?: string };

async function PostDetailContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  const { locale, dict } = await getServerDictionary();

  if (!profile.verified)
    return (
      <VerifiedGate
        title={dict.exchange.gateTitle}
        body={dict.exchange.gateBody}
        ctaLabel={dict.exchange.gateCta}
        locale={locale}
      />
    );

  const supabase = await createClient();

  // RLS (po_read) scopes by board membership AND hides removed posts from
  // ordinary members — a missing row is a clean 404.
  const { data: post } = await supabase
    .from("posts")
    .select(
      "id, author_id, category, title, body, neighborhood_id, created_at, edited_at",
    )
    .eq("id", id)
    .maybeSingle<PostRowFull>();
  if (!post) notFound();

  const isMod = profile.role === "moderator" || profile.role === "admin";
  const isOwner = post.author_id === profile.id;

  // Only the author and moderators can reach a removed post's row (0018
  // po_read); they get the legible removed state, never a silent hole (P7).
  const moderation = await getContentModeration(supabase, "post", post.id);
  if (moderation?.hidden) {
    return (
      <div lang={locale} className="flex flex-col gap-6">
        <Link
          href="/protected/exchange"
          className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {dict.exchange.backToBoard}
        </Link>
        <RemovedBanner targetType="post" reason={moderation.reason} dict={dict}>
          <AppealArea
            actionId={moderation.actionId}
            targetType="post"
            targetId={post.id}
            isOwner={isOwner}
            dict={dict}
          />
        </RemovedBanner>
        {isMod && (
          <ModerationControl
            targetType="post"
            targetId={post.id}
            mode="restore"
            dict={dict}
          />
        )}
      </div>
    );
  }

  // Author + neighborhood, resolved in parallel (public columns only).
  const [{ data: author }, { data: nb }] = await Promise.all([
    supabase
      .from("public_profiles")
      .select("display_name")
      .eq("id", post.author_id)
      .maybeSingle<{ display_name: string }>(),
    post.neighborhood_id
      ? supabase
          .from("neighborhoods")
          .select("name")
          .eq("id", post.neighborhood_id)
          .maybeSingle<{ name: string }>()
      : Promise.resolve({ data: null }),
  ]);
  const authorName = author?.display_name ?? "—";
  const hood = nb?.name ?? dict.events.allRedmond;

  return (
    <div lang={locale} className="flex flex-col gap-6">
      <Link
        href="/protected/exchange"
        className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        {dict.exchange.backToBoard}
      </Link>

      {/* Author block (bundle :764-768): 48px disc, name, the verified line. */}
      <div className="flex items-center gap-3">
        <Monogram initials={initialsFor(authorName)} size={48} />
        <div>
          <p className="text-[15.5px] font-semibold text-foreground">
            {authorName}
          </p>
          {/* Sage stays a MARKER (the square); the label reads in ink-soft —
              sage as 10px text fails AA on paper (invariant 9). */}
          <p className="mt-[3px] flex items-center gap-[6px] font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            <span
              aria-hidden="true"
              className="inline-block size-[6px] rounded-marker bg-[color:var(--marker-sage)]"
            />
            {dict.exchange.verified}
          </p>
        </div>
      </div>

      <article className="flex flex-col">
        {/* Marker kicker: category chip + quiet hood · time (bundle :770-773). */}
        <div className="flex flex-wrap items-center gap-x-[7px] gap-y-1">
          <MarkerChip
            label={dict.exchange.cats[post.category]}
            color={postCategoryMarker(post.category)}
          />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            · {hood} · {formatRedmondDateTime(post.created_at, locale)}
          </span>
        </div>

        <h1 className="mt-[14px] font-serif text-[30px] font-semibold leading-[1.16] text-primary">
          {post.title}
        </h1>

        <p className="mt-[15px] whitespace-pre-wrap text-[16px] leading-[1.62] text-foreground">
          {post.body}
        </p>
      </article>

      {/* Report + message confirmations/errors — identical every time. */}
      {sp.reported === "1" && (
        <p role="status" className="text-sm font-medium text-foreground">
          {dict.moderation.reportSent}
        </p>
      )}
      {sp.reportErr === "1" && (
        <p role="status" className="text-sm font-medium text-accent">
          {dict.moderation.reportError}
        </p>
      )}
      {sp.msgErr === "1" && (
        <p role="status" className="text-sm font-medium text-accent">
          {dict.messages.reachError}
        </p>
      )}

      {/* Message the author (spec §5 door 1) + the member Report intake (the
          X1 §8 action-row debt paid) — neither on your own post; moderators
          use their own tools below. */}
      {post.author_id !== profile.id && !isMod && (
        <div className="flex flex-col gap-4">
          <MessageComposer
            authorId={post.author_id}
            authorName={authorName}
            postId={post.id}
            back={`/protected/exchange/${post.id}`}
            dict={dict}
          />
          <ReportCard
            targetType="post"
            targetId={post.id}
            back={`/protected/exchange/${post.id}`}
            dict={dict}
          />
        </div>
      )}

      {/* Moderators: the existing legible remove flow — reason required,
          appealable, never a quiet delete (G4/P7). */}
      {isMod && (
        <ModerationControl
          targetType="post"
          targetId={post.id}
          mode="remove"
          dict={dict}
        />
      )}
    </div>
  );
}

export default function PostDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PostDetailContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
