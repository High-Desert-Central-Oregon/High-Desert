"use client";

import { useRef, useState } from "react";
import { SealMark } from "../_components/seal-mark";

/**
 * Interactive MVP facsimile for /preview — a fully client-side preview of the
 * Steppe app for prospective members (design: _design-source/steppe-preview-v3
 * .html), reconciled to the locked MVP scope. In-memory sample data only: NO
 * backend, NO network, NO localStorage, NO auth/RLS/governance code.
 *
 * Mirrors what ships:
 *  - Exchange: ONE listing primitive with six type tags (Need / Offer / Job /
 *    Goods / Mutual aid / Event), category filtering, listing detail. Non-event
 *    types open an in-app message thread (connect → chat). Event listings show
 *    date + location and an Add-to-calendar (.ics) action — no Message, no RSVP.
 *    Post a listing (compose; events also capture date + location).
 *  - Groups: browse + Join/Leave, group detail with a Feed tab and an Events tab
 *    (basic events with add-to-calendar; no RSVP, no month-grid). Join stays in
 *    sync between list and detail.
 *  - Govern: ranked-choice + secret ballot, flat franchise.
 *  - You: per-field visibility, members-only at launch (Hidden / Members).
 *
 * Deliberately absent (deferred growth-ladder features): the marketplace, RSVP /
 * month-grid / recurrence / reminders, the Neighbor tier / "everyone" audience,
 * SMS, and tenure-weighted voting.
 */
type Tab = "exchange" | "groups" | "govern" | "you";
type ExchangeView = "feed" | "detail" | "message" | "compose";
type GroupsView = "list" | "detail";
type GroupTab = "feed" | "events";
type Vis = "hidden" | "members";
type CatKey = "need" | "offer" | "job" | "goods" | "aid" | "event";

type Listing = {
  id: string;
  catKey: CatKey;
  cat: string;
  c: string;
  ttl: string;
  init: string;
  by: string;
  who: string;
  body: string;
  // event-only:
  dateLabel?: string;
  location?: string;
  start?: string; // "YYYY-MM-DD" (all-day) or "YYYY-MM-DDTHH:MM:SS" (timed)
};
type Msg = { from: "me" | "them"; text: string };
type GroupPost = { author: string; init: string; text: string };
type GroupEvent = {
  id: string;
  title: string;
  dateLabel: string;
  location: string;
  start: string;
};
type Group = {
  id: string;
  name: string;
  meta: string;
  members: number;
  desc: string;
  feed: GroupPost[];
  events: GroupEvent[];
};

// Category inks (light values; the phone screen is always light paper, so dark
// variants aren't needed here — see preview.css).
const CATS: { key: CatKey; label: string; c: string }[] = [
  { key: "need", label: "Need", c: "#A8542C" },
  { key: "offer", label: "Offer", c: "#6E8A5B" },
  { key: "job", label: "Job", c: "#7E5A74" },
  { key: "goods", label: "Goods", c: "#8C6A46" },
  { key: "aid", label: "Mutual aid", c: "#4F6B7A" },
  { key: "event", label: "Event", c: "#A8842F" },
];
const catClass = (k: CatKey) => `c-${k}`;
const catMeta = (k: CatKey) => CATS.find((c) => c.key === k)!;

const LISTINGS: Listing[] = [
  {
    id: "0412",
    catKey: "offer",
    cat: "Offer",
    c: "#6E8A5B",
    ttl: "Free tomato starts — 40+ plants",
    init: "MK",
    by: "Martha K. · 2h",
    who: "Martha K.",
    body: "Grew too many Early Girls this spring. Free to anyone who'll plant them. Pickup near downtown — evenings and weekends work best.",
  },
  {
    id: "0411",
    catKey: "need",
    cat: "Need",
    c: "#A8542C",
    ttl: "Electrician who knows older homes",
    init: "JR",
    by: "James R. · 5h",
    who: "James R.",
    body: "Panel upgrade on a 1970s house. Licensed and insured, ideally someone who's worked on older Redmond homes. Daytime works best for a walkthrough.",
  },
  {
    id: "0410",
    catKey: "job",
    cat: "Job",
    c: "#7E5A74",
    ttl: "Part-time barista, downtown café",
    init: "BC",
    by: "Birdie Coffee · 1d",
    who: "Birdie Coffee",
    body: "Hiring a friendly part-timer for morning shifts, about 20 hours a week. No experience needed, we'll train. Walk a résumé in any morning.",
  },
  {
    id: "0409",
    catKey: "goods",
    cat: "Goods",
    c: "#8C6A46",
    ttl: "Solid oak dresser, free to haul",
    init: "RP",
    by: "Rosa P. · 7h",
    who: "Rosa P.",
    body: "Heavy six-drawer dresser, good shape aside from one sticky drawer. Free if you can pick it up off NW Larch this week. Bring a friend, it's heavy.",
  },
  {
    id: "0408",
    catKey: "aid",
    cat: "Mutual aid",
    c: "#4F6B7A",
    ttl: "Rides to medical appointments",
    init: "DL",
    by: "Dana L. · 3h",
    who: "Dana L.",
    body: "Can offer two rides a week for neighbors needing transportation to Bend. Flexible on timing — reach out and we'll coordinate.",
  },
  {
    id: "0407",
    catKey: "need",
    cat: "Need",
    c: "#A8542C",
    ttl: "Borrow a tall ladder this weekend",
    init: "PG",
    by: "Priya G. · 8h",
    who: "Priya G.",
    body: "Need a 24-foot extension ladder to clear the gutters Saturday. Happy to leave a deposit and return it the same day.",
  },
  {
    id: "0406",
    catKey: "offer",
    cat: "Offer",
    c: "#6E8A5B",
    ttl: "Seasoned juniper firewood, you haul",
    init: "TB",
    by: "Tomás B. · 1d",
    who: "Tomás B.",
    body: "Half a cord of seasoned juniper left over from a property cleanup. Free if you can load and haul it this week off NW Maple.",
  },
  {
    id: "0405",
    catKey: "event",
    cat: "Event",
    c: "#A8842F",
    ttl: "Member meeting — July 12",
    init: "St",
    by: "Steppe · event",
    who: "Steppe",
    body: "Monthly open meeting: Community Fund proposals, governance Q&A, and a new-member welcome. All members invited.",
    dateLabel: "Sat, Jul 12 · 10:00 AM",
    location: "Redmond Public Library, Community Room",
    start: "2026-07-12T10:00:00",
  },
  {
    id: "0404",
    catKey: "event",
    cat: "Event",
    c: "#A8842F",
    ttl: "Repair café at the Grange",
    init: "RC",
    by: "Repair Collective · event",
    who: "Repair Collective",
    body: "Bring a broken lamp, bike, or jacket and fix it alongside neighbors who know how. Tools and parts on hand. Drop in any time.",
    dateLabel: "Sun, Jul 20 · 1:00 PM",
    location: "Redmond Grange Hall",
    start: "2026-07-20T13:00:00",
  },
];

const SEED_THREADS: Record<string, Msg[]> = {
  "0412": [
    { from: "me", text: "Hi Martha, are the tomato starts still available?" },
    {
      from: "them",
      text: "Yes, plenty left. Any evening this week works for pickup near downtown.",
    },
  ],
  "0408": [
    {
      from: "them",
      text: "Happy to help with rides. Which day works for your appointment?",
    },
  ],
};

const FILTERS: { key: "all" | CatKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "need", label: "Need" },
  { key: "offer", label: "Offer" },
  { key: "job", label: "Job" },
  { key: "goods", label: "Goods" },
  { key: "aid", label: "Mutual aid" },
  { key: "event", label: "Event" },
];

const GROUPS: Group[] = [
  {
    id: "g1",
    name: "Dry Canyon Trail Stewards",
    meta: "214 members · weekly",
    members: 214,
    desc: "Neighbors who keep the Dry Canyon trail clear and safe. Monthly work parties, plus quick cleanups after storms.",
    feed: [
      { author: "Priya N.", init: "PN", text: "Saturday's cleanup starts at 9am at the NE trailhead. Bring gloves and water." },
      { author: "Marcus T.", init: "MT", text: "Found a downed juniper across the lower loop. Flagged it, crew can clear it this weekend." },
    ],
    events: [
      { id: "g1e1", title: "Dry Canyon trail cleanup", dateLabel: "Sat, Jul 19 · 9:00 AM", location: "NE trailhead, Dry Canyon", start: "2026-07-19T09:00:00" },
      { id: "g1e2", title: "Trail stewards potluck", dateLabel: "Fri, Aug 8 · 6:00 PM", location: "Sam Johnson Park", start: "2026-08-08T18:00:00" },
    ],
  },
  {
    id: "g2",
    name: "SE Redmond Neighbors",
    meta: "389 members · daily",
    members: 389,
    desc: "The day-to-day group for southeast Redmond: lost pets, road notices, recommendations, and the occasional block party.",
    feed: [
      { author: "Dana L.", init: "DL", text: "Reminder: street sweeping on Quartz comes through Thursday morning." },
      { author: "Sam O.", init: "SO", text: "Anyone have a recommendation for a fence repair? Wind took out a panel." },
    ],
    events: [
      { id: "g2e1", title: "Southeast block meetup", dateLabel: "Thu, Jul 17 · 6:30 PM", location: "Quartz Avenue Park", start: "2026-07-17T18:30:00" },
    ],
  },
  {
    id: "g3",
    name: "Tool Library",
    meta: "96 members · lending",
    members: 96,
    desc: "A shared shelf of tools members can borrow for free. Check something out, bring it back clean.",
    feed: [
      { author: "Steppe", init: "St", text: "New this month: a tile saw and two more cordless drills are now on the shelf." },
      { author: "Lena R.", init: "LR", text: "Returned the pressure washer, works great. Thanks to whoever donated it." },
    ],
    events: [
      { id: "g3e1", title: "Repair café", dateLabel: "Sat, Aug 2 · 11:00 AM", location: "Tool Library, NW Maple Ave", start: "2026-08-02T11:00:00" },
      { id: "g3e2", title: "Sharpening clinic", dateLabel: "Sat, Aug 16 · 10:00 AM", location: "Tool Library, NW Maple Ave", start: "2026-08-16T10:00:00" },
    ],
  },
];

const CAPTIONS: Record<Tab, [string, string, string, string]> = {
  exchange: [
    "The exchange",
    "One honest feed.",
    "Needs, offers, jobs, goods, mutual aid, and events, all on one listing. Nothing is ranked or boosted. Tap any entry to open it and reach that neighbor directly.",
    "No ads · no tracking · messages stay inside Steppe",
  ],
  groups: [
    "Groups",
    "Groups you choose.",
    "Join the neighborhood and interest groups you want and leave any of them whenever you like. Open a group to see its feed and upcoming events.",
    "You control which groups can message you",
  ],
  govern: [
    "Govern",
    "Your vote, in private.",
    "Vote on the budget, the rules, and where Steppe goes next. Your ballot is secret, and at launch everyone's counts the same.",
    "15% quorum · secret ballot · reversible by vote",
  ],
  you: [
    "You",
    "Private until you say so.",
    "Your profile starts private. Keep each field hidden, or show it to members. It's field by field, and it's your call. We will never take that from you.",
    "Username always shown · everything else your choice",
  ],
};

const OPTIONS = [
  "Dry Canyon trail repair",
  "Winter warming-shelter supplies",
  "Little free pantry restock",
];

const FIELDS = [
  { k: "Real name", sub: "Sarah Okafor" },
  { k: "Neighborhood", sub: "SE Redmond" },
  { k: "Email", sub: "For messages & receipts" },
  { k: "Phone", sub: "Optional" },
];

// MVP: members-only privacy (no "everyone"/Neighbor-tier audience at launch).
const VIS_ORDER: Vis[] = ["hidden", "members"];
const VIS_LABEL: Record<Vis, string> = { hidden: "Hidden", members: "Members" };

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
// Client-side .ics generation + download (no RSVP, no network).
function downloadIcs(ev: { id: string; title: string; location: string; start: string }) {
  const allDay = !ev.start.includes("T");
  // Strip separators with chained single-char replaces rather than one regex
  // character class. A bracketed dash-colon-dot token in source gets misread by
  // Tailwind's class scanner as an arbitrary-property utility, which emits a
  // broken rule into the member app's globals.css build — so keep it out of here,
  // comments included.
  const strip = (s: string) => s.replace(/-/g, "").replace(/:/g, "").replace(/\./g, "");
  const dt = allDay ? strip(ev.start) : strip(ev.start).slice(0, 15);
  const stamp = strip(new Date().toISOString()).slice(0, 15) + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Steppe//Preview//EN",
    "BEGIN:VEVENT",
    `UID:${ev.id}-${dt}@steppe.preview`,
    `DTSTAMP:${stamp}`,
    allDay ? `DTSTART;VALUE=DATE:${dt}` : `DTSTART:${dt}`,
    `SUMMARY:${icsEscape(ev.title)}`,
    `LOCATION:${icsEscape(ev.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(ev.title) || "event"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const Chevron = () => (
  <svg className="echev" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const BackArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CalIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="4" y="5" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M4 9h16M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const GROUP_ICONS = [
  <svg key="g0" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 18c2-5 5-9 8-11 3 2 6 6 8 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="12" cy="5" r="1.6" fill="currentColor" />
  </svg>,
  <svg key="g1" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 20v-1a4 4 0 0 1 4-4M16 15a4 4 0 0 1 4 4v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="8" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="16" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.5" />
  </svg>,
  <svg key="g2" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 7h12l-1 13H7L6 7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M9 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.5" />
  </svg>,
];

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  exchange: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  groups: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8" cy="9" r="2.6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="9" r="2.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 19c0-2.8 2-4.5 4.5-4.5s4.5 1.7 4.5 4.5M11.5 19c0-2.8 2-4.5 4.5-4.5s4.5 1.7 4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  govern: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="9" width="16" height="11" rx="1.4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 9V5m-3 9h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  you: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 20c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
};

const TABS: { v: Tab; label: string }[] = [
  { v: "exchange", label: "Exchange" },
  { v: "groups", label: "Groups" },
  { v: "govern", label: "Govern" },
  { v: "you", label: "You" },
];

const EventMeta = ({ dateLabel, location }: { dateLabel: string; location: string }) => (
  <div className="evmeta">
    <div className="evrow">
      <CalIcon />
      {dateLabel}
    </div>
    <div className="evrow">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 1C5 1 3 3.2 3 6c0 3.6 5 9 5 9s5-5.4 5-9c0-2.8-2-5-5-5z" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="8" cy="6" r="1.6" stroke="currentColor" strokeWidth="1.4" />
      </svg>
      {location}
    </div>
  </div>
);

export function PreviewStage() {
  const [tab, setTab] = useState<Tab>("exchange");

  // exchange
  const [exView, setExView] = useState<ExchangeView>("feed");
  const [filter, setFilter] = useState<"all" | CatKey>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [posted, setPosted] = useState<Listing[]>([]);
  const [threads, setThreads] = useState<Record<string, Msg[]>>(SEED_THREADS);
  const [draft, setDraft] = useState("");
  // compose form
  const [cCat, setCCat] = useState<CatKey>("need");
  const [cTitle, setCTitle] = useState("");
  const [cBody, setCBody] = useState("");
  const [cDate, setCDate] = useState("");
  const [cLoc, setCLoc] = useState("");
  const nextId = useRef(900);

  // groups
  const [grView, setGrView] = useState<GroupsView>("list");
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [groupTab, setGroupTab] = useState<GroupTab>("feed");
  const [joined, setJoined] = useState<Record<string, boolean>>({ g1: true });

  // govern + you
  const [ranked, setRanked] = useState<number[]>([]);
  const [voted, setVoted] = useState(false);
  const [vis, setVis] = useState<Vis[]>(["hidden", "members", "hidden", "hidden"]);

  // Switching tabs returns the active tab to its root sub-view.
  const switchTab = (t: Tab) => {
    setTab(t);
    setExView("feed");
    setGrView("list");
    setGroupTab("feed");
    setOpenId(null);
    setOpenGroup(null);
  };

  const allListings = [...posted, ...LISTINGS];
  const feed =
    filter === "all" ? allListings : allListings.filter((l) => l.catKey === filter);
  const open = openId ? allListings.find((l) => l.id === openId) ?? null : null;
  const group = openGroup ? GROUPS.find((g) => g.id === openGroup) ?? null : null;

  const rank = (i: number) =>
    setRanked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  const cycleVis = (i: number) =>
    setVis((p) =>
      p.map((v, j) =>
        j === i ? VIS_ORDER[(VIS_ORDER.indexOf(v) + 1) % VIS_ORDER.length] : v,
      ),
    );

  const openThread = open ? threads[open.id] ?? [] : [];
  const sendMsg = () => {
    const text = draft.trim();
    if (!text || !open) return;
    setThreads((p) => ({ ...p, [open.id]: [...(p[open.id] ?? []), { from: "me", text }] }));
    setDraft("");
  };

  const post = () => {
    const title = cTitle.trim();
    if (!title) return;
    const meta = catMeta(cCat);
    const isEvent = cCat === "event";
    const listing: Listing = {
      id: `n${nextId.current++}`,
      catKey: cCat,
      cat: meta.label,
      c: meta.c,
      ttl: title,
      init: "YO",
      by: isEvent ? "You · event" : "You · just now",
      who: "You",
      body: cBody.trim() || "No description added.",
      ...(isEvent
        ? {
            dateLabel: cDate || "Date to be set",
            location: cLoc.trim() || "Location to be set",
            start: cDate || "2026-01-01",
          }
        : {}),
    };
    setPosted((p) => [listing, ...p]);
    setCTitle("");
    setCBody("");
    setCDate("");
    setCLoc("");
    setCCat("need");
    setExView("feed");
    setFilter("all");
  };

  const [capK, capH, capP, capM] = CAPTIONS[tab];

  return (
    <div className="stage">
      <div className="stage-l">
        <div className="vchips">
          {TABS.map((t) => (
            <button
              key={t.v}
              className={`vchip${tab === t.v ? " active" : ""}`}
              onClick={() => switchTab(t.v)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="phone">
          <div className="screen-wrap">
            <div className="appbar">
              <SealMark size={22} clipId="seal-app" />
              <span className="nm">Steppe</span>
              <span className="pv-badge">Preview</span>
              <span className="loc">
                <svg width="9" height="9" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M8 1C5 1 3 3.2 3 6c0 3.6 5 9 5 9s5-5.4 5-9c0-2.8-2-5-5-5z" stroke="#36563D" strokeWidth="1.6" />
                </svg>
                Redmond
              </span>
            </div>

            <div className="body">
              {/* ===== EXCHANGE: FEED ===== */}
              {tab === "exchange" && exView === "feed" && (
                <div className="screen show">
                  <div className="xhead">
                    <span className="xh-t">Exchange</span>
                    <button className="postb" onClick={() => setExView("compose")} aria-label="Post a listing">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      Post
                    </button>
                  </div>
                  <div className="filters" role="group" aria-label="Filter by category">
                    {FILTERS.map((f) => (
                      <button
                        key={f.key}
                        className={`fchip${filter === f.key ? " on" : ""}`}
                        aria-pressed={filter === f.key}
                        onClick={() => setFilter(f.key)}
                      >
                        {f.label}
                      </button>
                    ))}
                    <button className="fchip soon" type="button" disabled>
                      Marketplace · later, by vote
                    </button>
                  </div>
                  {feed.map((l) => (
                    <div
                      key={l.id}
                      className={`erow ${catClass(l.catKey)}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setOpenId(l.id);
                        setExView("detail");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setOpenId(l.id);
                          setExView("detail");
                        }
                      }}
                    >
                      <div className="eav">{l.init}</div>
                      <div>
                        <div className="ecat">
                          <span className="dot"></span>
                          {l.cat}
                        </div>
                        <div className="ettl">{l.ttl}</div>
                        <div className="eby">{l.by}</div>
                      </div>
                      <Chevron />
                    </div>
                  ))}
                  {feed.length === 0 && (
                    <div className="emptyfeed">Nothing in this category yet.</div>
                  )}
                </div>
              )}

              {/* ===== EXCHANGE: DETAIL ===== */}
              {tab === "exchange" && exView === "detail" && open && (
                <div className="detail show" style={{ ["--c"]: open.c } as React.CSSProperties}>
                  <button className="back" onClick={() => setExView("feed")}>
                    <BackArrow />
                    Exchange
                  </button>
                  <div className="d-photo" style={{ background: `color-mix(in srgb, ${open.c} 20%, #FBF7EE)` }}>
                    {open.catKey === "event" ? (
                      <svg width="46" height="46" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <rect x="4" y="5" width="16" height="16" rx="2" stroke="#A8842F" strokeWidth="1.6" />
                        <path d="M4 9h16M8 3v4M16 3v4" stroke="#A8842F" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg width="50" height="50" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                        <path d="M16 27c5 0 9-3.5 9-9 0-3-2-6-5-7 .5 4-2 6-4 6.5 1-3-1-7-4-8.5C16 4 12 6 11 10c-2 1-3 4-3 8 0 5.5 4 9 8 9z" fill="#6E8A5B" opacity=".5" />
                        <path d="M16 27V13" stroke="#36563D" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    )}
                  </div>
                  <div className="d-cat" style={{ color: open.c }}>
                    <span className="dot" style={{ background: open.c }}></span>
                    {open.cat}
                  </div>
                  <div className="d-ttl">{open.ttl}</div>
                  {open.catKey === "event" && open.dateLabel && open.location && (
                    <EventMeta dateLabel={open.dateLabel} location={open.location} />
                  )}
                  <div className="d-body">{open.body}</div>
                  <div className="d-owner">
                    <div className="eav">{open.init}</div>
                    <div className="w">
                      {open.who}
                      <small>{open.catKey === "event" ? "Organizer · Redmond" : "Member · Redmond"}</small>
                    </div>
                  </div>
                  {open.catKey === "event" ? (
                    <div className="d-act">
                      <button
                        className="msgbtn"
                        onClick={() =>
                          downloadIcs({
                            id: open.id,
                            title: open.ttl,
                            location: open.location ?? "",
                            start: open.start ?? "2026-01-01",
                          })
                        }
                      >
                        <CalIcon />
                        Add to your calendar
                      </button>
                      <span className="inside ev-inside">Downloads an .ics calendar file</span>
                    </div>
                  ) : (
                    <div className="d-act">
                      <button className="msgbtn" onClick={() => setExView("message")}>
                        Message {open.who.split(" ")[0]}
                      </button>
                      <span className="inside">Messages stay inside Steppe</span>
                    </div>
                  )}
                </div>
              )}

              {/* ===== EXCHANGE: MESSAGE THREAD ===== */}
              {tab === "exchange" && exView === "message" && open && open.catKey !== "event" && (
                <div className="thread">
                  <div className="thread-head">
                    <button className="back" onClick={() => setExView("detail")}>
                      <BackArrow />
                    </button>
                    <div className="eav" style={{ ["--c"]: open.c } as React.CSSProperties}>
                      {open.init}
                    </div>
                    <div className="thread-who">
                      {open.who}
                      <small>{open.ttl}</small>
                    </div>
                  </div>
                  <div className="msgs">
                    {openThread.length === 0 && (
                      <div className="thread-empty">No messages yet. Say hello.</div>
                    )}
                    {openThread.map((m, i) => (
                      <div key={i} className={`bubble ${m.from === "me" ? "me" : "them"}`}>
                        {m.text}
                      </div>
                    ))}
                    <div className="thread-note">
                      Messages stay inside Steppe. Your email and phone are never
                      shared.
                    </div>
                  </div>
                  <form
                    className="msgbar"
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendMsg();
                    }}
                  >
                    <input
                      type="text"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={`Message ${open.who.split(" ")[0]}…`}
                      aria-label="Message text"
                    />
                    <button className="sendb" type="submit" disabled={!draft.trim()}>
                      Send
                    </button>
                  </form>
                </div>
              )}

              {/* ===== EXCHANGE: COMPOSE ===== */}
              {tab === "exchange" && exView === "compose" && (
                <div className="compose">
                  <button className="back" onClick={() => setExView("feed")}>
                    <BackArrow />
                    Exchange
                  </button>
                  <div className="scr-h">Post to the exchange</div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      post();
                    }}
                  >
                    <label className="clab">Category</label>
                    <div className="catpick" role="group" aria-label="Category">
                      {CATS.map((c) => (
                        <button
                          key={c.key}
                          type="button"
                          className={`catbtn${cCat === c.key ? " on" : ""}`}
                          aria-pressed={cCat === c.key}
                          style={cCat === c.key ? { background: c.c, borderColor: c.c, color: "#FBF7EE" } : { color: c.c, borderColor: c.c }}
                          onClick={() => setCCat(c.key)}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                    <label className="clab" htmlFor="c-title">Title</label>
                    <input
                      id="c-title"
                      type="text"
                      value={cTitle}
                      onChange={(e) => setCTitle(e.target.value)}
                      placeholder="What are you offering or asking for?"
                    />
                    {cCat === "event" && (
                      <>
                        <label className="clab" htmlFor="c-date">Date</label>
                        <input
                          id="c-date"
                          type="date"
                          value={cDate}
                          onChange={(e) => setCDate(e.target.value)}
                        />
                        <label className="clab" htmlFor="c-loc">Location</label>
                        <input
                          id="c-loc"
                          type="text"
                          value={cLoc}
                          onChange={(e) => setCLoc(e.target.value)}
                          placeholder="Where is it?"
                        />
                      </>
                    )}
                    <label className="clab" htmlFor="c-body">Description</label>
                    <textarea
                      id="c-body"
                      value={cBody}
                      onChange={(e) => setCBody(e.target.value)}
                      rows={4}
                      placeholder="Add the details a neighbor would want to know."
                    />
                    <button className="castb" type="submit" disabled={!cTitle.trim()}>
                      Post listing
                    </button>
                  </form>
                </div>
              )}

              {/* ===== GROUPS: LIST ===== */}
              {tab === "groups" && grView === "list" && (
                <div className="screen show">
                  <div className="scr-h">Groups</div>
                  <div className="scr-sub">Join what you like. You can leave any time.</div>
                  {GROUPS.map((g, i) => (
                    <div
                      className="grp"
                      key={g.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setOpenGroup(g.id);
                        setGroupTab("feed");
                        setGrView("detail");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setOpenGroup(g.id);
                          setGroupTab("feed");
                          setGrView("detail");
                        }
                      }}
                    >
                      <div className="gi">{GROUP_ICONS[i]}</div>
                      <div className="gt">
                        <b>{g.name}</b>
                        <span>{g.meta}</span>
                      </div>
                      <button
                        className={`joinb${joined[g.id] ? " joined" : ""}`}
                        aria-pressed={!!joined[g.id]}
                        onClick={(e) => {
                          e.stopPropagation();
                          setJoined((p) => ({ ...p, [g.id]: !p[g.id] }));
                        }}
                      >
                        {joined[g.id] ? "Joined ✓" : "Join"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* ===== GROUPS: DETAIL ===== */}
              {tab === "groups" && grView === "detail" && group && (
                <div className="gdetail">
                  <button className="back" onClick={() => setGrView("list")}>
                    <BackArrow />
                    Groups
                  </button>
                  <div className="gd-name">{group.name}</div>
                  <div className="gd-meta">{group.members} members · Redmond</div>
                  <p className="gd-desc">{group.desc}</p>
                  <button
                    className={`joinb gd-join${joined[group.id] ? " joined" : ""}`}
                    aria-pressed={!!joined[group.id]}
                    onClick={() => setJoined((p) => ({ ...p, [group.id]: !p[group.id] }))}
                  >
                    {joined[group.id] ? "Joined ✓" : "Join group"}
                  </button>

                  <div className="gtabs" role="tablist" aria-label="Group sections">
                    <button
                      className={`gtab${groupTab === "feed" ? " on" : ""}`}
                      role="tab"
                      aria-selected={groupTab === "feed"}
                      onClick={() => setGroupTab("feed")}
                    >
                      Feed
                    </button>
                    <button
                      className={`gtab${groupTab === "events" ? " on" : ""}`}
                      role="tab"
                      aria-selected={groupTab === "events"}
                      onClick={() => setGroupTab("events")}
                    >
                      Events
                    </button>
                  </div>

                  {groupTab === "feed" && (
                    <div className="gfeed">
                      {group.feed.map((p, i) => (
                        <div className="gpost" key={i}>
                          <div className="gp-av">{p.init}</div>
                          <div className="gp-body">
                            <b>{p.author}</b>
                            {p.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {groupTab === "events" && (
                    <div className="gevents">
                      {group.events.map((ev) => (
                        <div className="gevent" key={ev.id}>
                          <div className="gev-ttl">{ev.title}</div>
                          <EventMeta dateLabel={ev.dateLabel} location={ev.location} />
                          <button
                            className="calb"
                            onClick={() =>
                              downloadIcs({
                                id: ev.id,
                                title: ev.title,
                                location: ev.location,
                                start: ev.start,
                              })
                            }
                          >
                            <CalIcon />
                            Add to your calendar
                          </button>
                        </div>
                      ))}
                      {group.events.length === 0 && (
                        <div className="emptyfeed">No upcoming events.</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ===== GOVERN ===== */}
              {tab === "govern" && (
                <div className="screen show">
                  <div className="scr-h">Govern</div>
                  <div className="scr-sub">One open vote right now.</div>
                  <div className="prop">
                    <div className="pc">Proposal 03 · ranked choice</div>
                    <div className="pt">Community Fund — which project this quarter?</div>
                    <div className="pd">
                      Rank the options. Surplus dues fund the top choice the members
                      pick.
                    </div>
                    {OPTIONS.map((opt, i) => {
                      const r = ranked.indexOf(i);
                      return (
                        <div
                          key={opt}
                          className={`opt${r >= 0 ? " sel" : ""}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => rank(i)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              rank(i);
                            }
                          }}
                        >
                          <span className="rk">{r >= 0 ? r + 1 : "—"}</span>
                          {opt}
                        </div>
                      );
                    })}
                    <div className="quorum">
                      <div className="ql">
                        <span>Turnout</span>
                        <span>62% · quorum met</span>
                      </div>
                      <div className="qbar">
                        <i></i>
                      </div>
                    </div>
                    <button
                      className="castb"
                      onClick={() => setVoted(true)}
                      disabled={voted}
                      style={voted ? { opacity: 0.55, pointerEvents: "none" } : undefined}
                    >
                      {voted ? "Ballot cast" : "Cast your ballot"}
                    </button>
                    <div className={`voted${voted ? " show" : ""}`} role="status">
                      <b>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M5 12l4 4 10-10" stroke="#36563D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Ballot recorded, and secret.
                      </b>
                      <p>
                        No one can see how you voted. At launch every member&rsquo;s
                        vote counts the same; members can later vote to weight by
                        tenure.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ===== YOU ===== */}
              {tab === "you" && (
                <div className="screen show">
                  <div className="prof">
                    <div className="pa">YO</div>
                    <div className="ph">
                      <b>You</b>
                      <span>@you · private by default</span>
                    </div>
                  </div>
                  <div className="field">
                    <div className="fk">
                      <b>Username</b>
                      <span>How neighbors find you</span>
                    </div>
                    <span className="locked-field">Always shown</span>
                  </div>
                  {FIELDS.map((f, i) => (
                    <div className="field" key={f.k}>
                      <div className="fk">
                        <b>{f.k}</b>
                        <span>{f.sub}</span>
                      </div>
                      <button className="vis" data-v={vis[i]} onClick={() => cycleVis(i)}>
                        {VIS_LABEL[vis[i]]}
                      </button>
                    </div>
                  ))}
                  <div className="activity">
                    <div className="act-h">Your activity</div>
                    <div className="act-row">
                      <span>Listings posted</span>
                      <b>{posted.length}</b>
                    </div>
                    <div className="act-row">
                      <span>Groups joined</span>
                      <b>{Object.values(joined).filter(Boolean).length}</b>
                    </div>
                    <div className="act-row">
                      <span>Ballots cast</span>
                      <b>{voted ? 1 : 0}</b>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="tabbar">
              {TABS.map((t) => (
                <button
                  key={t.v}
                  className={`tab${tab === t.v ? " active" : ""}`}
                  data-v={t.v}
                  onClick={() => switchTab(t.v)}
                >
                  {TAB_ICONS[t.v]}
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <aside className="caption">
        <div className="ck">
          <span className="dot"></span>
          <span>{capK}</span>
        </div>
        <h2>{capH}</h2>
        <p>{capP}</p>
        <div className="meta">{capM}</div>
      </aside>
    </div>
  );
}
