import Link from "next/link";
import { Button } from "./ui/button";
import { LogoutButton } from "./logout-button";
import { getCurrentUser } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";

/**
 * Nav auth control. One passwordless entry point: "Sign in" covers joining too.
 * Reads cookies/claims — render inside a `<Suspense>` boundary.
 */
export async function AuthButton() {
  const { dict } = await getServerDictionary();
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Button asChild size="sm" variant="default">
        <Link href="/auth/login">{dict.nav.signIn}</Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      {user.email && (
        <span className="hidden text-muted-foreground sm:inline">
          {user.email}
        </span>
      )}
      <LogoutButton label={dict.nav.signOut} />
    </div>
  );
}
