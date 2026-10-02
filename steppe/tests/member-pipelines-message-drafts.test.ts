/** Steppe — message action boundaries with isolated database doubles.
 * Copyright (C) 2026 Steppe
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  client: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));

import { startThreadDraft as startThread, sendReplyDraft as sendReply, reportThreadDraft as reportThread, startThread as startFallback, sendReply as replyFallback, reportThread as reportFallback } from "@/app/protected/messages/actions";
import { attemptMessageAction } from "@/lib/messages/action-result";

const thread = "11111111-1111-4111-8111-111111111111";
const neighbor = "22222222-2222-4222-8222-222222222222";
const post = "33333333-3333-4333-8333-333333333333";
const member = "44444444-4444-4444-8444-444444444444";
const failure = { error: "send-failed" };
const actions = [
  { name: "start", run: startThread, destination: `/protected/messages/${thread}` },
  { name: "reply", run: sendReply, destination: `/protected/messages/${thread}` },
  { name: "report", run: reportThread, destination: `/protected/messages/${thread}?reported=1` },
];
function draft(body = "  Synthetic text  ") {
  const data = new FormData();
  data.set("with_id", neighbor);
  data.set("about_post", post);
  data.set("thread_id", thread);
  data.set("body", body);
  data.set("excerpt", "Synthetic participant-provided excerpt");
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: member });
  mocks.rpc.mockResolvedValue({ data: thread, error: null });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.from.mockReturnValue({ insert: mocks.insert });
  mocks.client.mockResolvedValue({ rpc: mocks.rpc, from: mocks.from });
});

describe.each(actions)("$name draft action", ({ run, destination }) => {
  it("returns a generic empty-text error without a database call or redirect", async () => {
    expect(await run(null, draft("   "))).toEqual(failure);
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("rejects invalid identifiers without a database call", async () => {
    const data = draft();
    for (const key of ["with_id", "about_post", "thread_id"]) data.set(key, "invalid");
    expect(await run(null, data)).toEqual(failure);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("does not disclose the database refusal reason", async () => {
    const error = { message: "Private participant/refusal details" };
    mocks.rpc.mockResolvedValue({ data: null, error });
    mocks.insert.mockResolvedValue({ error });
    expect(await run(null, draft())).toEqual(failure);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("returns a generic error for a thrown database transport failure", async () => {
    mocks.rpc.mockRejectedValue(new TypeError("Synthetic transport failure"));
    mocks.insert.mockRejectedValue(new TypeError("Synthetic transport failure"));
    expect(await run(null, draft())).toEqual(failure);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("handles client initialization failures without disclosing details", async () => {
    mocks.client.mockRejectedValue(new Error("Synthetic initialization failure"));
    expect(await run(null, draft())).toEqual(failure);
  });
  it("still redirects signed-out members before any database write", async () => {
    mocks.user.mockResolvedValue(null);
    await expect(run(null, draft())).rejects.toMatchObject({
      digest: expect.stringContaining(";/auth/login;"),
    });
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("preserves successful navigation through both server and client catch boundaries", async () => {
    await expect(attemptMessageAction(() => run(null, draft()))).rejects.toMatchObject({
      digest: expect.stringContaining(`;${destination};`),
    });
    expect(mocks.revalidate).toHaveBeenCalledWith("/protected/messages" +
      (run === reportThread ? `/${thread}` : ""));
  });
});

describe("message payload boundaries", () => {
  it("keeps start_thread as the post-anchored permission/rate gate and caps its text", async () => {
    await expect(startThread(null, draft("x".repeat(4100)))).rejects.toThrow();
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("start_thread", {
      p_with: neighbor, p_about_post: post, p_body: "x".repeat(4000),
    });
  });
  it("treats an empty start_thread result as failure", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect(await startThread(null, draft())).toEqual(failure);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("pins reply identity to the session and keeps the RLS insert", async () => {
    const data = draft("x".repeat(4100));
    data.set("sender_id", neighbor);
    await expect(sendReply(null, data)).rejects.toThrow();
    expect(mocks.from).toHaveBeenCalledWith("messages");
    expect(mocks.insert).toHaveBeenCalledWith({
      thread_id: thread, sender_id: member, body: "x".repeat(4000),
    });
  });
  it("pins reporter identity and uses only the submitted excerpt with existing limits", async () => {
    const data = draft("x".repeat(2100));
    data.set("reporter_id", neighbor);
    data.set("excerpt", "q".repeat(4100));
    await expect(reportThread(null, data)).rejects.toThrow();
    expect(mocks.from).toHaveBeenCalledWith("reports");
    expect(mocks.insert).toHaveBeenCalledWith({
      reporter_id: member, target_type: "message_thread", target_id: thread,
      body: "x".repeat(2000), quoted_excerpt: "q".repeat(4000),
    });
  });
  it("turns a browser-to-action transport rejection into generic failure", async () => {
    expect(await attemptMessageAction(async () => {
      throw new TypeError("Synthetic disconnected request");
    })).toEqual(failure);
  });
});

describe("JS-optional navigation fallback", () => {
  it.each([startFallback, replyFallback, reportFallback])("keeps failure navigation for an unenhanced form", async (fallback) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Synthetic refusal" } });
    mocks.insert.mockResolvedValue({ error: { message: "Synthetic refusal" } });
    const data = draft();
    data.set("back", `/protected/exchange/${post}`);
    await expect(fallback(data)).rejects.toMatchObject({ digest: expect.stringContaining("?msgErr=1;") });
  });
});
