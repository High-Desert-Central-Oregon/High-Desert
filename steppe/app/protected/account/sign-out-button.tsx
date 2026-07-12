"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Sign out — the You surface's LAST section, rust (the bundle's ySignout row,
 * preview-nav-spec §4). Moved here from the old nav dropdown; rust is the
 * accent, reserved for exactly this kind of marked action, never for errors.
 */
export function SignOutButton({ label }: { label: string }) {
  const router = useRouter();
  const signOut = async () => {
    await createClient().auth.signOut();
    router.push("/auth/login");
  };
  return (
    <button
      type="button"
      onClick={signOut}
      className="self-start py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {label}
    </button>
  );
}
