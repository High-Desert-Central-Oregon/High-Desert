import { redirect } from "next/navigation";

/**
 * High Desert uses one passwordless flow for both joining and returning
 * (see `MagicLinkForm`), so there is no separate sign-up screen. Keep this
 * route as a permanent redirect so existing links and the nav still work.
 */
export default function SignUpPage() {
  redirect("/auth/login");
}
