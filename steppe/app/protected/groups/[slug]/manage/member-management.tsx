"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  approveMember,
  denyMember,
  removeMember,
  setMemberRole,
  addMember,
  type MemberActionState,
} from "./actions";
import type { Dictionary } from "@/lib/i18n";
import type { GroupMemberRole } from "@/lib/types/db";

type PendingMember = { userId: string; name: string };
type ActiveMember = { userId: string; name: string; role: GroupMemberRole };
type Candidate = { id: string; name: string };

/**
 * Member management for a maintainer. Mirrors /protected/review: each control
 * calls a server action (a 1a maintainer RPC) inside a transition; the server
 * revalidates and the list refreshes. Removing/demoting confirm first (invariant
 * 10), and the last-maintainer guard surfaces as a clear message.
 */
export function MemberManagement({
  groupId,
  slug,
  pending,
  active,
  candidates,
  myUserId,
  dict,
}: {
  groupId: string;
  slug: string;
  pending: PendingMember[];
  active: ActiveMember[];
  candidates: Candidate[];
  myUserId: string;
  dict: Dictionary;
}) {
  const [isPending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addUser, setAddUser] = useState("");

  const run = (fn: () => Promise<MemberActionState>) => {
    setError(null);
    start(async () => {
      const result = await fn();
      if (result && "error" in result) {
        setError(
          result.error === "last-maintainer"
            ? dict.groups.lastMaintainerError
            : dict.groups.manageError,
        );
      }
    });
  };

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Pending requests */}
      <section className="flex flex-col gap-3">
        <header className="flex flex-col gap-1">
          <h3 className="font-medium">{dict.groups.pendingTitle}</h3>
          <p className="text-sm text-muted-foreground">{dict.groups.pendingIntro}</p>
        </header>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {dict.groups.pendingEmpty}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.map((m) => (
              <li
                key={m.userId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm"
              >
                <span className="font-medium">{m.name}</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() => run(() => approveMember(groupId, m.userId, slug))}
                  >
                    {dict.groups.approve}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => run(() => denyMember(groupId, m.userId, slug))}
                  >
                    {dict.groups.deny}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Active members */}
      <section className="flex flex-col gap-3">
        <h3 className="font-medium">{dict.groups.activeTitle}</h3>
        {active.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {dict.groups.membersEmpty}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {active.map((m) => {
              const isMaintainer = m.role === "maintainer";
              const isSelf = m.userId === myUserId;
              return (
                <li
                  key={m.userId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{m.name}</span>
                    {isMaintainer && (
                      <Badge variant="secondary">{dict.groups.roleMaintainer}</Badge>
                    )}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => {
                        if (
                          isMaintainer &&
                          !window.confirm(dict.groups.confirmDemote)
                        )
                          return;
                        run(() =>
                          setMemberRole(
                            groupId,
                            m.userId,
                            isMaintainer ? "member" : "maintainer",
                            slug,
                          ),
                        );
                      }}
                    >
                      {isMaintainer
                        ? dict.groups.makeMember
                        : dict.groups.makeMaintainer}
                    </Button>
                    {!isSelf && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isPending}
                        onClick={() => {
                          if (!window.confirm(dict.groups.confirmRemove)) return;
                          run(() => removeMember(groupId, m.userId, slug));
                        }}
                      >
                        {dict.groups.remove}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Add member (for invite-only / locked groups) */}
      <section className="flex flex-col gap-3">
        <header className="flex flex-col gap-1">
          <h3 className="font-medium">{dict.groups.addTitle}</h3>
          <p className="text-sm text-muted-foreground">{dict.groups.addIntro}</p>
        </header>
        {candidates.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {dict.groups.addEmpty}
          </p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="add-member" className="sr-only">
              {dict.groups.addSelectLabel}
            </label>
            <select
              id="add-member"
              value={addUser}
              onChange={(e) => setAddUser(e.target.value)}
              className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">{dict.groups.addSelectPlaceholder}</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button
              disabled={isPending || addUser === ""}
              onClick={() => {
                const u = addUser;
                if (!u) return;
                setAddUser("");
                run(() => addMember(groupId, u, slug));
              }}
            >
              {dict.groups.addButton}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
