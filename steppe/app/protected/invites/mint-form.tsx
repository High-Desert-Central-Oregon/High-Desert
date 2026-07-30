"use client";

import { useState } from "react";
import { mintInviteToken } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t, type Dictionary } from "@/lib/i18n";

/**
 * Mint one token. Four inputs, and each one is a decision someone has to make
 * rather than a default they can ignore:
 *
 *   cap      how many addresses this card may admit. The blast radius if the
 *            card is photographed — not an abuse budget (0027, G-INV-4).
 *   days     how long it lives. There is deliberately no "never expires"
 *            option, because 0027 makes expires_at NOT NULL with no default:
 *            minting must state an end date.
 *   label    what this card IS, so a moderator reading the list in three months
 *            can tell the counter cards from the press batch.
 *   place    optional neighborhood. Left empty for a general-purpose token,
 *            which is the common case.
 *
 * The minted string is shown ONCE, large and copyable, immediately after minting
 * — but it is also permanently readable in the list below, because a moderator
 * has to be able to reprint a card. This is not a "save it now, you'll never see
 * it again" secret, and pretending it were would be a lie the schema does not
 * tell (G-INV-3).
 */
export function MintForm({
  dict,
  neighborhoods,
  origin,
}: {
  dict: Dictionary;
  neighborhoods: { id: string; name: string }[];
  origin: string;
}) {
  const [maxUses, setMaxUses] = useState("25");
  const [days, setDays] = useState("60");
  const [label, setLabel] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minted, setMinted] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mintedUrl = minted ? `${origin}/invite/${minted}` : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setMinted(null);
    setCopied(false);
    try {
      const result = await mintInviteToken({
        maxUses: Number(maxUses),
        days: Number(days),
        label,
        neighborhoodId: neighborhoodId || null,
      });
      if (result.ok) {
        setMinted(result.token);
        setLabel("");
      } else {
        setError(
          result.error === "invalid"
            ? dict.invites.mintInvalid
            : result.error === "forbidden"
              ? dict.invites.mintForbidden
              : dict.invites.mintFailed,
        );
      }
    } catch {
      setError(dict.invites.mintFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mintedUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard blocked. The URL is on screen and selectable, so there is
      // nothing to recover from.
      setCopied(false);
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded border p-4">
      <h2 className="text-lg font-semibold">{dict.invites.mintTitle}</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="mint-uses">{dict.invites.capLabel}</Label>
            <Input
              id="mint-uses"
              type="number"
              inputMode="numeric"
              min={1}
              max={250}
              required
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              aria-describedby="mint-uses-hint"
            />
            <p id="mint-uses-hint" className="text-xs text-muted-foreground">
              {dict.invites.capHint}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="mint-days">{dict.invites.daysLabel}</Label>
            <Input
              id="mint-days"
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              required
              value={days}
              onChange={(e) => setDays(e.target.value)}
              aria-describedby="mint-days-hint"
            />
            <p id="mint-days-hint" className="text-xs text-muted-foreground">
              {dict.invites.daysHint}
            </p>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="mint-label">{dict.invites.labelLabel}</Label>
          <Input
            id="mint-label"
            type="text"
            maxLength={120}
            placeholder={dict.invites.labelPlaceholder}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="mint-hood">{dict.invites.placeLabel}</Label>
          <select
            id="mint-hood"
            className="h-9 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs md:text-sm"
            value={neighborhoodId}
            onChange={(e) => setNeighborhoodId(e.target.value)}
            aria-describedby="mint-hood-hint"
          >
            <option value="">{dict.invites.placeNone}</option>
            {neighborhoods.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <p id="mint-hood-hint" className="text-xs text-muted-foreground">
            {dict.invites.placeHint}
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-700 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" disabled={busy} className="sm:self-start">
          {busy ? dict.invites.minting : dict.invites.mint}
        </Button>
      </form>

      {minted && (
        <div className="flex flex-col gap-2 rounded border border-success/40 bg-success/5 p-3" role="status">
          <p className="text-sm font-medium">{dict.invites.mintedTitle}</p>
          <code className="overflow-x-auto rounded bg-muted px-2 py-1 font-mono text-sm">
            {mintedUrl}
          </code>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
              {copied ? dict.invites.copied : dict.invites.copyUrl}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t(dict.invites.mintedCode, { code: minted })}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
