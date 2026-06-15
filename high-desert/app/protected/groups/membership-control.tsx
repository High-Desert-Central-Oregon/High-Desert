"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { joinGroup, type JoinState } from "./actions";
import type { GroupControl } from "@/lib/groups";
import type { Dictionary } from "@/lib/i18n";

/**
 * The single membership affordance for a group, chosen by `groupControl()`. Join
 * and request-to-join post to the `join_group` RPC (status is set server-side —
 * the client never sets it, G10); the rest are links or quiet status labels.
 * Effort where it belongs (invariant 10): joining is one tap; nothing here is a
 * consequential, confirm-first action.
 */
export function MembershipControl({
  control,
  groupId,
  slug,
  dict,
  size = "sm",
}: {
  control: GroupControl;
  groupId: string;
  slug: string;
  dict: Dictionary;
  size?: "sm" | "default";
}) {
  const [state, action, isPending] = useActionState<JoinState, FormData>(
    joinGroup,
    null,
  );
  const error = state && "error" in state ? dict.groups.joinError : null;

  if (control === "manage") {
    return (
      <Button asChild variant="outline" size={size}>
        <Link href={`/protected/groups/${slug}/manage`}>{dict.groups.manage}</Link>
      </Button>
    );
  }
  if (control === "member") {
    return (
      <Button asChild variant="outline" size={size}>
        <Link href={`/protected/groups/${slug}`}>{dict.groups.member}</Link>
      </Button>
    );
  }
  if (control === "pending") {
    return (
      <span className="text-xs font-medium text-muted-foreground">
        {dict.groups.pending}
      </span>
    );
  }
  if (control === "invited") {
    return (
      <span className="text-xs font-medium text-muted-foreground">
        {dict.groups.invited}
      </span>
    );
  }
  if (control === "locked") {
    return (
      <Button variant="outline" size={size} disabled>
        {dict.groups.inviteOnly}
      </Button>
    );
  }

  // join | request — the interactive paths.
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="group_id" value={groupId} />
      <Button type="submit" size={size} disabled={isPending}>
        {isPending
          ? dict.groups.joining
          : control === "join"
            ? dict.groups.join
            : dict.groups.requestToJoin}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-red-700 dark:text-red-400">
          {error}
        </span>
      )}
    </form>
  );
}
