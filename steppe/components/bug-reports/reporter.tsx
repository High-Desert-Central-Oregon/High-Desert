"use client";
import { sentryReferences } from "@/lib/bug-reports/sentry-references";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bug, X } from "lucide-react";
import { bugCopy } from "@/lib/bug-reports/copy";
import {
  clearDiagnostics,
  diagnosticBuffer,
  diagnosticEnvironment,
  recordDiagnostic,
} from "@/lib/bug-reports/client";
import {
  safePage,
  sanitizeDiagnostics,
  parseReport,
  type Diagnostics,
  type ReportInput,
} from "@/lib/bug-reports/shared";
import "./reporter.css";

export function BugReporter({
  appLocale,
  siteLocale,
  release,
}: {
  appLocale: "en" | "es";
  siteLocale: "en" | "es";
  release: string;
}) {
  const pathname = usePathname();
  const locale = /^\/(protected|auth|invite|welcome)(\/|$)/.test(pathname)
    ? appLocale
    : siteLocale;
  const t = bugCopy[locale];
  const dialog = useRef<HTMLDialogElement>(null);
  const frozen = useRef<ReportInput | null>(null);
  const requestKey = useRef<string | null>(null);
  const generation = useRef(0);
  const knownUser = useRef<string | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [capture, setCapture] = useState(false);
  const [include, setInclude] = useState(false);
  const [details, setDetails] = useState<Diagnostics | null>(null);
  const [description, setDescription] = useState("");
  const [expected, setExpected] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<
    "idle" | "invalid" | "sending" | "failed" | "rate" | "saved"
  >("idle");
  const [reportId, setReportId] = useState("");

  useEffect(() => {
    recordDiagnostic("page.open");
    if (pathname.startsWith("/auth/")) clearDiagnostics();
  }, [pathname]);
  useEffect(() => {
    const clear = () => {
      generation.current += 1;
      frozen.current = null;
      requestKey.current = null;
      setCapture(false);
      setInclude(false);
      setDetails(null);
      setDescription("");
      setExpected("");
      setEmail("");
      setReportId("");
      setState("idle");
    };
    const submit = (e: Event) => {
      if (!(e.target as Element)?.closest("[data-bug-reporter]"))
        recordDiagnostic("form.submit");
    };
    const error = () => recordDiagnostic("client.error");
    const rejection = () => recordDiagnostic("client.rejection");
    const online = () => recordDiagnostic("network.online");
    const offline = () => recordDiagnostic("network.offline");
    // Observe only the existence of an app error notice, never its text/markup.
    const observer = new MutationObserver((records) => {
      if (!diagnosticBuffer.isEnabled()) return;
      const hasAlert = records.some((record) =>
        Array.from(record.addedNodes).some(
          (node) =>
            node instanceof Element &&
            !node.closest("[data-bug-reporter]") &&
            (node.matches('[role="alert"]') ||
              node.querySelector('[role="alert"]')),
        ),
      );
      if (hasAlert) recordDiagnostic("ui.error");
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("steppe:diagnostics-cleared", clear);
    document.addEventListener("submit", submit, true);
    window.addEventListener("error", error);
    window.addEventListener("unhandledrejection", rejection);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("pagehide", clearDiagnostics);
    return () => {
      observer.disconnect();
      window.removeEventListener("steppe:diagnostics-cleared", clear);
      document.removeEventListener("submit", submit, true);
      window.removeEventListener("error", error);
      window.removeEventListener("unhandledrejection", rejection);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("pagehide", clearDiagnostics);
    };
  }, []);
  useEffect(() => {
    // A sign-out in another tab must also discard this tab's diagnostic draft.
    // Keep the subscription across public and member routes: a member may
    // navigate to the website before signing out in another tab.
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    void import("@/lib/supabase/client")
      .then(({ createClient }) => {
        if (disposed) return;
        const { data } = createClient().auth.onAuthStateChange(
          (event, session) => {
            const nextUser = session?.user.id ?? null;
            if (
              event === "SIGNED_OUT" ||
              (knownUser.current !== undefined &&
                knownUser.current !== nextUser)
            )
              clearDiagnostics();
            knownUser.current = nextUser;
          },
        );
        unsubscribe = () => data.subscription.unsubscribe();
      })
      .catch(() => clearDiagnostics());
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, []);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current?.close();
  }, [open]);

  const show = () => {
    if (!frozen.current)
      setDetails(
        sanitizeDiagnostics({
          events: diagnosticBuffer.snapshot(),
          sentryErrors: sentryReferences.snapshot(),
          environment: diagnosticEnvironment(locale, release),
        }),
      );
    setOpen(true);
  };
  const toggleCapture = (enabled: boolean) => {
    diagnosticBuffer.enable(enabled);
    setCapture(enabled);
    setInclude(enabled);
    if (enabled) recordDiagnostic("page.open");
    setDetails(
      enabled
        ? sanitizeDiagnostics({
            events: diagnosticBuffer.snapshot(),
            sentryErrors: sentryReferences.snapshot(),
            environment: diagnosticEnvironment(locale, release),
          })
        : null,
    );
  };
  const payload = (): ReportInput => {
    requestKey.current ??= crypto.randomUUID();
    return (
      frozen.current ?? {
        requestKey: requestKey.current,
        description,
        expected,
        email,
        page: safePage(pathname),
        locale,
        diagnostics: include ? details : null,
      }
    );
  };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "sending") return;
    const candidate = parseReport(payload());
    if (!candidate) {
      setState("invalid");
      return;
    }
    frozen.current = candidate;
    const submittedGeneration = generation.current;
    setState("sending");
    try {
      const result = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(frozen.current),
        signal: AbortSignal.timeout(20_000),
      });
      const body = await result.json();
      if (submittedGeneration !== generation.current) return;
      if (result.ok && body.ok && typeof body.id === "string") {
        setReportId(body.id);
        setState("saved");
      } else setState(result.status === 429 ? "rate" : "failed");
    } catch {
      if (submittedGeneration === generation.current) setState("failed");
    }
  };
  const download = () => {
    const { requestKey: _privateKey, ...report } = payload();
    void _privateKey;
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { ...report, release, reportId: reportId || undefined },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "steppe-bug-report.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const reset = () => {
    frozen.current = null;
    requestKey.current = null;
    setDescription("");
    setExpected("");
    setEmail("");
    setReportId("");
    setState("idle");
    setDetails(
      sanitizeDiagnostics({
        events: diagnosticBuffer.snapshot(),
        sentryErrors: sentryReferences.snapshot(),
        environment: diagnosticEnvironment(locale, release),
      }),
    );
  };
  const locked = frozen.current !== null;
  return (
    <div data-bug-reporter lang={locale}>
      <button
        type="button"
        className="steppe-bug-launcher"
        onClick={show}
        aria-haspopup="dialog"
      >
        <Bug size={18} aria-hidden="true" />
        <span>{t.button}</span>
      </button>
      <dialog
        ref={dialog}
        className="steppe-bug-dialog"
        aria-labelledby="bug-title"
        aria-describedby="bug-intro"
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
      >
        <header>
          <h2 id="bug-title">{t.title}</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t.close}
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <p id="bug-intro">{t.intro}</p>
        {state === "saved" ? (
          <section role="status">
            <h3>{t.success}</h3>
            <p>
              {t.reference}: <strong>{reportId.slice(0, 8)}</strong>
            </p>
            <button type="button" onClick={reset}>
              {t.another}
            </button>
          </section>
        ) : (
          <form onSubmit={send}>
            <label htmlFor="bug-description">{t.description}</label>
            <textarea
              id="bug-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              minLength={5}
              maxLength={4000}
              readOnly={locked}
            />
            <label htmlFor="bug-expected">{t.expected}</label>
            <textarea
              id="bug-expected"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              maxLength={2000}
              readOnly={locked}
              rows={2}
            />
            <label htmlFor="bug-email">{t.email}</label>
            <input
              id="bug-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={320}
              readOnly={locked}
              aria-describedby="bug-email-hint"
            />
            <p id="bug-email-hint" className="steppe-bug-hint">
              {t.emailHint}
            </p>
            <label className="steppe-bug-check">
              <input
                type="checkbox"
                checked={capture}
                onChange={(e) => toggleCapture(e.target.checked)}
                disabled={locked}
              />
              {t.capture}
            </label>
            <p className="steppe-bug-hint">{t.captureHint}</p>
            {capture && (
              <p role="status" className="steppe-bug-hint">
                {t.captureOn}
              </p>
            )}
            <label className="steppe-bug-check">
              <input
                type="checkbox"
                checked={include}
                onChange={(e) => setInclude(e.target.checked)}
                disabled={locked || !details}
              />
              {t.include}
            </label>
            <button type="button" disabled={locked} onClick={show}>
              {t.refreshDetails}
            </button>
            <p className="steppe-bug-hint">{t.sentryHint}</p>
            <details>
              <summary>{t.preview}</summary>
              <p>
                {t.page}: {safePage(pathname)}
              </p>
              <p>
                {t.release}: {release}
              </p>
              {!details?.events.length && <p>{t.empty}</p>}
              <pre>{JSON.stringify(details, null, 2)}</pre>
            </details>
            <p className="steppe-bug-hint">{t.privacy}</p>
            {state === "invalid" && <p role="alert">{t.invalid}</p>}
            {(state === "failed" || state === "rate") && (
              <p role="alert">{state === "rate" ? t.rate : t.failed}</p>
            )}
            <button
              type="submit"
              className="steppe-bug-submit"
              disabled={state === "sending"}
            >
              {state === "sending" ? t.sending : t.send}
            </button>
          </form>
        )}
        {capture && (
          <button
            type="button"
            onClick={() => {
              diagnosticBuffer.enable(false);
              setCapture(false);
            }}
          >
            {t.stop}
          </button>
        )}
        <footer>
          <button type="button" onClick={download}>
            {t.download}
          </button>
          <a href="mailto:hello@steppe.community?subject=Steppe%20bug%20report">
            {t.contact}
          </a>
        </footer>
      </dialog>
    </div>
  );
}
