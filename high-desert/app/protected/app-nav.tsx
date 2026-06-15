"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, ChevronDown } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetClose,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/lib/i18n";

export type NavItem = { href: string; label: string };

/**
 * The protected-app navigation. Below md it collapses to a hamburger that opens a
 * Sheet (Radix Dialog → focus trap, Esc-to-close, focus return, aria-expanded on
 * the trigger); at md+ it's a single horizontal row that doesn't wrap — the
 * primary destinations inline, and the trailing cluster (account links + Sign
 * out) consolidated into one menu beside the language toggle. All labels are
 * passed in already-localized.
 */
export function AppNav({
  primary,
  account,
  locale,
  wordmark,
  email,
  labels,
}: {
  primary: NavItem[];
  account: NavItem[];
  locale: Locale;
  wordmark: string;
  email: string | null;
  labels: { menu: string; close: string; signOut: string; account: string };
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push("/auth/login");
  };

  const linkClass =
    "py-1 text-muted-foreground hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none";

  return (
    <nav lang={locale} className="flex w-full justify-center border-b">
      <div className="flex w-full max-w-3xl items-center gap-4 p-3 px-5 text-sm">
        <Link
          href="/protected"
          className="shrink-0 py-1 focus-visible:underline focus-visible:outline-none"
        >
          <Wordmark name={wordmark} />
        </Link>

        {/* md+ : inline primary destinations */}
        <ul className="ml-2 hidden items-center gap-4 md:flex">
          {primary.map((it) => (
            <li key={it.href}>
              <Link href={it.href} className={linkClass}>
                {it.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* md+ : consolidated trailing cluster — language toggle + account menu */}
        <div className="ml-auto hidden items-center gap-3 md:flex">
          <LanguageSwitcher current={locale} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <span className="max-w-[14ch] truncate">{email ?? labels.account}</span>
                <ChevronDown className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {account.map((it) => (
                <DropdownMenuItem key={it.href} asChild>
                  <Link href={it.href}>{it.label}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  void signOut();
                }}
              >
                {labels.signOut}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* below md : hamburger → sheet with every destination */}
        <div className="ml-auto md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label={labels.menu}>
                <Menu className="size-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" closeLabel={labels.close} className="w-72">
              <SheetHeader>
                <SheetTitle>{wordmark}</SheetTitle>
                {email && <SheetDescription>{email}</SheetDescription>}
              </SheetHeader>
              <ul className="flex flex-col gap-1">
                {[...primary, ...account].map((it) => (
                  <li key={it.href}>
                    <SheetClose asChild>
                      <Link
                        href={it.href}
                        className="block rounded-md px-3 py-2 text-base hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                      >
                        {it.label}
                      </Link>
                    </SheetClose>
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex flex-col gap-3">
                <LanguageSwitcher current={locale} />
                <Button variant="outline" onClick={signOut}>
                  {labels.signOut}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
