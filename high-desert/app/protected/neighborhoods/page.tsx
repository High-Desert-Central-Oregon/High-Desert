import { Suspense } from "react";
import { redirect } from "next/navigation";
import { NeighborhoodForm } from "./neighborhood-form";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";

export const metadata = {
  title: "Your neighborhood · High Desert",
};

type NeighborhoodRow = { id: string; name: string };

async function NeighborhoodContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const { locale, dict } = await getServerDictionary();
  const supabase = await createClient();

  // All seeded neighborhoods, alphabetical — chronological + alpha is the only
  // allowed ordering (invariant 7; no ranking or scoring).
  const { data: neighborhoods } = await supabase
    .from("neighborhoods")
    .select("id, name")
    .order("name", { ascending: true })
    .returns<NeighborhoodRow[]>();

  // The member's current neighborhood selection (may be null).
  const { data: profile } = await supabase
    .from("profiles")
    .select("neighborhood_id")
    .eq("id", user.id)
    .maybeSingle<{ neighborhood_id: string | null }>();

  return (
    <div lang={locale} className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {dict.neighborhoods.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {dict.neighborhoods.intro}
        </p>
      </header>

      <NeighborhoodForm
        neighborhoods={neighborhoods ?? []}
        currentId={profile?.neighborhood_id ?? null}
        dict={dict}
      />
    </div>
  );
}

export default function NeighborhoodPage() {
  return (
    <Suspense>
      <NeighborhoodContent />
    </Suspense>
  );
}
