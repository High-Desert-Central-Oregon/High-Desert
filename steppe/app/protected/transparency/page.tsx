import { redirect } from "next/navigation";

/**
 * Transparency moved INSIDE Govern as "the Record" (preview-nav-spec §4,
 * adopted 2026-07-11). Temporary redirect (redirect() issues 307) so old links
 * keep working and the path stays repointable.
 */
export default function TransparencyRedirect() {
  redirect("/protected/governance/record");
}
