"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Pull-to-refresh — the bundle's gesture (inner.html :514-521, handlers
 * :1666-1671; spec §1.4): drag down from the top, damped ×0.6 (max 84px),
 * release past 52px to refresh; the indicator grows with the pull and shows
 * PULL → RELEASE → UPDATING… → UPDATED JUST NOW with the 13px rust-arc ring.
 *
 * Adaptations for the server-rendered feed (each deliberate):
 *  - "refresh" is router.refresh() in a transition; the UPDATED dwell starts
 *    on the transition's FALLING edge (when the refreshed tree commits), not
 *    when the request starts — on a slow connection the confirmation still
 *    shows for its full 2.2s.
 *  - the drag engages for TOUCH pointers only, at the top of the page — a
 *    mouse selecting text never inflates the indicator.
 *  - overscroll containment keeps the browser's own pull-to-refresh from
 *    fighting this one.
 *  - the collapsed indicator leaves the tab order (it is invisible); when
 *    visible it is a real button with a focus ring, and the state label is a
 *    live region so screen readers hear the refresh happen.
 */
export function PullToRefresh({
  labels,
  children,
}: {
  labels: { pull: string; release: string; updating: string; updated: string };
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [updated, setUpdated] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const drag = useRef<{ y: number; active: boolean }>({ y: 0, active: false });
  const wasRefreshing = useRef(false);

  // UPDATED dwell on the falling edge of the transition.
  useEffect(() => {
    if (wasRefreshing.current && !refreshing) {
      setPull(0);
      setUpdated(true);
      const t = setTimeout(() => setUpdated(false), 2200);
      return () => clearTimeout(t);
    }
    wasRefreshing.current = refreshing;
  }, [refreshing]);

  const doRefresh = () => {
    if (refreshing) return;
    setPull(56);
    wasRefreshing.current = true;
    startRefresh(() => router.refresh());
  };

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = {
      y: e.clientY,
      active: e.pointerType === "touch" && window.scrollY <= 2,
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active || refreshing) return;
    const dy = e.clientY - drag.current.y;
    if (dy > 0 && window.scrollY <= 2) setPull(Math.min(dy * 0.6, 84));
  };
  const onPointerEnd = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    if (pull > 52) doRefresh();
    else setPull(0);
  };

  const height = refreshing ? 56 : updated ? 30 : pull;
  const label = refreshing
    ? labels.updating
    : updated
      ? labels.updated
      : pull > 52
        ? labels.release
        : labels.pull;

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      style={{ overscrollBehaviorY: "contain" }}
    >
      <button
        type="button"
        onClick={doRefresh}
        tabIndex={height === 0 ? -1 : 0}
        aria-hidden={height === 0 ? true : undefined}
        className="flex w-full items-center justify-center gap-[9px] overflow-hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        style={{
          height,
          transition: drag.current.active ? undefined : "height .25s",
        }}
      >
        {refreshing && (
          <span
            aria-hidden="true"
            className="size-[13px] shrink-0 animate-spin rounded-full border-2 border-foreground/30 border-t-accent"
          />
        )}
        <span
          role="status"
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
        >
          {height > 0 ? label : ""}
        </span>
      </button>
      {children}
    </div>
  );
}
