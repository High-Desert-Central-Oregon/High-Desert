import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageSkeleton } from "@/components/page-skeleton";
import { Masthead } from "@/components/broadsheet/masthead";
import { Fab } from "@/components/broadsheet/fab";
import { MarkerChip } from "@/components/broadsheet/chips";
import { PostRow, Monogram, initialsFor } from "@/components/broadsheet/post-row";
import { VerifiedGate } from "@/components/verified-gate";
import { ActionLink } from "@/components/broadsheet/action-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PullToRefresh } from "./pull-to-refresh";
import { ExchangeSegments } from "./exchange-segments";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { formatRedmondDateTime } from "@/lib/time";
import { getHiddenIds } from "@/lib/moderation";
import {
  postCategoryMarker,
  EVENT_MARKER,
  type PostCategory,
} from "@/lib/markers";
import type { Dictionary } from "@/lib/i18n";

export const metadata = {
  title: "The Exchange · Steppe",
};

/** The bundle's fixed six, in FILTER_ORDER (spec §1.1). */
const CATS = ["need", "offer", "event", "aid", "job", "goods"] as const;

type SearchParams = { f?: string; posted?: string; s?: string; q?: string };

type PostItem = {
  id: string;
  author_id: string;
  category: PostCategory;
  title: string;
  neighborhood_id: string | null;
  pinned_at: string | null;
  created_at: string;
};

type EventItem = {
  id: string;
  creator_id: string;
  title: string;
  starts_at: string;
  location: string | null;
  neighborhood_id: string | null;
  category_id: string | null;
  created_at: string;
};

/** One merged feed unit — a post or a projected event, on one shared clock. */
type FeedItem =
  | { kind: "post"; at: string; post: PostItem }
  | { kind: "event"; at: string; event: EventItem };

/** Category filter bar — ALL + the six, plain links (?f=…), JS-optional.
 *  Active = ink + the 2px rust underline (the bundle's segment grammar);
 *  squares are 9px, ALL is label-only (:1801 hasSquare:!isAll). */
function FilterBar({
  active,
  dict,
}: {
  active: PostCategory | null;
  dict: Dictionary;
}) {
  const chip = (isActive: boolean) =>
    `flex shrink-0 items-center gap-[7px] whitespace-nowrap border-b-2 pb-[3px] font-mono text-[11.5px] font-semibold uppercase tracking-[0.1em] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
      isActive
        ? "border-accent text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`;
  return (
    <nav aria-label={dict.exchange.categoryField} className="border-b-2 border-foreground">
      <ul className="flex gap-[18px] overflow-x-auto pb-[12px] pt-[11px]">
        <li>
          <Link
            href="/protected/exchange"
            aria-current={active === null ? "page" : undefined}
            className={chip(active === null)}
          >
            {dict.exchange.all}
          </Link>
        </li>
        {CATS.map((c) => (
          <li key={c}>
            <Link
              href={`/protected/exchange?f=${c}`}
              aria-current={active === c ? "page" : undefined}
              className={chip(active === c)}
            >
              <span
                aria-hidden="true"
                className="inline-block size-[9px] rounded-marker"
                style={{ background: postCategoryMarker(c) }}
              />
              {dict.exchange.cats[c]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The pinned feature (spec §1.3) — the one place the drop cap lives: rust
 *  flag + PINNED BY MODERATORS kicker, juniper 26px title, 48px rust drop
 *  cap on the standfirst, mono byline. At most one per board (DB-enforced). */
function PinnedFeature({
  post,
  body,
  authorName,
  dict,
  locale,
}: {
  post: PostItem;
  body: string;
  authorName: string;
  dict: Dictionary;
  locale: string;
}) {
  // Spec §1.3: drop cap = char 0, standfirst = chars 1–150 + ellipsis.
  const standfirst = body.slice(1, 151) + (body.length > 151 ? "…" : "");
  return (
    <Link
      href={`/protected/exchange/${post.id}`}
      className="block border-b pb-5 pt-[18px] transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
    >
      <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#A8542C" aria-hidden="true">
          <path d="M9 4h6l-1 7 4 3v2H7v-2l4-3-1-7z" />
        </svg>
        {dict.exchange.pinned}
      </div>
      <div className="mt-[13px] flex gap-[13px]">
        <Monogram initials={initialsFor(authorName)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-[7px] gap-y-1">
            <MarkerChip
              label={dict.exchange.cats[post.category]}
              color={postCategoryMarker(post.category)}
              size={9}
            />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              · {formatRedmondDateTime(post.created_at, locale)}
            </span>
          </div>
          <p className="mt-2 font-serif text-[26px] font-semibold leading-[1.16] text-primary">
            {post.title}
          </p>
        </div>
      </div>
      <p className="mt-[13px] text-[15px] leading-[1.55] text-muted-foreground">
        {/* The drop cap is the body's real first character — floated, never
            aria-hidden (AT reads the excerpt whole). */}
        <span className="float-left pr-[10px] pt-[5px] font-serif text-[48px] font-semibold leading-[0.72] text-accent">
          {body.charAt(0)}
        </span>
        {standfirst}
      </p>
      <p className="mt-[13px] clear-both font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        — {authorName.toUpperCase()} · {dict.exchange.verified.toUpperCase()}
      </p>
    </Link>
  );
}

/** Empty state — the bundle's miniature strata (:584-597), sun kept a circle
 *  at any width (the horizon-band treatment: ridges stretch, sun doesn't). */
function EmptyBoard({ dict }: { dict: Dictionary }) {
  return (
    <div className="px-6 pb-10 pt-[14px] text-center">
      <div aria-hidden="true" className="relative mt-[18px] h-16 w-full overflow-hidden">
        <svg
          viewBox="0 0 64 64"
          className="absolute top-0 h-full w-auto -translate-x-1/2"
          style={{ aspectRatio: "1", left: "calc(100% * 322 / 402)" }}
        >
          <circle cx="32" cy="22" r="14" fill="#A8542C" />
        </svg>
        <svg
          viewBox="0 0 402 64"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <path d="M0,40 C80,32 150,36 220,33 C300,29 360,35 402,32 L402,64 L0,64 Z" fill="#6E8A5B" />
          <path d="M0,52 C90,46 150,49 230,48 C320,45 372,49 402,48 L402,64 L0,64 Z" fill="#34383D" />
        </svg>
      </div>
      <p className="mt-4 font-serif text-[20px] font-semibold text-foreground">
        {dict.exchange.emptyTitle}
      </p>
      <p className="mt-[6px] text-[13.5px] leading-[1.5] text-muted-foreground">
        {dict.exchange.emptySub}
      </p>
    </div>
  );
}

async function BoardContent({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
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

  const sp = await searchParams;
  const f = (CATS as readonly string[]).includes(sp.f ?? "")
    ? (sp.f as PostCategory)
    : null;
  const q = (sp.q ?? "").trim();
  // The header slot opens the search with ?s=1; it stays open server-side
  // while a query is active — no JavaScript required (the groups pattern).
  const searchOpen = sp.s === "1" || q !== "";
  // PostgREST or() grammar: quote the pattern, strip the two characters that
  // would escape it. % and _ stay live as wildcards — that's search.
  const qPat = q.replace(/["\\]/g, "");

  const supabase = await createClient();

  // The community board = the Everyone system group (spec §5.1).
  const { data: everyone } = await supabase
    .from("groups")
    .select("id")
    .eq("slug", "everyone")
    .eq("is_system", true)
    .single<{ id: string }>();
  if (!everyone) throw new Error("Everyone group missing");

  // Posts — newest first, no exceptions (invariant 7), bounded for the slow
  // phone (invariant 9); bodies are NOT fetched for rows (only the pinned
  // feature needs one, below). RLS (0018 po_read) hides removed posts from
  // ordinary members; the getHiddenIds pass keeps them out of the LIST for
  // the author and moderators too — the detail page carries the legible
  // removed state (P7), the same split the events surface uses.
  // Search matches title + body + author name (spec §1.4, :1799-1800).
  // Author matching resolves display names to ids first (public columns only).
  let authorMatchIds: string[] = [];
  if (qPat) {
    const { data: matched } = await supabase
      .from("public_profiles")
      .select("id")
      .ilike("display_name", `%${qPat}%`)
      .limit(50)
      .returns<{ id: string }[]>();
    authorMatchIds = (matched ?? []).map((m) => m.id);
  }

  let postQuery = supabase
    .from("posts")
    .select(
      "id, author_id, category, title, neighborhood_id, pinned_at, created_at",
    )
    .eq("group_id", everyone.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (f) postQuery = postQuery.eq("category", f);
  if (qPat)
    postQuery = postQuery.or(
      [
        `title.ilike."%${qPat}%"`,
        `body.ilike."%${qPat}%"`,
        ...(authorMatchIds.length > 0
          ? [`author_id.in.(${authorMatchIds.join(",")})`]
          : []),
      ].join(","),
    );
  const [{ data: postRows }, hiddenPosts] = await Promise.all([
    postQuery.returns<PostItem[]>(),
    getHiddenIds(supabase, "post"),
  ]);
  const posts = (postRows ?? []).filter((p) => !hiddenPosts.has(p.id));

  // Upcoming events projected into the feed as EVENT rows (spec §6.2) — the
  // same shared clock (created_at), shown under ALL and the EVENT filter.
  // Explicit columns (0018 is applied; the 0017 select("*") interim retires).
  let events: EventItem[] = [];
  if (!f || f === "event") {
    let eventQuery = supabase
      .from("events")
      .select(
        "id, creator_id, title, starts_at, location, neighborhood_id, category_id, created_at",
      )
      .eq("group_id", everyone.id)
      .eq("status", "active")
      .gte("starts_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(100);
    if (qPat)
      eventQuery = eventQuery.or(
        `title.ilike."%${qPat}%",location.ilike."%${qPat}%"`,
      );
    const { data: eventRows } = await eventQuery.returns<EventItem[]>();
    // Hidden (moderator-removed) events drop out of the listing; their detail
    // page still shows the legible removed state (P7).
    const hidden = await getHiddenIds(supabase, "event");
    events = (eventRows ?? []).filter((e) => !hidden.has(e.id));
  }

  // The pinned feature (≤1 per board, DB-enforced) leaves the row flow; it
  // renders only when it matches the active filter (bundle :1822). Its body
  // (for the drop-cap standfirst) is the one body the board fetches.
  const pinned = posts.find((p) => p.pinned_at !== null) ?? null;
  let pinnedBody = "";
  if (pinned) {
    const { data: pb } = await supabase
      .from("posts")
      .select("body")
      .eq("id", pinned.id)
      .maybeSingle<{ body: string }>();
    pinnedBody = pb?.body ?? "";
  }
  const rows: FeedItem[] = [
    ...posts
      .filter((p) => p !== pinned)
      .map((p): FeedItem => ({ kind: "post", at: p.created_at, post: p })),
    ...events.map(
      (e): FeedItem => ({ kind: "event", at: e.created_at, event: e }),
    ),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  // Names, neighborhoods, and event category tags — three batched lookups.
  const authorIds = [
    ...new Set([
      ...posts.map((p) => p.author_id),
      ...events.map((e) => e.creator_id),
    ]),
  ];
  const nbIds = [
    ...new Set(
      [...posts, ...events]
        .map((x) => x.neighborhood_id)
        .filter((x): x is string => !!x),
    ),
  ];
  const catIds = [
    ...new Set(events.map((e) => e.category_id).filter((x): x is string => !!x)),
  ];
  const [authorsRes, nbsRes, catsRes] = await Promise.all([
    authorIds.length > 0
      ? supabase.from("public_profiles").select("id, display_name").in("id", authorIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
    nbIds.length > 0
      ? supabase.from("neighborhoods").select("id, name").in("id", nbIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    catIds.length > 0
      ? supabase.from("categories").select("id, slug, name").in("id", catIds)
      : Promise.resolve({
          data: [] as { id: string; slug: string; name: string }[],
        }),
  ]);
  const nameOf = new Map((authorsRes.data ?? []).map((a) => [a.id, a.display_name]));
  const hoodOf = new Map((nbsRes.data ?? []).map((n) => [n.id, n.name]));
  const catOf = new Map(
    (catsRes.data ?? []).map((c) => [c.id, { slug: c.slug, name: c.name }]),
  );
  const hood = (id: string | null) =>
    (id ? hoodOf.get(id) : null) ?? dict.events.allRedmond;
  const name = (id: string) => nameOf.get(id) ?? "—";

  return (
    <div lang={locale} className="flex flex-col gap-5">
      {/* Preview masthead grammar — the bundle's own dateline + voice, both
          load-bearing copy (member-owned · no ads; newest first). */}
      <Masthead
        title={dict.exchange.title}
        kicker={dict.exchange.dateline}
        voice={dict.exchange.voice}
        flush
      />
      <Fab href="/protected/exchange/new" label={dict.exchange.postNew} />

      {/* Board | Upcoming — the calendar is a view here, not a tab (§7.1). */}
      <ExchangeSegments active="board" dict={dict} />

      {/* Search — the header slot's ?s=1 reveal (JS-optional GET form; the
          bundle's "Search the Exchange", matching title + body + author). */}
      {searchOpen && (
        <form
          method="GET"
          action="/protected/exchange"
          role="search"
          className="flex flex-col gap-3 border bg-muted/40 p-4 sm:flex-row sm:items-end"
        >
          {f && <input type="hidden" name="f" value={f} />}
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="q" className="text-sm font-medium">
              {dict.nav.searchLabel}
            </label>
            <Input
              id="q"
              name="q"
              defaultValue={q}
              placeholder={dict.exchange.searchPh}
            />
          </div>
          <div className="flex items-center gap-4">
            <Button type="submit" variant="outline">
              {dict.exchange.searchSubmit}
            </Button>
            <ActionLink
              href={f ? `/protected/exchange?f=${f}` : "/protected/exchange"}
              label={dict.common.cancel}
            />
          </div>
        </form>
      )}

      <FilterBar active={f} dict={dict} />

      {/* The posted confirmation restates the ordering promise (the bundle's
          toast, server-rendered): "Posted · newest first". */}
      {sp.posted === "1" && (
        <p
          role="status"
          className="border bg-muted px-4 py-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          {dict.exchange.toastPosted}
        </p>
      )}

      <PullToRefresh
        labels={{
          pull: dict.exchange.pull,
          release: dict.exchange.release,
          updating: dict.exchange.updating,
          updated: dict.exchange.updated,
        }}
      >
        {pinned && (
          <PinnedFeature
            post={pinned}
            body={pinnedBody}
            authorName={name(pinned.author_id)}
            dict={dict}
            locale={locale}
          />
        )}
        {rows.length === 0 && !pinned ? (
          <EmptyBoard dict={dict} />
        ) : (
          <ul className="flex flex-col">
            {rows.map((item) =>
              item.kind === "post" ? (
                <li key={`p-${item.post.id}`}>
                  <PostRow
                    href={`/protected/exchange/${item.post.id}`}
                    markerLabel={dict.exchange.cats[item.post.category]}
                    markerColor={postCategoryMarker(item.post.category)}
                    hood={hood(item.post.neighborhood_id)}
                    when={formatRedmondDateTime(item.post.created_at, locale)}
                    title={item.post.title}
                    authorName={name(item.post.author_id)}
                    verifiedLabel={dict.exchange.verified}
                  />
                </li>
              ) : (
                <li key={`e-${item.event.id}`}>
                  <PostRow
                    href={`/protected/events/${item.event.id}`}
                    markerLabel={dict.exchange.cats.event}
                    markerColor={EVENT_MARKER}
                    hood={hood(item.event.neighborhood_id)}
                    when={formatRedmondDateTime(item.event.starts_at, locale)}
                    title={item.event.title}
                    sub={
                      [
                        item.event.category_id
                          ? catOf.get(item.event.category_id)?.name
                          : null,
                        item.event.location,
                      ]
                        .filter(Boolean)
                        .join(" · ") || undefined
                    }
                    authorName={name(item.event.creator_id)}
                    verifiedLabel={dict.exchange.verified}
                  />
                </li>
              ),
            )}
          </ul>
        )}
      </PullToRefresh>

      {/* ISoMiMo keeps warming the truly-empty board (no filter, no rows). */}
      {rows.length === 0 && !pinned && !f && (
        <div className="flex justify-center">
          <Image
            src="/brand/steppe-isomimo-512.png"
            alt={dict.common.isomimoAlt}
            width={150}
            height={150}
          />
        </div>
      )}
    </div>
  );
}

export default function ExchangePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BoardContent searchParams={searchParams} />
    </Suspense>
  );
}
