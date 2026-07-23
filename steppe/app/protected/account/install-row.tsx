"use client";

import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/components/use-install-prompt";
import type { Dictionary } from "@/lib/i18n";

/**
 * The You-tab "Add to home screen" row — the PERSISTENT door. It deliberately
 * ignores the banner's hd_install_dismissed marker: saying "not now" to a
 * piece of chrome must never remove the capability itself. Android replays
 * the stashed install prompt; iOS shows the spelled-out manual instruction.
 *
 * Renders as a hairline <li> inside the account nav list, or nothing when
 * this device has no install path (or is already the installed app) — so an
 * inapplicable device never shows an empty divider row.
 */
export function InstallRow({ dict }: { dict: Dictionary }) {
  const { ready, installed, canPrompt, isIOS, promptInstall } =
    useInstallPrompt();

  if (!ready || installed || (!canPrompt && !isIOS)) return null;

  return (
    <li className="flex items-center justify-between gap-3 py-3 text-sm">
      <span className="flex min-w-0 flex-col">
        <span>{dict.install.rowLabel}</span>
        <span className="mt-0.5 text-xs text-muted-foreground">
          {isIOS && !canPrompt ? dict.install.iosHow : dict.install.why}
        </span>
      </span>
      {canPrompt && (
        <Button type="button" size="sm" onClick={promptInstall}>
          {dict.install.installCta}
        </Button>
      )}
    </li>
  );
}
