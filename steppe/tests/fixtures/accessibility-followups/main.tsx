/** Steppe — isolated accessibility regression fixture.
 * Copyright (C) 2026 Steppe
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { PostForm } from "../../../app/protected/exchange/new/post-form";
import { EventForm } from "../../../app/protected/events/new/event-form";
import { CreateGroupForm } from "../../../app/protected/groups/new/create-group-form";
import { SettingsForm } from "../../../app/protected/groups/[slug]/manage/settings-form";
import { ProposalForm } from "../../../app/protected/governance/new/proposal-form";
import { ReviewControls } from "../../../app/protected/review/[id]/review-controls";
import { ThreadMenu } from "../../../app/protected/messages/[id]/thread-menu";
import { MonthView } from "../../../components/broadsheet/month-view";
import { PostRow } from "../../../components/broadsheet/post-row";
import { en } from "../../../lib/i18n/dictionaries/en";
import { es } from "../../../lib/i18n/dictionaries/es";
import { setOutcome } from "./actions";
import "../../../app/globals.css";

function App() {
  const [mode, setMode] = useState("events");
  const [lang, setLang] = useState<"en" | "es">("en");
  const dict = lang === "en" ? en : es;
  return (
    <main
      className="mx-auto max-w-[var(--content-max)] p-[var(--pad-screen)]"
      lang={lang}
    >
      <h1>Accessibility follow-up fixture</h1>
      <p>
        Real components, synthetic records, inert actions. No production writes.
      </p>
      <label>
        Screen{" "}
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          {[
            "posts",
            "events",
            "groups",
            "settings",
            "proposal",
            "review",
            "messages",
            "calendar",
            "exchange",
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>{" "}
      <label>
        Language{" "}
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as "en" | "es")}
        >
          <option>en</option>
          <option>es</option>
        </select>
      </label>{" "}
      <label>
        Result{" "}
        <select onChange={(e) => setOutcome(e.target.value)}>
          <option>validation</option>
          <option>server error</option>
          <option>success</option>
          <option>throw</option>
        </select>
      </label>
      <hr className="my-5" />
      <div key={mode + lang}>
        {mode === "posts" && (
          <PostForm
            neighborhoods={[{ id: "sample", name: "Sample neighborhood" }]}
            dict={dict}
          />
        )}
        {mode === "events" && (
          <EventForm
            neighborhoods={[{ id: "sample", name: "Sample neighborhood" }]}
            defaultNeighborhoodId={null}
            dict={dict}
          />
        )}
        {mode === "groups" && (
          <CreateGroupForm
            categories={[
              { id: "sample", slug: "sample", name: "Sample category" },
            ]}
            dict={dict}
          />
        )}
        {mode === "settings" && (
          <SettingsForm
            groupId="synthetic"
            slug="synthetic"
            name="Original name"
            description="Original description"
            categoryId={null}
            visibility="public"
            joinPolicy="open"
            categories={[{ id: "sample", name: "Sample category" }]}
            dict={dict}
          />
        )}
        {mode === "proposal" && (
          <ProposalForm defaultOpens="2026-10-01T10:00" dict={dict} />
        )}
        {mode === "review" && (
          <ReviewControls
            id="synthetic"
            locale={lang}
            hasEvidence={false}
            finalizing={false}
            recordedApprove={null}
            recordedMessage=""
          />
        )}
        {mode === "messages" && (
          <div className="relative flex justify-end">
            <ThreadMenu
              threadId="synthetic"
              counterpartId="synthetic"
              muted={false}
              excerpt="Synthetic text"
              dict={dict}
            />
          </div>
        )}
        {mode === "calendar" && (
          <MonthView
            events={[
              {
                id: "synthetic",
                title: "Neighborhood picnic",
                starts_at: "2026-09-20T19:00:00Z",
                location: "Park",
              },
            ]}
            locale={lang}
            dict={dict}
            basePath="#"
            month={{ year: 2026, month: 9 }}
            selectedDay="2026-09-20"
          />
        )}
        {mode === "exchange" && (
          <PostRow
            href="#"
            markerLabel={dict.exchange.cats.event}
            markerColor="#36563d"
            hood="Sample neighborhood with a long name"
            when={
              lang === "en"
                ? "Sat, Sep 19, 10:00 AM PDT"
                : "sáb, 19 sept, 10:00 a. m. PDT"
            }
            title="Synthetic neighborhood gathering"
            authorName="Sample Neighbor"
            verifiedLabel="Verified"
          />
        )}
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
