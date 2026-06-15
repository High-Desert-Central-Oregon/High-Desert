"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { leaveGroup, type LeaveState } from "./actions";
import type { Dictionary } from "@/lib/i18n";

/**
 * Leave-group control for the group page. Leaving a members-only group means
 * losing access to its content, so it's a confirm-first action (invariant 10).
 * Posts to the `leave_group` RPC; on success the server revalidates and the page
 * re-renders as a non-member. The sole-maintainer guard (you can't orphan a
 * group's administration) surfaces as a clear message.
 */
export function LeaveGroupButton({
  groupId,
  slug,
  dict,
  size = "sm",
}: {
  groupId: string;
  slug: string;
  dict: Dictionary;
  size?: "sm" | "default";
}) {
  const [state, action, isPending] = useActionState<LeaveState, FormData>(
    leaveGroup,
    null,
  );
  const error =
    state && "error" in state
      ? state.error === "last-maintainer"
        ? dict.groups.leaveLastMaintainer
        : dict.groups.leaveError
      : null;

  return (
    <form
      action={action}
      className="flex flex-col items-end gap-1"
      onSubmit={(e) => {
        if (!window.confirm(dict.groups.confirmLeave)) e.preventDefault();
      }}
    >
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="slug" value={slug} />
      <Button type="submit" variant="outline" size={size} disabled={isPending}>
        {isPending ? dict.groups.leaving : dict.groups.leave}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-red-700 dark:text-red-400">
          {error}
        </span>
      )}
    </form>
  );
}
