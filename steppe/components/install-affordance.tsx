"use client";

import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/components/use-install-prompt";
import type { Dictionary } from "@/lib/i18n";

/**
 * The add-to-home-screen banner, mounted above the app nav. Reads as a
 * Broadsheet section-row sibling — bone strip, ink hairline, square corners,
 * no elevation except the Button's own letterpress inset — never a toast,
 * never a blue bar.
 *
 * Shown only when there is a real install path and the member hasn't said
 * "not now": Android/Chromium once beforeinstallprompt has been stashed
 * (our button replays it), iOS/iPadOS with the spelled-out manual
 * instruction. Inside the installed app, or before mount, it renders
 * nothing. Dismissal is permanent (display-state in localStorage — see the
 * hook); the You-tab row stays as the persistent door.
 */
export function InstallAffordance({
  locale,
  dict,
}: {
  locale: string;
  dict: Dictionary;
}) {
  const { ready, installed, canPrompt, isIOS, dismissed, promptInstall, dismiss } =
    useInstallPrompt();

  if (!ready || installed || dismissed) return null;
  if (!canPrompt && !isIOS) return null;

  return (
    <aside
      lang={locale}
      aria-label={dict.install.eyebrow}
      className="w-full rounded-none border-b bg-muted"
    >
      <div className="mx-auto flex w-full max-w-[var(--content-max)] items-center gap-3 px-[var(--pad-screen)] py-2.5">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {dict.install.eyebrow}
          </p>
          <p className="mt-0.5 text-sm">{dict.install.why}</p>
          {isIOS && !canPrompt && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {dict.install.iosHow}
            </p>
          )}
        </div>

        {canPrompt && (
          <Button type="button" size="sm" onClick={promptInstall}>
            {dict.install.installCta}
          </Button>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          aria-label={dict.install.dismiss}
          onClick={dismiss}
        >
          {dict.install.dismiss}
        </Button>
      </div>
    </aside>
  );
}
