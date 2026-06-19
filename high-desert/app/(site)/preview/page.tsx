import "./preview.css";
import { RawPage } from "../_components/raw-page";

export const metadata = {
  title: "Steppe — a preview of what we're launching",
  description:
    "A working facsimile of Steppe's first version — browse the local exchange, sit in on a vote, and see how private your profile is by default.",
};

// Verbatim markup + original <script> from _design-source/steppe-preview.html —
// kept AS-IS (every class, inline onclick, and interaction preserved). RawPage
// injects the markup and runs the script in global scope so the inline handlers
// resolve. Styles in ./preview.css.
const HTML = String.raw`
<div class="page">
  <div class="toplight" aria-hidden="true"></div>
  <div class="wrap">
    <div class="layout">

      <!-- INTRO / FRAMING -->
      <div class="intro">
        <div class="brandrow"><span class="mark">Steppe</span><span class="tag">a high desert civic commons</span></div>
        <p class="eyebrow2">A preview</p>
        <h1>What we're launching.</h1>
        <p class="lede">A working facsimile of Steppe's first version — the calm, ad-free commons Redmond members will open on day one. Click around the app to the right: browse the local exchange and reach a neighbor, sit in on a vote, and see how private your profile is by default.</p>
        <div class="callout">
          <strong>This is a preview, not the live app — and it isn't finished.</strong> What you see here is where we <em>begin</em>: the smallest version worth launching. From day one, the members decide what Steppe becomes. Every feature, rule, and number here is theirs to keep, change, or replace by vote — and we'll always be plain about what's built, what's coming, and what's still up for debate.
        </div>
        <div class="introlinks">
          <a href="#">For neighbors — join Steppe <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
          <a href="#">For partners &amp; funders <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
        </div>
      </div>

      <!-- APP FACSIMILE -->
      <div class="stage">
        <div class="app" role="group" aria-label="Steppe app preview">
          <div class="appbar"><span class="b">Steppe</span><span class="pvbadge">Preview</span></div>

          <div class="screens">

            <!-- EXCHANGE -->
            <section class="screen active" id="sc-exchange">
              <h2 class="scrtitle">Local exchange</h2>
              <p class="scrsub">One feed for the whole neighborhood — no algorithm deciding what you see.</p>
              <div class="chips" role="group" aria-label="Filter listings">
                <button class="chip on" data-filter="all" aria-pressed="true" onclick="filterFeed('all',this)">All</button><button class="chip" data-filter="offer" aria-pressed="false" onclick="filterFeed('offer',this)">Offers</button><button class="chip" data-filter="need" aria-pressed="false" onclick="filterFeed('need',this)">Needs</button><button class="chip" data-filter="event" aria-pressed="false" onclick="filterFeed('event',this)">Events</button><button class="chip" data-filter="mutual" aria-pressed="false" onclick="filterFeed('mutual',this)">Mutual aid</button><button class="chip soon" disabled title="A member-gated growth feature — added only if members vote it in">Marketplace · later, by vote</button>
              </div>
              <div class="flist">
                <button class="fc" data-type="offer" onclick="openListing('tomato')"><span class="tag t-offer">Offer</span><h4>Free tomato starts — 40+ plants</h4><p>Grew too many Early Girls this spring. Free to anyone who'll plant them.</p><span class="by"><span class="av">MK</span> Martha K. · 2h ago</span></button>
                <button class="fc" data-type="mutual" onclick="openListing('rides')"><span class="tag t-mutual">Mutual aid</span><h4>Rides to medical appointments</h4><p>Two rides a week for neighbors needing transportation to Bend.</p><span class="by"><span class="av">DL</span> Dana L. · 3h ago</span></button>
                <button class="fc" data-type="need" onclick="openListing('elec')"><span class="tag t-need">Need</span><h4>Electrician who knows older homes</h4><p>Panel upgrade on a 1970s house. Licensed and insured preferred.</p><span class="by"><span class="av">JR</span> James R. · 5h ago</span></button>
                <button class="fc" data-type="offer" onclick="openListing('washer')"><span class="tag t-offer">Offer</span><h4>Pressure washer to borrow</h4><p>Electric pressure washer, free to borrow for a weekend. Just return it clean.</p><span class="by"><span class="av">SP</span> Sam P. · 6h ago</span></button>
                <button class="fc" data-type="need" onclick="openListing('carpool')"><span class="tag t-need">Need</span><h4>Carpool to Bend, mornings</h4><p>Splitting the drive for the 9am class block, Tue/Thu. Happy to trade gas or driving.</p><span class="by"><span class="av">PN</span> Priya N. · 1d ago</span></button>
                <button class="fc" data-type="event" onclick="openListing('event')"><span class="tag t-event">Gathering</span><h4>Member meeting — July</h4><p>Community Fund proposals, governance Q&amp;A, new-member welcome.</p><span class="by"><span class="av">S</span> Steppe · adds to your calendar</span></button>
              </div>
              <p id="feed-empty" style="display:none; text-align:center; color:var(--basalt-soft); font-size:.9rem; padding:18px 0">Nothing in this category yet.</p>
            </section>

            <!-- LISTING DETAIL -->
            <section class="screen" id="sc-listing">
              <button class="back" onclick="showScreen('sc-exchange','exchange')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg> Exchange</button>
              <span class="tag" id="ld-tag">Offer</span>
              <h2 class="scrtitle" id="ld-title">—</h2>
              <p class="ldbody" id="ld-body">—</p>
              <p class="by" style="margin-bottom:18px"><span class="av" id="ld-av">—</span> <span id="ld-by">—</span></p>
              <button class="pill" id="ld-connect" onclick="toggleConnect()">Message <span id="ld-who">—</span></button>
              <div class="connect" id="connect">
                <div class="bubble them" id="cb-them">Hi! Is this still available?</div>
                <div class="bubble me">Yes — come by anytime this week.</div>
                <div class="cinput"><span class="fake">Write a message…</span><button class="send">Send</button></div>
                <p class="cnote">Messages stay inside Steppe — no third party, no ads, nothing sold.</p>
              </div>
            </section>

            <!-- GROUPS -->
            <section class="screen" id="sc-groups">
              <div class="grouphead"><h2 class="scrtitle">Redmond Gardeners</h2><button class="joinbtn" onclick="toggleJoin(this)">Join</button></div>
              <p class="scrsub">A neighborhood group · 48 members</p>
              <div class="avrow"><span class="av">MK</span><span class="av">DL</span><span class="av">JR</span><span class="av" style="background:var(--rust)">+45</span></div>
              <div class="glist">
                <div class="gpost"><div class="gp-h"><span class="av">MK</span> Martha K. · 1d ago</div><p>Seed swap this Saturday at the community garden — bring extras, take what you need.</p></div>
                <div class="gpost"><div class="gp-h"><span class="av">TW</span> Tomas W. · 2d ago</div><p>Anyone have a tiller I could borrow for the weekend? Happy to trade veggies.</p></div>
              </div>
            </section>

            <!-- GOVERN -->
            <section class="screen" id="sc-govern">
              <h2 class="scrtitle">Open vote</h2>
              <p class="scrsub">How the commons makes decisions.</p>
              <div class="prop">
                <h4>Waive booth fees for the winter market</h4>
                <p class="pb">Proposal: drop member booth fees at the indoor winter market to keep local sellers participating through the slow season.</p>
                <div class="meta"><span class="metab">Quorum 15%</span><span class="metab">Closes in 3 days</span><span class="metab">Your vote is secret</span></div>
                <div class="opts" id="opts">
                  <label class="opt"><input type="radio" name="vote"> In favor</label>
                  <label class="opt"><input type="radio" name="vote"> Opposed</label>
                  <label class="opt"><input type="radio" name="vote"> Abstain</label>
                </div>
                <button class="pill" id="castbtn" onclick="castVote()">Cast vote</button>
                <div class="voted" id="voted">Vote recorded. Your ballot is secret — no one, not even staff, can see how you voted. You can change it until the vote closes.</div>
                <p class="flatnote">Flat franchise at launch — every member's vote counts the same. Members can later vote to weight by tenure, if they want to.</p>
              </div>
            </section>

            <!-- PROFILE -->
            <section class="screen" id="sc-profile">
              <div class="phead"><span class="pav">jj</span><div><div class="puser">juniper_jay</div><div class="pdefault">This is all anyone sees by default.</div></div></div>
              <p class="psectitle">What others can see</p>
              <div class="prow"><span class="lab">Display name</span><button class="vis" data-v="hidden" onclick="cycleVis(this)">Hidden</button></div>
              <div class="prow"><span class="lab">Neighborhood</span><button class="vis" data-v="members" onclick="cycleVis(this)">Members</button></div>
              <div class="prow"><span class="lab">Skills &amp; offers</span><button class="vis" data-v="hidden" onclick="cycleVis(this)">Hidden</button></div>
              <div class="prow"><span class="lab">Contact</span><button class="vis" data-v="hidden" onclick="cycleVis(this)">Hidden</button></div>
              <p class="pnote">Verified, but private. Steppe confirms you're a real Redmond neighbor — then shows only what you choose. Tap a setting to cycle Hidden → Members → Everyone.</p>
            </section>

          </div>

          <!-- TABS -->
          <nav class="tabbar">
            <button class="tab active" data-tab="exchange" onclick="showScreen('sc-exchange','exchange')" aria-label="Exchange"><svg viewBox="0 0 24 24"><path d="M3 7h18M3 12h18M3 17h18"/></svg>Exchange</button>
            <button class="tab" data-tab="groups" onclick="showScreen('sc-groups','groups')" aria-label="Groups"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.3"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5M15 19c.3-2 1.6-3.4 3.5-3.4"/></svg>Groups</button>
            <button class="tab" data-tab="govern" onclick="showScreen('sc-govern','govern')" aria-label="Govern"><svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4M12 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/></svg>Govern</button>
            <button class="tab" data-tab="profile" onclick="showScreen('sc-profile','profile')" aria-label="You"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/></svg>You</button>
          </nav>
        </div>
      </div>

    </div>
  </div>
  <p class="footnote">Steppe · a high desert civic commons · Redmond, Oregon. This preview is illustrative — a sketch of the launch experience, not the live application.</p>
</div>

`;

const SCRIPT = String.raw`
  const listings = {
    tomato:{tag:"Offer", cls:"t-offer", title:"Free tomato starts — 40+ plants", body:"Grew too many Early Girls this spring. Free to anyone who'll actually plant them. Pickup near downtown Redmond — bring a box and take what you need.", av:"MK", by:"Martha K. · 2h ago", who:"Martha"},
    elec:{tag:"Need", cls:"t-need", title:"Electrician who knows older homes", body:"Panel upgrade on a 1970s house. Looking for someone licensed and insured who's worked on older Redmond homes. Recommendations welcome too.", av:"JR", by:"James R. · 5h ago", who:"James"},
    event:{tag:"Gathering", cls:"t-event", title:"Member meeting — July", body:"Monthly open meeting: Community Fund proposals, a governance Q&A, and a welcome for new members. Saturday, July 12, 10am. Adds straight to your calendar.", av:"S", by:"Steppe · adds to your calendar", who:"the organizers"},
    rides:{tag:"Mutual aid", cls:"t-mutual", title:"Rides to medical appointments", body:"I can offer two rides a week for neighbors who need transportation to medical appointments in Bend. Flexible on timing — just reach out.", av:"DL", by:"Dana L. · 3h ago", who:"Dana"},
    washer:{tag:"Offer", cls:"t-offer", title:"Pressure washer to borrow", body:"A decent electric pressure washer, free to borrow for a weekend. Just return it clean and let the next neighbor have a turn.", av:"SP", by:"Sam P. · 6h ago", who:"Sam"},
    carpool:{tag:"Need", cls:"t-need", title:"Carpool to Bend, mornings", body:"Looking to split the drive to Bend for the 9am class block, Tuesdays and Thursdays. Happy to trade gas money or alternate driving.", av:"PN", by:"Priya N. · 1d ago", who:"Priya"}
  };

  function showScreen(id, tab){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===tab));
    document.querySelector('.screens').scrollTop = 0;
  }

  function openListing(key){
    const l = listings[key];
    const tagEl = document.getElementById('ld-tag');
    tagEl.textContent = l.tag; tagEl.className = 'tag ' + l.cls;
    document.getElementById('ld-title').textContent = l.title;
    document.getElementById('ld-body').textContent = l.body;
    document.getElementById('ld-av').textContent = l.av;
    document.getElementById('ld-by').textContent = l.by;
    document.getElementById('ld-who').textContent = l.who;
    document.getElementById('connect').classList.remove('open');
    showScreen('sc-listing','exchange');
  }

  function filterFeed(type, btn){
    document.querySelectorAll('#sc-exchange .chip[data-filter]').forEach(c=>{
      const on = c === btn;
      c.classList.toggle('on', on);
      c.setAttribute('aria-pressed', on);
    });
    let shown = 0;
    document.querySelectorAll('#sc-exchange .fc').forEach(card=>{
      const match = (type === 'all' || card.dataset.type === type);
      card.style.display = match ? '' : 'none';
      if (match) shown++;
    });
    document.getElementById('feed-empty').style.display = shown ? 'none' : 'block';
  }

  function toggleConnect(){ document.getElementById('connect').classList.toggle('open'); }

  function toggleJoin(btn){
    const joined = btn.classList.toggle('joined');
    btn.textContent = joined ? 'Joined ✓' : 'Join';
  }

  function castVote(){
    document.getElementById('voted').classList.add('show');
    const b = document.getElementById('castbtn');
    b.textContent = 'Vote recorded';
    b.style.opacity = '.6'; b.style.pointerEvents = 'none';
  }

  const order = ['hidden','members','everyone'];
  const label = {hidden:'Hidden', members:'Members', everyone:'Everyone'};
  function cycleVis(btn){
    const next = order[(order.indexOf(btn.dataset.v)+1)%order.length];
    btn.dataset.v = next; btn.textContent = label[next];
  }
`;

export default function PreviewPage() {
  return <RawPage html={HTML} script={SCRIPT} />;
}
