import "./landing.css";
import { RawPage } from "./_components/raw-page";

export const metadata = {
  title: "Steppe — a high desert civic commons",
  description:
    "Steppe is verified, ad-free, member-owned civic infrastructure for the people of Redmond, Oregon.",
};

// Verbatim markup + original EN/ES toggle script from
// _design-source/steppe-landing.html — see RawPage. Styles in ./landing.css.
const HTML = String.raw`
  <section class="hero">
    <div class="scene" aria-hidden="true">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="var(--sky-high)"/>
            <stop offset="55%" stop-color="var(--sky-mid)"/>
            <stop offset="100%" stop-color="var(--sky-low)"/>
          </linearGradient>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stop-color="#F6E2C0"/><stop offset="100%" stop-color="#F6E2C0" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#E4DCCB" stop-opacity="0"/>
            <stop offset="100%" stop-color="#E7DECC" stop-opacity=".82"/>
          </linearGradient>
          <!-- irregular juniper silhouette -->
          <g id="pine"><path d="M24 2 L31 20 L27 20 L36 38 L31 38 L43 58 L27 58 L27 66 L21 66 L21 58 L5 58 L17 38 L12 38 L21 20 L17 20 Z" fill="var(--juniper)"/></g>
        </defs>

        <rect x="0" y="0" width="1440" height="900" fill="url(#sky)"/>
        <circle class="l-sun" cx="1180" cy="210" r="260" fill="url(#glow)"/>

        <!-- far range: hazed back, gives the horizon depth -->
        <path class="l-far" d="M0 470 L160 410 L300 452 L470 388 L640 452 L820 404 L1010 456 L1200 402 L1380 452 L1440 432 L1440 480 L0 480 Z"
              fill="#9BA697" opacity=".34"/>

        <!-- main range: the Three Sisters -->
        <g class="l-peaks">
          <path d="M560 474 L700 360 L760 300 L842 384 L900 330 L980 250 L1082 362 L1180 320 L1290 474 Z" fill="#7C8A7E" opacity=".55"/>
          <path d="M946 286 L980 250 L1016 286 L996 298 L980 290 L964 298 Z" fill="var(--snow)" opacity=".85"/>
          <path d="M730 332 L760 300 L792 334 L772 344 L760 338 L746 344 Z" fill="var(--snow)" opacity=".8"/>
        </g>

        <!-- valley haze washes out the peak bases -->
        <rect x="0" y="356" width="1440" height="150" fill="url(#haze)"/>

        <!-- single soft ridge -->
        <path class="l-ridge" d="M0 560 C220 548 360 556 560 520 C780 484 1000 502 1240 474 C1330 464 1390 470 1440 466 L1440 900 L0 900 Z"
              fill="var(--sage)" opacity=".48"/>

        <!-- juniper ground + irregular treeline, weighted right of the copy -->
        <path class="l-trees" d="M0 650 C240 642 420 650 620 641 C820 632 1000 651 1240 637 C1330 631 1390 641 1440 635 L1440 900 L0 900 Z"
              fill="var(--juniper)" opacity=".96"/>
        <g class="l-trees">
          <use href="#pine" transform="translate(622,563) scale(1.1)"/>
          <use href="#pine" transform="translate(683,583) scale(.8)"/>
          <use href="#pine" transform="translate(861,550) scale(1.3)"/>
          <use href="#pine" transform="translate(926,580) scale(.85)"/>
          <use href="#pine" transform="translate(1152,560) scale(1.15)"/>
          <use href="#pine" transform="translate(1213,583) scale(.8)"/>
          <use href="#pine" transform="translate(1337,557) scale(1.2)"/>
          <use href="#pine" transform="translate(1394,582) scale(.82)"/>
        </g>

        <!-- foreground: rust seam + two warm bands (one fewer stripe than before) -->
        <path d="M0 700 C360 690 760 712 1120 698 C1280 692 1380 707 1440 698 L1440 716 L0 716 Z" fill="var(--rust)" opacity=".15"/>
        <path d="M0 716 C340 705 720 732 1100 716 C1280 708 1380 726 1440 716 L1440 824 L0 824 Z" fill="var(--bone-deep)"/>
        <path d="M0 824 C400 815 820 838 1200 823 C1320 818 1400 833 1440 826 L1440 900 L0 900 Z" fill="var(--bone)"/>

        <g class="l-contour" fill="none" stroke="var(--juniper-line)" stroke-opacity=".14" stroke-width="1.4">
          <path d="M-80 748 C240 736 560 760 880 748 C1140 738 1360 758 1600 748"/>
          <path d="M-80 800 C260 788 620 812 980 798 C1200 790 1400 808 1600 798"/>
          <path d="M-80 852 C320 840 740 864 1140 850 C1320 844 1460 860 1600 852"/>
        </g>
      </svg>
    </div>
    <div class="lightwash" aria-hidden="true"></div>
    <div class="scrim" aria-hidden="true"></div>

    <div class="topbar">
      <div class="lang" role="group" aria-label="Language">
        <button id="en" aria-pressed="true">English</button>
        <button id="es" aria-pressed="false">Español</button>
      </div>
    </div>

    <div class="heromain">
      <div class="copy">
        <p class="eyebrow" data-i18n="place">Redmond, Oregon</p>
        <h1 class="headline" data-i18n="headline">A neighborhood you can trust.</h1>
        <p class="lede" data-i18n="lede">Steppe is verified, ad-free, member-owned civic infrastructure for the people of Redmond. No ads. No tracking. Your data stays yours.</p>
        <a class="cta" href="/join">
          <span data-i18n="cta">Sign in or join</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
      </div>
    </div>
  </section>

  <section class="promises">
    <h2 class="ptitle" data-i18n="promiseTitle">What we promise</h2>
    <div class="pgrid">
      <div class="pcard"><span class="ck" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#36503E" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span><p data-i18n="p1">No advertising, ever — you are the member, not the product.</p></div>
      <div class="pcard"><span class="ck" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#36503E" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span><p data-i18n="p2">We verify your residency, then forget the documents.</p></div>
      <div class="pcard"><span class="ck" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#36503E" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span><p data-i18n="p3">Members govern this place, and your vote is secret.</p></div>
      <div class="pcard"><span class="ck" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#36503E" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span><p data-i18n="p4">Your data is yours: export it, and leave with it any time.</p></div>
    </div>
  </section>

  <section class="how">
    <p class="eyebrow2" data-i18n="howEy">Joining</p>
    <h2 class="stitle" data-i18n="howTitle">From neighbor to member</h2>
    <ol class="steps">
      <li class="step"><span class="snum">1</span><h3 data-i18n="s1t">Verify you're local</h3><p data-i18n="s1b">Confirm you live in the Redmond area — real neighbors, no anonymous accounts, no bots. We check, then forget the documents.</p></li>
      <li class="step"><span class="snum">2</span><h3 data-i18n="s2t">Join for $4 a month</h3><p data-i18n="s2b">That's the whole membership. Pay yearly or by bank transfer. Can't swing it right now? A hardship waiver is yours, no questions asked.</p></li>
      <li class="step"><span class="snum">3</span><h3 data-i18n="s3t">Settle in</h3><p data-i18n="s3b">Join groups, post to the local exchange, find help and offer it, and talk with the people who live around you.</p></li>
      <li class="step"><span class="snum">4</span><h3 data-i18n="s4t">Help steer it</h3><p data-i18n="s4b">Vote on the rules, the budget, and where Steppe goes next. Your vote is secret, and it counts the same as everyone's.</p></li>
    </ol>
  </section>

  <section class="exchange">
    <p class="eyebrow2" data-i18n="exEy">What neighbors share</p>
    <h2 class="stitle" data-i18n="exTitle">One local exchange</h2>
    <p class="ssub" data-i18n="exSub">A need, an offer, a job, goods, mutual aid, a gathering — one calm feed, with no algorithm deciding what you see.</p>
    <div class="lgrid">
      <div class="lcard"><span class="ltag t-offer" data-i18n="lc1tag">Offer</span><h3 data-i18n="lc1t">Free tomato starts — 40+ plants</h3><p data-i18n="lc1b">Grew too many Early Girls this spring. Free to anyone who'll plant them. Pickup near downtown.</p><div class="lby"><span class="lav">MK</span><span data-i18n="lc1by">Martha K. · 2h ago</span></div></div>
      <div class="lcard"><span class="ltag t-need" data-i18n="lc2tag">Need</span><h3 data-i18n="lc2t">Electrician who knows older homes</h3><p data-i18n="lc2b">Panel upgrade on a 1970s house. Looking for someone licensed and insured who's worked on older Redmond homes.</p><div class="lby"><span class="lav">JR</span><span data-i18n="lc2by">James R. · 5h ago</span></div></div>
      <div class="lcard"><span class="ltag t-event" data-i18n="lc3tag">Gathering</span><h3 data-i18n="lc3t">Member meeting — July</h3><p data-i18n="lc3b">Monthly open meeting: Community Fund proposals, governance Q&amp;A, new-member welcome. Sat July 12.</p><div class="lby"><span class="lav">S</span><span data-i18n="lc3by">Steppe · adds to your calendar</span></div></div>
      <div class="lcard"><span class="ltag t-mutual" data-i18n="lc4tag">Mutual aid</span><h3 data-i18n="lc4t">Rides to medical appointments</h3><p data-i18n="lc4b">Can offer two rides a week for neighbors needing transportation to Bend. Flexible on timing.</p><div class="lby"><span class="lav">DL</span><span data-i18n="lc4by">Dana L. · 3h ago</span></div></div>
    </div>
  </section>

  <section class="govstrip">
    <p class="eyebrow2" data-i18n="govEy">Governed by its members</p>
    <h2 data-i18n="govTitle">Built so it can't be sold out from under you.</h2>
    <p data-i18n="govBody">Steppe is an Oregon public benefit nonprofit. No owner, no investors, nothing to sell. The members govern it — and the promises above are written into its founding documents, where they can only change by a vote of the members themselves.</p>
  </section>

  <section class="join">
    <h2 data-i18n="joinTitle">Your seat is open.</h2>
    <p data-i18n="joinSub">Join your neighbors in a place that belongs to all of you.</p>
    <a class="cta" href="/join"><span data-i18n="joinCta">Sign in or join</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
  </section>

`;

const SCRIPT = String.raw`
  const dict = {
    en:{ tagline:"a high desert civic commons", place:"Redmond, Oregon",
      headline:"A neighborhood you can trust.",
      lede:"Steppe is verified, ad-free, member-owned civic infrastructure for the people of Redmond. No ads. No tracking. Your data stays yours.",
      cta:"Sign in or join", promiseTitle:"What we promise",
      p1:"No advertising, ever — you are the member, not the product.",
      p2:"We verify your residency, then forget the documents.",
      p3:"Members govern this place, and your vote is secret.",
      p4:"Your data is yours: export it, and leave with it any time.",
      howEy:"Joining", howTitle:"From neighbor to member",
      s1t:"Verify you're local", s1b:"Confirm you live in the Redmond area — real neighbors, no anonymous accounts, no bots. We check, then forget the documents.",
      s2t:"Join for $4 a month", s2b:"That's the whole membership. Pay yearly or by bank transfer. Can't swing it right now? A hardship waiver is yours, no questions asked.",
      s3t:"Settle in", s3b:"Join groups, post to the local exchange, find help and offer it, and talk with the people who live around you.",
      s4t:"Help steer it", s4b:"Vote on the rules, the budget, and where Steppe goes next. Your vote is secret, and it counts the same as everyone's.",
      exEy:"What neighbors share", exTitle:"One local exchange",
      exSub:"A need, an offer, a job, goods, mutual aid, a gathering — one calm feed, with no algorithm deciding what you see.",
      lc1tag:"Offer", lc1t:"Free tomato starts — 40+ plants", lc1b:"Grew too many Early Girls this spring. Free to anyone who'll plant them. Pickup near downtown.", lc1by:"Martha K. · 2h ago",
      lc2tag:"Need", lc2t:"Electrician who knows older homes", lc2b:"Panel upgrade on a 1970s house. Looking for someone licensed and insured who's worked on older Redmond homes.", lc2by:"James R. · 5h ago",
      lc3tag:"Gathering", lc3t:"Member meeting — July", lc3b:"Monthly open meeting: Community Fund proposals, governance Q&A, new-member welcome. Sat July 12.", lc3by:"Steppe · adds to your calendar",
      lc4tag:"Mutual aid", lc4t:"Rides to medical appointments", lc4b:"Can offer two rides a week for neighbors needing transportation to Bend. Flexible on timing.", lc4by:"Dana L. · 3h ago",
      govEy:"Governed by its members", govTitle:"Built so it can't be sold out from under you.",
      govBody:"Steppe is an Oregon public benefit nonprofit. No owner, no investors, nothing to sell. The members govern it — and the promises above are written into its founding documents, where they can only change by a vote of the members themselves.",
      joinTitle:"Your seat is open.", joinSub:"Join your neighbors in a place that belongs to all of you.", joinCta:"Sign in or join",
      foot:"Steppe · Redmond, Oregon" },
    es:{ tagline:"un bien común cívico del alto desierto", place:"Redmond, Oregón",
      headline:"Un vecindario en el que puedes confiar.",
      lede:"Steppe es infraestructura cívica verificada, sin anuncios y de propiedad de sus miembros, para la gente de Redmond. Sin anuncios. Sin rastreo. Tus datos son tuyos.",
      cta:"Inicia sesión o únete", promiseTitle:"Lo que prometemos",
      p1:"Sin publicidad, nunca: tú eres el miembro, no el producto.",
      p2:"Verificamos tu residencia y luego olvidamos los documentos.",
      p3:"Los miembros gobiernan este lugar, y tu voto es secreto.",
      p4:"Tus datos son tuyos: expórtalos y llévatelos cuando quieras.",
      howEy:"Cómo unirse", howTitle:"De vecino a miembro",
      s1t:"Verifica que eres local", s1b:"Confirma que vives en el área de Redmond: vecinos reales, sin cuentas anónimas, sin bots. Verificamos y luego olvidamos los documentos.",
      s2t:"Únete por $4 al mes", s2b:"Esa es toda la membresía. Paga al año o por transferencia bancaria. ¿No puedes ahora mismo? La exención por dificultad es tuya, sin preguntas.",
      s3t:"Acomódate", s3b:"Únete a grupos, publica en el intercambio local, encuentra y ofrece ayuda, y habla con quienes viven a tu alrededor.",
      s4t:"Ayuda a dirigirlo", s4b:"Vota sobre las reglas, el presupuesto y el rumbo de Steppe. Tu voto es secreto y vale igual que el de todos.",
      exEy:"Lo que comparten los vecinos", exTitle:"Un intercambio local",
      exSub:"Una necesidad, una oferta, un trabajo, bienes, ayuda mutua, una reunión: un solo espacio tranquilo, sin un algoritmo decidiendo lo que ves.",
      lc1tag:"Ofrece", lc1t:"Plántulas de tomate gratis — más de 40", lc1b:"Sembré demasiadas esta primavera. Gratis para quien las plante. Recogida cerca del centro.", lc1by:"Martha K. · hace 2h",
      lc2tag:"Necesita", lc2t:"Electricista que conozca casas antiguas", lc2b:"Mejora del panel en una casa de los años 70. Busco a alguien con licencia y seguro, con experiencia en casas antiguas de Redmond.", lc2by:"James R. · hace 5h",
      lc3tag:"Reunión", lc3t:"Reunión de miembros — julio", lc3b:"Reunión abierta mensual: propuestas del Fondo Comunitario, preguntas sobre gobernanza, bienvenida a nuevos miembros. Sáb 12 de julio.", lc3by:"Steppe · se añade a tu calendario",
      lc4tag:"Ayuda mutua", lc4t:"Viajes a citas médicas", lc4b:"Puedo ofrecer dos viajes por semana para vecinos que necesiten transporte a Bend. Horario flexible.", lc4by:"Dana L. · hace 3h",
      govEy:"Gobernado por sus miembros", govTitle:"Hecho para que no te lo puedan vender.",
      govBody:"Steppe es una organización sin fines de lucro de beneficio público de Oregón. Sin dueño, sin inversionistas, nada que vender. Los miembros la gobiernan, y las promesas de arriba están escritas en sus documentos fundacionales, donde solo pueden cambiar por el voto de los propios miembros.",
      joinTitle:"Tu lugar está abierto.", joinSub:"Únete a tus vecinos en un lugar que les pertenece a todos.", joinCta:"Inicia sesión o únete",
      foot:"Steppe · Redmond, Oregón" }
  };
  function setLang(l){
    document.documentElement.lang = l;
    document.querySelectorAll("[data-i18n]").forEach(el=>{ const k=el.getAttribute("data-i18n"); if(dict[l][k]) el.textContent=dict[l][k]; });
    en.setAttribute("aria-pressed", l==="en"); es.setAttribute("aria-pressed", l==="es");
  }
  en.addEventListener("click",()=>setLang("en"));
  es.addEventListener("click",()=>setLang("es"));
`;

export default function LandingPage() {
  return <RawPage html={HTML} script={SCRIPT} />;
}
