"use client";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import type { LocationSuggestion } from "@/lib/event-locations";
import type { Dictionary } from "@/lib/i18n";

export function LocationInput({
  value,
  onChange,
  dict,
}: {
  value: string;
  onChange: (value: string) => void;
  dict: Dictionary;
}) {
  const [results, setResults] = useState<LocationSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const chosen = useRef(value);
  useEffect(() => {
    if (
      value.trim().length < 3 ||
      value === chosen.current ||
      value.length > 200
    ) {
      setResults([]);
      setLoading(false);
      setUnavailable(false);
      setActive(-1);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/event-locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: value }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (controller.signal.aborted) return;
        setResults(data.suggestions ?? []);
        setUnavailable(!response.ok || data.unavailable);
        setActive(-1);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setUnavailable(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 650);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);
  const select = (result: LocationSuggestion) => {
    chosen.current = result.value;
    onChange(result.value);
    setOpen(false);
    setResults([]);
  };
  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <Input
        id="location"
        name="location"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && results.length > 0}
        aria-controls="location-options"
        aria-activedescendant={
          open && active >= 0 ? `location-option-${active}` : undefined
        }
        aria-describedby="location-help"
        autoComplete="off"
        value={value}
        maxLength={300}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setResults([]);
          setActive(-1);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setActive(-1);
          }
          if (
            open &&
            results.length &&
            ["ArrowDown", "ArrowUp"].includes(e.key)
          ) {
            e.preventDefault();
            setActive((a) =>
              a < 0
                ? e.key === "ArrowDown"
                  ? 0
                  : results.length - 1
                : (a + (e.key === "ArrowDown" ? 1 : -1) + results.length) %
                  results.length,
            );
          }
          if (e.key === "Enter" && open && active >= 0 && results[active]) {
            e.preventDefault();
            select(results[active]);
          }
        }}
        placeholder={dict.events.fieldWherePlaceholder}
      />
      {open && results.length > 0 && (
        <ul
          id="location-options"
          role="listbox"
          aria-label={dict.events.fieldWhere}
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded border bg-background shadow-lg"
        >
          {results.map((r, i) => (
            <li
              key={r.value}
              id={`location-option-${i}`}
              role="option"
              aria-selected={active === i}
              className={`cursor-pointer border-b p-3 text-sm ${active === i ? "bg-muted" : "hover:bg-muted"}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(r)}
            >
              <span className="block font-semibold">{r.name}</span>
              {r.address && (
                <span className="block text-muted-foreground">{r.address}</span>
              )}
              <span className="block text-xs text-muted-foreground">
                {r.source === "steppe"
                  ? dict.events.usedBefore
                  : dict.events.publicPlace}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p id="location-help" className="mt-2 text-xs text-muted-foreground">
        {dict.events.locationHelp} {dict.events.locationPrivacy}{" "}
        <a
          className="underline"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap
        </a>
      </p>
      <p role="status" className="text-xs text-muted-foreground">
        {loading
          ? dict.events.searching
          : unavailable
            ? dict.events.locationUnavailable
            : open && value.length >= 3 && results.length === 0
              ? dict.events.locationManual
              : ""}
      </p>
    </div>
  );
}
