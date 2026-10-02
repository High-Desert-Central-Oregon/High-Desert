import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/600.css";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  GroupContactForm,
  GroupRulesForm,
} from "../../../app/protected/account/messaging/consent-forms";
import { RequestControls } from "../../../app/protected/messages/request-controls";
import { ProfileForm } from "../../../app/protected/account/profile/profile-form";
import { RsvpForm } from "../../../app/protected/events/[id]/rsvp-form";
import { EventForm } from "../../../app/protected/events/new/event-form";
import { PostForm } from "../../../app/protected/exchange/new/post-form";
import { DeleteEvent } from "../../../app/protected/events/[id]/delete-event";
import { DeletePost } from "../../../app/protected/exchange/[id]/delete-post";
import { AddToCalendar } from "../../../app/protected/events/[id]/add-to-calendar";
import { en } from "../../../lib/i18n/dictionaries/en";
import { es } from "../../../lib/i18n/dictionaries/es";
import { setFailure } from "./actions";
import { AuthNotice } from "../../../components/member-pipelines/auth-notice";
import { NeighborhoodForm } from "../../../app/protected/neighborhoods/neighborhood-form";
import catalog from "../../../scripts/maps/source-labels.json";
import { subdivisionCatalog } from "../../../lib/subdivision-outlines";
import { getSavedNeighborhood } from "./actions";
import "../../../app/globals.css";
function App() {
  useEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      new URLSearchParams(location.search).get("theme") === "night",
    );
  }, []);
  const [screen, setScreen] = useState(
      new URLSearchParams(location.search).get("screen") ?? "events",
    ),
    [lang, setLang] = useState("en"),
    [writes, setWrites] = useState(0);
  const [visibility, setVisibility] = useState<"hidden" | "members">("hidden"),
    [rsvp, setRsvp] = useState<"going" | "maybe" | null>(null);
  const [lastDecision, setLastDecision] = useState("");
  const [failCopy, setFailCopy] = useState(false);
  const [copiedText, setCopiedText] = useState("");
  useEffect(() => {
    const clipboard = navigator.clipboard;
    if (!clipboard) return;
    const writeText = clipboard.writeText.bind(clipboard);
    clipboard.writeText = async (text) => {
      if (failCopy) throw new Error("Fixture clipboard failure");
      await writeText(text);
      setCopiedText(text);
    };
    return () => {
      clipboard.writeText = writeText;
    };
  }, [failCopy]);
  const dict = lang === "en" ? en : es;
  useEffect(() => {
    const listener = (e: Event) => {
      const d = (e as CustomEvent).detail;
      setWrites((n) => n + 1);
      setLastDecision(d.response ?? (d.disable === "1" ? "disabled" : "saved"));
      if (d.kind === "visibility") setVisibility(d.visibility);
      if (d.kind === "rsvp") setRsvp(d.status);
      if (d.kind === "cancel") setRsvp(null);
    };
    window.addEventListener("fixture-save", listener);
    return () => window.removeEventListener("fixture-save", listener);
  }, []);
  return (
    <main lang={lang} className="mx-auto max-w-2xl p-5">
      <h1>Member usability fixture</h1>
      <p>Real components, synthetic records, local actions.</p>
      <label>
        Screen{" "}
        <select value={screen} onChange={(e) => setScreen(e.target.value)}>
          {[
            "group-contact",
            "group-rules",
            "message-request",
            "events",
            "edit-event",
            "profile",
            "rsvp",
            "posts",
            "edit",
            "calendar",
            "auth-error",
            "neighborhoods",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>{" "}
      <label>
        Language{" "}
        <select value={lang} onChange={(e) => setLang(e.target.value)}>
          <option>en</option>
          <option>es</option>
        </select>
      </label>{" "}
      <label>
        <input type="checkbox" onChange={(e) => setFailure(e.target.checked)} />{" "}
        Fail saves
      </label>
      <p id="writes">Successful writes: {writes}</p>
      {lastDecision &&
        ["group-contact", "group-rules", "message-request"].includes(
          screen,
        ) && <p>Last successful action: {lastDecision}</p>}
      <hr className="my-5" />
      <div key={screen + lang}>
        {screen === "group-contact" && (
          <GroupContactForm
            groupId="11111111-1111-4111-8111-111111111111"
            rules={
              new URLSearchParams(location.search).has("rules-off")
                ? null
                : "Contact members about this group, be respectful, and avoid unsolicited promotion."
            }
            version={2}
            acknowledgedVersion={
              new URLSearchParams(location.search).has("stale") ? 1 : null
            }
            allow={new URLSearchParams(location.search).has("stale")}
            locale={lang === "es" ? "es" : "en"}
          />
        )}
        {screen === "group-rules" && (
          <GroupRulesForm
            groupId="11111111-1111-4111-8111-111111111111"
            rules={null}
            locale={lang === "es" ? "es" : "en"}
          />
        )}
        {screen === "message-request" && (
          <RequestControls
            threadId="11111111-1111-4111-8111-111111111111"
            locale={lang === "es" ? "es" : "en"}
          />
        )}
        {screen === "neighborhoods" && <NeighborhoodFixture dict={dict} />}
        {screen === "auth-error" && (
          <AuthNotice
            locale={lang}
            issue={
              new URLSearchParams(location.search).get("issue") ?? "provider"
            }
          />
        )}
        {screen === "events" && (
          <EventForm
            dict={dict}
            neighborhoods={[]}
            defaultNeighborhoodId={null}
          />
        )}
        {screen === "profile" && (
          <ProfileForm
            displayName="Test neighbor"
            dict={dict}
            fields={[
              {
                field: "neighborhood_visibility",
                label: "Neighborhood",
                value: "Sample neighborhood",
                visibility,
              },
            ]}
          />
        )}
        {screen === "rsvp" && (
          <RsvpForm
            eventId="sample"
            dict={dict}
            initialStatus={rsvp}
            initialBringing={null}
          />
        )}
        {screen === "posts" && <PostForm dict={dict} neighborhoods={[]} />}
        {screen === "edit" && (
          <>
            <PostForm
              dict={dict}
              neighborhoods={[]}
              initial={{
                id: "sample",
                title: "Sample tools",
                body: "Lend a shovel",
                category: "offer",
                tags: ["offer", "goods"],
                neighborhood_id: null,
                allow_messages:
                  new URLSearchParams(location.search).get("post-messages") ===
                  "on",
              }}
            />
            <DeletePost id="sample" dict={dict} />
          </>
        )}
        {screen === "edit-event" && (
          <>
            <EventForm
              dict={dict}
              neighborhoods={[]}
              defaultNeighborhoodId={null}
              initial={{
                id: "sample",
                title: "Park gathering",
                body: "Bring a blanket.",
                starts_at: "2026-07-16T01:00:00Z",
                ends_at: "2026-07-16T02:00:00Z",
                location: "Sample Park, 12 Main Street",
                capacity: 20,
                neighborhood_id: null,
              }}
            />
            <DeleteEvent id="sample" dict={dict} />
          </>
        )}
        {screen === "calendar" && (
          <>
            <label>
              <input
                type="checkbox"
                checked={failCopy}
                onChange={(event) => setFailCopy(event.target.checked)}
              />{" "}
              Fail clipboard
            </label>
            <label className="block">
              Last copied text
              <textarea
                readOnly
                value={copiedText}
                className="block w-full border"
              />
            </label>
            <AddToCalendar
              eventId="sample"
              title="Park gathering"
              startsAt="2026-07-16T01:00:00Z"
              endsAt="2026-07-16T02:00:00Z"
              location="Sample Park, 12 Main Street"
              body="Bring a blanket."
              locale={lang}
              labels={{
                button: dict.events.addCal,
                note: dict.events.icsNote,
                description: dict.events.icsDescription,
                copy: dict.events.copyDetails,
                copied: dict.events.copied,
                copyFailed: dict.events.copyFailed,
                copyField: dict.events.copyField,
                fieldCopied: dict.events.fieldCopied,
              }}
            />
          </>
        )}
      </div>
    </main>
  );
}
function NeighborhoodFixture({ dict }: { dict: typeof en }) {
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  return (
    <>
      <button
        onClick={() => {
          setCurrentId(getSavedNeighborhood());
          setRevision((n) => n + 1);
        }}
      >
        Reload saved profile
      </button>
      <NeighborhoodForm
        key={revision}
        currentId={currentId}
        neighborhoods={[
          ...catalog.map((row) => ({
            id: row.slug === "braydon-park" ? "braydon" : row.slug,
            name: row.name,
          })),
          ...subdivisionCatalog.neighborhoods
            .filter(
              (row) =>
                !catalog.some((old) => old.name === row.name) &&
                ![
                  "Cinder Butte Village",
                  "Eagle Crest",
                  "Rimrock West Estate",
                  "Village at Ridgeview",
                ].includes(row.name),
            )
            .map((row) => ({ id: row.slug, name: row.name })),
          { id: "cinder", name: "Cinder Butte Village" },
          { id: "eagle", name: "Eagle Crest" },
          { id: "rimrock-west", name: "Rimrock West Estate" },
          { id: "ridgeview", name: "Village at Ridgeview" },
        ].sort((a, b) => a.name.localeCompare(b.name))}
        dict={dict}
      />
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
