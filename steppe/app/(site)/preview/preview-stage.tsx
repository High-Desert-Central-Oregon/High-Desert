"use client";

import { useState } from "react";
import { SealMark } from "../_components/seal-mark";

/**
 * Interactive app facsimile for /preview — a faithful, state-driven rebuild of
 * _design-source/steppe-preview-v3.html (inline handlers → React state). The
 * selector chips and the in-phone tab bar both switch screens; switching screens
 * resets the open listing. Exchange → tap a listing → detail → back. Groups join
 * toggles. Govern ranked-choice + cast ballot. You: each field cycles
 * Hidden → Members → Everyone. The side caption updates per screen.
 */
type Screen = "exchange" | "groups" | "govern" | "you";
type Vis = "hidden" | "members" | "everyone";

type Listing = {
  id: string;
  catClass: string;
  cat: string;
  c: string;
  ttl: string;
  init: string;
  by: string;
  who: string;
  body: string;
};

const LISTINGS: Listing[] = [
  {
    id: "0412",
    catClass: "c-offer",
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
    catClass: "c-need",
    cat: "Need",
    c: "#A8542C",
    ttl: "Electrician who knows older homes",
    init: "JR",
    by: "James R. · 5h",
    who: "James R.",
    body: "Panel upgrade on a 1970s house. Licensed and insured, ideally someone who's worked on older Redmond homes. Daytime works best for a walkthrough.",
  },
  {
    id: "0409",
    catClass: "c-gather",
    cat: "Gathering",
    c: "#A8842F",
    ttl: "Member meeting — July 12",
    init: "St",
    by: "Steppe · adds to calendar",
    who: "Steppe",
    body: "Monthly open meeting: Community Fund proposals, governance Q&A, and a new-member welcome. All members invited — it adds to your calendar.",
  },
  {
    id: "0407",
    catClass: "c-aid",
    cat: "Mutual aid",
    c: "#4F6B7A",
    ttl: "Rides to medical appointments",
    init: "DL",
    by: "Dana L. · 3h",
    who: "Dana L.",
    body: "Can offer two rides a week for neighbors needing transportation to Bend. Flexible on timing — reach out and we'll coordinate.",
  },
];

const CAPTIONS: Record<Screen, [string, string, string, string]> = {
  exchange: [
    "The exchange",
    "One calm feed.",
    "Needs, offers, gatherings, and mutual aid in a single place — no algorithm deciding what you see. Tap any entry to open it and reach the neighbor directly.",
    "No ads · no tracking · messages stay inside Steppe",
  ],
  groups: [
    "Groups",
    "The circles you choose.",
    "Neighborhood and interest groups you opt into — and leave whenever you want. Each group decides its own messaging.",
    "You control which groups can message you",
  ],
  govern: [
    "Govern",
    "Your vote, in private.",
    "Vote on the rules, the budget, and where Steppe goes next. Your ballot is secret, and at launch everyone's vote counts the same.",
    "15% quorum · secret ballot · reversible by vote",
  ],
  you: [
    "You",
    "Private until you say so.",
    "Your profile starts private. Reveal each field to no one, to members, or to everyone — field by field, your call.",
    "Username always shown · everything else your choice",
  ],
};

const GROUPS = [
  { name: "Dry Canyon Trail Stewards", meta: "214 members · weekly" },
  { name: "SE Redmond Neighbors", meta: "389 members · daily" },
  { name: "Tool Library", meta: "96 members · lending" },
];

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

const VIS_ORDER: Vis[] = ["hidden", "members", "everyone"];
const VIS_LABEL: Record<Vis, string> = {
  hidden: "Hidden",
  members: "Members",
  everyone: "Everyone",
};

const Chevron = () => (
  <svg className="echev" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

const TAB_ICONS: Record<Screen, React.ReactNode> = {
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

const TABS: { v: Screen; label: string }[] = [
  { v: "exchange", label: "Exchange" },
  { v: "groups", label: "Groups" },
  { v: "govern", label: "Govern" },
  { v: "you", label: "You" },
];

export function PreviewStage() {
  const [screen, setScreen] = useState<Screen>("exchange");
  const [openId, setOpenId] = useState<string | null>(null);
  const [joined, setJoined] = useState<boolean[]>([true, false, false]);
  const [ranked, setRanked] = useState<number[]>([]);
  const [voted, setVoted] = useState(false);
  const [vis, setVis] = useState<Vis[]>(["hidden", "members", "hidden", "hidden"]);

  // Switching screens always resets the open listing detail.
  const switchScreen = (v: Screen) => {
    setScreen(v);
    setOpenId(null);
  };

  const rank = (i: number) =>
    setRanked((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i],
    );

  const cycleVis = (i: number) =>
    setVis((prev) =>
      prev.map((v, j) =>
        j === i ? VIS_ORDER[(VIS_ORDER.indexOf(v) + 1) % 3] : v,
      ),
    );

  const open = openId ? LISTINGS.find((l) => l.id === openId) ?? null : null;
  const showExchange = screen === "exchange" && !open;
  const showDetail = screen === "exchange" && !!open;
  const [capK, capH, capP, capM] = CAPTIONS[screen];

  return (
    <div className="stage">
      <div className="stage-l">
        <div className="vchips">
          {TABS.map((t) => (
            <button
              key={t.v}
              className={`vchip${screen === t.v ? " active" : ""}`}
              onClick={() => switchScreen(t.v)}
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
              {/* EXCHANGE */}
              <div className={`screen${showExchange ? " show" : ""}`}>
                <div className="filters">
                  <button className="fchip on">All</button>
                  <button className="fchip">Offers</button>
                  <button className="fchip">Needs</button>
                  <button className="fchip">Gatherings</button>
                  <button className="fchip soon" type="button" disabled>
                    Marketplace · later, by vote
                  </button>
                </div>
                {LISTINGS.map((l) => (
                  <div
                    key={l.id}
                    className={`erow ${l.catClass}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenId(l.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpenId(l.id);
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
              </div>

              {/* LISTING DETAIL */}
              <div
                className={`detail${showDetail ? " show" : ""}`}
                style={open ? ({ ["--c"]: open.c } as React.CSSProperties) : undefined}
              >
                {open && (
                  <>
                    <button className="back" onClick={() => setOpenId(null)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Exchange
                    </button>
                    <div
                      className="d-photo"
                      style={{ background: `color-mix(in srgb, ${open.c} 20%, #FBF7EE)` }}
                    >
                      <svg width="50" height="50" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                        <path d="M16 27c5 0 9-3.5 9-9 0-3-2-6-5-7 .5 4-2 6-4 6.5 1-3-1-7-4-8.5C16 4 12 6 11 10c-2 1-3 4-3 8 0 5.5 4 9 8 9z" fill="#6E8A5B" opacity=".5" />
                        <path d="M16 27V13" stroke="#36563D" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="d-cat" style={{ color: open.c }}>
                      <span className="dot" style={{ background: open.c }}></span>
                      {open.cat}
                    </div>
                    <div className="d-ttl">{open.ttl}</div>
                    <div className="d-body">{open.body}</div>
                    <div className="d-owner">
                      <div className="eav">{open.init}</div>
                      <div className="w">
                        {open.who}
                        <small>Member · Redmond</small>
                      </div>
                    </div>
                    <div className="d-act">
                      <button className="msgbtn">Message {open.who.split(" ")[0]}</button>
                      <span className="inside">Messages stay inside Steppe</span>
                    </div>
                  </>
                )}
              </div>

              {/* GROUPS */}
              <div className={`screen${screen === "groups" ? " show" : ""}`}>
                <div className="scr-h">Groups</div>
                <div className="scr-sub">Join what you like. You can leave any time.</div>
                {GROUPS.map((g, i) => (
                  <div className="grp" key={g.name}>
                    <div className="gi">{GROUP_ICONS[i]}</div>
                    <div className="gt">
                      <b>{g.name}</b>
                      <span>{g.meta}</span>
                    </div>
                    <button
                      className={`joinb${joined[i] ? " joined" : ""}`}
                      onClick={() =>
                        setJoined((prev) => prev.map((j, k) => (k === i ? !j : j)))
                      }
                    >
                      {joined[i] ? "Joined ✓" : "Join"}
                    </button>
                  </div>
                ))}
              </div>

              {/* GOVERN */}
              <div className={`screen${screen === "govern" ? " show" : ""}`}>
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
                      Ballot recorded — and secret.
                    </b>
                    <p>
                      No one can see how you voted. At launch every member&rsquo;s
                      vote counts the same; members can later vote to weight by
                      tenure.
                    </p>
                  </div>
                </div>
              </div>

              {/* YOU */}
              <div className={`screen${screen === "you" ? " show" : ""}`}>
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
                    <button
                      className="vis"
                      data-v={vis[i]}
                      onClick={() => cycleVis(i)}
                    >
                      {VIS_LABEL[vis[i]]}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="tabbar">
              {TABS.map((t) => (
                <button
                  key={t.v}
                  className={`tab${screen === t.v ? " active" : ""}`}
                  data-v={t.v}
                  onClick={() => switchScreen(t.v)}
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
